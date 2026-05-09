# Plan: Fix Seed + Add Bookings Page

## 1. Fix seed-historical.js - ลบ Pending bookings
- ลบ section "(c) Add ghost Pending bookings" (lines 743-768)
- ลบ console.log ที่แสดง pendingCount (line 773)
- ลบตัวแปร `pendingCount` ที่ไม่ใช้แล้ว

## 2. Backend - เพิ่ม getAllBookings endpoints

### Admin (`admin.controller.js`)
- เพิ่ม `getAllBookings` query Bookings table ทั้งหมด
- Include: User (FullName, Email, Role), BookingStatus, BookingDetails (count), Payment (status)
- Support filters: status (Pending/Completed/Cancelled), search (user name, booking ID)
- Return: bookingId, user, userRole, status, totalAmount, bookingTimestamp, expiresAt, seatCount, hasPayment

### Staff (`staff.controller.js`)
- เพิ่ม `getAllBookings` เหมือน admin แต่ filter เฉพาะ events ที่ staff คนนั้นสร้าง
- JOIN ผ่าน BookingDetails → Showtime → Event → CreatedByUserID = req.user.userId

### Routes (`routes/index.js`)
- `GET /admin/bookings` → authenticateAdmin → adminController.getAllBookings
- `GET /staff/bookings` → authenticateStaff → staffController.getAllBookings

## 3. Frontend - Admin Bookings Page

### Files ใหม่:
- `client/src/pages/admin/bookings/AdminBookings.jsx`
- `client/src/pages/admin/bookings/AdminBookings.css`

### UI:
- Table: Booking ID, User (+ role badge), Status (badge), Seats, Amount, Date, Expires At
- Filters: Status dropdown (All/Pending/Completed/Cancelled), Search (user name / booking ID)
- Pending rows แสดง countdown (เวลาที่เหลือก่อน expire)
- ใช้ dark theme เดียวกับ Transactions page

### Sidebar + Routes:
- เพิ่ม nav item ใน `AdminLayout.jsx` NAV_ITEMS (ระหว่าง Transactions กับ Reports)
- เพิ่ม `getPageTitle` entry: `/bookings` → 'Bookings'
- เพิ่ม Route ใน `App.jsx`: `<Route path="bookings" element={<AdminBookings />} />`

## 4. Frontend - Staff Bookings Page

### Files ใหม่:
- `client/src/pages/staff/bookings/StaffBookings.jsx`
- `client/src/pages/staff/bookings/StaffBookings.css`

### UI:
- เหมือน Admin แต่แสดงเฉพาะ bookings ของ events ที่ตนสร้าง
- เพิ่ม column "Event" เพื่อแสดงชื่อ event

### Sidebar + Routes:
- เพิ่ม nav item ใน `StaffLayout.jsx` NAV_ITEMS (ระหว่าง Events กับ Transactions)
- เพิ่ม `getPageTitle` entry
- เพิ่ม Route ใน `App.jsx`
