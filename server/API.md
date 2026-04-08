# Ticket Booking API Documentation

## Base URL
```
http://localhost:4000/api
```

## Authentication
Most endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <your-token>
```

---

## 🔐 Authentication Endpoints

### Register
**POST** `/api/auth/register`

**Request Body:**
```json
{
  "fullName": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

**Response:** `201 Created`
```json
{
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "fullName": "John Doe",
    "email": "john@example.com"
  }
}
```

### Login
**POST** `/api/auth/login`

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response:** `200 OK`
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "fullName": "John Doe",
    "email": "john@example.com",
    "roleId": 3
  }
}
```

---

## 🎬 Events Endpoints

### Get All Events
**GET** `/api/events`

**Response:** `200 OK`
```json
[
  {
    "EventID": 1,
    "Title": "Avengers: Secret Wars",
    "Description": "The epic conclusion...",
    "CategoryID": 1,
    "Category": {
      "CategoryID": 1,
      "CategoryName": "Movie"
    }
  }
]
```

### Get Event by ID
**GET** `/api/events/:id`

**Response:** `200 OK`
```json
{
  "EventID": 1,
  "Title": "Avengers: Secret Wars",
  "Description": "The epic conclusion...",
  "CategoryID": 1,
  "Category": { ... },
  "Showtimes": [
    {
      "ShowtimeID": 1,
      "StartDateTime": "2025-04-15T10:00:00.000Z",
      "BasePrice": 200,
      "Venue": { ... }
    }
  ]
}
```

---

## 🏟️ Venues Endpoints

### Get All Venues
**GET** `/api/venues`

**Response:** `200 OK`

### Get Venue with Seats
**GET** `/api/venues/:id`

**Response:** `200 OK`
```json
{
  "VenueID": 1,
  "VenueName": "Central World Cinema",
  "Location": "Bangkok, Thailand",
  "Seats": [
    {
      "SeatID": 1,
      "RowLabel": "A",
      "SeatNumber": "1",
      "SeatType": {
        "SeatTypeID": 1,
        "TypeName": "VIP",
        "PriceModifier": 2.0
      }
    }
  ]
}
```

---

## 💺 Seats Endpoints

### Get All Seat Types
**GET** `/api/seat-types`

**Response:** `200 OK`
```json
[
  {
    "SeatTypeID": 1,
    "TypeName": "VIP",
    "PriceModifier": 2.0
  },
  {
    "SeatTypeID": 2,
    "TypeName": "Standard",
    "PriceModifier": 1.0
  }
]
```

---

## 🕐 Showtimes Endpoints

### Get All Showtimes
**GET** `/api/showtimes`

**Response:** `200 OK`

### Get Showtimes by Event
**GET** `/api/showtimes/event/:eventId`

**Response:** `200 OK`

### Get Showtime by ID
**GET** `/api/showtimes/:id`

**Response:** `200 OK`

---

## 🎫 Bookings Endpoints

### Create Booking
**POST** `/api/bookings` *(Requires Auth)*

**Request Body:**
```json
{
  "showtimeId": 1,
  "seatIds": [1, 2, 3]
}
```

**Response:** `201 Created`
```json
{
  "message": "Booking created successfully",
  "booking": {
    "BookingID": 1,
    "UserID": 1,
    "StatusID": 1,
    "ExpiresAt": "2025-04-08T10:15:00.000Z",
    "TotalAmount": 1200,
    "BookingDetails": [ ... ]
  }
}
```

### Get My Bookings
**GET** `/api/bookings/my` *(Requires Auth)*

**Response:** `200 OK`

### Get Booking by ID
**GET** `/api/bookings/:id` *(Requires Auth)*

**Response:** `200 OK`

### Cancel Booking
**POST** `/api/bookings/:id/cancel` *(Requires Auth)*

**Response:** `200 OK`
```json
{
  "message": "Booking cancelled successfully"
}
```

---

## 💳 Payments Endpoints

### Get Payment Methods
**GET** `/api/payment-methods`

**Response:** `200 OK`
```json
[
  {
    "MethodID": 1,
    "MethodName": "PromptPay",
    "IsActive": true
  }
]
```

### Process Payment
**POST** `/api/payments` *(Requires Auth)*

**Request Body:**
```json
{
  "bookingId": 1,
  "methodId": 1
}
```

**Response:** `201 Created`
```json
{
  "message": "Payment successful",
  "payment": {
    "PaymentID": 1,
    "TransactionID": "TXN1234567890abc...",
    "Amount": 1200,
    "PaidAt": "2025-04-08T10:00:00.000Z"
  }
}
```

---

## 🎟️ Tickets Endpoints

### Get Tickets by Booking
**GET** `/api/tickets/booking/:bookingId` *(Requires Auth)*

**Response:** `200 OK`
```json
[
  {
    "TicketID": 1,
    "TicketNo": "TKT1234567890abc",
    "FinalPrice": 400,
    "Detail": {
      "Showtime": {
        "Event": { "Title": "Avengers: Secret Wars" },
        "Venue": { "VenueName": "Central World Cinema" }
      },
      "Seat": {
        "RowLabel": "A",
        "SeatNumber": "1",
        "SeatType": { "TypeName": "VIP" }
      }
    }
  }
]
```

### Verify Ticket
**GET** `/api/tickets/verify/:ticketNo`

**Response:** `200 OK`
```json
{
  "valid": true,
  "ticket": { ... }
}
```

---

## 🚀 Quick Start

### 1. Start Database
```bash
docker-compose up -d database
```

### 2. Install Dependencies
```bash
cd server
npm install
```

### 3. Setup Database
```bash
npx prisma generate
npx prisma db push
npm run db:seed
```

### 4. Start Server
```bash
npm run dev
```

---

## 📝 Sample Credentials

After seeding:
- **Admin**: `admin@example.com` / `password123`
- **Customer**: `john@example.com` / `password123`

---

## ⚠️ Error Responses

All endpoints return errors in this format:
```json
{
  "error": "Error message here"
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error
