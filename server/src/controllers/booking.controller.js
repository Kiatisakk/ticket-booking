const prisma = require('../config/prisma');
const { Prisma } = require('@prisma/client');

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

exports.createBooking = async (req, res) => {
  try {
    console.log('req.user:', req.user);
    const { showtimeId, seatIds } = req.body;

    if (!showtimeId || !Array.isArray(seatIds) || seatIds.length === 0) {
      return res.status(400).json({ error: 'Showtime and seats are required' });
    }

    const normalizedSeatIds = [...new Set(seatIds.map(Number))].filter(Number.isInteger);
    if (normalizedSeatIds.length !== seatIds.length) {
      return res.status(400).json({ error: 'Seat IDs must be unique integers' });
    }

    const booking = await prisma.$transaction(async (tx) => {
      const pendingStatus = await tx.bookingStatus.findFirst({
        where: { StatusName: 'Pending' }
      });
      const completedStatus = await tx.bookingStatus.findFirst({
        where: { StatusName: 'Completed' }
      });

      if (!pendingStatus || !completedStatus) {
        throw new HttpError(500, 'Booking statuses are not configured');
      }

      const showtime = await tx.showtime.findUnique({
        where: { ShowtimeID: Number(showtimeId) }
      });

      if (!showtime) {
        throw new HttpError(404, 'Showtime not found');
      }

      if (new Date(showtime.StartDateTime) <= new Date()) {
        throw new HttpError(400, 'Cannot create booking for a past showtime');
      }

      const seats = await tx.seat.findMany({
        where: { SeatID: { in: normalizedSeatIds } },
        include: { SeatType: true }
      });

      if (seats.length !== normalizedSeatIds.length) {
        throw new HttpError(400, 'One or more seats were not found');
      }

      const invalidVenueSeat = seats.find(seat => seat.VenueID !== showtime.VenueID);
      if (invalidVenueSeat) {
        throw new HttpError(400, 'Selected seats must belong to the showtime venue');
      }

      const existingActiveBookings = await tx.bookingDetail.findMany({
        where: {
          ShowtimeID: Number(showtimeId),
          SeatID: { in: normalizedSeatIds },
          Booking: {
            OR: [
              { StatusID: completedStatus.StatusID },
              {
                StatusID: pendingStatus.StatusID,
                ExpiresAt: { gt: new Date() }
              }
            ]
          }
        },
        select: { SeatID: true }
      });

      if (existingActiveBookings.length > 0) {
        throw new HttpError(400, 'Some seats are already booked');
      }

      const totalAmount = seats.reduce((sum, seat) => {
        return sum + Number(showtime.BasePrice) * Number(seat.SeatType.PriceModifier);
      }, 0);

      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 15);

      return tx.booking.create({
        data: {
          UserID: req.user.userId,
          StatusID: pendingStatus.StatusID,
          ExpiresAt: expiresAt,
          TotalAmount: totalAmount,
          BookingDetails: {
            create: normalizedSeatIds.map(seatId => ({
              ShowtimeID: Number(showtimeId),
              SeatID: seatId
            }))
          }
        },
        include: {
          BookingDetails: true
        }
      });
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });

    res.status(201).json({
      message: 'Booking created successfully',
      booking
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.statusCode).json({ error: error.message });
    }

    if (error.code === 'P2034') {
      return res.status(409).json({ error: 'Booking conflict detected. Please try again.' });
    }

    console.error('Create booking error:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
};

exports.getMyBookings = async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { UserID: req.user.userId },
      include: {
        Status: true,
        BookingDetails: {
          include: {
            Showtime: {
              include: {
                Event: true
              }
            },
            Seat: {
              include: {
                SeatType: true
              }
            }
          }
        },
        Payment: true
      },
      orderBy: { BookingTimestamp: 'desc' }
    });

    res.json(bookings);
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
};

exports.getBookingById = async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { BookingID: parseInt(req.params.id) },
      include: {
        Status: true,
        BookingDetails: {
          include: {
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
            },
            Ticket: true
          }
        },
        Payment: {
          include: {
            Method: true,
            Status: true
          }
        }
      }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const customerRole = await prisma.role.findFirst({
      where: { RoleName: 'Customer' }
    });

    if (booking.UserID !== req.user.userId && req.user.role === customerRole?.RoleID) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json(booking);
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
};

exports.cancelBooking = async (req, res) => {
  try {
    const pendingStatus = await prisma.bookingStatus.findFirst({
      where: { StatusName: 'Pending' }
    });
    const cancelledStatus = await prisma.bookingStatus.findFirst({
      where: { StatusName: 'Cancelled' }
    });

    const booking = await prisma.booking.findUnique({
      where: { BookingID: parseInt(req.params.id) }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.UserID !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (booking.StatusID !== pendingStatus?.StatusID) {
      return res.status(400).json({ error: 'Booking cannot be cancelled' });
    }

    await prisma.booking.update({
      where: { BookingID: parseInt(req.params.id) },
      data: { StatusID: cancelledStatus?.StatusID }
    });

    res.json({ message: 'Booking cancelled successfully' });
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
};
