# Query Optimization Summary

This document summarizes how database and query optimization is applied across the project, not only in one benchmarked query. It is useful for presentation, report writing, and explaining why the system stays responsive as data grows.

## 1. Optimization Goals

- Reduce query latency on high-traffic pages.
- Prevent unnecessary repeated queries.
- Keep seat booking correct under concurrent access.
- Support large admin datasets with pagination.
- Keep aggregation-heavy reports readable and manageable.

## 2. Main Optimization Techniques Used

### Database indexing

The project adds performance indexes for the query patterns that appear most often in booking, transaction, and seat-availability workflows.

Examples:

- `Bookings(UserID, BookingTimestamp DESC)`
- `Bookings(BookingTimestamp DESC)`
- `Bookings(StatusID, ExpiresAt)`
- `BookingDetails(ShowtimeID, SeatID)`
- `BookingDetails(BookingID)`
- `Showtimes(EventID, StartDateTime)`
- `Showtimes(VenueID)`
- `Seats(VenueID, SeatTypeID)`
- `Payments(StatusID, CreatedAt DESC)`
- `Payments(CreatedAt DESC)`
- `Payments(MethodID, CreatedAt DESC)`
- `Payments(BookingID)`

Why it helps:

- Faster booking history lookup.
- Faster admin bookings and transactions pages.
- Faster seat availability checks.
- Faster booking recheck during seat reservation.

### Aggregate SQL instead of N+1 queries

For heavier list pages, the project avoids querying related counts row by row.

Examples:

- Event list uses aggregated SQL and CTE-based logic instead of repeated per-event queries.
- Event list capacity, booked count, first showtime, and latest showtime are prepared in grouped SQL.
- Event detail showtime availability is computed with aggregate queries instead of repeated per-showtime counting.

Why it helps:

- Fewer round trips to the database.
- More stable performance when the number of events or showtimes grows.
- Better fit for admin and staff list pages.

### Report materialized views

For report endpoints with repeated joins across payments, bookings, booking details, showtimes, events, venues, and categories, the project uses materialized fact views.

Views used:

- `ReportPaymentDetailFacts`
- `ReportBookingDetailFacts`

Where it is used:

- Report KPI.
- Revenue by category.
- Revenue by venue.
- Bookings by month.
- Customer retention.
- Interest by category.

Why it helps:

- Avoids rebuilding the same report join graph on every request.
- Keeps analytics queries focused on filtering and grouping pre-joined fact rows.
- Improves report workloads that did not benefit enough from indexes alone.

Maintenance:

- Apply with `npm run db:optimize-reports`.
- Refresh after reseeding or new report data with `npm run db:refresh-report-views`.
- Drop for A/B testing with `npm run db:drop-report-views`.

### Transaction safety for booking

Booking correctness is optimized together with performance.

How it works:

- Booking creation runs inside a serializable transaction.
- The system checks seat existence and venue consistency.
- It rechecks active seat ownership before inserting booking details.
- Pending active bookings and completed bookings both block seats.

Why it helps:

- Prevents double booking.
- Keeps group booking all-or-nothing.
- Avoids expensive cleanup from inconsistent data later.

### Pagination

The project avoids loading large admin datasets in one request.

Where it is used:

- Admin Users.
- Admin Bookings.
- Admin Transactions.
- Admin Events with cursor mode when possible and offset fallback for unsupported sorts.
- Admin Reports tables now use paged table controls in the UI for large result sets.

Why it helps:

- Smaller payloads.
- Faster first render.
- Better user experience on large datasets.

## 3. Optimization by Feature Area

### Event list

Techniques used:

- CTE-based aggregate SQL.
- Server-side filtering by search, category, and status.
- Server-side sorting.
- Cursor pagination for default ID sort and offset fallback for other sorts.

Why it matters:

- Event list is a common entry point for both admin and staff.
- The old N+1 style became slow on larger datasets.

Current benchmark note:

- Legacy event list average: `105.04 ms`
- Optimized event list average: `117.00 ms`
- On the current synthetic dataset, the richer optimized event metrics query is slower than the simple legacy query.
- The remaining optimization opportunity is query-shape tuning for event metrics, not more indexing.

### Booking workflows

Techniques used:

- Indexes on booking and booking-detail lookup paths.
- Indexed expiry and status filtering.
- Serializable transaction during booking creation.
- Seat recheck before booking detail insertion.

Why it matters:

- Booking is the most correctness-sensitive workflow.
- It must stay fast while also preventing duplicate seat sales.

Measured results:

- My bookings page: `70.9%` faster
- Booking seat recheck: `90.9%` faster

### Transactions and admin financial views

Techniques used:

- Payment indexes for status, created date, method, and booking lookup.
- Cursor pagination on admin transactions.
- Server-side sort and filtering.

Why it matters:

- Finance-related pages are common admin views.
- These pages grow directly with system usage.

Measured result:

- Admin transactions page: `65.3%` faster

### Seat availability

Techniques used:

- Indexes on `ShowtimeID` and `SeatID`.
- Active booking checks using booking status and expiry.
- Aggregate booked-seat counting for showtime availability.

Why it matters:

- Seat selection is visible to end users.
- Slow availability queries hurt both UX and booking safety.

Measured result:

- Showtime seat availability: `72.7%` faster

### Admin event management

Techniques used:

- Server-side event sorting.
- Cursor pagination where supported.
- Offset fallback for non-ID sorts.
- Additional sort support for `Venue`, `Base Price`, `Start Date`, and `Status`.

Why it matters:

- Admin users need to browse events efficiently as records grow.
- Sorting and pagination reduce manual scanning.

### Reports and analytics

Techniques used:

- SQL aggregation for chart-oriented datasets.
- Materialized fact views for repeated analytics joins.
- Grouped results returned in chart-friendly shapes.
- Report tables paged in the frontend for easier navigation of long results.

Why it matters:

- Reports are naturally aggregate-heavy.
- They are less about raw row browsing and more about summarized patterns.

Important limitation:

- Aggregate-heavy report queries do not always benefit from the same indexes as booking and transaction pages.
- This is why materialized views were added for report facts instead of relying only on indexes.

## 4. Benchmark Summary

Latest benchmark dataset:

- Users: `15,059`
- Events: `194`
- Showtimes: `1,187`
- Seats: `1,677`
- Bookings: `61,117`
- BookingDetails: `170,754`
- Payments: `61,106`
- Tickets: `134,973`

Main A/B improvements:

- My bookings page: `18.85 ms -> 5.48 ms` (`70.9%` faster)
- Admin bookings page: `16.70 ms -> 3.81 ms` (`77.2%` faster)
- Admin transactions page: `10.06 ms -> 3.49 ms` (`65.3%` faster)
- Admin venue seats page: `10.54 ms -> 1.59 ms` (`84.9%` faster)
- Showtime seat availability: `198.73 ms -> 54.20 ms` (`72.7%` faster)
- Booking seat recheck: `14.83 ms -> 1.35 ms` (`90.9%` faster)
- Reports KPI: `474.73 ms -> 120.34 ms` (`74.7%` faster)
- Revenue by category report: `135.50 ms -> 46.22 ms` (`65.9%` faster)

Important caveat:

- Admin event list and staff event list did not improve from indexes alone because those workloads are aggregate-heavy.
- Report queries improved after adding materialized fact views.
- Event-list optimization still needs query-shape tuning because it computes richer event metrics than the legacy query.

## 5. Best Presentation Version

If you need a short explanation in class:

- The project uses indexes for booking, payment, and seat-availability queries.
- It uses aggregate SQL instead of repeated row-by-row queries for heavier list pages.
- It uses materialized views for report facts that need repeated joins.
- It uses transactions to keep booking correct under concurrent access.
- It uses pagination so large admin datasets stay responsive.
- The result is that booking, payment, seat, and report workloads improved clearly, while the event list is a separate aggregate-heavy query that still needs different tuning.

## 6. Related Files

- [PERFORMANCE_BENCHMARK.md](/Users/yummiegg/Workspaces/Code/Y2/Term2/CPE241/Project_Ticket/PERFORMANCE_BENCHMARK.md)
- [README.md](/Users/yummiegg/Workspaces/Code/Y2/Term2/CPE241/Project_Ticket/README.md)
- [server/src/services/eventListMetrics.service.js](/Users/yummiegg/Workspaces/Code/Y2/Term2/CPE241/Project_Ticket/server/src/services/eventListMetrics.service.js)
- [server/src/repositories/booking.repository.js](/Users/yummiegg/Workspaces/Code/Y2/Term2/CPE241/Project_Ticket/server/src/repositories/booking.repository.js)
- [server/prisma/migrations/performance_indexes.sql](/Users/yummiegg/Workspaces/Code/Y2/Term2/CPE241/Project_Ticket/server/prisma/migrations/performance_indexes.sql)
- [server/prisma/migrations/report_materialized_views.sql](/Users/yummiegg/Workspaces/Code/Y2/Term2/CPE241/Project_Ticket/server/prisma/migrations/report_materialized_views.sql)
