/**
 * LexGuard Phase 1 – Standalone Service Tests
 * Tests textCleaner and clauseSplitter without any DB or network.
 * Run: node test_phase1.js
 */

const { cleanText } = require('./src/services/textCleaner');
const { splitClauses } = require('./src/services/clauseSplitter');

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

// ─────────────────────────────────────────────────────────────
// 1. textCleaner tests
// ─────────────────────────────────────────────────────────────
console.log('\n══ textCleaner ══════════════════════════════════════════');

const dirtyText = `\fPAGE 1\n\nThis is a contract.\n\n\n\nPage 2 of 10\n\nSection 2 terms apply.\n\n   12  \n\nFinal clause here.\n`;
const cleaned = cleanText(dirtyText);

assert('Removes form feeds', !cleaned.includes('\f'));
assert('Removes "Page 2 of 10"', !cleaned.includes('Page 2 of 10'));
assert('Removes standalone page number "12"', !cleaned.match(/^\s*12\s*$/m));
assert('Collapses 3+ newlines to max 2', !cleaned.includes('\n\n\n'));
assert('Retains actual content', cleaned.includes('This is a contract.'));
assert('Retains section content', cleaned.includes('Section 2 terms apply.'));
assert('Result is trimmed', cleaned === cleaned.trim());

// ─────────────────────────────────────────────────────────────
// 2. clauseSplitter tests
// ─────────────────────────────────────────────────────────────
console.log('\n══ clauseSplitter ═══════════════════════════════════════');

const sampleContract = `
1. DEFINITIONS

For the purposes of this Agreement, the following terms shall have the meanings set forth below.

2. SCOPE OF WORK

The Contractor agrees to perform software development services as described in Schedule A, attached hereto and incorporated herein by reference.

3. NON-COMPETE

The Employee agrees that during the term of employment and for a period of two (2) years following termination, they shall not engage in any business that competes with the Company within the territory of India.

4. INTELLECTUAL PROPERTY

(a) All work product, inventions, and developments created by the Employee during the course of employment shall be the exclusive property of the Company.
(b) The Employee hereby assigns all rights, title, and interest in such work product to the Company.

5. TERMINATION

Either party may terminate this Agreement with thirty (30) days written notice. The Company may terminate immediately for cause, including but not limited to misconduct or breach of contract terms.

6. ARBITRATION

Any dispute arising out of or in connection with this contract shall be resolved by arbitration in accordance with the rules of the Indian Council of Arbitration, and the seat of arbitration shall be New Delhi.

7. GOVERNING LAW

This Agreement shall be governed by and construed in accordance with the laws of India, without regard to its conflict of law provisions.
`.trim();

const clauses = splitClauses(cleanText(sampleContract));

assert('Returns an array', Array.isArray(clauses));
assert('Extracts at least 5 clauses', clauses.length >= 5, `got ${clauses.length}`);
assert('All clauses have segmentIndex', clauses.every((c) => typeof c.segmentIndex === 'number'));
assert('All clauses have rawText', clauses.every((c) => typeof c.rawText === 'string' && c.rawText.length > 0));
assert('Indexes are sequential starting at 0', clauses[0].segmentIndex === 0);
assert('No clause shorter than 30 chars', clauses.every((c) => c.rawText.length >= 30));
assert(
  'No duplicate segmentIndexes',
  new Set(clauses.map((c) => c.segmentIndex)).size === clauses.length
);

// Check specific clause types detected
const allText = clauses.map((c) => c.rawText).join(' ');
assert('Non-compete content present', allText.includes('two (2) years'));
assert('Arbitration content present', allText.includes('arbitration'));
assert('IP content present', allText.toLowerCase().includes('intellectual property') || allText.includes('work product'));

// ─────────────────────────────────────────────────────────────
// 3. Edge cases
// ─────────────────────────────────────────────────────────────
console.log('\n══ Edge Cases ═══════════════════════════════════════════');

// Empty string
const emptyClauses = splitClauses('');
assert('Empty input returns empty array', emptyClauses.length === 0);

// Very short text (all orphans, should be filtered)
const tinyText = 'Hi.\n\nOk.\n\nYes.';
const tinyClauses = splitClauses(tinyText);
assert('All-short text filtered out', tinyClauses.length === 0);

// Lettered sub-items
const letteredText = `
CONFIDENTIALITY OBLIGATIONS

The receiving party agrees to maintain confidentiality of all disclosed information.

(a) The receiving party shall not disclose confidential information to any third party without prior written consent of the disclosing party.
(b) The receiving party shall use the confidential information solely for the purposes of evaluating the proposed transaction.
`.trim();

const letteredClauses = splitClauses(cleanText(letteredText));
assert('Handles lettered sub-items (a), (b)', letteredClauses.length >= 1);

// ─────────────────────────────────────────────────────────────
// Results
// ─────────────────────────────────────────────────────────────
console.log(`\n══ RESULTS ═══════════════════════════════════════════════`);
console.log(`   Passed: ${passed} | Failed: ${failed} | Total: ${passed + failed}`);

if (failed > 0) {
  console.log('\n🔴 Some tests failed. Check above for details.');
  process.exit(1);
} else {
  console.log('\n🟢 All service tests passed!');
}
