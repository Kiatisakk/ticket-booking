const express = require('express');
const { authenticateToken } = require('../middleware/auth.middleware');
const { authenticateAdmin } = require('../middleware/adminAuth.middleware');
const { authenticateStaff } = require('../middleware/staffAuth.middleware');

const authController = require('../controllers/auth.controller');
const eventController = require('../controllers/event.controller');
const venueController = require('../controllers/venue.controller');
const showtimeController = require('../controllers/showtime.controller');
const bookingController = require('../controllers/booking.controller');
const paymentController = require('../controllers/payment.controller');
const ticketController = require('../controllers/ticket.controller');
const adminController = require('../controllers/admin.controller');
const staffController = require('../controllers/staff.controller');
const seatLockController = require('../controllers/seatLock.controller');

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
router.post('/bookings/:id/expire', authenticateToken, bookingController.expireBooking);
router.post('/bookings/:id/cancel', authenticateToken, bookingController.cancelBooking);

// Payment Routes
router.get('/payment-methods', paymentController.getPaymentMethods);
router.post('/payments', authenticateToken, paymentController.processPayment);

// Ticket Routes
router.get('/tickets/booking/:bookingId', authenticateToken, ticketController.getTicketsByBooking);
router.get('/tickets/verify/:ticketNo', ticketController.verifyTicket);

// ─── Admin Routes ─────────────────────────────────────────────────────────────

// Admin Auth (no middleware — public)
router.post('/admin/auth/login', adminController.adminLogin);

// Admin Staff Management
router.post('/admin/staff/add', authenticateAdmin, adminController.addStaffUser);
router.get('/admin/staff', authenticateAdmin, adminController.getAllStaff);

// Admin Lookup
router.get('/admin/categories', authenticateAdmin, adminController.getCategories);
router.get('/admin/venues',     authenticateAdmin, adminController.getAdminVenues);
router.get('/admin/settings', authenticateAdmin, adminController.getSystemSettings);
router.patch('/admin/settings/payment-methods/:id', authenticateAdmin, adminController.updatePaymentMethod);

// Admin Events
router.get('/admin/events', authenticateAdmin, adminController.getAllEvents);
router.get('/admin/events/:id', authenticateAdmin, adminController.getEventById);
router.post('/admin/events', authenticateAdmin, adminController.createEvent);
router.put('/admin/events/:id', authenticateAdmin, adminController.updateEvent);
router.delete('/admin/events/:id', authenticateAdmin, adminController.deleteEvent);

// Admin Users
router.get('/admin/users', authenticateAdmin, adminController.getAllUsers);
router.patch('/admin/users/:id/role', authenticateAdmin, adminController.updateUserRole);
router.delete('/admin/users/:id', authenticateAdmin, adminController.deleteUser);

// Admin Bookings
router.get('/admin/bookings', authenticateAdmin, adminController.getAllBookings);

// Admin Transactions
router.get('/admin/transactions', authenticateAdmin, adminController.getAllTransactions);
router.patch('/admin/transactions/:id/refund', authenticateAdmin, adminController.refundTransaction);
router.patch('/admin/transactions/:id/mark-paid', authenticateAdmin, adminController.markAsPaid);

// Admin Reports
router.get('/admin/reports/kpi',                  authenticateAdmin, adminController.getReportKpi);
router.get('/admin/reports/revenue-by-category',  authenticateAdmin, adminController.getRevenueByCategory);
router.get('/admin/reports/user-growth',           authenticateAdmin, adminController.getUserGrowth);
router.get('/admin/reports/revenue-by-venue',      authenticateAdmin, adminController.getRevenueByVenue);
router.get('/admin/reports/bookings-by-hour',      authenticateAdmin, adminController.getBookingsByHour);
router.get('/admin/reports/booking-vs-capacity',   authenticateAdmin, adminController.getBookingVsCapacity);
router.get('/admin/reports/venue-utilization',     authenticateAdmin, adminController.getVenueUtilization);
router.get('/admin/reports/seat-type-revenue',     authenticateAdmin, adminController.getSeatTypeRevenue);
router.get('/admin/reports/customer-retention',    authenticateAdmin, adminController.getCustomerRetention);
router.get('/admin/reports/interest-by-category', authenticateAdmin, adminController.getInterestByCategory);
router.get('/admin/reports/peak-showtime-hours',   authenticateAdmin, adminController.getPeakShowtimeHours);
router.get('/admin/reports/seat-heatmap',          authenticateAdmin, adminController.getSeatHeatmap);
router.get('/admin/reports/cancellation-heatmap',  authenticateAdmin, adminController.getCancellationHeatmap);

// ─── Staff Routes ─────────────────────────────────────────────────────────────

// Staff Auth (no middleware — public)
router.post('/staff/auth/login', adminController.staffLogin);

// Staff Events
router.get('/staff/categories', authenticateStaff, adminController.getCategories);
router.get('/staff/venues', authenticateStaff, adminController.getAdminVenues);
router.get('/staff/events', authenticateStaff, staffController.getAllEvents);
router.get('/staff/events/:id', authenticateStaff, staffController.getEventById);
router.post('/staff/events', authenticateStaff, staffController.createEvent);
router.put('/staff/events/:id', authenticateStaff, staffController.updateEvent);
router.delete('/staff/events/:id', authenticateStaff, staffController.deleteEvent);

// Staff Bookings
router.get('/staff/bookings', authenticateStaff, staffController.getAllBookings);

// Staff Transactions
router.get('/staff/transactions', authenticateStaff, staffController.getAllTransactions);

// Staff Dashboard
router.get('/staff/dashboard', authenticateStaff, staffController.getDashboard);

// Seat Lock Routes
router.post('/seats/lock', seatLockController.lockSeat);
router.post('/seats/unlock', seatLockController.unlockSeats);

module.exports = router;
