const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const { JWT_SECRET } = require('./auth.middleware');

async function authenticateAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Admin access token required' });
  }

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });

    try {
      const adminRole = await prisma.role.findFirst({ where: { RoleName: 'Admin' } });
      if (!adminRole || decoded.role !== adminRole.RoleID) {
        return res.status(403).json({ error: 'Admin role required' });
      }
      req.user = decoded;
      next();
    } catch (dbErr) {
      console.error('Admin auth DB error:', dbErr);
      return res.status(500).json({ error: 'Authentication error' });
    }
  });
}

module.exports = { authenticateAdmin };
