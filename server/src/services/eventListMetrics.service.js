const EVENT_LIST_CACHE_TTL_MS = Number(process.env.EVENT_LIST_CACHE_TTL_MS || 5000);
const eventListCache = new Map();

function getCacheKey({ search, categoryId }) {
  return JSON.stringify({
    search: search || '',
    categoryId: categoryId || ''
  });
}

function invalidateEventListCache() {
  eventListCache.clear();
}

function buildEventListWhere({ search, categoryId }) {
  const clauses = [];
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    clauses.push(`e."Title" ILIKE $${params.length}`);
  }

  if (categoryId) {
    params.push(parseInt(categoryId, 10));
    clauses.push(`e."CategoryID" = $${params.length}`);
  }

  return {
    whereSql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params
  };
}

function mapEventListRows(rows) {
  return rows.map(row => ({
    id: Number(row.id),
    title: row.title,
    description: row.description,
    category: row.category || 'Uncategorized',
    categoryId: Number(row.categoryId),
    basePrice: Number(row.basePrice ?? 0),
    venue: row.venue || '-',
    venueId: row.venueId === null ? null : Number(row.venueId),
    totalSeats: Number(row.totalSeats ?? 0),
    seatsRemaining: Number(row.seatsRemaining ?? 0),
    startDateTime: row.startDateTime ?? null,
    showtimeId: row.showtimeId === null ? null : Number(row.showtimeId),
    isPast: Boolean(row.isPast),
    hasBookings: Boolean(row.hasBookings),
    latestShowtime: row.latestShowtime ?? null
  }));
}

async function getEventList(db, options = {}) {
  const { search, categoryId } = options;
  const now = options.now || new Date();
  const canUseCache = !Object.prototype.hasOwnProperty.call(options, 'now') && EVENT_LIST_CACHE_TTL_MS > 0;
  const cacheKey = getCacheKey({ search, categoryId });

  if (canUseCache) {
    const cached = eventListCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }
  }

  const { whereSql, params } = buildEventListWhere({ search, categoryId });
  const nowParamIndex = params.length + 1;
  const sql = `
    WITH filtered_events AS MATERIALIZED (
      SELECT
        e."EventID",
        e."Title",
        e."Description",
        e."CategoryID",
        c."CategoryName"
      FROM "Events" e
      LEFT JOIN "EventCategories" c ON c."CategoryID" = e."CategoryID"
      ${whereSql}
    ),
    first_showtime AS (
      SELECT DISTINCT ON (s."EventID")
        s."EventID",
        s."ShowtimeID",
        s."VenueID",
        s."BasePrice",
        s."StartDateTime",
        v."VenueName"
      FROM "Showtimes" s
      JOIN filtered_events fe ON fe."EventID" = s."EventID"
      JOIN "Venues" v ON v."VenueID" = s."VenueID"
      ORDER BY s."EventID", s."StartDateTime" ASC
    ),
    showtime_rollup AS (
      SELECT
        s."EventID",
        MAX(s."StartDateTime") AS "LatestShowtime"
      FROM "Showtimes" s
      JOIN filtered_events fe ON fe."EventID" = s."EventID"
      GROUP BY s."EventID"
    ),
    booking_event_flags AS (
      SELECT DISTINCT
        s."EventID"
      FROM "Showtimes" s
      JOIN filtered_events fe ON fe."EventID" = s."EventID"
      JOIN "BookingDetails" bd ON bd."ShowtimeID" = s."ShowtimeID"
    ),
    venue_capacity AS (
      SELECT
        s."VenueID",
        COUNT(s."SeatID")::int AS "TotalSeats"
      FROM "Seats" s
      JOIN (
        SELECT DISTINCT "VenueID"
        FROM first_showtime
        WHERE "VenueID" IS NOT NULL
      ) fv ON fv."VenueID" = s."VenueID"
      GROUP BY s."VenueID"
    ),
    active_booked_first_showtime AS (
      SELECT
        bd."ShowtimeID",
        COUNT(bd."SeatID")::int AS "BookedCount"
      FROM "BookingDetails" bd
      JOIN first_showtime fs ON fs."ShowtimeID" = bd."ShowtimeID"
      JOIN "Bookings" b ON b."BookingID" = bd."BookingID"
      JOIN "BookingStatuses" bs ON bs."StatusID" = b."StatusID"
      WHERE
        bs."StatusName" = 'Completed'
        OR (
          bs."StatusName" = 'Pending'
          AND b."ExpiresAt" > $${nowParamIndex}
        )
      GROUP BY bd."ShowtimeID"
    )
    SELECT
      fe."EventID" AS "id",
      fe."Title" AS "title",
      fe."Description" AS "description",
      COALESCE(fe."CategoryName", 'Uncategorized') AS "category",
      fe."CategoryID" AS "categoryId",
      COALESCE(fs."BasePrice", 0) AS "basePrice",
      COALESCE(fs."VenueName", '-') AS "venue",
      fs."VenueID" AS "venueId",
      COALESCE(vc."TotalSeats", 0) AS "totalSeats",
      COALESCE(vc."TotalSeats", 0) - COALESCE(ab."BookedCount", 0) AS "seatsRemaining",
      fs."StartDateTime" AS "startDateTime",
      fs."ShowtimeID" AS "showtimeId",
      CASE
        WHEN sr."LatestShowtime" IS NULL THEN false
        ELSE sr."LatestShowtime" < $${nowParamIndex}
      END AS "isPast",
      bef."EventID" IS NOT NULL AS "hasBookings",
      sr."LatestShowtime" AS "latestShowtime"
    FROM filtered_events fe
    LEFT JOIN first_showtime fs ON fs."EventID" = fe."EventID"
    LEFT JOIN showtime_rollup sr ON sr."EventID" = fe."EventID"
    LEFT JOIN booking_event_flags bef ON bef."EventID" = fe."EventID"
    LEFT JOIN venue_capacity vc ON vc."VenueID" = fs."VenueID"
    LEFT JOIN active_booked_first_showtime ab ON ab."ShowtimeID" = fs."ShowtimeID"
    ORDER BY fe."EventID" DESC
  `;

  const rows = await db.$queryRawUnsafe(sql, ...params, now);
  const result = mapEventListRows(rows);

  if (canUseCache) {
    eventListCache.set(cacheKey, {
      value: result,
      expiresAt: Date.now() + EVENT_LIST_CACHE_TTL_MS
    });
  }

  return result;
}

module.exports = {
  getEventList,
  buildEventListWhere,
  invalidateEventListCache,
  mapEventListRows
};
