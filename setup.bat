@echo off
echo ========================================
echo   Ticket Booking System - Setup
echo ========================================
echo.

cd server

echo [1/4] Installing dependencies...
call npm install
if errorlevel 1 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)
echo ✅ Dependencies installed
echo.

echo [2/4] Generating Prisma client...
call npx prisma generate
if errorlevel 1 (
    echo ❌ Failed to generate Prisma client
    pause
    exit /b 1
)
echo ✅ Prisma client generated
echo.

echo [3/4] Pushing schema to database...
call npx prisma db push
if errorlevel 1 (
    echo ❌ Failed to push schema
    echo 💡 Make sure database is running: docker-compose up -d database
    pause
    exit /b 1
)
echo ✅ Database schema pushed
echo.

echo [4/4] Seeding database...
call npm run db:seed
if errorlevel 1 (
    echo ❌ Failed to seed database
    pause
    exit /b 1
)
echo ✅ Database seeded
echo.

echo ========================================
echo   ✅ Setup Complete!
echo ========================================
echo.
echo Sample Credentials:
echo   Admin: admin@example.com / password123
echo   Customer: john@example.com / password123
echo.
echo To start the server:
echo   cd server
echo   npm run dev
echo.
pause
