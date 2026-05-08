const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const { JWT_SECRET } = require('./auth.middleware');

async function authenticateStaff(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Staff access token required' });
  }

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });

    try {
      const staffRole = await prisma.role.findFirst({ where: { RoleName: 'Staff' } });
      const adminRole = await prisma.role.findFirst({ where: { RoleName: 'Admin' } });
      
      // Allow both Staff and Admin roles for staff endpoints
      if (!staffRole || !adminRole || (decoded.role !== staffRole.RoleID && decoded.role !== adminRole.RoleID)) {
        return res.status(403).json({ error: 'Staff role required' });
      }
      req.user = decoded;
      next();
    } catch (dbErr) {
      console.error('Staff auth DB error:', dbErr);
      return res.status(500).json({ error: 'Authentication error' });
    }
  });
}

module.exports = { authenticateStaff };
