const test = require('node:test');
const assert = require('node:assert/strict');
const {
  extractFactTable,
  durationToDays,
  parseWordNumber,
} = require('../src/services/deterministicFactExtractor');

const clauses = (...texts) => texts.map((rawText, segmentIndex) => ({ segmentIndex, rawText }));
const factsOf = (type, ...texts) => extractFactTable(clauses(...texts)).facts.filter((f) => f.type === type);

test('parses spelled-out numbers, including Indian units', () => {
  assert.equal(parseWordNumber('seventy-two'), 72);
  assert.equal(parseWordNumber('one hundred'), 100);
  assert.equal(parseWordNumber('two thousand five hundred'), 2500);
  assert.equal(parseWordNumber('five lakh'), 500000);
});

test('normalises durations to days for comparison', () => {
  assert.equal(durationToDays(2, 'weeks'), 14);
  assert.equal(durationToDays(3, 'months'), 90);
  assert.equal(durationToDays(48, 'hours'), 2);
  assert.equal(durationToDays(10, 'business_days'), 14);
});

test('reads Indian-format rupee amounts once, with the clause category', () => {
  const [fee, ...rest] = factsOf('currency', 'The total contract value is INR 50,00,000.');
  assert.equal(rest.length, 0, 'the same amount must not be captured twice');
  assert.equal(fee.value, 5000000);
  assert.equal(fee.unit, 'INR');
  assert.ok(fee.categories.includes('total_fee'));
});

test('reads US dollar amounts', () => {
  const [fee] = factsOf('currency', 'The aggregate fee is $120,000.');
  assert.equal(fee.value, 120000);
  assert.equal(fee.unit, 'USD');
});

test('extracts numeric and spelled-out durations', () => {
  const [numeric] = factsOf('duration', 'The Vendor shall notify the Client within 30 days.');
  assert.equal(numeric.days, 30);
  const [spelled] = factsOf('duration', 'Any breach must be reported within seventy-two hours.');
  assert.equal(spelled.value, 72);
  assert.equal(spelled.unit, 'hours');
  assert.equal(spelled.days, 3);
});

test('only extracts jurisdictions from clauses that discuss jurisdiction', () => {
  const found = factsOf('jurisdiction', 'The courts of Mumbai shall have exclusive jurisdiction.');
  assert.deepEqual(found.map((f) => f.value), ['mumbai']);
  assert.equal(factsOf('jurisdiction', 'The Vendor has an office in Mumbai.').length, 0);
});

test('attributes ownership of deliverables to the right party', () => {
  const [owner] = factsOf('ownership', 'All Deliverables shall be the property of the Client.');
  assert.equal(owner.party, 'client');
  assert.equal(owner.subject, 'deliverables');
});

test('does not treat pre-existing IP as a deliverable', () => {
  const [owner] = factsOf('ownership', 'The Vendor shall retain all right in its pre-existing tools and underlying code.');
  assert.equal(owner.party, 'vendor');
  assert.notEqual(owner.subject, 'deliverables');
});

test('flags auto-renewal language', () => {
  assert.equal(factsOf('auto_renewal', 'This Agreement shall automatically renew for successive one-year terms.').length, 1);
});
