/**
 * Agent 1 – Clause Extractor
 *
 * Classifies each clause by type and assigns category tags.
 * Batches clauses to minimise API calls.
 */

const { callLLM } = require('./aiClient');
const Clause = require('../models/Clause');
const Contract = require('../models/Contract');
const { CLAUSE_TYPES, AGENT_BATCH_SIZE } = require('../config/constants');

// ── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a legal clause extraction and classification assistant.

You receive a list of clauses from a contract. For each clause:
- Choose a primary clause_type from the allowed list.
- Optionally add category_tags that help group the clause (e.g. ["employment", "non_compete"]).

Allowed clause_type values (use exactly these strings):
"non_compete", "non_solicitation", "ip_ownership", "licensing",
"confidentiality", "privacy_data", "payment", "termination",
"liability_limit", "indemnity", "dispute_resolution", "arbitration",
"governing_law", "auto_renewal", "amendment", "warranty",
"force_majeure", "other".

Rules:
- If unsure, use "other".
- Do not rewrite the clause text.
- Output strict JSON only, with this shape:

{
  "results": [
    {
      "id": "c1",
      "clause_type": "non_compete",
      "category_tags": ["employment", "post_termination"]
    }
  ]
}`;

// ── Core LLM call ────────────────────────────────────────────────────────────

/**
 * Send a batch of clauses to the LLM for classification.
 *
 * @param {{ id: string, text: string }[]} clausesBatch
 * @returns {Promise<{ id: string, clause_type: string, category_tags: string[] }[]>}
 */
async function runAgent1ClauseExtractor(clausesBatch) {
  const userContent = JSON.stringify({ clauses: clausesBatch });

  const resp = await callLLM({
    systemPrompt: SYSTEM_PROMPT,
    userContent,
    jsonMode: true,
    temperature: 0.1,
    maxTokens: 2048,
  });

  // Validate and sanitise
  const results = (resp.results || []).map((r) => ({
    id: r.id,
    clause_type: CLAUSE_TYPES.includes(r.clause_type) ? r.clause_type : 'other',
    category_tags: Array.isArray(r.category_tags) ? r.category_tags : [],
  }));

  return results;
}

// ── Contract-level orchestrator ──────────────────────────────────────────────

/**
 * Classify all unclassified clauses for a contract.
 * Loads clauses with null clause_type, batches them, calls Agent 1,
 * and persists the results.
 *
 * @param {string} contractId
 */
async function classifyClausesForContract(contractId) {
  const clauses = await Clause.find({
    contractId,
    clause_type: null,
  }).select('_id rawText');

  if (clauses.length === 0) return;

  // Build batch items
  const items = clauses.map((c) => ({
    id: c._id.toString(),
    text: c.rawText,
  }));

  // Process in batches
  for (let i = 0; i < items.length; i += AGENT_BATCH_SIZE) {
    const batch = items.slice(i, i + AGENT_BATCH_SIZE);
    const results = await runAgent1ClauseExtractor(batch);

    // Build bulk writes
    const ops = results.map((r) => ({
      updateOne: {
        filter: { _id: r.id },
        update: {
          $set: {
            clause_type: r.clause_type,
            category_tags: r.category_tags,
          },
        },
      },
    }));

    if (ops.length > 0) {
      await Clause.bulkWrite(ops);
    }
  }

  // Update contract agent metadata timestamp
  await Contract.findByIdAndUpdate(contractId, {
    'agentMetadata.extractedAt': new Date(),
  });

  console.log(
    `✅ Agent 1 classified ${clauses.length} clauses for contract ${contractId}`
  );
}

module.exports = { runAgent1ClauseExtractor, classifyClausesForContract };
