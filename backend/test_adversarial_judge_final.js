const assert = require('assert');
require('dotenv').config();
const { runAdversarialJudge } = require('./src/services/agent2RiskAnalyst');

async function runFinalJudgeTestSuite() {
  console.log("══ INITIALIZING ULTIMATE FINAL JUDGE TEST SUITE ════\n");

  const mockGlobalContext = {
    metadata: { governingLaw: "India", employerName: "Nexus Global", employeeDesignation: "Manager" },
    globalDefinitions: {}
  };

  let passed = 0;
  let failed = 0;

  async function testCase(name, clauseText, baseAnalysis, assertions) {
    console.log(`👉 Running: ${name}`);
    try {
      const result = await runAdversarialJudge(mockGlobalContext, clauseText, baseAnalysis);
      const score = result.risk_score !== undefined ? result.risk_score : result.score;
      const level = (result.risk_level || result.riskRating || "").toLowerCase();
      
      assertions(result, score, level);
      console.log(`✅ Passed: ${name}\n`);
      passed++;
      await new Promise(r => setTimeout(r, 6000)); // Rate limit delay
    } catch (err) {
      console.error(`❌ Failed: ${name}`);
      console.error(err.message, '\n');
      failed++;
      await new Promise(r => setTimeout(r, 6000)); // Rate limit delay
    }
  }

  // 1. Managerial Exemption (Safe Harbor / False Positive)
  await testCase(
    "Test 1: Managerial Exemption (Shops & Establishments)",
    "Employee is engaged in a managerial capacity and is thus exempt from standard working hours and overtime compensation under the state Shops & Establishments frameworks, but remains entitled to mutual consensus scheduling.",
    {
      risk_level: "high", risk_score: 8,
      risk_reasons: ["Denies employee overtime pay and standard working hours."],
      possible_law_references: [{ act_key: "SHOPS_AND_ESTABLISHMENTS_ACT", reason: "Denial of overtime." }]
    },
    (res, score, level) => {
      assert.ok(score <= 4, `Expected score <= 4 for valid managerial exemption, got ${score}`);
      assert.ok(["low", "medium"].includes(level), `Expected LOW or MEDIUM risk, got ${level}`);
    }
  );

  // 2. Training Bond Liquidation (Predatory Trap / False Negative)
  await testCase(
    "Test 2: Aggressive Training Bond (Section 74 Penalty)",
    "The Company invests heavily in training. Should the employee depart before 36 months, they must repay a liquidated penalty of 250% of the training costs, recoverable by immediate deduction from any pending wage deferral escrow.",
    {
      risk_level: "low", risk_score: 2,
      risk_reasons: ["Standard company training bond."],
      possible_law_references: []
    },
    (res, score, level) => {
      assert.ok(score >= 8, `Expected score >= 8 for excessive penalty/escrow forfeiture, got ${score}`);
      assert.ok(["high", "critical"].includes(level), `Expected HIGH/CRITICAL risk, got ${level}`);
    }
  );

  // 3. Dual-Token: Safe Harbor + Statutory Trap
  await testCase(
    "Test 3: Dual-Token (Strict Scope + Section 19(4) Waiver)",
    "Employee explicitly waives all rights to copyright reversion under Section 19(4) of the Copyright Act for any IP created within the strict scope of employment.",
    {
      risk_level: "low", risk_score: 1, // Base analyst tricked by "strict scope"
      risk_reasons: ["Valid IP assignment within employment scope."],
      possible_law_references: []
    },
    (res, score, level) => {
      assert.ok(score >= 8, `Expected score >= 8 because 19(4) waiver overrides the safe harbor, got ${score}`);
      assert.ok(["high", "critical"].includes(level), `Expected HIGH/CRITICAL risk, got ${level}`);
    }
  );

  console.log(`\n══ ULTIMATE FINAL TEST SUITE COMPLETE ══`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runFinalJudgeTestSuite();
