const legacy = require('./admin.legacy.controller');
const auth = require('./admin/auth.controller');
const events = require('./admin/events.controller');
const bookings = require('./admin/bookings.controller');
const transactions = require('./admin/transactions.controller');
const users = require('./admin/users.controller');

module.exports = {
  ...legacy,
  ...auth,
  ...events,
  ...bookings,
  ...transactions,
  ...users
};
