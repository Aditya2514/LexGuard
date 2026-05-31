const Contract = require('../models/Contract');
const Clause = require('../models/Clause');

/**
 * Calculates the overall confidence score (0-100) for a given clause.
 * Dynamically adjusts weights for "Not Applicable" scenarios (e.g., standard commercial clauses).
 */
async function scoreClauseConfidence(clause, contract) {
  let totalWeight = 0;
  let earnedPoints = 0;

  // 1. Agent 2 Confidence (20% Weight)
  if (clause.confidence_score !== null && clause.confidence_score !== undefined) {
    const a2Score = (clause.confidence_score / 10) * 100;
    earnedPoints += (a2Score * 0.20);
    totalWeight += 20;
  }

  // 2. Tier 2 Escalation (25% Weight)
  if (clause.tier2_escalated) {
    // If escalated, did Tier 2 agree?
    const t2Score = clause.tier2_agrees ? 100 : 50; // If disagreement, we have a resolution but with mixed signals
    earnedPoints += (t2Score * 0.25);
    totalWeight += 25;
  } else {
    // Not escalated because Agent 2 was highly confident. Treat as 100%.
    earnedPoints += (100 * 0.25);
    totalWeight += 25;
  }

  // 3. Citation Verification (25% Weight) & 4. HyDE Retrieval (15% Weight)
  const hasLawRefs = clause.possible_law_references && clause.possible_law_references.length > 0;
  
  // Check if it's a purely commercial clause (no citations needed)
  const isPurelyCommercial = !hasLawRefs && (!clause.citation_accuracy || clause.citation_accuracy === null);

  if (isPurelyCommercial) {
    // Edge Case Fix: "Not Applicable" Penalty.
    // If the clause does not need citations, we do NOT penalize it with a 0.
    // We simply skip adding these weights to the denominator (dynamic recalculation).
    // The user also mentioned defaulting to 100% works. Let's distribute evenly by omitting the weights.
    // So we add 0 to totalWeight.
  } else {
    // Citation Verification (25%)
    if (clause.citation_accuracy !== null && clause.citation_accuracy !== undefined) {
      earnedPoints += (clause.citation_accuracy * 0.25);
      totalWeight += 25;
    } else {
      // If it has law refs but no accuracy computed yet, maybe 0?
      totalWeight += 25; // 0 points
    }

    // HyDE Retrieval (15%) - Proxy using existence of law refs
    const hasRetrievedContext = hasLawRefs;
    const hydeScore = hasRetrievedContext ? 85 : 30;
    earnedPoints += (hydeScore * 0.15);
    totalWeight += 15;
  }

  // 5. Agent 9 Cross-Ref (15% Weight)
  if (contract && contract.crossRefFindings !== undefined) {
    const crossRefIssuesForClause = (contract.crossRefFindings || [])
      .filter(f => f.severity === 'high' && f.location_hint && f.location_hint.includes(`Clause ${clause.segmentIndex}`)).length;
    const agent9Score = crossRefIssuesForClause > 0 ? 50 : 100;
    earnedPoints += (agent9Score * 0.15);
    totalWeight += 15;
  }

  // Calculate final score based on dynamic denominator
  let finalScore = 0;
  if (totalWeight > 0) {
    finalScore = (earnedPoints / totalWeight) * 100;
  }

  // Round to 1 decimal place
  finalScore = Math.round(finalScore * 10) / 10;

  // Determine Level
  let level = 'LOW';
  if (finalScore >= 80) level = 'HIGH';
  else if (finalScore >= 50) level = 'MEDIUM';

  return { score: finalScore, level };
}

/**
 * Iterates through all clauses of a contract and assigns the confidence score.
 */
async function scoreConfidenceForContract(contractId) {
  console.log(`\n🔍 [Phase 6] Starting Confidence Scoring for Contract: ${contractId}`);
  
  const contract = await Contract.findById(contractId);
  if (!contract) {
    console.error(`Contract ${contractId} not found.`);
    return;
  }

  const clauses = await Clause.find({ contractId }).sort({ segmentIndex: 1 });
  let processed = 0;

  for (const clause of clauses) {
    const { score, level } = await scoreClauseConfidence(clause, contract);
    
    clause.overall_confidence_score = score;
    clause.overall_confidence_level = level;
    
    await clause.save();
    processed++;
  }

  console.log(`✅ [Phase 6] Confidence Scoring Complete. Processed ${processed} clauses.\n`);
}

module.exports = {
  scoreClauseConfidence,
  scoreConfidenceForContract
};
