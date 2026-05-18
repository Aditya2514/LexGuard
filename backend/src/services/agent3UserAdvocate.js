/**
 * Agent 3 – User Advocate
 *
 * Generates plain-language explanations, worst-case scenarios, and
 * negotiation tips for medium/high/critical-risk clauses.
 * Only runs on clauses that have already been classified (Agent 1)
 * and risk-scored (Agent 2).
 */

const mongoose = require('mongoose');
const { callLLM } = require('./aiClient');
const Clause = require('../models/Clause');
const Contract = require('../models/Contract');
const { AGENT_BATCH_SIZE } = require('../config/constants');

// ── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a user-focused legal explainer for Indian users, not a lawyer.
You receive contract clauses that already have a clause_type and a risk_level.
For each clause, help a non-lawyer user understand:
1. A plain-language explanation of what this clause may mean for them.
2. A realistic worst-case scenario if the clause is enforced as written.
3. A practical negotiation tip they might discuss with a qualified legal professional.

Rules:
- Assume the user is a non-expert in India.
- Use cautious language like "may mean", "could allow the company to", "might make it harder for you to".
- Do not say a clause is definitely illegal or invalid.
- Do not give definitive legal advice or tell the user what decision to make.
- Do not reference exact section numbers of laws.
- Keep each field to 1–3 short sentences, concise and concrete.
- Output strict JSON only with shape:

{
  "results": [
    {
      "id": "clauseObjectId",
      "plain_language_explanation": "...",
      "worst_case_scenario": "...",
      "negotiation_tip": "..."
    }
  ]
}`;

// ── Core LLM call ────────────────────────────────────────────────────────────

/**
 * Send a batch of clauses to the LLM for plain-language advocacy.
 *
 * @param {{ id: string, text: string, clause_type: string, risk_level: string, risk_score: number }[]} clausesBatch
 * @returns {Promise<{ id: string, plain_language_explanation: string, worst_case_scenario: string, negotiation_tip: string }[]>}
 */
async function runAgent3UserAdvocate(clausesBatch) {
  const userContent = JSON.stringify({ clauses: clausesBatch });

  const resp = await callLLM({
    systemPrompt: SYSTEM_PROMPT,
    userContent,
    jsonMode: true,
    temperature: 0.25,
    maxTokens: 4096,
  });

  // Validate and sanitise (ensure only valid ObjectIds pass through)
  const results = (resp.results || [])
    .filter((r) => r && r.id && mongoose.Types.ObjectId.isValid(r.id))
    .map((r) => ({
      id: r.id,
      plain_language_explanation: typeof r.plain_language_explanation === 'string'
        ? r.plain_language_explanation
        : '',
      worst_case_scenario: typeof r.worst_case_scenario === 'string'
        ? r.worst_case_scenario
        : '',
      negotiation_tip: typeof r.negotiation_tip === 'string'
        ? r.negotiation_tip
        : '',
    }));

  return results;
}

// ── Contract-level orchestrator ──────────────────────────────────────────────

/**
 * Generate plain-language advocacy for all medium/high/critical clauses
 * that don't yet have advocacy data.
 *
 * This function is non-throwing: if the AI call fails, it logs
 * the error and returns silently so the upload pipeline continues.
 *
 * @param {string} contractId
 */
async function generateUserAdvocateForContract(contractId) {
  try {
    const clauses = await Clause.find({
      contractId,
      risk_level: { $in: ['medium', 'high', 'critical'] },
      plain_language_explanation: null,
    }).select('_id rawText clause_type risk_level risk_score');

    if (clauses.length === 0) {
      // Still update the timestamp so the contract knows advocacy was attempted
      await Contract.findByIdAndUpdate(contractId, {
        'agentMetadata.advocatedAt': new Date(),
      });
      return;
    }

    // Build batch items
    const items = clauses.map((c) => ({
      id: c._id.toString(),
      text: c.rawText,
      clause_type: c.clause_type || 'other',
      risk_level: c.risk_level,
      risk_score: c.risk_score ?? 5,
    }));

    // Process batches in parallel concurrently (Intra-agent concurrency)
    const batchPromises = [];
    for (let i = 0; i < items.length; i += AGENT_BATCH_SIZE) {
      const batch = items.slice(i, i + AGENT_BATCH_SIZE);
      const task = async () => {
        const results = await runAgent3UserAdvocate(batch);
        return results.map((r) => ({
          updateOne: {
            filter: { _id: r.id },
            update: {
              $set: {
                plain_language_explanation: r.plain_language_explanation,
                worst_case_scenario: r.worst_case_scenario,
                negotiation_tip: r.negotiation_tip,
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

    // Update contract agent metadata
    await Contract.findByIdAndUpdate(contractId, {
      'agentMetadata.advocatedAt': new Date(),
    });

    console.log(
      `✅ Agent 3 generated advocacy for ${clauses.length} clauses on contract ${contractId}`
    );
  } catch (err) {
    console.error(
      `⚠️  Agent 3 failed for contract ${contractId}: ${err.message}`
    );
    // Non-throwing — pipeline continues
  }
}

module.exports = { runAgent3UserAdvocate, generateUserAdvocateForContract };
