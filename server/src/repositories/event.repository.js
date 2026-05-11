const prisma = require('../config/prisma');
const { findManyHybrid, sortDirection } = require('../utils/pagination');

function buildEventWhere({ category, categoryId, search, status } = {}) {
  const where = {};

  if (categoryId) {
    where.CategoryID = parseInt(categoryId);
  } else if (category && category !== 'all') {
    where.Category = { CategoryName: category };
  }

  if (search) {
    where.Title = { contains: search, mode: 'insensitive' };
  }

  if (status === 'upcoming') {
    where.Showtimes = { some: { StartDateTime: { gte: new Date() } } };
  } else if (status === 'past') {
    where.Showtimes = { every: { StartDateTime: { lt: new Date() } } };
  }

  return where;
}

function createEventRepository(db = prisma) {
  return {
    findAll(filters) {
      const sortBy = filters?.sortBy || 'eventId';
      const sortOrder = sortDirection(filters?.sortOrder);
      const orderByMap = {
        eventId: { EventID: sortOrder },
        title: { Title: sortOrder },
        category: { Category: { CategoryName: sortOrder } }
      };
      const orderBy = orderByMap[sortBy] || orderByMap.eventId;

      return findManyHybrid(db.event, {
        query: filters,
        where: buildEventWhere(filters),
        include: {
          Category: true,
          Showtimes: {
            include: { Venue: true },
            orderBy: { StartDateTime: 'asc' }
          }
        },
        orderBy,
        cursorConfig: ['eventId', undefined, null].includes(sortBy)
          ? {
              idField: 'EventID',
              sortField: 'EventID',
              sortOrder,
              valueType: 'number'
            }
          : null
      });
    },

    findById(eventId) {
      return db.event.findUnique({
        where: { EventID: eventId },
        include: {
          Category: true,
          Showtimes: {
            include: { Venue: true },
            orderBy: { StartDateTime: 'asc' }
          }
        }
      });
    },

    create({ title, description, categoryId }) {
      return db.event.create({
        data: {
          Title: title,
          Description: description,
          CategoryID: categoryId
        }
      });
    }
  };
}

module.exports = createEventRepository();
module.exports.createEventRepository = createEventRepository;
