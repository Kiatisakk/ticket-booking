const paymentService = require('../services/payment.service');
const asyncHandler = require('../utils/asyncHandler');

exports.getPaymentMethods = asyncHandler(async (req, res) => {
  const methods = await paymentService.getPaymentMethods();
  res.json(methods);
});

exports.processPayment = asyncHandler(async (req, res) => {
  const payment = await paymentService.processPayment({
    userId: req.user.userId,
    bookingId: req.body.bookingId,
    methodId: req.body.methodId
  });

  res.status(201).json({
    message: 'Payment successful',
    payment
  });
});
