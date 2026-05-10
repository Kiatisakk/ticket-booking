const prisma = require('../config/prisma');

function createShowtimeRepository(db = prisma) {
  return {
    findAll() {
      return db.showtime.findMany({
        include: {
          Event: true,
          Venue: true
        }
      });
    },

    findByEvent(eventId) {
      return db.showtime.findMany({
        where: { EventID: eventId },
        include: { Venue: true }
      });
    },

    findById(showtimeId) {
      return db.showtime.findUnique({
        where: { ShowtimeID: showtimeId },
        include: {
          Event: true,
          Venue: {
            include: {
              Seats: {
                include: { SeatType: true }
              }
            }
          }
        }
      });
    },

    findBookedSeatIds(showtimeId, now = new Date()) {
      return db.bookingDetail.findMany({
        where: {
          ShowtimeID: showtimeId,
          Booking: {
            OR: [
              { Status: { StatusName: 'Completed' } },
              { Status: { StatusName: 'Pending' }, ExpiresAt: { gt: now } }
            ]
          }
        },
        select: { SeatID: true }
      });
    }
  };
}

module.exports = createShowtimeRepository();
module.exports.createShowtimeRepository = createShowtimeRepository;
