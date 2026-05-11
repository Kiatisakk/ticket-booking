const prisma = require('../config/prisma');

exports.getAllEvents = async (req, res) => {
  try {
    const { search, categoryId } = req.query;
    const where = {};

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
        Showtimes: { include: { Venue: true } }
      },
      orderBy: { EventID: 'desc' }
    });

    const now = new Date();
    const mapped = await Promise.all(events.map(async (event) => {
      const showtime = event.Showtimes?.[0] ?? null;
      const venueId = showtime?.VenueID ?? null;
      const totalSeats = venueId ? await prisma.seat.count({ where: { VenueID: venueId } }) : 0;
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

      const allShowtimeIds = event.Showtimes?.map(s => s.ShowtimeID) || [];
      const totalBookings = allShowtimeIds.length > 0
        ? await prisma.bookingDetail.count({ where: { ShowtimeID: { in: allShowtimeIds } } })
        : 0;

      const latestShowtime = event.Showtimes?.length > 0
        ? event.Showtimes.reduce((latest, s) =>
            new Date(s.StartDateTime) > new Date(latest.StartDateTime) ? s : latest,
          event.Showtimes[0])
        : null;
      const isPast = latestShowtime ? new Date(latestShowtime.StartDateTime) < now : false;

      return {
        id: event.EventID,
        title: event.Title,
        description: event.Description,
        category: event.Category?.CategoryName || 'Uncategorized',
        categoryId: event.CategoryID,
        basePrice: Number(showtime?.BasePrice ?? 0),
        venue: showtime?.Venue?.VenueName ?? '-',
        venueId,
        totalSeats,
        seatsRemaining: totalSeats - bookedCount,
        startDateTime: showtime?.StartDateTime ?? null,
        showtimeId: showtime?.ShowtimeID ?? null,
        isPast,
        hasBookings: totalBookings > 0,
        latestShowtime: latestShowtime?.StartDateTime ?? null
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
    const event = await prisma.event.findUnique({
      where: { EventID: eventId },
      include: {
        Category: true,
        Showtimes: {
          include: { Venue: true },
          orderBy: { StartDateTime: 'asc' }
        }
      }
    });

    if (!event) return res.status(404).json({ error: 'Event not found' });

    const showtimes = await Promise.all(event.Showtimes.map(async (showtime) => {
      const now = new Date();
      const capacity = await prisma.seat.count({ where: { VenueID: showtime.VenueID } });
      const booked = await prisma.bookingDetail.count({
        where: {
          ShowtimeID: showtime.ShowtimeID,
          Booking: {
            OR: [
              { Status: { StatusName: 'Completed' } },
              { Status: { StatusName: 'Pending' }, ExpiresAt: { gt: now } }
            ]
          }
        }
      });

      return {
        id: showtime.ShowtimeID,
        eventId: showtime.EventID,
        venueId: showtime.VenueID,
        venueName: showtime.Venue?.VenueName,
        startDateTime: showtime.StartDateTime,
        basePrice: Number(showtime.BasePrice),
        capacity,
        booked,
        available: capacity - booked,
        remaining: capacity - booked
      };
    }));

    res.json({
      id: event.EventID,
      title: event.Title,
      description: event.Description,
      categoryId: event.CategoryID,
      category: event.Category?.CategoryName,
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

    if (!title?.trim() || !categoryId) {
      return res.status(400).json({ error: 'Title and category are required' });
    }

    const parsedCategoryId = parseInt(categoryId);
    const category = await prisma.eventCategory.findUnique({
      where: { CategoryID: parsedCategoryId }
    });

    if (!category) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    const event = await prisma.event.create({
      data: {
        Title: title.trim(),
        Description: description?.trim() || '',
        CategoryID: parsedCategoryId
      },
      include: { Category: true }
    });

    if (showtimes && Array.isArray(showtimes) && showtimes.length > 0) {
      for (const showtime of showtimes) {
        if (!showtime.venueId || !showtime.startDateTime) {
          return res.status(400).json({ error: 'Venue and start time are required for each showtime' });
        }
        if (parseFloat(showtime.basePrice) < 0) {
          return res.status(400).json({ error: 'Base price cannot be negative' });
        }
      }

      await Promise.all(showtimes.map(showtime =>
        prisma.showtime.create({
          data: {
            EventID: event.EventID,
            VenueID: parseInt(showtime.venueId),
            StartDateTime: new Date(showtime.startDateTime),
            BasePrice: parseFloat(showtime.basePrice) || 0
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
        category: event.Category?.CategoryName
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
    const { title, description, categoryId, showtimes = [], deletedShowtimeIds = [] } = req.body;

    const event = await prisma.event.findUnique({ where: { EventID: eventId } });
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (title !== undefined && !title?.trim()) return res.status(400).json({ error: 'Event title is required' });
    if (!categoryId) return res.status(400).json({ error: 'Category is required' });

    const category = await prisma.eventCategory.findUnique({
      where: { CategoryID: parseInt(categoryId) }
    });
    if (!category) return res.status(400).json({ error: 'Invalid category' });

    const updatedEvent = await prisma.event.update({
      where: { EventID: eventId },
      data: {
        Title: title?.trim() || event.Title,
        Description: description?.trim() || event.Description,
        CategoryID: parseInt(categoryId)
      },
      include: { Category: true }
    });

    for (const stId of deletedShowtimeIds) {
      const hasBookings = await prisma.bookingDetail.count({ where: { ShowtimeID: parseInt(stId) } });
      if (hasBookings === 0) {
        await prisma.showtime.delete({ where: { ShowtimeID: parseInt(stId) } });
      }
    }

    for (const showtime of showtimes) {
      if (parseFloat(showtime.basePrice) < 0) {
        return res.status(400).json({ error: 'Base price cannot be negative' });
      }
    }

    for (const showtime of showtimes) {
      if (showtime.id) {
        await prisma.showtime.update({
          where: { ShowtimeID: parseInt(showtime.id) },
          data: {
            VenueID: parseInt(showtime.venueId),
            StartDateTime: new Date(showtime.startDateTime),
            BasePrice: parseFloat(showtime.basePrice) || 0
          }
        });
      } else {
        await prisma.showtime.create({
          data: {
            EventID: eventId,
            VenueID: parseInt(showtime.venueId),
            StartDateTime: new Date(showtime.startDateTime),
            BasePrice: parseFloat(showtime.basePrice) || 0
          }
        });
      }
    }

    res.json({
      message: 'Event updated successfully',
      event: {
        id: updatedEvent.EventID,
        title: updatedEvent.Title,
        description: updatedEvent.Description,
        category: updatedEvent.Category?.CategoryName
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
    const event = await prisma.event.findUnique({ where: { EventID: eventId } });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

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

    await prisma.event.delete({ where: { EventID: eventId } });
    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Staff deleteEvent error:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
};
