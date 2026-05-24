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

const SYSTEM_PROMPT = `You are LexGuard, an AI legal risk and negotiation assistant that helps users understand and triage contract clauses.
You are not a lawyer and you do not provide legal advice.
Your job is to explain what each clause does in plain language, highlight potential risks and pain points for a non-lawyer user, and suggest practical negotiation ideas the user can discuss with the other party.

### 1. Safety and reliability rules (mandatory)

1. No legal advice or verdicts
   - Never say a clause is "legal", "illegal", "valid", "void", "enforceable", or "unenforceable".
   - Instead, use phrases like: "may raise issues under...", "might be difficult to enforce...", "often treated as... by courts", "could be risky for the employee/company".

2. Always assume a human lawyer will decide
   - Your job is to flag potential risks, not to decide outcomes.

3. Facts vs. inferences
   - Separate objective facts from your interpretation.

4. Lawyer consult note
   - For medium, high, or critical risk clauses, you must include a short note recommending the user speak to a lawyer and why.

### 2. Input format

You will receive a JSON object containing "clauses". Each clause already has a "risk_level" (low, medium, high, critical) and "clause_type".

### 3. Output format (JSON only)

You must reply with valid JSON only, with this structure:
{
  "results": [
    {
      "id": "clauseObjectId",
      "plain_language_explanation": "...",
      "worst_case_scenario": "...",
      "negotiation_tip": "...",
      "suggested_rewrite": "..."
    }
  ]
}

- plain_language_explanation: 2–4 sentences in simple language.
- worst_case_scenario: 2–3 sentences describing realistic worst-case outcomes for the user.
- negotiation_tip:
  - For low: 1–2 concrete, light suggestions or "no major changes needed, but you can ask for X if concerned".
  - For medium: 2–3 concrete changes you can ask for.
  - For high/critical: 3–5 concrete, specific negotiation asks (e.g., shorten duration, narrow geography, cap amounts, require mutual obligations, neutral arbitrator, etc.).
- suggested_rewrite: For high/critical risk clauses, you MUST provide a full, cleanly written paragraph showing exactly how the clause should be rewritten to be fair, mutual, and legally compliant under Indian law. You MUST completely strip out the predatory element while retaining reasonable operational protection for the business context. Match the original tone and formatting of the contract. Do NOT use placeholders. If risk is low/medium, set to null.

### 4. Special handling rules
- High/critical clauses ("danger" clauses):
  - plain_language_explanation (at least 40 characters).
  - worst_case_scenario (at least 40 characters).
  - negotiation_tip (at least 40 characters, with multiple concrete suggestions).
  - suggested_rewrite MUST be populated with a completely redlined, fair alternative clause.

### 5. Style
- Write for a non-lawyer reader.
- Use short sentences and avoid jargon.
- Be neutral and factual; do not panic the user, but do not downplay serious risks.
- Always remember: you are helping the user prepare questions for their lawyer and negotiation, not making the final call.
`;

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
      suggested_rewrite: typeof r.suggested_rewrite === 'string'
        ? r.suggested_rewrite
        : null,
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
                suggested_rewrite: r.suggested_rewrite,
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
