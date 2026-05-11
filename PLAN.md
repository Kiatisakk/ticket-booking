# SQL Optimization + Pagination Coverage Plan

## Summary
จากการตรวจ runtime query พบว่า pagination มีแล้วเฉพาะ Admin `Users`, `Bookings`, `Transactions` ส่วนที่ยังดึง list ทั้งก้อนคือ Customer Events, My Tickets, Admin/Staff Event Management, Master Data venues/seats, Staff list, และ `/showtimes` บาง endpoint. แผนนี้จะเพิ่ม pagination แบบ backward-compatible และ optimize query ที่หนักโดยไม่เปลี่ยน table/column schema หลัก

## Query Inventory ที่พบ
- **Already paginated:** `/api/admin/users`, `/api/admin/bookings`, `/api/admin/transactions` ใช้ `findManyHybrid`
- **No pagination yet:** `/api/events`, `/api/admin/events`, `/api/staff/events`, `/api/bookings/my`, `/api/admin/venues`, `/api/admin/venues/:venueId/seats`, `/api/admin/staff`, `/api/showtimes`
- **Heavy query hotspots:** event list raw SQL aggregate, event detail showtime availability N+1 count, My Tickets deep include, Master Data seat booking count, Reports raw SQL aggregate
- **ไม่ต้อง paginate:** lookup/reference calls เช่น categories, seat types, payment methods, event detail by id, ticket by booking, report chart endpoints

## Key Changes
- เพิ่ม optional pagination API โดยถ้าไม่ส่ง `pagination/page/pageSize/cursor` จะคง response เดิมเป็น array เพื่อไม่พังหน้า dropdown/reference เดิม
- เพิ่ม cursor/offset pagination ให้:
  - `/api/events`
  - `/api/admin/events`
  - `/api/staff/events`
  - `/api/bookings/my`
  - `/api/admin/staff`
  - `/api/showtimes`
- เพิ่ม offset pagination แบบ natural sort ให้:
  - `/api/admin/venues`
  - `/api/admin/venues/:venueId/seats`
- แก้ frontend ให้ใช้ pagination:
  - Customer `/events`: card pagination + server search/category/status
  - `/my-tickets`: server pagination + status tab filter
  - Admin/Staff Event Management: server pagination + sort/filter/tab
  - Admin Master Data: paginate venues grid และ seats table
- Event list SQL optimization:
  - filter/page event IDs ก่อน แล้วค่อย aggregate venue capacity, booked count, hasBookings เฉพาะ page นั้น
  - cache key ต้องรวม `search`, `category/categoryId`, `status`, `sort`, `pageSize`, `cursor/page`
  - รองรับทั้ง `category` ชื่อ category จาก frontend เดิม และ `categoryId`
- Event detail optimization:
  - แทน `Promise.all(showtimes.map(count capacity + count booked))` ด้วย aggregate query เดียวสำหรับทุก showtime ของ event
- My Tickets optimization:
  - `findManyByUser(userId)` เปลี่ยนเป็น paginated query
  - select เฉพาะ field ที่ UI ใช้ แทน deep include ทั้งหมดทุก booking
- Master Data seats optimization:
  - query seats แบบ paginated natural order
  - aggregate booking count เฉพาะ seat IDs ใน page ปัจจุบัน

## SQL Index Plan
เพิ่มใน `performance_indexes.sql` แบบ `IF NOT EXISTS`:
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_events_event_desc
ON "Events" ("EventID" DESC);

CREATE INDEX IF NOT EXISTS idx_events_category_event_desc
ON "Events" ("CategoryID", "EventID" DESC);

CREATE INDEX IF NOT EXISTS idx_events_title_trgm
ON "Events" USING gin ("Title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_showtimes_event_start_covering
ON "Showtimes" ("EventID", "StartDateTime", "ShowtimeID")
INCLUDE ("VenueID", "BasePrice");

CREATE INDEX IF NOT EXISTS idx_bookingdetails_showtime_booking_seat
ON "BookingDetails" ("ShowtimeID", "BookingID", "SeatID");

CREATE INDEX IF NOT EXISTS idx_seats_venue_row_number
ON "Seats" ("VenueID", "RowLabel", "SeatNumber", "SeatID");

CREATE INDEX IF NOT EXISTS idx_users_role_created
ON "Users" ("RoleID", "CreatedAt" DESC, "UserID");

CREATE INDEX IF NOT EXISTS idx_users_fullname_trgm
ON "Users" USING gin ("FullName" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_users_email_trgm
ON "Users" USING gin ("Email" gin_trgm_ops);
```

## Public Interfaces
- Paginated response ใช้ shape เดิมของ `findManyHybrid`:
```js
{
  data,
  page,
  pageSize,
  total,
  totalPages,
  pagination: {
    type,
    nextCursor,
    prevCursor,
    hasNextPage,
    hasPrevPage
  }
}
```
- Event list เพิ่ม query params:
  - `pagination=cursor|offset`
  - `cursor`, `direction`, `page`, `pageSize`
  - `search`, `category`, `categoryId`
  - `status=all|upcoming|past`
  - `sortBy=eventId|title|startDateTime|category`
  - `sortOrder=asc|desc`
- My Tickets เพิ่ม query params:
  - `status=all|pending|completed|cancelled`
  - `pagination`, `cursor`, `direction`, `page`, `pageSize`
- Master seats เพิ่ม query params:
  - `page`, `pageSize`, `sortBy=seat|type|history`, `sortOrder`

## Test Plan
- Backend:
  - existing tests: `node --test "test/**/*.test.js"`
  - add tests ว่า old no-param endpoints ยังคืน array เหมือนเดิม
  - add tests ว่า paginated endpoints คืน `{ data, pagination }`
  - add tests สำหรับ event filters `category`, `categoryId`, `status`
  - add tests สำหรับ My Tickets status pagination
  - add tests สำหรับ Master Data seat natural sort `1,2,10`
- DB:
  - run `npm run db:optimize-indexes`
  - verify indexes จาก `pg_indexes`
  - extend benchmark ให้มี Customer event list, paginated My Tickets, Master seats
  - run `npm run db:benchmark:ab`
- Frontend:
  - build ด้วย `node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run build`
  - manual check `/events`, `/my-tickets`, `/admin/events`, `/staff/events`, `/admin/master-data`

## Assumptions
- Reports & Analytics เป็น chart aggregate ไม่ใช่ list page จึงไม่เพิ่ม pagination ในรอบนี้
- Dropdown/reference endpoints ต้องยังเรียกแบบเดิมได้ จึงใช้ optional pagination เท่านั้น
- อนุญาตเพิ่ม indexes และ `pg_trgm` extension เพราะไม่เปลี่ยน table/column data dictionary
