const test = require('node:test');
const assert = require('node:assert/strict');
const { createShowtimeService } = require('../../src/services/showtime.service');

test('getBookedSeats maps unavailable seats from ShowtimeAvailableSeats rows', async () => {
  const service = createShowtimeService({
    showtimes: {
      findSeatAvailability: async () => [
        {
          ShowtimeID: 1,
          SeatID: 10,
          RowLabel: 'A',
          SeatNumber: 1,
          SeatTypeID: 1,
          SeatTypeName: 'VIP',
          BasePrice: '100.00',
          PriceModifier: '2.00',
          CalculatedPrice: '200.00',
          IsAvailable: false
        },
        {
          ShowtimeID: 1,
          SeatID: 11,
          RowLabel: 'A',
          SeatNumber: 2,
          SeatTypeID: 2,
          SeatTypeName: 'Standard',
          BasePrice: '100.00',
          PriceModifier: '1.00',
          CalculatedPrice: '100.00',
          IsAvailable: true
        }
      ]
    }
  });

  const result = await service.getBookedSeats(1);

  assert.deepEqual(result.bookedSeatIds, [10]);
  assert.equal(result.seats[0].isAvailable, false);
  assert.equal(result.seats[1].isAvailable, true);
  assert.equal(result.seats[0].calculatedPrice, 200);
});
