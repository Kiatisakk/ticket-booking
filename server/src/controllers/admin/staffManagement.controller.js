const bcrypt = require('bcrypt');
const prisma = require('../../config/prisma');
const asyncHandler = require('../../utils/asyncHandler');
const { findManyHybrid } = require('../../utils/pagination');

function normalizeEmail(email = '') {
  return email.trim().toLowerCase();
}

exports.addStaffUser = asyncHandler(async (req, res) => {
  const { fullName, email, password } = req.body;
  const normalizedEmail = normalizeEmail(email);

  if (!fullName || !normalizedEmail || !password) {
    return res.status(400).json({ error: 'Full name, email, and password are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  const existingUser = await prisma.user.findUnique({ where: { Email: normalizedEmail } });
  if (existingUser) {
    return res.status(400).json({ error: 'User already exists' });
  }

  const staffRole = await prisma.role.findFirst({ where: { RoleName: 'Staff' } });
  if (!staffRole) {
    const error = new Error('Staff role not found');
    error.statusCode = 500;
    throw error;
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const staffUser = await prisma.user.create({
    data: {
      FullName: fullName.trim(),
      Email: normalizedEmail,
      Password: hashedPassword,
      RoleID: staffRole.RoleID
    }
  });

  res.status(201).json({
    message: 'Staff user created successfully',
    user: {
      id: staffUser.UserID,
      fullName: staffUser.FullName,
      email: staffUser.Email
    }
  });
});

exports.getAllStaff = asyncHandler(async (req, res) => {
  const staffRole = await prisma.role.findFirst({ where: { RoleName: 'Staff' } });
  if (!staffRole) {
    return res.json([]);
  }

  const payload = await findManyHybrid(prisma.user, {
    query: req.query,
    where: { RoleID: staffRole.RoleID },
    orderBy: [{ CreatedAt: 'desc' }, { UserID: 'desc' }],
    cursorConfig: {
      idField: 'UserID',
      sortField: 'CreatedAt',
      sortOrder: 'desc',
      valueType: 'date'
    },
    map: rows => rows.map(user => ({
      id: user.UserID,
      fullName: user.FullName,
      email: user.Email,
      createdAt: user.CreatedAt
    }))
  });
  res.json(payload);
});
