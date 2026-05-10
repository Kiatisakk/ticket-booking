const prisma = require('../config/prisma');
const { Prisma } = require('@prisma/client');

function createBookingRepository(db = prisma) {
  return {
    runSerializable(work) {
      return db.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      });
    },

    findStatus(tx, statusName) {
      return tx.bookingStatus.findFirst({ where: { StatusName: statusName } });
    },

    findBookingStatus(statusName) {
      return db.bookingStatus.findFirst({ where: { StatusName: statusName } });
    },

    findShowtime(tx, showtimeId) {
      return tx.showtime.findUnique({ where: { ShowtimeID: showtimeId } });
    },

    findSeats(tx, seatIds) {
      return tx.seat.findMany({
        where: { SeatID: { in: seatIds } },
        include: { SeatType: true }
      });
    },

    findActiveSeatBookings(tx, { showtimeId, seatIds, pendingStatusId, completedStatusId, now }) {
      return tx.bookingDetail.findMany({
        where: {
          ShowtimeID: showtimeId,
          SeatID: { in: seatIds },
          Booking: {
            OR: [
              { StatusID: completedStatusId },
              {
                StatusID: pendingStatusId,
                ExpiresAt: { gt: now }
              }
            ]
          }
        },
        select: { SeatID: true }
      });
    },

    create(tx, { userId, statusId, expiresAt, totalAmount, showtimeId, seatIds }) {
      return tx.booking.create({
        data: {
          UserID: userId,
          StatusID: statusId,
          ExpiresAt: expiresAt,
          TotalAmount: totalAmount,
          BookingDetails: {
            create: seatIds.map(seatId => ({
              ShowtimeID: showtimeId,
              SeatID: seatId
            }))
          }
        },
        include: { BookingDetails: true }
      });
    },

    expirePendingForUser(userId, pendingStatusId, cancelledStatusId) {
      return db.booking.updateMany({
        where: {
          UserID: userId,
          StatusID: pendingStatusId,
          ExpiresAt: { lt: new Date() }
        },
        data: { StatusID: cancelledStatusId }
      });
    },

    findManyByUser(userId) {
      return db.booking.findMany({
        where: { UserID: userId },
        include: {
          Status: true,
          BookingDetails: {
            include: {
              Showtime: {
                include: {
                  Event: true,
                  Venue: true
                }
              },
              Seat: {
                include: { SeatType: true }
              },
              Ticket: true
            }
          },
          Payment: true
        },
        orderBy: { BookingTimestamp: 'desc' }
      });
    },

    findById(bookingId) {
      return db.booking.findUnique({
        where: { BookingID: bookingId },
        include: {
          Status: true,
          BookingDetails: {
            include: {
              Showtime: {
                include: {
                  Event: true,
                  Venue: true
                }
              },
              Seat: {
                include: { SeatType: true }
              },
              Ticket: true
            }
          },
          Payment: {
            include: {
              Method: true,
              Status: true
            }
          }
        }
      });
    },

    findBasicById(bookingId) {
      return db.booking.findUnique({ where: { BookingID: bookingId } });
    },

    updateStatus(bookingId, statusId) {
      return db.booking.update({
        where: { BookingID: bookingId },
        data: { StatusID: statusId }
      });
    },

    updateExpiredPending(bookingId, userId, pendingStatusId, cancelledStatusId) {
      return db.booking.updateMany({
        where: {
          BookingID: bookingId,
          UserID: userId,
          StatusID: pendingStatusId,
          ExpiresAt: { lt: new Date() }
        },
        data: { StatusID: cancelledStatusId }
      });
    }
  };
}

module.exports = createBookingRepository();
module.exports.createBookingRepository = createBookingRepository;
