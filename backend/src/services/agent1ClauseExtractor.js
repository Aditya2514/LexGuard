/**
 * Agent 1 – Clause Extractor
 *
 * Classifies each clause by type and assigns category tags.
 * Batches clauses to minimise API calls.
 */

const mongoose = require('mongoose');
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
"non_compete", "non_solicitation", "intellectual_property", "licensing",
"confidentiality", "privacy_data", "compensation", "termination",
"liability_limit", "indemnification", "dispute_resolution", "governing_law", 
"auto_renewal", "amendment", "warranty", "force_majeure", "other".

CRITICAL STRUCTURAL REQUIREMENT:
You must classify the incoming contract text strictly into one of the following exact category enums. Do NOT deviate, capitalize differently, or use synonyms:
- "non_compete" (For non-compete, lockouts, sector restrictions)
- "non_solicitation" (For non-poaching of employees, clients, or customers)
- "dispute_resolution" (For mediation, arbitration, governing law, jurisdiction)
- "compensation" (For salary, bonuses, retention, escrow forfeitures, pay metrics, statutory deductions, and liquidated damages/penalties related to financial forfeiture)
- "intellectual_property" (For copyright, patents, moral waivers, work-for-hire)
- "confidentiality" (For NDAs, trade secrets, and non-disparagement - NOT personal data privacy)
- "privacy_data" (For clauses mentioning DPDP Act, personal device monitoring, biometric data, or waiving personal data privacy rights)
- "force_majeure" (For acts of god, pandemics, strikes, suspended obligations)
- "indemnification" (For hold harmless, defense, liability shifts)
- "liability_limit" (For clauses capping the company's maximum liability or excluding indirect damages. Do NOT use for employee penalties, which fall under compensation.)
- "termination" (For termination for convenience, cause, notice periods, and Garden Leave provisions)
- "amendment" (For clauses dealing with modifications, unilateral changes, or retroactive policies)
- "auto_renewal" (For evergreen renewals or automatic term extensions)
- "other" (For general employment terms, active-term exclusivity, moonlighting, unpaid suspensions, or clauses that don't fit above)

TRAP DETECTION WARNING: Look out for legal misdirection. If a clause starts like a standard non-disparagement or confidentiality clause, but the second half enforces massive financial penalties (e.g., "forfeiture of equity", "loss of unpaid bonuses", "liquidated damages"), you MUST classify it as "compensation". Financial pain ALWAYS supersedes the label of the clause.

If a clause fits multiple, select the dominant operational mechanism. Do NOT output codes or alternate categories like 'arbitration' or 'payment'. Only the exact string tokens above are valid.

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

  const results = [];
  const rawResults = resp.results || [];
  
  for (let i = 0; i < clausesBatch.length; i++) {
    const originalClause = clausesBatch[i];
    let matched = rawResults.find(r => r && String(r.id) === String(originalClause.id));
    
    if (!matched && rawResults.length === clausesBatch.length) {
      matched = rawResults[i];
    }
    
    if (!matched && clausesBatch.length === 1 && rawResults.length > 0) {
      matched = rawResults[0];
    }
    
    if (matched) {
      results.push({
        id: originalClause.id,
        clause_type: CLAUSE_TYPES.includes(matched.clause_type) ? matched.clause_type : 'other',
        category_tags: Array.isArray(matched.category_tags) ? matched.category_tags : [],
      });
    } else {
      results.push({
        id: originalClause.id,
        clause_type: 'other',
        category_tags: [],
      });
    }
  }

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
