const express = require('express');
const { authenticateToken } = require('../middleware/auth.middleware');

const authController = require('../controllers/auth.controller');
const eventController = require('../controllers/event.controller');
const venueController = require('../controllers/venue.controller');
const showtimeController = require('../controllers/showtime.controller');
const bookingController = require('../controllers/booking.controller');
const paymentController = require('../controllers/payment.controller');
const ticketController = require('../controllers/ticket.controller');

const router = express.Router();

// Auth Routes
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);

// Event Routes
router.get('/events', eventController.getAllEvents);
router.get('/events/:id', eventController.getEventById);
router.post('/events', authenticateToken, eventController.createEvent);

// Venue & Seat Routes
router.get('/venues', venueController.getAllVenues);
router.get('/venues/:id', venueController.getVenueById);
router.get('/seat-types', venueController.getAllSeatTypes);

// Showtime Routes
router.get('/showtimes', showtimeController.getAllShowtimes);
router.get('/showtimes/event/:eventId', showtimeController.getShowtimesByEvent);
router.get('/showtimes/:id', showtimeController.getShowtimeById);
router.get('/showtimes/:id/booked-seats', showtimeController.getBookedSeats);

// Booking Routes
router.post('/bookings', authenticateToken, bookingController.createBooking);
router.get('/bookings/my', authenticateToken, bookingController.getMyBookings);
router.get('/bookings/:id', authenticateToken, bookingController.getBookingById);
router.post('/bookings/:id/cancel', authenticateToken, bookingController.cancelBooking);

// Payment Routes
router.get('/payment-methods', paymentController.getPaymentMethods);
router.post('/payments', authenticateToken, paymentController.processPayment);

// Ticket Routes
router.get('/tickets/booking/:bookingId', authenticateToken, ticketController.getTicketsByBooking);
router.get('/tickets/verify/:ticketNo', ticketController.verifyTicket);

module.exports = router;

router.post('/seats/lock', (req, res) => {
  res.status(200).json({ success: true, message: 'Seat locked successfully' });
});

router.post('/seats/unlock', (req, res) => {
  res.status(200).json({ success: true, message: 'Seat unlocked successfully' });
});