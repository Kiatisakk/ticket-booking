const venueService = require('../services/venue.service');
const asyncHandler = require('../utils/asyncHandler');

exports.getAllVenues = asyncHandler(async (req, res) => {
  const venues = await venueService.getAllVenues();
  res.json(venues);
});

exports.getVenueById = asyncHandler(async (req, res) => {
  const venue = await venueService.getVenueById(parseInt(req.params.id));
  res.json(venue);
});

exports.getAllSeatTypes = asyncHandler(async (req, res) => {
  const seatTypes = await venueService.getAllSeatTypes();
  res.json(seatTypes);
});
