const prisma = require('../config/prisma');

exports.createBooking = async (req, res) => {
  try {
    console.log('req.user:', req.user);
    const { showtimeId, seatIds } = req.body;

    if (!showtimeId || !seatIds || seatIds.length === 0) {
      return res.status(400).json({ error: 'Showtime and seats are required' });
    }

    const pendingStatus = await prisma.bookingStatus.findFirst({
      where: { StatusName: 'Pending' }
    });

    const showtime = await prisma.showtime.findUnique({
      where: { ShowtimeID: showtimeId }
    });

    if (!showtime) {
      return res.status(404).json({ error: 'Showtime not found' });
    }

    const existingBookings = await prisma.bookingDetail.findMany({
      where: {
        ShowtimeID: showtimeId,
        SeatID: { in: seatIds },
        Booking: { StatusID: pendingStatus?.StatusID }
      }
    });

    if (existingBookings.length > 0) {
      return res.status(400).json({ error: 'Some seats are already booked' });
    }

    const seats = await prisma.seat.findMany({
      where: { SeatID: { in: seatIds } },
      include: { SeatType: true }
    });

    let totalAmount = 0;
    for (const seat of seats) {
      const seatPrice = parseFloat(showtime.BasePrice) * parseFloat(seat.SeatType.PriceModifier || 1);
      totalAmount += seatPrice;
    }

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    const booking = await prisma.booking.create({
      data: {
        UserID: req.user.userId,
        StatusID: pendingStatus?.StatusID,
        ExpiresAt: expiresAt,
        TotalAmount: totalAmount,
        BookingDetails: {
          create: seatIds.map(seatId => ({
            ShowtimeID: showtimeId,
            SeatID: seatId
          }))
        }
      },
      include: {
        BookingDetails: true
      }
    });

    res.status(201).json({
      message: 'Booking created successfully',
      booking
    });
  } catch (error) {
    console.error('Create booking error:', error.message); // เพิ่ม .message
    console.error('Full error:', JSON.stringify(error, null, 2)); // ดู detail
    res.status(500).json({ error: 'Failed to create booking', detail: error.message }); // ส่ง detail กลับมาด้วย
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