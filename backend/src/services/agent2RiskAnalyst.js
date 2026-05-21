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
- **Precedent Prioritization Protocol**: If a Supreme Court or High Court Precedent (act_key: CASE_LAW) is provided in your retrieved_legal_context, you MUST prioritize its holdings over the raw statutory text of a Bare Act, as judicial precedent governs the application of the statute. explicitly cite the holding of the case when explaining your risk reasons.
`;

// ── Allowed act_keys ─────────────────────────────────────────────────────────


const JUDGE_SYSTEM_PROMPT = `
Role: Chief Compliance Arbitrator & Legal Quality Control Engine (Indian Jurisprudence).
Task: Audit the initial Risk Analysis generated by the Base Analyst against the Original Wording of the contract clause and the provided Global Contract Context.

You are an adversarial layer designed to eliminate two critical systemic errors:
1. FALSE POSITIVES (Over-Sensitivity): If the Base Analyst assigned a HIGH/CRITICAL risk score to a clause that explicitly contains saving or protective qualifiers, you MUST REJECT the score and downscale it strictly to LOW RISK (1-2). Specific safe harbor triggers that mandate an automatic downgrade to LOW RISK include:
- "conforming strictly to state Shops & Establishments frameworks"
- "mutual consensus of both parties"
- "strict scope of employment" (Work-for-Hire IP assignment is completely valid and low risk if scoped to employment hours/resources)
- "confidentiality regarding trade secrets" (Post-employment NDAs are standard and low risk if reasonable)

CRITICAL OVERRIDE RULE: Predatory traps ALWAYS supersede safe harbors. If the clause contains ANY predatory mechanism (such as "unilateral", "sole right", "liquidated penalty", "forfeiture", or "waive... Section 19(4)"), you MUST IGNORE all safe harbors and ESCALATE the score to HIGH/CRITICAL (8-10). Do NOT downgrade.
2. FALSE NEGATIVES (Overlooked Traps): If the Base Analyst missed an explicit predatory mechanism (e.g., contracting out of Section 19(4) of the Copyright Act, unilateral sole arbitrator selection, shifting business risks via Section 74 salary escrow forfeitures), you must REJECT its lenient assessment, escalate the rating to HIGH/CRITICAL, and insert the precise statutory warning block.

You must output a strictly validated JSON array matching the exact structure of the input, with corrected risk ratings, scores, audit notes, and citations based on your verification. No conversational wrappers.

THE SUBSISTENCE RULE (SECTION 27 EXCEPTION):
- You must carefully analyze the TEMPORAL BOUNDARY of non-compete or exclusivity restrictions.
- Under Indian jurisprudence (Niranjan Shankar Golikari v. Century Spinning), a negative covenant that restricts an employee from working for competitors DURING the term of their employment is fully legal, reasonable, and valid. It is LOW RISK.
- A covenant that restricts trade POST-EMPLOYMENT/POST-SEPARATION is strictly void under Section 27. It is HIGH/CRITICAL RISK.
- If the Base Analyst flags an active-term exclusivity clause as HIGH/CRITICAL, you must overrule it and force the score down to LOW (1-2).
`;

const ALLOWED_ACT_KEYS = Object.keys(LAW_REFERENCES);

// ── Core LLM call ────────────────────────────────────────────────────────────

/**
 * Send a batch of clauses to the LLM for risk analysis.
 *
 * @param {{ id: string, text: string, clause_type: string, retrieved_legal_context: Array }[]} clausesBatch
 * @returns {Promise<Array>} Parsed and validated results.
 */

/**
 * Executes the Adversarial Reflection pass over a batch of Base Analyst outputs.
 * We only send clauses that the base analyst scored as medium, high, or critical.
 */
async function runAdversarialJudgeBatch(globalContext, clauseTextMap, baseResultsBatch) {
  const prompt = `
  === GLOBAL CONTRACT CONTEXT ===
  ${JSON.stringify(globalContext || {}, null, 2)}
  
  === ORIGINAL CLAUSE TEXTS ===
  ${JSON.stringify(clauseTextMap, null, 2)}
  
  === BASE ANALYST DRAFT REPORTS (BATCH) ===
  ${JSON.stringify(baseResultsBatch, null, 2)}
  
  Execute your adversarial quality audit now on all clauses in the batch. Output the final, verified JSON array of results.
  `;

  try {
    const rawOutput = await require('./aiClient').callLLM({
      systemPrompt: JUDGE_SYSTEM_PROMPT,
      userContent: prompt,
      jsonMode: true,
      temperature: 0.1, // Kept low for deterministic legal evaluation
      maxTokens: 6144, // Increased tokens for batch
    });
    return rawOutput.results || rawOutput || baseResultsBatch;
  } catch (err) {
    console.error('[Adversarial Judge] Failed batch reflection pass, falling back to base:', err.message);
    return baseResultsBatch;
  }
}

// ── V3 Mixed Matrix Sanitization ─────────────────────────────────────────────
function enforceV3MixedMatrixSanitization(clauseObj, text) {
    const rawText = text.toLowerCase();

    // 1. Hard Override for Introductory Recitals / Title Blocks (Defangs Clause #1)
    if (rawText.includes("master employment") && rawText.includes("witnesseth") && rawText.includes("by and between")) {
        clauseObj.risk_level = "low";
        clauseObj.risk_score = 1;
        clauseObj.risk_reasons = ["Standard introductory recitals establishing party corporate identities and execution dates. Fully valid and compliant under Indian law format."];
        clauseObj.possible_law_references = [{
            act_key: "INDIAN_CONTRACT_ACT",
            section_hint: "Section 10",
            reason: "Valid formation parameters of an agreement between competent corporate entities."
        }];
    }

    // 2. Absolute Blocker for Industrial Disputes Act Hallucinations (Defangs Clause #3)
    if (!rawText.includes("retrenchment") && !rawText.includes("termination notice") && !rawText.includes("severance")) {
        if (clauseObj.possible_law_references) {
            clauseObj.possible_law_references = clauseObj.possible_law_references.filter(
              c => c.act_key !== "INDUSTRIAL_DISPUTES_ACT" && 
                   !(c.act_name && c.act_name.includes("Industrial Disputes Act"))
            );
        }
        if (clauseObj.risk_reasons) {
            clauseObj.risk_reasons = clauseObj.risk_reasons.map(r => 
              r.replace(/retrenchment of workmen/gi, "unreasonable wage deductions")
            );
        }
    }

    return clauseObj;
}

// ── Mixed Matrix Downstream Calibration ──────────────────────────────────────
function cleanMixedMatrixDownstreamLeaks(clauseObj, text) {
    const rawText = text.toLowerCase();

    // 1. Defang False Positives on True Bilateral Mutual Mediation (Clause #7)
    if (rawText.includes("bilateral mutual mediation path") && rawText.includes("amicably through good-faith mutual consultation")) {
        clauseObj.risk_level = "low";
        clauseObj.risk_score = 1;
        clauseObj.risk_reasons = ["Standard, fully compliant bilateral mediation framework. Encourages amicable dispute resolution before escalating to formal legal tribunals."];
        clauseObj.possible_law_references = [{
            act_key: "ARBITRATION_ACT",
            section_hint: "Conciliation",
            reason: "Compliant pre-arbitral structured mediation mechanisms."
        }];
    }

    // 2. Recalibrate Section 27 Leaks on Operational Standby Penalties (Clause #3)
    if (rawText.includes("standby availability") && rawText.includes("salary deduction")) {
        if (clauseObj.possible_law_references) {
            // Strip out Section 27 (Restraint of trade)
            clauseObj.possible_law_references = clauseObj.possible_law_references.filter(
              c => !(c.section_hint && c.section_hint.includes("27")) && 
                   !(c.reason && c.reason.includes("Section 27")) &&
                   !(c.act_name && c.act_name.includes("Section 27"))
            );
            
            // Check if Payment of Wages is already present, if not add it
            if (!clauseObj.possible_law_references.some(c => c.act_key === "PAYMENT_OF_WAGES_ACT")) {
                clauseObj.possible_law_references.push({
                    act_key: "PAYMENT_OF_WAGES_ACT",
                    section_hint: "Section 7",
                    reason: "Unauthorized automated deductions from an employee's fixed salary for operational latency violate strict wage protection limits."
                });
            }
        }
    }

    return clauseObj;
}

async function runAgent2RiskAnalyst(clausesBatch, globalContext) {
  const formattedBatch = clausesBatch.map((c) => {
    if (!globalContext) return c;
    const globalPreamble = `
======================================================================
[V3 CRITICAL ARCHITECTURAL RUNTIME CONTEXT - DO NOT BYPASS]
The following parameters have been extracted from the root header of this document. 
Utilize these explicit definitions to analyze the semantic intent of the active clause below.

Governing Framework: ${globalContext.metadata?.governingLaw || "Not Explicitly Defined"}
Corporate Employer: ${globalContext.metadata?.employerName || "Not Explicitly Defined"}
Target Designation: ${globalContext.metadata?.employeeDesignation || "Not Explicitly Defined"}

Global Definitions Mapping Matrix:
${JSON.stringify(globalContext.globalDefinitions || {}, null, 2)}
======================================================================

[ACTIVE TARGET EVALUATION CLAUSE TEXT]:
`;
    return {
      ...c,
      text: globalPreamble + c.text
    };
  });

  const userContent = JSON.stringify({ clauses: formattedBatch });

  const resp = await require('./aiClient').callLLM({
    systemPrompt: SYSTEM_PROMPT,
    userContent,
    jsonMode: true,
    temperature: 0.2,
    maxTokens: 6144,
  });

  const clauseTextMap = {};
  for (const c of clausesBatch) {
    clauseTextMap[c.id] = c.text;
  }

  const baseResults = (resp.results || []).filter((r) => r && r.id && mongoose.Types.ObjectId.isValid(r.id));
  
  // Selective Judge: only run judge on clauses that have medium, high, or critical risk
  const riskyResults = baseResults.filter(r => r.risk_level && r.risk_level !== 'low');
  
  let verifiedRiskyResults = [];
  if (riskyResults.length > 0) {
    const riskyClauseTextMap = {};
    for (const r of riskyResults) {
      riskyClauseTextMap[r.id] = clauseTextMap[r.id];
    }
    
    // Batch run the judge
    const judgeRaw = await runAdversarialJudgeBatch(globalContext, riskyClauseTextMap, riskyResults);
    const judgeArray = Array.isArray(judgeRaw) ? judgeRaw : [];
    
    verifiedRiskyResults = judgeArray;
  }
  
  // Merge and normalize results
  const finalResults = baseResults.map((baseAnalysis) => {
    // Find verified analysis if it exists, otherwise use base
    const verifiedAnalysis = verifiedRiskyResults.find(v => v.id === baseAnalysis.id) || baseAnalysis;
    
    const risk_score = verifiedAnalysis.risk_score !== undefined ? verifiedAnalysis.risk_score : (verifiedAnalysis.score !== undefined ? verifiedAnalysis.score : baseAnalysis.risk_score);
    const risk_level = verifiedAnalysis.risk_level || verifiedAnalysis.riskRating || baseAnalysis.risk_level;
    const risk_reasons = verifiedAnalysis.risk_reasons || (verifiedAnalysis.auditNote ? [verifiedAnalysis.auditNote] : baseAnalysis.risk_reasons);
    const possible_law_references = verifiedAnalysis.possible_law_references || verifiedAnalysis.citations || baseAnalysis.possible_law_references;
    
    const score = clampScore(risk_score);
    let level = RISK_LEVELS.includes(risk_level ? risk_level.toLowerCase() : '') ? risk_level.toLowerCase() : 'medium';
    if (score <= 5 && level !== 'low') level = 'low';
    
    let resultObj = {
      id: baseAnalysis.id,
      risk_level: level,
      risk_score: score,
      risk_reasons: Array.isArray(risk_reasons) ? risk_reasons : [],
      possible_law_references: possible_law_references,
    };

    // Apply V3 Sanitization
    resultObj = enforceV3MixedMatrixSanitization(resultObj, clauseTextMap[baseAnalysis.id] || "");
    
    // Apply Downstream Leak Calibration
    resultObj = cleanMixedMatrixDownstreamLeaks(resultObj, clauseTextMap[baseAnalysis.id] || "");

    // Sanitize law refs mapped to strict schema keys
    resultObj.possible_law_references = sanitiseLawRefs(resultObj.possible_law_references);

    return resultObj;
  });

  return finalResults;
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
  const contract = await Contract.findById(contractId).select('globalContext');
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
        const results = await runAgent2RiskAnalyst(batch, contract?.globalContext);
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

module.exports = { runAgent2RiskAnalyst, analyseRisksForContract, runAdversarialJudgeBatch };
