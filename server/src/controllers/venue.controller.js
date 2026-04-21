const prisma = require('../config/prisma');

exports.getAllVenues = async (req, res) => {
  try {
    const venues = await prisma.venue.findMany();
    res.json(venues);
  } catch (error) {
    console.error('Get venues error:', error);
    res.status(500).json({ error: 'Failed to fetch venues' });
  }
};

exports.getVenueById = async (req, res) => {
  try {
    const venue = await prisma.venue.findUnique({
      where: { VenueID: parseInt(req.params.id) },
      include: {
        Seats: {
          include: {
            SeatType: true
          }
        }
      }
    });

    if (!venue) {
      return res.status(404).json({ error: 'Venue not found' });
    }

    res.json(venue);
  } catch (error) {
    console.error('Get venue error:', error);
    res.status(500).json({ error: 'Failed to fetch venue' });
  }
};

exports.getAllSeatTypes = async (req, res) => {
  try {
    const seatTypes = await prisma.seatType.findMany();
    res.json(seatTypes);
  } catch (error) {
    console.error('Get seat types error:', error);
    res.status(500).json({ error: 'Failed to fetch seat types' });
  }
};