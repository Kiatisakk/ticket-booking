const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth.middleware');

function signAuthToken(user, expiresIn = '7d') {
  return jwt.sign(
    { userId: user.UserID, email: user.Email, role: user.RoleID },
    JWT_SECRET,
    { expiresIn }
  );
}

module.exports = { signAuthToken };
