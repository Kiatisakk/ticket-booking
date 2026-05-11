const { createAuthMiddleware } = require('./authFactory');

const baseAuthenticateStaff = createAuthMiddleware({
  tokenRequiredMessage: 'Staff access token required',
  allowedRoles: ['Staff', 'Admin'],
  roleRequiredMessage: 'Staff role required'
});

function authenticateStaff(req, res, next) {
  return baseAuthenticateStaff(req, res, next);
}

module.exports = { authenticateStaff };
