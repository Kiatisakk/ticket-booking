const eventService = require('../../services/adminEvent.service');
const asyncHandler = require('../../utils/asyncHandler');

exports.getAllEvents = asyncHandler(async (req, res) => {
  res.json(await eventService.list(req.query));
});

exports.getEventById = asyncHandler(async (req, res) => {
  res.json(await eventService.getById(parseInt(req.params.id, 10), { audience: 'admin' }));
});

exports.createEvent = asyncHandler(async (req, res) => {
  const event = await eventService.create(req.body, { audience: 'admin' });
  res.status(201).json({ message: 'Event created successfully', id: event.EventID });
});

exports.updateEvent = asyncHandler(async (req, res) => {
  const eventId = parseInt(req.params.id, 10);
  await eventService.update(eventId, req.body, { audience: 'admin' });
  res.json({ message: 'Event updated successfully', id: eventId });
});

exports.deleteEvent = asyncHandler(async (req, res) => {
  await eventService.delete(parseInt(req.params.id, 10));
  res.json({ message: 'Event deleted successfully' });
});
