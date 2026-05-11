const express = require('express');
const { authenticateAdmin } = require('../middleware/adminAuth.middleware');
const reportsController = require('../controllers/admin/reports.controller');

const router = express.Router();

router.get('/kpi', authenticateAdmin, reportsController.getReportKpi);
router.get('/revenue-by-category', authenticateAdmin, reportsController.getRevenueByCategory);
router.get('/user-growth', authenticateAdmin, reportsController.getUserGrowth);
router.get('/revenue-by-venue', authenticateAdmin, reportsController.getRevenueByVenue);
router.get('/bookings-by-month', authenticateAdmin, reportsController.getBookingsByMonth);
router.get('/bookings-by-hour', authenticateAdmin, reportsController.getBookingsByMonth);
router.get('/booking-vs-capacity', authenticateAdmin, reportsController.getBookingVsCapacity);
router.get('/venue-utilization', authenticateAdmin, reportsController.getVenueUtilization);
router.get('/seat-type-revenue', authenticateAdmin, reportsController.getSeatTypeRevenue);
router.get('/customer-retention', authenticateAdmin, reportsController.getCustomerRetention);
router.get('/interest-by-category', authenticateAdmin, reportsController.getInterestByCategory);
router.get('/peak-showtime-hours', authenticateAdmin, reportsController.getPeakShowtimeHours);
router.get('/seat-heatmap', authenticateAdmin, reportsController.getSeatHeatmap);
router.get('/cancellation-heatmap', authenticateAdmin, reportsController.getCancellationHeatmap);

module.exports = router;
