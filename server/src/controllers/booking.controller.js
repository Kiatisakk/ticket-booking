const bookingService = require('../services/booking.service');
const asyncHandler = require('../utils/asyncHandler');

exports.createBooking = asyncHandler(async (req, res) => {
  const booking = await bookingService.createBooking({
    userId: req.user.userId,
    showtimeId: req.body.showtimeId,
    seatIds: req.body.seatIds
  });

  res.status(201).json({
    message: 'Booking created successfully',
    booking
  });
});

exports.getMyBookings = asyncHandler(async (req, res) => {
  const bookings = await bookingService.getMyBookings(req.user.userId, req.query);
  res.json(bookings);
});

exports.getBookingById = asyncHandler(async (req, res) => {
  const booking = await bookingService.getBookingById({
    bookingId: parseInt(req.params.id),
    user: req.user
  });
  res.json(booking);
});

exports.cancelBooking = asyncHandler(async (req, res) => {
  const result = await bookingService.cancelBooking({
    bookingId: parseInt(req.params.id),
    userId: req.user.userId
  });
  res.json(result);
});

exports.expireBooking = asyncHandler(async (req, res) => {
  const result = await bookingService.expireBooking({
    bookingId: parseInt(req.params.id),
    userId: req.user.userId
  });
  res.json(result);
});
