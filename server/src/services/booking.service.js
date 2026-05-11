const HttpError = require('../utils/HttpError');
const bookingRepository = require('../repositories/booking.repository');
const roleRepository = require('../repositories/role.repository');

function normalizeSeatIds(seatIds) {
  if (!Array.isArray(seatIds)) {
    return [];
  }
  return [...new Set(seatIds.map(Number))].filter(Number.isInteger);
}

function createBookingService({
  bookings = bookingRepository,
  roles = roleRepository,
  now = () => new Date()
} = {}) {
  return {
    async createBooking({ userId, showtimeId, seatIds }) {
      if (!showtimeId || !Array.isArray(seatIds) || seatIds.length === 0) {
        throw new HttpError(400, 'Showtime and seats are required');
      }

      const normalizedSeatIds = normalizeSeatIds(seatIds);
      if (normalizedSeatIds.length !== seatIds.length) {
        throw new HttpError(400, 'Seat IDs must be unique integers');
      }

      return bookings.runSerializable(async (tx) => {
        const pendingStatus = await bookings.findStatus(tx, 'Pending');
        const completedStatus = await bookings.findStatus(tx, 'Completed');

        if (!pendingStatus || !completedStatus) {
          throw new HttpError(500, 'Booking statuses are not configured');
        }

        const parsedShowtimeId = Number(showtimeId);
        const showtime = await bookings.findShowtime(tx, parsedShowtimeId);
        if (!showtime) {
          throw new HttpError(404, 'Showtime not found');
        }

        if (new Date(showtime.StartDateTime) <= now()) {
          throw new HttpError(400, 'Cannot create booking for a past showtime');
        }

        const seats = await bookings.findSeats(tx, normalizedSeatIds);
        if (seats.length !== normalizedSeatIds.length) {
          throw new HttpError(400, 'One or more seats were not found');
        }

        const invalidVenueSeat = seats.find(seat => seat.VenueID !== showtime.VenueID);
        if (invalidVenueSeat) {
          throw new HttpError(400, 'Selected seats must belong to the showtime venue');
        }

        const activeBookings = await bookings.findActiveSeatBookings(tx, {
          showtimeId: parsedShowtimeId,
          seatIds: normalizedSeatIds,
          pendingStatusId: pendingStatus.StatusID,
          completedStatusId: completedStatus.StatusID,
          now: now()
        });

        if (activeBookings.length > 0) {
          throw new HttpError(400, 'Some seats are already booked');
        }

        const totalAmount = seats.reduce((sum, seat) => {
          return sum + Number(showtime.BasePrice) * Number(seat.SeatType.PriceModifier);
        }, 0);

        const expiresAt = now();
        expiresAt.setMinutes(expiresAt.getMinutes() + 15);

        return bookings.create(tx, {
          userId,
          statusId: pendingStatus.StatusID,
          expiresAt,
          totalAmount,
          showtimeId: parsedShowtimeId,
          seatIds: normalizedSeatIds
        });
      });
    },

    async getMyBookings(userId, query = {}) {
      const pending = await bookings.findBookingStatus('Pending');
      const cancelled = await bookings.findBookingStatus('Cancelled');

      if (pending && cancelled) {
        await bookings.expirePendingForUser(userId, pending.StatusID, cancelled.StatusID);
      }

      const statusMap = {
        pending: pending?.StatusID,
        cancelled: cancelled?.StatusID,
        completed: (await bookings.findBookingStatus('Completed'))?.StatusID
      };
      const statusId = statusMap[String(query.status || '').toLowerCase()];

      return bookings.findManyByUser(userId, query, { statusId });
    },

    async getBookingById({ bookingId, user }) {
      const booking = await bookings.findById(bookingId);
      if (!booking) {
        throw new HttpError(404, 'Booking not found');
      }

      const customerRole = await roles.findByName('Customer');
      if (booking.UserID !== user.userId && user.role === customerRole?.RoleID) {
        throw new HttpError(403, 'Unauthorized');
      }

      return booking;
    },

    async cancelBooking({ bookingId, userId }) {
      const pendingStatus = await bookings.findBookingStatus('Pending');
      const cancelledStatus = await bookings.findBookingStatus('Cancelled');

      const booking = await bookings.findBasicById(bookingId);
      if (!booking) {
        throw new HttpError(404, 'Booking not found');
      }

      if (booking.UserID !== userId) {
        throw new HttpError(403, 'Unauthorized');
      }

      if (booking.StatusID !== pendingStatus?.StatusID) {
        throw new HttpError(400, 'Booking cannot be cancelled');
      }

      await bookings.updateStatus(bookingId, cancelledStatus?.StatusID);
      return { message: 'Booking cancelled successfully' };
    },

    async expireBooking({ bookingId, userId }) {
      const pendingStatus = await bookings.findBookingStatus('Pending');
      const cancelledStatus = await bookings.findBookingStatus('Cancelled');

      if (!pendingStatus || !cancelledStatus) {
        throw new HttpError(500, 'Booking statuses are not configured');
      }

      const booking = await bookings.findBasicById(bookingId);
      if (!booking) {
        throw new HttpError(404, 'Booking not found');
      }

      if (booking.UserID !== userId) {
        throw new HttpError(403, 'Unauthorized');
      }

      if (booking.StatusID !== pendingStatus.StatusID) {
        return { message: 'Booking is no longer pending', expired: false };
      }

      if (new Date(booking.ExpiresAt) > now()) {
        throw new HttpError(400, 'Booking has not expired yet');
      }

      await bookings.updateExpiredPending(
        bookingId,
        userId,
        pendingStatus.StatusID,
        cancelledStatus.StatusID
      );

      return { message: 'Booking expired and seats released', expired: true };
    }
  };
}

module.exports = createBookingService();
module.exports.createBookingService = createBookingService;
