const Contract = require('../models/Contract');
const Clause = require('../models/Clause');

/**
 * Computes overall risk and compliance summary metrics for a given contract ID.
 * Decoupled from routes to support both GET /risk-summary and POST /export-to-sheets.
 * 
 * @param {string} contractId
 * @returns {Promise<object|null>}
 */
async function computeRiskSummaryForContract(contractId) {
  const contract = await Contract.findById(contractId)
    .select('_id overallRiskLevel totalClauses');
  if (!contract) return null;

  const clauses = await Clause.find({ contractId })
    .select('clause_type risk_level risk_score compliance_risk_level human_review_strongly_recommended');

  const riskBreakdown = { low: 0, medium: 0, high: 0, critical: 0 };
  const byType = {};
  const complianceBreakdown = { low: 0, medium: 0, high: 0 };
  let complianceReviewRecommendedCount = 0;

  for (const c of clauses) {
    let currentRiskLevel = c.risk_level || 'low';

    // Safety dynamic override for low-risk scores (<= 5)
    if (c.risk_score !== null && c.risk_score !== undefined && c.risk_score <= 5) {
      currentRiskLevel = 'low';
    }

    // Count per risk level
    if (currentRiskLevel && riskBreakdown.hasOwnProperty(currentRiskLevel)) {
      riskBreakdown[currentRiskLevel]++;
    }

    // Count per clause type
    const ct = c.clause_type || 'other';
    if (!byType[ct]) byType[ct] = { count: 0, highOrCritical: 0 };
    byType[ct].count++;
    if (currentRiskLevel === 'high' || currentRiskLevel === 'critical') {
      byType[ct].highOrCritical++;
    }

    // Count per compliance risk level (default null to 'low' as per Option B specification)
    let compLevel = c.compliance_risk_level || 'low';
    if (c.risk_score !== null && c.risk_score !== undefined && c.risk_score <= 5) {
      compLevel = 'low';
    }
    if (complianceBreakdown.hasOwnProperty(compLevel)) {
      complianceBreakdown[compLevel]++;
    }

    // Count lawyers review recommended clauses (exclude if risk score is low)
    if (c.human_review_strongly_recommended === true && (c.risk_score === null || c.risk_score === undefined || c.risk_score > 5)) {
      complianceReviewRecommendedCount++;
    }
  }

  return {
    contractId: contract._id,
    overallRiskLevel: contract.overallRiskLevel,
    totalClauses: contract.totalClauses,
    riskBreakdown,
    byType,
    complianceBreakdown,
    complianceReviewRecommendedCount,
  };
}

module.exports = {
  computeRiskSummaryForContract,
};
