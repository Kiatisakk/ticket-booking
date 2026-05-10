const HttpError = require('../utils/HttpError');
const eventRepository = require('../repositories/event.repository');
const roleRepository = require('../repositories/role.repository');

function createEventService({
  events = eventRepository,
  roles = roleRepository
} = {}) {
  return {
    getAllEvents(filters) {
      return events.findAll(filters);
    },

    async getEventById(eventId) {
      const event = await events.findById(eventId);
      if (!event) {
        throw new HttpError(404, 'Event not found');
      }
      return event;
    },

    async createEvent({ user, title, description, categoryId }) {
      const customerRole = await roles.findByName('Customer');
      if (user.role === customerRole?.RoleID) {
        throw new HttpError(403, 'Unauthorized. Admin or Staff role required.');
      }

      return events.create({
        title,
        description,
        categoryId,
        createdByUserId: user.userId
      });
    }
  };
}

module.exports = createEventService();
module.exports.createEventService = createEventService;
