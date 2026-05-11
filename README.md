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

Quick benchmark command:

```powershell
cd server
$env:BENCHMARK_ITERATIONS='100'
node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run db:benchmark:ab
```

Latest A/B result summary:

| Workload | Improvement |
| --- | ---: |
| My bookings | 44.5% faster |
| Admin bookings page | 41.2% faster |
| Admin transactions page | 44.7% faster |
| Showtime seat availability | 20.7% faster |
| Booking seat recheck | 46.0% faster |
| Event list code refactor | 26.3% faster |

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
db_proj4/
├── client/                          # React Frontend
│   └── src/
│       ├── App.jsx                  # Router & route definitions
│       ├── App.css
│       ├── components/
│       │   ├── Navbar.jsx           # User navigation bar
│       │   └── Navbar.css
│       ├── context/
│       │   ├── AuthContext.jsx       # Customer authentication context
│       │   ├── AdminAuthContext.jsx  # Admin authentication context
│       │   └── BookingContext.jsx    # Booking/cart state management
│       └── pages/
│           ├── user/                # Customer-facing pages
│           │   ├── login/           # Login page
│           │   ├── register/        # Registration page
│           │   ├── event/           # Event listing
│           │   ├── eventdetail/     # Event detail & showtime selection
│           │   ├── seatSelection/   # Interactive seat map
│           │   ├── BookingCart/      # Booking cart
│           │   ├── payment/         # Payment processing
│           │   └── tickets/         # My Tickets (QR codes, expiry timer)
│           ├── admin/               # Admin panel pages
│           │   ├── login/           # Admin login
│           │   ├── layout/          # Admin sidebar layout
│           │   ├── events/          # Event CRUD (list, add, edit)
│           │   ├── users/           # User management (role change, delete)
│           │   ├── transactions/    # Transaction management (mark paid, refund)
│           │   └── reports/         # Analytics & reports (12 chart types)
│           └── staff/               # Staff panel pages
│               ├── login/           # Staff login
│               ├── layout/          # Staff sidebar layout
│               ├── dashboard/       # Staff dashboard (stats overview)
│               ├── events/          # Staff event management (own events)
│               └── transactions/    # Staff transaction view
│
├── server/                          # Express.js Backend
│   ├── index.js                     # Server entry point
│   ├── prisma/
│   │   ├── schema.prisma            # Database schema & relations
│   │   ├── seed.js                  # Sample data seeder
│   │   └── migrations/              # Prisma migrations
│   └── src/
│       ├── config/
│       │   └── prisma.js            # Prisma client instance
│       ├── middleware/
│       │   ├── auth.middleware.js        # Customer JWT auth
│       │   ├── adminAuth.middleware.js   # Admin JWT auth
│       │   └── staffAuth.middleware.js   # Staff JWT auth
│       ├── routes/
│       │   └── index.js             # All API route definitions
│       ├── controllers/
│       │   ├── auth.controller.js       # Register, login
│       │   ├── event.controller.js      # Public event queries
│       │   ├── venue.controller.js      # Venue & seat type queries
│       │   ├── showtime.controller.js   # Showtime & booked seats
│       │   ├── booking.controller.js    # Create/cancel bookings
│       │   ├── payment.controller.js    # Payment processing & ticket generation
│       │   ├── ticket.controller.js     # Ticket retrieval & QR verification
│       │   ├── admin.controller.js      # Admin: events, users, transactions, reports
│       │   └── staff.controller.js      # Staff: own events, transactions, dashboard
│       └── seed-historical.js       # Historical data generator for reports
│
├── docker-compose.yml               # Docker services (PostgreSQL, Adminer)
└── .env                             # Environment variables (not committed)
```

---

## API Routes

### Public

| Method | Route                             | Description               |
| ------ | --------------------------------- | ------------------------- |
| POST   | `/api/auth/register`              | Register new user         |
| POST   | `/api/auth/login`                 | User login                |
| GET    | `/api/events`                     | List all events           |
| GET    | `/api/events/:id`                 | Event detail              |
| GET    | `/api/venues`                     | List venues               |
| GET    | `/api/seat-types`                 | List seat types           |
| GET    | `/api/showtimes/event/:eventId`   | Showtimes for an event    |
| GET    | `/api/showtimes/:id/booked-seats` | Booked seats for showtime |
| GET    | `/api/payment-methods`            | Available payment methods |
| GET    | `/api/tickets/verify/:ticketNo`   | Verify ticket by QR code  |

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
| PATCH  | `/api/admin/transactions/:id/mark-paid` | Mark failed as paid     |
| PATCH  | `/api/admin/transactions/:id/refund`    | Refund transaction      |
| GET    | `/api/admin/categories`                 | Event categories        |
| GET    | `/api/admin/venues`                     | Venues with capacity    |
| POST   | `/api/admin/staff/add`                  | Add staff user          |
| GET    | `/api/admin/staff`                      | List staff              |
| GET    | `/api/admin/reports/*`                  | 13 report endpoints     |

### Staff (requires staff auth)

| Method | Route                     | Description                 |
| ------ | ------------------------- | --------------------------- |
| POST   | `/api/staff/auth/login`   | Staff login                 |
| GET    | `/api/staff/events`       | List own events             |
| GET    | `/api/staff/events/:id`   | Own event detail            |
| POST   | `/api/staff/events`       | Create event                |
| PUT    | `/api/staff/events/:id`   | Update own event            |
| DELETE | `/api/staff/events/:id`   | Delete own event (RESTRICT) |
| GET    | `/api/staff/transactions` | Own event transactions      |
| GET    | `/api/staff/dashboard`    | Dashboard stats             |

---

## Database Schema

### Tables & Relationships

| Table           | Description                                  |
| --------------- | -------------------------------------------- |
| Roles           | Admin, Staff, Customer                       |
| Users           | User accounts with role-based access         |
| EventCategories | Movie, Concert, Seminar                      |
| Events          | Events with category and creator tracking    |
| Venues          | Venue information                            |
| SeatTypes       | VIP (2x), Standard (1x), Sofa Bed (1.5x)     |
| Seats           | Individual seats linked to venue and type    |
| Showtimes       | Event schedules with base pricing per venue  |
| BookingStatuses | Pending, Completed, Cancelled                |
| Bookings        | User bookings with 15-minute expiration      |
| BookingDetails  | Individual seat reservations per booking     |
| PaymentMethods  | Credit Card, PromptPay, TrueMoney, ShopeePay |
| PaymentStatuses | Pending, Success, Failed, Refunded           |
| Payments        | Payment records linked to bookings           |
| Tickets         | Generated after payment with unique TicketNo |

### ON DELETE Behaviors

| Relationship              | ON DELETE   | Behavior                                 |
| ------------------------- | ----------- | ---------------------------------------- |
| Role -> User              | SET DEFAULT | Deleted role -> user becomes Customer    |
| User -> Booking           | RESTRICT    | Cannot delete user with bookings         |
| Event -> Showtime         | CASCADE     | Delete event removes its showtimes       |
| Showtime -> BookingDetail | RESTRICT    | Cannot delete showtime with bookings     |
| Booking -> Payment        | CASCADE     | Delete booking removes payment           |
| Booking -> BookingDetail  | CASCADE     | Delete booking removes seat reservations |
| BookingDetail -> Ticket   | CASCADE     | Delete detail removes ticket             |

---

## Business Rules

- **Booking Expiry**: Pending bookings expire after 15 minutes
- **Seat Availability**: A seat is unavailable if it has a Completed booking OR a Pending booking that hasn't expired
- **Ticket Generation**: Tickets are generated automatically when payment is completed (one per seat)
- **Password**: Minimum 6 characters
- **Ticket Price**: `BasePrice x SeatType.PriceModifier`
- **RESTRICT Deletion**: Users with bookings and events with bookings cannot be deleted
- **Role Management**: Admin can change user roles between Staff and Customer

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
