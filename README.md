# 🎫 Ticket Booking System

A full-stack web application for booking event tickets with seat selection, payment processing, and ticket generation.

## 🛠️ Tech Stack

### Backend
- **Node.js** + **Express.js** - REST API server
- **Prisma ORM** - Database client
- **PostgreSQL 17** - Relational database
- **JWT** + **bcrypt** - Authentication

### Frontend
- **React 19** - UI framework
- **Vite** - Build tool

### Infrastructure
- **Docker Compose** - Database containerization

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- [Node.js](https://nodejs.org/) (v20 or higher)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) - For database
- [Git](https://git-scm.com/) - Version control

---

## 🚀 Quick Start

### Step 1: Clone the Repository

```bash
git clone <your-repo-url>
cd ticket-booking
```

### Step 2: Create Environment Files

You need to create two `.env` files locally (they are not included in the repository for security):

#### Root `.env` file

Create a file named `.env` in the project root:

```env
# Database Settings
POSTGRES_USER=admin
POSTGRES_PASSWORD=password123
POSTGRES_DB=ticket_booking_db
PORT_DB=5433

# Server Settings
PORT_SERVER=4000
HOST_SERVER=0.0.0.0

# Client Settings
PORT_CLIENT=3000
VITE_API_BASE=http://localhost:4000
```

#### Server `.env` file

Create a file named `.env` inside the `server` folder:

```env
DATABASE_URL="postgresql://admin:password123@localhost:5433/ticket_booking_db"
```

> ⚠️ **Note:** These credentials are for local development. Change them for production!

### Step 3: Start the Database

```bash
docker-compose up -d database
```

> ⏳ Wait ~15 seconds for the database to initialize.

### Step 4: Setup the Server

```bash
cd server

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# Seed sample data
npm run db:seed
```

### Step 5: Start the API Server

```bash
# From server directory
npm run dev
```

✅ **Server running at:** http://localhost:4000

### Step 6: (Optional) Start the Frontend

Open a new terminal:

```bash
cd client
npm install
npm run dev
```

✅ **Frontend running at:** http://localhost:3000

---

## 📊 Available Services

| Service | Command | URL | Status |
|---------|---------|-----|--------|
| **Database** | `docker-compose up -d database` | localhost:5433 | ✅ Required |
| **API Server** | `cd server && npm run dev` | http://localhost:4000 | ✅ Required |
| **Frontend** | `cd client && npm run dev` | http://localhost:3000 | 🔲 Optional |
| **Adminer** | `docker-compose up -d adminer` | http://localhost:8080 | 🔲 Optional |

---

## 🔐 Sample Login Credentials

After running `npm run db:seed`:

| Role | Email | Password |
|------|-------|----------|
| **Admin** | admin@example.com | password123 |
| **Customer** | john@example.com | password123 |

---

## 📚 API Documentation

Complete API documentation is available at: [server/API.md](server/API.md)

### Quick Examples

**Get all events:**
```bash
curl http://localhost:4000/api/events
```

**Login:**
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"password123"}'
```

**Create booking (requires auth token):**
```bash
curl -X POST http://localhost:4000/api/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"showtimeId":1,"seatIds":[1,2,3]}'
```

---

## 🧪 Test the API

```bash
cd server
node test-api.js
```

Expected output:
```
✅ GET /api/events          - 3 events found
✅ GET /api/venues          - 1 venue found
✅ GET /api/seat-types      - 3 seat types found
✅ POST /api/auth/login     - Login successful
✅ GET /api/bookings/my     - Authenticated!
✅ GET /api/payment-methods - 4 payment methods found
```

---

## 🗂️ Project Structure

```
ticket-booking/
├── server/
│   ├── prisma/
│   │   ├── schema.prisma    # Database schema
│   │   └── seed.js          # Sample data seeder
│   ├── index.js             # Express server + all API routes
│   ├── API.md               # API documentation
│   ├── test-api.js          # API test script
│   └── package.json
├── client/
│   └── src/
│       └── App.jsx          # React frontend (default template)
├── database/
│   └── init/
│       └── schema.sql.bak   # Original SQL schema (backup)
├── docker-compose.yml       # Docker configuration
├── setup.bat               # Windows quick setup script
└── QUICKSTART.md           # Detailed setup guide
```

---

## 🗄️ Database Schema

The system includes these main tables:

- **Users** - Role-based access (Admin, Staff, Customer)
- **Events & Categories** - Movies, Concerts, Seminars
- **Venues & Seats** - VIP, Standard, Sofa Bed types
- **Showtimes** - Event schedules with base pricing
- **Bookings** - Cart with 15-minute expiration
- **Payments** - PromptPay, Credit Card, TrueMoney, ShopeePay
- **Tickets** - Generated after successful payment

---

## 🔧 Available Scripts

### Server Scripts (`cd server`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (requires nodemon) |
| `npm start` | Start production server |
| `npm run db:migrate` | Run database migrations |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema to database |
| `npm run db:seed` | Seed database with sample data |

### Client Scripts (`cd client`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |

---

## ⚙️ Environment Variables

### Server (`server/.env`)

```env
DATABASE_URL="postgresql://admin:password123@localhost:5433/ticket_booking_db"
```

### Root (`.env`)

```env
POSTGRES_USER=admin
POSTGRES_PASSWORD=password123
POSTGRES_DB=ticket_booking_db
PORT_DB=5433
PORT_SERVER=4000
PORT_CLIENT=3000
```

> ⚠️ **Important:** Never commit `.env` files to GitHub! They are already in `.gitignore`.

---

## 🐳 Docker Setup

### Start Database Only (Recommended)
```bash
docker-compose up -d database
```

### Start All Services
```bash
docker-compose up -d
```

### Stop All Services
```bash
docker-compose down
```

### Reset Database
```bash
docker-compose down -v
docker-compose up -d database
```

---

## 🎯 Next Steps

1. ✅ Backend API is complete and tested
2. 🔲 Build the React frontend with:
   - Event listing page
   - Seat selection UI
   - Booking cart & checkout
   - Payment page
   - User dashboard (My Tickets)
3. 🔲 Integrate frontend with API
4. 🔲 Add real payment gateway integration
5. 🔲 Deploy to production

---

## 📖 Documentation

- [API Documentation](server/API.md) - Complete REST API reference
- [Server README](server/README.md) - Backend setup details
- [Quick Start Guide](QUICKSTART.md) - Detailed setup instructions

---

## 🐛 Troubleshooting

### Port Already in Use

If you get "port already in use" error:

```bash
# Windows - Find and kill process
netstat -ano | findstr ":4000"
taskkill /F /T /PID <PID>
```

### Database Connection Error

```bash
# Restart database
docker-compose down -v
docker-compose up -d database

# Wait 15 seconds, then
cd server
npx prisma db push
npm run db:seed
```

### Prisma Not Found

```bash
cd server
npx prisma generate
```

---

## 📝 License

ISC

---

## 👥 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request
