const prisma = require('../config/prisma');

exports.getAllEvents = async (req, res) => {
  try {
    const events = await prisma.event.findMany({
      include: {
        Category: true
      }
    });
    res.json(events);
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
};

exports.getEventById = async (req, res) => {
  try {
    const event = await prisma.event.findUnique({
      where: { EventID: parseInt(req.params.id) },
      include: {
        Category: true,
        Showtimes: {
          include: {
            Venue: true
          }
        }
      }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json(event);
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
};

exports.createEvent = async (req, res) => {
  try {
    const customerRole = await prisma.role.findFirst({
      where: { RoleName: 'Customer' }
    });
    
    if (req.user.role === customerRole?.RoleID) {
      return res.status(403).json({ error: 'Unauthorized. Admin or Staff role required.' });
    }

    const { title, description, categoryId } = req.body;

    const event = await prisma.event.create({
      data: {
        Title: title,
        Description: description,
        CategoryID: categoryId
      }
    });

    res.status(201).json(event);
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
};