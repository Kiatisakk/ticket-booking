const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildEventListWhere,
  getEventList,
  invalidateEventListCache,
  mapEventListRows
} = require('../../src/services/eventListMetrics.service');

test('buildEventListWhere builds parameterized search and category filters', () => {
  const result = buildEventListWhere({ search: 'concert', categoryId: '2' });

  assert.equal(result.whereSql, 'WHERE e."Title" ILIKE $1 AND e."CategoryID" = $2');
  assert.deepEqual(result.params, ['%concert%', 2]);
});

test('mapEventListRows normalizes raw SQL row values for controllers', () => {
  const startDateTime = new Date('2030-01-01T10:00:00Z');
  const latestShowtime = new Date('2030-01-02T10:00:00Z');

  const result = mapEventListRows([
    {
      id: '10',
      title: 'Concert',
      description: 'Live',
      category: 'Concert',
      categoryId: '2',
      basePrice: '1000',
      venue: 'Arena',
      venueId: '7',
      totalSeats: '100',
      seatsRemaining: '65',
      startDateTime,
      showtimeId: '50',
      isPast: false,
      hasBookings: true,
      latestShowtime
    }
  ]);

  assert.deepEqual(result[0], {
    id: 10,
    title: 'Concert',
    description: 'Live',
    category: 'Concert',
    categoryId: 2,
    basePrice: 1000,
    venue: 'Arena',
    venueId: 7,
    totalSeats: 100,
    seatsRemaining: 65,
    startDateTime,
    showtimeId: 50,
    isPast: false,
    hasBookings: true,
    latestShowtime
  });
});

test('getEventList reads event list metrics from the materialized view', async () => {
  invalidateEventListCache();
  const now = new Date('2029-01-01T00:00:00Z');
  const calls = [];
  const db = {
    $queryRawUnsafe: async (sql, ...params) => {
      calls.push({ sql, params });
      return [
        {
          id: 10,
          title: 'Concert',
          description: 'Live',
          category: 'Concert',
          categoryId: 2,
          basePrice: '1000',
          venue: 'Arena',
          venueId: 7,
          totalSeats: 100,
          seatsRemaining: 65,
          startDateTime: new Date('2030-01-01T10:00:00Z'),
          showtimeId: 50,
          isPast: false,
          hasBookings: true,
          latestShowtime: new Date('2030-01-02T10:00:00Z')
        }
      ];
    }
  };

  const result = await getEventList(db, { search: 'con', categoryId: '2', now });

  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /FROM "EventListMetrics" elm/);
  assert.match(calls[0].sql, /elm\."Title" ILIKE \$1/);
  assert.match(calls[0].sql, /elm\."CategoryID" = \$2/);
  assert.match(calls[0].sql, /ORDER BY elm\."EventID" DESC/);
  assert.deepEqual(calls[0].params, ['%con%', 2, now]);
  assert.equal(result[0].seatsRemaining, 65);
  assert.equal(result[0].hasBookings, true);
});

test('getEventList falls back to aggregate SQL when the materialized view is missing', async () => {
  invalidateEventListCache();
  const now = new Date('2029-01-01T00:00:00Z');
  const calls = [];
  const db = {
    $queryRawUnsafe: async (sql, ...params) => {
      calls.push({ sql, params });
      if (calls.length === 1) {
        const error = new Error('relation "EventListMetrics" does not exist 42P01');
        error.code = 'P2010';
        throw error;
      }
      return [];
    }
  };

  await getEventList(db, { now });

  assert.equal(calls.length, 2);
  assert.match(calls[0].sql, /FROM "EventListMetrics" elm/);
  assert.match(calls[1].sql, /WITH filtered_events AS MATERIALIZED/);
  assert.match(calls[1].sql, /active_booked_first_showtime AS/);
});

test('getEventList does not cache normal list calls', async () => {
  invalidateEventListCache();
  let queryCount = 0;
  const db = {
    $queryRawUnsafe: async () => {
      queryCount += 1;
      return [];
    }
  };

  await getEventList(db, {});
  await getEventList(db, {});
  assert.equal(queryCount, 2);

  invalidateEventListCache();
  await getEventList(db, {});
  assert.equal(queryCount, 3);
});

test('getEventList returns offset pagination payload when requested', async () => {
  invalidateEventListCache();
  const calls = [];
  const db = {
    $queryRawUnsafe: async (sql, ...params) => {
      calls.push({ sql, params });
      if (sql.includes('AS "upcoming"')) return [{ total: 30, upcoming: 25, past: 5 }];
      if (sql.includes('COUNT(*)')) return [{ total: 25 }];
      return [
        {
          id: 10,
          title: 'Concert',
          description: 'Live',
          category: 'Concert',
          categoryId: 2,
          basePrice: '1000',
          venue: 'Arena',
          venueId: 7,
          totalSeats: 100,
          seatsRemaining: 65,
          startDateTime: new Date('2030-01-01T10:00:00Z'),
          showtimeId: 50,
          isPast: false,
          hasBookings: true,
          latestShowtime: new Date('2030-01-02T10:00:00Z')
        }
      ];
    }
  };

  const payload = await getEventList(db, {
    pagination: 'offset',
    page: '2',
    pageSize: '10',
    status: 'upcoming',
    now: new Date('2029-01-01T00:00:00Z')
  });

  assert.equal(calls.length, 3);
  assert.match(calls[0].sql, /LIMIT \$2 OFFSET \$3/);
  assert.match(calls[0].sql, /COALESCE\(elm\."LatestShowtime" >= \$1, true\)/);
  assert.deepEqual(calls[0].params, [new Date('2029-01-01T00:00:00Z'), 10, 10]);
  assert.deepEqual(calls[2].params, [new Date('2029-01-01T00:00:00Z')]);
  assert.equal(payload.pagination.type, 'offset');
  assert.equal(payload.total, 25);
  assert.equal(payload.totalPages, 3);
  assert.deepEqual(payload.summary, { total: 30, upcoming: 25, past: 5 });
  assert.equal(payload.data[0].id, 10);
});
