const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const { JWT_SECRET } = require('../config/auth');

function extractBearerToken(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  return authHeader && authHeader.split(' ')[1];
}

function createAuthMiddleware({
  tokenRequiredMessage = 'Access token required',
  allowedRoles = null,
  roleRequiredMessage = 'Required role missing',
  verifyUserExists = false,
  db = prisma,
  jwtLib = jwt
} = {}) {
  return (req, res, next) => {
    const token = extractBearerToken(req);

    if (!token) {
      return res.status(401).json({ error: tokenRequiredMessage });
    }

    jwtLib.verify(token, JWT_SECRET, async (err, decoded) => {
      if (err) return res.status(403).json({ error: 'Invalid token' });

      try {
        if (verifyUserExists) {
          const user = await db.user.findUnique({ where: { UserID: decoded.userId } });
          if (!user) {
            return res.status(401).json({ error: 'User no longer exists. Please log in again.' });
          }
        }

        if (allowedRoles?.length) {
          const roles = await db.role.findMany({
            where: { RoleName: { in: allowedRoles } },
            select: { RoleID: true }
          });
          const allowedRoleIds = new Set(roles.map(role => role.RoleID));
          if (!allowedRoleIds.has(decoded.role)) {
            return res.status(403).json({ error: roleRequiredMessage });
          }
        }

        req.user = decoded;
        return next();
      } catch (dbErr) {
        console.error('Auth DB error:', dbErr);
        return res.status(500).json({ error: 'Authentication error' });
      }
    });
  };
}

module.exports = { createAuthMiddleware, JWT_SECRET };
