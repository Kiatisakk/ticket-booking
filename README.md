# Ticket Booking System

A full-stack web application for booking event tickets with seat selection, payment processing, and ticket generation. Features role-based access control with Admin, Staff, and Customer interfaces.

## Tech Stack

### Backend

- **Node.js** + **Express.js** - REST API server
- **Prisma ORM** - Database client & migrations
- **PostgreSQL 17** - Relational database
- **JWT** + **bcrypt** - Authentication & password hashing

### Frontend

- **React 19** - UI framework
- **React Router** - Client-side routing
- **Axios** - HTTP client
- **Vite** - Build tool

### Infrastructure

- **Docker Compose** - Database & Adminer containerization

---

## Prerequisites

- [Node.js](https://nodejs.org/) (v20 or higher)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Git](https://git-scm.com/)

---

## Quick Start

### 1. Clone & Environment Setup

```bash
git clone <your-repo-url>
cd ticket-booking
```

Create `.env` in project root:

```env
POSTGRES_USER=admin
POSTGRES_PASSWORD=password123
POSTGRES_DB=ticket_booking_db
PORT_DB=5433
PORT_SERVER=4000
HOST_SERVER=0.0.0.0
PORT_CLIENT=3000
VITE_API_BASE=http://localhost:4000
```

Create `server/.env`:

```env
DATABASE_URL="postgresql://admin:password123@localhost:5433/ticket_booking_db"
```

### 2. Start Database

```bash
docker-compose up -d database
```

### 3. Setup & Run Server

```bash
cd server
npm install
npx prisma generate
npx prisma db push
npm run db:seed
npm run db:seed-historical
npm run dev
```

### 4. Setup & Run Client

```bash
cd client
npm install
npm run dev
```

---

## Available Services

| Service      | Command                         | URL                   |
| ------------ | ------------------------------- | --------------------- |
| Database     | `docker-compose up -d database` | localhost:5433        |
| API Server   | `cd server && npm run dev`      | http://localhost:4000 |
| Frontend     | `cd client && npm run dev`      | http://localhost:3000 |
| Adminer (DB) | `docker-compose up -d adminer`  | http://localhost:8080 |

---

## Performance Benchmark

Database optimization and A/B benchmark details are documented in [PERFORMANCE_BENCHMARK.md](PERFORMANCE_BENCHMARK.md).
Project-wide optimization notes are documented in [QUERY_OPTIMIZATION_SUMMARY.md](QUERY_OPTIMIZATION_SUMMARY.md).

Quick benchmark command:

```powershell
cd server
$env:BENCHMARK_ITERATIONS='100'
$env:BENCHMARK_WARMUP='3'
node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run db:benchmark:ab
```

Latest A/B result summary:

| Workload | Improvement |
| --- | ---: |
| My bookings page | 70.9% faster |
| Admin bookings page | 77.2% faster |
| Admin transactions page | 65.3% faster |
| Admin venue seats page | 84.9% faster |
| Showtime seat availability | 72.7% faster |
| Booking seat recheck | 90.9% faster |
| Reports KPI | 74.7% faster |
| Revenue by category report | 65.9% faster |

Recent admin UX improvements related to large datasets:

- Admin Events supports server-side sorting with cursor or offset fallback.
- Admin Bookings, Users, and Transactions support cursor pagination.
- Admin Reports tables now use paged table controls for easier browsing of long result sets.
- Admin Reports use materialized fact views for KPI and revenue-heavy analytics.

---

## Sample Login Credentials

| Role     | Email / Login     | Password    | URL                               |
| -------- | ----------------- | ----------- | --------------------------------- |
| Admin    | admin@example.com | password123 | http://localhost:3000/admin/login |
| Staff    | staff@example.com | password123 | http://localhost:3000/staff/login |
| Customer | john@example.com  | password123 | http://localhost:3000             |

---

## Project Structure

```
ticket-booking/
  client/                          # React frontend
    src/
      App.jsx                      # Router and route definitions
      components/                  # Shared UI components
      context/                     # Auth and booking contexts
      pages/
        user/                      # Customer browsing, booking, payment, tickets
        admin/                     # Admin login, layout, events, master data, users, bookings, transactions, reports
        staff/                     # Staff login, layout, event management
  server/                          # Express.js backend
    index.js                       # Server entry point
    prisma/
      schema.prisma                # Database schema and relations
      seed.js                      # Sample data seeder
      migrations/                  # Prisma and raw SQL migrations
    src/
      config/prisma.js             # Prisma client instance
      middleware/                  # Customer, Admin, Staff JWT auth
      routes/index.js              # API route definitions
      controllers/                 # HTTP controllers
      services/                    # Business logic and aggregate queries
      repositories/                # Database access helpers
      seed-historical.js           # Historical data generator for reports
      seed-big-data.js             # Synthetic benchmark data generator
  docker-compose.yml               # PostgreSQL and Adminer services
  .env                             # Local environment variables
```

---
## API Routes

### Public

| Method | Route                             | Description               |
| ------ | --------------------------------- | ------------------------- |
| POST   | `/api/auth/register`              | Register new user         |
| POST   | `/api/auth/login`                 | User login                |
| GET    | `/api/payment-methods`            | Available payment methods |
| GET    | `/api/tickets/verify/:ticketNo`   | Verify ticket by QR code  |

### Authenticated Browsing

| Method | Route                             | Description               |
| ------ | --------------------------------- | ------------------------- |
| GET    | `/api/events`                     | List all events           |
| GET    | `/api/events/:id`                 | Event detail              |
| GET    | `/api/venues`                     | List venues               |
| GET    | `/api/seat-types`                 | List seat types           |
| GET    | `/api/showtimes/event/:eventId`   | Showtimes for an event    |
| GET    | `/api/showtimes/:id/booked-seats` | Booked seats for showtime |

### Customer (requires auth)

| Method | Route                             | Description           |
| ------ | --------------------------------- | --------------------- |
| POST   | `/api/bookings`                   | Create booking        |
| GET    | `/api/bookings/my`                | My bookings           |
| GET    | `/api/bookings/:id`               | Booking detail        |
| POST   | `/api/bookings/:id/cancel`        | Cancel booking        |
| POST   | `/api/payments`                   | Process payment       |
| GET    | `/api/tickets/booking/:bookingId` | Tickets for a booking |

### Admin (requires admin auth)

| Method | Route                                   | Description             |
| ------ | --------------------------------------- | ----------------------- |
| POST   | `/api/admin/auth/login`                 | Admin login             |
| GET    | `/api/admin/events`                     | List all events         |
| GET    | `/api/admin/events/:id`                 | Event detail with stats |
| POST   | `/api/admin/events`                     | Create event            |
| PUT    | `/api/admin/events/:id`                 | Update event            |
| DELETE | `/api/admin/events/:id`                 | Delete event (RESTRICT) |
| GET    | `/api/admin/users`                      | List all users          |
| PATCH  | `/api/admin/users/:id/role`             | Change user role        |
| DELETE | `/api/admin/users/:id`                  | Delete user (RESTRICT)  |
| GET    | `/api/admin/transactions`               | List all transactions   |
| GET    | `/api/admin/categories`                 | Event categories        |
| GET    | `/api/admin/venues`                     | Venues with capacity    |
| POST   | `/api/admin/venues`                     | Create venue            |
| PUT    | `/api/admin/venues/:id`                 | Update venue            |
| DELETE | `/api/admin/venues/:id`                 | Delete venue            |
| GET    | `/api/admin/venues/:venueId/seats`      | List venue seats        |
| POST   | `/api/admin/seats`                      | Create seat             |
| PUT    | `/api/admin/seats/:id`                  | Update seat             |
| DELETE | `/api/admin/seats/:id`                  | Delete seat             |
| GET    | `/api/admin/settings`                   | System settings         |
| PATCH  | `/api/admin/settings/payment-methods/:id` | Toggle payment method |
| POST   | `/api/admin/staff/add`                  | Add staff user          |
| GET    | `/api/admin/staff`                      | List staff              |
| GET    | `/api/admin/reports/*`                  | Analytics report endpoints |

### Staff (requires staff auth)

| Method | Route                     | Description                 |
| ------ | ------------------------- | --------------------------- |
| POST   | `/api/staff/auth/login`   | Staff login                 |
| GET    | `/api/staff/categories`   | Event categories            |
| GET    | `/api/staff/venues`       | Venues for showtime setup   |
| GET    | `/api/staff/events`       | List all events             |
| GET    | `/api/staff/events/:id`   | Event detail                |
| POST   | `/api/staff/events`       | Create event                |
| PUT    | `/api/staff/events/:id`   | Update event                |
| DELETE | `/api/staff/events/:id`   | Delete event (RESTRICT)     |

---

## Database Schema

### Tables & Relationships

| Table           | Description                                  |
| --------------- | -------------------------------------------- |
| Roles           | Admin, Staff, Customer                       |
| Users           | User accounts with role-based access         |
| EventCategories | Movie, Concert, Seminar                      |
| Events          | Events with category                         |
| Venues          | Venue information                            |
| SeatTypes       | VIP (2x), Standard (1x), Sofa Bed (1.5x)     |
| Seats           | Individual seats linked to venue and type    |
| Showtimes       | Event schedules with base pricing per venue  |
| BookingStatuses | Pending, Completed, Cancelled                |
| Bookings        | User bookings with 15-minute expiration      |
| BookingDetails  | Individual seat reservations per booking     |
| PaymentMethods  | Credit Card, PromptPay, TrueMoney, ShopeePay |
| PaymentStatuses | Pending, Success, Failed                     |
| Payments        | Payment records linked to bookings           |
| Tickets         | Generated after payment with unique TicketNo |

### ON DELETE Behaviors

| Relationship              | ON DELETE   | Behavior                                 |
| ------------------------- | ----------- | ---------------------------------------- |
| Role -> User              | SET DEFAULT | Deleted role -> user becomes Customer    |
| User -> Booking           | RESTRICT    | Cannot delete user with bookings         |
| Event -> Showtime         | CASCADE     | Delete event removes its showtimes       |
| Showtime -> BookingDetail | RESTRICT    | Cannot delete showtime with bookings     |
| Booking -> Payment        | RESTRICT    | Cannot delete booking with payment       |
| Booking -> BookingDetail  | RESTRICT    | Cannot delete booking with seat reservations |
| BookingDetail -> Ticket   | RESTRICT    | Cannot delete detail with generated ticket |

---

## Business Rules

- **Booking Expiry**: Pending bookings expire after 15 minutes
- **Seat Availability**: A seat is unavailable if it has a Completed booking OR a Pending booking that hasn't expired
- **Ticket Generation**: Tickets are generated automatically when payment is completed (one per seat)
- **Password**: Minimum 6 characters
- **Ticket Price**: `BasePrice x SeatType.PriceModifier`
- **RESTRICT Deletion**: Users with bookings and events with bookings cannot be deleted
- **Role Management**: Admin can change user roles between Staff and Customer
- **Event List Performance**: Admin/Staff event lists use one aggregate query with server-side sorting and pagination support

---

## Available Scripts

### Server (`cd server`)

| Command                      | Description                      |
| ---------------------------- | -------------------------------- |
| `npm run dev`                | Start dev server (nodemon)       |
| `npm start`                  | Start production server          |
| `npm run db:migrate`         | Run database migrations          |
| `npm run db:generate`        | Generate Prisma client           |
| `npm run db:push`            | Push schema to database          |
| `npm run db:seed`            | Seed sample data                 |
| `npm run db:seed-historical` | Seed historical data for reports |
| `npm run db:seed-big`        | Seed deterministic benchmark data |
| `npm run db:optimize-indexes` | Apply performance indexes       |
| `npm run db:drop-indexes`    | Drop performance indexes for A/B testing |
| `npm run db:optimize-reports` | Apply report materialized views |
| `npm run db:refresh-report-views` | Refresh report materialized views |
| `npm run db:drop-report-views` | Drop report materialized views for A/B testing |
| `npm run db:benchmark`       | Run current benchmark            |
| `npm run db:benchmark:ab`    | Run no-index vs indexed A/B benchmark |

### Client (`cd client`)

| Command           | Description              |
| ----------------- | ------------------------ |
| `npm run dev`     | Start development server |
| `npm run build`   | Build for production     |
| `npm run preview` | Preview production build |

---

## Troubleshooting

### Port Already in Use

```bash
netstat -ano | findstr ":4000"
taskkill /F /T /PID <PID>
```

### Database Connection Error

```bash
docker-compose down -v
docker-compose up -d database
# Wait 15 seconds
cd server
npx prisma db push
npm run db:seed
npm run db:seed-historical
```

### Adminer Connection (localhost:8080)

- System: **PostgreSQL**
- Server: **database**
- Username / Password / Database: from `.env`

---

## License

ISC
