const test = require('node:test');
const assert = require('node:assert/strict');
const { redactUrl } = require('../src/utils/redactUrl');

test('drops credentials from a Redis URL', () => {
  const out = redactUrl('rediss://default:s3cretToken@cute-host-123.upstash.io:6379');
  assert.equal(out, 'rediss://cute-host-123.upstash.io:6379');
  assert.doesNotMatch(out, /s3cretToken|default/);
});

test('drops credentials, path and query from a MongoDB URL', () => {
  const out = redactUrl('mongodb+srv://user:pa55word@cluster0.abc.mongodb.net/db?retryWrites=true');
  assert.equal(out, 'mongodb+srv://cluster0.abc.mongodb.net');
});

test('never echoes an unparseable value', () => {
  assert.equal(redactUrl('not a url with secret123'), '<invalid url>');
  assert.equal(redactUrl(undefined), '<invalid url>');
});
