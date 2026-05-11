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

test('getEventList uses one SQL aggregate query instead of per-event queries', async () => {
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
  assert.match(calls[0].sql, /WITH filtered_events AS MATERIALIZED/);
  assert.match(calls[0].sql, /first_showtime AS/);
  assert.match(calls[0].sql, /showtime_rollup AS/);
  assert.match(calls[0].sql, /booking_event_flags AS/);
  assert.match(calls[0].sql, /venue_capacity AS/);
  assert.match(calls[0].sql, /active_booked_first_showtime AS/);
  assert.match(calls[0].sql, /SELECT DISTINCT\s+s\."EventID"/);
  assert.match(calls[0].sql, /COUNT\(s\."SeatID"\)::int AS "TotalSeats"/);
  assert.match(calls[0].sql, /COUNT\(bd\."SeatID"\)::int AS "BookedCount"/);
  assert.match(calls[0].sql, /ORDER BY fe\."EventID" DESC/);
  assert.deepEqual(calls[0].params, ['%con%', 2, now]);
  assert.equal(result[0].seatsRemaining, 65);
  assert.equal(result[0].hasBookings, true);
});

test('getEventList caches normal list calls until invalidated', async () => {
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
  assert.equal(queryCount, 1);

  invalidateEventListCache();
  await getEventList(db, {});
  assert.equal(queryCount, 2);
});
