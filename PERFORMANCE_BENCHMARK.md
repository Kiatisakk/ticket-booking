# Performance Benchmark

This project includes repeatable database benchmark tooling for comparing query performance before and after adding performance indexes and report materialized views, plus a code-level comparison for the event-list N+1 optimization.

For a broader overview of query optimization, transaction safety, and pagination strategy across the system, see [QUERY_OPTIMIZATION_SUMMARY.md](QUERY_OPTIMIZATION_SUMMARY.md).

## Dataset

The latest benchmark was run on synthetic big data:

| Table | Rows |
| --- | ---: |
| Users | 15,059 |
| Events | 194 |
| Showtimes | 1,187 |
| Seats | 1,677 |
| Bookings | 61,117 |
| BookingDetails | 170,754 |
| Payments | 61,106 |
| Tickets | 134,973 |

Synthetic data can be generated with:

```powershell
cd C:\Users\USER\Desktop\ticket-booking\server
node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run db:seed-big
```

Use environment variables to control scale:

```powershell
$env:BIG_USERS='10000'
$env:BIG_BOOKINGS='50000'
node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run db:seed-big
```

## A/B Benchmark Command

Run the full before/after benchmark:

```bash
cd server
BENCHMARK_ITERATIONS=100 BENCHMARK_WARMUP=3 npm run db:benchmark:ab
```

```powershell
cd C:\Users\USER\Desktop\ticket-booking\server
$env:BENCHMARK_ITERATIONS='100'
$env:BENCHMARK_WARMUP='3'
node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run db:benchmark:ab
```

The command does the following:

1. Drops report materialized views.
2. Drops performance indexes.
3. Benchmarks the no-index/no-report-view state.
4. Re-applies performance indexes and report materialized views.
5. Benchmarks the indexed/report-view state.
6. Compares legacy event-list logic with the optimized event-list logic.
7. Saves full output to `server/benchmark-results/ab-latest.json`.

## Latest Results

### Index A/B Result

| Query | Before Avg | After Avg | Avg Faster | Speedup |
| --- | ---: | ---: | ---: | ---: |
| My bookings page | 18.85 ms | 5.48 ms | 70.9% | 3.44x |
| Admin bookings page | 16.70 ms | 3.81 ms | 77.2% | 4.38x |
| Admin transactions page | 10.06 ms | 3.49 ms | 65.3% | 2.88x |
| Admin users page | 12.31 ms | 11.91 ms | 3.2% | 1.03x |
| Admin venue seats page | 10.54 ms | 1.59 ms | 84.9% | 6.63x |
| Showtime seat availability | 198.73 ms | 54.20 ms | 72.7% | 3.67x |
| Booking seat recheck | 14.83 ms | 1.35 ms | 90.9% | 10.99x |
| Reports KPI | 474.73 ms | 120.34 ms | 74.7% | 3.94x |
| Revenue by category report | 135.50 ms | 46.22 ms | 65.9% | 2.93x |
| Admin event list (ID sort) | 35.64 ms | 42.71 ms | -19.8% | 0.83x |
| Admin event list (start date sort) | 38.72 ms | 43.36 ms | -12.0% | 0.89x |
| Staff event list (ID sort) | 35.29 ms | 41.55 ms | -17.7% | 0.85x |

Indexes help the booking, transaction, seat availability, and seat recheck queries because those queries filter or order by indexed columns such as `UserID`, `BookingTimestamp`, `CreatedAt`, `ShowtimeID`, and `SeatID`.

Report materialized views help analytics endpoints because they pre-join the repeated payment/booking/showtime/event/category fact rows used by KPI and revenue charts.

Event-list endpoints are aggregate-heavy and compute event metrics from broad event/showtime/seat/booking data, so these indexes do not improve that specific workload.

### Event List Code A/B Result

| Query | Before Avg | After Avg | Avg Faster | Speedup |
| --- | ---: | ---: | ---: | ---: |
| Legacy event list | 105.04 ms | 117.00 ms | -11.4% | 0.90x |

This result compares the old N+1 event-list style against the optimized aggregate implementation on the current synthetic dataset. The optimized version calculates richer event metrics in one SQL query, but the legacy implementation can still look faster on this dataset because there are only 194 events and the page asks for a small slice.

## Performance Indexes

Performance indexes are stored in:

```text
server/prisma/migrations/performance_indexes.sql
```

Apply them with:

```powershell
node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run db:optimize-indexes
```

Drop them for A/B testing with:

```powershell
node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run db:drop-indexes
```

## Report Materialized Views

Report materialized views are stored in:

```text
server/prisma/migrations/report_materialized_views.sql
server/prisma/migrations/refresh_report_materialized_views.sql
server/prisma/migrations/drop_report_materialized_views.sql
```

Apply them with:

```bash
npm run db:optimize-reports
```

Refresh them after reseeding or after inserting new benchmark/report data:

```bash
npm run db:refresh-report-views
```

Drop them for A/B testing with:

```bash
npm run db:drop-report-views
```

## Interpretation

Use `db:benchmark:ab` when you need a true before/after comparison. Running `db:benchmark:baseline` after indexes are already applied only creates an optimized baseline, so `db:benchmark:compare` will mostly show stability rather than improvement.

For reporting, the clearest statement is:

> Performance indexes improved booking, transaction, seat availability, and seat recheck workloads. Report materialized views improved KPI and revenue reports by avoiding repeated heavy joins. Event-list indexes still did not help because that workload is aggregate-heavy and computed from broad event metrics.

For UI-heavy admin pages, the project also uses pagination and targeted aggregation so users do not have to load or scan oversized result sets all at once.
