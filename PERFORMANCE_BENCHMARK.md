# Performance Benchmark

This project includes repeatable database benchmark tooling for comparing query performance before and after adding performance indexes, plus a code-level comparison for the event-list N+1 optimization.

## Dataset

The latest benchmark was run on synthetic big data:

| Table | Rows |
| --- | ---: |
| Users | 5,033 |
| Events | 75 |
| Showtimes | 619 |
| Seats | 706 |
| Bookings | 20,539 |
| BookingDetails | 50,876 |
| Payments | 20,533 |
| Tickets | 41,771 |

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

```powershell
cd C:\Users\USER\Desktop\ticket-booking\server
$env:BENCHMARK_ITERATIONS='100'
node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run db:benchmark:ab
```

The command does the following:

1. Drops performance indexes.
2. Benchmarks the no-index state.
3. Re-applies performance indexes.
4. Benchmarks the indexed state.
5. Compares legacy event-list logic with the optimized event-list logic.
6. Saves full output to `server/benchmark-results/ab-latest.json`.

## Latest Results

### Index A/B Result

| Query | Before Avg | After Avg | Avg Faster | Speedup |
| --- | ---: | ---: | ---: | ---: |
| My bookings | 42.10 ms | 23.36 ms | 44.5% | 1.80x |
| Admin bookings page | 28.89 ms | 17.00 ms | 41.2% | 1.70x |
| Admin transactions page | 18.44 ms | 10.20 ms | 44.7% | 1.81x |
| Showtime seat availability | 76.23 ms | 60.47 ms | 20.7% | 1.26x |
| Booking seat recheck | 11.63 ms | 6.28 ms | 46.0% | 1.85x |
| Admin event list | 70.59 ms | 87.99 ms | -24.6% | 0.80x |
| Staff event list | 62.37 ms | 89.68 ms | -43.8% | 0.70x |

Indexes help the booking, transaction, seat availability, and seat recheck queries because those queries filter or order by indexed columns such as `UserID`, `BookingTimestamp`, `CreatedAt`, `ShowtimeID`, and `SeatID`.

Event-list endpoints are aggregate-heavy and scan broad event/showtime/seat/booking data, so these indexes do not improve that specific workload.

### Event List Code A/B Result

| Query | Before Avg | After Avg | Avg Faster | Speedup |
| --- | ---: | ---: | ---: | ---: |
| Legacy event list | 1781.28 ms | 1313.27 ms | 26.3% | 1.36x |

This result compares the old N+1 event-list style against the optimized aggregate implementation.

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

## Interpretation

Use `db:benchmark:ab` when you need a true before/after comparison. Running `db:benchmark:baseline` after indexes are already applied only creates an optimized baseline, so `db:benchmark:compare` will mostly show stability rather than improvement.

For reporting, the clearest statement is:

> Performance indexes improved booking, transaction, seat availability, and seat recheck workloads by about 20.7% to 46.0%. Event-list indexes did not help because that workload is aggregate-heavy, but reducing N+1 queries improved the event-list implementation by 26.3%.
