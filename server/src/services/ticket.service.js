const HttpError = require('../utils/HttpError');
const ticketRepository = require('../repositories/ticket.repository');

function createTicketService({ tickets = ticketRepository } = {}) {
  return {
    async getTicketsByBooking({ bookingId, userId }) {
      const booking = await tickets.findBookingOwner(bookingId);
      if (!booking) {
        throw new HttpError(404, 'Booking not found');
      }

      if (booking.UserID !== userId) {
        throw new HttpError(403, 'Unauthorized: you can only view your own tickets');
      }

      return tickets.findByBooking(bookingId);
    },

    async verifyTicket(ticketNo) {
      const ticket = await tickets.findByTicketNo(ticketNo);
      if (!ticket) {
        throw new HttpError(404, 'Ticket not found');
      }

      const bookingStatus = ticket.Detail?.Booking?.Status?.StatusName;
      if (bookingStatus !== 'Completed') {
        return { valid: false, reason: `Booking is ${bookingStatus}`, ticket };
      }

      return { valid: true, ticket };
    }
  };
}

module.exports = createTicketService();
module.exports.createTicketService = createTicketService;
