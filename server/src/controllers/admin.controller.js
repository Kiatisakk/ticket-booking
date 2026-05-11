const auth = require('./admin/auth.controller');
const events = require('./admin/events.controller');
const bookings = require('./admin/bookings.controller');
const transactions = require('./admin/transactions.controller');
const users = require('./admin/users.controller');
const staffManagement = require('./admin/staffManagement.controller');
const masterData = require('./admin/masterData.controller');
const reports = require('./admin/reports.controller');

module.exports = {
  ...auth,
  ...events,
  ...bookings,
  ...transactions,
  ...users,
  ...staffManagement,
  ...masterData,
  ...reports
};
