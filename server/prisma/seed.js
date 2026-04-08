const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Optional: Clear existing data if re-seeding
  console.log('Checking for existing data...');
  const userCount = await prisma.user.count();
  
  if (userCount > 0) {
    console.log('⚠️  Database already has data. Clearing and re-seeding...');
    await prisma.$transaction([
      prisma.ticket.deleteMany(),
      prisma.payment.deleteMany(),
      prisma.bookingDetail.deleteMany(),
      prisma.booking.deleteMany(),
      prisma.showtime.deleteMany(),
      prisma.seat.deleteMany(),
      prisma.venue.deleteMany(),
      prisma.event.deleteMany(),
      prisma.user.deleteMany(),
      prisma.seatType.deleteMany(),
      prisma.eventCategory.deleteMany(),
      prisma.paymentStatus.deleteMany(),
      prisma.bookingStatus.deleteMany(),
      prisma.role.deleteMany(),
      prisma.paymentMethod.deleteMany(),
    ]);
    console.log('✅ Database cleared');
  }

  // Create Roles
  console.log('Creating roles...');
  const adminRole = await prisma.role.create({
    data: { RoleName: 'Admin', Description: 'System Administrator' }
  });
  const staffRole = await prisma.role.create({
    data: { RoleName: 'Staff', Description: 'Event Staff' }
  });
  const customerRole = await prisma.role.create({
    data: { RoleName: 'Customer', Description: 'Regular Customer' }
  });

  // Create Booking Statuses
  console.log('Creating booking statuses...');
  await prisma.bookingStatus.createMany({
    data: [
      { StatusName: 'Pending' },
      { StatusName: 'Completed' },
      { StatusName: 'Cancelled' }
    ]
  });

  // Create Payment Statuses
  console.log('Creating payment statuses...');
  await prisma.paymentStatus.createMany({
    data: [
      { StatusName: 'Pending' },
      { StatusName: 'Success' },
      { StatusName: 'Failed' },
      { StatusName: 'Refunded' }
    ]
  });

  // Create Event Categories
  console.log('Creating event categories...');
  await prisma.eventCategory.createMany({
    data: [
      { CategoryName: 'Movie' },
      { CategoryName: 'Concert' },
      { CategoryName: 'Seminar' }
    ]
  });

  // Create Seat Types
  console.log('Creating seat types...');
  await prisma.seatType.createMany({
    data: [
      { TypeName: 'VIP', PriceModifier: 2.0 },
      { TypeName: 'Standard', PriceModifier: 1.0 },
      { TypeName: 'Sofa Bed', PriceModifier: 1.5 }
    ]
  });

  // Create Payment Methods
  console.log('Creating payment methods...');
  await prisma.paymentMethod.createMany({
    data: [
      { MethodName: 'PromptPay' },
      { MethodName: 'Credit Card' },
      { MethodName: 'TrueMoney' },
      { MethodName: 'ShopeePay' }
    ]
  });

  // Create sample users
  console.log('Creating sample users...');
  const hashedPassword = await bcrypt.hash('password123', 10);
  
  const adminUser = await prisma.user.create({
    data: {
      FullName: 'Admin User',
      Email: 'admin@example.com',
      Password: hashedPassword,
      RoleID: adminRole.RoleID
    }
  });

  const customerUser = await prisma.user.create({
    data: {
      FullName: 'John Doe',
      Email: 'john@example.com',
      Password: hashedPassword,
      RoleID: customerRole.RoleID
    }
  });

  // Create sample venue
  console.log('Creating sample venue...');
  const venue = await prisma.venue.create({
    data: {
      VenueName: 'Central World Cinema',
      Location: 'Bangkok, Thailand'
    }
  });

  // Create seats for the venue
  console.log('Creating seats...');
  const seatTypes = await prisma.seatType.findMany();
  const seats = [];
  
  // Row A-D: VIP seats
  for (let row = 0; row < 4; row++) {
    for (let seat = 1; seat <= 10; seat++) {
      seats.push({
        VenueID: venue.VenueID,
        SeatTypeID: seatTypes[0].SeatTypeID, // VIP
        RowLabel: String.fromCharCode(65 + row),
        SeatNumber: String(seat)
      });
    }
  }
  
  // Row E-H: Standard seats
  for (let row = 4; row < 8; row++) {
    for (let seat = 1; seat <= 10; seat++) {
      seats.push({
        VenueID: venue.VenueID,
        SeatTypeID: seatTypes[1].SeatTypeID, // Standard
        RowLabel: String.fromCharCode(65 + row),
        SeatNumber: String(seat)
      });
    }
  }
  
  // Row I-J: Sofa Bed seats
  for (let row = 8; row < 10; row++) {
    for (let seat = 1; seat <= 10; seat++) {
      seats.push({
        VenueID: venue.VenueID,
        SeatTypeID: seatTypes[2].SeatTypeID, // Sofa Bed
        RowLabel: String.fromCharCode(65 + row),
        SeatNumber: String(seat)
      });
    }
  }

  await prisma.seat.createMany({ data: seats });

  // Create sample events
  console.log('Creating sample events...');
  const categories = await prisma.eventCategory.findMany();
  
  const event1 = await prisma.event.create({
    data: {
      Title: 'Avengers: Secret Wars',
      Description: 'The epic conclusion to the Multiverse Saga. The Avengers face their greatest challenge yet.',
      CategoryID: categories[0].CategoryID // Movie
    }
  });

  const event2 = await prisma.event.create({
    data: {
      Title: 'Coldplay Live in Bangkok',
      Description: 'Experience Coldplay\'s Music of the Spheres World Tour live!',
      CategoryID: categories[1].CategoryID // Concert
    }
  });

  const event3 = await prisma.event.create({
    data: {
      Title: 'Tech Innovation Summit 2025',
      Description: 'Join industry leaders discussing the future of AI, Web3, and Cloud Computing.',
      CategoryID: categories[2].CategoryID // Seminar
    }
  });

  // Create showtimes
  console.log('Creating showtimes...');
  const futureDate1 = new Date();
  futureDate1.setDate(futureDate1.getDate() + 7);
  
  const futureDate2 = new Date();
  futureDate2.setDate(futureDate2.getDate() + 14);
  
  const futureDate3 = new Date();
  futureDate3.setDate(futureDate3.getDate() + 21);

  await prisma.showtime.createMany({
    data: [
      {
        EventID: event1.EventID,
        VenueID: venue.VenueID,
        StartDateTime: futureDate1,
        BasePrice: 200
      },
      {
        EventID: event1.EventID,
        VenueID: venue.VenueID,
        StartDateTime: new Date(futureDate1.getTime() + 3 * 60 * 60 * 1000), // 3 hours later
        BasePrice: 200
      },
      {
        EventID: event2.EventID,
        VenueID: venue.VenueID,
        StartDateTime: futureDate2,
        BasePrice: 1500
      },
      {
        EventID: event3.EventID,
        VenueID: venue.VenueID,
        StartDateTime: futureDate3,
        BasePrice: 500
      }
    ]
  });

  console.log('✅ Database seeded successfully!');
  console.log('\n📋 Sample Credentials:');
  console.log('   Admin: admin@example.com / password123');
  console.log('   Customer: john@example.com / password123');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
