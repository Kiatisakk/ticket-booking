const prisma = require('../config/prisma');

function createShowtimeRepository(db = prisma) {
  return {
    findAll() {
      return db.showtime.findMany({
        include: {
          Event: true,
          Venue: true
        }
      });
    },

    findByEvent(eventId) {
      return db.showtime.findMany({
        where: { EventID: eventId },
        include: { Venue: true }
      });
    },

    findById(showtimeId) {
      return db.showtime.findUnique({
        where: { ShowtimeID: showtimeId },
        include: {
          Event: true,
          Venue: {
            include: {
              Seats: {
                include: { SeatType: true }
              }
            }
          }
        }
      });
    },

    findBookedSeatIds(showtimeId, now = new Date()) {
      return db.bookingDetail.findMany({
        where: {
          ShowtimeID: showtimeId,
          Booking: {
            OR: [
              { Status: { StatusName: 'Completed' } },
              { Status: { StatusName: 'Pending' }, ExpiresAt: { gt: now } }
            ]
          }
        },
        select: { SeatID: true }
      });
    },

    async findSeatAvailability(showtimeId) {
      const queryView = () => db.$queryRaw`
        SELECT
          "ShowtimeID",
          "SeatID",
          "RowLabel",
          "SeatNumber",
          "SeatTypeID",
          "SeatTypeName",
          "BasePrice",
          "PriceModifier",
          "CalculatedPrice",
          "IsAvailable"
        FROM "ShowtimeAvailableSeats"
        WHERE "ShowtimeID" = ${showtimeId}
        ORDER BY "RowLabel" ASC, "SeatNumber" ASC
      `;

      const queryFallback = () => db.$queryRaw`
        SELECT
          sh."ShowtimeID",
          s."SeatID",
          s."RowLabel",
          s."SeatNumber",
          st."SeatTypeID",
          st."TypeName" AS "SeatTypeName",
          sh."BasePrice",
          st."PriceModifier",
          (sh."BasePrice" * st."PriceModifier")::DECIMAL(10, 2) AS "CalculatedPrice",
          NOT EXISTS (
            SELECT 1
            FROM "BookingDetails" bd
            JOIN "Bookings" b ON b."BookingID" = bd."BookingID"
            JOIN "BookingStatuses" bs ON bs."StatusID" = b."StatusID"
            WHERE bd."ShowtimeID" = sh."ShowtimeID"
              AND bd."SeatID" = s."SeatID"
              AND (
                bs."StatusName" = 'Completed'
                OR (bs."StatusName" = 'Pending' AND b."ExpiresAt" > NOW())
              )
          ) AS "IsAvailable"
        FROM "Showtimes" sh
        JOIN "Seats" s ON s."VenueID" = sh."VenueID"
        JOIN "SeatTypes" st ON st."SeatTypeID" = s."SeatTypeID"
        WHERE sh."ShowtimeID" = ${showtimeId}
        ORDER BY s."RowLabel" ASC, s."SeatNumber" ASC
      `;

      try {
        return await queryView();
      } catch (error) {
        return queryFallback();
      }
    }
  };
}

module.exports = createShowtimeRepository();
module.exports.createShowtimeRepository = createShowtimeRepository;
