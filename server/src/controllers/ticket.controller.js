const ticketService = require('../services/ticket.service');
const asyncHandler = require('../utils/asyncHandler');

exports.getTicketsByBooking = asyncHandler(async (req, res) => {
  const tickets = await ticketService.getTicketsByBooking({
    bookingId: parseInt(req.params.bookingId),
    userId: req.user.userId
  });
  res.json(tickets);
});

exports.verifyTicket = asyncHandler(async (req, res) => {
  const result = await ticketService.verifyTicket(req.params.ticketNo);
  res.json(result);
});
