require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware
app.use(cors());
app.use(express.json());

// ==================== AUTHENTICATION ====================

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { fullName, email, password } = req.body;
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { Email: email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user with default role (Customer = 2, assuming)
    const user = await prisma.user.create({
      data: {
        FullName: fullName,
        Email: email,
        Password: hashedPassword,
        RoleID: 2 // Default to Customer
      }
    });

    const token = jwt.sign({ userId: user.UserID, email: user.Email, role: user.RoleID }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { id: user.UserID, fullName: user.FullName, email: user.Email }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await prisma.user.findUnique({ where: { Email: email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.Password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.UserID, email: user.Email, role: user.RoleID }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'Login successful',
      token,
      user: { id: user.UserID, fullName: user.FullName, email: user.Email, roleId: user.RoleID }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// ==================== AUTH MIDDLEWARE ====================

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
}

// ==================== EVENTS ====================

// Get all events
app.get('/api/events', async (req, res) => {
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
});

// Get event by ID
app.get('/api/events/:id', async (req, res) => {
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
});

// Create event (Admin/Staff only)
app.post('/api/events', authenticateToken, async (req, res) => {
  try {
    if (req.user.role > 2) { // Assuming 1=Admin, 2=Staff, 3=Customer
      return res.status(403).json({ error: 'Unauthorized' });
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
});

// ==================== VENUES ====================

// Get all venues
app.get('/api/venues', async (req, res) => {
  try {
    const venues = await prisma.venue.findMany();
    res.json(venues);
  } catch (error) {
    console.error('Get venues error:', error);
    res.status(500).json({ error: 'Failed to fetch venues' });
  }
});

// Get venue by ID with seats
app.get('/api/venues/:id', async (req, res) => {
  try {
    const venue = await prisma.venue.findUnique({
      where: { VenueID: parseInt(req.params.id) },
      include: {
        Seats: {
          include: {
            SeatType: true
          }
        }
      }
    });

    if (!venue) {
      return res.status(404).json({ error: 'Venue not found' });
    }

    res.json(venue);
  } catch (error) {
    console.error('Get venue error:', error);
    res.status(500).json({ error: 'Failed to fetch venue' });
  }
});

// ==================== SEATS ====================

// Get all seat types
app.get('/api/seat-types', async (req, res) => {
  try {
    const seatTypes = await prisma.seatType.findMany();
    res.json(seatTypes);
  } catch (error) {
    console.error('Get seat types error:', error);
    res.status(500).json({ error: 'Failed to fetch seat types' });
  }
});

// ==================== SHOWTIMES ====================

// Get all showtimes
app.get('/api/showtimes', async (req, res) => {
  try {
    const showtimes = await prisma.showtime.findMany({
      include: {
        Event: true,
        Venue: true
      }
    });
    res.json(showtimes);
  } catch (error) {
    console.error('Get showtimes error:', error);
    res.status(500).json({ error: 'Failed to fetch showtimes' });
  }
});

// Get showtimes by event
app.get('/api/showtimes/event/:eventId', async (req, res) => {
  try {
    const showtimes = await prisma.showtime.findMany({
      where: { EventID: parseInt(req.params.eventId) },
      include: {
        Venue: true
      }
    });
    res.json(showtimes);
  } catch (error) {
    console.error('Get showtimes error:', error);
    res.status(500).json({ error: 'Failed to fetch showtimes' });
  }
});

// Get showtime by ID
app.get('/api/showtimes/:id', async (req, res) => {
  try {
    const showtime = await prisma.showtime.findUnique({
      where: { ShowtimeID: parseInt(req.params.id) },
      include: {
        Event: true,
        Venue: {
          include: {
            Seats: {
              include: {
                SeatType: true
              }
            }
          }
        }
      }
    });

    if (!showtime) {
      return res.status(404).json({ error: 'Showtime not found' });
    }

    res.json(showtime);
  } catch (error) {
    console.error('Get showtime error:', error);
    res.status(500).json({ error: 'Failed to fetch showtime' });
  }
});

// ==================== BOOKINGS ====================

// Create booking (with seat reservation)
app.post('/api/bookings', authenticateToken, async (req, res) => {
  try {
    const { showtimeId, seatIds } = req.body;

    if (!showtimeId || !seatIds || seatIds.length === 0) {
      return res.status(400).json({ error: 'Showtime and seats are required' });
    }

    // Get showtime info
    const showtime = await prisma.showtime.findUnique({
      where: { ShowtimeID: showtimeId }
    });

    if (!showtime) {
      return res.status(404).json({ error: 'Showtime not found' });
    }

    // Check seat availability (ensure not already booked)
    const existingBookings = await prisma.bookingDetail.findMany({
      where: {
        ShowtimeID: showtimeId,
        SeatID: { in: seatIds }
      },
      include: {
        Booking: {
          where: {
            StatusID: 1 // Pending
          }
        }
      }
    });

    if (existingBookings.length > 0) {
      return res.status(400).json({ error: 'Some seats are already booked' });
    }

    // Calculate total amount
    const seats = await prisma.seat.findMany({
      where: { SeatID: { in: seatIds } },
      include: { SeatType: true }
    });

    let totalAmount = 0;
    for (const seat of seats) {
      const seatPrice = parseFloat(showtime.BasePrice) * parseFloat(seat.SeatType.PriceModifier || 1);
      totalAmount += seatPrice;
    }

    // Create booking with expiration (15 minutes from now)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    const booking = await prisma.booking.create({
      data: {
        UserID: req.user.userId,
        StatusID: 1, // Pending
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
    console.error('Create booking error:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// Get user's bookings
app.get('/api/bookings/my', authenticateToken, async (req, res) => {
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
});

// Get booking by ID
app.get('/api/bookings/:id', authenticateToken, async (req, res) => {
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

    // Check if user owns this booking
    if (booking.UserID !== req.user.userId && req.user.role > 2) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json(booking);
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

// Cancel booking
app.post('/api/bookings/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { BookingID: parseInt(req.params.id) }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.UserID !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (booking.StatusID !== 1) { // Only pending bookings can be cancelled
      return res.status(400).json({ error: 'Booking cannot be cancelled' });
    }

    await prisma.booking.update({
      where: { BookingID: parseInt(req.params.id) },
      data: { StatusID: 3 } // Cancelled
    });

    res.json({ message: 'Booking cancelled successfully' });
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

// ==================== PAYMENTS ====================

// Get payment methods
app.get('/api/payment-methods', async (req, res) => {
  try {
    const methods = await prisma.paymentMethod.findMany({
      where: { IsActive: true }
    });
    res.json(methods);
  } catch (error) {
    console.error('Get payment methods error:', error);
    res.status(500).json({ error: 'Failed to fetch payment methods' });
  }
});

// Process payment
app.post('/api/payments', authenticateToken, async (req, res) => {
  try {
    const { bookingId, methodId } = req.body;

    // Get booking
    const booking = await prisma.booking.findUnique({
      where: { BookingID: bookingId }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.UserID !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (booking.StatusID !== 1) {
      return res.status(400).json({ error: 'Booking is not pending' });
    }

    // Check if booking has expired
    if (booking.ExpiresAt && new Date(booking.ExpiresAt) < new Date()) {
      return res.status(400).json({ error: 'Booking has expired' });
    }

    // Create payment (mock transaction ID)
    const transactionId = `TXN${Date.now()}${Math.random().toString(36).substr(2, 9)}`;

    const payment = await prisma.payment.create({
      data: {
        BookingID: bookingId,
        MethodID: methodId,
        StatusID: 2, // Success (mock - in real app, integrate with payment gateway)
        TransactionID: transactionId,
        Amount: booking.TotalAmount,
        PaidAt: new Date()
      }
    });

    // Update booking status to completed
    await prisma.booking.update({
      where: { BookingID: bookingId },
      data: { StatusID: 2 } // Completed
    });

    // Generate tickets
    const bookingDetails = await prisma.bookingDetail.findMany({
      where: { BookingID: bookingId }
    });

    for (const detail of bookingDetails) {
      const ticketNo = `TKT${Date.now()}${Math.random().toString(36).substr(2, 6)}`;
      await prisma.ticket.create({
        data: {
          TicketNo: ticketNo,
          DetailID: detail.DetailID,
          FinalPrice: booking.TotalAmount / bookingDetails.length
        }
      });
    }

    res.status(201).json({
      message: 'Payment successful',
      payment
    });
  } catch (error) {
    console.error('Process payment error:', error);
    res.status(500).json({ error: 'Failed to process payment' });
  }
});

// ==================== TICKETS ====================

// Get ticket by booking
app.get('/api/tickets/booking/:bookingId', authenticateToken, async (req, res) => {
  try {
    const tickets = await prisma.ticket.findMany({
      where: {
        Detail: {
          BookingID: parseInt(req.params.bookingId)
        }
      },
      include: {
        Detail: {
          include: {
            Booking: true,
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
            }
          }
        }
      }
    });

    res.json(tickets);
  } catch (error) {
    console.error('Get tickets error:', error);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

// Verify ticket
app.get('/api/tickets/verify/:ticketNo', async (req, res) => {
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { TicketNo: req.params.ticketNo },
      include: {
        Detail: {
          include: {
            Showtime: {
              include: {
                Event: true,
                Venue: true
              }
            },
            Seat: true
          }
        }
      }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    res.json({ valid: true, ticket });
  } catch (error) {
    console.error('Verify ticket error:', error);
    res.status(500).json({ error: 'Failed to verify ticket' });
  }
});

// ==================== START SERVER ====================

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 API available at http://localhost:${PORT}/api`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});
