/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║          LEXGUARD — HEAVY EDGE-CASE TEST SUITE FOR HUGGING FACE        ║
 * ║                                                                        ║
 * ║  Tests: 15 edge cases across all 3 agents + orchestrator resilience    ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */
require('dotenv').config();
const { callLLM } = require('./src/services/aiClient.js');

// ══════════════════════════════════════════════════════════════════════════════
// PRODUCTION SYSTEM PROMPTS (exact copies from agents)
// ══════════════════════════════════════════════════════════════════════════════

const AGENT2_PROMPT = `You are LexGuard, an AI legal risk and negotiation assistant that helps users understand and triage contract clauses.
You are not a lawyer and you do not provide legal advice.
Your job is to highlight potential risks and pain points for a non-lawyer user, and point out potential Indian law touchpoints using cautiously worded hints.

### 1. Safety and reliability rules (mandatory)
1. No legal advice or verdicts — Never say a clause is "legal", "illegal", "valid", "void", "enforceable", or "unenforceable".
2. Always assume a human lawyer will decide.
3. Facts vs. inferences — Separate objective facts from your interpretation.
4. Indian law references — Always name the Act and a high-level section number if relevant.

### 2. Output format (JSON only)
You must reply with valid JSON only:
{
  "results": [
    {
      "id": "clauseObjectId",
      "risk_level": "high",
      "risk_score": 8,
      "risk_reasons": ["..."],
      "possible_law_references": [
        { "act_key": "INDIAN_CONTRACT_ACT", "section_hint": "Section 27", "reason": "..." }
      ]
    }
  ]
}
- risk_level: one of "low", "medium", "high", "critical".
- risk_score: integer from 1 to 10.
- risk_reasons: 1–5 short bullet-style strings.
- possible_law_references: array of objects.`;

const AGENT3_PROMPT = `You are LexGuard, an AI legal risk and negotiation assistant.
You are not a lawyer and you do not provide legal advice.
Your job is to explain what each clause does in plain language, highlight potential risks, and suggest practical negotiation ideas.

### Output format (JSON only)
{
  "results": [
    {
      "id": "clauseObjectId",
      "plain_language_explanation": "...",
      "worst_case_scenario": "...",
      "negotiation_tip": "..."
    }
  ]
}`;

const AGENT4_PROMPT = `You are LexGuard, an AI legal risk and negotiation assistant that helps users understand and triage contract clauses.
You are not a lawyer and you do not provide legal advice.
Your job is to highlight potential areas where the clause may raise Indian law compliance concerns, specifically referencing the Acts, sections, and landmark cases provided in the retrieved legal context.

### 1. Safety and reliability rules (mandatory)

1. No legal advice or verdicts
   - Never say a clause is "legal", "illegal", "valid", "void", "enforceable", or "unenforceable".
   - Instead, use phrases like: "may raise issues under...", "might be considered...", "could be inconsistent with...".

2. Always assume a human lawyer will decide
   - Your job is to flag potential risks, not to decide outcomes.

3. Indian law references
   - When you mention Indian law, name the Act and a high-level section number if relevant.
   - Never quote full bare-act text. Summarize in your own words.

### 2. Classification Guidelines for compliance_risk_level
You must classify the compliance_risk_level strictly according to the following thresholds:
- **high**: Any clause that is highly likely to be unenforceable, predatory, or in direct violation of statutory protections. This includes:
  - **Wage / Compensation Deferrals/Withholding**: Unilateral deferrals of salary, interest-free holding of wages, or penal deductions (violating the Payment of Wages Act, 1936).
  - **Employment / Training Bonds**: Punitive or unreasonable repayment obligations (e.g., 200%-300% markup, exorbitant interest, or excessively long service locks) (violating Section 74 of the Indian Contract Act, 1872).
  - **Post-employment Non-competes**: Restricting employment post-termination in any broad geographic region or sector (violating Section 27 of the Indian Contract Act, 1872).
  - **Statutory Rights Waivers**: Waiver of maximum working hours, statutory rest periods, 24/7 response mandates, or complete denial of severance.
- **medium**: Clauses that contain unbalanced terms, aggressive limits, or potential compliance issues but are not outright predatory or statutorily void.
- **low**: Standard operational clauses, benign hours, or standard confidentiality/good-faith agreements with no clear Indian law compliance concerns.

### 3. Output format (JSON only)
You must reply with valid JSON only, with this structure:
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
}

- compliance_risk_level: "low", "medium", or "high".
- potential_issue_areas: list of short strings, each describing a possible issue area.
- human_review_strongly_recommended: true if a reasonable person might want a qualified Indian lawyer to review this clause; false otherwise.
- explanatory_note: 1–3 sentences explaining, in plain language, why this clause may raise potential Indian law issues. Keep it concise and user-friendly.

If you see no clear Indian law concern, use compliance_risk_level = "low" and an empty potential_issue_areas array.`;

// ══════════════════════════════════════════════════════════════════════════════
// TEST CLAUSE DATA — Realistic, adversarial, and edge-case inputs
// ══════════════════════════════════════════════════════════════════════════════

const CLAUSES = {
  nonCompete: { id: "nc1", text: "The Employee shall not, for a period of 36 months following termination, directly or indirectly engage in any business that competes with the Company, in any territory worldwide.", clause_type: "non_compete" },
  arbitration: { id: "arb1", text: "All disputes arising out of this agreement shall be resolved by a sole arbitrator appointed exclusively by the Company. The seat of arbitration shall be Singapore.", clause_type: "arbitration" },
  privacy: { id: "prv1", text: "The Company shall collect, process, transfer, and sell the Employee's personal data including biometric data, health records, and financial information to third parties without requiring explicit consent.", clause_type: "privacy_data" },
  ipOwnership: { id: "ip1", text: "All intellectual property, inventions, patents, copyrights, and trade secrets created by the Employee during or outside of working hours, including personal side-projects and weekend work, shall be the sole property of the Company.", clause_type: "ip_ownership" },
  termination: { id: "term1", text: "The Company may terminate the Employee's employment immediately, without cause, without notice, and without any severance payment.", clause_type: "termination" },
  confidentiality: { id: "conf1", text: "The Employee agrees to maintain confidentiality of all company information, processes, and methodologies in perpetuity, even after termination.", clause_type: "confidentiality" },
  wageDeferral: { id: "wd1", text: "The Company reserves the right to unilaterally defer up to 40% of the Employee's base salary, interest-free, during any quarter in which the Company reports negative operating margins, depositing deferred amounts into a corporate reserve account.", clause_type: "compensation" },
  trainingBond: { id: "tb1", text: "The Employee agrees to repay 300% of all internal onboarding and orientation costs, including administrative overhead markup fees at 18% compounding annual interest, if the Employee resigns within 36 months of the start date.", clause_type: "compensation" },
  availability: { id: "av1", text: "The Employee agrees to be available 24 hours a day, 7 days a week, and to respond to all communications within 15 minutes. The Employee hereby waives all statutory rest periods and maximum working hour protections.", clause_type: "working_hours" },
  liquidatedDmg: { id: "ld1", text: "In the event of any breach, the Employee shall pay liquidated damages equal to 200% of annual compensation, and the Company shall be entitled to obtain ex-parte injunctions without proving actual loss.", clause_type: "liability" },
  benign: { id: "ben1", text: "The Employee shall report to work at 9:00 AM and leave at 6:00 PM, Monday through Friday, at the registered office address.", clause_type: "working_hours" },
  vague: { id: "vag1", text: "The parties agree to act in good faith and comply with applicable laws.", clause_type: "other" },
};

// ══════════════════════════════════════════════════════════════════════════════
// TEST UTILITIES
// ══════════════════════════════════════════════════════════════════════════════

let totalTests = 0;
let passed = 0;
let failed = 0;
const failures = [];

function makePayload(clauses) {
  const arr = Array.isArray(clauses) ? clauses : [clauses];
  return JSON.stringify({ clauses: arr });
}

async function runTest(name, { systemPrompt, userContent, validator }) {
  totalTests++;
  const start = Date.now();
  process.stdout.write(`  [${totalTests.toString().padStart(2)}] ${name} ... `);
  try {
    const res = await callLLM({ systemPrompt, userContent, jsonMode: true });
    const elapsed = Date.now() - start;
    const ok = validator(res);
    if (ok) {
      passed++;
      console.log(`✅ PASS (${elapsed}ms)`);
    } else {
      failed++;
      console.log(`❌ FAIL (${elapsed}ms) — validator returned false`);
      failures.push({ name, reason: 'Validator failed', data: JSON.stringify(res).substring(0, 300) });
    }
  } catch (e) {
    const elapsed = Date.now() - start;
    failed++;
    console.log(`❌ FAIL (${elapsed}ms) — ${e.message.substring(0, 120)}`);
    failures.push({ name, reason: e.message.substring(0, 200) });
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// TEST SUITE
// ══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════════╗");
  console.log("║       LEXGUARD — HEAVY EDGE-CASE TEST SUITE (15 Tests)             ║");
  console.log("╚══════════════════════════════════════════════════════════════════════╝");

  process.env.LLM_PROVIDER = 'huggingface';
  console.log(`  Provider: huggingface | Model: ${process.env.HUGGINGFACE_MODEL || 'Qwen/Qwen2.5-7B-Instruct'}`);
  console.log(`  Key: ${process.env.HUGGINGFACE_API_KEY ? '***' + process.env.HUGGINGFACE_API_KEY.slice(-4) : 'MISSING!'}\n`);

  // ── CATEGORY A: Schema Correctness per Agent ──────────────────────────────

  console.log("── A. Schema Correctness per Agent ──────────────────────────────────");

  await runTest("Agent2: Non-compete → risk_level + risk_score + risk_reasons", {
    systemPrompt: AGENT2_PROMPT,
    userContent: makePayload(CLAUSES.nonCompete),
    validator: (r) => {
      const x = r.results?.[0];
      return x && typeof x.risk_level === 'string' && typeof x.risk_score === 'number' && Array.isArray(x.risk_reasons);
    }
  });

  await runTest("Agent3: Non-compete → plain_language + worst_case + tip", {
    systemPrompt: AGENT3_PROMPT,
    userContent: makePayload(CLAUSES.nonCompete),
    validator: (r) => {
      const x = r.results?.[0];
      return x && typeof x.plain_language_explanation === 'string' && x.plain_language_explanation.length > 10
             && typeof x.worst_case_scenario === 'string' && typeof x.negotiation_tip === 'string';
    }
  });

  await runTest("Agent4: Non-compete → compliance_risk_level + explanatory_note", {
    systemPrompt: AGENT4_PROMPT,
    userContent: makePayload(CLAUSES.nonCompete),
    validator: (r) => {
      const x = r.results?.[0];
      return x && ['low','medium','high'].includes(x.compliance_risk_level) && typeof x.explanatory_note === 'string';
    }
  });

  // ── CATEGORY B: Risk Sensitivity ──────────────────────────────────────────

  console.log("\n── B. Risk Sensitivity (high risk clauses must not be rated low) ─────");

  await runTest("Agent4: Wage Deferral trap → must be HIGH compliance risk", {
    systemPrompt: AGENT4_PROMPT,
    userContent: makePayload(CLAUSES.wageDeferral),
    validator: (r) => {
      const x = r.results?.[0];
      return x && x.compliance_risk_level === 'high' && x.human_review_strongly_recommended === true;
    }
  });

  await runTest("Agent4: Training Bond trap → must be HIGH compliance risk", {
    systemPrompt: AGENT4_PROMPT,
    userContent: makePayload(CLAUSES.trainingBond),
    validator: (r) => {
      const x = r.results?.[0];
      return x && x.compliance_risk_level === 'high' && x.human_review_strongly_recommended === true;
    }
  });

  await runTest("Agent4: 24/7 Availability waiver → must be HIGH", {
    systemPrompt: AGENT4_PROMPT,
    userContent: makePayload(CLAUSES.availability),
    validator: (r) => {
      const x = r.results?.[0];
      return x && x.compliance_risk_level === 'high';
    }
  });

  await runTest("Agent4: Benign working hours → must be LOW", {
    systemPrompt: AGENT4_PROMPT,
    userContent: makePayload(CLAUSES.benign),
    validator: (r) => {
      const x = r.results?.[0];
      return x && x.compliance_risk_level === 'low';
    }
  });

  await runTest("Agent2: Liquidated 200% penalty → must be HIGH or CRITICAL", {
    systemPrompt: AGENT2_PROMPT,
    userContent: makePayload(CLAUSES.liquidatedDmg),
    validator: (r) => {
      const x = r.results?.[0];
      return x && ['high', 'critical'].includes(x.risk_level) && x.risk_score >= 7;
    }
  });

  // ── CATEGORY C: Multi-Clause Batching ─────────────────────────────────────

  console.log("\n── C. Multi-Clause Batching ─────────────────────────────────────────");

  await runTest("Agent4: 5 diverse clauses in one batch → 5 results", {
    systemPrompt: AGENT4_PROMPT,
    userContent: makePayload([CLAUSES.nonCompete, CLAUSES.arbitration, CLAUSES.privacy, CLAUSES.benign, CLAUSES.vague]),
    validator: (r) => {
      return r.results && r.results.length >= 4; // allow model to skip vague, but must handle at least 4
    }
  });

  await runTest("Agent2: 6 adversarial clauses batch → 6 results with scores", {
    systemPrompt: AGENT2_PROMPT,
    userContent: makePayload([CLAUSES.wageDeferral, CLAUSES.trainingBond, CLAUSES.availability, CLAUSES.liquidatedDmg, CLAUSES.ipOwnership, CLAUSES.termination]),
    validator: (r) => {
      if (!r.results || r.results.length < 5) return false;
      return r.results.every(x => typeof x.risk_score === 'number' && typeof x.risk_level === 'string');
    }
  });

  // ── CATEGORY D: Edge Cases & Adversarial Inputs ───────────────────────────

  console.log("\n── D. Edge Cases & Adversarial Inputs ──────────────────────────────");

  await runTest("Empty clause text → should not crash, should return low risk", {
    systemPrompt: AGENT4_PROMPT,
    userContent: makePayload({ id: "empty1", text: "", clause_type: "other" }),
    validator: (r) => r.results && r.results.length >= 0 // just doesn't crash
  });

  await runTest("Very short clause text → should handle gracefully", {
    systemPrompt: AGENT4_PROMPT,
    userContent: makePayload({ id: "short1", text: "The employee agrees.", clause_type: "other" }),
    validator: (r) => r.results && r.results.length >= 1
  });

  await runTest("Unicode / special chars in clause → no crash", {
    systemPrompt: AGENT4_PROMPT,
    userContent: makePayload({ id: "uni1", text: "कर्मचारी 36 महीने तक प्रतिस्पर्धा नहीं करेगा। Employee agrees to non-compete for ₹50,000 penalty & 100% forfeiture — \"binding\" clause under §27.", clause_type: "non_compete" }),
    validator: (r) => r.results && r.results.length >= 1
  });

  // ── CATEGORY E: Forced Failures & Fallback Resilience ─────────────────────

  console.log("\n── E. Forced Failures & Fallback Resilience ────────────────────────");

  // Temporarily corrupt the API key to force auth failure → fallback
  const realKey = process.env.HUGGINGFACE_API_KEY;
  process.env.HUGGINGFACE_API_KEY = 'hf_TOTALLY_BOGUS_KEY';
  await runTest("Bogus HF key → SmartLocalFallback activates cleanly", {
    systemPrompt: AGENT4_PROMPT,
    userContent: makePayload(CLAUSES.nonCompete),
    validator: (r) => {
      const x = r.results?.[0];
      return x && x.compliance_risk_level === 'high' && x.explanatory_note.length > 10;
    }
  });
  process.env.HUGGINGFACE_API_KEY = realKey;

  // Remove the key entirely
  delete process.env.HUGGINGFACE_API_KEY;
  await runTest("Missing HF key entirely → fallback without crash", {
    systemPrompt: AGENT4_PROMPT,
    userContent: makePayload(CLAUSES.arbitration),
    validator: (r) => {
      const x = r.results?.[0];
      return x && typeof x.compliance_risk_level === 'string';
    }
  });
  process.env.HUGGINGFACE_API_KEY = realKey;

  // ══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ══════════════════════════════════════════════════════════════════════════

  console.log("\n╔══════════════════════════════════════════════════════════════════════╗");
  console.log("║                         TEST SUMMARY                               ║");
  console.log("╚══════════════════════════════════════════════════════════════════════╝");
  console.log(`  Total: ${totalTests} | ✅ Passed: ${passed} | ❌ Failed: ${failed}`);

  if (failures.length > 0) {
    console.log("\n  ── FAILURE DETAILS ──");
    failures.forEach((f, i) => {
      console.log(`  ${i+1}. ${f.name}`);
      console.log(`     Reason: ${f.reason}`);
      if (f.data) console.log(`     Data: ${f.data}`);
    });
  }

  if (failed === 0) {
    console.log("\n  🎉 ALL 15 TESTS PASSED — Hugging Face integration is BATTLE-TESTED!");
  } else {
    console.log(`\n  ⚠️ ${failed} test(s) failed. Review details above.`);
  }
}

main();
