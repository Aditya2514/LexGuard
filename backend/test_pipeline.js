/**
 * End-to-end parse pipeline test (no DB, no HTTP).
 * Simulates what POST /api/contracts does after file upload:
 * extractText (via docxParser/pdfParser) → splitClauses → validate output.
 *
 * Run: node test_pipeline.js
 */

const { cleanText } = require('./src/services/textCleaner');
const { splitClauses } = require('./src/services/clauseSplitter');
const path = require('path');
const fs = require('fs');

let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}${detail ? ' → ' + detail : ''}`);
    failed++;
  }
}

// ─── Simulate a real employment contract text ───────────────────────────────
const simulatedRawText = `
\f
                EMPLOYMENT AGREEMENT
                
Page 1 of 5

This Employment Agreement ("Agreement") is made effective as of January 1, 2025, between TechCorp India Pvt. Ltd. ("Company") and Rahul Sharma ("Employee").

1. POSITION AND DUTIES

The Company hereby employs the Employee in the position of Senior Software Engineer. The Employee agrees to devote their full professional time and attention to the performance of duties assigned by the Company.

2. COMPENSATION

2.1 The Employee shall receive a gross annual salary of INR 18,00,000 (Eighteen Lakh Rupees), payable in equal monthly installments.
2.2 The Company reserves the right to revise the compensation structure at any time without prior notice.

3. NON-COMPETE CLAUSE

3

The Employee agrees that during the term of this Agreement and for a period of three (3) years following termination of employment, the Employee shall not, directly or indirectly, engage in, own, manage, operate, or control any business that competes with the Company in any territory worldwide.

4. INTELLECTUAL PROPERTY

(a) All inventions, discoveries, improvements, and work products conceived, developed, or created by the Employee, whether alone or jointly with others, during the course of employment shall be the sole and exclusive property of the Company.
(b) The Employee agrees to execute any and all documents necessary to assign such intellectual property rights to the Company, including patents, copyrights, and trade secrets.
(c) This clause shall survive termination of this Agreement.

5. CONFIDENTIALITY

The Employee acknowledges that during employment they will have access to confidential and proprietary information of the Company. The Employee agrees to hold all such information in strict confidence and not to disclose it to any third party during or after employment.

6. TERMINATION

The Company may terminate this Agreement immediately and without notice for cause. For purposes of this clause, cause includes but is not limited to: fraud, gross misconduct, criminal conviction, breach of any term of this Agreement. The Employee may terminate with 90 days prior written notice.

7. ARBITRATION AND DISPUTE RESOLUTION

Any dispute arising under this Agreement shall be submitted to binding arbitration. The Company shall have the sole right to appoint the arbitrator. The seat of arbitration shall be determined by the Company at its discretion. The arbitration award shall be final and binding on both parties with no right of appeal.

8. GOVERNING LAW

This Agreement shall be governed by the laws of the State of Delaware, United States of America, notwithstanding the fact that both parties are located in India.

9. DATA AND PRIVACY

The Company may collect, store, and process personal data of the Employee including health records, financial information, and location data. The Employee consents to the collection and sharing of this data with any third party at the Company's discretion, including overseas transfers.

10. AMENDMENT

This Agreement may be amended by the Company at any time and the amended terms shall be binding on the Employee. Notice of amendment shall be deemed given upon posting on the Company intranet.

Page 5 of 5
`.trim();

// ─── Run the pipeline ───────────────────────────────────────────────────────
console.log('\n══ Pipeline: textCleaner ════════════════════════════════');
const cleaned = cleanText(simulatedRawText);

assert('Cleaned text is a string', typeof cleaned === 'string');
assert('Form feeds removed', !cleaned.includes('\f'));
assert('Page number "Page 1 of 5" removed', !cleaned.includes('Page 1 of 5'));
assert('Page number "Page 5 of 5" removed', !cleaned.includes('Page 5 of 5'));
assert('Standalone "3" (orphan page num) removed or merged', !cleaned.match(/^\s*3\s*$/m));
assert('Core contract content preserved', cleaned.includes('EMPLOYMENT AGREEMENT'));
assert('Numbered section content preserved', cleaned.includes('NON-COMPETE CLAUSE'));

console.log('\n══ Pipeline: clauseSplitter ══════════════════════════════');
const clauses = splitClauses(cleaned);

console.log(`  ℹ  Total clauses extracted: ${clauses.length}`);
clauses.forEach((c) => {
  const preview = c.rawText.replace(/\n/g, ' ').substring(0, 80);
  console.log(`     [${c.segmentIndex}] ${preview}…`);
});

assert('Extracted at least 6 clauses', clauses.length >= 6, `got ${clauses.length}`);
assert('All have segmentIndex', clauses.every((c) => typeof c.segmentIndex === 'number'));
assert('All have rawText', clauses.every((c) => c.rawText.length >= 30));
assert('No duplicate indexes', new Set(clauses.map((c) => c.segmentIndex)).size === clauses.length);

// Spot-check that key clause types made it through
const allText = clauses.map((c) => c.rawText).join('\n');
assert('Non-compete captured', allText.toLowerCase().includes('three (3) years') || allText.toLowerCase().includes('non-compete'));
assert('IP clause captured', allText.toLowerCase().includes('intellectual property') || allText.includes('work products'));
assert('Arbitration captured', allText.toLowerCase().includes('arbitration'));
assert('Confidentiality captured', allText.toLowerCase().includes('confidential'));
assert('Governing law captured', allText.toLowerCase().includes('governing law') || allText.toLowerCase().includes('delaware'));
assert('Data/privacy captured', allText.toLowerCase().includes('personal data') || allText.toLowerCase().includes('privacy'));

// ─── Results ────────────────────────────────────────────────────────────────
console.log(`\n══ RESULTS ═══════════════════════════════════════════════`);
console.log(`   Passed: ${passed} | Failed: ${failed} | Total: ${passed + failed}`);
if (failed > 0) {
  console.log('\n🔴 Some pipeline tests failed.');
  process.exit(1);
} else {
  console.log('\n🟢 Full parse pipeline verified!');
}
