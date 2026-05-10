const HttpError = require('../utils/HttpError');
const showtimeRepository = require('../repositories/showtime.repository');

function createShowtimeService({ showtimes = showtimeRepository } = {}) {
  return {
    getAllShowtimes() {
      return showtimes.findAll();
    },

    getShowtimesByEvent(eventId) {
      return showtimes.findByEvent(eventId);
    },

    async getShowtimeById(showtimeId) {
      const showtime = await showtimes.findById(showtimeId);
      if (!showtime) {
        throw new HttpError(404, 'Showtime not found');
      }
      return showtime;
    },

    async getBookedSeats(showtimeId) {
      const bookedDetails = await showtimes.findBookedSeatIds(showtimeId);
      return { bookedSeatIds: bookedDetails.map(detail => detail.SeatID) };
    }
  };
}

module.exports = createShowtimeService();
module.exports.createShowtimeService = createShowtimeService;
