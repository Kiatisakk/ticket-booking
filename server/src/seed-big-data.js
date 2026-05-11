const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

const CONFIG = {
  prefix: process.env.BIG_PREFIX || 'bigdata',
  users: Number(process.env.BIG_USERS || 5000),
  bookings: Number(process.env.BIG_BOOKINGS || 20000),
  events: Number(process.env.BIG_EVENTS || 60),
  showtimesPerEvent: Number(process.env.BIG_SHOWTIMES_PER_EVENT || 10),
  seats: Number(process.env.BIG_SEATS || 300),
  batchSize: Number(process.env.BIG_BATCH_SIZE || 1000),
  reset: process.env.BIGDATA_RESET === '1',
  cleanOnly: process.env.BIGDATA_CLEAN_ONLY === '1'
};

function createRng(seed = 241241) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const rng = createRng(Number(process.env.BIG_SEED || 241241));

function pick(items) {
  return items[Math.floor(rng() * items.length)];
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function chunk(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function findOrCreate(model, where, data) {
  const existing = await model.findFirst({ where });
  if (existing) return existing;
  return model.create({ data });
}

async function ensureReferenceData() {
  const roles = [
    { RoleName: 'Admin', Description: 'System Administrator' },
    { RoleName: 'Staff', Description: 'Event Staff' },
    { RoleName: 'Customer', Description: 'Regular Customer' }
  ];
  for (const role of roles) {
    await findOrCreate(prisma.role, { RoleName: role.RoleName }, role);
  }

  const categories = ['Movie', 'Concert', 'Seminar'];
  for (const CategoryName of categories) {
    await findOrCreate(prisma.eventCategory, { CategoryName }, { CategoryName });
  }

  const seatTypes = [
    { TypeName: 'VIP', PriceModifier: 2 },
    { TypeName: 'Standard', PriceModifier: 1 },
    { TypeName: 'Sofa Bed', PriceModifier: 1.5 }
  ];
  for (const seatType of seatTypes) {
    await findOrCreate(prisma.seatType, { TypeName: seatType.TypeName }, seatType);
  }

  const bookingStatuses = ['Pending', 'Completed', 'Cancelled'];
  for (const StatusName of bookingStatuses) {
    await findOrCreate(prisma.bookingStatus, { StatusName }, { StatusName });
  }

  const paymentStatuses = ['Pending', 'Success', 'Failed'];
  for (const StatusName of paymentStatuses) {
    await findOrCreate(prisma.paymentStatus, { StatusName }, { StatusName });
  }

  const paymentMethods = ['PromptPay', 'Credit Card', 'TrueMoney', 'ShopeePay'];
  for (const MethodName of paymentMethods) {
    await findOrCreate(prisma.paymentMethod, { MethodName }, { MethodName, IsActive: true });
  }
}

async function resetSyntheticData() {
  console.log(`Resetting synthetic data for prefix "${CONFIG.prefix}"...`);

  const syntheticUsers = await prisma.user.findMany({
    where: { Email: { startsWith: `${CONFIG.prefix}-` } },
    select: { UserID: true }
  });
  const userIds = syntheticUsers.map(user => user.UserID);

  if (userIds.length > 0) {
    const bookings = await prisma.booking.findMany({
      where: { UserID: { in: userIds } },
      select: { BookingID: true }
    });
    const bookingIds = bookings.map(booking => booking.BookingID);
    const details = bookingIds.length
      ? await prisma.bookingDetail.findMany({
          where: { BookingID: { in: bookingIds } },
          select: { DetailID: true }
        })
      : [];
    const detailIds = details.map(detail => detail.DetailID);

    if (detailIds.length) await prisma.ticket.deleteMany({ where: { DetailID: { in: detailIds } } });
    if (bookingIds.length) await prisma.payment.deleteMany({ where: { BookingID: { in: bookingIds } } });
    if (bookingIds.length) await prisma.bookingDetail.deleteMany({ where: { BookingID: { in: bookingIds } } });
    if (bookingIds.length) await prisma.booking.deleteMany({ where: { BookingID: { in: bookingIds } } });
    await prisma.user.deleteMany({ where: { UserID: { in: userIds } } });
  }

  const syntheticEvents = await prisma.event.findMany({
    where: { Title: { startsWith: `${CONFIG.prefix.toUpperCase()} Synthetic Event` } },
    select: { EventID: true }
  });
  const eventIds = syntheticEvents.map(event => event.EventID);
  if (eventIds.length) {
    await prisma.showtime.deleteMany({ where: { EventID: { in: eventIds } } });
    await prisma.event.deleteMany({ where: { EventID: { in: eventIds } } });
  }

  const venue = await prisma.venue.findFirst({
    where: { VenueName: `${CONFIG.prefix.toUpperCase()} Benchmark Hall` },
    select: { VenueID: true }
  });
  if (venue) {
    await prisma.seat.deleteMany({ where: { VenueID: venue.VenueID } });
    await prisma.venue.delete({ where: { VenueID: venue.VenueID } });
  }
}

async function ensureVenueAndSeats() {
  const venueName = `${CONFIG.prefix.toUpperCase()} Benchmark Hall`;
  const venue = await findOrCreate(
    prisma.venue,
    { VenueName: venueName },
    { VenueName: venueName, Location: 'Synthetic benchmark venue' }
  );

  const existingSeats = await prisma.seat.count({ where: { VenueID: venue.VenueID } });
  if (existingSeats >= CONFIG.seats) {
    const seats = await prisma.seat.findMany({
      where: { VenueID: venue.VenueID },
      include: { SeatType: true },
      orderBy: [{ RowLabel: 'asc' }, { SeatNumber: 'asc' }]
    });
    return { venue, seats };
  }

  const seatTypes = await prisma.seatType.findMany();
  const byName = Object.fromEntries(seatTypes.map(type => [type.TypeName, type]));
  const rows = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const seatsPerRow = Math.ceil(CONFIG.seats / Math.min(rows.length, 20));
  const data = [];

  for (let i = 0; i < CONFIG.seats; i += 1) {
    const rowIndex = Math.floor(i / seatsPerRow);
    const rowLabel = rows[rowIndex] || `R${rowIndex + 1}`;
    const seatNumber = String((i % seatsPerRow) + 1);
    const seatType = rowIndex < 3
      ? byName.VIP
      : rowIndex % 5 === 0
        ? byName['Sofa Bed']
        : byName.Standard;
    data.push({
      VenueID: venue.VenueID,
      SeatTypeID: seatType.SeatTypeID,
      RowLabel: rowLabel,
      SeatNumber: seatNumber
    });
  }

  for (const batch of chunk(data, CONFIG.batchSize)) {
    await prisma.seat.createMany({ data: batch, skipDuplicates: true });
  }

  const seats = await prisma.seat.findMany({
    where: { VenueID: venue.VenueID },
    include: { SeatType: true },
    orderBy: [{ RowLabel: 'asc' }, { SeatNumber: 'asc' }]
  });
  return { venue, seats };
}

async function ensureEventsAndShowtimes(venue) {
  const categories = await prisma.eventCategory.findMany({ orderBy: { CategoryID: 'asc' } });
  const showtimes = [];

  for (let eventIndex = 1; eventIndex <= CONFIG.events; eventIndex += 1) {
    const category = categories[(eventIndex - 1) % categories.length];
    const title = `${CONFIG.prefix.toUpperCase()} Synthetic Event ${String(eventIndex).padStart(3, '0')}`;
    const event = await findOrCreate(
      prisma.event,
      { Title: title },
      {
        Title: title,
        Description: `Synthetic benchmark ${category.CategoryName} event ${eventIndex}`,
        CategoryID: category.CategoryID
      }
    );

    for (let showtimeIndex = 1; showtimeIndex <= CONFIG.showtimesPerEvent; showtimeIndex += 1) {
      const date = new Date(Date.UTC(2025, 0, 1 + eventIndex, 8 + (showtimeIndex % 12), 0, 0));
      const existing = await prisma.showtime.findFirst({
        where: { EventID: event.EventID, StartDateTime: date }
      });
      const showtime = existing || await prisma.showtime.create({
        data: {
          EventID: event.EventID,
          VenueID: venue.VenueID,
          StartDateTime: date,
          BasePrice: 250 + ((eventIndex + showtimeIndex) % 12) * 75
        }
      });
      showtimes.push(showtime);
    }
  }

  return showtimes;
}

async function ensureUsers() {
  const existing = await prisma.user.count({
    where: { Email: { startsWith: `${CONFIG.prefix}-` } }
  });
  if (existing >= CONFIG.users) {
    return prisma.user.findMany({
      where: { Email: { startsWith: `${CONFIG.prefix}-` } },
      select: { UserID: true },
      orderBy: { UserID: 'asc' }
    });
  }

  const customerRole = await prisma.role.findFirst({ where: { RoleName: 'Customer' } });
  const password = await bcrypt.hash('pass1234', 10);
  const users = [];
  for (let i = 1; i <= CONFIG.users; i += 1) {
    const createdAt = new Date(Date.UTC(2025, i % 12, (i % 27) + 1, 9, 0, 0));
    users.push({
      Email: `${CONFIG.prefix}-${String(i).padStart(6, '0')}@example.test`,
      FullName: `Synthetic User ${String(i).padStart(6, '0')}`,
      Password: password,
      RoleID: customerRole.RoleID,
      CreatedAt: createdAt,
      UpdatedAt: createdAt
    });
  }

  for (const batch of chunk(users, CONFIG.batchSize)) {
    await prisma.user.createMany({ data: batch, skipDuplicates: true });
  }

  return prisma.user.findMany({
    where: { Email: { startsWith: `${CONFIG.prefix}-` } },
    select: { UserID: true },
    orderBy: { UserID: 'asc' }
  });
}

async function insertBookings(rows) {
  return prisma.$queryRawUnsafe(`
    WITH input AS (
      SELECT *
      FROM jsonb_to_recordset($1::jsonb) AS x(
        ord int,
        "userID" int,
        "statusID" int,
        "bookingTimestamp" timestamptz,
        "expiresAt" timestamptz,
        "totalAmount" numeric
      )
    ),
    inserted AS (
      INSERT INTO "Bookings" (
        "UserID", "StatusID", "BookingTimestamp", "ExpiresAt", "TotalAmount", "CreatedAt", "UpdatedAt"
      )
      SELECT "userID", "statusID", "bookingTimestamp", "expiresAt", "totalAmount", "bookingTimestamp", "bookingTimestamp"
      FROM input
      ORDER BY ord
      RETURNING "BookingID", "UserID", "BookingTimestamp"
    )
    SELECT input.ord, inserted."BookingID"
    FROM input
    JOIN inserted
      ON inserted."UserID" = input."userID"
     AND inserted."BookingTimestamp" = input."bookingTimestamp"
    ORDER BY input.ord
  `, JSON.stringify(rows));
}

async function insertDetails(rows) {
  return prisma.$queryRawUnsafe(`
    WITH input AS (
      SELECT *
      FROM jsonb_to_recordset($1::jsonb) AS x(
        ord int,
        "bookingID" int,
        "showtimeID" int,
        "seatID" int,
        "createdAt" timestamptz
      )
    ),
    inserted AS (
      INSERT INTO "BookingDetails" (
        "BookingID", "ShowtimeID", "SeatID", "CreatedAt", "UpdatedAt"
      )
      SELECT "bookingID", "showtimeID", "seatID", "createdAt", "createdAt"
      FROM input
      ORDER BY ord
      RETURNING "DetailID", "BookingID", "ShowtimeID", "SeatID"
    )
    SELECT input.ord, inserted."DetailID"
    FROM input
    JOIN inserted
      ON inserted."BookingID" = input."bookingID"
     AND inserted."ShowtimeID" = input."showtimeID"
     AND inserted."SeatID" = input."seatID"
    ORDER BY input.ord
  `, JSON.stringify(rows));
}

async function createSyntheticBookings({ users, showtimes, seats }) {
  const statuses = Object.fromEntries(
    (await prisma.bookingStatus.findMany()).map(status => [status.StatusName, status.StatusID])
  );
  const paymentStatuses = Object.fromEntries(
    (await prisma.paymentStatus.findMany()).map(status => [status.StatusName, status.StatusID])
  );
  const methods = await prisma.paymentMethod.findMany({
    where: { IsActive: true },
    orderBy: { MethodID: 'asc' }
  });

  const syntheticBookingCount = await prisma.booking.count({
    where: { User: { Email: { startsWith: `${CONFIG.prefix}-` } } }
  });
  if (syntheticBookingCount > 0) {
    console.log(`Synthetic bookings already exist (${syntheticBookingCount}). Use BIGDATA_RESET=1 to rebuild.`);
    return;
  }

  const showtimeState = showtimes.map(showtime => ({ showtime, cursor: 0 }));
  const seatById = new Map(seats.map(seat => [seat.SeatID, seat]));
  let createdBookings = 0;
  let createdDetails = 0;
  let createdTickets = 0;

  for (let offset = 0; offset < CONFIG.bookings; offset += CONFIG.batchSize) {
    const target = Math.min(CONFIG.batchSize, CONFIG.bookings - offset);
    const bookingRows = [];
    const bookingMeta = [];

    for (let i = 0; i < target; i += 1) {
      const index = offset + i;
      let state = showtimeState[index % showtimeState.length];
      let seatCount = 1 + Math.floor(rng() * 4);

      for (let attempt = 0; attempt < showtimeState.length && state.cursor + seatCount > seats.length; attempt += 1) {
        state = showtimeState[(index + attempt + 1) % showtimeState.length];
      }
      if (state.cursor + seatCount > seats.length) break;

      const selectedSeats = seats.slice(state.cursor, state.cursor + seatCount);
      state.cursor += seatCount;

      const user = users[index % users.length];
      const statusRoll = index % 100;
      const bookingStatusName = statusRoll < 82 ? 'Completed' : statusRoll < 92 ? 'Cancelled' : 'Pending';
      const paymentStatusName = bookingStatusName === 'Completed'
        ? 'Success'
        : bookingStatusName === 'Cancelled'
          ? 'Failed'
          : 'Pending';
      const bookingTimestamp = new Date(Date.UTC(2025, index % 12, (index % 27) + 1, index % 23, index % 59, 0, index % 1000));
      const totalAmount = selectedSeats.reduce((sum, seat) =>
        sum + Number(state.showtime.BasePrice) * Number(seat.SeatType.PriceModifier), 0);

      bookingRows.push({
        ord: i,
        userID: user.UserID,
        statusID: statuses[bookingStatusName],
        bookingTimestamp: bookingTimestamp.toISOString(),
        expiresAt: addMinutes(bookingTimestamp, 15).toISOString(),
        totalAmount
      });
      bookingMeta.push({
        showtimeID: state.showtime.ShowtimeID,
        seats: selectedSeats.map(seat => seat.SeatID),
        basePrice: Number(state.showtime.BasePrice),
        bookingTimestamp,
        paymentStatusID: paymentStatuses[paymentStatusName],
        methodID: methods[index % methods.length].MethodID,
        paidAt: paymentStatusName === 'Success' ? addMinutes(bookingTimestamp, 5) : null,
        totalAmount,
        completed: bookingStatusName === 'Completed'
      });
    }

    if (bookingRows.length === 0) break;

    const insertedBookings = await insertBookings(bookingRows);
    const bookingIdByOrd = new Map(insertedBookings.map(row => [row.ord, row.BookingID]));
    const detailRows = [];
    const detailMeta = [];
    const payments = [];

    for (let i = 0; i < bookingMeta.length; i += 1) {
      const bookingID = bookingIdByOrd.get(i);
      const meta = bookingMeta[i];
      payments.push({
        BookingID: bookingID,
        MethodID: meta.methodID,
        StatusID: meta.paymentStatusID,
        TransactionID: `SYN-${CONFIG.prefix}-${String(offset + i + 1).padStart(8, '0')}`,
        Amount: meta.totalAmount,
        PaidAt: meta.paidAt,
        CreatedAt: meta.bookingTimestamp,
        UpdatedAt: meta.bookingTimestamp
      });

      for (const seatID of meta.seats) {
        detailRows.push({
          ord: detailRows.length,
          bookingID,
          showtimeID: meta.showtimeID,
          seatID,
          createdAt: meta.bookingTimestamp.toISOString()
        });
        detailMeta.push({
          completed: meta.completed,
          finalPrice: meta.basePrice * Number(seatById.get(seatID).SeatType.PriceModifier),
          createdAt: meta.bookingTimestamp
        });
      }
    }

    const insertedDetails = await insertDetails(detailRows);
    await prisma.payment.createMany({ data: payments, skipDuplicates: true });

    const tickets = [];
    for (const row of insertedDetails) {
      const meta = detailMeta[row.ord];
      if (!meta.completed) continue;
      tickets.push({
        TicketNo: `S${row.DetailID}`,
        DetailID: row.DetailID,
        FinalPrice: meta.finalPrice,
        CreatedAt: meta.createdAt,
        UpdatedAt: meta.createdAt
      });
    }
    for (const batch of chunk(tickets, CONFIG.batchSize)) {
      await prisma.ticket.createMany({ data: batch, skipDuplicates: true });
    }

    createdBookings += bookingRows.length;
    createdDetails += detailRows.length;
    createdTickets += tickets.length;
    console.log(`Inserted ${createdBookings}/${CONFIG.bookings} bookings...`);
  }

  console.log(`Synthetic bookings: ${createdBookings}`);
  console.log(`Synthetic booking details: ${createdDetails}`);
  console.log(`Synthetic tickets: ${createdTickets}`);
}

async function main() {
  console.log('=== Synthetic Big Data Seed Starting ===');
  console.log(CONFIG);

  if (CONFIG.reset) {
    await resetSyntheticData();
    if (CONFIG.cleanOnly) {
      console.log('Clean-only mode complete.');
      return;
    }
  } else {
    const existing = await prisma.user.count({
      where: { Email: { startsWith: `${CONFIG.prefix}-` } }
    });
    if (existing > 0) {
      console.log(`Synthetic users already exist (${existing}). Use BIGDATA_RESET=1 to rebuild.`);
      return;
    }
  }

  await ensureReferenceData();
  const { venue, seats } = await ensureVenueAndSeats();
  console.log(`Venue ready: ${venue.VenueName} (${seats.length} seats)`);

  const showtimes = await ensureEventsAndShowtimes(venue);
  console.log(`Synthetic showtimes ready: ${showtimes.length}`);

  const users = await ensureUsers();
  console.log(`Synthetic users ready: ${users.length}`);

  await createSyntheticBookings({ users, showtimes, seats });
  console.log('=== Synthetic Big Data Seed Complete ===');
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
