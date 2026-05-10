const prisma = require('../config/prisma');

function createTicketRepository(db = prisma) {
  return {
    findBookingOwner(bookingId) {
      return db.booking.findUnique({
        where: { BookingID: bookingId },
        select: { UserID: true }
      });
    },

    findByBooking(bookingId) {
      return db.ticket.findMany({
        where: {
          Detail: { BookingID: bookingId }
        },
        include: {
          Detail: {
            include: {
              Booking: true,
              Showtime: {
                include: {
                  Event: true,
                  Venue: true
                }
              },
              Seat: {
                include: { SeatType: true }
              }
            }
          }
        }
      });
    },

    findByTicketNo(ticketNo) {
      return db.ticket.findUnique({
        where: { TicketNo: ticketNo },
        include: {
          Detail: {
            include: {
              Booking: {
                include: { Status: true }
              },
              Showtime: {
                include: {
                  Event: true,
                  Venue: true
                }
              },
              Seat: true
            }
          }
        }
      });
    }
  };
}

module.exports = createTicketRepository();
module.exports.createTicketRepository = createTicketRepository;
