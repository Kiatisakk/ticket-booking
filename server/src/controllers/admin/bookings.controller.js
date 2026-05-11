const prisma = require('../../config/prisma');
const asyncHandler = require('../../utils/asyncHandler');
const { findManyHybrid, sortDirection } = require('../../utils/pagination');

function mapBookings(bookings) {
  return bookings.map(booking => {
    const events = [...new Set(
      booking.BookingDetails
        .map(detail => detail.Showtime?.Event?.Title)
        .filter(Boolean)
    )];

    return {
      id: booking.BookingID,
      user: booking.User?.FullName || 'Unknown',
      userEmail: booking.User?.Email || '',
      userRole: booking.User?.Role?.RoleName || 'Unknown',
      status: booking.Status?.StatusName || 'Unknown',
      totalAmount: Number(booking.TotalAmount),
      seatCount: booking.BookingDetails.length,
      events,
      bookingDate: booking.BookingTimestamp,
      expiresAt: booking.ExpiresAt,
      paymentStatus: booking.Payment?.Status?.StatusName || null,
      paymentMethod: booking.Payment?.Method?.MethodName || null
    };
  });
}

exports.getAllBookings = asyncHandler(async (req, res) => {
  const { search, status, sortBy } = req.query;
  const direction = sortDirection(req.query.sortOrder);
  const where = {};

  if (status && status !== 'All') {
    const bookingStatus = await prisma.bookingStatus.findFirst({
      where: { StatusName: status }
    });
    if (bookingStatus) where.StatusID = bookingStatus.StatusID;
  }

  if (search) {
    const searchNum = parseInt(search, 10);
    if (!Number.isNaN(searchNum)) {
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

  const sortMap = {
    bookingId: { BookingID: direction },
    user: { User: { FullName: direction } },
    amount: { TotalAmount: direction },
    bookingDate: { BookingTimestamp: direction },
    status: { Status: { StatusName: direction } }
  };
  const orderBy = sortMap[sortBy] || { CreatedAt: 'desc' };

  const cursorSorts = {
    bookingId: { idField: 'BookingID', sortField: 'BookingID', valueType: 'number' },
    amount: { idField: 'BookingID', sortField: 'TotalAmount', valueType: 'number' },
    bookingDate: { idField: 'BookingID', sortField: 'BookingTimestamp', valueType: 'date' }
  };
  const cursorConfig = cursorSorts[sortBy || 'bookingDate']
    ? { ...cursorSorts[sortBy || 'bookingDate'], sortOrder: direction }
    : null;

  const payload = await findManyHybrid(prisma.booking, {
    query: req.query,
    where,
    select: {
      BookingID: true,
      TotalAmount: true,
      BookingTimestamp: true,
      ExpiresAt: true,
      User: { select: { FullName: true, Email: true, Role: { select: { RoleName: true } } } },
      Status: { select: { StatusName: true } },
      BookingDetails: {
        select: {
          Showtime: {
            select: {
              Event: { select: { Title: true, EventID: true } }
            }
          }
        }
      },
      Payment: {
        select: {
          Status: { select: { StatusName: true } },
          Method: { select: { MethodName: true } }
        }
      }
    },
    orderBy,
    cursorConfig,
    map: mapBookings
  });

  res.json(payload);
});
