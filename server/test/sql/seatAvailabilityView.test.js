const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('optimized ShowtimeAvailableSeats view uses status ids and expiry check for active seat lookup', () => {
  const sql = fs.readFileSync(
    path.join(__dirname, '../../prisma/migrations/seat_availability_view_optimization.sql'),
    'utf8'
  );

  assert.match(sql, /CREATE OR REPLACE VIEW "ShowtimeAvailableSeats"/);
  assert.match(sql, /WITH active_statuses AS/);
  assert.match(sql, /"StatusName" = 'Completed'/);
  assert.match(sql, /"StatusName" = 'Pending'/);
  assert.match(sql, /b\."ExpiresAt" > NOW\(\)/);
  assert.doesNotMatch(sql, /JOIN "BookingStatuses" bs/);
});
