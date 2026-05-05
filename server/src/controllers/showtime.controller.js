const prisma = require('../config/prisma');

exports.getAllShowtimes = async (req, res) => {
  try {
    const showtimes = await prisma.showtime.findMany({
      include: {
        Event: true,
        Venue: true
      }
    });
    res.json(showtimes);
  } catch (error) {
    console.error('Get showtimes error:', error);
    res.status(500).json({ error: 'Failed to fetch showtimes' });
  }
};

exports.getShowtimesByEvent = async (req, res) => {
  try {
    const showtimes = await prisma.showtime.findMany({
      where: { EventID: parseInt(req.params.eventId) },
      include: {
        Venue: true
      }
    });
    res.json(showtimes);
  } catch (error) {
    console.error('Get showtimes error:', error);
    res.status(500).json({ error: 'Failed to fetch showtimes' });
  }
};

exports.getShowtimeById = async (req, res) => {
  try {
    const showtime = await prisma.showtime.findUnique({
      where: { ShowtimeID: parseInt(req.params.id) },
      include: {
        Event: true,
        Venue: {
          include: {
            Seats: {
              include: {
                SeatType: true
              }
            }
          }
        }
      }
    });

    if (!showtime) {
      return res.status(404).json({ error: 'Showtime not found' });
    }

    res.json(showtime);
  } catch (error) {
    console.error('Get showtime error:', error);
    res.status(500).json({ error: 'Failed to fetch showtime' });
  }
};

exports.getBookedSeats = async (req, res) => {
  try {
    const showtimeId = parseInt(req.params.id);

    // A seat is "booked" if a BookingDetail exists for that showtime with a
    // non-cancelled booking. We exclude cancelled bookings so seats freed up
    // via refund/cancel become available again.
    const bookedDetails = await prisma.bookingDetail.findMany({
      where: {
        ShowtimeID: showtimeId,
        Booking: {
          Status: { StatusName: { not: 'Cancelled' } }
        }
      },
      select: { SeatID: true }
    });

    res.json({ bookedSeatIds: bookedDetails.map(d => d.SeatID) });
  } catch (error) {
    console.error('Get booked seats error:', error);
    res.status(500).json({ error: 'Failed to fetch booked seats' });
  }
};
