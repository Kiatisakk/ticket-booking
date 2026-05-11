# Ticket Booking API Server

Express.js + Prisma backend for the Ticket Booking System.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Environment
The `.env` file is already configured. Update if needed:
```env
DATABASE_URL="postgresql://admin:password123@localhost:5432/ticket_booking_db"
```

### 3. Start Database
```bash
# From project root
docker-compose up -d database
```

### 4. Initialize Database
```bash
npx prisma generate
npx prisma db push
npm run db:seed
```

### 5. Run Server
```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

Server will be running at: `http://localhost:4000`

## 📚 API Documentation

See [API.md](./API.md) for complete API documentation.

## 🗂️ Project Structure

```
server/
├── prisma/
│   ├── schema.prisma    # Database schema
│   └── seed.js          # Sample data seeder
├── index.js             # Main server file
├── package.json
└── .env                 # Environment variables
```

## 🔧 Available Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server (requires nodemon)
- `npm run db:migrate` - Run database migrations
- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema to database (dev only)
- `npm run db:seed` - Seed database with sample data
- `npm run db:seed-big` - Seed deterministic synthetic big data for performance testing
- `npm run db:optimize-indexes` - Apply performance indexes
- `npm run db:drop-indexes` - Drop performance indexes for A/B testing
- `npm run db:optimize-reports` - Apply report materialized views
- `npm run db:refresh-report-views` - Refresh report materialized views after report data changes
- `npm run db:drop-report-views` - Drop report materialized views for A/B testing
- `npm run db:benchmark` - Run the current database benchmark
- `npm run db:benchmark:ab` - Run no-index/no-report-view vs indexed/report-view A/B benchmark

## 🔐 Authentication

The API uses JWT tokens for authentication. Include the token in requests:
```
Authorization: Bearer <your-token>
```

## 📊 Database Schema

The system includes:
- Users (with role-based access)
- Events & Categories
- Venues & Seats
- Showtimes
- Bookings (with cart expiration)
- Payments (multiple methods)
- Tickets

## 🧪 Testing with Sample Data

After running `npm run db:seed`, you can test with:

**Admin Account:**
- Email: `admin@example.com`
- Password: `password123`

**Customer Account:**
- Email: `john@example.com`
- Password: `password123`

## 💡 Key Features

- ✅ JWT Authentication (login/register)
- ✅ Role-based access control (Admin, Staff, Customer)
- ✅ Event & Showtime management
- ✅ Seat selection with dynamic pricing
- ✅ Booking system with cart expiration (15 min timeout)
- ✅ Payment processing (mock integration)
- ✅ Ticket generation & verification
- ✅ CORS enabled for frontend

## 🔗 Frontend Integration

Update the client to call API endpoints at `http://localhost:4000/api`

Example:
```javascript
const response = await fetch('http://localhost:4000/api/events');
const events = await response.json();
```
