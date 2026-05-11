const test = require('node:test');
const assert = require('node:assert/strict');
const { createAuthMiddleware } = require('../../src/middleware/authFactory');

function createRes() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    }
  };
}

test('auth middleware factory rejects missing tokens', () => {
  const middleware = createAuthMiddleware({ tokenRequiredMessage: 'Token needed' });
  const res = createRes();

  middleware({ headers: {} }, res, () => assert.fail('next should not be called'));

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.payload, { error: 'Token needed' });
});

test('auth middleware factory rejects invalid tokens', async () => {
  const middleware = createAuthMiddleware({
    jwtLib: { verify: (_token, _secret, cb) => cb(new Error('bad token')) }
  });
  const res = createRes();

  middleware({ headers: { authorization: 'Bearer nope' } }, res, () => assert.fail('next should not be called'));

  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.payload, { error: 'Invalid token' });
});

test('auth middleware factory allows configured roles', async () => {
  const middleware = createAuthMiddleware({
    allowedRoles: ['Staff', 'Admin'],
    db: {
      role: {
        findMany: async () => [{ RoleID: 1 }, { RoleID: 2 }]
      }
    },
    jwtLib: { verify: (_token, _secret, cb) => cb(null, { userId: 10, role: 2 }) }
  });
  const req = { headers: { authorization: 'Bearer ok' } };
  const res = createRes();
  let nextCalled = false;

  await new Promise(resolve => {
    middleware(req, res, () => {
      nextCalled = true;
      resolve();
    });
  });

  assert.equal(nextCalled, true);
  assert.deepEqual(req.user, { userId: 10, role: 2 });
});

test('auth middleware factory rejects forbidden roles', async () => {
  const middleware = createAuthMiddleware({
    allowedRoles: ['Admin'],
    roleRequiredMessage: 'Admin role required',
    db: {
      role: {
        findMany: async () => [{ RoleID: 1 }]
      }
    },
    jwtLib: { verify: (_token, _secret, cb) => cb(null, { userId: 10, role: 2 }) }
  });
  const res = createRes();

  await new Promise(resolve => {
    middleware({ headers: { authorization: 'Bearer ok' } }, res, () => assert.fail('next should not be called'));
    setImmediate(resolve);
  });

  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.payload, { error: 'Admin role required' });
});
