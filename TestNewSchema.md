# Test New Schema

คู่มือนี้ใช้สำหรับอัปเดต database schema ให้ตรงกับ report ล่าสุด แล้วทดสอบ server/client หลังเปลี่ยน schema

## 1. Start Database

รันจาก root โปรเจกต์:

```powershell
cd "C:\Users\win25\Desktop\Desktop\work\CPE241 DB\Proj\ticket-booking"
docker compose up -d database
```

ตรวจว่า database พร้อมหรือยัง:

```powershell
psql "postgresql://admin:password123@localhost:5433/ticket_booking_db" -c "SELECT 1;"
```

## 2. Update Prisma Schema

รันจากโฟลเดอร์ `server`:

```powershell
cd server
npx prisma validate
npx prisma db push
```

คำสั่งนี้จะ sync table/column/relation/unique constraints จาก `server/prisma/schema.prisma` ลง PostgreSQL

## 3. Apply Raw SQL Constraints and View

Prisma ยังไม่รองรับ `CHECK constraints` และ database view โดยตรง จึงต้อง apply SQL เพิ่ม:

```powershell
psql "postgresql://admin:password123@localhost:5433/ticket_booking_db" -f prisma\migrations\check_constraints.sql
```

ถ้า `psql` ใช้ไม่ได้ ให้ใช้ path เต็ม:

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" "postgresql://admin:password123@localhost:5433/ticket_booking_db" -f prisma\migrations\check_constraints.sql
```

สิ่งที่ script นี้เพิ่ม/แก้:

- `NOT NULL` columns ตาม report
- default values เช่น `Users.RoleID = 3`, `Bookings.StatusID = 1`, `Payments.StatusID = 1`
- FK `ON DELETE` rules ตาม report
- `CHECK` constraints สำหรับราคา/ยอดเงิน/วันหมดอายุ booking
- unique seat position: `(VenueID, RowLabel, SeatNumber)`
- drop unique เดิมของ `(ShowtimeID, SeatID)` เพื่อให้ cancelled/expired pending booking คืนที่นั่งได้
- view `ShowtimeAvailableSeats`

## 4. Generate Prisma Client

```powershell
npm run db:generate
```

## 5. Seed Data

```powershell
npm run db:seed
```

Seed จะสร้าง lookup หลักให้ตรงกับ default:

- `Roles`: Admin = 1, Staff = 2, Customer = 3
- `BookingStatuses`: Pending = 1, Completed = 2, Cancelled = 3
- `PaymentStatuses`: Pending = 1, Success = 2, Failed = 3, Refunded = 4

## 6. Verify Database Objects

ตรวจ constraints สำคัญ:

```powershell
psql "postgresql://admin:password123@localhost:5433/ticket_booking_db" -c "SELECT conname FROM pg_constraint WHERE conname IN ('booking_total_positive', 'booking_expires_after_created', 'payment_amount_positive', 'showtime_base_price_positive', 'seat_type_modifier_positive', 'ticket_price_positive', 'unique_seat_position');"
```

ตรวจ view:

```powershell
psql "postgresql://admin:password123@localhost:5433/ticket_booking_db" -c "SELECT * FROM \"ShowtimeAvailableSeats\" LIMIT 5;"
```

## 7. Test Server

เช็ก syntax ของไฟล์ที่แก้:

```powershell
node --check src\controllers\auth.controller.js
node --check src\controllers\booking.controller.js
node --check src\controllers\event.controller.js
node --check src\controllers\payment.controller.js
node --check src\controllers\showtime.controller.js
node --check prisma\seed.js
```

รัน server:

```powershell
npm run dev
```

ถ้าต้องการทดสอบ API ด้วย script เดิม:

```powershell
node test-api.js
```

## 8. Test Client

เปิด terminal ใหม่ แล้วรัน:

```powershell
cd "C:\Users\win25\Desktop\Desktop\work\CPE241 DB\Proj\ticket-booking\client"
npm install
npm run build
npm run dev
```

เปิด browser:

```text
http://localhost:3000
```

## 9. Expected Manual Test Flow

1. Register user ใหม่ด้วย password อย่างน้อย 6 ตัวอักษร
2. Login
3. Browse/filter/search events
4. เลือก showtime ที่ยังไม่ผ่านเวลา
5. เลือก seats ที่อยู่ venue เดียวกับ showtime
6. Create booking แล้วตรวจว่า `ExpiresAt` ถูกตั้งเป็นประมาณ 15 นาทีหลัง booking
7. ลองจอง seat เดิมซ้ำขณะ booking ยัง Pending และยังไม่หมดอายุ ควรถูกปฏิเสธ
8. Cancel booking แล้ว seat เดิมควรกลับมาว่าง
9. Create booking ใหม่และชำระเงินด้วย active payment method
10. ตรวจว่า booking เป็น Completed, มี payment 1 record, และมี ticket 1 ใบต่อ booking detail

## 10. Troubleshooting

ถ้าเจอ client error ว่า import `qrcode.react` ไม่ได้:

```powershell
cd client
npm install
npm run dev
```

ถ้า `npx prisma` download engine ไม่ได้ใน sandbox/permission จำกัด ให้รันคำสั่งเดิมใน terminal ปกติของเครื่อง

ถ้า database ที่ `localhost:5433` connection refused ให้เปิด database ก่อน:

```powershell
docker compose up -d database
```
