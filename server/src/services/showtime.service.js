const HttpError = require('../utils/HttpError');
const showtimeRepository = require('../repositories/showtime.repository');

function createShowtimeService({ showtimes = showtimeRepository } = {}) {
  return {
    getAllShowtimes(query = {}) {
      return showtimes.findAll(query);
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
      if (showtimes.findSeatAvailability) {
        const availability = await showtimes.findSeatAvailability(showtimeId);
        const seats = availability.map(row => ({
          showtimeId: Number(row.ShowtimeID),
          seatId: Number(row.SeatID),
          rowLabel: row.RowLabel,
          seatNumber: row.SeatNumber,
          seatTypeId: Number(row.SeatTypeID),
          seatTypeName: row.SeatTypeName,
          basePrice: Number(row.BasePrice),
          priceModifier: Number(row.PriceModifier),
          calculatedPrice: Number(row.CalculatedPrice),
          isAvailable: Boolean(row.IsAvailable)
        }));

        return {
          bookedSeatIds: seats.filter(seat => !seat.isAvailable).map(seat => seat.seatId),
          seats
        };
      }

      const bookedDetails = await showtimes.findBookedSeatIds(showtimeId);
      return { bookedSeatIds: bookedDetails.map(detail => detail.SeatID), seats: [] };
    }
  };
}

module.exports = createShowtimeService();
module.exports.createShowtimeService = createShowtimeService;
