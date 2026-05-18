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
    maxTokens: 4096,
  });

  // Validate and sanitise each result (ensure only valid ObjectIds are bulk-written to avoid DB CastError)
  const results = (resp.results || [])
    .filter((r) => r && r.id && mongoose.Types.ObjectId.isValid(r.id))
    .map((r) => ({
      id: r.id,
      risk_level: RISK_LEVELS.includes(r.risk_level) ? r.risk_level : 'medium',
      risk_score: clampScore(r.risk_score),
      risk_reasons: Array.isArray(r.risk_reasons) ? r.risk_reasons : [],
      possible_law_references: sanitiseLawRefs(r.possible_law_references),
    }));

  return results;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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
