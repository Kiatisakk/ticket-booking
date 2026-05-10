const HttpError = require('../utils/HttpError');
const paymentRepository = require('../repositories/payment.repository');

function generateTicketNo() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `TKT${timestamp}${random}`.slice(0, 20);
}

function createPaymentService({
  payments = paymentRepository,
  ticketNoGenerator = generateTicketNo,
  now = () => new Date()
} = {}) {
  return {
    getPaymentMethods() {
      return payments.findActiveMethods();
    },

    async processPayment({ userId, bookingId, methodId }) {
      if (!Number.isInteger(Number(bookingId)) || !Number.isInteger(Number(methodId))) {
        throw new HttpError(400, 'Booking and payment method are required');
      }

      return payments.runSerializable(async (tx) => {
        const pendingStatus = await payments.findBookingStatus(tx, 'Pending');
        const completedStatus = await payments.findBookingStatus(tx, 'Completed');
        const cancelledStatus = await payments.findBookingStatus(tx, 'Cancelled');
        const successPaymentStatus = await payments.findPaymentStatus(tx, 'Success');

        if (!pendingStatus || !completedStatus || !cancelledStatus || !successPaymentStatus) {
          throw new HttpError(500, 'Required booking/payment statuses are not configured');
        }

        const parsedMethodId = Number(methodId);
        const method = await payments.findActiveMethod(tx, parsedMethodId);
        if (!method) {
          throw new HttpError(400, 'Payment method is inactive or not found');
        }

        const parsedBookingId = Number(bookingId);
        const booking = await payments.findBookingForPayment(tx, parsedBookingId);
        if (!booking) {
          throw new HttpError(404, 'Booking not found');
        }

        if (booking.UserID !== userId) {
          throw new HttpError(403, 'Unauthorized');
        }

        if (booking.Payment) {
          throw new HttpError(400, 'Booking already has a payment');
        }

        if (booking.StatusID !== pendingStatus.StatusID) {
          throw new HttpError(400, 'Booking is not pending');
        }

        if (new Date(booking.ExpiresAt) < now()) {
          await payments.cancelBooking(tx, parsedBookingId, cancelledStatus.StatusID);
          throw new HttpError(400, 'Booking has expired');
        }

        const createdPayment = await payments.create(tx, {
          BookingID: parsedBookingId,
          MethodID: parsedMethodId,
          StatusID: successPaymentStatus.StatusID,
          TransactionID: `TXN${Date.now()}${Math.random().toString(36).slice(2, 11)}`,
          Amount: booking.TotalAmount,
          PaidAt: now()
        });

        await payments.completeBooking(tx, parsedBookingId, completedStatus.StatusID);

        for (const detail of booking.BookingDetails) {
          const finalPrice = Number(detail.Showtime.BasePrice) * Number(detail.Seat.SeatType.PriceModifier);
          await payments.createTicket(tx, {
            TicketNo: ticketNoGenerator(),
            DetailID: detail.DetailID,
            FinalPrice: finalPrice
          });
        }

        return createdPayment;
      });
    }
  };
}

module.exports = createPaymentService();
module.exports.createPaymentService = createPaymentService;
module.exports.generateTicketNo = generateTicketNo;
