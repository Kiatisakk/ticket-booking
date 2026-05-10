const HttpError = require('../utils/HttpError');
const seatLockRepository = require('../repositories/seatLock.repository');

function createSeatLockService({
  seatLocks = seatLockRepository,
  now = () => new Date()
} = {}) {
  return {
    async lockSeat({ seatId, showtimeId }) {
      const parsedSeatId = Number(seatId);
      const parsedShowtimeId = Number(showtimeId);

      if (!Number.isInteger(parsedSeatId) || !Number.isInteger(parsedShowtimeId)) {
        throw new HttpError(400, 'Seat and showtime are required');
      }

      const activeBooking = await seatLocks.findActiveSeatBooking({
        seatId: parsedSeatId,
        showtimeId: parsedShowtimeId,
        now: now()
      });

      if (activeBooking) {
        throw new HttpError(409, 'Seat is already booked or temporarily reserved');
      }

      return { success: true, message: 'Seat is available' };
    },

    unlockSeats() {
      return { success: true, message: 'Seat selection cleared' };
    }
  };
}

module.exports = createSeatLockService();
module.exports.createSeatLockService = createSeatLockService;
