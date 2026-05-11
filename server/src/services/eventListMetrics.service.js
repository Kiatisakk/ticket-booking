async function getEventList(db, { search, categoryId, now = new Date() } = {}) {
  const where = {};

  if (search) {
    where.Title = { contains: search, mode: 'insensitive' };
  }
  if (categoryId) {
    where.CategoryID = parseInt(categoryId);
  }

  const events = await db.event.findMany({
    where,
    include: {
      Category: true,
      Showtimes: {
        include: { Venue: true },
        orderBy: { StartDateTime: 'asc' }
      }
    },
    orderBy: { EventID: 'desc' }
  });

  const venueIds = [...new Set(events.flatMap(event =>
    event.Showtimes.map(showtime => showtime.VenueID).filter(Boolean)
  ))];
  const allShowtimeIds = events.flatMap(event => event.Showtimes.map(showtime => showtime.ShowtimeID));
  const firstShowtimeIds = events
    .map(event => event.Showtimes?.[0]?.ShowtimeID)
    .filter(Boolean);

  const [capacityRows, activeBookedRows, totalBookingRows] = await Promise.all([
    venueIds.length
      ? db.seat.groupBy({
          by: ['VenueID'],
          where: { VenueID: { in: venueIds } },
          _count: { SeatID: true }
        })
      : [],
    firstShowtimeIds.length
      ? db.bookingDetail.groupBy({
          by: ['ShowtimeID'],
          where: {
            ShowtimeID: { in: firstShowtimeIds },
            Booking: {
              OR: [
                { Status: { StatusName: 'Completed' } },
                { Status: { StatusName: 'Pending' }, ExpiresAt: { gt: now } }
              ]
            }
          },
          _count: { SeatID: true }
        })
      : [],
    allShowtimeIds.length
      ? db.bookingDetail.groupBy({
          by: ['ShowtimeID'],
          where: { ShowtimeID: { in: allShowtimeIds } },
          _count: { DetailID: true }
        })
      : []
  ]);

  const capacityByVenue = new Map(capacityRows.map(row => [row.VenueID, row._count.SeatID]));
  const activeBookedByShowtime = new Map(activeBookedRows.map(row => [row.ShowtimeID, row._count.SeatID]));
  const totalBookingsByShowtime = new Map(totalBookingRows.map(row => [row.ShowtimeID, row._count.DetailID]));

  return events.map(event => {
    const showtime = event.Showtimes?.[0] ?? null;
    const venueId = showtime?.VenueID ?? null;
    const totalSeats = venueId ? capacityByVenue.get(venueId) || 0 : 0;
    const bookedCount = showtime ? activeBookedByShowtime.get(showtime.ShowtimeID) || 0 : 0;
    const totalBookings = event.Showtimes.reduce((sum, item) =>
      sum + (totalBookingsByShowtime.get(item.ShowtimeID) || 0), 0);
    const latestShowtime = event.Showtimes?.length > 0
      ? event.Showtimes.reduce((latest, item) =>
          new Date(item.StartDateTime) > new Date(latest.StartDateTime) ? item : latest,
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
  });
}

module.exports = { getEventList };
