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
    roleId: user.RoleID
  };
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

      if (password.length < 6) {
        throw new HttpError(400, 'Password must be at least 6 characters long');
      }

      const existingUser = await users.findByEmail(email);
      if (existingUser) {
        throw new HttpError(400, 'User already exists');
      }

      const customerRole = await roles.findByName('Customer');
      if (!customerRole) {
        throw new HttpError(500, 'Customer role not found in database');
      }

      const hashedPassword = await passwordHasher.hash(password, 10);
      const user = await users.createCustomer({
        fullName,
        email,
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
      const user = await users.findByEmail(email);
      if (!user) {
        throw new HttpError(401, 'Invalid credentials');
      }

      const validPassword = await passwordHasher.compare(password, user.Password);
      if (!validPassword) {
        throw new HttpError(401, 'Invalid credentials');
      }

      return {
        message: 'Login successful',
        token: tokenSigner(user),
        user: toPublicUser(user)
      };
    }
  };
}

module.exports = createAuthService();
module.exports.createAuthService = createAuthService;
