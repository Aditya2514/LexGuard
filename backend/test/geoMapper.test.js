const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveJurisdiction } = require('../src/utils/geoMapper');

test('maps a city to its state and municipal body', () => {
  assert.deepEqual(resolveJurisdiction('Courts at Bengaluru'), { state: 'Karnataka', municipality: 'BBMP' });
  assert.deepEqual(resolveJurisdiction('Mumbai, Maharashtra'), { state: 'Maharashtra', municipality: 'BMC' });
});

test('recognises old city names', () => {
  assert.deepEqual(resolveJurisdiction('courts of Bombay'), { state: 'Maharashtra', municipality: 'BMC' });
  assert.deepEqual(resolveJurisdiction('Gurgaon'), { state: 'Haryana', municipality: 'MCG' });
});

test('falls back to state level, then to Central', () => {
  assert.deepEqual(resolveJurisdiction('the laws of Gujarat'), { state: 'Gujarat', municipality: null });
  assert.deepEqual(resolveJurisdiction('the laws of India'), { state: 'Central', municipality: null });
  assert.deepEqual(resolveJurisdiction(undefined), { state: 'Central', municipality: null });
});
