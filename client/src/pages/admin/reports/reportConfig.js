export const REPORTS = [
  {
    id: 'revenue-by-category',
    no: 1,
    title: 'Revenue by Category',
    endpoint: 'revenue-by-category',
    chart: 'bar',
    description: 'Monthly revenue split by event category.',
    filters: ['date', 'category']
  },
  {
    id: 'seat-heatmap',
    no: 2,
    title: 'Seat Popularity Heatmap',
    endpoint: 'seat-heatmap',
    chart: 'seatHeatmap',
    description: 'Seat selection frequency for a selected venue.',
    filters: ['date', 'category', 'venue'],
    requireVenue: true
  },
  {
    id: 'user-growth',
    no: 3,
    title: 'Platform User Growth',
    endpoint: 'user-growth',
    chart: 'line',
    description: 'Monthly new user registrations.',
    filters: ['date']
  },
  {
    id: 'revenue-by-venue',
    no: 4,
    title: 'Revenue by Venue',
    endpoint: 'revenue-by-venue',
    chart: 'line',
    description: 'Monthly revenue grouped by venue.',
    filters: ['date', 'category']
  },
  {
    id: 'bookings-by-hour',
    no: 5,
    title: 'Bookings by Hour',
    endpoint: 'bookings-by-hour',
    chart: 'bar',
    description: 'Booking volume by hour of day.',
    filters: ['date', 'category']
  },
  {
    id: 'booking-vs-capacity',
    no: 6,
    title: 'Booking vs Capacity',
    endpoint: 'booking-vs-capacity',
    chart: 'horizontalBar',
    description: 'Sold tickets compared with venue capacity.',
    filters: ['date', 'category', 'venue']
  },
  {
    id: 'venue-utilization',
    no: 7,
    title: 'Venue Utilization by Category',
    endpoint: 'venue-utilization',
    chart: 'bar',
    description: 'Showtime usage by venue and category.',
    filters: ['date', 'category']
  },
  {
    id: 'seat-type-revenue',
    no: 8,
    title: 'Seat Type Revenue',
    endpoint: 'seat-type-revenue',
    chart: 'doughnut',
    description: 'Revenue share by seat type.',
    filters: ['date', 'category']
  },
  {
    id: 'customer-retention',
    no: 9,
    title: 'Customer Retention',
    endpoint: 'customer-retention',
    chart: 'doughnut',
    description: 'Repeat customers vs one-time customers.',
    filters: ['date', 'category']
  },
  {
    id: 'interest-by-category',
    no: 10,
    title: 'Customer Interest by Category',
    endpoint: 'interest-by-category',
    chart: 'line',
    description: 'Booking interest trend by category.',
    filters: ['date', 'category']
  },
  {
    id: 'peak-showtime-hours',
    no: 11,
    title: 'Peak Showtime Hours',
    endpoint: 'peak-showtime-hours',
    chart: 'bar',
    description: 'Tickets sold by showtime hour and category.',
    filters: ['date', 'category']
  },
  {
    id: 'failed-payment-rate',
    no: 12,
    title: 'Failed Payment Rate Heatmap',
    endpoint: 'cancellation-heatmap',
    chart: 'failureHeatmap',
    description: 'Failed payment rate by seat type and event.',
    filters: ['date', 'category']
  }
];

export function getReportById(reportId) {
  return REPORTS.find(report => report.id === reportId) || REPORTS[0];
}
