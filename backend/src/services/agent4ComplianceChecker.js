const mongoose = require('mongoose');
const Contract = require('../models/Contract');
const Clause = require('../models/Clause');
const { callLLM } = require('./aiClient');
const { AGENT_BATCH_SIZE } = require('../config/constants');

/**
 * Agent 4 – Indian Compliance Checker
 * Analyzes clauses for compliance with Indian Contract Act 1872, DPDP Act 2023, and Arbitration Act 1996.
 */

/**
 * Direct orchestrator to call LLM on a batch of clauses.
 *
 * @param {Array<Object>} clausesBatch - array of parsed Clause objects
 * @returns {Promise<Array<Object>>} array of structured compliance results
 */
async function runAgent4ComplianceChecker(clausesBatch) {
  // Filter inputs to valid ObjectIds
  const validBatch = clausesBatch.filter((c) => mongoose.Types.ObjectId.isValid(c.id));
  if (validBatch.length === 0) return [];

  const systemPrompt = `You are an Indian law compliance assistant, not a lawyer and not a substitute for legal advice.
You receive clauses from contracts, along with their clause_type, risk_level, and law hints relating to Indian Acts.
Your job is to highlight potential areas where the clause may raise Indian law compliance concerns, in cautious, non-definitive language.

Focus on three Acts only:
- Indian Contract Act, 1872 (fairness, restraint of trade, unconscionable terms, one-sided clauses).
- Digital Personal Data Protection Act, 2023 (personal data processing, consent, rights of data principals).
- Arbitration and Conciliation Act, 1996 (fairness and neutrality of arbitration and dispute resolution).

For each clause, output:
- compliance_risk_level: "low", "medium", or "high".
- potential_issue_areas: list of short strings, each describing a possible issue area (e.g. "Broad non-compete duration", "Personal data processing without clear consent", "Unilateral appointment of arbitrator").
- human_review_strongly_recommended: true if a reasonable person might want a qualified Indian lawyer to review this clause; false otherwise.
- explanatory_note: 1–3 sentences explaining, in plain language, why this clause may raise potential Indian law issues, if any.

Rules:
- Use cautious language like "may raise issues under", "might be considered", "could be inconsistent with".
- Do not claim that a clause is definitely illegal, void, or unenforceable.
- Do not include exact section numbers. Use general descriptions like "restraint of trade provisions", "obligations when processing personal data", or "requirements for neutral arbitration".
- If you see no clear Indian law concern, use compliance_risk_level = "low" and an empty potential_issue_areas array.
- Keep explanatory_note concise and user-friendly.

Output strict JSON only with shape:
{
  "results": [
    {
      "id": "c1",
      "compliance_risk_level": "medium",
      "potential_issue_areas": ["..."],
      "human_review_strongly_recommended": true,
      "explanatory_note": "..."
    }
  ]
}`;

  const userContent = JSON.stringify({
    clauses: validBatch.map((c) => ({
      id: c.id,
      text: c.text,
      clause_type: c.clause_type,
      risk_level: c.risk_level,
      risk_score: c.risk_score,
      possible_law_references: c.possible_law_references,
    })),
  });

  try {
    const response = await callLLM({
      systemPrompt,
      userContent,
      jsonMode: true,
      temperature: 0.2,
    });

    return response?.results || [];
  } catch (err) {
    console.error('⚠️  Agent 4 Compliance batch call failed:', err.message);
    // Return empty results to let outer loop gracefully default
    return [];
  }
}

/**
 * Main function to evaluate a full contract document for Indian compliance.
 * Employs Option B (token-optimized filtering) and safe error borders.
 *
 * @param {string|ObjectId} contractId
 */
async function runComplianceCheckForContract(contractId) {
  try {
    // 1. Fetch all clauses associated with this contract
    const clauses = await Clause.find({ contractId }).sort({ segmentIndex: 1 });
    if (clauses.length === 0) return;

    console.log(`\n[Agent 4] Evaluating Indian law compliance for contract: ${contractId} (${clauses.length} clauses)`);

    // 2. Option B: Separate into Check vs Skip groups
    const toCheck = [];
    const toSkip = [];

    for (const c of clauses) {
      const isRisky = c.risk_level === 'medium' || c.risk_level === 'high' || c.risk_level === 'critical';
      const hasLawHint = c.possible_law_references && c.possible_law_references.length > 0;

      if (isRisky || hasLawHint) {
        toCheck.push(c);
      } else {
        toSkip.push(c);
      }
    }

    console.log(`[Agent 4] Option B active: checking ${toCheck.length} risky clauses, skipping ${toSkip.length} low-risk clauses.`);

    // 3. Directly save 'low' compliance risk for skipped clauses
    for (const clause of toSkip) {
      clause.compliance_risk_level = 'low';
      clause.potential_issue_areas = [];
      clause.human_review_strongly_recommended = false;
      clause.explanatory_note = 'No significant Indian law compliance issues flagged.';
      await clause.save();
    }

    // 4. Batch & process clauses in 'toCheck' using AGENT_BATCH_SIZE
    const batchSize = AGENT_BATCH_SIZE || 15;
    for (let i = 0; i < toCheck.length; i += batchSize) {
      const slice = toCheck.slice(i, i + batchSize);
      
      const inputs = slice.map((c) => ({
        id: c._id.toString(),
        text: c.rawText,
        clause_type: c.clause_type || 'other',
        risk_level: c.risk_level || 'low',
        risk_score: c.risk_score || 0,
        possible_law_references: c.possible_law_references || [],
      }));

      console.log(`[Agent 4] Batching clauses ${i + 1} to ${Math.min(toCheck.length, i + batchSize)}...`);
      const results = await runAgent4ComplianceChecker(inputs);

      // Create lookup map of output results by ID
      const resultsMap = {};
      if (Array.isArray(results)) {
        for (const res of results) {
          if (res && res.id) {
            resultsMap[res.id] = res;
          }
        }
      }

      // Update documents in the database
      for (const clause of slice) {
        const match = resultsMap[clause._id.toString()];
        if (match) {
          clause.compliance_risk_level = match.compliance_risk_level || 'low';
          clause.potential_issue_areas = Array.isArray(match.potential_issue_areas)
            ? match.potential_issue_areas
            : [];
          clause.human_review_strongly_recommended = !!match.human_review_strongly_recommended;
          clause.explanatory_note = match.explanatory_note || 'Compliance check completed.';
        } else {
          // Fallback defaults on missing matching items
          clause.compliance_risk_level = 'low';
          clause.potential_issue_areas = [];
          clause.human_review_strongly_recommended = false;
          clause.explanatory_note = 'Compliance check processed.';
        }
        await clause.save();
      }
    }

    // 5. Update Contract compliance checked metadata
    const contract = await Contract.findById(contractId);
    if (contract) {
      contract.agentMetadata = contract.agentMetadata || {};
      contract.agentMetadata.complianceCheckedAt = new Date();
      await contract.save();
    }

    console.log(`[Agent 4] Compliance check for contract ${contractId} completed successfully!`);
  } catch (err) {
    console.error(`⚠️  Agent 4 orchestrator failed for contract ${contractId}:`, err);
    // Non-blocking try/catch block
  }
}

module.exports = {
  runAgent4ComplianceChecker,
  runComplianceCheckForContract,
};
