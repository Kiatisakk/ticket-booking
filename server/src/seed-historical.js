/**
 * Historical seed script for Thai Ticketing System
 * Run with: node src/seed-historical.js
 *
 * - Does NOT delete existing data (additive only)
 * - Uses upsert / createMany with skipDuplicates
 * - All dates are historical: May 2025 – May 2026
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

  // Create roles if they don't exist
  const roleNames = [
    { id: 1, name: 'Admin', description: 'System Administrator' },
    { id: 2, name: 'Staff', description: 'Event Staff' },
    { id: 3, name: 'Customer', description: 'Regular Customer' }
  ];

  for (const role of roleNames) {
    let record = await prisma.role.findFirst({ where: { RoleName: role.name } });
    if (!record) {
      await prisma.role.create({
        data: { RoleID: role.id, RoleName: role.name, Description: role.description }
      });
    }
  }

  const seatTypeNames = [
    { name: 'VIP', modifier: 2.0 },
    { name: 'Standard', modifier: 1.0 },
    { name: 'Sofa Bed', modifier: 1.5 }
  ];

  for (const item of seatTypeNames) {
    let record = await prisma.seatType.findFirst({ where: { TypeName: item.name } });
    if (!record) {
      await prisma.seatType.create({
        data: { TypeName: item.name, PriceModifier: item.modifier }
      });
    }
  }

  // จัดการ EventCategory แบบปลอดภัย
  const categoryNames = ['Concert', 'Movie', 'Seminar'];
  for (const name of categoryNames) {
    let record = await prisma.eventCategory.findFirst({ where: { CategoryName: name } });
    if (!record) {
      await prisma.eventCategory.create({
        data: { CategoryName: name }
      });
    }
  }

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

  console.log('Seat types ready:', Object.keys(stMap).join(', '));
  console.log('Categories ready:', Object.keys(catMap).join(', '));

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
      showtimes: [{ dt: new Date('2025-05-17T19:00:00Z'), price: 2500 }]
    },
    {
      title:     'Spider-Man: Beyond the Spider-Verse',
      category:  'Movie',
      venue:     'SF Cinema Paragon',
      showtimes: [
        { dt: new Date('2025-06-21T14:00:00Z'), price: 280 },
        { dt: new Date('2025-06-21T18:00:00Z'), price: 280 }
      ]
    },
    {
      title:     'AI & Future of Work Seminar',
      category:  'Seminar',
      venue:     'BITEC Bangkok',
      showtimes: [{ dt: new Date('2025-07-12T09:00:00Z'), price: 1200 }]
    },
    {
      title:     'BTS: Permission to Dance on Stage',
      category:  'Concert',
      venue:     'Impact Arena',
      showtimes: [{ dt: new Date('2025-08-23T18:00:00Z'), price: 3500 }]
    },
    {
      title:     'Avengers: Doomsday',
      category:  'Movie',
      venue:     'SF Cinema Paragon',
      showtimes: [
        { dt: new Date('2025-10-04T15:00:00Z'), price: 320 },
        { dt: new Date('2025-10-04T20:00:00Z'), price: 320 }
      ]
    },
    {
      title:     'BLACKPINK BORN PINK World Tour',
      category:  'Concert',
      venue:     'Impact Arena',
      showtimes: [{ dt: new Date('2025-11-15T19:00:00Z'), price: 3000 }]
    },
    {
      title:     'Digital Transformation Summit 2025',
      category:  'Seminar',
      venue:     'BITEC Bangkok',
      showtimes: [{ dt: new Date('2025-12-06T08:30:00Z'), price: 1500 }]
    },
    {
      title:     'Captain America: Brave New World',
      category:  'Movie',
      venue:     'SF Cinema Paragon',
      showtimes: [
        { dt: new Date('2026-01-24T13:00:00Z'), price: 300 },
        { dt: new Date('2026-01-24T17:30:00Z'), price: 300 }
      ]
    },
    {
      title:     'Ed Sheeran: Mathematics Tour',
      category:  'Concert',
      venue:     'Impact Arena',
      showtimes: [{ dt: new Date('2026-03-14T19:30:00Z'), price: 2800 }]
    },
    {
      title:     'Taylor Swift: The Eras Tour Bangkok',
      category:  'Concert',
      venue:     'Impact Arena',
      showtimes: [{ dt: new Date('2026-05-17T18:00:00Z'), price: 4000 }]
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
    { email: 'somchai@gmail.com',     name: 'Somchai',   createdAt: new Date('2025-05-05') },
    { email: 'nattaporn@gmail.com',   name: 'Nattaporn', createdAt: new Date('2025-05-20') },
    { email: 'wichaya@hotmail.com',   name: 'Wichaya',   createdAt: new Date('2025-06-08') },
    { email: 'panida@gmail.com',      name: 'Panida',    createdAt: new Date('2025-06-25') },
    { email: 'kittipong@gmail.com',   name: 'Kittipong', createdAt: new Date('2025-07-10') },
    { email: 'sirirat@yahoo.com',     name: 'Sirirat',   createdAt: new Date('2025-07-28') },
    { email: 'arthit@gmail.com',      name: 'Arthit',    createdAt: new Date('2025-08-14') },
    { email: 'monrada@gmail.com',     name: 'Monrada',   createdAt: new Date('2025-09-03') },
    { email: 'chaiwat@hotmail.com',   name: 'Chaiwat',   createdAt: new Date('2025-09-22') },
    { email: 'preeya@gmail.com',      name: 'Preeya',    createdAt: new Date('2025-10-10') },
    { email: 'sarawut@gmail.com',     name: 'Sarawut',   createdAt: new Date('2025-11-01') },
    { email: 'kannika@gmail.com',     name: 'Kannika',   createdAt: new Date('2025-11-20') },
    { email: 'teerawat@gmail.com',    name: 'Teerawat',  createdAt: new Date('2025-12-08') },
    { email: 'mayuree@hotmail.com',   name: 'Mayuree',   createdAt: new Date('2026-01-15') },
    { email: 'suphot@gmail.com',      name: 'Suphot',    createdAt: new Date('2026-02-05') },
    { email: 'wassana@gmail.com',     name: 'Wassana',   createdAt: new Date('2026-02-22') },
    { email: 'jirawat@gmail.com',     name: 'Jirawat',   createdAt: new Date('2026-03-12') },
    { email: 'nareerat@gmail.com',    name: 'Nareerat',  createdAt: new Date('2026-04-02') },
    { email: 'phakorn@gmail.com',     name: 'Phakorn',   createdAt: new Date('2026-04-20') },
    { email: 'ladawan@gmail.com',     name: 'Ladawan',   createdAt: new Date('2026-05-06') },
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
      update: {}
    });
    userIds[spec.email] = user.UserID;
  }
  console.log(`\nUpserted ${userSpecs.length} repeat-customer users`);

  const histUserIDs = Object.values(userIds);

  // ── 6b. Create 10 "one-time" users (each gets exactly 1 booking) ──────────
  // Keeps Report 9 realistic: ~33% one-time vs 67% repeat customers
  const oneTimeNames = [
    'Anong','Boonsri','Chanchai','Duangjai','Ekachai',
    'Fonthip','Gaysorn','Hathai','Itthiporn','Jiraporn'
  ];
  const oneTimeUserIDs = [];
  for (let i = 0; i < oneTimeNames.length; i++) {
    const name  = oneTimeNames[i];
    const email = `${name.toLowerCase()}.ot@example.com`;
    // Spread CreatedAt across May 2025 – May 2026 (13 months)
    const monthOffset = i % 13;  // 0..12
    const baseDate = new Date(2025, 4 + monthOffset, (i * 3) % 27 + 1, 10, 0, 0); // month 4 = May
    const createdAt = baseDate;

    const u = await prisma.user.upsert({
      where: { Email: email },
      create: {
        Email:     email,
        FullName:  name,
        Password:  passwordHash,
        RoleID:    3,
        CreatedAt: createdAt,
        UpdatedAt: createdAt
      },
      update: {}
    });
    oneTimeUserIDs.push(u.UserID);
  }
  console.log(`Upserted ${oneTimeUserIDs.length} one-time users`);

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
   * @param {number}   opts.paymentStatusID — 2=Success, 3=Failed
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

  // ── 10. Look up real IDs from DB ─────────────────────────────────────────────

  const allMethods = await prisma.paymentMethod.findMany({ orderBy: { MethodID: 'asc' } });
  const methodByName = {};
  for (const m of allMethods) methodByName[m.MethodName] = m.MethodID;

  const methodRotation = [
    methodByName['PromptPay'],
    methodByName['Credit Card'],
    methodByName['TrueMoney'],
    methodByName['ShopeePay']
  ].filter(Boolean);

  if (methodRotation.length === 0) {
    console.error('ERROR: No PaymentMethods found in DB. Run "npm run db:seed" first.');
    return;
  }
  console.log(`\nUsing PaymentMethod IDs: ${methodRotation.join(', ')}`);

  const allBookingStatuses = await prisma.bookingStatus.findMany();
  const bookingStatusByName = {};
  for (const s of allBookingStatuses) bookingStatusByName[s.StatusName] = s.StatusID;

  const allPaymentStatuses = await prisma.paymentStatus.findMany();
  const paymentStatusByName = {};
  for (const s of allPaymentStatuses) paymentStatusByName[s.StatusName] = s.StatusID;

  const BS_COMPLETED = bookingStatusByName['Completed'];
  const BS_PENDING   = bookingStatusByName['Pending'];
  const BS_CANCELLED = bookingStatusByName['Cancelled'];
  const PS_SUCCESS   = paymentStatusByName['Success'];
  const PS_FAILED    = paymentStatusByName['Failed'];
  const PS_PENDING   = paymentStatusByName['Pending'];

  console.log(`Status IDs — BS_Completed=${BS_COMPLETED} BS_Pending=${BS_PENDING} BS_Cancelled=${BS_CANCELLED} PS_Success=${PS_SUCCESS} PS_Failed=${PS_FAILED} PS_Pending=${PS_PENDING}\n`);

  // ── 11. Helper to create ghost booking (no seats — Pending or Failed only) ──
  async function createGhostBooking({ userID, bookingTimestamp, totalAmount, bookingStatusID, paymentMethodID, paymentStatusID }) {
    txnCounter++;
    const transactionID = `TXN-HIST-${txnCounter}-${Math.floor(1000 + Math.random() * 9000)}`;
    const expiresAt = addMinutes(bookingTimestamp, 15);

    try {
      const booking = await prisma.booking.create({
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
      await prisma.payment.create({
        data: {
          BookingID:     booking.BookingID,
          MethodID:      paymentMethodID,
          StatusID:      paymentStatusID,
          TransactionID: transactionID,
          Amount:        totalAmount,
          PaidAt:        null,
          CreatedAt:     bookingTimestamp,
          UpdatedAt:     bookingTimestamp
        }
      });
      return booking.BookingID;
    } catch (err) {
      console.error('  Ghost booking failed:', err.message);
    }
  }

  // ── 12. Fill capacity for every showtime (sold-out) ─────────────────────────

  console.log('=== Filling Capacity (Sold-Out Mode) ===');

  let methodIdx = 0;
  let totalBookings = 0;
  let totalFailedAttempts = 0;
  let totalCancelledBookings = 0;

  for (const eventTitle of Object.keys(showtimeIndex)) {
    const stList = showtimeIndex[eventTitle];

    for (const stInfo of stList) {
      const { showtimeID, venueKey, basePrice, startDT } = stInfo;
      const venueSeats = allSeats[venueKey];

      console.log(`\n[${eventTitle}] Showtime=${showtimeID} (${venueSeats.length} seats)`);

      // ── (a) ~10% of seats also have a Failed payment attempt (different user)
      // Models real life: customer tries to buy a seat, payment fails, then the
      // seat eventually sells to a different customer (Success). We allow same
      // SeatID + ShowtimeID across multiple BookingDetails (no DB constraint).
      const failedCount = Math.max(2, Math.floor(venueSeats.length * 0.10));
      const seatsForFailed = shuffle([...venueSeats]).slice(0, failedCount);

      let bIdx = 0;
      for (const seat of seatsForFailed) {
        const userID = histUserIDs[(bIdx * 7 + 3) % histUserIDs.length];
        const method = methodRotation[methodIdx % methodRotation.length];
        methodIdx++;

        const daysBefore = 14 + (bIdx % 14);
        const bookingTs  = subtractDays(startDT, daysBefore);

        await createHistoricalBooking({
          userID, showtimeID,
          seats:            [seat],
          basePrice,
          bookingTimestamp: bookingTs,
          bookingStatusID:  BS_COMPLETED,  // booking record exists; payment failed
          paymentMethodID:  method,
          paymentStatusID:  PS_FAILED
        });
        bIdx++;
        totalFailedAttempts++;
      }

      // ── (b) Successful bookings for EVERY seat (sold out)
      const cancelledCount = Math.max(2, Math.floor(venueSeats.length * 0.14));
      const seatsForCancelled = shuffle([...venueSeats])
        .filter(seat => !seatsForFailed.some(failedSeat => failedSeat.SeatID === seat.SeatID))
        .slice(0, cancelledCount);

      for (const seat of seatsForCancelled) {
        const userID = histUserIDs[(bIdx * 5 + 1) % histUserIDs.length];
        const method = methodRotation[methodIdx % methodRotation.length];
        methodIdx++;

        const daysBefore = 5 + (bIdx % 18);
        const bookingTs = subtractDays(startDT, daysBefore);

        const bid = await createHistoricalBooking({
          userID,
          showtimeID,
          seats: [seat],
          basePrice,
          bookingTimestamp: bookingTs,
          bookingStatusID: BS_CANCELLED,
          paymentMethodID: method,
          paymentStatusID: PS_PENDING
        });
        if (bid) totalCancelledBookings++;
        bIdx++;
      }

      const shuffledForSuccess = shuffle([...venueSeats]);
      let seatIdx = 0;

      // First seats go to "one-time" users (1 user, 1 seat, 1 booking each)
      // Distribute across events: only 1 one-time user per showtime so the
      // pool of 10 stretches across all 13 showtimes (some get 0, some get 1)
      const oneTimeSeatsPerEvent = Math.min(1, oneTimeUserIDs.length);
      let oneTimeSeatsAllocated  = 0;

      while (seatIdx < shuffledForSuccess.length) {
        let userID, groupSize;
        if (oneTimeSeatsAllocated < oneTimeSeatsPerEvent && oneTimeUserIDs.length > 0) {
          // Pick a one-time user (only 1 booking ever per user)
          userID    = oneTimeUserIDs.shift(); // remove from pool — won't be used again
          groupSize = 1;                       // exactly 1 seat
          oneTimeSeatsAllocated++;
        } else {
          userID    = histUserIDs[bIdx % histUserIDs.length];
          groupSize = Math.min(1 + (bIdx % 3), shuffledForSuccess.length - seatIdx);
        }

        const seatGroup = shuffledForSuccess.slice(seatIdx, seatIdx + groupSize);
        seatIdx += groupSize;
        if (seatGroup.length === 0) break;

        const method = methodRotation[methodIdx % methodRotation.length];
        methodIdx++;

        const daysBefore = 1 + (bIdx * 3) % 28;
        const bookingTs  = subtractDays(startDT, daysBefore);

        const bid = await createHistoricalBooking({
          userID, showtimeID,
          seats:            seatGroup,
          basePrice,
          bookingTimestamp: bookingTs,
          bookingStatusID:  BS_COMPLETED,
          paymentMethodID:  method,
          paymentStatusID:  PS_SUCCESS
        });
        if (bid) totalBookings++;
        bIdx++;
      }

      console.log(`  Filled ${venueSeats.length} seats · ${failedCount} failed attempts`);
    }
  }

  console.log(`\n=== Historical Seed Complete ===`);
  console.log(`  Successful bookings: ${totalBookings}`);
  console.log(`  Failed attempts:     ${totalFailedAttempts}`);
  console.log(`  Cancelled bookings:  ${totalCancelledBookings}`);
}

main()
  .catch(err => {
    console.error('Seed error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
