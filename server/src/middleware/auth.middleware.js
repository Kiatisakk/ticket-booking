const { createAuthMiddleware, JWT_SECRET } = require('./authFactory');

const baseAuthenticateToken = createAuthMiddleware({
  tokenRequiredMessage: 'Access token required',
  verifyUserExists: true
});

function authenticateToken(req, res, next) {
  return baseAuthenticateToken(req, res, next);
}

module.exports = { authenticateToken, JWT_SECRET };
