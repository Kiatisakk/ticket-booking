# Ticket Booking System - Quick Start Guide

## 🎯 Getting Started in 3 Steps

### Option 1: Using Setup Script (Windows)

Simply run:
```batch
setup.bat
```

This will install all dependencies, setup database, and seed sample data.

### Option 2: Manual Setup

```bash
# 1. Start the database
docker-compose up -d database

# 2. Navigate to server folder
cd server

# 3. Install dependencies
npm install

# 4. Setup database
npx prisma generate
npx prisma db push
npm run db:seed

# 5. Start the server
npm run dev
```

---

## 🚀 Running the Full Stack

To run everything (database + server + client):

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

**Services will be available at:**
- 🌐 Frontend: http://localhost:3000
- 🔌 API: http://localhost:4000
- 🗄️ Database: localhost:5432
- 📊 Adminer (DB UI): http://localhost:8080

---

## 🧪 Testing the API

After setup, test the API:

```bash
cd server
node test-api.js
```

Or open in browser:
- http://localhost:4000/api/events
- http://localhost:4000/api/venues
- http://localhost:4000/api/seat-types

---

## 🔐 Sample Login Credentials

**Admin Account:**
- Email: `admin@example.com`
- Password: `password123`

**Customer Account:**
- Email: `john@example.com`
- Password: `password123`

---

## 📚 API Documentation

Complete API documentation is available at: `server/API.md`

### Quick Examples:

**Login:**
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"password123"}'
```

**Get Events:**
```bash
curl http://localhost:4000/api/events
```

**Create Booking:**
```bash
curl -X POST http://localhost:4000/api/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"showtimeId":1,"seatIds":[1,2,3]}'
```

---

## 🗂️ Project Structure

```
ticket-booking/
├── server/
│   ├── prisma/
│   │   ├── schema.prisma    # Database models
│   │   └── seed.js          # Sample data
│   ├── index.js             # Express server + API
│   ├── API.md               # API documentation
│   └── package.json
├── client/
│   └── src/
│       └── App.jsx          # React frontend
├── database/
│   └── init/
│       └── schema.sql       # SQL schema
├── docker-compose.yml       # Docker configuration
└── setup.bat               # Quick setup script
```

---

## 🛠️ Troubleshooting

**Server won't start?**
```bash
# Check if database is running
docker-compose ps

# Restart database
docker-compose restart database

# Check server logs
cd server
npm start
```

**Database connection error?**
```bash
# Make sure .env file exists in server/
# Should contain:
DATABASE_URL="postgresql://admin:password123@localhost:5432/ticket_booking_db"
```

**Port already in use?**
```bash
# Create .env file in root directory with:
PORT_DB=5433
PORT_SERVER=4001
PORT_CLIENT=3001
```

---

## 📦 What's Included

✅ **Backend Features:**
- Express.js server
- Prisma ORM
- PostgreSQL database
- JWT authentication
- Role-based access (Admin, Staff, Customer)
- Complete CRUD operations
- Booking system with cart expiration
- Payment processing (mock)
- Ticket generation & verification

✅ **Database Schema:**
- Users & Roles
- Events & Categories
- Venues & Seats (VIP, Standard, Sofa)
- Showtimes
- Bookings & Details
- Payments (PromptPay, Credit Card, TrueMoney, ShopeePay)
- Tickets

✅ **Sample Data:**
- 3 Events (Movie, Concert, Seminar)
- 1 Venue with 100 seats
- 4 Showtimes
- 2 Users (Admin + Customer)

---

## 🎯 Next Steps

1. ✅ Backend API is ready!
2. 🔲 Build the React frontend
3. 🔲 Connect frontend to backend
4. 🔲 Add UI components (seat selection, checkout, etc.)
5. 🔲 Test the complete booking flow

---

## 📖 Learn More

- Server README: `server/README.md`
- API Documentation: `server/API.md`
- Database Schema: `server/prisma/schema.prisma`
