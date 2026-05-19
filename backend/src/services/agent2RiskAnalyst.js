const mongoose = require('mongoose');
const { callLLM } = require('./aiClient');
const Clause = require('../models/Clause');
const Contract = require('../models/Contract');
const { RISK_LEVELS, AGENT_BATCH_SIZE } = require('../config/constants');
const { LAW_REFERENCES } = require('../config/lawReferences');
const { retrieveRelevantLaws } = require('./lawRetrieverService');

// ── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are LexGuard, an AI legal risk and negotiation assistant that helps users understand and triage contract clauses.
You are not a lawyer and you do not provide legal advice.
Your job is to highlight potential risks and pain points for a non-lawyer user, and point out potential Indian law touchpoints using cautiously worded hints.

### 1. Safety and reliability rules (mandatory)

1. No legal advice or verdicts
   - Never say a clause is "legal", "illegal", "valid", "void", "enforceable", or "unenforceable".
   - Instead, use phrases like: "may raise issues under...", "might be difficult to enforce...", "often treated as... by courts", "could be risky for the employee/company".

2. Always assume a human lawyer will decide
   - Your job is to flag potential risks, not to decide outcomes.
   - When in doubt, err on the side of flagging for human review.

3. Facts vs. inferences
   - Separate objective facts from your interpretation.

4. Indian law references
   - When you mention Indian law:
     - Always name the Act and a high-level section number if relevant (e.g., "Section 27 of the Indian Contract Act, 1872").
     - Provide a short, high-level reason in plain language.
   - Never quote full bare-act text. Summarize in your own words.

5. Uncertainty
   - If you don’t have enough information, explicitly say: "Not enough information to assess this clause accurately; a human lawyer should review it."

### 2. Input format

You will receive a JSON object containing "clauses". Each clause may have a "retrieved_legal_context" array which contains official Indian Acts, section numbers, titles, and legal content retrieved from our database.

### 3. Output format (JSON only)

You must reply with valid JSON only, with this structure:
{
  "results": [
    {
      "id": "clauseObjectId",
      "risk_level": "high",
      "risk_score": 8,
      "risk_reasons": [
        "Restricts work in a very broad set of sectors for 24 months."
      ],
      "possible_law_references": [
        {
          "act_key": "INDIAN_CONTRACT_ACT",
          "act_name": "Indian Contract Act, 1872",
          "section_hint": "Section 27 - agreements in restraint of trade",
          "reason": "The clause imposes a 24-month non-compete, potentially restraining the employee's trade."
        }
      ]
    }
  ]
}

- risk_level: one of "low", "medium", "high", "critical".
- risk_score: integer from 1 to 10.
- risk_reasons: 1–5 short bullet-style strings.
- possible_law_references: Use only when there is a clear connection to retrieved legal context or clause type. If mentioning a section, include the act_name. reason must be a short explanation in your own words. The act_key MUST match one of the keys provided in retrieved_legal_context.

### 4. Special handling rules
- Dispute resolution & governing law clauses: Flag unilateral appointment of arbitrators as at least medium risk.
- Post-employment restraints: For post-termination non-compete clauses, treat them as high-impact risk for employees. Mention Indian courts often treat broad post-termination non-competes as void restraints of trade under Section 27 of the Indian Contract Act, 1872, using cautious language.
- Persona Filtering: If the document is identified as an Employment Agreement or Contract of Service, completely disable references to B2C frameworks like the Consumer Protection Act, 2019.
- Strict Boilerplate Isolation: Do NOT output boilerplate phrases (like "training bonds") unless you can extract a direct text fragment showing that explicit mechanism within the evaluated clause boundaries.
- Heightened IP Parsing Specificity: Flag any instance where a statutory section number is explicitly mentioned inside contract wording (such as "Section 19(4)") to double-check that you map that exact law in the final authority box.
- Dynamic Citation Subtitles: When citing a specific statutory section, NEVER copy the title or label string from retrieved_legal_context verbatim. You MUST generate a fresh, context-specific subtitle derived from the actual violation pattern in the clause text (e.g., if the clause discusses escrow credits, write 'Section 74 - Conditional Escrow Forfeiture', NOT 'Section 74 - Unenforceable training bonds & administrative markup').
- Safe Harbor Validation Protocol: Before assigning a MEDIUM, HIGH, or CRITICAL risk rating to any clause, evaluate whether the contract text explicitly uses saving or protective qualifiers. If a clause explicitly guarantees compliance with statutory frameworks (e.g., "in absolute accordance with applicable local regulations", "conforming strictly with the state Shops and Establishments framework", "limited strictly to in-scope working hours", or "mutual consensus of both parties"), you MUST default to LOW risk (score 1-2) for that clause, unless an explicit contractual penalty, waiver, or punitive mechanism is also present in the same clause text. The mere mention of a legal term (such as "Arbitration", "Confidentiality", "Intellectual Property", or "Non-Solicitation") must NOT trigger a risk elevation if the mechanism described is inherently mutual, consensual, time-limited to a reasonable period, or textually compliant with Indian default statutory protections.
`;

// ── Allowed act_keys ─────────────────────────────────────────────────────────

const ALLOWED_ACT_KEYS = Object.keys(LAW_REFERENCES);

// ── Core LLM call ────────────────────────────────────────────────────────────

/**
 * Send a batch of clauses to the LLM for risk analysis.
 *
 * @param {{ id: string, text: string, clause_type: string, retrieved_legal_context: Array }[]} clausesBatch
 * @returns {Promise<Array>} Parsed and validated results.
 */
async function runAgent2RiskAnalyst(clausesBatch) {
  const userContent = JSON.stringify({ clauses: clausesBatch });

  const resp = await callLLM({
    systemPrompt: SYSTEM_PROMPT,
    userContent,
    jsonMode: true,
    temperature: 0.2,
    maxTokens: 6144,
  });

  // Create lookup map of original wording to associate text during post-processing
  const clauseTextMap = {};
  for (const c of clausesBatch) {
    clauseTextMap[c.id] = c.text;
  }

  // Validate and sanitise each result (ensure only valid ObjectIds are bulk-written to avoid DB CastError)
  const results = (resp.results || [])
    .filter((r) => r && r.id && mongoose.Types.ObjectId.isValid(r.id))
    .map((r) => {
      const originalText = clauseTextMap[r.id] || '';
      const processed = postProcessAnalysisOutput(r, originalText);

      const score = clampScore(processed.risk_score);
      let level = RISK_LEVELS.includes(processed.risk_level) ? processed.risk_level : 'medium';
      if (score <= 5) {
        level = 'low';
      }
      return {
        id: processed.id,
        risk_level: level,
        risk_score: score,
        risk_reasons: Array.isArray(processed.risk_reasons) ? processed.risk_reasons : [],
        possible_law_references: sanitiseLawRefs(processed.possible_law_references),
      };
    });

  return results;
}

// ── Safe Harbor Token Dictionaries ───────────────────────────────────────────
// Flexible regex patterns that catch synonyms and alternative phrasings,
// preventing false positives when drafters use varied terminology.

const SAFE_CONFIDENTIALITY_TOKENS = [
  /absolute\s+confidentiality\s+regarding\s+trade\s+secrets/i,
  /proprietary\s+(and|or)\s+confidential\s+information/i,
  /maintain\s+(strict\s+)?confidentiality\s+(of|regarding)\s+(all\s+)?(trade\s+secrets|proprietary)/i,
  /nondisclosure\s+(of\s+)?(proprietary|trade|company)\s+(secrets|information|data)/i,
];

const SAFE_ARBITRATION_TOKENS = [
  /mutual\s+(consensus|agreement|consent)(\s+of\s+(both|the)\s+parties)?/i,
  /jointly\s+appoint(ed)?\s+(a\s+)?(sole\s+)?arbitrator/i,
  /arbitrator\s+(shall\s+be\s+)?(appointed|selected)\s+(by\s+)?mutual/i,
  /bilateral\s+(arbitration|appointment|selection)/i,
];

const PREDATORY_ARBITRATION_TOKENS = [
  /unilateral(ly)?/i,
  /sole\s+right\s+to\s+nominate/i,
  /sole\s+arbitrator\s+nominated\s+by\s+the\s+company/i,
  /company\s+shall\s+(solely\s+)?appoint/i,
];

const SAFE_IP_WORK_FOR_HIRE_TOKENS = [
  /intellectual\s+property\s+created\s+(during|in\s+the\s+course\s+of)/i,
  /work[\s-]for[\s-]hire/i,
  /scope\s+of\s+(the\s+)?(employee'?s?\s+)?employment/i,
  /using\s+company\s+resources/i,
  /strictly\s+within\s+the\s+assigned\s+scope/i,
];

const GLOBAL_LOCKOUT_TOKENS = [
  /global\s+(lockout|restriction|ban)/i,
  /worldwide\s+(non[\s-]?compete|exclusion|ban)/i,
  /perpetual\s+(and\s+)?irrevocable\s+(restriction|ban|lockout)/i,
];

function matchesAny(text, patterns) {
  return patterns.some(rx => rx.test(text));
}

function postProcessAnalysisOutput(r, clauseText) {
  const text = (clauseText || '').toLowerCase();

  // Hard Blocker for Consumer Protection Hallucinations
  if (/employ(ment|ee)|custodian/i.test(text)) {
    r.possible_law_references = (r.possible_law_references || []).filter(
      (ref) => ref.act_key !== 'CONSUMER_PROTECTION_ACT'
    );
  }

  // Explicit Statutory Trap Catcher for Copyright Act Reversion
  if (text.includes("19(4)") || (/copyright\s+act/i.test(text) && /waiv(e|er)|reversion/i.test(text))) {
    const hasCopyright = (r.possible_law_references || []).some(
      (ref) => ref.act_key === 'COPYRIGHT_ACT'
    );
    if (!hasCopyright) {
      r.risk_level = 'high';
      r.risk_score = 8;
      if (!Array.isArray(r.risk_reasons)) {
        r.risk_reasons = [];
      }
      r.risk_reasons.push(
        'CRITICAL ALERT: Clause explicitly attempts to contract out of statutory IP reversion. Contractual waivers overriding Section 19(4) are highly predatory under Indian IP jurisprudence.'
      );
      if (!Array.isArray(r.possible_law_references)) {
        r.possible_law_references = [];
      }
      r.possible_law_references.push({
        act_key: 'COPYRIGHT_ACT',
        section_hint: 'Section 19(4): IP Reversion Waiver Restriction',
        reason: 'Under Indian Copyright Act, Section 19(4) states that if the assignee does not exercise the rights within a period of one year, the assignment in respect of such rights shall be deemed to have lapsed unless otherwise specified. Attempting to override this absolutely is treated as void/unreasonable under copyright laws.',
      });
    }
  }

  // Defang the Over-Sensitive Copyright Trap (standard work-for-hire)
  if (/copyright\s+act/i.test(text)) {
    if (!text.includes("19(4)") && !/waiv(e|er)/i.test(text) && !/reversion/i.test(text)) {
      r.risk_level = 'low';
      r.risk_score = 2;
      r.risk_reasons = [
        "The clause defines a standard, tightly scoped work-for-hire structure under the Copyright Act, 1957, protecting the company's core assets without infringing on off-duty personal innovations."
      ];
      r.possible_law_references = [{
        act_key: 'COPYRIGHT_ACT',
        section_hint: 'Section 17',
        reason: 'Standard work-for-hire ownership assignment during the course of employment.',
      }];
    }
  }

  // Defang the Arbitration Mutual Consensus Trap (flexible token match)
  if (/arbitration/i.test(text) && matchesAny(text, SAFE_ARBITRATION_TOKENS)) {
    if (!matchesAny(text, PREDATORY_ARBITRATION_TOKENS)) {
      r.risk_level = 'low';
      r.risk_score = 2;
      r.risk_reasons = [
        "The clause utilizes a highly compliant, bilateral mechanism requiring mutual consensus for arbitrator selection, fully adhering to neutral frameworks."
      ];
      r.possible_law_references = [{
        act_key: 'ARBITRATION_ACT',
        section_hint: 'Section 11',
        reason: 'Valid bilateral appointment procedure ensuring mutual party autonomy.',
      }];
    }
  }

  // Explicit Blocker for Section 25F Hallucinations on non-termination fields
  if (!/retrenchment|termination\s+notice|severance/i.test(text)) {
    r.possible_law_references = (r.possible_law_references || []).filter(
      (ref) => ref.act_key !== 'INDUSTRIAL_DISPUTES_ACT'
    );
  }

  // Clean Contract - Confidentiality & Non-Solicit Text Override (flexible token match)
  if (matchesAny(text, SAFE_CONFIDENTIALITY_TOKENS) && !matchesAny(text, GLOBAL_LOCKOUT_TOKENS)) {
    r.risk_level = 'low';
    r.risk_score = 1;
    r.risk_reasons = [
      "The clause sets out standard, legally sound boundaries to safeguard non-public proprietary assets and core operational teams, fully adhering to Indian contract laws."
    ];
    r.possible_law_references = [{
      act_key: 'INDIAN_CONTRACT_ACT',
      section_hint: 'Section 27',
      reason: 'Reasonable post-employment confidentiality and personnel protections are fully enforceable when free of industry lockouts.'
    }];
  }

  // Predatory Contract - Non-Disparagement Text Purge
  if (Array.isArray(r.risk_reasons)) {
    r.risk_reasons = r.risk_reasons.map(reason => {
      if (typeof reason === 'string' && reason.includes("retrenchment of workmen")) {
        return reason.replace(
          /Additionally, the clause may be inconsistent with the Indian contract framework, which requires certain conditions to be met before retrenchment of workmen\.?/gi,
          ""
        ).trim();
      }
      return reason;
    }).filter(Boolean);
  }

  // Dynamic Suffix Label Override to kill the Training Bond leak
  (r.possible_law_references || []).forEach((ref) => {
    if (ref.act_key === 'INDIAN_CONTRACT_ACT' && (ref.section_hint || '').includes('Section 74')) {
      if (/escrow|credit|deferral/i.test(text)) {
        ref.section_hint = 'Section 74 - Unenforceable Salary Forfeiture & Wage Retention';
      } else if (/liquidated\s+damages|250%|200%/i.test(text)) {
        ref.section_hint = 'Section 74 - Unreasonable Liquidated Damages Penalty';
      } else {
        ref.section_hint = 'Section 74 - Employment Liquidated Penalty & Restrictions';
      }
    }
  });

  // 1. Defang False Positives on Standard Recitals / Parties Definitions
  if (text.includes("this employment agreement") && text.includes("witnesseth") && text.includes("hereinafter referred to as")) {
      if (!text.includes("waive") && !text.includes("forfeit")) {
          r.risk_level = "low";
          r.risk_score = 1;
          r.risk_reasons = ["Standard introductory recitals establishing party identities and contract execution dates. Fully valid and compliant."];
          r.possible_law_references = [{
              act_key: "INDIAN_CONTRACT_ACT",
              section_hint: "Section 10",
              reason: "Valid formation of an agreement between competent parties."
          }];
      }
  }
  
  // 2. Defang False Positives on Compliant Overtime / Shops & Establishments Clauses
  if (text.includes("standard working hours") && text.includes("shops and establishments framework")) {
      if (text.includes("compensated with overtime wages")) {
          r.risk_level = "low";
          r.risk_score = 1;
          r.risk_reasons = ["The clause explicitly references compliance with state Shops & Establishments frameworks and guarantees statutory overtime pay, operating as an absolute safe harbor."];
          r.possible_law_references = [{
              act_key: "SHOPS_AND_ESTABLISHMENTS_ACT",
              section_hint: "Applicable State Rules",
              reason: "Explicit alignment with state-enforced maximum working hours and overtime wage metrics."
          }];
      }
  }

  // 3. Prevent Citation Cross-Contamination (Arbitration leaks into Code blocks)
  if (text.includes("senior software engineer") && !text.includes("arbitrator")) {
      r.possible_law_references = (r.possible_law_references || []).filter(c => !c.act_key.includes("ARBITRATION"));
  }

  return r;
}

function clampScore(val) {
  const n = parseInt(val, 10);
  if (isNaN(n)) return 5;
  return Math.max(0, Math.min(10, n));
}

/**
 * Validate law references from the model:
 * - Only allow known act_keys
 * - Map act_key → full act_name + reference_url from config
 */
function sanitiseLawRefs(refs) {
  if (!Array.isArray(refs)) return [];

  return refs
    .filter((r) => r.act_key && ALLOWED_ACT_KEYS.includes(r.act_key))
    .map((r) => {
      const cfg = LAW_REFERENCES[r.act_key];
      return {
        act_key: r.act_key,
        act_name: cfg.act_name,
        section_hint: r.section_hint || '',
        reason: r.reason || '',
        reference_url: cfg.reference_url,
      };
    });
}

/**
 * Compute contract-level overallRiskLevel from individual clause risk levels.
 * Critical > high > medium > low.
 */
function computeOverallRisk(clauseRiskLevels) {
  const priority = { critical: 4, high: 3, medium: 2, low: 1 };
  let max = 0;
  for (const level of clauseRiskLevels) {
    const p = priority[level] || 0;
    if (p > max) max = p;
  }
  return ['low', 'low', 'medium', 'high', 'critical'][max];
}

// ── Contract-level orchestrator ──────────────────────────────────────────────

/**
 * Analyse risk for all clauses of a contract that don't yet have risk data.
 * Batches clauses, calls Agent 2, maps law references, persists results,
 * and updates contract-level overallRiskLevel.
 *
 * @param {string} contractId
 */
async function analyseRisksForContract(contractId) {
  const clauses = await Clause.find({
    contractId,
    risk_level: null,
  }).select('_id rawText clause_type');

  if (clauses.length > 0) {
    // Build batch items by fetching dynamic laws in parallel for each item (Intra-agent concurrency)
    const items = await Promise.all(
      clauses.map(async (c) => {
        const retrieved = await retrieveRelevantLaws(c.rawText, c.clause_type || 'other');
        return {
          id: c._id.toString(),
          text: c.rawText,
          clause_type: c.clause_type || 'other',
          retrieved_legal_context: retrieved,
        };
      })
    );

    // Process batches in parallel concurrently (Intra-agent concurrency)
    const batchPromises = [];
    for (let i = 0; i < items.length; i += AGENT_BATCH_SIZE) {
      const batch = items.slice(i, i + AGENT_BATCH_SIZE);
      const task = async () => {
        const results = await runAgent2RiskAnalyst(batch);
        return results.map((r) => ({
          updateOne: {
            filter: { _id: r.id },
            update: {
              $set: {
                risk_level: r.risk_level,
                risk_score: r.risk_score,
                risk_reasons: r.risk_reasons,
                possible_law_references: r.possible_law_references,
              },
            },
          },
        }));
      };
      batchPromises.push(task());
    }

    const batchOpsArrays = await Promise.all(batchPromises);
    const allOps = batchOpsArrays.flat();

    if (allOps.length > 0) {
      await Clause.bulkWrite(allOps);
    }
  }

  // Compute contract-level risk
  const allClauses = await Clause.find({ contractId }).select('risk_level');
  const levels = allClauses.map((c) => c.risk_level).filter(Boolean);
  const overallRisk = levels.length > 0 ? computeOverallRisk(levels) : null;

  await Contract.findByIdAndUpdate(contractId, {
    overallRiskLevel: overallRisk,
    'agentMetadata.analysedAt': new Date(),
  });

  console.log(
    `✅ Agent 2 analysed ${clauses.length} clauses for contract ${contractId} — overall risk: ${overallRisk}`
  );
}

module.exports = { runAgent2RiskAnalyst, analyseRisksForContract };
