const test = require('node:test');
const assert = require('node:assert/strict');
const { cleanText } = require('../src/services/textCleaner');

test('strips page markers left behind by PDF extraction', () => {
  const raw = '1. TERM\nThis Agreement runs for one year.\nPage 3 of 10\n- 4 -\n12\n2. PAYMENT';
  const out = cleanText(raw);
  assert.doesNotMatch(out, /Page 3 of 10/);
  assert.doesNotMatch(out, /- 4 -/);
  assert.doesNotMatch(out, /^12$/m);
  assert.match(out, /1\. TERM/);
  assert.match(out, /2\. PAYMENT/);
});

test('turns form feeds into line breaks and normalises whitespace', () => {
  const out = cleanText('Clause one.\fClause\t\ttwo   has   gaps.\n\n\n\n   Clause three.   ');
  assert.equal(out, 'Clause one.\nClause two has gaps.\n\nClause three.');
});

test('keeps numbers that are part of a sentence', () => {
  const out = cleanText('The Vendor shall respond within 12 hours.');
  assert.equal(out, 'The Vendor shall respond within 12 hours.');
});
