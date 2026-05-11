const test = require('node:test');
const assert = require('node:assert/strict');
const { createAuthService } = require('../../src/services/auth.service');

test('register creates a customer and returns a token without touching the database directly', async () => {
  const createdUser = {
    UserID: 7,
    FullName: 'Jane Doe',
    Email: 'jane@example.com',
    RoleID: 3
  };

  const service = createAuthService({
    users: {
      findByEmail: async (email) => {
        assert.equal(email, 'jane@example.com');
        return null;
      },
      createCustomer: async (data) => {
        assert.equal(data.roleId, 3);
        assert.equal(data.fullName, 'Jane Doe');
        assert.equal(data.email, 'jane@example.com');
        assert.equal(data.hashedPassword, 'hashed-password');
        return createdUser;
      }
    },
    roles: {
      findByName: async (roleName) => {
        assert.equal(roleName, 'Customer');
        return { RoleID: 3 };
      }
    },
    passwordHasher: {
      hash: async () => 'hashed-password'
    },
    tokenSigner: () => 'signed-token'
  });

  const result = await service.register({
    fullName: ' Jane Doe ',
    email: 'Jane@Example.COM',
    password: 'secret1'
  });

  assert.equal(result.token, 'signed-token');
  assert.deepEqual(result.user, {
    id: 7,
    fullName: 'Jane Doe',
    email: 'jane@example.com',
    roleId: 3
  });
});

test('login normalizes email before lookup', async () => {
  const service = createAuthService({
    users: {
      findByEmail: async (email) => {
        assert.equal(email, 'jane@example.com');
        return {
          UserID: 7,
          FullName: 'Jane Doe',
          Email: 'jane@example.com',
          Password: 'hashed-password',
          RoleID: 3
        };
      }
    },
    passwordHasher: {
      compare: async () => true
    },
    tokenSigner: () => 'signed-token'
  });

  const result = await service.login({
    email: ' Jane@Example.COM ',
    password: 'secret1'
  });

  assert.equal(result.token, 'signed-token');
});

test('login rejects invalid credentials', async () => {
  const service = createAuthService({
    users: {
      findByEmail: async () => null
    }
  });

  await assert.rejects(
    () => service.login({ email: 'missing@example.com', password: 'secret1' }),
    { statusCode: 401, message: 'Invalid credentials' }
  );
});
