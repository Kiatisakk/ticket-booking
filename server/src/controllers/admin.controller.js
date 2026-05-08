const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const { JWT_SECRET } = require('../middleware/auth.middleware');

// ─── Admin Auth ───────────────────────────────────────────────────────────────

exports.adminLogin = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { Email: username },
          { FullName: username }
        ]
      },
      include: { Role: true }
    });

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

    const token = jwt.sign(
      { userId: user.UserID, email: user.Email, role: user.RoleID },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      message: 'Admin login successful',
      token,
      user: {
        id: user.UserID,
        fullName: user.FullName,
        email: user.Email,
        role: user.Role.RoleName
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
};

// ─── Staff Auth ───────────────────────────────────────────────────────────────

exports.staffLogin = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { Email: username },
          { FullName: username }
        ]
      },
      include: { Role: true }
    });

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

    const token = jwt.sign(
      { userId: user.UserID, email: user.Email, role: user.RoleID },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      message: 'Staff login successful',
      token,
      user: {
        id: user.UserID,
        fullName: user.FullName,
        email: user.Email,
        role: user.Role.RoleName
      }
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

    if (!fullName || !email || !password) {
      return res.status(400).json({ error: 'Full name, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const existingUser = await prisma.user.findUnique({ where: { Email: email } });
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
        FullName: fullName,
        Email: email,
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
      include: {
        _count: {
          select: { EventsCreatedByUser: true }
        }
      },
      orderBy: { CreatedAt: 'desc' }
    });

    const result = staff.map(s => ({
      id: s.UserID,
      fullName: s.FullName,
      email: s.Email,
      eventsCreated: s._count.EventsCreatedByUser,
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
    const where = {};

    if (search) {
      where.Title = { contains: search, mode: 'insensitive' };
    }
    if (categoryId) {
      where.CategoryID = parseInt(categoryId);
    }

    const events = await prisma.event.findMany({
      where,
      include: {
        Category: true,
        Showtimes: { include: { Venue: true } }
      },
      orderBy: { EventID: 'desc' }
    });

    // Showtime has no TotalSeats/SeatsRemaining/StartTime — use StartDateTime and
    // compute capacity from Seat count for the venue.
    const now = new Date();
    const mapped = await Promise.all(events.map(async e => {
      const showtime = e.Showtimes?.[0] ?? null;
      const venueID  = showtime?.VenueID ?? null;

      const totalSeats = venueID
        ? await prisma.seat.count({ where: { VenueID: venueID } })
        : 0;

      const bookedCount = showtime
        ? await prisma.bookingDetail.count({
            where: {
              ShowtimeID: showtime.ShowtimeID,
              Booking: {
                OR: [
                  { Status: { StatusName: 'Completed' } },
                  { Status: { StatusName: 'Pending' }, ExpiresAt: { gt: now } }
                ]
              }
            }
          })
        : 0;

      // Check if event has any bookings across all showtimes
      const allShowtimeIds = e.Showtimes?.map(s => s.ShowtimeID) || [];
      const totalBookings = allShowtimeIds.length > 0
        ? await prisma.bookingDetail.count({
            where: { ShowtimeID: { in: allShowtimeIds } }
          })
        : 0;

      // Check if ALL showtimes are in the past
      const latestShowtime = e.Showtimes?.length > 0
        ? e.Showtimes.reduce((latest, s) =>
            new Date(s.StartDateTime) > new Date(latest.StartDateTime) ? s : latest
          , e.Showtimes[0])
        : null;
      const isPast = latestShowtime ? new Date(latestShowtime.StartDateTime) < now : false;

      return {
        id:            e.EventID,
        title:         e.Title,
        description:   e.Description,
        category:      e.Category?.CategoryName || 'Uncategorized',
        categoryId:    e.CategoryID,
        basePrice:     Number(showtime?.BasePrice ?? 0),
        venue:         showtime?.Venue?.VenueName ?? '-',
        venueId:       venueID,
        totalSeats,
        seatsRemaining: totalSeats - bookedCount,
        startDateTime: showtime?.StartDateTime ?? null,
        showtimeId:    showtime?.ShowtimeID ?? null,
        isPast,
        hasBookings:   totalBookings > 0,
        latestShowtime: latestShowtime?.StartDateTime ?? null
      };
    }));

    res.json(mapped);
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
        CategoryID:      parsedCategoryId,
        CreatedByUserID: req.user.userId
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

    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Admin deleteEvent error:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
};

// ─── Admin Transactions ───────────────────────────────────────────────────────

exports.getAllTransactions = async (req, res) => {
  try {
    const { search, status, method } = req.query;

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

    const payments = await prisma.payment.findMany({
      where,
      include: {
        Booking: {
          include: {
            User: { select: { FullName: true, Email: true } }
          }
        },
        Method: true,
        Status: true
      },
      orderBy: { CreatedAt: 'desc' }
    });

    let mapped = payments.map(p => ({
      id:            p.PaymentID,
      bookingId:     p.BookingID,
      transactionId: p.TransactionID || `TXN-${p.PaymentID}`,
      amount:        Number(p.Amount),
      method:        p.Method?.MethodName || 'Unknown',
      status:        p.Status?.StatusName || 'Unknown',
      date:          p.PaidAt,
      user:          p.Booking?.User?.FullName || 'Unknown'
    }));

    // Apply search filter (client-side after DB fetch)
    if (search) {
      mapped = mapped.filter(t =>
        t.bookingId?.toString().includes(search) ||
        t.transactionId?.includes(search)
      );
    }

    res.json(mapped);
  } catch (error) {
    console.error('Admin getAllTransactions error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
};

exports.refundTransaction = async (req, res) => {
  try {
    const paymentId = parseInt(req.params.id);

    const payment = await prisma.payment.findUnique({
      where:   { PaymentID: paymentId },
      include: { Status: true }
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    if (payment.Status?.StatusName !== 'Success') {
      return res.status(400).json({ error: 'Only successful payments can be refunded' });
    }

    // Look up Refunded StatusID
    const refundedStatus = await prisma.paymentStatus.findFirst({
      where: { StatusName: 'Refunded' }
    });
    if (!refundedStatus) {
      return res.status(500).json({ error: 'Refunded status not found in DB' });
    }

    // Look up Cancelled BookingStatusID
    const cancelledStatus = await prisma.bookingStatus.findFirst({
      where: { StatusName: 'Cancelled' }
    });

    await prisma.payment.update({
      where: { PaymentID: paymentId },
      data:  { StatusID: refundedStatus.StatusID }
    });

    if (cancelledStatus) {
      await prisma.booking.update({
        where: { BookingID: payment.BookingID },
        data:  { StatusID: cancelledStatus.StatusID }
      });
    }

    // Delete tickets for the refunded booking so they no longer pass verification
    await prisma.ticket.deleteMany({
      where: { Detail: { BookingID: payment.BookingID } }
    });

    res.json({ message: 'Payment refunded successfully' });
  } catch (error) {
    console.error('Admin refundTransaction error:', error);
    res.status(500).json({ error: 'Failed to refund payment' });
  }
};

exports.markAsPaid = async (req, res) => {
  try {
    const paymentId = parseInt(req.params.id);

    const payment = await prisma.payment.findUnique({ where: { PaymentID: paymentId } });
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Look up Success StatusID
    const successStatus = await prisma.paymentStatus.findFirst({
      where: { StatusName: 'Success' }
    });
    if (!successStatus) {
      return res.status(500).json({ error: 'Success status not found in DB' });
    }

    // Look up Completed BookingStatusID
    const completedStatus = await prisma.bookingStatus.findFirst({
      where: { StatusName: 'Completed' }
    });

    await prisma.payment.update({
      where: { PaymentID: paymentId },
      data:  { StatusID: successStatus.StatusID, PaidAt: new Date() }
    });

    if (completedStatus) {
      await prisma.booking.update({
        where: { BookingID: payment.BookingID },
        data:  { StatusID: completedStatus.StatusID }
      });
    }

    // Generate tickets for each seat in the booking (one ticket per BookingDetail)
    const booking = await prisma.booking.findUnique({
      where: { BookingID: payment.BookingID },
      include: {
        BookingDetails: {
          include: {
            Showtime: true,
            Seat: { include: { SeatType: true } },
            Ticket: true
          }
        }
      }
    });

    if (booking) {
      for (const detail of booking.BookingDetails) {
        if (!detail.Ticket) {
          const finalPrice = Number(detail.Showtime.BasePrice) * Number(detail.Seat.SeatType.PriceModifier);
          const timestamp = Date.now().toString(36).toUpperCase();
          const random = Math.random().toString(36).slice(2, 7).toUpperCase();
          const ticketNo = `TKT${timestamp}${random}`.slice(0, 20);
          await prisma.ticket.create({
            data: {
              TicketNo: ticketNo,
              DetailID: detail.DetailID,
              FinalPrice: finalPrice
            }
          });
        }
      }
    }

    res.json({ message: 'Payment marked as paid successfully' });
  } catch (error) {
    console.error('Admin markAsPaid error:', error);
    res.status(500).json({ error: 'Failed to mark payment as paid' });
  }
};

// ─── Admin User Management ───────────────────────────────────────────────────

exports.getAllUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        Role: true,
        _count: { select: { Bookings: true } }
      },
      orderBy: { CreatedAt: 'desc' }
    });

    const result = users.map(u => ({
      id: u.UserID,
      fullName: u.FullName,
      email: u.Email,
      role: u.Role?.RoleName || 'Unknown',
      roleId: u.RoleID,
      bookingsCount: u._count.Bookings,
      createdAt: u.CreatedAt
    }));

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

exports.getReportKpi = async (req, res) => {
  try {
    const { category } = req.query;
    const { start, end } = getDateRange(req.query);
    const catFilter = category && category !== 'all' ? category : null;

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

    const venueNames = [...new Set(rows.map(r => r.venue))].sort();
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

    const rows = await prisma.$queryRaw`
      SELECT EXTRACT(HOUR FROM p."PaidAt")::int as hour,
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
      GROUP BY hour
      ORDER BY hour
    `;

    const labels = [];
    const data   = [];
    for (let h = 0; h < 24; h++) {
      labels.push(String(h).padStart(2, '0'));
      const found = rows.find(r => r.hour === h);
      data.push(Number(found?.count ?? 0));
    }

    res.json({ labels, data });
  } catch (error) {
    console.error('getBookingsByHour error:', error);
    res.status(500).json({ error: 'Failed to fetch bookings by hour' });
  }
};

// ─── Report 6: Booking vs Capacity ───────────────────────────────────────────

exports.getBookingVsCapacity = async (req, res) => {
  try {
    const { category } = req.query;
    const catFilter = category && category !== 'all' ? category : null;

    const stWhere = { StartDateTime: { lt: new Date() } };
    if (catFilter) {
      stWhere.Event = { Category: { CategoryName: catFilter } };
    }

    const showtimes = await prisma.showtime.findMany({
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

    const result = await Promise.all(showtimes.map(async st => {
      const capacity = st.Venue?.Seats?.length ?? 0;

      // Count sold = BookingDetails with a successful payment
      const soldRows = await prisma.$queryRaw`
        SELECT COUNT(bd."DetailID")::int as sold
        FROM "BookingDetails" bd
        JOIN "Bookings" b ON bd."BookingID" = b."BookingID"
        JOIN "Payments" p ON p."BookingID" = b."BookingID"
        WHERE bd."ShowtimeID" = ${st.ShowtimeID}
          AND p."StatusID" = 2
      `;
      const sold = Number(soldRows[0]?.sold ?? 0);

      const dateStr = st.StartDateTime
        ? new Date(st.StartDateTime).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
        : '';

      return {
        label:    `${st.Event?.Title ?? 'Unknown'} - ${dateStr}`,
        capacity,
        sold
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
    const catFilter = category && category !== 'all' ? category : null;

    const rows = await prisma.$queryRaw`
      SELECT v."VenueName" as venue,
             ec."CategoryName" as category,
             COUNT(s."ShowtimeID")::int as count
      FROM "Showtimes" s
      JOIN "Venues" v ON s."VenueID" = v."VenueID"
      JOIN "Events" e ON s."EventID" = e."EventID"
      JOIN "EventCategories" ec ON e."CategoryID" = ec."CategoryID"
      WHERE s."StartDateTime" < NOW()
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
    const catFilter = category && category !== 'all' ? category : null;

    const rows = await prisma.$queryRaw`
      SELECT st."TypeName" as typename,
             COALESCE(SUM(t."FinalPrice"), 0)::float8 as revenue
      FROM "Tickets" t
      JOIN "BookingDetails" bd ON t."DetailID" = bd."DetailID"
      JOIN "Seats" seat ON bd."SeatID" = seat."SeatID"
      JOIN "SeatTypes" st ON seat."SeatTypeID" = st."SeatTypeID"
      JOIN "Bookings" b ON bd."BookingID" = b."BookingID"
      JOIN "Showtimes" s ON bd."ShowtimeID" = s."ShowtimeID"
      JOIN "Events" e ON s."EventID" = e."EventID"
      JOIN "EventCategories" ec ON e."CategoryID" = ec."CategoryID"
      WHERE b."StatusID" = 2
        AND (${catFilter}::text IS NULL OR ec."CategoryName" = ${catFilter})
      GROUP BY st."TypeName"
    `;

    const labels = rows.map(r => r.typename);
    const data   = rows.map(r => Number(r.revenue));
    const total  = data.reduce((a, b) => a + b, 0);

    res.json({ labels, data, total });
  } catch (error) {
    console.error('getSeatTypeRevenue error:', error);
    res.status(500).json({ error: 'Failed to fetch seat type revenue' });
  }
};

// ─── Report 9: Customer Retention ────────────────────────────────────────────

exports.getCustomerRetention = async (req, res) => {
  try {
    const { category } = req.query;
    const catFilter = category && category !== 'all' ? category : null;

    const rows = await prisma.$queryRaw`
      SELECT
        CASE WHEN booking_count > 1 THEN 'Repeat' ELSE 'One-time' END as type,
        COUNT(*)::int as users
      FROM (
        SELECT b."UserID", COUNT(DISTINCT b."BookingID") as booking_count
        FROM "Bookings" b
        JOIN "BookingDetails" bd ON bd."BookingID" = b."BookingID"
        JOIN "Showtimes" s ON bd."ShowtimeID" = s."ShowtimeID"
        JOIN "Events" e ON s."EventID" = e."EventID"
        JOIN "EventCategories" ec ON e."CategoryID" = ec."CategoryID"
        WHERE b."StatusID" = 2
          AND (${catFilter}::text IS NULL OR ec."CategoryName" = ${catFilter})
        GROUP BY b."UserID"
      ) sub
      GROUP BY type
    `;

    const result = {};
    for (const r of rows) {
      result[r.type] = Number(r.users);
    }

    const repeat  = result['Repeat']   ?? 0;
    const oneTime = result['One-time'] ?? 0;
    const total   = repeat + oneTime;

    res.json({
      labels: ['Repeat Customers', 'One-time Customers'],
      data:   [repeat, oneTime],
      total
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
      WHERE (${catFilter}::text IS NULL OR ec."CategoryName" = ${catFilter})
      GROUP BY ec."CategoryName", EXTRACT(HOUR FROM s."StartDateTime")
      ORDER BY hour
    `;

    const fixedHours = [];
    for (let h = 8; h <= 22; h++) fixedHours.push(h);
    const labels   = fixedHours.map(h => String(h).padStart(2, '0') + ':00');
    const datasets = { Concert: [], Movie: [], Seminar: [] };

    for (const h of fixedHours) {
      for (const cat of Object.keys(datasets)) {
        const found = rows.find(r => r.category === cat && r.hour === h);
        datasets[cat].push(Number(found?.tickets ?? 0));
      }
    }

    res.json({ labels, datasets });
  } catch (error) {
    console.error('getPeakShowtimeHours error:', error);
    res.status(500).json({ error: 'Failed to fetch peak showtime hours' });
  }
};

// ─── Report 2: Seat Heatmap ───────────────────────────────────────────────────

exports.getSeatHeatmap = async (req, res) => {
  try {
    const { category } = req.query;
    const catFilter = category && category !== 'all' ? category : null;

    const rows = await prisma.$queryRaw`
      SELECT seat."RowLabel" as rowlabel,
             seat."SeatNumber" as seatnumber,
             COUNT(bd."DetailID")::int as bookings
      FROM "BookingDetails" bd
      JOIN "Seats" seat ON bd."SeatID" = seat."SeatID"
      JOIN "Venues" v ON seat."VenueID" = v."VenueID"
      JOIN "Showtimes" s ON bd."ShowtimeID" = s."ShowtimeID"
      JOIN "Events" e ON s."EventID" = e."EventID"
      JOIN "EventCategories" ec ON e."CategoryID" = ec."CategoryID"
      WHERE v."VenueName" = 'Impact Arena'
        AND (${catFilter}::text IS NULL OR ec."CategoryName" = ${catFilter})
      GROUP BY seat."RowLabel", seat."SeatNumber"
      ORDER BY seat."RowLabel", seat."SeatNumber"::int
    `;

    const rowLabels = ['A','B','C','D','E','F','G'];
    const colLabels = ['1','2','3','4','5','6','7','8','9','10','11','12'];

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

// ─── Report 12: Failed Payment Rate Heatmap ──────────────────────────────────
// % of booking attempts (per seat type × event) where payment Failed.
// Note: rows include both successful bookings (those that went through) AND
// failed attempts on the same seat. The rate = failed / (failed + success).

exports.getCancellationHeatmap = async (req, res) => {
  try {
    // Look up Failed StatusID dynamically (auto-increment safety)
    const failedStatus = await prisma.paymentStatus.findFirst({
      where: { StatusName: 'Failed' }
    });
    const failedStatusId = failedStatus?.StatusID ?? 3;

    const { category } = req.query;
    const catFilter = category && category !== 'all' ? category : null;

    const rows = await prisma.$queryRaw`
      SELECT
        st."TypeName" as seattype,
        e."Title" as eventtitle,
        (COUNT(CASE WHEN p."StatusID" = ${failedStatusId} THEN 1 END) * 100.0 /
          NULLIF(COUNT(*), 0))::float8 as rate
      FROM "BookingDetails" bd
      JOIN "Bookings" b ON bd."BookingID" = b."BookingID"
      JOIN "Payments" p ON p."BookingID" = b."BookingID"
      JOIN "Seats" seat ON bd."SeatID" = seat."SeatID"
      JOIN "SeatTypes" st ON seat."SeatTypeID" = st."SeatTypeID"
      JOIN "Showtimes" s ON bd."ShowtimeID" = s."ShowtimeID"
      JOIN "Events" e ON s."EventID" = e."EventID"
      JOIN "EventCategories" ec ON e."CategoryID" = ec."CategoryID"
      WHERE s."StartDateTime" < NOW()
        AND (${catFilter}::text IS NULL OR ec."CategoryName" = ${catFilter})
      GROUP BY st."TypeName", e."Title"
    `;

    const seatTypes   = ['VIP','Standard','Sofa Bed'];
    const eventTitles = [...new Set(rows.map(r => r.eventtitle))].sort();

    const data = seatTypes.map(st =>
      eventTitles.map(ev => {
        const found = rows.find(r => r.seattype === st && r.eventtitle === ev);
        return found ? Math.round(Number(found.rate) * 10) / 10 : 0;
      })
    );

    res.json({ seatTypes, events: eventTitles, data });
  } catch (error) {
    console.error('getFailedPaymentHeatmap error:', error);
    res.status(500).json({ error: 'Failed to fetch failed payment heatmap' });
  }
};
