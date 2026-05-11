const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

function addMinutes(date, mins) {
  return new Date(date.getTime() + mins * 60 * 1000);
}

async function getRequiredRecords() {
  const [customerRole, completedStatus, successStatus, method, showtimes] = await Promise.all([
    prisma.role.findFirst({ where: { RoleName: 'Customer' } }),
    prisma.bookingStatus.findFirst({ where: { StatusName: 'Completed' } }),
    prisma.paymentStatus.findFirst({ where: { StatusName: 'Success' } }),
    prisma.paymentMethod.findFirst({ where: { IsActive: true }, orderBy: { MethodID: 'asc' } }),
    prisma.showtime.findMany({
      include: {
        Venue: {
          include: {
            Seats: {
              include: { SeatType: true },
              orderBy: [{ RowLabel: 'asc' }, { SeatNumber: 'asc' }]
            }
          }
        }
      },
      orderBy: { StartDateTime: 'asc' }
    })
  ]);

  if (!customerRole || !completedStatus || !successStatus || !method || showtimes.length === 0) {
    throw new Error('Missing seed prerequisites. Run the base seed and historical seed first.');
  }

  return { customerRole, completedStatus, successStatus, method, showtimes };
}

async function ensureCustomer(email, fullName, passwordHash, roleId) {
  return prisma.user.upsert({
    where: { Email: email },
    create: {
      Email: email,
      FullName: fullName,
      Password: passwordHash,
      RoleID: roleId,
      CreatedAt: new Date('2025-05-01T09:00:00Z'),
      UpdatedAt: new Date('2025-05-01T09:00:00Z')
    },
    update: {}
  });
}

async function createPaidBooking({ user, showtime, seatOffset, bookingDate, methodId, bookingStatusId, paymentStatusId, suffix }) {
  const existing = await prisma.booking.findFirst({
    where: {
      UserID: user.UserID,
      Payment: { TransactionID: `TXN-RETENTION-${suffix}` }
    }
  });
  if (existing) return false;

  const seats = showtime.Venue.Seats.slice(seatOffset, seatOffset + 1);
  if (seats.length === 0) return false;

  const totalAmount = seats.reduce(
    (sum, seat) => sum + Number(showtime.BasePrice) * Number(seat.SeatType.PriceModifier),
    0
  );

  const booking = await prisma.booking.create({
    data: {
      UserID: user.UserID,
      StatusID: bookingStatusId,
      BookingTimestamp: bookingDate,
      ExpiresAt: addMinutes(bookingDate, 15),
      TotalAmount: totalAmount,
      CreatedAt: bookingDate,
      UpdatedAt: bookingDate
    }
  });

  for (const seat of seats) {
    await prisma.bookingDetail.create({
      data: {
        BookingID: booking.BookingID,
        ShowtimeID: showtime.ShowtimeID,
        SeatID: seat.SeatID,
        CreatedAt: bookingDate,
        UpdatedAt: bookingDate
      }
    });
  }

  await prisma.payment.create({
    data: {
      BookingID: booking.BookingID,
      MethodID: methodId,
      StatusID: paymentStatusId,
      TransactionID: `TXN-RETENTION-${suffix}`,
      Amount: totalAmount,
      PaidAt: addMinutes(bookingDate, 4),
      CreatedAt: bookingDate,
      UpdatedAt: bookingDate
    }
  });

  return true;
}

async function main() {
  const { customerRole, completedStatus, successStatus, method, showtimes } = await getRequiredRecords();
  const passwordHash = await bcrypt.hash('pass1234', 10);

  const oneTimeSpecs = [
    { email: 'retention.one.01@example.com', name: 'Retention One 01', showtimeIndex: 0, date: '2025-05-08T10:00:00Z' },
    { email: 'retention.one.02@example.com', name: 'Retention One 02', showtimeIndex: 2, date: '2025-06-10T11:00:00Z' },
    { email: 'retention.one.03@example.com', name: 'Retention One 03', showtimeIndex: 4, date: '2025-08-02T12:00:00Z' },
    { email: 'retention.one.04@example.com', name: 'Retention One 04', showtimeIndex: 6, date: '2025-09-20T13:00:00Z' },
    { email: 'retention.one.05@example.com', name: 'Retention One 05', showtimeIndex: 8, date: '2025-11-18T14:00:00Z' },
    { email: 'retention.one.06@example.com', name: 'Retention One 06', showtimeIndex: 10, date: '2026-01-10T15:00:00Z' },
    { email: 'retention.one.07@example.com', name: 'Retention One 07', showtimeIndex: 11, date: '2025-06-21T09:30:00Z' },
    { email: 'retention.one.08@example.com', name: 'Retention One 08', showtimeIndex: 12, date: '2025-07-14T10:45:00Z' },
    { email: 'retention.one.09@example.com', name: 'Retention One 09', showtimeIndex: 13, date: '2025-08-23T11:15:00Z' },
    { email: 'retention.one.10@example.com', name: 'Retention One 10', showtimeIndex: 14, date: '2025-09-16T12:20:00Z' },
    { email: 'retention.one.11@example.com', name: 'Retention One 11', showtimeIndex: 15, date: '2025-10-12T13:10:00Z' },
    { email: 'retention.one.12@example.com', name: 'Retention One 12', showtimeIndex: 16, date: '2025-11-04T14:05:00Z' },
    { email: 'retention.one.13@example.com', name: 'Retention One 13', showtimeIndex: 17, date: '2025-12-02T15:35:00Z' },
    { email: 'retention.one.14@example.com', name: 'Retention One 14', showtimeIndex: 18, date: '2026-01-19T16:00:00Z' },
    { email: 'retention.one.15@example.com', name: 'Retention One 15', showtimeIndex: 19, date: '2026-02-07T09:50:00Z' },
    { email: 'retention.one.16@example.com', name: 'Retention One 16', showtimeIndex: 20, date: '2026-03-11T10:25:00Z' }
  ];

  const repeatSpecs = [
    { email: 'retention.repeat.01@example.com', name: 'Retention Repeat 01', showtimeIndexes: [0, 4, 11], date: '2025-05-09T10:00:00Z' },
    { email: 'retention.repeat.02@example.com', name: 'Retention Repeat 02', showtimeIndexes: [1, 5, 9], date: '2025-06-11T11:00:00Z' },
    { email: 'retention.repeat.03@example.com', name: 'Retention Repeat 03', showtimeIndexes: [3, 7, 12], date: '2025-07-05T12:00:00Z' },
    { email: 'retention.repeat.04@example.com', name: 'Retention Repeat 04', showtimeIndexes: [2, 6, 10], date: '2025-08-15T13:00:00Z' },
    { email: 'retention.repeat.05@example.com', name: 'Retention Repeat 05', showtimeIndexes: [11, 12, 15, 18], date: '2025-09-03T10:30:00Z' },
    { email: 'retention.repeat.06@example.com', name: 'Retention Repeat 06', showtimeIndexes: [8, 13, 16, 20], date: '2025-10-07T11:20:00Z' },
    { email: 'retention.repeat.07@example.com', name: 'Retention Repeat 07', showtimeIndexes: [4, 9, 14, 19], date: '2025-11-13T12:10:00Z' },
    { email: 'retention.repeat.08@example.com', name: 'Retention Repeat 08', showtimeIndexes: [5, 10, 17, 21], date: '2025-12-05T13:40:00Z' }
  ];

  let created = 0;

  for (const [index, spec] of oneTimeSpecs.entries()) {
    const user = await ensureCustomer(spec.email, spec.name, passwordHash, customerRole.RoleID);
    const showtime = showtimes[spec.showtimeIndex % showtimes.length];
    const didCreate = await createPaidBooking({
      user,
      showtime,
      seatOffset: index,
      bookingDate: new Date(spec.date),
      methodId: method.MethodID,
      bookingStatusId: completedStatus.StatusID,
      paymentStatusId: successStatus.StatusID,
      suffix: `ONE-${index + 1}`
    });
    if (didCreate) created++;
  }

  for (const [repeatIndex, spec] of repeatSpecs.entries()) {
    const user = await ensureCustomer(spec.email, spec.name, passwordHash, customerRole.RoleID);
    for (const [bookingIndex, showtimeIndex] of spec.showtimeIndexes.entries()) {
      const showtime = showtimes[showtimeIndex % showtimes.length];
      const didCreate = await createPaidBooking({
        user,
        showtime,
        seatOffset: repeatIndex + bookingIndex + 2,
        bookingDate: addMinutes(new Date(spec.date), bookingIndex * 1440),
        methodId: method.MethodID,
        bookingStatusId: completedStatus.StatusID,
        paymentStatusId: successStatus.StatusID,
        suffix: `REPEAT-${repeatIndex + 1}-${bookingIndex + 1}`
      });
      if (didCreate) created++;
    }
  }

  console.log(`Customer retention mock bookings created: ${created}`);
}

main()
  .catch(err => {
    console.error('Retention seed error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
