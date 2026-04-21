const prisma = require('../config/prisma');

exports.getTicketsByBooking = async (req, res) => {
  try {
    const tickets = await prisma.ticket.findMany({
      where: {
        Detail: {
          BookingID: parseInt(req.params.bookingId)
        }
      },
      include: {
        Detail: {
          include: {
            Booking: true,
            Showtime: {
              include: {
                Event: true,
                Venue: true
              }
            },
            Seat: {
              include: {
                SeatType: true
              }
            }
          }
        }
      }
    });

    res.json(tickets);
  } catch (error) {
    console.error('Get tickets error:', error);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
};

exports.verifyTicket = async (req, res) => {
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { TicketNo: req.params.ticketNo },
      include: {
        Detail: {
          include: {
            Showtime: {
              include: {
                Event: true,
                Venue: true
              }
            },
            Seat: true
          }
        }
      }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    res.json({ valid: true, ticket });
  } catch (error) {
    console.error('Verify ticket error:', error);
    res.status(500).json({ error: 'Failed to verify ticket' });
  }
};