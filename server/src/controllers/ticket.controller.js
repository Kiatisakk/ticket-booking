const prisma = require('../config/prisma');

exports.getTicketsByBooking = async (req, res) => {
  try {
    const bookingId = parseInt(req.params.bookingId);

    // Ownership check: only the booking owner can view tickets
    const booking = await prisma.booking.findUnique({
      where: { BookingID: bookingId },
      select: { UserID: true }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.UserID !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized: you can only view your own tickets' });
    }

    const tickets = await prisma.ticket.findMany({
      where: {
        Detail: {
          BookingID: bookingId
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
            Booking: {
              include: { Status: true }
            },
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

    // Check if the booking is still Completed
    const bookingStatus = ticket.Detail?.Booking?.Status?.StatusName;
    if (bookingStatus !== 'Completed') {
      return res.json({ valid: false, reason: 'Booking is ' + bookingStatus, ticket });
    }

    res.json({ valid: true, ticket });
  } catch (error) {
    console.error('Verify ticket error:', error);
    res.status(500).json({ error: 'Failed to verify ticket' });
  }
};
