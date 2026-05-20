const assert = require('assert');
const mongoose = require('mongoose');
require('dotenv').config();

const { runAdversarialJudge } = require('./src/services/agent2RiskAnalyst');

async function runJudgeTestSuite() {
  console.log("══ INITIALIZING ASYMMETRIC JUDGE TEST SUITE ════");
  
  const mockGlobalContext = {
    metadata: { governingLaw: "India", employerName: "Nexus Global" }
  };

  // Test Case 1: Over-sensitive Base Analyst on a clean Overtime Clause
  const cleanWorkingHoursText = "Employee shall work 40 hours a week, conforming strictly with state Shops and Establishments frameworks and compensated with overtime wages.";
  const flawedBaseAnalysis = {
    risk_level: "high",
    riskRating: "HIGH",
    risk_score: 8,
    score: 8,
    risk_reasons: ["Potential waiver of labor hours rights under Section 23."],
    auditNote: "Potential waiver of labor hours rights under Section 23.",
    possible_law_references: [{ act_key: "INDIAN_CONTRACT_ACT", section_hint: "Section 23", reason: "Waiver of rights." }],
    citations: [{ statute: "Indian Contract Act (Section 23)", reason: "Waiver of rights." }]
  };

  console.log("👉 TC1: Testing False Positive Downscaling on Clean Text...");
  const tc1Result = await runAdversarialJudge(mockGlobalContext, cleanWorkingHoursText, flawedBaseAnalysis);
  console.log("TC1 RESULT:", JSON.stringify(tc1Result, null, 2));
  
  const tc1Score = tc1Result.risk_score !== undefined ? tc1Result.risk_score : tc1Result.score;
  const tc1Rating = tc1Result.risk_level || tc1Result.riskRating;
  
  assert.ok(tc1Score <= 2, "FAIL: Judge failed to downscale an over-sensitive false positive on a safe harbor clause.");
  assert.equal(tc1Rating.toLowerCase(), "low", "FAIL: Risk rating was not corrected to LOW.");
  console.log("✅ TC1 Passed: False positive successfully corrected to LOW.");

  // Test Case 2: Lenient Base Analyst on a Unilateral Arbitrator selection trap
  const predatoryArbitrationText = "The Company retains the exclusive, unilateral right to nominate and appoint the Sole Arbitrator.";
  const lenientBaseAnalysis = {
    risk_level: "low",
    riskRating: "LOW",
    risk_score: 2,
    score: 2,
    risk_reasons: ["Standard arbitration clause to avoid court backlogs."],
    auditNote: "Standard arbitration clause to avoid court backlogs.",
    possible_law_references: [],
    citations: []
  };

  console.log("👉 TC2: Testing Predatory Trap Escalation...");
  const tc2Result = await runAdversarialJudge(mockGlobalContext, predatoryArbitrationText, lenientBaseAnalysis);

  const tc2Score = tc2Result.risk_score !== undefined ? tc2Result.risk_score : tc2Result.score;
  const tc2Citations = tc2Result.possible_law_references || tc2Result.citations || [];

  assert.ok(tc2Score >= 8, "FAIL: Judge failed to escalate a clear unilateral arbitrator trap.");
  assert.ok(tc2Citations.some(c => JSON.stringify(c).includes("ARBITRATION") || JSON.stringify(c).includes("1996")), "FAIL: Failed to append Arbitration Act citation.");
  console.log("✅ TC2 Passed: Predatory trap successfully caught and escalated.");

  console.log("══ 🏆 ALL JUDGE UNIT TESTS PASSED FLAWLESSLY ══");
  process.exit(0);
}

runJudgeTestSuite().catch(err => {
  console.error("❌ Test Suite Crashed:", err);
  process.exit(1);
});
