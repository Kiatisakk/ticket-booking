const prisma = require('../../config/prisma');
const asyncHandler = require('../../utils/asyncHandler');
const { offsetPayload, parsePagination } = require('../../utils/pagination');

exports.getCategories = asyncHandler(async (req, res) => {
  const categories = await prisma.eventCategory.findMany({ orderBy: { CategoryID: 'asc' } });
  res.json(categories.map(category => ({ id: category.CategoryID, name: category.CategoryName })));
});

exports.getAdminVenues = asyncHandler(async (req, res) => {
  const page = parsePagination(req.query, { defaultPageSize: 12 });
  const [venues, total] = await Promise.all([
    prisma.venue.findMany({
      orderBy: { VenueID: 'asc' },
      include: { _count: { select: { Seats: true } } },
      ...(page.enabled ? { skip: page.skip, take: page.take } : {})
    }),
    page.enabled ? prisma.venue.count() : Promise.resolve(null)
  ]);

  const data = venues.map(venue => ({
    id: venue.VenueID,
    name: venue.VenueName,
    location: venue.Location || '',
    capacity: venue._count.Seats
  }));

  if (page.enabled) {
    return res.json(offsetPayload(data, total, page.page, page.pageSize));
  }

  res.json(data);
});

exports.createVenue = asyncHandler(async (req, res) => {
  const { name, location } = req.body;
  const venueName = String(name || '').trim();

  if (!venueName) {
    return res.status(400).json({ error: 'Venue name is required' });
  }

  const venue = await prisma.venue.create({
    data: {
      VenueName: venueName,
      Location: String(location || '').trim() || null
    }
  });

  res.status(201).json({
    id: venue.VenueID,
    name: venue.VenueName,
    location: venue.Location || '',
    capacity: 0
  });
});

exports.updateVenue = asyncHandler(async (req, res) => {
  const venueId = parseInt(req.params.id, 10);
  const { name, location } = req.body;
  const venueName = String(name || '').trim();

  if (!venueId || !venueName) {
    return res.status(400).json({ error: 'Valid venue and name are required' });
  }

  const venue = await prisma.venue.update({
    where: { VenueID: venueId },
    data: {
      VenueName: venueName,
      Location: String(location || '').trim() || null
    }
  });
  const capacity = await prisma.seat.count({ where: { VenueID: venueId } });

  res.json({
    id: venue.VenueID,
    name: venue.VenueName,
    location: venue.Location || '',
    capacity
  });
});

exports.deleteVenue = asyncHandler(async (req, res) => {
  const venueId = parseInt(req.params.id, 10);

  const showtimeCount = await prisma.showtime.count({ where: { VenueID: venueId } });
  if (showtimeCount > 0) {
    return res.status(400).json({ error: 'Cannot delete venue with existing showtimes' });
  }

  await prisma.venue.delete({ where: { VenueID: venueId } });
  res.json({ message: 'Venue deleted successfully' });
});

exports.getVenueSeats = asyncHandler(async (req, res) => {
  const venueId = parseInt(req.params.venueId, 10);
  const page = parsePagination(req.query, { defaultPageSize: 100 });
  const seatRows = page.enabled ? await prisma.$queryRaw`
    SELECT
      s."SeatID",
      s."VenueID",
      s."SeatTypeID",
      s."RowLabel",
      s."SeatNumber",
      st."TypeName" AS "SeatTypeName"
    FROM "Seats" s
    JOIN "SeatTypes" st ON st."SeatTypeID" = s."SeatTypeID"
    WHERE s."VenueID" = ${venueId}
    ORDER BY
      s."RowLabel" ASC,
      CASE WHEN s."SeatNumber" ~ '^[0-9]+$' THEN s."SeatNumber"::int END ASC NULLS LAST,
      s."SeatNumber" ASC,
      s."SeatID" ASC
    LIMIT ${page.take} OFFSET ${page.skip}
  ` : await prisma.$queryRaw`
    SELECT
      s."SeatID",
      s."VenueID",
      s."SeatTypeID",
      s."RowLabel",
      s."SeatNumber",
      st."TypeName" AS "SeatTypeName"
    FROM "Seats" s
    JOIN "SeatTypes" st ON st."SeatTypeID" = s."SeatTypeID"
    WHERE s."VenueID" = ${venueId}
    ORDER BY
      s."RowLabel" ASC,
      CASE WHEN s."SeatNumber" ~ '^[0-9]+$' THEN s."SeatNumber"::int END ASC NULLS LAST,
      s."SeatNumber" ASC,
      s."SeatID" ASC
  `;
  const seats = seatRows.map(row => ({
    SeatID: Number(row.SeatID),
    VenueID: Number(row.VenueID),
    SeatTypeID: Number(row.SeatTypeID),
    RowLabel: row.RowLabel,
    SeatNumber: row.SeatNumber,
    SeatType: { TypeName: row.SeatTypeName }
  }));

  const detailCounts = seats.length
    ? await prisma.bookingDetail.groupBy({
        by: ['SeatID'],
        where: { SeatID: { in: seats.map(seat => seat.SeatID) } },
        _count: { SeatID: true }
      })
    : [];
  const bookedMap = new Map(detailCounts.map(item => [item.SeatID, item._count.SeatID]));

  const data = seats.map(seat => ({
    id: seat.SeatID,
    venueId: seat.VenueID,
    seatTypeId: seat.SeatTypeID,
    seatTypeName: seat.SeatType?.TypeName || 'Unknown',
    rowLabel: seat.RowLabel,
    seatNumber: seat.SeatNumber,
    bookingCount: bookedMap.get(seat.SeatID) || 0
  }));

  if (page.enabled) {
    const total = await prisma.seat.count({ where: { VenueID: venueId } });
    return res.json(offsetPayload(data, total, page.page, page.pageSize));
  }

  res.json(data);
});

exports.createSeat = asyncHandler(async (req, res) => {
  const { venueId, seatTypeId, rowLabel, seatNumber } = req.body;
  const parsedVenueId = parseInt(venueId, 10);
  const parsedSeatTypeId = parseInt(seatTypeId, 10);
  const row = String(rowLabel || '').trim().toUpperCase();
  const number = String(seatNumber || '').trim();

  if (!parsedVenueId || !parsedSeatTypeId || !row || !number) {
    return res.status(400).json({ error: 'Venue, seat type, row, and seat number are required' });
  }

  const seat = await prisma.seat.create({
    data: {
      VenueID: parsedVenueId,
      SeatTypeID: parsedSeatTypeId,
      RowLabel: row,
      SeatNumber: number
    },
    include: { SeatType: true }
  });

  res.status(201).json({
    id: seat.SeatID,
    venueId: seat.VenueID,
    seatTypeId: seat.SeatTypeID,
    seatTypeName: seat.SeatType?.TypeName || 'Unknown',
    rowLabel: seat.RowLabel,
    seatNumber: seat.SeatNumber,
    bookingCount: 0
  });
});

exports.updateSeat = asyncHandler(async (req, res) => {
  const seatId = parseInt(req.params.id, 10);
  const { seatTypeId, rowLabel, seatNumber } = req.body;
  const parsedSeatTypeId = parseInt(seatTypeId, 10);
  const row = String(rowLabel || '').trim().toUpperCase();
  const number = String(seatNumber || '').trim();

  if (!seatId || !parsedSeatTypeId || !row || !number) {
    return res.status(400).json({ error: 'Seat type, row, and seat number are required' });
  }

  const bookingCount = await prisma.bookingDetail.count({ where: { SeatID: seatId } });
  if (bookingCount > 0) {
    return res.status(400).json({ error: 'Cannot edit a seat that has booking history' });
  }

  const seat = await prisma.seat.update({
    where: { SeatID: seatId },
    data: {
      SeatTypeID: parsedSeatTypeId,
      RowLabel: row,
      SeatNumber: number
    },
    include: { SeatType: true }
  });

  res.json({
    id: seat.SeatID,
    venueId: seat.VenueID,
    seatTypeId: seat.SeatTypeID,
    seatTypeName: seat.SeatType?.TypeName || 'Unknown',
    rowLabel: seat.RowLabel,
    seatNumber: seat.SeatNumber,
    bookingCount: 0
  });
});

exports.deleteSeat = asyncHandler(async (req, res) => {
  const seatId = parseInt(req.params.id, 10);
  const bookingCount = await prisma.bookingDetail.count({ where: { SeatID: seatId } });
  if (bookingCount > 0) {
    return res.status(400).json({ error: 'Cannot delete a seat that has booking history' });
  }

  await prisma.seat.delete({ where: { SeatID: seatId } });
  res.json({ message: 'Seat deleted successfully' });
});

exports.getSystemSettings = asyncHandler(async (req, res) => {
  const [categories, venues, paymentMethods] = await Promise.all([
    prisma.eventCategory.findMany({ orderBy: { CategoryID: 'asc' } }),
    prisma.venue.findMany({ orderBy: { VenueID: 'asc' } }),
    prisma.paymentMethod.findMany({ orderBy: { MethodID: 'asc' } })
  ]);

  res.json({
    categories: categories.map(category => ({
      id: category.CategoryID,
      name: category.CategoryName,
      createdAt: category.CreatedAt
    })),
    venues: venues.map(venue => ({
      id: venue.VenueID,
      name: venue.VenueName,
      location: venue.Location
    })),
    paymentMethods: paymentMethods.map(method => ({
      id: method.MethodID,
      name: method.MethodName,
      isActive: method.IsActive
    }))
  });
});

exports.updatePaymentMethod = asyncHandler(async (req, res) => {
  const methodId = parseInt(req.params.id, 10);
  const { isActive } = req.body;

  if (typeof isActive !== 'boolean') {
    return res.status(400).json({ error: 'isActive must be a boolean' });
  }

  const method = await prisma.paymentMethod.update({
    where: { MethodID: methodId },
    data: { IsActive: isActive }
  });

  res.json({
    id: method.MethodID,
    name: method.MethodName,
    isActive: method.IsActive
  });
});
