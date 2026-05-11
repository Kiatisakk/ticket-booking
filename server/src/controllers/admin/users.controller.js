const prisma = require('../../config/prisma');
const asyncHandler = require('../../utils/asyncHandler');
const { findManyHybrid, sortDirection } = require('../../utils/pagination');

function mapUsers(users) {
  return users.map(user => ({
    id: user.UserID,
    fullName: user.FullName,
    email: user.Email,
    role: user.Role?.RoleName || 'Unknown',
    roleId: user.RoleID,
    bookingsCount: user._count.Bookings,
    createdAt: user.CreatedAt
  }));
}

exports.getAllUsers = asyncHandler(async (req, res) => {
  const { search, role, sortBy } = req.query;
  const direction = sortDirection(req.query.sortOrder);
  const where = {};

  if (search) {
    const searchNum = parseInt(search, 10);
    where.OR = [
      { FullName: { contains: search, mode: 'insensitive' } },
      { Email: { contains: search, mode: 'insensitive' } }
    ];
    if (!Number.isNaN(searchNum)) where.OR.push({ UserID: searchNum });
  }

  if (role && role !== 'All') {
    where.Role = { RoleName: role };
  }

  const sortMap = {
    id: { UserID: direction },
    name: { FullName: direction },
    email: { Email: direction },
    role: { Role: { RoleName: direction } },
    registered: { CreatedAt: direction },
    bookings: { Bookings: { _count: direction } }
  };
  const orderBy = sortMap[sortBy] || { CreatedAt: 'desc' };

  const cursorSorts = {
    id: { idField: 'UserID', sortField: 'UserID', valueType: 'number' },
    registered: { idField: 'UserID', sortField: 'CreatedAt', valueType: 'date' }
  };
  const cursorConfig = cursorSorts[sortBy || 'id']
    ? { ...cursorSorts[sortBy || 'id'], sortOrder: direction }
    : null;

  const payload = await findManyHybrid(prisma.user, {
    query: req.query,
    where,
    include: {
      Role: true,
      _count: { select: { Bookings: true } }
    },
    orderBy,
    cursorConfig,
    map: mapUsers
  });

  res.json(payload);
});

exports.deleteUser = asyncHandler(async (req, res) => {
  const userId = parseInt(req.params.id, 10);

  const user = await prisma.user.findUnique({
    where: { UserID: userId },
    include: { Role: true }
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (user.Role?.RoleName === 'Admin') {
    return res.status(403).json({ error: 'Cannot delete admin users' });
  }

  const bookingCount = await prisma.booking.count({ where: { UserID: userId } });
  if (bookingCount > 0) {
    return res.status(400).json({ error: 'Cannot delete user with existing booking history' });
  }

  await prisma.user.delete({ where: { UserID: userId } });
  res.json({ message: 'User deleted successfully' });
});

exports.updateUserRole = asyncHandler(async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const { roleId } = req.body;

  if (!roleId) {
    return res.status(400).json({ error: 'Role is required' });
  }

  const user = await prisma.user.findUnique({
    where: { UserID: userId },
    include: { Role: true }
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (user.Role?.RoleName === 'Admin') {
    return res.status(403).json({ error: 'Cannot change admin user role' });
  }

  const role = await prisma.role.findUnique({ where: { RoleID: parseInt(roleId, 10) } });
  if (!role || role.RoleName === 'Admin') {
    return res.status(400).json({ error: 'Invalid role' });
  }

  await prisma.user.update({
    where: { UserID: userId },
    data: { RoleID: role.RoleID }
  });

  res.json({ message: 'User role updated successfully', role: role.RoleName });
});
