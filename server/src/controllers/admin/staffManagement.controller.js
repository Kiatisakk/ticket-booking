const bcrypt = require('bcrypt');
const prisma = require('../../config/prisma');
const asyncHandler = require('../../utils/asyncHandler');

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

  const existingUser = await prisma.user.findFirst({
    where: { Email: { equals: normalizedEmail, mode: 'insensitive' } }
  });
  if (existingUser) {
    return res.status(400).json({ error: 'User already exists' });
  }

  const staffRole = await prisma.role.findFirst({ where: { RoleName: 'Staff' } });
  if (!staffRole) {
    return res.status(500).json({ error: 'Staff role not found' });
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

  const staff = await prisma.user.findMany({
    where: { RoleID: staffRole.RoleID },
    orderBy: { CreatedAt: 'desc' }
  });

  res.json(staff.map(user => ({
    id: user.UserID,
    fullName: user.FullName,
    email: user.Email,
    createdAt: user.CreatedAt
  })));
});
