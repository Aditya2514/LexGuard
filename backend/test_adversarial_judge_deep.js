const assert = require('assert');
require('dotenv').config();
const { runAdversarialJudge } = require('./src/services/agent2RiskAnalyst');

async function runDeepJudgeTestSuite() {
  console.log("══ INITIALIZING DEEP EDGE-CASE ASYMMETRIC JUDGE TEST SUITE ════\n");

  const mockGlobalContext = {
    metadata: { governingLaw: "India", employerName: "Nexus Global", employeeDesignation: "Software Engineer" },
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

  // ── FALSE POSITIVES (Should Downgrade) ──────────────────────────────

  await testCase(
    "Safe Harbor 1: Standard Recitals (Base was too harsh)",
    "This Employment Agreement ('Agreement') is made and entered into on this day, by and between Nexus Global (hereinafter referred to as the 'Company').",
    {
      risk_level: "high", risk_score: 7,
      risk_reasons: ["Binding agreement establishing restrictive covenants."],
      possible_law_references: [{ act_key: "INDIAN_CONTRACT_ACT", reason: "Formation of contract." }]
    },
    (res, score, level) => {
      assert.ok(score <= 2, `Expected score <= 2 for standard recital, got ${score}`);
      assert.strictEqual(level, "low", `Expected LOW risk, got ${level}`);
    }
  );

  await testCase(
    "Safe Harbor 2: Standard Work-for-Hire IP Assignment",
    "All intellectual property created during the strict scope of employment using company resources shall remain the exclusive property of the Company.",
    {
      risk_level: "high", risk_score: 8,
      risk_reasons: ["Complete transfer of IP rights strips employee of ownership."],
      possible_law_references: [{ act_key: "COPYRIGHT_ACT", reason: "IP assignment" }]
    },
    (res, score, level) => {
      assert.ok(score <= 2, `Expected score <= 2 for valid work-for-hire, got ${score}`);
      assert.strictEqual(level, "low", `Expected LOW risk, got ${level}`);
    }
  );

  await testCase(
    "Safe Harbor 3: Reasonable Post-Employment Confidentiality",
    "Employee agrees to maintain absolute confidentiality regarding the Company's proprietary trade secrets for a period of 12 months post-termination.",
    {
      risk_level: "high", risk_score: 9,
      risk_reasons: ["Restricts employee from sharing information post-termination."],
      possible_law_references: [{ act_key: "INDIAN_CONTRACT_ACT", section_hint: "Section 27", reason: "Restraint of trade." }]
    },
    (res, score, level) => {
      assert.ok(score <= 2, `Expected score <= 2 for reasonable confidentiality, got ${score}`);
      assert.strictEqual(level, "low", `Expected LOW risk, got ${level}`);
    }
  );

  // ── FALSE NEGATIVES (Should Escalate) ──────────────────────────────

  await testCase(
    "Predatory Trap 1: Copyright Act 19(4) Reversion Waiver",
    "Employee explicitly waives their rights under Section 19(4) of the Copyright Act, and agrees that the assignment shall not lapse if unexercised.",
    {
      risk_level: "low", risk_score: 1,
      risk_reasons: ["Standard IP waiver clause."],
      possible_law_references: []
    },
    (res, score, level) => {
      assert.ok(score >= 8, `Expected score >= 8 for Section 19(4) waiver, got ${score}`);
      assert.ok(["high", "critical"].includes(level), `Expected HIGH/CRITICAL risk, got ${level}`);
      const refs = JSON.stringify(res.possible_law_references || res.citations || []);
      assert.ok(refs.includes("COPYRIGHT") || refs.includes("19"), "Missing Copyright Act citation");
    }
  );

  await testCase(
    "Predatory Trap 2: Section 74 Salary Escrow Forfeiture",
    "The Company shall defer 20% of the employee's monthly salary into an escrow account, which shall be entirely forfeited as liquidated damages if the employee resigns within 2 years.",
    {
      risk_level: "medium", risk_score: 4,
      risk_reasons: ["Company uses an escrow deferral mechanism."],
      possible_law_references: []
    },
    (res, score, level) => {
      assert.ok(score >= 8, `Expected score >= 8 for wage forfeiture, got ${score}`);
      assert.ok(["high", "critical"].includes(level), `Expected HIGH/CRITICAL risk, got ${level}`);
      const refs = JSON.stringify(res.possible_law_references || res.citations || []);
      assert.ok(refs.includes("74") || refs.includes("CONTRACT"), "Missing Contract Act Section 74 citation");
    }
  );

  await testCase(
    "Predatory Trap 3: Global Lockout Non-Compete",
    "The Employee agrees to a perpetual and irrevocable worldwide non-compete restriction, preventing employment in the tech sector indefinitely.",
    {
      risk_level: "medium", risk_score: 5,
      risk_reasons: ["Standard non-compete clause."],
      possible_law_references: []
    },
    (res, score, level) => {
      assert.ok(score >= 8, `Expected score >= 8 for global lockout, got ${score}`);
      assert.ok(["high", "critical"].includes(level), `Expected HIGH/CRITICAL risk, got ${level}`);
      const refs = JSON.stringify(res.possible_law_references || res.citations || []);
      assert.ok(refs.includes("27") || refs.includes("CONTRACT"), "Missing Contract Act Section 27 citation");
    }
  );

  await testCase(
    "Dual-Token Clause: Predatory Trap overrides Safe Harbor",
    "Any dispute shall be resolved by the sole arbitrator appointed unilaterally by the Company, with the mutual consensus of both parties required only for location selection.",
    {
      risk_level: "low", risk_score: 2,
      risk_reasons: ["Requires mutual consensus."],
      possible_law_references: []
    },
    (res, score, level) => {
      assert.ok(score >= 7, `Expected score >= 7 for unilateral arbitration despite 'mutual consensus' token, got ${score}`);
      assert.ok(["high", "critical"].includes(level), `Expected HIGH/CRITICAL risk, got ${level}`);
    }
  );

  console.log(`\n══ DEEP JUDGE TEST SUITE COMPLETE ══`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runDeepJudgeTestSuite();
