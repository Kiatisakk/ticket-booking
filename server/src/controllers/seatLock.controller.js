const seatLockService = require('../services/seatLock.service');
const asyncHandler = require('../utils/asyncHandler');

exports.lockSeat = asyncHandler(async (req, res) => {
  const result = await seatLockService.lockSeat({
    seatId: req.body.seatId,
    showtimeId: req.body.showtimeId
  });
  res.json(result);
});

exports.unlockSeats = asyncHandler(async (req, res) => {
  const result = await seatLockService.unlockSeats();
  res.json(result);
});
