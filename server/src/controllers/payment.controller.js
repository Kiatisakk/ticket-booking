const prisma = require('../config/prisma');

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

    const pendingStatus = await prisma.bookingStatus.findFirst({
      where: { StatusName: 'Pending' }
    });
    const completedStatus = await prisma.bookingStatus.findFirst({
      where: { StatusName: 'Completed' }
    });
    const successPaymentStatus = await prisma.paymentStatus.findFirst({
      where: { StatusName: 'Success' }
    });

    const booking = await prisma.booking.findUnique({
      where: { BookingID: bookingId }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.UserID !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (booking.StatusID !== pendingStatus?.StatusID) {
      return res.status(400).json({ error: 'Booking is not pending' });
    }

    if (booking.ExpiresAt && new Date(booking.ExpiresAt) < new Date()) {
      return res.status(400).json({ error: 'Booking has expired' });
    }

    const transactionId = `TXN${Date.now()}${Math.random().toString(36).substr(2, 9)}`;

    const payment = await prisma.payment.create({
      data: {
        BookingID: bookingId,
        MethodID: methodId,
        StatusID: successPaymentStatus?.StatusID,
        TransactionID: transactionId,
        Amount: booking.TotalAmount,
        PaidAt: new Date()
      }
    });

    await prisma.booking.update({
      where: { BookingID: bookingId },
      data: { StatusID: completedStatus?.StatusID }
    });

    const bookingDetails = await prisma.bookingDetail.findMany({
      where: { BookingID: bookingId }
    });

    for (const detail of bookingDetails) {
      const ticketNo = `TKT${Date.now()}${Math.random().toString(36).substr(2, 6)}`;
      await prisma.ticket.create({
        data: {
          TicketNo: ticketNo,
          DetailID: detail.DetailID,
          FinalPrice: booking.TotalAmount / bookingDetails.length
        }
      });
    }

    res.status(201).json({
      message: 'Payment successful',
      payment
    });
  } catch (error) {
    console.error('Process payment error:', error);
    res.status(500).json({ error: 'Failed to process payment' });
  }
};