const test = require('node:test');
const assert = require('node:assert/strict');
const { createShowtimeService } = require('../../src/services/showtime.service');

test('getBookedSeats maps ShowtimeAvailableSeats rows into booked ids and availability payload', async () => {
  const service = createShowtimeService({
    showtimes: {
      findSeatAvailability: async (showtimeId) => {
        assert.equal(showtimeId, 12);
        return [
          {
            ShowtimeID: 12,
            SeatID: 101,
            RowLabel: 'A',
            SeatNumber: '1',
            SeatTypeID: 1,
            SeatTypeName: 'VIP',
            BasePrice: '1000',
            PriceModifier: '2',
            CalculatedPrice: '2000',
            IsAvailable: true
          },
          {
            ShowtimeID: 12,
            SeatID: 102,
            RowLabel: 'A',
            SeatNumber: '2',
            SeatTypeID: 2,
            SeatTypeName: 'Standard',
            BasePrice: '1000',
            PriceModifier: '1',
            CalculatedPrice: '1000',
            IsAvailable: false
          }
        ];
      }
    }
  });

  const result = await service.getBookedSeats(12);

  assert.deepEqual(result.bookedSeatIds, [102]);
  assert.deepEqual(result.seats[0], {
    showtimeId: 12,
    seatId: 101,
    rowLabel: 'A',
    seatNumber: '1',
    seatTypeId: 1,
    seatTypeName: 'VIP',
    basePrice: 1000,
    priceModifier: 2,
    calculatedPrice: 2000,
    isAvailable: true
  });
});
