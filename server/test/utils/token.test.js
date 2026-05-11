const test = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_JWT_EXPIRES_IN } = require('../../src/utils/token');

test('JWT expiration defaults to 7 days when not configured', () => {
  assert.equal(DEFAULT_JWT_EXPIRES_IN, process.env.JWT_EXPIRES_IN || '7d');
});
