const test = require('node:test');
const assert = require('node:assert/strict');
const { _private } = require('../../src/controllers/admin/reports.controller');

test('buildCancellationHeatmapPayload keeps the cancellation heatmap response shape', () => {
  const payload = _private.buildCancellationHeatmapPayload([
    {
      venueName: 'Impact Arena',
      seatType: 'VIP',
      eventTitle: 'Concert',
      bookingYear: 2026,
      bookingMonth: 5,
      showtimeHour: 19,
      totalBooking: 10,
      cancelledCount: 2,
      cancelRatePercentage: 20
    }
  ]);

  assert.equal(payload.rows.length, 1);
  assert.equal(payload.rows[0].monthLabel, "May'26");
  assert.equal(payload.rows[0].showtimeLabel, '19:00');
  assert.equal(payload.heatmaps.length, 4);

  for (const heatmap of payload.heatmaps) {
    assert.ok(heatmap.title);
    assert.ok(heatmap.key);
    assert.ok(Array.isArray(heatmap.rows));
    assert.ok(Array.isArray(heatmap.cols));
    assert.ok(Array.isArray(heatmap.data));
  }
});
