/**
 * Agent 2 – Risk Analyst
 *
 * Evaluates each clause for risk level, score, reasons, and
 * possible Indian law references.  Batches clauses to minimise API calls.
 */

const mongoose = require('mongoose');
const { callLLM } = require('./aiClient');
const Clause = require('../models/Clause');
const Contract = require('../models/Contract');
const { RISK_LEVELS, AGENT_BATCH_SIZE } = require('../config/constants');
const { LAW_REFERENCES } = require('../config/lawReferences');

// ── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a legal risk analysis assistant for contracts focusing on Indian users.

For each clause you receive, evaluate how risky it may be for an individual or small business in India.

For each clause, output:
- risk_level: one of "low", "medium", "high", "critical".
- risk_score: integer 0 to 10 (0 = no risk, 10 = extremely risky).
- risk_reasons: short bullet-style strings explaining the main reasons.
- possible_law_references: optional list of law hints, each with:
  - act_key: one of "INDIAN_CONTRACT_ACT", "DPDP_ACT", "ARBITRATION_ACT".
  - section_hint: SHORT human-readable description (e.g., "restraint of trade provisions", "consent for personal data processing").
  - reason: why this clause may raise an issue under that Act.

Use a wide risk rubric:
- For non-compete and non-solicitation clauses, consider duration, geography, and breadth of restriction.
- For IP ownership clauses, consider if all present and future IP, including side projects, is assigned to the company.
- For confidentiality clauses, consider whether obligations are broad or unlimited.
- For privacy/data clauses, consider Indian data protection principles for personal data and consent.
- For arbitration and dispute resolution clauses, consider fairness and accessibility of the process.
- For termination clauses, consider unilateral termination without notice or cause.
- For liability and indemnity clauses, consider one-sided or unlimited liability.
- For auto-renewal clauses, consider lock-in periods and cancellation difficulty.
- For governing law clauses, consider if foreign law is imposed on India-based parties.
- For payment clauses, consider hidden penalties, arbitrary price changes, or late payment traps.

IMPORTANT:
- Use cautious language: say a clause "may be risky", "may be inconsistent with", or "may raise issues under" an Act.
- Do NOT say a clause "violates" a specific section or is "illegal".
- Do NOT invent exact section numbers.

Output STRICT JSON only with shape:

{
  "results": [
    {
      "id": "c1",
      "risk_level": "medium",
      "risk_score": 6,
      "risk_reasons": ["..."],
      "possible_law_references": [
        {
          "act_key": "INDIAN_CONTRACT_ACT",
          "section_hint": "restraint of trade and reasonableness of non-compete provisions",
          "reason": "Broad non-compete may be considered unreasonable for Indian employees."
        }
      ]
    }
  ]
}`;

// ── Allowed act_keys ─────────────────────────────────────────────────────────

const ALLOWED_ACT_KEYS = Object.keys(LAW_REFERENCES);

// ── Core LLM call ────────────────────────────────────────────────────────────

/**
 * Send a batch of clauses to the LLM for risk analysis.
 *
 * @param {{ id: string, text: string, clause_type: string }[]} clausesBatch
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
    // Build batch items
    const items = clauses.map((c) => ({
      id: c._id.toString(),
      text: c.rawText,
      clause_type: c.clause_type || 'other',
    }));

    // Process in batches
    for (let i = 0; i < items.length; i += AGENT_BATCH_SIZE) {
      const batch = items.slice(i, i + AGENT_BATCH_SIZE);
      const results = await runAgent2RiskAnalyst(batch);

      const ops = results.map((r) => ({
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

      if (ops.length > 0) {
        await Clause.bulkWrite(ops);
      }
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
