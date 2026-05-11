const bcrypt = require('bcrypt');
const prisma = require('../config/prisma');
const { signAuthToken } = require('../utils/token');
const { getEventList, invalidateEventListCache } = require('../services/eventListMetrics.service');

function normalizeEmail(email = '') {
  return email.trim().toLowerCase();
}

function publicUser(user) {
  return {
    id: user.UserID,
    fullName: user.FullName,
    email: user.Email,
    role: user.Role.RoleName,
    roleId: user.RoleID
  };
}

async function findUserByEmail(email) {
  return prisma.user.findFirst({
    where: { Email: { equals: normalizeEmail(email), mode: 'insensitive' } },
    include: { Role: true }
  });
}

function compareSeatPosition(a, b) {
  const rowCompare = String(a.RowLabel || '').localeCompare(String(b.RowLabel || ''), undefined, {
    numeric: true,
    sensitivity: 'base'
  });
  if (rowCompare !== 0) return rowCompare;

  return String(a.SeatNumber || '').localeCompare(String(b.SeatNumber || ''), undefined, {
    numeric: true,
    sensitivity: 'base'
  });
}

function parsePagination(query) {
  const page = Math.max(parseInt(query.page || '1', 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(query.pageSize || '10', 10) || 10, 1), 100);
  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
    enabled: query.page !== undefined || query.pageSize !== undefined
  };
}

function sortDirection(value) {
  return String(value).toLowerCase() === 'asc' ? 'asc' : 'desc';
}

function paginationPayload(data, total, page, pageSize) {
  return {
    data,
    page,
    pageSize,
    total,
    totalPages: Math.max(Math.ceil(total / pageSize), 1)
  };
}

function parseCursorPagination(query) {
  const pageSize = Math.min(Math.max(parseInt(query.pageSize || '10', 10) || 10, 1), 100);
  const cursor = query.cursor ? parseInt(query.cursor, 10) : null;
  const direction = query.direction === 'prev' ? 'prev' : 'next';
  return {
    enabled: query.pagination === 'cursor',
    pageSize,
    cursor: Number.isInteger(cursor) ? cursor : null,
    direction
  };
}

async function findManyByIdCursor(model, {
  idField,
  where,
  select,
  include,
  pageSize,
  cursor,
  direction
}) {
  const orderDirection = direction === 'prev' ? 'asc' : 'desc';
  const cursorWhere = cursor
    ? { [idField]: direction === 'prev' ? { gt: cursor } : { lt: cursor } }
    : {};
  const rows = await model.findMany({
    where: { AND: [where || {}, cursorWhere] },
    ...(select ? { select } : {}),
    ...(include ? { include } : {}),
    orderBy: { [idField]: orderDirection },
    take: pageSize + 1
  });

  const hasMore = rows.length > pageSize;
  const pageRows = rows.slice(0, pageSize);
  const data = direction === 'prev' ? pageRows.reverse() : pageRows;
  const first = data[0];
  const last = data[data.length - 1];

  return {
    data,
    hasNextPage: direction === 'prev' ? Boolean(cursor) : hasMore,
    hasPrevPage: direction === 'prev' ? hasMore : Boolean(cursor),
    nextCursor: last ? String(last[idField]) : null,
    prevCursor: first ? String(first[idField]) : null
  };
}

function cursorPayload(data, cursorInfo, pageSize, total = null) {
  return {
    data,
    pageSize,
    total,
    pagination: {
      type: 'cursor',
      nextCursor: cursorInfo.nextCursor,
      prevCursor: cursorInfo.prevCursor,
      hasNextPage: cursorInfo.hasNextPage,
      hasPrevPage: cursorInfo.hasPrevPage
    }
  };
}

// ─── Admin Auth ───────────────────────────────────────────────────────────────

exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await findUserByEmail(normalizedEmail);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.Role || user.Role.RoleName !== 'Admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const validPassword = await bcrypt.compare(password, user.Password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signAuthToken(user);

    res.json({
      message: 'Admin login successful',
      token,
      user: publicUser(user)
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
};

// ─── Staff Auth ───────────────────────────────────────────────────────────────

exports.staffLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await findUserByEmail(normalizedEmail);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.Role || user.Role.RoleName !== 'Staff') {
      return res.status(403).json({ error: 'Staff access required' });
    }

    const validPassword = await bcrypt.compare(password, user.Password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signAuthToken(user);

    res.json({
      message: 'Staff login successful',
      token,
      user: publicUser(user)
    });
  } catch (error) {
    console.error('Staff login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
};

// ─── Staff User Management (Admin Only) ───────────────────────────────────────

exports.addStaffUser = async (req, res) => {
  try {
    const { fullName, email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!fullName || !normalizedEmail || !password) {
      return res.status(400).json({ error: 'Full name, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const existingUser = await findUserByEmail(normalizedEmail);
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
  } catch (error) {
    console.error('Add staff user error:', error);
    res.status(500).json({ error: 'Failed to create staff user' });
  }
};

exports.getAllStaff = async (req, res) => {
  try {
    const staffRole = await prisma.role.findFirst({ where: { RoleName: 'Staff' } });
    if (!staffRole) {
      return res.json([]);
    }

    const staff = await prisma.user.findMany({
      where: { RoleID: staffRole.RoleID },
      orderBy: { CreatedAt: 'desc' }
    });

    const result = staff.map(s => ({
      id: s.UserID,
      fullName: s.FullName,
      email: s.Email,
      createdAt: s.CreatedAt
    }));

    res.json(result);
  } catch (error) {
    console.error('Get all staff error:', error);
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
};

// ─── Admin Events ─────────────────────────────────────────────────────────────

exports.getAllEvents = async (req, res) => {
  try {
    const { search, categoryId } = req.query;
    res.json(await getEventList(prisma, { search, categoryId }));
  } catch (error) {
    console.error('Admin getAllEvents error:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
};

exports.getEventById = async (req, res) => {
  try {
    const event = await prisma.event.findUnique({
      where: { EventID: parseInt(req.params.id) },
      include: {
        Category: true,
        Showtimes: {
          include: { Venue: true },
          orderBy: { StartDateTime: 'asc' }
        }
      }
    });

    if (!event) return res.status(404).json({ error: 'Event not found' });

    const now = new Date();
    const showtimes = await Promise.all(event.Showtimes.map(async s => {
      const capacity = await prisma.seat.count({ where: { VenueID: s.VenueID } });
      const booked   = await prisma.bookingDetail.count({
        where: {
          ShowtimeID: s.ShowtimeID,
          Booking: {
            OR: [
              { Status: { StatusName: 'Completed' } },
              { Status: { StatusName: 'Pending' }, ExpiresAt: { gt: now } }
            ]
          }
        }
      });
      return {
        id:            s.ShowtimeID,
        venueId:       s.VenueID,
        venueName:     s.Venue?.VenueName || '',
        startDateTime: s.StartDateTime,
        basePrice:     Number(s.BasePrice),
        capacity,
        booked,
        remaining:     capacity - booked
      };
    }));

    res.json({
      id:          event.EventID,
      title:       event.Title,
      description: event.Description || '',
      category:    event.Category?.CategoryName || '',
      categoryId:  event.CategoryID,
      showtimes
    });
  } catch (error) {
    console.error('Admin getEventById error:', error);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
};

exports.createEvent = async (req, res) => {
  try {
    const { title, description, categoryId, showtimes = [] } = req.body;

    if (!title?.trim()) return res.status(400).json({ error: 'Event title is required' });
    if (!categoryId) return res.status(400).json({ error: 'Category is required' });

    const parsedCategoryId = parseInt(categoryId);
    const category = await prisma.eventCategory.findUnique({
      where: { CategoryID: parsedCategoryId }
    });
    if (!category) return res.status(400).json({ error: 'Invalid category' });

    const event = await prisma.event.create({
      data: {
        Title:           title.trim(),
        Description:     description?.trim() || '',
        CategoryID:      parsedCategoryId
      }
    });

    if (showtimes.length > 0) {
      for (const s of showtimes) {
        if (parseFloat(s.basePrice) < 0) {
          return res.status(400).json({ error: 'Base price cannot be negative' });
        }
      }
      await prisma.showtime.createMany({
        data: showtimes.map(s => ({
          EventID:       event.EventID,
          VenueID:       parseInt(s.venueId),
          StartDateTime: new Date(s.startDateTime),
          BasePrice:     parseFloat(s.basePrice) || 0
        }))
      });
    }

    invalidateEventListCache();
    res.status(201).json({ message: 'Event created successfully', id: event.EventID });
  } catch (error) {
    console.error('Admin createEvent error:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
};

exports.updateEvent = async (req, res) => {
  try {
    const { title, description, categoryId, showtimes = [], deletedShowtimeIds = [] } = req.body;
    const eventId = parseInt(req.params.id);

    if (!title?.trim()) return res.status(400).json({ error: 'Event title is required' });
    if (!categoryId) return res.status(400).json({ error: 'Category is required' });

    const parsedCategoryId = parseInt(categoryId);
    const category = await prisma.eventCategory.findUnique({
      where: { CategoryID: parsedCategoryId }
    });
    if (!category) return res.status(400).json({ error: 'Invalid category' });

    await prisma.event.update({
      where: { EventID: eventId },
      data: {
        Title:       title.trim(),
        Description: description?.trim() || '',
        CategoryID:  parsedCategoryId
      }
    });

    // Delete removed showtimes (skip if they have bookings)
    for (const stId of deletedShowtimeIds) {
      const hasBookings = await prisma.bookingDetail.count({ where: { ShowtimeID: parseInt(stId) } });
      if (hasBookings === 0) {
        await prisma.showtime.delete({ where: { ShowtimeID: parseInt(stId) } });
      }
    }

    // Validate and upsert showtimes
    for (const s of showtimes) {
      if (parseFloat(s.basePrice) < 0) {
        return res.status(400).json({ error: 'Base price cannot be negative' });
      }
    }
    for (const s of showtimes) {
      if (s.id) {
        await prisma.showtime.update({
          where: { ShowtimeID: parseInt(s.id) },
          data: {
            VenueID:       parseInt(s.venueId),
            StartDateTime: new Date(s.startDateTime),
            BasePrice:     parseFloat(s.basePrice) || 0
          }
        });
      } else {
        await prisma.showtime.create({
          data: {
            EventID:       eventId,
            VenueID:       parseInt(s.venueId),
            StartDateTime: new Date(s.startDateTime),
            BasePrice:     parseFloat(s.basePrice) || 0
          }
        });
      }
    }

    invalidateEventListCache();
    res.json({ message: 'Event updated successfully', id: eventId });
  } catch (error) {
    console.error('Admin updateEvent error:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
};

exports.deleteEvent = async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);

    // RESTRICT: Check if any showtimes have booking details
    const showtimes = await prisma.showtime.findMany({
      where: { EventID: eventId },
      select: { ShowtimeID: true }
    });
    const showtimeIds = showtimes.map(s => s.ShowtimeID);

    if (showtimeIds.length > 0) {
      const bookingDetailCount = await prisma.bookingDetail.count({
        where: { ShowtimeID: { in: showtimeIds } }
      });
      if (bookingDetailCount > 0) {
        return res.status(400).json({ error: 'Cannot delete event with existing bookings' });
      }
    }

    // Safe to delete: Event -> Showtimes will CASCADE, no booking details exist
    await prisma.event.delete({ where: { EventID: eventId } });

    invalidateEventListCache();
    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Admin deleteEvent error:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
};

// ─── Admin Transactions ───────────────────────────────────────────────────────

exports.getAllTransactions = async (req, res) => {
  try {
    const { search, status, method, sortBy } = req.query;
    const { page, pageSize, skip, take, enabled: paginated } = parsePagination(req.query);
    const cursorPage = parseCursorPagination(req.query);
    const direction = sortDirection(req.query.sortOrder);

    const where = {};

    // Resolve status name → StatusID
    if (status && status !== 'All') {
      const payStatus = await prisma.paymentStatus.findFirst({
        where: { StatusName: status }
      });
      if (payStatus) {
        where.StatusID = payStatus.StatusID;
      }
    }

    // Resolve method name → MethodID
    if (method && method !== 'All') {
      const payMethod = await prisma.paymentMethod.findFirst({
        where: { MethodName: { contains: method, mode: 'insensitive' } }
      });
      if (payMethod) {
        where.MethodID = payMethod.MethodID;
      }
    }

    if (search) {
      const searchNum = parseInt(search, 10);
      where.OR = [
        { TransactionID: { contains: search, mode: 'insensitive' } },
        { Booking: { User: { FullName: { contains: search, mode: 'insensitive' } } } },
        { Booking: { User: { Email: { contains: search, mode: 'insensitive' } } } }
      ];
      if (!Number.isNaN(searchNum)) {
        where.OR.push({ BookingID: searchNum });
        where.OR.push({ PaymentID: searchNum });
      }
    }

    const sortMap = {
      bookingId: { BookingID: direction },
      transactionId: { TransactionID: direction },
      amount: { Amount: direction },
      date: { CreatedAt: direction },
      status: { Status: { StatusName: direction } },
      method: { Method: { MethodName: direction } },
      user: { Booking: { User: { FullName: direction } } }
    };
    const orderBy = sortMap[sortBy] || { CreatedAt: 'desc' };

    const query = {
      where,
      select: {
        PaymentID: true,
        BookingID: true,
        TransactionID: true,
        Amount: true,
        PaidAt: true,
        CreatedAt: true,
        Booking: {
          select: {
            User: { select: { FullName: true, Email: true, Role: { select: { RoleName: true } } } }
          }
        },
        Method: { select: { MethodName: true } },
        Status: { select: { StatusName: true } }
      },
      orderBy
    };

    if (cursorPage.enabled) {
      const [cursorResult, total] = await Promise.all([
        findManyByIdCursor(prisma.payment, {
          idField: 'PaymentID',
          where,
          select: query.select,
          pageSize: cursorPage.pageSize,
          cursor: cursorPage.cursor,
          direction: cursorPage.direction
        }),
        prisma.payment.count({ where })
      ]);

      const mapped = cursorResult.data.map(p => ({
        id:            p.PaymentID,
        bookingId:     p.BookingID,
        transactionId: p.TransactionID || `TXN-${p.PaymentID}`,
        amount:        Number(p.Amount),
        method:        p.Method?.MethodName || 'Unknown',
        status:        p.Status?.StatusName || 'Unknown',
        date:          p.PaidAt,
        user:          p.Booking?.User?.FullName || 'Unknown',
        userRole:      p.Booking?.User?.Role?.RoleName || 'Unknown'
      }));

      return res.json(cursorPayload(mapped, cursorResult, cursorPage.pageSize, total));
    }

    if (paginated) {
      query.skip = skip;
      query.take = take;
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany(query),
      paginated ? prisma.payment.count({ where }) : Promise.resolve(null)
    ]);

    const mapped = payments.map(p => ({
      id:            p.PaymentID,
      bookingId:     p.BookingID,
      transactionId: p.TransactionID || `TXN-${p.PaymentID}`,
      amount:        Number(p.Amount),
      method:        p.Method?.MethodName || 'Unknown',
      status:        p.Status?.StatusName || 'Unknown',
      date:          p.PaidAt,
      user:          p.Booking?.User?.FullName || 'Unknown',
      userRole:      p.Booking?.User?.Role?.RoleName || 'Unknown'
    }));

    res.json(paginated ? paginationPayload(mapped, total, page, pageSize) : mapped);
  } catch (error) {
    console.error('Admin getAllTransactions error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
};

// ─── Admin Booking Management ────────────────────────────────────────────────

exports.getAllBookings = async (req, res) => {
  try {
    const { search, status, sortBy } = req.query;
    const { page, pageSize, skip, take, enabled: paginated } = parsePagination(req.query);
    const cursorPage = parseCursorPagination(req.query);
    const direction = sortDirection(req.query.sortOrder);

    const where = {};

    if (status && status !== 'All') {
      const bookingStatus = await prisma.bookingStatus.findFirst({
        where: { StatusName: status }
      });
      if (bookingStatus) {
        where.StatusID = bookingStatus.StatusID;
      }
    }

    if (search) {
      const searchNum = parseInt(search);
      if (!isNaN(searchNum)) {
        where.BookingID = searchNum;
      } else {
        where.User = {
          OR: [
            { FullName: { contains: search, mode: 'insensitive' } },
            { Email: { contains: search, mode: 'insensitive' } }
          ]
        };
      }
    }

    const sortMap = {
      bookingId: { BookingID: direction },
      user: { User: { FullName: direction } },
      amount: { TotalAmount: direction },
      bookingDate: { BookingTimestamp: direction },
      status: { Status: { StatusName: direction } }
    };
    const orderBy = sortMap[sortBy] || { CreatedAt: 'desc' };

    const query = {
      where,
      select: {
        BookingID: true,
        TotalAmount: true,
        BookingTimestamp: true,
        ExpiresAt: true,
        User: { select: { FullName: true, Email: true, Role: { select: { RoleName: true } } } },
        Status: { select: { StatusName: true } },
        BookingDetails: {
          select: {
            Showtime: {
              select: {
                Event: { select: { Title: true, EventID: true } }
              }
            }
          }
        },
        Payment: {
          select: {
            Status: { select: { StatusName: true } },
            Method: { select: { MethodName: true } }
          }
        }
      },
      orderBy
    };

    const mapBookings = bookings => bookings.map(b => {
      const events = [...new Set(
        b.BookingDetails
          .map(d => d.Showtime?.Event?.Title)
          .filter(Boolean)
      )];

      return {
        id: b.BookingID,
        user: b.User?.FullName || 'Unknown',
        userEmail: b.User?.Email || '',
        userRole: b.User?.Role?.RoleName || 'Unknown',
        status: b.Status?.StatusName || 'Unknown',
        totalAmount: Number(b.TotalAmount),
        seatCount: b.BookingDetails.length,
        events: events,
        bookingDate: b.BookingTimestamp,
        expiresAt: b.ExpiresAt,
        paymentStatus: b.Payment?.Status?.StatusName || null,
        paymentMethod: b.Payment?.Method?.MethodName || null
      };
    });

    if (cursorPage.enabled) {
      const [cursorResult, total] = await Promise.all([
        findManyByIdCursor(prisma.booking, {
          idField: 'BookingID',
          where,
          select: query.select,
          pageSize: cursorPage.pageSize,
          cursor: cursorPage.cursor,
          direction: cursorPage.direction
        }),
        prisma.booking.count({ where })
      ]);

      return res.json(cursorPayload(
        mapBookings(cursorResult.data),
        cursorResult,
        cursorPage.pageSize,
        total
      ));
    }

    if (paginated) {
      query.skip = skip;
      query.take = take;
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany(query),
      paginated ? prisma.booking.count({ where }) : Promise.resolve(null)
    ]);

    const mapped = mapBookings(bookings);

    res.json(paginated ? paginationPayload(mapped, total, page, pageSize) : mapped);
  } catch (error) {
    console.error('Admin getAllBookings error:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
};

// ─── Admin User Management ───────────────────────────────────────────────────

exports.getAllUsers = async (req, res) => {
  try {
    const { search, role } = req.query;
    const cursorPage = parseCursorPagination(req.query);
    const where = {};

    if (search) {
      const searchNum = parseInt(search, 10);
      where.OR = [
        { FullName: { contains: search, mode: 'insensitive' } },
        { Email: { contains: search, mode: 'insensitive' } }
      ];
      if (!Number.isNaN(searchNum)) {
        where.OR.push({ UserID: searchNum });
      }
    }

    if (role && role !== 'All') {
      where.Role = { RoleName: role };
    }

    const include = {
      Role: true,
      _count: { select: { Bookings: true } }
    };

    const mapUsers = users => users.map(u => ({
      id: u.UserID,
      fullName: u.FullName,
      email: u.Email,
      role: u.Role?.RoleName || 'Unknown',
      roleId: u.RoleID,
      bookingsCount: u._count.Bookings,
      createdAt: u.CreatedAt
    }));

    if (cursorPage.enabled) {
      const [cursorResult, total] = await Promise.all([
        findManyByIdCursor(prisma.user, {
          idField: 'UserID',
          where,
          include,
          pageSize: cursorPage.pageSize,
          cursor: cursorPage.cursor,
          direction: cursorPage.direction
        }),
        prisma.user.count({ where })
      ]);

      return res.json(cursorPayload(
        mapUsers(cursorResult.data),
        cursorResult,
        cursorPage.pageSize,
        total
      ));
    }

    const users = await prisma.user.findMany({
      where,
      include: {
        Role: true,
        _count: { select: { Bookings: true } }
      },
      orderBy: { CreatedAt: 'desc' }
    });

    const result = mapUsers(users);

    res.json(result);
  } catch (error) {
    console.error('Admin getAllUsers error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

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

    // RESTRICT: Cannot delete user with existing bookings (preserve booking history for reporting)
    const bookingCount = await prisma.booking.count({ where: { UserID: userId } });
    if (bookingCount > 0) {
      return res.status(400).json({ error: 'Cannot delete user with existing booking history' });
    }

    // Delete user (safe - no bookings exist)
    await prisma.user.delete({ where: { UserID: userId } });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Admin deleteUser error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};

exports.updateUserRole = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
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
      return res.status(403).json({ error: 'Cannot change admin role' });
    }

    const role = await prisma.role.findUnique({
      where: { RoleID: parseInt(roleId) }
    });

    if (!role) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    if (role.RoleName === 'Admin') {
      return res.status(403).json({ error: 'Cannot assign admin role' });
    }

    await prisma.user.update({
      where: { UserID: userId },
      data: { RoleID: parseInt(roleId) }
    });

    res.json({ message: 'User role updated successfully', role: role.RoleName });
  } catch (error) {
    console.error('Admin updateUserRole error:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
};

// ─── Admin Lookup Endpoints ───────────────────────────────────────────────────

exports.getCategories = async (req, res) => {
  try {
    const cats = await prisma.eventCategory.findMany({ orderBy: { CategoryID: 'asc' } });
    res.json(cats.map(c => ({ id: c.CategoryID, name: c.CategoryName })));
  } catch (error) {
    console.error('Admin getCategories error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
};

exports.getAdminVenues = async (req, res) => {
  try {
    const venues = await prisma.venue.findMany({ orderBy: { VenueID: 'asc' } });
    const result = await Promise.all(venues.map(async v => ({
      id:       v.VenueID,
      name:     v.VenueName,
      location: v.Location || '',
      capacity: await prisma.seat.count({ where: { VenueID: v.VenueID } })
    })));
    res.json(result);
  } catch (error) {
    console.error('Admin getAdminVenues error:', error);
    res.status(500).json({ error: 'Failed to fetch venues' });
  }
};

exports.createVenue = async (req, res) => {
  try {
    const { name, location } = req.body;
    const venueName = String(name || '').trim();

    if (!venueName) {
      return res.status(400).json({ error: 'Venue name is required' });
    }

    const venue = await prisma.venue.create({
      data: {
        VenueName: venueName,
        Location: String(location || '').trim() || null
      }
    });

    res.status(201).json({
      id: venue.VenueID,
      name: venue.VenueName,
      location: venue.Location || '',
      capacity: 0
    });
  } catch (error) {
    console.error('Admin createVenue error:', error);
    res.status(500).json({ error: 'Failed to create venue' });
  }
};

exports.updateVenue = async (req, res) => {
  try {
    const venueId = parseInt(req.params.id);
    const { name, location } = req.body;
    const venueName = String(name || '').trim();

    if (!venueId || !venueName) {
      return res.status(400).json({ error: 'Valid venue and name are required' });
    }

    const venue = await prisma.venue.update({
      where: { VenueID: venueId },
      data: {
        VenueName: venueName,
        Location: String(location || '').trim() || null
      }
    });
    const capacity = await prisma.seat.count({ where: { VenueID: venueId } });

    res.json({
      id: venue.VenueID,
      name: venue.VenueName,
      location: venue.Location || '',
      capacity
    });
  } catch (error) {
    console.error('Admin updateVenue error:', error);
    res.status(500).json({ error: 'Failed to update venue' });
  }
};

exports.deleteVenue = async (req, res) => {
  try {
    const venueId = parseInt(req.params.id);

    const showtimeCount = await prisma.showtime.count({ where: { VenueID: venueId } });
    if (showtimeCount > 0) {
      return res.status(400).json({ error: 'Cannot delete venue with existing showtimes' });
    }

    await prisma.venue.delete({ where: { VenueID: venueId } });
    res.json({ message: 'Venue deleted successfully' });
  } catch (error) {
    console.error('Admin deleteVenue error:', error);
    res.status(500).json({ error: 'Failed to delete venue' });
  }
};

exports.getVenueSeats = async (req, res) => {
  try {
    const venueId = parseInt(req.params.venueId);
    const seats = await prisma.seat.findMany({
      where: { VenueID: venueId },
      include: { SeatType: true }
    });
    seats.sort(compareSeatPosition);

    const detailCounts = await prisma.bookingDetail.groupBy({
      by: ['SeatID'],
      where: { SeatID: { in: seats.map(seat => seat.SeatID) } },
      _count: { SeatID: true }
    });
    const bookedMap = new Map(detailCounts.map(item => [item.SeatID, item._count.SeatID]));

    res.json(seats.map(seat => ({
      id: seat.SeatID,
      venueId: seat.VenueID,
      seatTypeId: seat.SeatTypeID,
      seatTypeName: seat.SeatType?.TypeName || 'Unknown',
      rowLabel: seat.RowLabel,
      seatNumber: seat.SeatNumber,
      bookingCount: bookedMap.get(seat.SeatID) || 0
    })));
  } catch (error) {
    console.error('Admin getVenueSeats error:', error);
    res.status(500).json({ error: 'Failed to fetch seats' });
  }
};

exports.createSeat = async (req, res) => {
  try {
    const { venueId, seatTypeId, rowLabel, seatNumber } = req.body;
    const parsedVenueId = parseInt(venueId);
    const parsedSeatTypeId = parseInt(seatTypeId);
    const row = String(rowLabel || '').trim().toUpperCase();
    const number = String(seatNumber || '').trim();

    if (!parsedVenueId || !parsedSeatTypeId || !row || !number) {
      return res.status(400).json({ error: 'Venue, seat type, row, and seat number are required' });
    }

    const seat = await prisma.seat.create({
      data: {
        VenueID: parsedVenueId,
        SeatTypeID: parsedSeatTypeId,
        RowLabel: row,
        SeatNumber: number
      },
      include: { SeatType: true }
    });

    res.status(201).json({
      id: seat.SeatID,
      venueId: seat.VenueID,
      seatTypeId: seat.SeatTypeID,
      seatTypeName: seat.SeatType?.TypeName || 'Unknown',
      rowLabel: seat.RowLabel,
      seatNumber: seat.SeatNumber,
      bookingCount: 0
    });
  } catch (error) {
    console.error('Admin createSeat error:', error);
    const message = error.code === 'P2002'
      ? 'Seat row and number already exist for this venue'
      : 'Failed to create seat';
    res.status(error.code === 'P2002' ? 400 : 500).json({ error: message });
  }
};

exports.updateSeat = async (req, res) => {
  try {
    const seatId = parseInt(req.params.id);
    const { seatTypeId, rowLabel, seatNumber } = req.body;
    const parsedSeatTypeId = parseInt(seatTypeId);
    const row = String(rowLabel || '').trim().toUpperCase();
    const number = String(seatNumber || '').trim();

    if (!seatId || !parsedSeatTypeId || !row || !number) {
      return res.status(400).json({ error: 'Seat type, row, and seat number are required' });
    }

    const bookingCount = await prisma.bookingDetail.count({ where: { SeatID: seatId } });
    if (bookingCount > 0) {
      return res.status(400).json({ error: 'Cannot edit a seat that has booking history' });
    }

    const seat = await prisma.seat.update({
      where: { SeatID: seatId },
      data: {
        SeatTypeID: parsedSeatTypeId,
        RowLabel: row,
        SeatNumber: number
      },
      include: { SeatType: true }
    });

    res.json({
      id: seat.SeatID,
      venueId: seat.VenueID,
      seatTypeId: seat.SeatTypeID,
      seatTypeName: seat.SeatType?.TypeName || 'Unknown',
      rowLabel: seat.RowLabel,
      seatNumber: seat.SeatNumber,
      bookingCount: 0
    });
  } catch (error) {
    console.error('Admin updateSeat error:', error);
    const message = error.code === 'P2002'
      ? 'Seat row and number already exist for this venue'
      : 'Failed to update seat';
    res.status(error.code === 'P2002' ? 400 : 500).json({ error: message });
  }
};

exports.deleteSeat = async (req, res) => {
  try {
    const seatId = parseInt(req.params.id);
    const bookingCount = await prisma.bookingDetail.count({ where: { SeatID: seatId } });
    if (bookingCount > 0) {
      return res.status(400).json({ error: 'Cannot delete a seat that has booking history' });
    }

    await prisma.seat.delete({ where: { SeatID: seatId } });
    res.json({ message: 'Seat deleted successfully' });
  } catch (error) {
    console.error('Admin deleteSeat error:', error);
    res.status(500).json({ error: 'Failed to delete seat' });
  }
};

exports.getSystemSettings = async (req, res) => {
  try {
    const [categories, venues, paymentMethods] = await Promise.all([
      prisma.eventCategory.findMany({ orderBy: { CategoryID: 'asc' } }),
      prisma.venue.findMany({ orderBy: { VenueID: 'asc' } }),
      prisma.paymentMethod.findMany({ orderBy: { MethodID: 'asc' } })
    ]);

    res.json({
      categories: categories.map(c => ({
        id: c.CategoryID,
        name: c.CategoryName,
        createdAt: c.CreatedAt
      })),
      venues: venues.map(v => ({
        id: v.VenueID,
        name: v.VenueName,
        location: v.Location
      })),
      paymentMethods: paymentMethods.map(m => ({
        id: m.MethodID,
        name: m.MethodName,
        isActive: m.IsActive
      }))
    });
  } catch (error) {
    console.error('Get system settings error:', error);
    res.status(500).json({ error: 'Failed to fetch system settings' });
  }
};

exports.updatePaymentMethod = async (req, res) => {
  try {
    const methodId = parseInt(req.params.id);
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'isActive must be a boolean' });
    }

    const method = await prisma.paymentMethod.update({
      where: { MethodID: methodId },
      data: { IsActive: isActive }
    });

    res.json({
      id: method.MethodID,
      name: method.MethodName,
      isActive: method.IsActive
    });
  } catch (error) {
    console.error('Update payment method error:', error);
    res.status(500).json({ error: 'Failed to update payment method' });
  }
};

// ─── Report Helpers ───────────────────────────────────────────────────────────

const MONTHS_LABEL = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DATA_START = new Date('2025-05-01T00:00:00.000Z');
const DATA_END   = new Date('2026-06-01T00:00:00.000Z');

/**
 * Calculate date range from startDate/endDate query params.
 * Returns { start, end, months } where months is an array of { year, month }
 * spanning every calendar month in the range. Handles cross-year ranges.
 */
function getDateRange(query) {
  const { startDate, endDate } = query || {};

  let start, end;
  if (startDate && endDate) {
    start = new Date(`${startDate}T00:00:00.000Z`);
    const endParsed = new Date(`${endDate}T00:00:00.000Z`);
    end = new Date(endParsed.getTime() + 24 * 60 * 60 * 1000);
  } else {
    start = DATA_START;
    end = DATA_END;
  }

  // Build months array spanning the full range
  const months = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const endMonth = new Date(end);
  while (cursor < endMonth) {
    months.push({ year: cursor.getUTCFullYear(), month: cursor.getUTCMonth() + 1 });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return { start, end, months };
}

/** Build short month labels like "May'25", "Jun'25", …, "Jan'26" */
function monthLabels(months) {
  const crossYear = months.length > 0 && months[0].year !== months[months.length - 1].year;
  return months.map(m => {
    const label = MONTHS_LABEL[m.month - 1];
    return crossYear ? `${label}'${String(m.year).slice(2)}` : label;
  });
}

// ─── Report KPI ───────────────────────────────────────────────────────────────

function getTimeBucketConfig(start, end) {
  const days = Math.max(1, (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 2) return { grain: 'hour', label: 'Hourly' };
  if (days <= 120) return { grain: 'day', label: 'Daily' };
  return { grain: 'month', label: 'Monthly' };
}

function formatTimeBucket(date, grain) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const hour = date.getUTCHours();

  if (grain === 'hour') {
    return {
      key: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}`,
      label: `${MONTHS_LABEL[month]} ${day} ${String(hour).padStart(2, '0')}:00`
    };
  }

  if (grain === 'day') {
    return {
      key: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      label: `${MONTHS_LABEL[month]} ${day}`
    };
  }

  return {
    key: `${year}-${String(month + 1).padStart(2, '0')}`,
    label: `${MONTHS_LABEL[month]}'${String(year).slice(2)}`
  };
}

exports.getReportKpi = async (req, res) => {
  try {
    const { category, venueId } = req.query;
    const { start, end } = getDateRange(req.query);
    const catFilter = category && category !== 'all' ? category : null;
    const venueFilter = venueId && venueId !== 'all' ? parseInt(venueId) : null;

    const revenueResult = await prisma.$queryRaw`
      SELECT COALESCE(SUM(sub.amount), 0)::float8 as revenue
      FROM (
        SELECT DISTINCT p."PaymentID", p."Amount" as amount
        FROM "Payments" p
        JOIN "Bookings" b ON p."BookingID" = b."BookingID"
        JOIN "BookingDetails" bd ON bd."BookingID" = b."BookingID"
        JOIN "Showtimes" s ON bd."ShowtimeID" = s."ShowtimeID"
        JOIN "Events" e ON s."EventID" = e."EventID"
        JOIN "EventCategories" ec ON e."CategoryID" = ec."CategoryID"
        WHERE p."StatusID" = 2
          AND p."PaidAt" >= ${start}
          AND p."PaidAt" <  ${end}
          AND (${catFilter}::text IS NULL OR ec."CategoryName" = ${catFilter})
          AND (${venueFilter}::int IS NULL OR s."VenueID" = ${venueFilter})
      ) sub
    `;
    const totalRevenue = Number(revenueResult[0]?.revenue ?? 0);

    const bookingsResult = await prisma.$queryRaw`
      SELECT COUNT(bd."DetailID")::int as count
      FROM "BookingDetails" bd
      JOIN "Bookings" b ON bd."BookingID" = b."BookingID"
      JOIN "Showtimes" s ON bd."ShowtimeID" = s."ShowtimeID"
      JOIN "Events" e ON s."EventID" = e."EventID"
      JOIN "EventCategories" ec ON e."CategoryID" = ec."CategoryID"
      WHERE b."StatusID" = 2
        AND b."BookingTimestamp" >= ${start}
        AND b."BookingTimestamp" <  ${end}
        AND (${catFilter}::text IS NULL OR ec."CategoryName" = ${catFilter})
        AND (${venueFilter}::int IS NULL OR s."VenueID" = ${venueFilter})
    `;
    const totalBookings = Number(bookingsResult[0]?.count ?? 0);

    // Per-category analysis (always return all categories for dropdown)
    const categoryAnalysis = await prisma.$queryRaw`
      SELECT
        ec."CategoryName" as category,
        COALESCE(SUM(p."Amount"), 0)::float8 as revenue,
        COUNT(DISTINCT b."BookingID")::int as bookings,
        COUNT(bd."DetailID")::int as tickets
      FROM "Payments" p
      JOIN "Bookings" b ON p."BookingID" = b."BookingID"
      JOIN "BookingDetails" bd ON bd."BookingID" = b."BookingID"
      JOIN "Showtimes" s ON bd."ShowtimeID" = s."ShowtimeID"
      JOIN "Events" e ON s."EventID" = e."EventID"
      JOIN "EventCategories" ec ON e."CategoryID" = ec."CategoryID"
      WHERE p."StatusID" = 2
        AND p."PaidAt" >= ${start}
        AND p."PaidAt" <  ${end}
        AND (${catFilter}::text IS NULL OR ec."CategoryName" = ${catFilter})
        AND (${venueFilter}::int IS NULL OR s."VenueID" = ${venueFilter})
      GROUP BY ec."CategoryName"
      ORDER BY revenue DESC
    `;

    const categories = categoryAnalysis.map(c => ({
      name:     c.category,
      revenue:  Number(c.revenue),
      bookings: Number(c.bookings),
      tickets:  Number(c.tickets)
    }));

    const topCategory = categories[0]?.name || 'N/A';

    res.json({ totalRevenue, totalBookings, topCategory, categories });
  } catch (error) {
    console.error('getReportKpi error:', error);
    res.status(500).json({ error: 'Failed to fetch KPI data' });
  }
};

// ─── Report 1: Revenue by Category ───────────────────────────────────────────

exports.getRevenueByCategory = async (req, res) => {
  try {
    const { category } = req.query;
    const { start, end, months } = getDateRange(req.query);
    const catFilter = category && category !== 'all' ? category : null;

    const rows = await prisma.$queryRaw`
      SELECT
        ec."CategoryName" as category,
        EXTRACT(YEAR FROM p."PaidAt")::int as yr,
        EXTRACT(MONTH FROM p."PaidAt")::int as month,
        COALESCE(SUM(p."Amount"), 0)::float8 as revenue
      FROM "Payments" p
      JOIN "Bookings" b ON p."BookingID" = b."BookingID"
      JOIN "BookingDetails" bd ON bd."BookingID" = b."BookingID"
      JOIN "Showtimes" s ON bd."ShowtimeID" = s."ShowtimeID"
      JOIN "Events" e ON s."EventID" = e."EventID"
      JOIN "EventCategories" ec ON e."CategoryID" = ec."CategoryID"
      WHERE p."StatusID" = 2
        AND p."PaidAt" >= ${start}
        AND p."PaidAt" <  ${end}
        AND (${catFilter}::text IS NULL OR ec."CategoryName" = ${catFilter})
      GROUP BY ec."CategoryName", EXTRACT(YEAR FROM p."PaidAt"), EXTRACT(MONTH FROM p."PaidAt")
      ORDER BY yr, month
    `;

    const labels = monthLabels(months);
    const datasets = { Concert: [], Movie: [], Seminar: [] };

    for (const { year, month } of months) {
      for (const cat of Object.keys(datasets)) {
        const found = rows.find(r => r.category === cat && r.yr === year && r.month === month);
        datasets[cat].push(Number(found?.revenue ?? 0));
      }
    }

    res.json({ labels, datasets });
  } catch (error) {
    console.error('getRevenueByCategory error:', error);
    res.status(500).json({ error: 'Failed to fetch revenue by category' });
  }
};

// ─── Report 3: User Growth ────────────────────────────────────────────────────

exports.getUserGrowth = async (req, res) => {
  try {
    const { start, end, months } = getDateRange(req.query);

    const rows = await prisma.$queryRaw`
      SELECT EXTRACT(YEAR FROM "CreatedAt")::int as yr,
             EXTRACT(MONTH FROM "CreatedAt")::int as month,
             COUNT(*)::int as count
      FROM "Users"
      WHERE "CreatedAt" >= ${start}
        AND "CreatedAt" <  ${end}
      GROUP BY yr, month
      ORDER BY yr, month
    `;

    const labels = monthLabels(months);
    const data = [];
    for (const { year, month } of months) {
      const found = rows.find(r => r.yr === year && r.month === month);
      data.push(Number(found?.count ?? 0));
    }

    res.json({ labels, data });
  } catch (error) {
    console.error('getUserGrowth error:', error);
    res.status(500).json({ error: 'Failed to fetch user growth' });
  }
};

// ─── Report 4: Revenue by Venue ───────────────────────────────────────────────

exports.getRevenueByVenue = async (req, res) => {
  try {
    const { category } = req.query;
    const { start, end, months } = getDateRange(req.query);
    const catFilter = category && category !== 'all' ? category : null;

    const rows = await prisma.$queryRaw`
      SELECT
        v."VenueName" as venue,
        EXTRACT(YEAR FROM p."PaidAt")::int as yr,
        EXTRACT(MONTH FROM p."PaidAt")::int as month,
        COALESCE(SUM(p."Amount"), 0)::float8 as revenue
      FROM "Payments" p
      JOIN "Bookings" b ON p."BookingID" = b."BookingID"
      JOIN "BookingDetails" bd ON bd."BookingID" = b."BookingID"
      JOIN "Showtimes" s ON bd."ShowtimeID" = s."ShowtimeID"
      JOIN "Venues" v ON s."VenueID" = v."VenueID"
      JOIN "Events" e ON s."EventID" = e."EventID"
      JOIN "EventCategories" ec ON e."CategoryID" = ec."CategoryID"
      WHERE p."StatusID" = 2
        AND p."PaidAt" >= ${start}
        AND p."PaidAt" <  ${end}
        AND (${catFilter}::text IS NULL OR ec."CategoryName" = ${catFilter})
      GROUP BY v."VenueName", EXTRACT(YEAR FROM p."PaidAt"), EXTRACT(MONTH FROM p."PaidAt")
      ORDER BY yr, month
    `;

    const allVenues = await prisma.venue.findMany({
      select: { VenueName: true },
      orderBy: { VenueName: 'asc' }
    });
    const venueNames = allVenues.map(venue => venue.VenueName);
    const labels = monthLabels(months);

    const datasets = {};
    for (const vn of venueNames) {
      datasets[vn] = [];
      for (const { year, month } of months) {
        const found = rows.find(r => r.venue === vn && r.yr === year && r.month === month);
        datasets[vn].push(Number(found?.revenue ?? 0));
      }
    }

    res.json({ labels, datasets });
  } catch (error) {
    console.error('getRevenueByVenue error:', error);
    res.status(500).json({ error: 'Failed to fetch revenue by venue' });
  }
};

// ─── Report 5: Bookings by Hour ───────────────────────────────────────────────

exports.getBookingsByHour = async (req, res) => {
  try {
    const { category } = req.query;
    const { start, end } = getDateRange(req.query);
    const catFilter = category && category !== 'all' ? category : null;
    const bucketConfig = getTimeBucketConfig(start, end);
    const truncUnit = bucketConfig.grain;

    const rows = await prisma.$queryRaw`
      SELECT date_trunc(${truncUnit}, p."PaidAt") as bucket,
             COUNT(DISTINCT p."PaymentID")::int as count
      FROM "Payments" p
      JOIN "Bookings" b ON p."BookingID" = b."BookingID"
      JOIN "BookingDetails" bd ON bd."BookingID" = b."BookingID"
      JOIN "Showtimes" s ON bd."ShowtimeID" = s."ShowtimeID"
      JOIN "Events" e ON s."EventID" = e."EventID"
      JOIN "EventCategories" ec ON e."CategoryID" = ec."CategoryID"
      WHERE p."StatusID" = 2
        AND p."PaidAt" >= ${start}
        AND p."PaidAt" <  ${end}
        AND (${catFilter}::text IS NULL OR ec."CategoryName" = ${catFilter})
      GROUP BY bucket
      ORDER BY bucket
    `;

    const labels = rows.map(row => formatTimeBucket(new Date(row.bucket), bucketConfig.grain).label);
    const data = rows.map(row => Number(row.count || 0));

    res.json({ labels, data, granularity: bucketConfig.label });
  } catch (error) {
    console.error('getBookingsByHour error:', error);
    res.status(500).json({ error: 'Failed to fetch bookings by hour' });
  }
};

// ─── Report 6: Booking vs Capacity ───────────────────────────────────────────

exports.getBookingVsCapacity = async (req, res) => {
  try {
    const { category, venueId } = req.query;
    const { start, end } = getDateRange(req.query);
    const catFilter = category && category !== 'all' ? category : null;
    const venueFilter = venueId && venueId !== 'all' ? parseInt(venueId) : null;
    const [completedStatus, successStatus] = await Promise.all([
      prisma.bookingStatus.findFirst({ where: { StatusName: 'Completed' } }),
      prisma.paymentStatus.findFirst({ where: { StatusName: 'Success' } })
    ]);
    const completedStatusId = completedStatus?.StatusID ?? 2;
    const successStatusId = successStatus?.StatusID ?? 2;

    const stWhere = {};
    if (venueFilter) {
      stWhere.StartDateTime = { gte: start };
    } else {
      stWhere.StartDateTime = { gte: start, lt: end };
    }
    if (catFilter) {
      stWhere.Event = { Category: { CategoryName: catFilter } };
    }
    if (venueFilter) {
      stWhere.VenueID = venueFilter;
    }

    let showtimes = await prisma.showtime.findMany({
      where: stWhere,
      include: {
        Event: { include: { Category: true } },
        Venue: {
          include: { Seats: true }
        }
      },
      orderBy: { StartDateTime: 'desc' },
      take: 8
    });

    if (!venueFilter) {
      const venueCoverage = await prisma.venue.findMany({
        where: {
          Showtimes: {
            some: catFilter ? { Event: { Category: { CategoryName: catFilter } } } : {}
          }
        },
        include: {
          Showtimes: {
            where: catFilter ? { Event: { Category: { CategoryName: catFilter } } } : {},
            include: {
              Event: { include: { Category: true } },
              Venue: { include: { Seats: true } }
            },
            orderBy: { StartDateTime: 'desc' },
            take: 1
          }
        }
      });

      const showtimeById = new Map(showtimes.map(showtime => [showtime.ShowtimeID, showtime]));
      for (const venue of venueCoverage) {
        const latestShowtime = venue.Showtimes[0];
        if (latestShowtime && !showtimeById.has(latestShowtime.ShowtimeID)) {
          showtimeById.set(latestShowtime.ShowtimeID, latestShowtime);
        }
      }

      showtimes = [...showtimeById.values()]
        .sort((a, b) => new Date(b.StartDateTime) - new Date(a.StartDateTime));
    }

    const result = await Promise.all(showtimes.map(async st => {
      const capacity = st.Venue?.Seats?.length ?? 0;

      // Count distinct sold seats with completed bookings and successful payments.
      // Historical mock data can contain repeated attempts for the same seat/showtime.
      const soldRows = await prisma.$queryRaw`
        SELECT COUNT(DISTINCT bd."SeatID")::int as sold
        FROM "BookingDetails" bd
        JOIN "Bookings" b ON bd."BookingID" = b."BookingID"
        JOIN "Payments" p ON p."BookingID" = b."BookingID"
        WHERE bd."ShowtimeID" = ${st.ShowtimeID}
          AND b."StatusID" = ${completedStatusId}
          AND p."StatusID" = ${successStatusId}
      `;
      const sold = Math.min(Number(soldRows[0]?.sold ?? 0), capacity);
      const occupancyRatePct = capacity > 0 ? Math.round((sold / capacity) * 10000) / 100 : 0;
      const status = occupancyRatePct >= 100
        ? 'Sold Out'
        : occupancyRatePct >= 80
          ? 'High Occupancy'
          : occupancyRatePct > 0
            ? 'Available'
            : 'No Sales';

      const dateStr = st.StartDateTime
        ? new Date(st.StartDateTime).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
        : '';

      const timeStr = st.StartDateTime
        ? new Date(st.StartDateTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        : '';
      const venueName = st.Venue?.VenueName || 'Unknown';

      return {
        label: `${st.Event?.Title ?? 'Unknown'} - ${dateStr} ${timeStr} - ${venueName}`,
        capacity,
        sold,
        remaining: Math.max(capacity - sold, 0),
        occupancyRatePct,
        status,
        venue: venueName
      };
    }));

    res.json(result.reverse()); // chronological order
  } catch (error) {
    console.error('getBookingVsCapacity error:', error);
    res.status(500).json({ error: 'Failed to fetch booking vs capacity' });
  }
};

// ─── Report 7: Venue Utilization ─────────────────────────────────────────────

exports.getVenueUtilization = async (req, res) => {
  try {
    const { category } = req.query;
    const { start, end } = getDateRange(req.query);
    const catFilter = category && category !== 'all' ? category : null;

    const rows = await prisma.$queryRaw`
      SELECT v."VenueName" as venue,
             ec."CategoryName" as category,
             COUNT(s."ShowtimeID")::int as count
      FROM "Showtimes" s
      JOIN "Venues" v ON s."VenueID" = v."VenueID"
      JOIN "Events" e ON s."EventID" = e."EventID"
      JOIN "EventCategories" ec ON e."CategoryID" = ec."CategoryID"
      WHERE s."StartDateTime" >= ${start}
        AND s."StartDateTime" <  ${end}
        AND (${catFilter}::text IS NULL OR ec."CategoryName" = ${catFilter})
      GROUP BY v."VenueName", ec."CategoryName"
    `;

    const venues     = [...new Set(rows.map(r => r.venue))].sort();
    const categories = ['Concert', 'Movie', 'Seminar'];

    const datasets = {};
    for (const cat of categories) {
      datasets[cat] = venues.map(v => {
        const found = rows.find(r => r.venue === v && r.category === cat);
        return Number(found?.count ?? 0);
      });
    }

    res.json({ labels: venues, datasets });
  } catch (error) {
    console.error('getVenueUtilization error:', error);
    res.status(500).json({ error: 'Failed to fetch venue utilization' });
  }
};

// ─── Report 8: Seat Type Revenue ─────────────────────────────────────────────

exports.getSeatTypeRevenue = async (req, res) => {
  try {
    const { category } = req.query;
    const { start, end } = getDateRange(req.query);
    const catFilter = category && category !== 'all' ? category : null;

    const rows = await prisma.$queryRaw`
      SELECT
        st."TypeName" as "seatType",
        COUNT(t."TicketID")::int as "totalTicketsSold",
        COALESCE(SUM(t."FinalPrice"), 0)::float8 as "totalRevenue",
        ROUND(AVG(EXTRACT(EPOCH FROM (s."StartDateTime" - b."BookingTimestamp")) / 86400)::numeric, 1)::float8 as "avgDaysInAdvance"
      FROM "SeatTypes" st
      JOIN "Seats" seat ON st."SeatTypeID" = seat."SeatTypeID"
      JOIN "BookingDetails" bd ON seat."SeatID" = bd."SeatID"
      JOIN "Tickets" t ON bd."DetailID" = t."DetailID"
      JOIN "Bookings" b ON bd."BookingID" = b."BookingID"
      JOIN "Showtimes" s ON bd."ShowtimeID" = s."ShowtimeID"
      JOIN "Events" e ON s."EventID" = e."EventID"
      JOIN "EventCategories" ec ON e."CategoryID" = ec."CategoryID"
      WHERE b."StatusID" = 2
        AND s."StartDateTime" >= ${start}
        AND s."StartDateTime" <  ${end}
        AND (${catFilter}::text IS NULL OR ec."CategoryName" = ${catFilter})
      GROUP BY st."TypeName"
      ORDER BY "totalRevenue" DESC
    `;

    res.json({
      labels: rows.map(r => r.seatType),
      data: rows.map(r => Number(r.totalRevenue || 0)),
      rows: rows.map(r => ({
        seatType: r.seatType,
        totalTicketsSold: Number(r.totalTicketsSold || 0),
        totalRevenue: Number(r.totalRevenue || 0),
        avgDaysInAdvance: Number(r.avgDaysInAdvance || 0)
      }))
    });
  } catch (error) {
    console.error('getSeatTypeRevenue error:', error);
    res.status(500).json({ error: 'Failed to fetch seat type velocity' });
  }
};

// ─── Report 9: Customer Retention ────────────────────────────────────────────

exports.getCustomerRetention = async (req, res) => {
  try {
    const { category } = req.query;
    const { start, end } = getDateRange(req.query);
    const catFilter = category && category !== 'all' ? category : null;

    const rows = await prisma.$queryRaw`
      WITH booking_scope AS (
        SELECT DISTINCT b."BookingID", b."UserID", p."Amount"::float8 as amount
        FROM "Bookings" b
        JOIN "Payments" p ON p."BookingID" = b."BookingID"
        JOIN "BookingDetails" bd ON bd."BookingID" = b."BookingID"
        JOIN "Showtimes" s ON bd."ShowtimeID" = s."ShowtimeID"
        JOIN "Events" e ON s."EventID" = e."EventID"
        JOIN "EventCategories" ec ON e."CategoryID" = ec."CategoryID"
        WHERE p."StatusID" = 2
          AND p."PaidAt" >= ${start}
          AND p."PaidAt" <  ${end}
          AND (${catFilter}::text IS NULL OR ec."CategoryName" = ${catFilter})
      ),
      user_counts AS (
        SELECT "UserID", COUNT(*)::int as booking_count
        FROM booking_scope
        GROUP BY "UserID"
      )
      SELECT
        CASE WHEN uc.booking_count > 1 THEN 'Repeat Customers' ELSE 'One-time Customers' END as type,
        COALESCE(SUM(bs.amount), 0)::float8 as revenue,
        COUNT(DISTINCT bs."UserID")::int as users,
        COUNT(DISTINCT bs."BookingID")::int as bookings
      FROM booking_scope bs
      JOIN user_counts uc ON uc."UserID" = bs."UserID"
      GROUP BY type
    `;

    const result = {};
    for (const r of rows) {
      result[r.type] = {
        revenue: Number(r.revenue || 0),
        users: Number(r.users || 0),
        bookings: Number(r.bookings || 0)
      };
    }

    const repeat  = result['Repeat Customers']?.users ?? 0;
    const oneTime = result['One-time Customers']?.users ?? 0;
    const total   = repeat + oneTime;

    res.json({
      labels: ['Repeat Customers', 'One-time Customers'],
      data:   [repeat, oneTime],
      total,
      rows: [
        { segment: 'Repeat Customers', ...(result['Repeat Customers'] || { revenue: 0, users: 0, bookings: 0 }) },
        { segment: 'One-time Customers', ...(result['One-time Customers'] || { revenue: 0, users: 0, bookings: 0 }) }
      ]
    });
  } catch (error) {
    console.error('getCustomerRetention error:', error);
    res.status(500).json({ error: 'Failed to fetch customer retention' });
  }
};

// ─── Report 10: Interest by Category ─────────────────────────────────────────

exports.getInterestByCategory = async (req, res) => {
  try {
    const { category } = req.query;
    const { start, end, months } = getDateRange(req.query);
    const catFilter = category && category !== 'all' ? category : null;

    const rows = await prisma.$queryRaw`
      SELECT ec."CategoryName" as category,
             EXTRACT(YEAR FROM b."BookingTimestamp")::int as yr,
             EXTRACT(MONTH FROM b."BookingTimestamp")::int as month,
             COUNT(bd."DetailID")::int as count
      FROM "BookingDetails" bd
      JOIN "Bookings" b ON bd."BookingID" = b."BookingID"
      JOIN "Showtimes" s ON bd."ShowtimeID" = s."ShowtimeID"
      JOIN "Events" e ON s."EventID" = e."EventID"
      JOIN "EventCategories" ec ON e."CategoryID" = ec."CategoryID"
      WHERE b."BookingTimestamp" >= ${start}
        AND b."BookingTimestamp" <  ${end}
        AND (${catFilter}::text IS NULL OR ec."CategoryName" = ${catFilter})
      GROUP BY ec."CategoryName", EXTRACT(YEAR FROM b."BookingTimestamp"), EXTRACT(MONTH FROM b."BookingTimestamp")
      ORDER BY yr, month
    `;

    const labels   = monthLabels(months);
    const datasets = { Concert: [], Movie: [], Seminar: [] };

    for (const { year, month } of months) {
      for (const cat of Object.keys(datasets)) {
        const found = rows.find(r => r.category === cat && r.yr === year && r.month === month);
        datasets[cat].push(Number(found?.count ?? 0));
      }
    }

    res.json({ labels, datasets });
  } catch (error) {
    console.error('getInterestByCategory error:', error);
    res.status(500).json({ error: 'Failed to fetch interest by category' });
  }
};

// ─── Report 11: Peak Showtime Hours ──────────────────────────────────────────

exports.getPeakShowtimeHours = async (req, res) => {
  try {
    const { category } = req.query;
    const { start, end } = getDateRange(req.query);
    const catFilter = category && category !== 'all' ? category : null;

    const rows = await prisma.$queryRaw`
      SELECT ec."CategoryName" as category,
             EXTRACT(HOUR FROM s."StartDateTime")::int as hour,
             COUNT(t."TicketID")::int as tickets
      FROM "Tickets" t
      JOIN "BookingDetails" bd ON t."DetailID" = bd."DetailID"
      JOIN "Showtimes" s ON bd."ShowtimeID" = s."ShowtimeID"
      JOIN "Events" e ON s."EventID" = e."EventID"
      JOIN "EventCategories" ec ON e."CategoryID" = ec."CategoryID"
      WHERE s."StartDateTime" >= ${start}
        AND s."StartDateTime" <  ${end}
        AND (${catFilter}::text IS NULL OR ec."CategoryName" = ${catFilter})
      GROUP BY ec."CategoryName", EXTRACT(HOUR FROM s."StartDateTime")
      ORDER BY hour
    `;

    const activeHours = [...new Set(rows.map(row => Number(row.hour)))]
      .filter(hour => Number.isFinite(hour))
      .sort((a, b) => a - b);
    const labels = activeHours.map(hour => `${String(hour).padStart(2, '0')}:00`);
    const datasets = { Concert: [], Movie: [], Seminar: [] };
    const detailRows = [];

    for (const cat of Object.keys(datasets)) {
      for (const hour of activeHours) {
        const found = rows.find(r => r.category === cat && Number(r.hour) === hour);
        const tickets = Number(found?.tickets ?? 0);
        datasets[cat].push(tickets);
        if (tickets > 0) {
          detailRows.push({
            hour: `${String(hour).padStart(2, '0')}:00`,
            category: cat,
            tickets
          });
        }
      }
    }

    res.json({ labels, datasets, rows: detailRows });
  } catch (error) {
    console.error('getPeakShowtimeHours error:', error);
    res.status(500).json({ error: 'Failed to fetch peak showtime hours' });
  }
};

// ─── Report 2: Seat Heatmap ───────────────────────────────────────────────────

exports.getSeatHeatmap = async (req, res) => {
  try {
    const { category, venueId } = req.query;
    const { start, end } = getDateRange(req.query);
    const catFilter = category && category !== 'all' ? category : null;
    const venueFilter = venueId && venueId !== 'all' ? parseInt(venueId) : null;

    const venue = venueFilter
      ? await prisma.venue.findUnique({ where: { VenueID: venueFilter } })
      : await prisma.venue.findFirst({ where: { VenueName: 'Impact Arena' } });

    if (!venue) {
      return res.json({ rows: [], cols: [], data: [] });
    }

    const rows = await prisma.$queryRaw`
      SELECT seat."RowLabel" as rowlabel,
             seat."SeatNumber" as seatnumber,
             COUNT(bd."DetailID")::int as bookings
      FROM "BookingDetails" bd
      JOIN "Bookings" b ON bd."BookingID" = b."BookingID"
      JOIN "Seats" seat ON bd."SeatID" = seat."SeatID"
      JOIN "Venues" v ON seat."VenueID" = v."VenueID"
      JOIN "Showtimes" s ON bd."ShowtimeID" = s."ShowtimeID"
      JOIN "Events" e ON s."EventID" = e."EventID"
      JOIN "EventCategories" ec ON e."CategoryID" = ec."CategoryID"
      WHERE v."VenueID" = ${venue.VenueID}
        AND b."BookingTimestamp" >= ${start}
        AND b."BookingTimestamp" <  ${end}
        AND (${catFilter}::text IS NULL OR ec."CategoryName" = ${catFilter})
      GROUP BY seat."RowLabel", seat."SeatNumber"
      ORDER BY seat."RowLabel", seat."SeatNumber"::int
    `;

    const seats = await prisma.seat.findMany({
      where: { VenueID: venue.VenueID },
      select: { RowLabel: true, SeatNumber: true },
      orderBy: [{ RowLabel: 'asc' }, { SeatNumber: 'asc' }]
    });

    const rowLabels = [...new Set(seats.map(seat => seat.RowLabel))].sort();
    const colLabels = [...new Set(seats.map(seat => String(seat.SeatNumber)))]
      .sort((a, b) => Number(a) - Number(b));

    const data = rowLabels.map(row =>
      colLabels.map(col => {
        const found = rows.find(r => r.rowlabel === row && r.seatnumber === col);
        return Number(found?.bookings ?? 0);
      })
    );

    res.json({ rows: rowLabels, cols: colLabels, data });
  } catch (error) {
    console.error('getSeatHeatmap error:', error);
    res.status(500).json({ error: 'Failed to fetch seat heatmap' });
  }
};

// ─── Report 12: Cancelled Booking Rate ────────────────────────────────────────

function buildCancelRateMatrix(rows, rowKey, colKey, rowLabels, colLabels) {
  return rowLabels.map(rowLabel =>
    colLabels.map(colLabel => {
      const matchingRows = rows.filter(row => row[rowKey] === rowLabel && row[colKey] === colLabel);
      const totalBooking = matchingRows.reduce((sum, row) => sum + Number(row.totalBooking || 0), 0);
      const cancelledCount = matchingRows.reduce((sum, row) => sum + Number(row.cancelledCount || 0), 0);
      return totalBooking ? Math.round((cancelledCount / totalBooking) * 10000) / 100 : 0;
    })
  );
}

exports.getCancellationHeatmap = async (req, res) => {
  try {
    const { category, venueId } = req.query;
    const { start, end } = getDateRange(req.query);
    const catFilter = category && category !== 'all' ? category : null;
    const venueFilter = venueId && venueId !== 'all' ? parseInt(venueId) : null;

    const rows = await prisma.$queryRaw`
      SELECT
        v."VenueName" as "venueName",
        st."TypeName" as "seatType",
        e."Title" as "eventTitle",
        EXTRACT(YEAR FROM b."BookingTimestamp")::int as "bookingYear",
        EXTRACT(MONTH FROM b."BookingTimestamp")::int as "bookingMonth",
        EXTRACT(HOUR FROM s."StartDateTime")::int as "showtimeHour",
        COUNT(bd."DetailID")::int as "totalBooking",
        SUM(CASE WHEN bs."StatusName" = 'Cancelled' THEN 1 ELSE 0 END)::int as "cancelledCount",
        ROUND(
          (SUM(CASE WHEN bs."StatusName" = 'Cancelled' THEN 1 ELSE 0 END)::numeric
            / NULLIF(COUNT(bd."DetailID"), 0) * 100),
          2
        )::float8 as "cancelRatePercentage"
      FROM "BookingDetails" bd
      JOIN "Bookings" b ON bd."BookingID" = b."BookingID"
      JOIN "BookingStatuses" bs ON b."StatusID" = bs."StatusID"
      JOIN "Seats" seat ON bd."SeatID" = seat."SeatID"
      JOIN "SeatTypes" st ON seat."SeatTypeID" = st."SeatTypeID"
      JOIN "Showtimes" s ON bd."ShowtimeID" = s."ShowtimeID"
      JOIN "Venues" v ON s."VenueID" = v."VenueID"
      JOIN "Events" e ON s."EventID" = e."EventID"
      JOIN "EventCategories" ec ON e."CategoryID" = ec."CategoryID"
      WHERE b."BookingTimestamp" >= ${start}
        AND b."BookingTimestamp" <  ${end}
        AND (${catFilter}::text IS NULL OR ec."CategoryName" = ${catFilter})
        AND (${venueFilter}::int IS NULL OR v."VenueID" = ${venueFilter})
      GROUP BY v."VenueName", st."TypeName", e."Title",
        EXTRACT(YEAR FROM b."BookingTimestamp"),
        EXTRACT(MONTH FROM b."BookingTimestamp"),
        EXTRACT(HOUR FROM s."StartDateTime")
      ORDER BY "cancelRatePercentage" DESC, v."VenueName", st."TypeName", "bookingYear", "bookingMonth"
    `;

    const normalizedRows = rows.map(row => ({
      venueName: row.venueName,
      seatType: row.seatType,
      eventTitle: row.eventTitle,
      bookingYear: Number(row.bookingYear),
      bookingMonth: Number(row.bookingMonth),
      monthLabel: new Date(Number(row.bookingYear), Number(row.bookingMonth) - 1, 1)
        .toLocaleString('en-US', { month: 'short', year: '2-digit' })
        .replace(' ', "'"),
      showtimeHour: Number(row.showtimeHour),
      showtimeLabel: `${String(row.showtimeHour).padStart(2, '0')}:00`,
      totalBooking: Number(row.totalBooking || 0),
      cancelledCount: Number(row.cancelledCount || 0),
      cancelRatePercentage: Number(row.cancelRatePercentage || 0)
    }));

    const venues = [...new Set(normalizedRows.map(row => row.venueName))].sort();
    const seatTypes = [...new Set(normalizedRows.map(row => row.seatType))].sort();
    const showtimeLabels = [...new Set(normalizedRows.map(row => row.showtimeLabel))]
      .sort((a, b) => Number(a.slice(0, 2)) - Number(b.slice(0, 2)));
    const monthLabels = [...new Map(
      normalizedRows
        .sort((a, b) => (a.bookingYear - b.bookingYear) || (a.bookingMonth - b.bookingMonth))
        .map(row => [`${row.bookingYear}-${row.bookingMonth}`, row.monthLabel])
    ).values()];

    res.json({
      rows: normalizedRows,
      heatmaps: [
        {
          title: 'Cancellation Rate: Venue vs Seat Type',
          key: 'venue-seat-type',
          rows: seatTypes,
          cols: venues,
          rowLabel: 'Seat Type',
          colLabel: 'Venue',
          tone: 'red',
          data: buildCancelRateMatrix(normalizedRows, 'seatType', 'venueName', seatTypes, venues)
        },
        {
          title: 'Cancellation Rate: Showtime vs Month',
          key: 'showtime-month',
          rows: showtimeLabels,
          cols: monthLabels,
          rowLabel: 'Showtime',
          colLabel: 'Month',
          tone: 'orange',
          data: buildCancelRateMatrix(normalizedRows, 'showtimeLabel', 'monthLabel', showtimeLabels, monthLabels)
        },
        {
          title: 'Cancellation Rate: Venue vs Month',
          key: 'venue-month',
          rows: monthLabels,
          cols: venues,
          rowLabel: 'Month',
          colLabel: 'Venue',
          tone: 'green',
          data: buildCancelRateMatrix(normalizedRows, 'monthLabel', 'venueName', monthLabels, venues)
        },
        {
          title: 'Cancellation Rate: Venue vs Showtime',
          key: 'venue-showtime',
          rows: showtimeLabels,
          cols: venues,
          rowLabel: 'Showtime',
          colLabel: 'Venue',
          tone: 'purple',
          data: buildCancelRateMatrix(normalizedRows, 'showtimeLabel', 'venueName', showtimeLabels, venues)
        }
      ]
    });
  } catch (error) {
    console.error('getCancellationHeatmap error:', error);
    res.status(500).json({ error: 'Failed to fetch cancellation heatmap' });
  }
};
