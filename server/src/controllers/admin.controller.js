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
    const mapped = await Promise.all(events.map(async e => {
      const showtime = e.Showtimes?.[0] ?? null;
      const venueID  = showtime?.VenueID ?? null;

      const totalSeats = venueID
        ? await prisma.seat.count({ where: { VenueID: venueID } })
        : 0;

      const bookedCount = showtime
        ? await prisma.bookingDetail.count({ where: { ShowtimeID: showtime.ShowtimeID } })
        : 0;

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
        showtimeId:    showtime?.ShowtimeID ?? null
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

    const showtimes = await Promise.all(event.Showtimes.map(async s => {
      const capacity = await prisma.seat.count({ where: { VenueID: s.VenueID } });
      const booked   = await prisma.bookingDetail.count({ where: { ShowtimeID: s.ShowtimeID } });
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

    const event = await prisma.event.create({
      data: {
        Title:       title.trim(),
        Description: description?.trim() || '',
        CategoryID:  categoryId ? parseInt(categoryId) : null
      }
    });

    if (showtimes.length > 0) {
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

    await prisma.event.update({
      where: { EventID: eventId },
      data: {
        Title:       title.trim(),
        Description: description?.trim() || '',
        CategoryID:  categoryId ? parseInt(categoryId) : null
      }
    });

    // Delete removed showtimes (skip if they have bookings)
    for (const stId of deletedShowtimeIds) {
      const hasBookings = await prisma.bookingDetail.count({ where: { ShowtimeID: parseInt(stId) } });
      if (hasBookings === 0) {
        await prisma.showtime.delete({ where: { ShowtimeID: parseInt(stId) } });
      }
    }

    // Upsert showtimes
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

    await prisma.showtime.deleteMany({ where: { EventID: eventId } });
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

    res.json({ message: 'Payment marked as paid successfully' });
  } catch (error) {
    console.error('Admin markAsPaid error:', error);
    res.status(500).json({ error: 'Failed to mark payment as paid' });
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
const YEAR = 2024;

// ─── Report KPI ───────────────────────────────────────────────────────────────

exports.getReportKpi = async (req, res) => {
  try {
    // Total revenue from successful payments in 2024
    const revenueResult = await prisma.$queryRaw`
      SELECT COALESCE(SUM(p."Amount"), 0) as revenue
      FROM "Payments" p
      WHERE p."StatusID" = 2
        AND EXTRACT(YEAR FROM p."PaidAt") = ${YEAR}
    `;
    const totalRevenue = Number(revenueResult[0]?.revenue ?? 0);

    // Total tickets sold (BookingDetails) for completed bookings in 2024
    const bookingsResult = await prisma.$queryRaw`
      SELECT COUNT(bd."DetailID") as count
      FROM "BookingDetails" bd
      JOIN "Bookings" b ON bd."BookingID" = b."BookingID"
      WHERE b."StatusID" = 2
        AND EXTRACT(YEAR FROM b."BookingTimestamp") = ${YEAR}
    `;
    const totalBookings = Number(bookingsResult[0]?.count ?? 0);

    // Top category by revenue in 2024
    const topCatResult = await prisma.$queryRaw`
      SELECT ec."CategoryName", SUM(p."Amount") as revenue
      FROM "Payments" p
      JOIN "Bookings" b ON p."BookingID" = b."BookingID"
      JOIN "BookingDetails" bd ON bd."BookingID" = b."BookingID"
      JOIN "Showtimes" s ON bd."ShowtimeID" = s."ShowtimeID"
      JOIN "Events" e ON s."EventID" = e."EventID"
      JOIN "EventCategories" ec ON e."CategoryID" = ec."CategoryID"
      WHERE p."StatusID" = 2
        AND EXTRACT(YEAR FROM p."PaidAt") = ${YEAR}
      GROUP BY ec."CategoryName"
      ORDER BY revenue DESC
      LIMIT 1
    `;
    const topCategory = topCatResult[0]?.categoryname || 'N/A';

    res.json({ totalRevenue, totalBookings, topCategory });
  } catch (error) {
    console.error('getReportKpi error:', error);
    res.status(500).json({ error: 'Failed to fetch KPI data' });
  }
};

// ─── Report 1: Revenue by Category ───────────────────────────────────────────

exports.getRevenueByCategory = async (req, res) => {
  try {
    const rows = await prisma.$queryRaw`
      SELECT
        ec."CategoryName",
        EXTRACT(MONTH FROM p."PaidAt") as month,
        COALESCE(SUM(p."Amount"), 0) as revenue
      FROM "Payments" p
      JOIN "Bookings" b ON p."BookingID" = b."BookingID"
      JOIN "BookingDetails" bd ON bd."BookingID" = b."BookingID"
      JOIN "Showtimes" s ON bd."ShowtimeID" = s."ShowtimeID"
      JOIN "Events" e ON s."EventID" = e."EventID"
      JOIN "EventCategories" ec ON e."CategoryID" = ec."CategoryID"
      WHERE p."StatusID" = 2
        AND EXTRACT(YEAR FROM p."PaidAt") = ${YEAR}
      GROUP BY ec."CategoryName", EXTRACT(MONTH FROM p."PaidAt")
      ORDER BY month
    `;

    // Build month-by-month datasets
    const months = MONTHS_LABEL.slice(0, 10); // Jan–Oct for 2024
    const datasets = { Concert: [], Movie: [], Seminar: [] };

    for (let m = 1; m <= 10; m++) {
      for (const cat of Object.keys(datasets)) {
        const found = rows.find(r => r.categoryname === cat && Number(r.month) === m);
        datasets[cat].push(Number(found?.revenue ?? 0));
      }
    }

    res.json({ labels: months, datasets });
  } catch (error) {
    console.error('getRevenueByCategory error:', error);
    res.status(500).json({ error: 'Failed to fetch revenue by category' });
  }
};

// ─── Report 3: User Growth ────────────────────────────────────────────────────

exports.getUserGrowth = async (req, res) => {
  try {
    const rows = await prisma.$queryRaw`
      SELECT EXTRACT(MONTH FROM "CreatedAt") as month, COUNT(*) as count
      FROM "Users"
      WHERE EXTRACT(YEAR FROM "CreatedAt") = ${YEAR}
      GROUP BY month
      ORDER BY month
    `;

    const months = MONTHS_LABEL.slice(0, 10);
    const data = [];
    for (let m = 1; m <= 10; m++) {
      const found = rows.find(r => Number(r.month) === m);
      data.push(Number(found?.count ?? 0));
    }

    res.json({ labels: months, data });
  } catch (error) {
    console.error('getUserGrowth error:', error);
    res.status(500).json({ error: 'Failed to fetch user growth' });
  }
};

// ─── Report 4: Revenue by Venue ───────────────────────────────────────────────

exports.getRevenueByVenue = async (req, res) => {
  try {
    const rows = await prisma.$queryRaw`
      SELECT
        v."VenueName",
        EXTRACT(MONTH FROM p."PaidAt") as month,
        COALESCE(SUM(p."Amount"), 0) as revenue
      FROM "Payments" p
      JOIN "Bookings" b ON p."BookingID" = b."BookingID"
      JOIN "BookingDetails" bd ON bd."BookingID" = b."BookingID"
      JOIN "Showtimes" s ON bd."ShowtimeID" = s."ShowtimeID"
      JOIN "Venues" v ON s."VenueID" = v."VenueID"
      WHERE p."StatusID" = 2
        AND EXTRACT(YEAR FROM p."PaidAt") = ${YEAR}
      GROUP BY v."VenueName", EXTRACT(MONTH FROM p."PaidAt")
      ORDER BY month
    `;

    // Collect all unique venue names from result
    const venueNames = [...new Set(rows.map(r => r.venuename))].sort();
    const months = MONTHS_LABEL.slice(0, 10);

    const datasets = {};
    for (const vn of venueNames) {
      datasets[vn] = [];
      for (let m = 1; m <= 10; m++) {
        const found = rows.find(r => r.venuename === vn && Number(r.month) === m);
        datasets[vn].push(Number(found?.revenue ?? 0));
      }
    }

    res.json({ labels: months, datasets });
  } catch (error) {
    console.error('getRevenueByVenue error:', error);
    res.status(500).json({ error: 'Failed to fetch revenue by venue' });
  }
};

// ─── Report 5: Bookings by Hour ───────────────────────────────────────────────

exports.getBookingsByHour = async (req, res) => {
  try {
    const rows = await prisma.$queryRaw`
      SELECT EXTRACT(HOUR FROM p."PaidAt") as hour, COUNT(*) as count
      FROM "Payments" p
      WHERE p."StatusID" = 2
        AND EXTRACT(YEAR FROM p."PaidAt") = ${YEAR}
      GROUP BY hour
      ORDER BY hour
    `;

    const labels = [];
    const data   = [];
    for (let h = 0; h < 24; h++) {
      labels.push(String(h).padStart(2, '0'));
      const found = rows.find(r => Number(r.hour) === h);
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
    const showtimes = await prisma.showtime.findMany({
      where: { StartDateTime: { lt: new Date() } },
      include: {
        Event: true,
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
        SELECT COUNT(bd."DetailID") as sold
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
    const rows = await prisma.$queryRaw`
      SELECT v."VenueName", ec."CategoryName", COUNT(s."ShowtimeID") as count
      FROM "Showtimes" s
      JOIN "Venues" v ON s."VenueID" = v."VenueID"
      JOIN "Events" e ON s."EventID" = e."EventID"
      JOIN "EventCategories" ec ON e."CategoryID" = ec."CategoryID"
      WHERE s."StartDateTime" < NOW()
      GROUP BY v."VenueName", ec."CategoryName"
    `;

    const venues     = [...new Set(rows.map(r => r.venuename))].sort();
    const categories = ['Concert', 'Movie', 'Seminar'];

    const datasets = {};
    for (const cat of categories) {
      datasets[cat] = venues.map(v => {
        const found = rows.find(r => r.venuename === v && r.categoryname === cat);
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
    const rows = await prisma.$queryRaw`
      SELECT st."TypeName", COALESCE(SUM(t."FinalPrice"), 0) as revenue
      FROM "Tickets" t
      JOIN "BookingDetails" bd ON t."DetailID" = bd."DetailID"
      JOIN "Seats" seat ON bd."SeatID" = seat."SeatID"
      JOIN "SeatTypes" st ON seat."SeatTypeID" = st."SeatTypeID"
      JOIN "Bookings" b ON bd."BookingID" = b."BookingID"
      WHERE b."StatusID" = 2
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
    const rows = await prisma.$queryRaw`
      SELECT
        CASE WHEN booking_count > 1 THEN 'Repeat' ELSE 'One-time' END as type,
        COUNT(*) as users
      FROM (
        SELECT "UserID", COUNT(*) as booking_count
        FROM "Bookings"
        WHERE "StatusID" = 2
        GROUP BY "UserID"
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
    const rows = await prisma.$queryRaw`
      SELECT ec."CategoryName",
             EXTRACT(MONTH FROM b."BookingTimestamp") as month,
             COUNT(bd."DetailID") as count
      FROM "BookingDetails" bd
      JOIN "Bookings" b ON bd."BookingID" = b."BookingID"
      JOIN "Showtimes" s ON bd."ShowtimeID" = s."ShowtimeID"
      JOIN "Events" e ON s."EventID" = e."EventID"
      JOIN "EventCategories" ec ON e."CategoryID" = ec."CategoryID"
      WHERE EXTRACT(YEAR FROM b."BookingTimestamp") = ${YEAR}
      GROUP BY ec."CategoryName", month
      ORDER BY month
    `;

    const months   = MONTHS_LABEL.slice(0, 10);
    const datasets = { Concert: [], Movie: [], Seminar: [] };

    for (let m = 1; m <= 10; m++) {
      for (const cat of Object.keys(datasets)) {
        const found = rows.find(r => r.categoryname === cat && Number(r.month) === m);
        datasets[cat].push(Number(found?.count ?? 0));
      }
    }

    res.json({ labels: months, datasets });
  } catch (error) {
    console.error('getInterestByCategory error:', error);
    res.status(500).json({ error: 'Failed to fetch interest by category' });
  }
};

// ─── Report 11: Peak Showtime Hours ──────────────────────────────────────────

exports.getPeakShowtimeHours = async (req, res) => {
  try {
    const rows = await prisma.$queryRaw`
      SELECT ec."CategoryName",
             EXTRACT(HOUR FROM s."StartDateTime") as hour,
             COUNT(t."TicketID") as tickets
      FROM "Tickets" t
      JOIN "BookingDetails" bd ON t."DetailID" = bd."DetailID"
      JOIN "Showtimes" s ON bd."ShowtimeID" = s."ShowtimeID"
      JOIN "Events" e ON s."EventID" = e."EventID"
      JOIN "EventCategories" ec ON e."CategoryID" = ec."CategoryID"
      GROUP BY ec."CategoryName", hour
      ORDER BY hour
    `;

    // Collect all hours present
    const allHours = [...new Set(rows.map(r => Number(r.hour)))].sort((a, b) => a - b);
    const labels   = allHours.map(h => String(h).padStart(2, '0'));
    const datasets = { Concert: [], Movie: [], Seminar: [] };

    for (const h of allHours) {
      for (const cat of Object.keys(datasets)) {
        const found = rows.find(r => r.categoryname === cat && Number(r.hour) === h);
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
    const rows = await prisma.$queryRaw`
      SELECT seat."RowLabel", seat."SeatNumber", COUNT(bd."DetailID") as bookings
      FROM "BookingDetails" bd
      JOIN "Seats" seat ON bd."SeatID" = seat."SeatID"
      JOIN "Venues" v ON seat."VenueID" = v."VenueID"
      WHERE v."VenueName" = 'Impact Arena'
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

// ─── Report 12: Cancellation Heatmap ─────────────────────────────────────────

exports.getCancellationHeatmap = async (req, res) => {
  try {
    const rows = await prisma.$queryRaw`
      SELECT
        st."TypeName" as seattype,
        e."Title" as eventtitle,
        COUNT(CASE WHEN b."StatusID" = 3 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0) as rate
      FROM "BookingDetails" bd
      JOIN "Bookings" b ON bd."BookingID" = b."BookingID"
      JOIN "Seats" seat ON bd."SeatID" = seat."SeatID"
      JOIN "SeatTypes" st ON seat."SeatTypeID" = st."SeatTypeID"
      JOIN "Showtimes" s ON bd."ShowtimeID" = s."ShowtimeID"
      JOIN "Events" e ON s."EventID" = e."EventID"
      WHERE s."StartDateTime" < NOW()
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
    console.error('getCancellationHeatmap error:', error);
    res.status(500).json({ error: 'Failed to fetch cancellation heatmap' });
  }
};
