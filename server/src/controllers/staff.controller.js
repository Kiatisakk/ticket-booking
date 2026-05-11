const eventService = require('../services/adminEvent.service');
const asyncHandler = require('../utils/asyncHandler');

exports.getAllEvents = asyncHandler(async (req, res) => {
  res.json(await eventService.list(req.query));
});

exports.getEventById = asyncHandler(async (req, res) => {
  res.json(await eventService.getById(parseInt(req.params.id, 10), { audience: 'staff' }));
});

exports.createEvent = asyncHandler(async (req, res) => {
  const event = await eventService.create(req.body, { audience: 'staff' });
  res.status(201).json({
    message: 'Event created successfully',
    event: {
      id: event.EventID,
      title: event.Title,
      description: event.Description,
      category: event.Category?.CategoryName
    }
  });
});

exports.updateEvent = asyncHandler(async (req, res) => {
  const updatedEvent = await eventService.update(parseInt(req.params.id, 10), req.body, { audience: 'staff' });
  res.json({
    message: 'Event updated successfully',
    event: {
      id: updatedEvent.EventID,
      title: updatedEvent.Title,
      description: updatedEvent.Description,
      category: updatedEvent.Category?.CategoryName
    }
  });
});

exports.deleteEvent = asyncHandler(async (req, res) => {
  await eventService.delete(parseInt(req.params.id, 10));
  res.json({ message: 'Event deleted successfully' });
});
