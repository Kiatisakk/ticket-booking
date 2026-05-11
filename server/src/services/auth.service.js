const bcrypt = require('bcrypt');
const HttpError = require('../utils/HttpError');
const { signAuthToken } = require('../utils/token');
const userRepository = require('../repositories/user.repository');
const roleRepository = require('../repositories/role.repository');

function toPublicUser(user) {
  return {
    id: user.UserID,
    fullName: user.FullName,
    email: user.Email,
    ...(user.Role ? { role: user.Role.RoleName } : {}),
    roleId: user.RoleID
  };
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function createAuthService({
  users = userRepository,
  roles = roleRepository,
  passwordHasher = bcrypt,
  tokenSigner = signAuthToken
} = {}) {
  return {
    async register({ fullName, email, password }) {
      if (!fullName || !email || !password) {
        throw new HttpError(400, 'Full name, email, and password are required');
      }

      const normalizedEmail = normalizeEmail(email);

      if (password.length < 6) {
        throw new HttpError(400, 'Password must be at least 6 characters long');
      }

      const existingUser = await users.findByEmail(normalizedEmail);
      if (existingUser) {
        throw new HttpError(400, 'User already exists');
      }

      const customerRole = await roles.findByName('Customer');
      if (!customerRole) {
        throw new HttpError(500, 'Customer role not found in database');
      }

      const hashedPassword = await passwordHasher.hash(password, 10);
      const user = await users.createCustomer({
        fullName: fullName.trim(),
        email: normalizedEmail,
        hashedPassword,
        roleId: customerRole.RoleID
      });

      return {
        message: 'User registered successfully',
        token: tokenSigner(user),
        user: toPublicUser(user)
      };
    },

    async login({ email, password }) {
      return this.loginWithRole({ email, password });
    },

    async loginWithRole({
      email,
      password,
      allowedRoleNames = null,
      forbiddenMessage = 'Required role missing',
      successMessage = 'Login successful'
    }) {
      const normalizedEmail = normalizeEmail(email);
      if (!normalizedEmail || !password) {
        throw new HttpError(400, 'Email and password are required');
      }

      const user = await users.findByEmail(normalizedEmail, { include: { Role: true } });
      if (!user) {
        throw new HttpError(401, 'Invalid credentials');
      }

      const validPassword = await passwordHasher.compare(password, user.Password);
      if (!validPassword) {
        throw new HttpError(401, 'Invalid credentials');
      }

      if (allowedRoleNames?.length && !allowedRoleNames.includes(user.Role?.RoleName)) {
        throw new HttpError(403, forbiddenMessage);
      }

      return {
        message: successMessage,
        token: tokenSigner(user),
        user: toPublicUser(user)
      };
    }
  };
}

module.exports = createAuthService();
module.exports.createAuthService = createAuthService;
