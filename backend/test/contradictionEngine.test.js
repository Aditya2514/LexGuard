const test = require('node:test');
const assert = require('node:assert/strict');
const { extractFactTable } = require('../src/services/deterministicFactExtractor');
const { detectContradictions, SEVERITY } = require('../src/services/crossClauseContradictionEngine');

// The engine logs a summary line per run; keep test output readable.
test.beforeEach(() => { test.mock.method(console, 'log', () => {}); });
test.afterEach(() => { test.mock.restoreAll(); });

const audit = (...texts) => {
  const clauses = texts.map((rawText, segmentIndex) => ({ segmentIndex, rawText }));
  return detectContradictions(extractFactTable(clauses), clauses).findings;
};
const rules = (findings) => findings.map((f) => f.rule);

test('flags milestones that do not add up to the contract value', () => {
  const findings = audit(
    'The total contract value is INR 10,00,000.',
    'Milestone 1: INR 4,00,000 payable on signing.',
    'Milestone 2: INR 5,00,000 payable on delivery.',
  );
  const mismatch = findings.find((f) => f.rule === 'FEE_SUM_MISMATCH');
  assert.ok(mismatch, `expected FEE_SUM_MISMATCH, got ${rules(findings)}`);
  assert.equal(mismatch.severity, SEVERITY.FEE_SUM_MISMATCH);
  assert.deepEqual([...mismatch.clauseRefs].sort(), [0, 1, 2]);
});

test('accepts milestones that add up to the contract value', () => {
  const findings = audit(
    'The total contract value is INR 10,00,000.',
    'Milestone 1: INR 4,00,000 payable on signing.',
    'Milestone 2: INR 6,00,000 payable on delivery.',
  );
  assert.ok(!rules(findings).includes('FEE_SUM_MISMATCH'));
});

test('multiplies monthly installments before comparing with an annual fee', () => {
  const findings = audit(
    'The total annual subscription fee is $120,000.',
    'The fee is payable in monthly installments of $10,000.',
  );
  assert.ok(!rules(findings).includes('FEE_SUM_MISMATCH'));
});

test('flags two different exclusive forums', () => {
  const findings = audit(
    'The courts of Mumbai shall have exclusive jurisdiction.',
    'The parties submit to the exclusive jurisdiction of the courts of Delhi.',
  );
  assert.ok(rules(findings).includes('JURISDICTION_CONFLICT'));
});

test('does not flag a governing country plus a forum city inside it', () => {
  const findings = audit(
    'This Agreement shall be governed by the laws of India and the courts at Mumbai shall have exclusive jurisdiction.',
  );
  assert.ok(!rules(findings).includes('JURISDICTION_CONFLICT'));
});

test('treats Bangalore and Bengaluru as the same forum', () => {
  const findings = audit(
    'The courts of Bangalore shall have exclusive jurisdiction.',
    'Disputes are subject to the exclusive jurisdiction of courts in Bengaluru.',
  );
  assert.ok(!rules(findings).includes('JURISDICTION_CONFLICT'));
});

test('flags auto-renewal alongside a fixed expiry date', () => {
  const findings = audit(
    'This Agreement shall automatically renew for successive one-year terms.',
    'This Agreement shall expire on March 31, 2027.',
  );
  assert.ok(rules(findings).includes('AUTO_RENEWAL_VS_FIXED'));
});

test('flags conflicting late-payment interest rates', () => {
  const findings = audit(
    'Late payments shall accrue interest at 18% per annum.',
    'Overdue amounts carry interest at the rate of 12% per annum.',
  );
  assert.ok(rules(findings).includes('INTEREST_CONTRADICTION'));
});

test('reports nothing for a single unambiguous payment clause', () => {
  assert.deepEqual(audit('The Client shall pay INR 5,00,000 within 30 days of invoice.'), []);
});
