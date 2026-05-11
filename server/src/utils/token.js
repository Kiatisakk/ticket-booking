const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth.middleware');

const DEFAULT_JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function signAuthToken(user, expiresIn = DEFAULT_JWT_EXPIRES_IN) {
  return jwt.sign(
    { userId: user.UserID, email: user.Email, role: user.RoleID },
    JWT_SECRET,
    { expiresIn }
  );
}

module.exports = { signAuthToken, DEFAULT_JWT_EXPIRES_IN };
