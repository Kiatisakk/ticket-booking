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
    const bookedSeats = await prisma.$queryRaw`
      SELECT "SeatID"
      FROM "ShowtimeAvailableSeats"
      WHERE "ShowtimeID" = ${showtimeId}
        AND "IsAvailable" = FALSE
    `;

    res.json({ bookedSeatIds: bookedSeats.map(d => d.SeatID) });
  } catch (error) {
    console.error('Get booked seats error:', error);
    res.status(500).json({ error: 'Failed to fetch booked seats' });
  }
};
