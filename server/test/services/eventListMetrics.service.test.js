const test = require('node:test');
const assert = require('node:assert/strict');
const { getEventList } = require('../../src/services/eventListMetrics.service');

test('getEventList aggregates event metrics without per-event count queries', async () => {
  const calls = [];
  const db = {
    event: {
      findMany: async () => {
        calls.push('event.findMany');
        return [
          {
            EventID: 10,
            Title: 'Concert',
            Description: 'Live',
            CategoryID: 2,
            Category: { CategoryName: 'Concert' },
            Showtimes: [
              {
                ShowtimeID: 50,
                VenueID: 7,
                BasePrice: '1000',
                StartDateTime: new Date('2030-01-01T10:00:00Z'),
                Venue: { VenueName: 'Arena' }
              },
              {
                ShowtimeID: 51,
                VenueID: 7,
                BasePrice: '1000',
                StartDateTime: new Date('2030-01-02T10:00:00Z'),
                Venue: { VenueName: 'Arena' }
              }
            ]
          }
        ];
      }
    },
    seat: {
      groupBy: async () => {
        calls.push('seat.groupBy');
        return [{ VenueID: 7, _count: { SeatID: 100 } }];
      }
    },
    bookingDetail: {
      groupBy: async ({ where }) => {
        calls.push('bookingDetail.groupBy');
        if (where.ShowtimeID.in.length === 1) {
          return [{ ShowtimeID: 50, _count: { SeatID: 35 } }];
        }
        return [{ ShowtimeID: 51, _count: { DetailID: 2 } }];
      }
    }
  };

  const result = await getEventList(db, { now: new Date('2029-01-01T00:00:00Z') });

  assert.deepEqual(calls, [
    'event.findMany',
    'seat.groupBy',
    'bookingDetail.groupBy',
    'bookingDetail.groupBy'
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
    startDateTime: new Date('2030-01-01T10:00:00Z'),
    showtimeId: 50,
    isPast: false,
    hasBookings: true,
    latestShowtime: new Date('2030-01-02T10:00:00Z')
  });
});
