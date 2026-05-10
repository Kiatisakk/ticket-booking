const prisma = require('../config/prisma');

function createVenueRepository(db = prisma) {
  return {
    findAll() {
      return db.venue.findMany();
    },

    findById(venueId) {
      return db.venue.findUnique({
        where: { VenueID: venueId },
        include: {
          Seats: {
            include: { SeatType: true }
          }
        }
      });
    },

    findAllSeatTypes() {
      return db.seatType.findMany();
    }
  };
}

module.exports = createVenueRepository();
module.exports.createVenueRepository = createVenueRepository;
