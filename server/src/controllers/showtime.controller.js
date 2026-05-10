const showtimeService = require('../services/showtime.service');
const asyncHandler = require('../utils/asyncHandler');

exports.getAllShowtimes = asyncHandler(async (req, res) => {
  const showtimes = await showtimeService.getAllShowtimes();
  res.json(showtimes);
});

exports.getShowtimesByEvent = asyncHandler(async (req, res) => {
  const showtimes = await showtimeService.getShowtimesByEvent(parseInt(req.params.eventId));
  res.json(showtimes);
});

exports.getShowtimeById = asyncHandler(async (req, res) => {
  const showtime = await showtimeService.getShowtimeById(parseInt(req.params.id));
  res.json(showtime);
});

exports.getBookedSeats = asyncHandler(async (req, res) => {
  const result = await showtimeService.getBookedSeats(parseInt(req.params.id));
  res.json(result);
});
