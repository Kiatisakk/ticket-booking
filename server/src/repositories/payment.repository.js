const prisma = require('../config/prisma');
const { Prisma } = require('@prisma/client');

function createPaymentRepository(db = prisma) {
  return {
    runSerializable(work) {
      return db.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      });
    },

    findActiveMethods() {
      return db.paymentMethod.findMany({ where: { IsActive: true } });
    },

    findBookingStatus(tx, statusName) {
      return tx.bookingStatus.findFirst({ where: { StatusName: statusName } });
    },

    findPaymentStatus(tx, statusName) {
      return tx.paymentStatus.findFirst({ where: { StatusName: statusName } });
    },

    findActiveMethod(tx, methodId) {
      return tx.paymentMethod.findFirst({
        where: {
          MethodID: methodId,
          IsActive: true
        }
      });
    },

    findBookingForPayment(tx, bookingId) {
      return tx.booking.findUnique({
        where: { BookingID: bookingId },
        include: {
          Payment: true,
          BookingDetails: {
            include: {
              Showtime: true,
              Seat: {
                include: { SeatType: true }
              }
            }
          }
        }
      });
    },

    create(tx, data) {
      return tx.payment.create({ data });
    },

    completeBooking(tx, bookingId, completedStatusId) {
      return tx.booking.update({
        where: { BookingID: bookingId },
        data: { StatusID: completedStatusId }
      });
    },

    cancelBooking(tx, bookingId, cancelledStatusId) {
      return tx.booking.update({
        where: { BookingID: bookingId },
        data: { StatusID: cancelledStatusId }
      });
    },

    createTicket(tx, data) {
      return tx.ticket.create({ data });
    }
  };
}

module.exports = createPaymentRepository();
module.exports.createPaymentRepository = createPaymentRepository;
