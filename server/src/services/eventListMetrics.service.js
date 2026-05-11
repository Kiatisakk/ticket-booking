const { decodeCursor, encodeCursor, offsetPayload, parsePagination } = require('../utils/pagination');

function invalidateEventListCache() {
  return undefined;
}

function buildEventListWhere({ search, category, categoryId }) {
  const clauses = [];
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    clauses.push(`e."Title" ILIKE $${params.length}`);
  }

  if (categoryId) {
    params.push(parseInt(categoryId, 10));
    clauses.push(`e."CategoryID" = $${params.length}`);
  } else if (category && category !== 'all') {
    params.push(category);
    clauses.push(`c."CategoryName" = $${params.length}`);
  }

  return {
    whereSql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params
  };
}

function buildEventMetricsWhere({ search, category, categoryId }, alias = 'elm') {
  const clauses = [];
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    clauses.push(`${alias}."Title" ILIKE $${params.length}`);
  }

  if (categoryId) {
    params.push(parseInt(categoryId, 10));
    clauses.push(`${alias}."CategoryID" = $${params.length}`);
  } else if (category && category !== 'all') {
    params.push(category);
    clauses.push(`${alias}."CategoryName" = $${params.length}`);
  }

  return { clauses, params };
}

function normalizeSort({ sortBy = 'eventId', sortOrder = 'desc' } = {}, alias = 'pe') {
  const direction = String(sortOrder).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const sortMap = {
    eventId: `${alias}."EventID"`,
    title: `${alias}."Title"`,
    startDateTime: `${alias}."FirstShowtime"`,
    category: `${alias}."CategoryName"`,
    venue: `${alias}."VenueName"`,
    basePrice: `${alias}."BasePrice"`,
    status: `${alias}."IsPast"`
  };

  return {
    sortBy: sortMap[sortBy] ? sortBy : 'eventId',
    sortSql: sortMap[sortBy] || sortMap.eventId,
    direction
  };
}

function normalizeMetricSort({ sortBy = 'eventId', sortOrder = 'desc' } = {}, alias = 'elm', nowParamIndex = 1) {
  const direction = String(sortOrder).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const sortMap = {
    eventId: `${alias}."EventID"`,
    title: `${alias}."Title"`,
    startDateTime: `${alias}."FirstShowtime"`,
    category: `${alias}."CategoryName"`,
    venue: `${alias}."VenueName"`,
    basePrice: `${alias}."BasePrice"`,
    status: `(CASE WHEN ${alias}."LatestShowtime" IS NULL THEN false ELSE ${alias}."LatestShowtime" < $${nowParamIndex} END)`
  };

  return {
    sortBy: sortMap[sortBy] ? sortBy : 'eventId',
    sortSql: sortMap[sortBy] || sortMap.eventId,
    direction
  };
}

function statusClause(status) {
  if (status === 'upcoming') {
    return 'COALESCE(eb."LatestShowtime" >= $NOW_PARAM, true)';
  }
  if (status === 'past') {
    return 'eb."LatestShowtime" < $NOW_PARAM';
  }
  return '';
}

function metricStatusClause(status, nowParamIndex, alias = 'elm') {
  if (status === 'upcoming') {
    return `COALESCE(${alias}."LatestShowtime" >= $${nowParamIndex}, true)`;
  }
  if (status === 'past') {
    return `${alias}."LatestShowtime" < $${nowParamIndex}`;
  }
  return '';
}

function whereFromClauses(clauses) {
  return clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
}

function cursorClause({ cursor, direction, sortOrder, alias = 'pe' }) {
  const decoded = decodeCursor(cursor, 'EventID');
  const id = Number(decoded?.id ?? decoded?.value);
  if (!Number.isFinite(id)) return '';

  const isAsc = String(sortOrder).toLowerCase() === 'asc';
  const isPrev = direction === 'prev';
  const moveForward = isPrev ? !isAsc : isAsc;
  return `${alias}."EventID" ${moveForward ? '>' : '<'} ${id}`;
}

function buildEventListMetricsSql({
  clauses,
  nowParamIndex,
  status,
  sortBy,
  sortOrder,
  limitParamIndex,
  offsetParamIndex,
  cursor,
  direction,
  includePage = false,
  countOnly = false
}) {
  const normalizedSort = normalizeMetricSort({ sortBy, sortOrder }, 'elm', nowParamIndex);
  const filters = [...clauses];
  const statusSql = metricStatusClause(status, nowParamIndex);
  if (statusSql) filters.push(statusSql);
  if (includePage && normalizedSort.sortBy === 'eventId' && cursor) {
    const clause = cursorClause({ cursor, direction, sortOrder, alias: 'elm' });
    if (clause) filters.push(clause);
  }
  const whereSql = whereFromClauses(filters);

  if (countOnly) {
    const countFilters = [`$${nowParamIndex}::timestamp IS NOT NULL`, ...filters];
    return `
      SELECT COUNT(*)::int AS "total"
      FROM "EventListMetrics" elm
      ${whereFromClauses(countFilters)}
    `;
  }

  const pageSql = includePage
    ? `LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}`
    : '';

  return `
    SELECT
      elm."EventID" AS "id",
      elm."Title" AS "title",
      elm."Description" AS "description",
      COALESCE(elm."CategoryName", 'Uncategorized') AS "category",
      elm."CategoryID" AS "categoryId",
      COALESCE(elm."BasePrice", 0) AS "basePrice",
      COALESCE(elm."VenueName", '-') AS "venue",
      elm."VenueID" AS "venueId",
      COALESCE(elm."TotalSeats", 0) AS "totalSeats",
      COALESCE(elm."SeatsRemaining", 0) AS "seatsRemaining",
      elm."FirstShowtime" AS "startDateTime",
      elm."FirstShowtimeID" AS "showtimeId",
      CASE
        WHEN elm."LatestShowtime" IS NULL THEN false
        ELSE elm."LatestShowtime" < $${nowParamIndex}
      END AS "isPast",
      COALESCE(elm."HasBookings", false) AS "hasBookings",
      elm."LatestShowtime" AS "latestShowtime"
    FROM "EventListMetrics" elm
    ${whereSql}
    ORDER BY ${normalizedSort.sortSql} ${normalizedSort.direction}, elm."EventID" ${normalizedSort.direction}
    ${pageSql}
  `;
}

function buildEventSummaryMetricsSql({ clauses, nowParamIndex }) {
  return `
    SELECT
      COUNT(*)::int AS "total",
      COUNT(*) FILTER (
        WHERE COALESCE(elm."LatestShowtime" >= $${nowParamIndex}, true)
      )::int AS "upcoming",
      COUNT(*) FILTER (
        WHERE elm."LatestShowtime" < $${nowParamIndex}
      )::int AS "past"
    FROM "EventListMetrics" elm
    ${whereFromClauses(clauses)}
  `;
}

function isMissingEventListMetrics(error) {
  const text = `${error?.code || ''} ${error?.message || ''}`;
  return text.includes('EventListMetrics') && (text.includes('42P01') || text.includes('does not exist'));
}

function buildEventListSql({
  whereSql,
  params,
  nowParamIndex,
  status,
  sortBy,
  sortOrder,
  limitParamIndex,
  offsetParamIndex,
  cursor,
  direction,
  includePage = false,
  countOnly = false
}) {
  const normalizedSort = normalizeSort({ sortBy, sortOrder });
  const filters = [];
  const statusSql = statusClause(status).replaceAll('$NOW_PARAM', `$${nowParamIndex}`);
  if (statusSql) filters.push(statusSql);
  if (includePage && normalizedSort.sortBy === 'eventId' && cursor) {
    const clause = cursorClause({ cursor, direction, sortOrder, alias: 'fe' });
    if (clause) filters.push(clause);
  }
  const eventFilterSql = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const pageSql = includePage
    ? `LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}`
    : '';

  const baseCtes = `
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
    event_bounds AS (
      SELECT
        fe."EventID",
        MIN(s."StartDateTime") AS "FirstShowtime",
        MAX(s."StartDateTime") AS "LatestShowtime"
      FROM filtered_events fe
      LEFT JOIN "Showtimes" s ON s."EventID" = fe."EventID"
      GROUP BY fe."EventID"
    ),
    first_showtime_meta AS (
      SELECT DISTINCT ON (s."EventID")
        s."EventID",
        s."VenueID",
        s."BasePrice",
        v."VenueName"
      FROM "Showtimes" s
      JOIN filtered_events fe ON fe."EventID" = s."EventID"
      JOIN "Venues" v ON v."VenueID" = s."VenueID"
      ORDER BY s."EventID", s."StartDateTime" ASC
    ),
    page_source AS MATERIALIZED (
      SELECT
        fe.*,
        eb."FirstShowtime",
        eb."LatestShowtime",
        COALESCE(fsm."VenueName", '-') AS "VenueName",
        fsm."VenueID" AS "VenueID",
        COALESCE(fsm."BasePrice", 0) AS "BasePrice",
        CASE
          WHEN eb."LatestShowtime" IS NULL THEN false
          ELSE eb."LatestShowtime" < $${nowParamIndex}
        END AS "IsPast"
      FROM filtered_events fe
      LEFT JOIN event_bounds eb ON eb."EventID" = fe."EventID"
      LEFT JOIN first_showtime_meta fsm ON fsm."EventID" = fe."EventID"
      ${eventFilterSql}
    ),
    page_events AS MATERIALIZED (
      SELECT *
      FROM page_source ps
      ORDER BY ${normalizeSort({ sortBy, sortOrder }, 'ps').sortSql} ${normalizedSort.direction}, ps."EventID" ${normalizedSort.direction}
      ${pageSql}
    )
  `;

  if (countOnly) {
    return `
      ${baseCtes}
      SELECT COUNT(*)::int AS "total"
      FROM page_events
    `;
  }

  return `
    ${baseCtes},
    first_showtime AS (
      SELECT DISTINCT ON (s."EventID")
        s."EventID",
        s."ShowtimeID",
        s."VenueID",
        s."BasePrice",
        s."StartDateTime",
        v."VenueName"
      FROM "Showtimes" s
      JOIN page_events pe ON pe."EventID" = s."EventID"
      JOIN "Venues" v ON v."VenueID" = s."VenueID"
      ORDER BY s."EventID", s."StartDateTime" ASC
    ),
    booking_event_flags AS (
      SELECT DISTINCT
        s."EventID"
      FROM "Showtimes" s
      JOIN page_events pe ON pe."EventID" = s."EventID"
      JOIN "BookingDetails" bd ON bd."ShowtimeID" = s."ShowtimeID"
    ),
    venue_capacity AS (
      SELECT
        seats."VenueID",
        COUNT(seats."SeatID")::int AS "TotalSeats"
      FROM "Seats" seats
      JOIN (
        SELECT DISTINCT "VenueID"
        FROM first_showtime
        WHERE "VenueID" IS NOT NULL
      ) fv ON fv."VenueID" = seats."VenueID"
      GROUP BY seats."VenueID"
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
      pe."EventID" AS "id",
      pe."Title" AS "title",
      pe."Description" AS "description",
      COALESCE(pe."CategoryName", 'Uncategorized') AS "category",
      pe."CategoryID" AS "categoryId",
      COALESCE(fs."BasePrice", 0) AS "basePrice",
      COALESCE(fs."VenueName", '-') AS "venue",
      fs."VenueID" AS "venueId",
      COALESCE(vc."TotalSeats", 0) AS "totalSeats",
      COALESCE(vc."TotalSeats", 0) - COALESCE(ab."BookedCount", 0) AS "seatsRemaining",
      fs."StartDateTime" AS "startDateTime",
      fs."ShowtimeID" AS "showtimeId",
      CASE
        WHEN pe."LatestShowtime" IS NULL THEN false
        ELSE pe."LatestShowtime" < $${nowParamIndex}
      END AS "isPast",
      bef."EventID" IS NOT NULL AS "hasBookings",
      pe."LatestShowtime" AS "latestShowtime"
    FROM page_events pe
    LEFT JOIN first_showtime fs ON fs."EventID" = pe."EventID"
    LEFT JOIN booking_event_flags bef ON bef."EventID" = pe."EventID"
    LEFT JOIN venue_capacity vc ON vc."VenueID" = fs."VenueID"
    LEFT JOIN active_booked_first_showtime ab ON ab."ShowtimeID" = fs."ShowtimeID"
    ORDER BY ${normalizeSort({ sortBy, sortOrder }, 'pe').sortSql} ${normalizeSort({ sortBy, sortOrder }).direction}, pe."EventID" ${normalizeSort({ sortBy, sortOrder }).direction}
  `;
}

function buildEventSummarySql({ whereSql, nowParamIndex }) {
  return `
    WITH filtered_events AS MATERIALIZED (
      SELECT
        e."EventID"
      FROM "Events" e
      LEFT JOIN "EventCategories" c ON c."CategoryID" = e."CategoryID"
      ${whereSql}
    ),
    event_bounds AS (
      SELECT
        fe."EventID",
        MAX(s."StartDateTime") AS "LatestShowtime"
      FROM filtered_events fe
      LEFT JOIN "Showtimes" s ON s."EventID" = fe."EventID"
      GROUP BY fe."EventID"
    )
    SELECT
      COUNT(*)::int AS "total",
      COUNT(*) FILTER (
        WHERE COALESCE(eb."LatestShowtime" >= $${nowParamIndex}, true)
      )::int AS "upcoming",
      COUNT(*) FILTER (
        WHERE eb."LatestShowtime" < $${nowParamIndex}
      )::int AS "past"
    FROM filtered_events fe
    LEFT JOIN event_bounds eb ON eb."EventID" = fe."EventID"
  `;
}

function mapEventSummary(row = {}) {
  return {
    total: Number(row.total || 0),
    upcoming: Number(row.upcoming || 0),
    past: Number(row.past || 0)
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

async function getEventListFromMaterializedView(db, options = {}) {
  const { search, category, categoryId, status, sortBy = 'eventId', sortOrder = 'desc' } = options;
  const now = options.now || new Date();
  const page = parsePagination(options, { defaultPageSize: 12 });
  const { clauses, params } = buildEventMetricsWhere({ search, category, categoryId });
  const nowParamIndex = params.length + 1;

  if (page.enabled) {
    const wantsCursor = page.requestedMode === 'cursor';
    const canUseCursor = wantsCursor && normalizeMetricSort({ sortBy, sortOrder }, 'elm', nowParamIndex).sortBy === 'eventId';
    const pageSize = page.pageSize;
    const offset = canUseCursor ? 0 : page.skip;
    const limitParamIndex = nowParamIndex + 1;
    const offsetParamIndex = nowParamIndex + 2;

    const [rows, countRows, summaryRows] = await Promise.all([
      db.$queryRawUnsafe(
        buildEventListMetricsSql({
          clauses,
          nowParamIndex,
          status,
          sortBy,
          sortOrder,
          limitParamIndex,
          offsetParamIndex,
          cursor: canUseCursor ? page.cursor : null,
          direction: page.direction,
          includePage: true
        }),
        ...params,
        now,
        pageSize + (canUseCursor ? 1 : 0),
        offset
      ),
      db.$queryRawUnsafe(
        buildEventListMetricsSql({
          clauses,
          nowParamIndex,
          status,
          sortBy,
          sortOrder,
          countOnly: true
        }),
        ...params,
        now
      ),
      db.$queryRawUnsafe(
        buildEventSummaryMetricsSql({ clauses, nowParamIndex }),
        ...params,
        now
      )
    ]);

    const total = Number(countRows[0]?.total || 0);
    const summary = mapEventSummary(summaryRows[0]);
    const mappedRows = mapEventListRows(rows);

    if (canUseCursor) {
      const pageRows = mappedRows.slice(0, pageSize);
      const data = page.direction === 'prev' ? pageRows.reverse() : pageRows;
      const first = data[0];
      const last = data[data.length - 1];
      const hasMore = mappedRows.length > pageSize;
      return {
        data,
        pageSize,
        total,
        summary,
        pagination: {
          type: 'cursor',
          nextCursor: last ? encodeCursor({ id: last.id, value: last.id }) : null,
          prevCursor: first ? encodeCursor({ id: first.id, value: first.id }) : null,
          hasNextPage: page.direction === 'prev' ? Boolean(page.cursor) : hasMore,
          hasPrevPage: page.direction === 'prev' ? hasMore : Boolean(page.cursor)
        }
      };
    }

    return {
      ...offsetPayload(mappedRows, total, page.page, pageSize, wantsCursor
        ? { fallbackFrom: 'cursor', reason: 'Requested event sort requires offset pagination' }
        : {}),
      summary
    };
  }

  const rows = await db.$queryRawUnsafe(
    buildEventListMetricsSql({
      clauses,
      nowParamIndex,
      status,
      sortBy: 'eventId',
      sortOrder: 'desc'
    }),
    ...params,
    now
  );
  return mapEventListRows(rows);
}

async function getEventList(db, options = {}) {
  if (options.useMaterializedView !== false) {
    try {
      return await getEventListFromMaterializedView(db, options);
    } catch (error) {
      if (!isMissingEventListMetrics(error)) throw error;
    }
  }

  const { search, category, categoryId, status, sortBy = 'eventId', sortOrder = 'desc' } = options;
  const now = options.now || new Date();
  const page = parsePagination(options, { defaultPageSize: 12 });

  const { whereSql, params } = buildEventListWhere({ search, category, categoryId });
  const nowParamIndex = params.length + 1;

  if (page.enabled) {
    const wantsCursor = page.requestedMode === 'cursor';
    const canUseCursor = wantsCursor && normalizeSort({ sortBy, sortOrder }).sortBy === 'eventId';
    const pageSize = page.pageSize;
    const offset = canUseCursor ? 0 : page.skip;
    const limitParamIndex = nowParamIndex + 1;
    const offsetParamIndex = nowParamIndex + 2;
    const [rows, countRows, summaryRows] = await Promise.all([
      db.$queryRawUnsafe(
        buildEventListSql({
          whereSql,
          params,
          nowParamIndex,
          status,
          sortBy,
          sortOrder,
          limitParamIndex,
          offsetParamIndex,
          cursor: canUseCursor ? page.cursor : null,
          direction: page.direction,
          includePage: true
        }),
        ...params,
        now,
        pageSize + (canUseCursor ? 1 : 0),
        offset
      ),
      db.$queryRawUnsafe(
        buildEventListSql({
          whereSql,
          params,
          nowParamIndex,
          status,
          sortBy,
          sortOrder,
          limitParamIndex,
          offsetParamIndex,
          includePage: false,
          countOnly: true
        }),
        ...params,
        now
      ),
      db.$queryRawUnsafe(
        buildEventSummarySql({ whereSql, nowParamIndex }),
        ...params,
        now
      )
    ]);
    const total = Number(countRows[0]?.total || 0);
    const summary = mapEventSummary(summaryRows[0]);
    const mappedRows = mapEventListRows(rows);

    if (canUseCursor) {
      const pageRows = mappedRows.slice(0, pageSize);
      const data = page.direction === 'prev' ? pageRows.reverse() : pageRows;
      const first = data[0];
      const last = data[data.length - 1];
      const hasMore = mappedRows.length > pageSize;
      return {
        data,
        pageSize,
        total,
        summary,
        pagination: {
          type: 'cursor',
          nextCursor: last ? encodeCursor({ id: last.id, value: last.id }) : null,
          prevCursor: first ? encodeCursor({ id: first.id, value: first.id }) : null,
          hasNextPage: page.direction === 'prev' ? Boolean(page.cursor) : hasMore,
          hasPrevPage: page.direction === 'prev' ? hasMore : Boolean(page.cursor)
        }
      };
    }

    return {
      ...offsetPayload(mappedRows, total, page.page, pageSize, wantsCursor
      ? { fallbackFrom: 'cursor', reason: 'Requested event sort requires offset pagination' }
      : {}),
      summary
    };
  }

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
  return mapEventListRows(rows);
}

module.exports = {
  getEventList,
  buildEventListWhere,
  buildEventSummarySql,
  invalidateEventListCache,
  mapEventSummary,
  mapEventListRows
};
