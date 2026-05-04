/**
 * Historical seed script for Thai Ticketing System
 * Run with: node src/seed-historical.js
 *
 * - Does NOT delete existing data (additive only)
 * - Uses upsert / createMany with skipDuplicates
 * - All dates are historical: Jan 2024 – Oct 2024
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function addMinutes(date, mins) {
  return new Date(date.getTime() + mins * 60 * 1000);
}

function subtractDays(date, days) {
  return new Date(date.getTime() - days * 24 * 60 * 60 * 1000);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Historical Seed Starting ===\n');

  // ── 1. Look up reference data ──────────────────────────────────────────────
  const seatTypes = await prisma.seatType.findMany();
  const stMap = {};
  for (const st of seatTypes) stMap[st.TypeName] = st;
  const VIP      = stMap['VIP'];
  const STANDARD = stMap['Standard'];
  const SOFA_BED = stMap['Sofa Bed'];

  const categories = await prisma.eventCategory.findMany();
  const catMap = {};
  for (const c of categories) catMap[c.CategoryName] = c;

  console.log('Seat types found:', Object.keys(stMap).join(', '));
  console.log('Categories found:', Object.keys(catMap).join(', '));

  // ── 2. Create historical venues ───────────────────────────────────────────

  const venueSpecs = [
    { VenueName: 'Impact Arena',       Location: 'Muang Thong Thani, Nonthaburi' },
    { VenueName: 'SF Cinema Paragon',  Location: 'Siam Paragon, Bangkok' },
    { VenueName: 'BITEC Bangkok',      Location: 'Bang Na, Bangkok' },
  ];

  const venues = {};
  for (const spec of venueSpecs) {
    let venue = await prisma.venue.findFirst({ where: { VenueName: spec.VenueName } });
    if (!venue) {
      venue = await prisma.venue.create({ data: spec });
      console.log(`Created venue: ${venue.VenueName} (ID=${venue.VenueID})`);
    } else {
      console.log(`Venue already exists: ${venue.VenueName} (ID=${venue.VenueID})`);
    }
    venues[venue.VenueName] = venue;
  }

  // ── 3. Create seats for each venue ────────────────────────────────────────

  // Impact Arena: rows A-G, seats 1-12
  // A-B: VIP, C-E: Standard, F-G: Sofa Bed
  const impactArenaSeats = await prisma.seat.count({
    where: { VenueID: venues['Impact Arena'].VenueID }
  });
  if (impactArenaSeats === 0) {
    const seatData = [];
    const rowSeatTypes = {
      A: VIP, B: VIP,
      C: STANDARD, D: STANDARD, E: STANDARD,
      F: SOFA_BED, G: SOFA_BED
    };
    for (const [row, st] of Object.entries(rowSeatTypes)) {
      for (let n = 1; n <= 12; n++) {
        seatData.push({
          VenueID:    venues['Impact Arena'].VenueID,
          SeatTypeID: st.SeatTypeID,
          RowLabel:   row,
          SeatNumber: String(n)
        });
      }
    }
    await prisma.seat.createMany({ data: seatData, skipDuplicates: true });
    console.log(`Created ${seatData.length} seats for Impact Arena`);
  } else {
    console.log(`Impact Arena already has ${impactArenaSeats} seats — skipping`);
  }

  // SF Cinema Paragon: rows A-E, seats 1-10
  // A: VIP, B-D: Standard, E: Sofa Bed
  const sfCinemaSeats = await prisma.seat.count({
    where: { VenueID: venues['SF Cinema Paragon'].VenueID }
  });
  if (sfCinemaSeats === 0) {
    const seatData = [];
    const rowSeatTypes = {
      A: VIP,
      B: STANDARD, C: STANDARD, D: STANDARD,
      E: SOFA_BED
    };
    for (const [row, st] of Object.entries(rowSeatTypes)) {
      for (let n = 1; n <= 10; n++) {
        seatData.push({
          VenueID:    venues['SF Cinema Paragon'].VenueID,
          SeatTypeID: st.SeatTypeID,
          RowLabel:   row,
          SeatNumber: String(n)
        });
      }
    }
    await prisma.seat.createMany({ data: seatData, skipDuplicates: true });
    console.log(`Created ${seatData.length} seats for SF Cinema Paragon`);
  } else {
    console.log(`SF Cinema Paragon already has ${sfCinemaSeats} seats — skipping`);
  }

  // BITEC Bangkok: rows A-F, seats 1-12
  // A-B: VIP, C-F: Standard
  const bitecSeats = await prisma.seat.count({
    where: { VenueID: venues['BITEC Bangkok'].VenueID }
  });
  if (bitecSeats === 0) {
    const seatData = [];
    const rowSeatTypes = {
      A: VIP, B: VIP,
      C: STANDARD, D: STANDARD, E: STANDARD, F: STANDARD
    };
    for (const [row, st] of Object.entries(rowSeatTypes)) {
      for (let n = 1; n <= 12; n++) {
        seatData.push({
          VenueID:    venues['BITEC Bangkok'].VenueID,
          SeatTypeID: st.SeatTypeID,
          RowLabel:   row,
          SeatNumber: String(n)
        });
      }
    }
    await prisma.seat.createMany({ data: seatData, skipDuplicates: true });
    console.log(`Created ${seatData.length} seats for BITEC Bangkok`);
  } else {
    console.log(`BITEC Bangkok already has ${bitecSeats} seats — skipping`);
  }

  // ── 4. Load all seats per venue (for booking logic) ───────────────────────

  const allSeats = {};
  for (const [name, venue] of Object.entries(venues)) {
    const seats = await prisma.seat.findMany({
      where: { VenueID: venue.VenueID },
      include: { SeatType: true }
    });
    allSeats[name] = seats;
  }

  // ── 5. Create historical events + showtimes ───────────────────────────────

  const eventSpecs = [
    {
      title:     'Post Malone: Eleven Tour',
      category:  'Concert',
      venue:     'Impact Arena',
      showtimes: [{ dt: new Date('2024-01-15T19:00:00Z'), price: 2500 }]
    },
    {
      title:     'Spider-Man: Beyond the Spider-Verse',
      category:  'Movie',
      venue:     'SF Cinema Paragon',
      showtimes: [
        { dt: new Date('2024-02-10T14:00:00Z'), price: 280 },
        { dt: new Date('2024-02-10T18:00:00Z'), price: 280 }
      ]
    },
    {
      title:     'AI & Future of Work Seminar',
      category:  'Seminar',
      venue:     'BITEC Bangkok',
      showtimes: [{ dt: new Date('2024-03-05T09:00:00Z'), price: 1200 }]
    },
    {
      title:     'BTS: Permission to Dance on Stage',
      category:  'Concert',
      venue:     'Impact Arena',
      showtimes: [{ dt: new Date('2024-04-20T18:00:00Z'), price: 3500 }]
    },
    {
      title:     'Avengers: Doomsday',
      category:  'Movie',
      venue:     'SF Cinema Paragon',
      showtimes: [
        { dt: new Date('2024-05-01T15:00:00Z'), price: 320 },
        { dt: new Date('2024-05-01T20:00:00Z'), price: 320 }
      ]
    },
    {
      title:     'BLACKPINK BORN PINK World Tour',
      category:  'Concert',
      venue:     'Impact Arena',
      showtimes: [{ dt: new Date('2024-06-08T19:00:00Z'), price: 3000 }]
    },
    {
      title:     'Digital Transformation Summit 2024',
      category:  'Seminar',
      venue:     'BITEC Bangkok',
      showtimes: [{ dt: new Date('2024-07-15T08:30:00Z'), price: 1500 }]
    },
    {
      title:     'Captain America: Brave New World',
      category:  'Movie',
      venue:     'SF Cinema Paragon',
      showtimes: [
        { dt: new Date('2024-08-09T13:00:00Z'), price: 300 },
        { dt: new Date('2024-08-09T17:30:00Z'), price: 300 }
      ]
    },
    {
      title:     'Ed Sheeran: Mathematics Tour',
      category:  'Concert',
      venue:     'Impact Arena',
      showtimes: [{ dt: new Date('2024-09-14T19:30:00Z'), price: 2800 }]
    },
    {
      title:     'Taylor Swift: The Eras Tour Bangkok',
      category:  'Concert',
      venue:     'Impact Arena',
      showtimes: [{ dt: new Date('2024-10-05T18:00:00Z'), price: 4000 }]
    },
  ];

  // eventTitle → [ShowtimeID, venueKey, basePrice, StartDateTime]
  const showtimeIndex = {};

  for (const spec of eventSpecs) {
    let event = await prisma.event.findFirst({ where: { Title: spec.title } });
    if (!event) {
      event = await prisma.event.create({
        data: {
          Title:      spec.title,
          Description: `${spec.category} event: ${spec.title}`,
          CategoryID: catMap[spec.category].CategoryID
        }
      });
      console.log(`Created event: ${event.Title} (ID=${event.EventID})`);
    } else {
      console.log(`Event already exists: ${event.Title} (ID=${event.EventID})`);
    }

    for (const stSpec of spec.showtimes) {
      // Check if showtime already exists for this event at this datetime
      let showtime = await prisma.showtime.findFirst({
        where: {
          EventID:       event.EventID,
          StartDateTime: stSpec.dt
        }
      });
      if (!showtime) {
        showtime = await prisma.showtime.create({
          data: {
            EventID:       event.EventID,
            VenueID:       venues[spec.venue].VenueID,
            StartDateTime: stSpec.dt,
            BasePrice:     stSpec.price
          }
        });
        console.log(`  Created showtime ID=${showtime.ShowtimeID} at ${stSpec.dt.toISOString()}`);
      } else {
        console.log(`  Showtime already exists ID=${showtime.ShowtimeID}`);
      }

      if (!showtimeIndex[spec.title]) showtimeIndex[spec.title] = [];
      showtimeIndex[spec.title].push({
        showtimeID: showtime.ShowtimeID,
        venueKey:   spec.venue,
        basePrice:  stSpec.price,
        startDT:    stSpec.dt
      });
    }
  }

  // ── 6. Create historical users ────────────────────────────────────────────

  const userSpecs = [
    { email: 'somchai@gmail.com',     name: 'Somchai',   createdAt: new Date('2024-01-10') },
    { email: 'nattaporn@gmail.com',   name: 'Nattaporn', createdAt: new Date('2024-01-22') },
    { email: 'wichaya@hotmail.com',   name: 'Wichaya',   createdAt: new Date('2024-02-05') },
    { email: 'panida@gmail.com',      name: 'Panida',    createdAt: new Date('2024-02-18') },
    { email: 'kittipong@gmail.com',   name: 'Kittipong', createdAt: new Date('2024-02-28') },
    { email: 'sirirat@yahoo.com',     name: 'Sirirat',   createdAt: new Date('2024-03-12') },
    { email: 'arthit@gmail.com',      name: 'Arthit',    createdAt: new Date('2024-03-25') },
    { email: 'monrada@gmail.com',     name: 'Monrada',   createdAt: new Date('2024-04-08') },
    { email: 'chaiwat@hotmail.com',   name: 'Chaiwat',   createdAt: new Date('2024-04-20') },
    { email: 'preeya@gmail.com',      name: 'Preeya',    createdAt: new Date('2024-05-03') },
    { email: 'sarawut@gmail.com',     name: 'Sarawut',   createdAt: new Date('2024-05-17') },
    { email: 'kannika@gmail.com',     name: 'Kannika',   createdAt: new Date('2024-06-01') },
    { email: 'teerawat@gmail.com',    name: 'Teerawat',  createdAt: new Date('2024-06-14') },
    { email: 'mayuree@hotmail.com',   name: 'Mayuree',   createdAt: new Date('2024-07-02') },
    { email: 'suphot@gmail.com',      name: 'Suphot',    createdAt: new Date('2024-07-20') },
    { email: 'wassana@gmail.com',     name: 'Wassana',   createdAt: new Date('2024-08-05') },
    { email: 'jirawat@gmail.com',     name: 'Jirawat',   createdAt: new Date('2024-08-18') },
    { email: 'nareerat@gmail.com',    name: 'Nareerat',  createdAt: new Date('2024-09-03') },
    { email: 'phakorn@gmail.com',     name: 'Phakorn',   createdAt: new Date('2024-09-22') },
    { email: 'ladawan@gmail.com',     name: 'Ladawan',   createdAt: new Date('2024-10-10') },
  ];

  const passwordHash = await bcrypt.hash('pass1234', 10);
  const userIds = {};

  for (const spec of userSpecs) {
    const user = await prisma.user.upsert({
      where: { Email: spec.email },
      create: {
        Email:     spec.email,
        FullName:  spec.name,
        Password:  passwordHash,
        RoleID:    3,
        CreatedAt: spec.createdAt,
        UpdatedAt: spec.createdAt
      },
      update: {} // don't overwrite existing users
    });
    userIds[spec.email] = user.UserID;
  }
  console.log(`\nUpserted ${userSpecs.length} historical users`);

  const histUserIDs = Object.values(userIds);

  // ── 7. Helper to build a prioritised seat list for a venue ────────────────
  // Popular: rows C-E (for Impact Arena 7-row) / rows B-D (for SF Cinema 5-row), seats 4-9
  // For BITEC: rows C-D, seats 4-9

  function prioritisedSeats(venueKey) {
    const seats = allSeats[venueKey];
    const popular = [];
    const other   = [];
    for (const seat of seats) {
      const row    = seat.RowLabel;
      const seatNo = parseInt(seat.SeatNumber);
      const isPopRow  = ['C','D','E'].includes(row);
      const isPopCol  = seatNo >= 4 && seatNo <= 9;
      if (isPopRow && isPopCol) popular.push(seat);
      else other.push(seat);
    }
    return [...shuffle(popular), ...shuffle(other)];
  }

  // ── 8. Track used seats per showtime to avoid double-booking ─────────────
  const usedSeats = new Map(); // ShowtimeID → Set<SeatID>

  function getUnusedSeats(showtimeID, venueKey, count) {
    if (!usedSeats.has(showtimeID)) usedSeats.set(showtimeID, new Set());
    const used = usedSeats.get(showtimeID);
    const candidates = prioritisedSeats(venueKey).filter(s => !used.has(s.SeatID));
    const chosen = candidates.slice(0, count);
    for (const s of chosen) used.add(s.SeatID);
    return chosen;
  }

  // ── 9. Booking creation helper ────────────────────────────────────────────

  let txnCounter = 1000;

  /**
   * Creates a full booking: Booking → BookingDetails → Payment → Tickets (if success)
   *
   * @param {object} opts
   * @param {number}   opts.userID
   * @param {number}   opts.showtimeID
   * @param {object[]} opts.seats           — seat objects with SeatType.PriceModifier
   * @param {number}   opts.basePrice
   * @param {Date}     opts.bookingTimestamp
   * @param {number}   opts.bookingStatusID — 2=Completed, 3=Cancelled
   * @param {number}   opts.paymentMethodID — 1-4
   * @param {number}   opts.paymentStatusID — 2=Success, 3=Failed, 4=Refunded
   */
  async function createHistoricalBooking(opts) {
    const {
      userID, showtimeID, seats, basePrice,
      bookingTimestamp, bookingStatusID,
      paymentMethodID, paymentStatusID
    } = opts;

    const totalAmount = seats.reduce(
      (sum, seat) => sum + basePrice * Number(seat.SeatType.PriceModifier),
      0
    );

    const expiresAt = addMinutes(bookingTimestamp, 15);
    const paidAt    = (paymentStatusID === 2 || paymentStatusID === 4)
      ? addMinutes(bookingTimestamp, 5)
      : null;

    // Generate a unique TransactionID before creating
    txnCounter++;
    const transactionID = `TXN-HIST-${txnCounter}-${Math.floor(1000 + Math.random() * 9000)}`;

    let booking;
    try {
      booking = await prisma.booking.create({
        data: {
          UserID:           userID,
          StatusID:         bookingStatusID,
          BookingTimestamp: bookingTimestamp,
          ExpiresAt:        expiresAt,
          TotalAmount:      totalAmount,
          CreatedAt:        bookingTimestamp,
          UpdatedAt:        bookingTimestamp
        }
      });
    } catch (err) {
      console.error('  Failed to create booking:', err.message);
      return;
    }

    // BookingDetails
    const detailIds = [];
    for (const seat of seats) {
      try {
        const detail = await prisma.bookingDetail.create({
          data: {
            BookingID:  booking.BookingID,
            ShowtimeID: showtimeID,
            SeatID:     seat.SeatID,
            CreatedAt:  bookingTimestamp,
            UpdatedAt:  bookingTimestamp
          }
        });
        detailIds.push({ detailID: detail.DetailID, seat });
      } catch (err) {
        // skip seats that might have a duplicate due to concurrent script
        console.warn(`  Skipped seat ${seat.SeatID}: ${err.message}`);
      }
    }

    if (detailIds.length === 0) {
      // No details created — delete orphan booking
      await prisma.booking.delete({ where: { BookingID: booking.BookingID } });
      return;
    }

    // Payment
    let payment;
    try {
      payment = await prisma.payment.create({
        data: {
          BookingID:     booking.BookingID,
          MethodID:      paymentMethodID,
          StatusID:      paymentStatusID,
          TransactionID: transactionID,
          Amount:        totalAmount,
          PaidAt:        paidAt,
          CreatedAt:     bookingTimestamp,
          UpdatedAt:     bookingTimestamp
        }
      });
    } catch (err) {
      console.error('  Failed to create payment:', err.message);
      return;
    }

    // Tickets (only for successful payments, completed bookings)
    if (paymentStatusID === 2 && bookingStatusID === 2) {
      for (const { detailID, seat } of detailIds) {
        const finalPrice = basePrice * Number(seat.SeatType.PriceModifier);
        // TicketNo must be ≤ 20 chars: TH + detailID (max 9 digits) = 11 chars max
        const ticketNo = `TH${detailID}`;
        try {
          await prisma.ticket.create({
            data: {
              TicketNo:   ticketNo,
              DetailID:   detailID,
              FinalPrice: finalPrice,
              CreatedAt:  bookingTimestamp,
              UpdatedAt:  bookingTimestamp
            }
          });
        } catch (err) {
          console.warn(`  Skipped ticket for detail ${detailID}: ${err.message}`);
        }
      }
    }

    return booking.BookingID;
  }

  // ── 10. Distribution plan for each showtime ───────────────────────────────
  // Each entry: [eventTitle, showtimeIndex, userCount, bookingStatusDist, paymentMethodRotation]
  // bookingStatusDist: array of [bookingStatusID, paymentStatusID] pairs
  // We index into showtimeIndex[title][idx]

  const ALL_USERS    = histUserIDs;
  const FIRST_10     = histUserIDs.slice(0, 10);
  const LAST_10      = histUserIDs.slice(10);

  const plans = [
    // Post Malone Jan — 6 users, mostly success
    {
      title: 'Post Malone: Eleven Tour', idx: 0, users: shuffle(ALL_USERS).slice(0, 6),
      pairs: [
        [2, 2], [2, 2], [2, 2], [2, 2], [2, 2], [2, 3]
      ]
    },
    // Spider-Man show 1 — 5 users
    {
      title: 'Spider-Man: Beyond the Spider-Verse', idx: 0, users: shuffle(FIRST_10).slice(0, 5),
      pairs: [
        [2, 2], [2, 2], [2, 2], [2, 2], [3, 4]
      ]
    },
    // Spider-Man show 2 — 4 users
    {
      title: 'Spider-Man: Beyond the Spider-Verse', idx: 1, users: shuffle(LAST_10).slice(0, 4),
      pairs: [
        [2, 2], [2, 2], [2, 2], [2, 2]
      ]
    },
    // AI Seminar — 4 users, some cancelled
    {
      title: 'AI & Future of Work Seminar', idx: 0, users: shuffle(ALL_USERS).slice(0, 4),
      pairs: [
        [2, 2], [2, 2], [3, 4], [3, 3]
      ]
    },
    // BTS — 8 users, mostly success, 1 refunded
    {
      title: 'BTS: Permission to Dance on Stage', idx: 0, users: shuffle(ALL_USERS).slice(0, 8),
      pairs: [
        [2, 2], [2, 2], [2, 2], [2, 2], [2, 2], [2, 2], [3, 4], [2, 2]
      ]
    },
    // Avengers show 1 — 5 users
    {
      title: 'Avengers: Doomsday', idx: 0, users: shuffle(FIRST_10).slice(0, 5),
      pairs: [
        [2, 2], [2, 2], [2, 2], [2, 2], [3, 3]
      ]
    },
    // Avengers show 2 — 4 users
    {
      title: 'Avengers: Doomsday', idx: 1, users: shuffle(LAST_10).slice(0, 4),
      pairs: [
        [2, 2], [2, 2], [2, 2], [2, 2]
      ]
    },
    // BLACKPINK — 7 users, 1 failed
    {
      title: 'BLACKPINK BORN PINK World Tour', idx: 0, users: shuffle(ALL_USERS).slice(0, 7),
      pairs: [
        [2, 2], [2, 2], [2, 2], [2, 2], [2, 2], [2, 2], [3, 3]
      ]
    },
    // Digital Summit — 3 users
    {
      title: 'Digital Transformation Summit 2024', idx: 0, users: shuffle(ALL_USERS).slice(0, 3),
      pairs: [
        [2, 2], [2, 2], [3, 4]
      ]
    },
    // Captain America show 1 — 5 users
    {
      title: 'Captain America: Brave New World', idx: 0, users: shuffle(FIRST_10).slice(0, 5),
      pairs: [
        [2, 2], [2, 2], [2, 2], [2, 2], [2, 2]
      ]
    },
    // Captain America show 2 — 4 users
    {
      title: 'Captain America: Brave New World', idx: 1, users: shuffle(LAST_10).slice(0, 4),
      pairs: [
        [2, 2], [2, 2], [2, 2], [3, 3]
      ]
    },
    // Ed Sheeran — 6 users
    {
      title: 'Ed Sheeran: Mathematics Tour', idx: 0, users: shuffle(ALL_USERS).slice(0, 6),
      pairs: [
        [2, 2], [2, 2], [2, 2], [2, 2], [2, 2], [2, 3]
      ]
    },
    // Taylor Swift — 8 users, 1 refunded
    {
      title: 'Taylor Swift: The Eras Tour Bangkok', idx: 0, users: shuffle(ALL_USERS).slice(0, 8),
      pairs: [
        [2, 2], [2, 2], [2, 2], [2, 2], [2, 2], [2, 2], [3, 4], [2, 2]
      ]
    },
  ];

  const methodRotation = [1, 2, 3, 4]; // PromptPay, Credit Card, TrueMoney, ShopeePay
  let methodIdx = 0;

  console.log('\n=== Creating Historical Bookings ===');

  for (const plan of plans) {
    const stList = showtimeIndex[plan.title];
    if (!stList || !stList[plan.idx]) {
      console.warn(`  No showtime found for "${plan.title}" idx=${plan.idx}`);
      continue;
    }

    const { showtimeID, venueKey, basePrice, startDT } = stList[plan.idx];
    console.log(`\nProcessing: ${plan.title} (ShowtimeID=${showtimeID})`);

    for (let i = 0; i < plan.users.length; i++) {
      const userID             = plan.users[i];
      const [bookingSt, paySt] = plan.pairs[i] || [2, 2];
      const method             = methodRotation[methodIdx % 4];
      methodIdx++;

      // Seat count: 1-3 per booking, popular rows first
      const seatCount    = 1 + (i % 3); // rotates 1,2,3,1,2,3...
      const chosenSeats  = getUnusedSeats(showtimeID, venueKey, seatCount);

      if (chosenSeats.length === 0) {
        console.warn(`  No seats left for showtime ${showtimeID}`);
        continue;
      }

      // Booking happens 7-30 days before event
      const daysBefore      = 7 + (i * 3) % 23; // varies 7-29
      const bookingTimestamp = subtractDays(startDT, daysBefore);

      const bookingID = await createHistoricalBooking({
        userID,
        showtimeID,
        seats:            chosenSeats,
        basePrice,
        bookingTimestamp,
        bookingStatusID:  bookingSt,
        paymentMethodID:  method,
        paymentStatusID:  paySt
      });

      if (bookingID) {
        console.log(`  Booking #${bookingID} user=${userID} seats=${chosenSeats.length} bookingSt=${bookingSt} paySt=${paySt}`);
      }
    }
  }

  console.log('\n=== Historical Seed Complete ===');
}

main()
  .catch(err => {
    console.error('Seed error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
