const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const { execFileSync } = require('child_process');
const prisma = require('./config/prisma');
const adminController = require('./controllers/admin.controller');
const staffController = require('./controllers/staff.controller');
const bookingService = require('./services/booking.service');
const showtimeRepository = require('./repositories/showtime.repository');
const bookingRepository = require('./repositories/booking.repository');

const ITERATIONS = Number(process.env.BENCHMARK_ITERATIONS || 20);
const WARMUP = Number(process.env.BENCHMARK_WARMUP || 3);
const RESULTS_DIR = path.join(__dirname, '..', 'benchmark-results');
const BASELINE_FILE = path.join(RESULTS_DIR, 'baseline.json');
const SERVER_DIR = path.join(__dirname, '..');

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const index = Math.min(Math.ceil(sorted.length * p) - 1, sorted.length - 1);
  return sorted[index];
}

function summarize(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = samples.reduce((total, value) => total + value, 0);
  return {
    avg: Number((sum / samples.length).toFixed(2)),
    p50: Number(percentile(sorted, 0.5).toFixed(2)),
    p95: Number(percentile(sorted, 0.95).toFixed(2)),
    min: Number(sorted[0].toFixed(2)),
    max: Number(sorted[sorted.length - 1].toFixed(2))
  };
}

async function measure(fn) {
  for (let i = 0; i < WARMUP; i += 1) {
    await fn();
  }

  const samples = [];
  for (let i = 0; i < ITERATIONS; i += 1) {
    const start = performance.now();
    await fn();
    samples.push(performance.now() - start);
  }
  return summarize(samples);
}

async function measureNamed(name, fn) {
  return [name, await measure(fn)];
}

function invokeController(handler, { query = {}, params = {}, user = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = { query, params, user, body: {} };
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        if (this.statusCode >= 400) {
          reject(new Error(payload?.error || `Controller returned ${this.statusCode}`));
          return;
        }
        resolve(payload);
      }
    };

    Promise.resolve(handler(req, res)).catch(reject);
  });
}

async function getFixtures() {
  const [booking, showtime, statuses] = await Promise.all([
    prisma.booking.findFirst({
      orderBy: { BookingID: 'desc' },
      select: { BookingID: true, UserID: true }
    }),
    prisma.showtime.findFirst({
      orderBy: { ShowtimeID: 'desc' },
      select: { ShowtimeID: true, VenueID: true }
    }),
    prisma.bookingStatus.findMany({
      where: { StatusName: { in: ['Pending', 'Completed'] } },
      select: { StatusID: true, StatusName: true }
    })
  ]);

  if (!booking || !showtime) {
    throw new Error('Benchmark needs seeded bookings and showtimes. Run db:seed-historical first.');
  }

  const seats = await prisma.seat.findMany({
    where: { VenueID: showtime.VenueID },
    take: 4,
    select: { SeatID: true }
  });

  const pendingStatus = statuses.find(status => status.StatusName === 'Pending');
  const completedStatus = statuses.find(status => status.StatusName === 'Completed');
  if (!pendingStatus || !completedStatus || seats.length === 0) {
    throw new Error('Benchmark needs booking statuses and venue seats.');
  }

  return {
    userId: booking.UserID,
    showtimeId: showtime.ShowtimeID,
    seatIds: seats.map(seat => seat.SeatID),
    pendingStatusId: pendingStatus.StatusID,
    completedStatusId: completedStatus.StatusID
  };
}

async function runBenchmarks() {
  const fixtures = await getFixtures();
  const rowCounts = await getRowCounts();
  const tasks = [
    {
      name: 'Admin event list',
      run: () => invokeController(adminController.getAllEvents, { query: {} })
    },
    {
      name: 'Staff event list',
      run: () => invokeController(staffController.getAllEvents, { query: {} })
    },
    {
      name: 'My bookings',
      run: () => bookingService.getMyBookings(fixtures.userId)
    },
    {
      name: 'Admin bookings page',
      run: () => invokeController(adminController.getAllBookings, {
        query: { page: '1', pageSize: '20', sortBy: 'bookingDate', sortOrder: 'desc' }
      })
    },
    {
      name: 'Admin transactions page',
      run: () => invokeController(adminController.getAllTransactions, {
        query: { page: '1', pageSize: '20', sortBy: 'date', sortOrder: 'desc' }
      })
    },
    {
      name: 'Showtime seat availability',
      run: () => showtimeRepository.findSeatAvailability(fixtures.showtimeId)
    },
    {
      name: 'Booking seat recheck',
      run: () => bookingRepository.runSerializable(tx =>
        bookingRepository.findActiveSeatBookings(tx, {
          showtimeId: fixtures.showtimeId,
          seatIds: fixtures.seatIds,
          pendingStatusId: fixtures.pendingStatusId,
          completedStatusId: fixtures.completedStatusId,
          now: new Date()
        })
      )
    }
  ];

  const results = {};
  for (const task of tasks) {
    results[task.name] = await measure(task.run);
  }

  return {
    generatedAt: new Date().toISOString(),
    iterations: ITERATIONS,
    warmup: WARMUP,
    rowCounts,
    results
  };
}

async function legacyEventList() {
  const events = await prisma.event.findMany({
    include: {
      Category: true,
      Showtimes: { include: { Venue: true } }
    },
    orderBy: { EventID: 'desc' }
  });

  const now = new Date();
  return Promise.all(events.map(async event => {
    const showtime = event.Showtimes?.[0] ?? null;
    const venueID = showtime?.VenueID ?? null;
    const totalSeats = venueID
      ? await prisma.seat.count({ where: { VenueID: venueID } })
      : 0;
    const bookedCount = showtime
      ? await prisma.bookingDetail.count({
          where: {
            ShowtimeID: showtime.ShowtimeID,
            Booking: {
              OR: [
                { Status: { StatusName: 'Completed' } },
                { Status: { StatusName: 'Pending' }, ExpiresAt: { gt: now } }
              ]
            }
          }
        })
      : 0;
    const allShowtimeIds = event.Showtimes?.map(item => item.ShowtimeID) || [];
    const totalBookings = allShowtimeIds.length > 0
      ? await prisma.bookingDetail.count({ where: { ShowtimeID: { in: allShowtimeIds } } })
      : 0;

    return {
      id: event.EventID,
      totalSeats,
      seatsRemaining: totalSeats - bookedCount,
      hasBookings: totalBookings > 0
    };
  }));
}

function runNpmScript(script) {
  const npmCli = process.env.NPM_CLI_JS || 'C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js';
  execFileSync(process.execPath, [npmCli, 'run', script], {
    cwd: SERVER_DIR,
    stdio: 'inherit',
    env: process.env
  });
}

function compareRows(beforeResults, afterResults) {
  return Object.entries(afterResults).map(([name, after]) => {
    const before = beforeResults[name];
    const avgFaster = ((before.avg - after.avg) / before.avg) * 100;
    const p50Faster = ((before.p50 - after.p50) / before.p50) * 100;
    return {
      query: name,
      before_avg_ms: before.avg,
      after_avg_ms: after.avg,
      before_p50_ms: before.p50,
      after_p50_ms: after.p50,
      avg_faster: `${avgFaster.toFixed(1)}%`,
      p50_faster: `${p50Faster.toFixed(1)}%`,
      speedup: `${(before.avg / after.avg).toFixed(2)}x`
    };
  });
}

async function runAbBenchmark() {
  console.log('=== A/B DB Benchmark ===');
  console.log('Step 1/5: dropping performance indexes...');
  runNpmScript('db:drop-indexes');

  console.log('Step 2/5: running no-index benchmark...');
  const noIndex = await runBenchmarks();

  console.log('Step 3/5: applying performance indexes...');
  runNpmScript('db:optimize-indexes');

  console.log('Step 4/5: running indexed benchmark...');
  const indexed = await runBenchmarks();

  console.log('Step 5/5: comparing legacy vs optimized event list...');
  const eventListPairs = await Promise.all([
    measureNamed('Legacy event list', legacyEventList),
    measureNamed('Optimized event list', () => invokeController(adminController.getAllEvents, { query: {} }))
  ]);
  const eventListResults = Object.fromEntries(eventListPairs);

  const payload = {
    generatedAt: new Date().toISOString(),
    iterations: ITERATIONS,
    warmup: WARMUP,
    rowCounts: indexed.rowCounts,
    noIndex: noIndex.results,
    indexed: indexed.results,
    eventList: eventListResults
  };

  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  fs.writeFileSync(path.join(RESULTS_DIR, 'ab-latest.json'), JSON.stringify(payload, null, 2));

  console.log('\nIndex A/B result:');
  console.table(compareRows(noIndex.results, indexed.results));

  console.log('\nEvent list code A/B result:');
  console.table(compareRows(
    { 'Event list': eventListResults['Legacy event list'] },
    { 'Event list': eventListResults['Optimized event list'] }
  ));

  console.log('\nSaved A/B details to benchmark-results/ab-latest.json');
  console.log(JSON.stringify(payload, null, 2));
}

async function getRowCounts() {
  const [
    users,
    events,
    showtimes,
    seats,
    bookings,
    bookingDetails,
    payments,
    tickets
  ] = await Promise.all([
    prisma.user.count(),
    prisma.event.count(),
    prisma.showtime.count(),
    prisma.seat.count(),
    prisma.booking.count(),
    prisma.bookingDetail.count(),
    prisma.payment.count(),
    prisma.ticket.count()
  ]);

  return { users, events, showtimes, seats, bookings, bookingDetails, payments, tickets };
}

function printResults(current, baseline = null) {
  if (baseline?.rowCounts) {
    const changedCounts = Object.entries(current.rowCounts || {})
      .filter(([key, value]) => baseline.rowCounts[key] !== value)
      .map(([key, value]) => `${key}: baseline=${baseline.rowCounts[key]} current=${value}`);
    if (changedCounts.length > 0) {
      console.warn('WARNING: baseline and current row counts differ. Compare may be unfair.');
      changedCounts.forEach(line => console.warn(`  ${line}`));
    }
  }

  const rows = Object.entries(current.results).map(([name, stats]) => {
    const before = baseline?.results?.[name];
    const fasterAvgPercent = before
      ? ((before.avg - stats.avg) / before.avg) * 100
      : null;
    const fasterP50Percent = before
      ? ((before.p50 - stats.p50) / before.p50) * 100
      : null;
    const speedup = before ? before.avg / stats.avg : null;

    return {
      query: name,
      avg_ms: stats.avg,
      p50_ms: stats.p50,
      p95_ms: stats.p95,
      min_ms: stats.min,
      max_ms: stats.max,
      before_avg_ms: before?.avg ?? '',
      avg_faster: fasterAvgPercent === null ? '' : `${fasterAvgPercent.toFixed(1)}%`,
      p50_faster: fasterP50Percent === null ? '' : `${fasterP50Percent.toFixed(1)}%`,
      speedup: speedup === null ? '' : `${speedup.toFixed(2)}x`
    };
  });

  console.log('Row counts:', current.rowCounts);
  console.table(rows);
  console.log(JSON.stringify(current, null, 2));
}

async function main() {
  const args = new Set(process.argv.slice(2));
  if (args.has('--ab')) {
    await runAbBenchmark();
    return;
  }

  const current = await runBenchmarks();

  if (args.has('--save-baseline')) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
    fs.writeFileSync(BASELINE_FILE, JSON.stringify(current, null, 2));
    console.log(`Baseline saved to ${BASELINE_FILE}`);
    printResults(current);
    return;
  }

  if (args.has('--compare')) {
    if (!fs.existsSync(BASELINE_FILE)) {
      throw new Error(`Baseline not found at ${BASELINE_FILE}. Run db:benchmark:baseline first.`);
    }
    const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
    printResults(current, baseline);
    return;
  }

  printResults(current);
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
