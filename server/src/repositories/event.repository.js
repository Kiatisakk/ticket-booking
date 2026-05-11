const prisma = require('../config/prisma');

function buildEventWhere({ categoryId, search } = {}) {
  const where = {};

  if (categoryId) {
    where.CategoryID = parseInt(categoryId);
  }

  if (search) {
    where.Title = { contains: search, mode: 'insensitive' };
  }

  return where;
}

function createEventRepository(db = prisma) {
  return {
    findAll(filters) {
      return db.event.findMany({
        where: buildEventWhere(filters),
        include: {
          Category: true,
          Showtimes: {
            include: { Venue: true },
            orderBy: { StartDateTime: 'asc' }
          }
        }
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
