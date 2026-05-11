const prisma = require('../config/prisma');
const HttpError = require('../utils/HttpError');
const { getEventList, invalidateEventListCache } = require('./eventListMetrics.service');

function parseId(value) {
  const id = parseInt(value, 10);
  return Number.isInteger(id) ? id : null;
}

function validateEventInput({ title, categoryId }) {
  if (!title?.trim()) throw new HttpError(400, 'Event title is required');
  if (!categoryId) throw new HttpError(400, 'Category is required');
}

function validateShowtimes(showtimes = [], { requireVenueAndTime = false } = {}) {
  for (const showtime of showtimes) {
    if (requireVenueAndTime && (!showtime.venueId || !showtime.startDateTime)) {
      throw new HttpError(400, 'Venue and start time are required for each showtime');
    }
    if (parseFloat(showtime.basePrice) < 0) {
      throw new HttpError(400, 'Base price cannot be negative');
    }
  }
}

async function assertCategory(categoryId) {
  const parsedCategoryId = parseId(categoryId);
  const category = parsedCategoryId
    ? await prisma.eventCategory.findUnique({ where: { CategoryID: parsedCategoryId } })
    : null;
  if (!category) throw new HttpError(400, 'Invalid category');
  return parsedCategoryId;
}

async function mapShowtimeWithAvailability(showtime) {
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
    venueName: showtime.Venue?.VenueName || '',
    startDateTime: showtime.StartDateTime,
    basePrice: Number(showtime.BasePrice),
    capacity,
    booked,
    available: capacity - booked,
    remaining: capacity - booked
  };
}

function createShowtimeData(eventId, showtime) {
  return {
    EventID: eventId,
    VenueID: parseInt(showtime.venueId, 10),
    StartDateTime: new Date(showtime.startDateTime),
    BasePrice: parseFloat(showtime.basePrice) || 0
  };
}

async function deleteShowtimesWithoutBookings(deletedShowtimeIds = []) {
  for (const showtimeId of deletedShowtimeIds) {
    const parsedShowtimeId = parseId(showtimeId);
    if (!parsedShowtimeId) continue;

    const hasBookings = await prisma.bookingDetail.count({ where: { ShowtimeID: parsedShowtimeId } });
    if (hasBookings === 0) {
      await prisma.showtime.delete({ where: { ShowtimeID: parsedShowtimeId } });
    }
  }
}

async function upsertShowtimes(eventId, showtimes = []) {
  for (const showtime of showtimes) {
    if (showtime.id) {
      await prisma.showtime.update({
        where: { ShowtimeID: parseInt(showtime.id, 10) },
        data: {
          VenueID: parseInt(showtime.venueId, 10),
          StartDateTime: new Date(showtime.startDateTime),
          BasePrice: parseFloat(showtime.basePrice) || 0
        }
      });
    } else {
      await prisma.showtime.create({ data: createShowtimeData(eventId, showtime) });
    }
  }
}

function createAdminEventService(db = prisma) {
  return {
    list(query = {}) {
      const { search, categoryId } = query;
      return getEventList(db, { search, categoryId });
    },

    async getById(eventId, { audience = 'admin' } = {}) {
      const event = await db.event.findUnique({
        where: { EventID: eventId },
        include: {
          Category: true,
          Showtimes: {
            include: { Venue: true },
            orderBy: { StartDateTime: 'asc' }
          }
        }
      });

      if (!event) throw new HttpError(404, 'Event not found');

      const showtimes = await Promise.all(event.Showtimes.map(mapShowtimeWithAvailability));

      if (audience === 'staff') {
        return {
          id: event.EventID,
          title: event.Title,
          description: event.Description,
          categoryId: event.CategoryID,
          category: event.Category?.CategoryName,
          createdAt: event.CreatedAt,
          showtimes
        };
      }

      return {
        id: event.EventID,
        title: event.Title,
        description: event.Description || '',
        category: event.Category?.CategoryName || '',
        categoryId: event.CategoryID,
        showtimes: showtimes.map(({ eventId: _eventId, available: _available, ...showtime }) => showtime)
      };
    },

    async create(input, { audience = 'admin' } = {}) {
      const { title, description, categoryId, showtimes = [] } = input;
      validateEventInput({ title, categoryId });
      validateShowtimes(showtimes, { requireVenueAndTime: audience === 'staff' });
      const parsedCategoryId = await assertCategory(categoryId);

      const event = await db.event.create({
        data: {
          Title: title.trim(),
          Description: description?.trim() || '',
          CategoryID: parsedCategoryId
        },
        ...(audience === 'staff' ? { include: { Category: true } } : {})
      });

      if (showtimes.length > 0) {
        await db.showtime.createMany({
          data: showtimes.map(showtime => createShowtimeData(event.EventID, showtime))
        });
      }

      invalidateEventListCache();
      return event;
    },

    async update(eventId, input, { audience = 'admin' } = {}) {
      const { title, description, categoryId, showtimes = [], deletedShowtimeIds = [] } = input;
      const existing = await db.event.findUnique({ where: { EventID: eventId } });
      if (!existing) throw new HttpError(404, 'Event not found');

      validateEventInput({ title, categoryId });
      validateShowtimes(showtimes, { requireVenueAndTime: audience === 'staff' });
      const parsedCategoryId = await assertCategory(categoryId);

      const updatedEvent = await db.event.update({
        where: { EventID: eventId },
        data: {
          Title: title.trim(),
          Description: description?.trim() || '',
          CategoryID: parsedCategoryId
        },
        ...(audience === 'staff' ? { include: { Category: true } } : {})
      });

      await deleteShowtimesWithoutBookings(deletedShowtimeIds);
      await upsertShowtimes(eventId, showtimes);

      invalidateEventListCache();
      return updatedEvent;
    },

    async delete(eventId) {
      const event = await db.event.findUnique({ where: { EventID: eventId } });
      if (!event) throw new HttpError(404, 'Event not found');

      const showtimes = await db.showtime.findMany({
        where: { EventID: eventId },
        select: { ShowtimeID: true }
      });
      const showtimeIds = showtimes.map(showtime => showtime.ShowtimeID);

      if (showtimeIds.length > 0) {
        const bookingDetailCount = await db.bookingDetail.count({
          where: { ShowtimeID: { in: showtimeIds } }
        });
        if (bookingDetailCount > 0) {
          throw new HttpError(400, 'Cannot delete event with existing bookings');
        }
      }

      await db.event.delete({ where: { EventID: eventId } });
      invalidateEventListCache();
    }
  };
}

module.exports = createAdminEventService();
module.exports.createAdminEventService = createAdminEventService;
