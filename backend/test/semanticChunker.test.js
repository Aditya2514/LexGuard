const test = require('node:test');
const assert = require('node:assert/strict');
const chunker = require('../src/utils/semanticChunker');
const { splitClauses } = require('../src/services/clauseSplitter');

const withLimit = (maxTokens) => new chunker.constructor(maxTokens);

test('separates section numbers glued to the previous sentence', () => {
  const out = chunker.normalizeText('disputes go to the courts.16. GOVERNING LAW applies.');
  assert.match(out, /courts\.\n{2,}16\. GOVERNING/);
});

test('adds the missing space after a full stop without breaking abbreviations', () => {
  assert.match(chunker.normalizeText('INR 50,00,000.Milestone one'), /50,00,000\. Milestone/);
  assert.match(chunker.normalizeText('incorporated in the U.S.A. under law'), /U\.S\.A\./);
});

test('keeps a heading attached to the clause body that follows it', () => {
  const doc = '1. DEFINITIONS\n\nIn this Agreement, words have their usual meaning.\n\n2. PAYMENT\n\nThe Client shall pay within 30 days.';
  const chunks = chunker.chunkDocument(doc);
  assert.equal(chunks.length, 2);
  assert.match(chunks[0].text, /^1\. DEFINITIONS\n\nIn this Agreement/);
  assert.match(chunks[1].text, /^2\. PAYMENT\n\nThe Client shall pay/);
  assert.ok(chunks.every((c) => c.type === 'semantic_block'));
});

test('splits an oversized block by sentence and stays under the token budget', () => {
  const sentence = 'The Vendor shall maintain records of every deliverable for audit.';
  const block = Array.from({ length: 20 }, () => sentence).join(' ');
  const chunks = withLimit(50).chunkDocument(block);
  assert.ok(chunks.length > 1);
  for (const c of chunks) {
    assert.equal(c.type, 'overflow_block');
    assert.ok(c.text.length <= 50 * 4, `chunk of ${c.text.length} chars exceeds budget`);
  }
});

test('never emits an empty clause when the first sentence alone is over budget', () => {
  const chunks = withLimit(50).chunkDocument('x'.repeat(300) + '. Short tail.');
  assert.ok(chunks.length > 0);
  assert.ok(chunks.every((c) => c.text.length > 0));
});

test('splitClauses numbers clauses in document order', () => {
  const clauses = splitClauses('1. TERM\n\nOne year.\n\n2. FEES\n\nINR 5,00,000.\n\n3. NOTICE\n\nThirty days.');
  assert.deepEqual(clauses.map((c) => c.segmentIndex), [0, 1, 2]);
  assert.match(clauses[2].rawText, /NOTICE/);
});
