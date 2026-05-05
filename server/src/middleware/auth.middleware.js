const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });

    try {
      // Verify the user still exists in DB (e.g. after a re-seed)
      const user = await prisma.user.findUnique({
        where: { UserID: decoded.userId }
      });
      if (!user) {
        return res.status(401).json({ error: 'User no longer exists. Please log in again.' });
      }
      req.user = decoded;
      next();
    } catch (dbErr) {
      console.error('Auth DB lookup error:', dbErr);
      return res.status(500).json({ error: 'Authentication failed' });
    }
  });
}

module.exports = { authenticateToken, JWT_SECRET };