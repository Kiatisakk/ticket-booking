const eventService = require('../services/event.service');
const asyncHandler = require('../utils/asyncHandler');

exports.getAllEvents = asyncHandler(async (req, res) => {
  const events = await eventService.getAllEvents(req.query);
  res.json(events);
});

exports.getEventById = asyncHandler(async (req, res) => {
  const event = await eventService.getEventById(parseInt(req.params.id));
  res.json(event);
});

exports.createEvent = asyncHandler(async (req, res) => {
  const event = await eventService.createEvent({
    user: req.user,
    title: req.body.title,
    description: req.body.description,
    categoryId: req.body.categoryId
  });
  res.status(201).json(event);
});
