const HttpError = require('../utils/HttpError');
const venueRepository = require('../repositories/venue.repository');

function createVenueService({ venues = venueRepository } = {}) {
  return {
    getAllVenues() {
      return venues.findAll();
    },

    async getVenueById(venueId) {
      const venue = await venues.findById(venueId);
      if (!venue) {
        throw new HttpError(404, 'Venue not found');
      }
      return venue;
    },

    getAllSeatTypes() {
      return venues.findAllSeatTypes();
    }
  };
}

module.exports = createVenueService();
module.exports.createVenueService = createVenueService;
