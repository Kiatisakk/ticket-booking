const prisma = require('../../config/prisma');
const asyncHandler = require('../../utils/asyncHandler');

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

exports.getReportKpi = asyncHandler(async (req, res) => {
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
});

// ─── Report 1: Revenue by Category ───────────────────────────────────────────

exports.getRevenueByCategory = asyncHandler(async (req, res) => {
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
});

// ─── Report 3: User Growth ────────────────────────────────────────────────────

exports.getUserGrowth = asyncHandler(async (req, res) => {
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
});

// ─── Report 4: Revenue by Venue ───────────────────────────────────────────────

exports.getRevenueByVenue = asyncHandler(async (req, res) => {
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
});

// ─── Report 5: Bookings by Hour ───────────────────────────────────────────────

exports.getBookingsByHour = asyncHandler(async (req, res) => {
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
});

// ─── Report 6: Booking vs Capacity ───────────────────────────────────────────

exports.getBookingVsCapacity = asyncHandler(async (req, res) => {
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
});

// ─── Report 7: Venue Utilization ─────────────────────────────────────────────

exports.getVenueUtilization = asyncHandler(async (req, res) => {
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
});

// ─── Report 8: Seat Type Revenue ─────────────────────────────────────────────

exports.getSeatTypeRevenue = asyncHandler(async (req, res) => {
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
});

// ─── Report 9: Customer Retention ────────────────────────────────────────────

exports.getCustomerRetention = asyncHandler(async (req, res) => {
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
});

// ─── Report 10: Interest by Category ─────────────────────────────────────────

exports.getInterestByCategory = asyncHandler(async (req, res) => {
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
});

// ─── Report 11: Peak Showtime Hours ──────────────────────────────────────────

exports.getPeakShowtimeHours = asyncHandler(async (req, res) => {
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
});

// ─── Report 2: Seat Heatmap ───────────────────────────────────────────────────

exports.getSeatHeatmap = asyncHandler(async (req, res) => {
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
});

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

exports.getCancellationHeatmap = asyncHandler(async (req, res) => {
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
});
