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
    .select('clause_type risk_level compliance_risk_level human_review_strongly_recommended');

  const riskBreakdown = { low: 0, medium: 0, high: 0, critical: 0 };
  const byType = {};
  const complianceBreakdown = { low: 0, medium: 0, high: 0 };
  let complianceReviewRecommendedCount = 0;

  for (const c of clauses) {
    // Count per risk level
    if (c.risk_level && riskBreakdown.hasOwnProperty(c.risk_level)) {
      riskBreakdown[c.risk_level]++;
    }

    // Count per clause type
    const ct = c.clause_type || 'other';
    if (!byType[ct]) byType[ct] = { count: 0, highOrCritical: 0 };
    byType[ct].count++;
    if (c.risk_level === 'high' || c.risk_level === 'critical') {
      byType[ct].highOrCritical++;
    }

    // Count per compliance risk level (default null to 'low' as per Option B specification)
    const compLevel = c.compliance_risk_level || 'low';
    if (complianceBreakdown.hasOwnProperty(compLevel)) {
      complianceBreakdown[compLevel]++;
    }

    // Count lawyers review recommended clauses
    if (c.human_review_strongly_recommended === true) {
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
