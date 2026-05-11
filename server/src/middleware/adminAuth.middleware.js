const { createAuthMiddleware } = require('./authFactory');

const baseAuthenticateAdmin = createAuthMiddleware({
  tokenRequiredMessage: 'Admin access token required',
  allowedRoles: ['Admin'],
  roleRequiredMessage: 'Admin role required'
});

function authenticateAdmin(req, res, next) {
  return baseAuthenticateAdmin(req, res, next);
}

module.exports = { authenticateAdmin };
