# 🚀 Setup Guide - Ticket Booking System

Follow these steps to get the project running on your machine.

---

## ⚡ Quick Setup (5 Minutes)

### Prerequisites Check

Make sure you have these installed:

```bash
node --version    # Should be v20+
docker --version  # Should be installed
git --version     # Should be installed
```

---

### Step 1: Start Database

```bash
docker-compose up -d database
```

⏳ **Wait 15 seconds** for database to initialize.

---

### Step 2: Setup Server

```bash
cd server
npm install
npx prisma generate
npx prisma db push
npm run db:seed
```

You should see:
```
✅ Database seeded successfully!

📋 Sample Credentials:
   Admin: admin@example.com / password123
   Customer: john@example.com / password123
```

---

### Step 3: Start Server

```bash
npm run dev
```

You should see:
```
🚀 Server running on http://localhost:4000
📊 API available at http://localhost:4000/api
```

---

### Step 4: Test API

Open a **new terminal** and run:

```bash
cd server
node test-api.js
```

All tests should pass ✅

---

### Step 5: (Optional) Start Frontend

Open another terminal:

```bash
cd client
npm install
npm run dev
```

---

## ✅ Verify Everything Works

1. **API**: Open http://localhost:4000/api/events in browser
2. **Database UI**: Open http://localhost:8080 (Adminer)
3. **Frontend**: Open http://localhost:3000

---

## 🆘 Common Issues

### Issue: "Port 5433 already in use"

**Solution:**
```bash
# Find the process
netstat -ano | findstr ":5433"

# Kill it
taskkill /F /T /PID <PID>
```

---

### Issue: "Cannot connect to database"

**Solution:**
```bash
# Check if database is running
docker ps

# If not, restart it
docker-compose down -v
docker-compose up -d database

# Wait 15 seconds
timeout /t 15

# Try again
npx prisma db push
```

---

### Issue: "nodemon is not recognized"

**Solution:**
```bash
cd server
npm install -D nodemon
```

Or use:
```bash
npm start
```

---

### Issue: "Module not found" or "Prisma client error"

**Solution:**
```bash
cd server
npm install
npx prisma generate
```

---

## 📚 What's Next?

After setup is complete:

1. Read the [API Documentation](server/API.md)
2. Explore the database with Adminer
3. Start building the React frontend
4. Test the booking flow

---

## 🔐 Default Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@example.com | password123 |
| Customer | john@example.com | password123 |

---

## 📞 Need Help?

Check these files:
- [README.md](README.md) - Main documentation
- [server/API.md](server/API.md) - API reference
- [QUICKSTART.md](QUICKSTART.md) - Detailed guide

---

**Happy coding! 🎉**
