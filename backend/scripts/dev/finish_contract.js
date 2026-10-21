require('dotenv').config();
const mongoose = require('mongoose');
const Contract = require('./src/models/Contract');
const Clause = require('./src/models/Clause');
const { classifyClausesForContract } = require('./src/services/agent1ClauseExtractor');
const { analyseRisksForContract } = require('./src/services/agent2RiskAnalyst');
const { generateUserAdvocateForContract } = require('./src/services/agent3UserAdvocate');
const { runComplianceCheckForContract } = require('./src/services/agent4ComplianceChecker');

(async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lexguard');
    console.log('Connected!');

    const contractId = '6a0af6964c2dde0626212b0b';
    console.log(`\nRe-triggering AI Analysis pipeline for Contract ID: ${contractId}`);

    let aiStatus = 'done';
    try {
      console.log('Running Agent 1 Clause Extractor...');
      await classifyClausesForContract(contractId);

      console.log('Running Agent 2 Risk Analyst...');
      await analyseRisksForContract(contractId);

      console.log('Running Agent 3 User Advocate & Agent 4 Compliance Checker concurrently...');
      await Promise.all([
        generateUserAdvocateForContract(contractId),
        runComplianceCheckForContract(contractId),
      ]);
      console.log('All agents processed successfully!');
    } catch (aiErr) {
      console.error(`⚠️ AI analysis failed: ${aiErr.message}`);
      aiStatus = 'partial';
    }

    // Recompute overallRiskLevel
    console.log('Recomputing overall risk level...');
    const analyzedClauses = await Clause.find({ contractId }).select('risk_level');
    const riskLevels = analyzedClauses.map(c => c.risk_level).filter(Boolean);
    let computedOverallRisk = null;
    if (riskLevels.length > 0) {
      const RISK_PRIORITY = { critical: 4, high: 3, medium: 2, low: 1 };
      computedOverallRisk = riskLevels.reduce((worst, lvl) =>
        (RISK_PRIORITY[lvl] || 0) > (RISK_PRIORITY[worst] || 0) ? lvl : worst
      , riskLevels[0]);
    }

    console.log(`Setting status to: ${aiStatus}, risk: ${computedOverallRisk}`);
    const updatedContract = await Contract.findByIdAndUpdate(
      contractId,
      {
        status: aiStatus,
        ...(computedOverallRisk && { overallRiskLevel: computedOverallRisk }),
      },
      { new: true }
    );
    console.log('Contract updated successfully:');
    console.log(JSON.stringify(updatedContract, null, 2));

  } catch (err) {
    console.error('Fatal error:', err);
  } finally {
    await mongoose.disconnect();
  }
})();
