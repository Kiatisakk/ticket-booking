const prisma = require('../config/prisma');

// ─── Staff Events ─────────────────────────────────────────────────────────────

exports.getAllEvents = async (req, res) => {
  try {
    const { search, categoryId } = req.query;
    const userId = req.user.userId;

    const where = {
      CreatedByUserID: userId
    };

    if (search) {
      where.Title = { contains: search, mode: 'insensitive' };
    }
    if (categoryId) {
      where.CategoryID = parseInt(categoryId);
    }

    const events = await prisma.event.findMany({
      where,
      include: {
        Category: true,
        CreatedByUser: true,
        Showtimes: { include: { Venue: true } }
      },
      orderBy: { EventID: 'desc' }
    });

    const now = new Date();
    const mapped = await Promise.all(events.map(async e => {
      const showtime = e.Showtimes?.[0] ?? null;
      const venueID = showtime?.VenueID ?? null;

      const totalSeats = venueID
        ? await prisma.seat.count({ where: { VenueID: venueID } })
        : 0;

      const bookedCount = showtime
        ? await prisma.bookingDetail.count({
            where: {
              ShowtimeID: showtime.ShowtimeID,
              Booking: {
                OR: [
                  { Status: { StatusName: 'Completed' } },
                  { Status: { StatusName: 'Pending' }, ExpiresAt: { gt: now } }
                ]
              }
            }
          })
        : 0;

      // Check if event has any bookings across all showtimes
      const allShowtimeIds = e.Showtimes?.map(s => s.ShowtimeID) || [];
      const totalBookings = allShowtimeIds.length > 0
        ? await prisma.bookingDetail.count({
            where: { ShowtimeID: { in: allShowtimeIds } }
          })
        : 0;

      const latestShowtime = e.Showtimes?.length > 0
        ? e.Showtimes.reduce((latest, s) =>
            new Date(s.StartDateTime) > new Date(latest.StartDateTime) ? s : latest
          , e.Showtimes[0])
        : null;
      const isPast = latestShowtime ? new Date(latestShowtime.StartDateTime) < now : false;

      return {
        id: e.EventID,
        title: e.Title,
        description: e.Description,
        category: e.Category?.CategoryName || 'Uncategorized',
        categoryId: e.CategoryID,
        basePrice: Number(showtime?.BasePrice ?? 0),
        venue: showtime?.Venue?.VenueName ?? '-',
        venueId: venueID,
        totalSeats,
        seatsRemaining: totalSeats - bookedCount,
        startDateTime: showtime?.StartDateTime ?? null,
        showtimeId: showtime?.ShowtimeID ?? null,
        isPast,
        hasBookings: totalBookings > 0,
        latestShowtime: latestShowtime?.StartDateTime ?? null,
        createdBy: e.CreatedByUser?.FullName || 'Unknown'
      };
    }));

    res.json(mapped);
  } catch (error) {
    console.error('Staff getAllEvents error:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
};

exports.getEventById = async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);
    const userId = req.user.userId;

    const event = await prisma.event.findUnique({
      where: { EventID: eventId },
      include: {
        Category: true,
        CreatedByUser: true,
        Showtimes: {
          include: { Venue: true },
          orderBy: { StartDateTime: 'asc' }
        }
      }
    });

    if (!event) return res.status(404).json({ error: 'Event not found' });
    
    // Check if staff owns this event
    if (event.CreatedByUserID !== userId) {
      return res.status(403).json({ error: 'You do not have permission to view this event' });
    }

    const showtimes = await Promise.all(event.Showtimes.map(async s => {
      const capacity = await prisma.seat.count({ where: { VenueID: s.VenueID } });
      const now = new Date();
      const booked = await prisma.bookingDetail.count({
        where: {
          ShowtimeID: s.ShowtimeID,
          Booking: {
            OR: [
              { Status: { StatusName: 'Completed' } },
              { Status: { StatusName: 'Pending' }, ExpiresAt: { gt: now } }
            ]
          }
        }
      });
      return {
        id: s.ShowtimeID,
        eventId: s.EventID,
        venueId: s.VenueID,
        venueName: s.Venue?.VenueName,
        startDateTime: s.StartDateTime,
        basePrice: Number(s.BasePrice),
        capacity,
        booked,
        available: capacity - booked
      };
    }));

    res.json({
      id: event.EventID,
      title: event.Title,
      description: event.Description,
      categoryId: event.CategoryID,
      category: event.Category?.CategoryName,
      createdBy: event.CreatedByUser?.FullName,
      createdAt: event.CreatedAt,
      showtimes
    });
  } catch (error) {
    console.error('Staff getEventById error:', error);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
};

exports.createEvent = async (req, res) => {
  try {
    const { title, description, categoryId, showtimes } = req.body;
    const userId = req.user.userId;

    if (!title || !categoryId) {
      return res.status(400).json({ error: 'Title and category are required' });
    }

    const category = await prisma.eventCategory.findUnique({
      where: { CategoryID: parseInt(categoryId) }
    });

    if (!category) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    const event = await prisma.event.create({
      data: {
        Title: title,
        Description: description || null,
        CategoryID: parseInt(categoryId),
        CreatedByUserID: userId
      },
      include: {
        Category: true,
        CreatedByUser: true
      }
    });

    // Create showtimes if provided
    if (showtimes && Array.isArray(showtimes) && showtimes.length > 0) {
      for (const showtime of showtimes) {
        if (parseFloat(showtime.basePrice) < 0) {
          return res.status(400).json({ error: 'Base price cannot be negative' });
        }
      }
      await Promise.all(showtimes.map(showtime =>
        prisma.showtime.create({
          data: {
            EventID: event.EventID,
            VenueID: showtime.venueId,
            StartDateTime: new Date(showtime.startDateTime),
            BasePrice: parseFloat(showtime.basePrice)
          }
        })
      ));
    }

    res.status(201).json({
      message: 'Event created successfully',
      event: {
        id: event.EventID,
        title: event.Title,
        description: event.Description,
        category: event.Category?.CategoryName,
        createdBy: event.CreatedByUser?.FullName
      }
    });
  } catch (error) {
    console.error('Staff createEvent error:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
};

exports.updateEvent = async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);
    const userId = req.user.userId;
    const { title, description, categoryId } = req.body;

    // Check ownership
    const event = await prisma.event.findUnique({
      where: { EventID: eventId }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.CreatedByUserID !== userId) {
      return res.status(403).json({ error: 'You do not have permission to update this event' });
    }

    const updatedEvent = await prisma.event.update({
      where: { EventID: eventId },
      data: {
        Title: title || event.Title,
        Description: description || event.Description,
        CategoryID: categoryId ? parseInt(categoryId) : event.CategoryID
      },
      include: {
        Category: true,
        CreatedByUser: true
      }
    });

    res.json({
      message: 'Event updated successfully',
      event: {
        id: updatedEvent.EventID,
        title: updatedEvent.Title,
        description: updatedEvent.Description,
        category: updatedEvent.Category?.CategoryName,
        createdBy: updatedEvent.CreatedByUser?.FullName
      }
    });
  } catch (error) {
    console.error('Staff updateEvent error:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
};

exports.deleteEvent = async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);
    const userId = req.user.userId;

    const event = await prisma.event.findUnique({
      where: { EventID: eventId }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.CreatedByUserID !== userId) {
      return res.status(403).json({ error: 'You do not have permission to delete this event' });
    }

    // RESTRICT: Check if any showtimes have booking details
    const showtimes = await prisma.showtime.findMany({
      where: { EventID: eventId },
      select: { ShowtimeID: true }
    });
    const showtimeIds = showtimes.map(s => s.ShowtimeID);

    if (showtimeIds.length > 0) {
      const bookingDetailCount = await prisma.bookingDetail.count({
        where: { ShowtimeID: { in: showtimeIds } }
      });
      if (bookingDetailCount > 0) {
        return res.status(400).json({ error: 'Cannot delete event with existing bookings' });
      }
    }

    await prisma.event.delete({
      where: { EventID: eventId }
    });

    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Staff deleteEvent error:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
};

// ─── Staff Bookings ──────────────────────────────────────────────────────────

exports.getAllBookings = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { search, status } = req.query;

    // Get all events created by this staff
    const staffEvents = await prisma.event.findMany({
      where: { CreatedByUserID: userId },
      select: { EventID: true }
    });
    const staffEventIds = staffEvents.map(e => e.EventID);

    if (staffEventIds.length === 0) {
      return res.json([]);
    }

    // Find all showtimes for staff's events
    const showtimes = await prisma.showtime.findMany({
      where: { EventID: { in: staffEventIds } },
      select: { ShowtimeID: true }
    });
    const showtimeIds = showtimes.map(s => s.ShowtimeID);

    // Find bookings that have at least one BookingDetail with one of these showtimes
    const where = {
      BookingDetails: {
        some: {
          ShowtimeID: { in: showtimeIds }
        }
      }
    };

    if (status && status !== 'All') {
      const bookingStatus = await prisma.bookingStatus.findFirst({
        where: { StatusName: status }
      });
      if (bookingStatus) {
        where.StatusID = bookingStatus.StatusID;
      }
    }

    if (search) {
      const searchNum = parseInt(search);
      if (!isNaN(searchNum)) {
        where.BookingID = searchNum;
      } else {
        where.User = {
          OR: [
            { FullName: { contains: search, mode: 'insensitive' } },
            { Email: { contains: search, mode: 'insensitive' } }
          ]
        };
      }
    }

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        User: { select: { FullName: true, Email: true, Role: { select: { RoleName: true } } } },
        Status: true,
        BookingDetails: {
          include: {
            Showtime: {
              include: {
                Event: { select: { Title: true, EventID: true } }
              }
            }
          }
        },
        Payment: {
          include: { Status: true, Method: true }
        }
      },
      orderBy: { CreatedAt: 'desc' }
    });

    const mapped = bookings.map(b => {
      const events = [...new Set(
        b.BookingDetails
          .map(d => d.Showtime?.Event?.Title)
          .filter(Boolean)
      )];

      return {
        id: b.BookingID,
        user: b.User?.FullName || 'Unknown',
        userEmail: b.User?.Email || '',
        userRole: b.User?.Role?.RoleName || 'Unknown',
        status: b.Status?.StatusName || 'Unknown',
        totalAmount: Number(b.TotalAmount),
        seatCount: b.BookingDetails.length,
        events: events,
        bookingDate: b.BookingTimestamp,
        expiresAt: b.ExpiresAt,
        paymentStatus: b.Payment?.Status?.StatusName || null,
        paymentMethod: b.Payment?.Method?.MethodName || null
      };
    });

    res.json(mapped);
  } catch (error) {
    console.error('Staff getAllBookings error:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
};

// ─── Staff Transactions ────────────────────────────────────────────────────────

exports.getAllTransactions = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { status, search, startDate, endDate } = req.query;

    // Get all events created by this staff
    const staffEvents = await prisma.event.findMany({
      where: { CreatedByUserID: userId },
      select: { EventID: true }
    });

    const eventIds = staffEvents.map(e => e.EventID);

    if (eventIds.length === 0) {
      return res.json([]);
    }

    // Build where clause for transactions
    const where = {
      BookingDetails: {
        some: {
          Showtime: {
            EventID: { in: eventIds }
          }
        }
      }
    };

    if (status) {
      where.Payment = {
        Status: {
          StatusName: status
        }
      };
    }

    if (startDate || endDate) {
      where.BookingTimestamp = {};
      if (startDate) {
        where.BookingTimestamp.gte = new Date(startDate);
      }
      if (endDate) {
        where.BookingTimestamp.lte = new Date(endDate);
      }
    }

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        User: true,
        BookingDetails: {
          include: {
            Showtime: {
              include: {
                Event: true,
                Venue: true
              }
            },
            Seat: true
          }
        },
        Payment: {
          include: {
            Method: true,
            Status: true
          }
        },
        Status: true
      },
      orderBy: { BookingTimestamp: 'desc' }
    });

    const transactions = bookings.map(booking => ({
      id: booking.BookingID,
      customerName: booking.User?.FullName || 'N/A',
      customerEmail: booking.User?.Email || 'N/A',
      bookingDate: booking.BookingTimestamp,
      totalAmount: Number(booking.TotalAmount),
      bookingStatus: booking.Status?.StatusName || 'N/A',
      paymentStatus: booking.Payment?.Status?.StatusName || 'Pending',
      paymentMethod: booking.Payment?.Method?.MethodName || 'N/A',
      transactionId: booking.Payment?.TransactionID || 'N/A',
      items: booking.BookingDetails?.map(detail => ({
        eventName: detail.Showtime?.Event?.Title || 'N/A',
        venueName: detail.Showtime?.Venue?.VenueName || 'N/A',
        showtime: detail.Showtime?.StartDateTime || 'N/A',
        seat: `${detail.Seat?.RowLabel}${detail.Seat?.SeatNumber}`,
        price: detail.Ticket?.FinalPrice ? Number(detail.Ticket.FinalPrice) : 0
      })) || []
    }));

    res.json(transactions);
  } catch (error) {
    console.error('Staff getAllTransactions error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
};

// ─── Staff Dashboard ───────────────────────────────────────────────────────────

exports.getDashboard = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get staff's events
    const staffEvents = await prisma.event.findMany({
      where: { CreatedByUserID: userId },
      select: { EventID: true }
    });

    const eventIds = staffEvents.map(e => e.EventID);

    // Total events created
    const totalEvents = eventIds.length;

    // Total bookings for staff's events
    const totalBookings = await prisma.booking.count({
      where: {
        BookingDetails: {
          some: {
            Showtime: {
              EventID: { in: eventIds }
            }
          }
        }
      }
    });

    // Total revenue
    const bookings = await prisma.booking.findMany({
      where: {
        BookingDetails: {
          some: {
            Showtime: {
              EventID: { in: eventIds }
            }
          }
        }
      },
      select: { TotalAmount: true }
    });

    const totalRevenue = bookings.reduce((sum, b) => sum + Number(b.TotalAmount), 0);

    // Recent events
    const recentEvents = await prisma.event.findMany({
      where: { CreatedByUserID: userId },
      include: {
        Category: true,
        Showtimes: { include: { Venue: true } }
      },
      orderBy: { EventID: 'desc' },
      take: 5
    });

    res.json({
      totalEvents,
      totalBookings,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      recentEvents: recentEvents.map(e => ({
        id: e.EventID,
        title: e.Title,
        category: e.Category?.CategoryName,
        createdAt: e.CreatedAt
      }))
    });
  } catch (error) {
    console.error('Staff getDashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
};
