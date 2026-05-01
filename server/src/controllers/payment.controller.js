const prisma = require('../config/prisma');
const { Prisma } = require('@prisma/client');

function generateTicketNo() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `TKT${timestamp}${random}`.slice(0, 20);
}

exports.getPaymentMethods = async (req, res) => {
  try {
    const methods = await prisma.paymentMethod.findMany({
      where: { IsActive: true }
    });
    res.json(methods);
  } catch (error) {
    console.error('Get payment methods error:', error);
    res.status(500).json({ error: 'Failed to fetch payment methods' });
  }
};

exports.processPayment = async (req, res) => {
  try {
    const { bookingId, methodId } = req.body;

    if (!Number.isInteger(Number(bookingId)) || !Number.isInteger(Number(methodId))) {
      return res.status(400).json({ error: 'Booking and payment method are required' });
    }

    const payment = await prisma.$transaction(async (tx) => {
      const pendingStatus = await tx.bookingStatus.findFirst({
        where: { StatusName: 'Pending' }
      });
      const completedStatus = await tx.bookingStatus.findFirst({
        where: { StatusName: 'Completed' }
      });
      const successPaymentStatus = await tx.paymentStatus.findFirst({
        where: { StatusName: 'Success' }
      });

      if (!pendingStatus || !completedStatus || !successPaymentStatus) {
        throw new Error('Required booking/payment statuses are not configured');
      }

      const method = await tx.paymentMethod.findFirst({
        where: {
          MethodID: Number(methodId),
          IsActive: true
        }
      });

      if (!method) {
        const error = new Error('Payment method is inactive or not found');
        error.statusCode = 400;
        throw error;
      }

      const booking = await tx.booking.findUnique({
        where: { BookingID: Number(bookingId) },
        include: {
          Payment: true,
          BookingDetails: {
            include: {
              Showtime: true,
              Seat: {
                include: {
                  SeatType: true
                }
              }
            }
          }
        }
      });

      if (!booking) {
        const error = new Error('Booking not found');
        error.statusCode = 404;
        throw error;
      }

      if (booking.UserID !== req.user.userId) {
        const error = new Error('Unauthorized');
        error.statusCode = 403;
        throw error;
      }

      if (booking.Payment) {
        const error = new Error('Booking already has a payment');
        error.statusCode = 400;
        throw error;
      }

      if (booking.StatusID !== pendingStatus.StatusID) {
        const error = new Error('Booking is not pending');
        error.statusCode = 400;
        throw error;
      }

      if (new Date(booking.ExpiresAt) < new Date()) {
        const error = new Error('Booking has expired');
        error.statusCode = 400;
        throw error;
      }

      const transactionId = `TXN${Date.now()}${Math.random().toString(36).slice(2, 11)}`;

      const createdPayment = await tx.payment.create({
        data: {
          BookingID: Number(bookingId),
          MethodID: Number(methodId),
          StatusID: successPaymentStatus.StatusID,
          TransactionID: transactionId,
          Amount: booking.TotalAmount,
          PaidAt: new Date()
        }
      });

      await tx.booking.update({
        where: { BookingID: Number(bookingId) },
        data: { StatusID: completedStatus.StatusID }
      });

      for (const detail of booking.BookingDetails) {
        const finalPrice = Number(detail.Showtime.BasePrice) * Number(detail.Seat.SeatType.PriceModifier);
        await tx.ticket.create({
          data: {
            TicketNo: generateTicketNo(),
            DetailID: detail.DetailID,
            FinalPrice: finalPrice
          }
        });
      }

      return createdPayment;
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });

    res.status(201).json({
      message: 'Payment successful',
      payment
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }

    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Duplicate payment or ticket reference' });
    }

    if (error.code === 'P2034') {
      return res.status(409).json({ error: 'Payment conflict detected. Please try again.' });
    }

    console.error('Process payment error:', error);
    res.status(500).json({ error: 'Failed to process payment' });
  }
};
