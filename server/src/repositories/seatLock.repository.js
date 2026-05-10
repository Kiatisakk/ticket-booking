const prisma = require('../config/prisma');

function createSeatLockRepository(db = prisma) {
  return {
    findActiveSeatBooking({ showtimeId, seatId, now = new Date() }) {
      return db.bookingDetail.findFirst({
        where: {
          ShowtimeID: showtimeId,
          SeatID: seatId,
          Booking: {
            OR: [
              { Status: { StatusName: 'Completed' } },
              { Status: { StatusName: 'Pending' }, ExpiresAt: { gt: now } }
            ]
          }
        },
        select: { DetailID: true }
      });
    }
  };
}

module.exports = createSeatLockRepository();
module.exports.createSeatLockRepository = createSeatLockRepository;
