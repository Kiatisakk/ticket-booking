import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import './Reports.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend
);

const API_URL = 'http://localhost:4000/api';

const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: { color: '#94a3b8', font: { family: 'DM Sans', size: 12 }, boxWidth: 12, padding: 16 }
    },
    tooltip: {
      backgroundColor: '#1a1e27',
      borderColor: 'rgba(255,255,255,0.1)',
      borderWidth: 1,
      titleColor: '#f1f5f9',
      bodyColor: '#94a3b8',
      padding: 10
    }
  },
  scales: {
    x: {
      grid: { color: 'rgba(255,255,255,0.04)' },
      ticks: { color: '#64748b', font: { family: 'DM Sans', size: 11 } }
    },
    y: {
      grid: { color: 'rgba(255,255,255,0.04)' },
      ticks: { color: '#64748b', font: { family: 'DM Sans', size: 11 } }
    }
  }
};

const DOUGHNUT_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '65%',
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#1a1e27',
      borderColor: 'rgba(255,255,255,0.1)',
      borderWidth: 1,
      titleColor: '#f1f5f9',
      bodyColor: '#94a3b8',
      padding: 10
    }
  }
};

const PERIOD_LABELS = {
  'this-month': 'This Month',
  'last-month': 'Last Month',
  'this-year':  'This Year'
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160, color: '#64748b', fontSize: 14 }}>
      Loading...
    </div>
  );
}

function NoData() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160, color: '#475569', fontSize: 13 }}>
      No data available
    </div>
  );
}

function DoughnutWithLegend({ data, options, legend }) {
  return (
    <div className="rp-doughnut-wrap">
      <div className="rp-doughnut-chart" style={{ width: 160, height: 160 }}>
        <Doughnut data={data} options={options} />
      </div>
      <div className="rp-doughnut-legend">
        {legend.map(item => (
          <div key={item.label} className="rp-legend-item">
            <div className="rp-legend-dot" style={{ background: item.color }} />
            <span className="rp-legend-label">{item.label}</span>
            <span className="rp-legend-value">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SeatHeatmap({ heatmapData }) {
  if (!heatmapData || !heatmapData.rows || heatmapData.data.every(r => r.every(v => v === 0))) {
    return <NoData />;
  }
  const { rows, cols, data } = heatmapData;
  const maxVal = Math.max(...data.flat(), 1);

  return (
    <div className="rp-heatmap-wrap">
      <div style={{ display: 'flex', marginLeft: 56, marginBottom: 4, gap: 3 }}>
        {cols.map(c => (
          <div key={c} className="rp-heatmap-col-label">{c}</div>
        ))}
      </div>
      <div className="rp-heatmap-rows">
        {rows.map((row, ri) => (
          <div key={row} className="rp-heatmap-row">
            <div className="rp-heatmap-row-label">{row}</div>
            {cols.map((col, ci) => {
              const count = data[ri]?.[ci] ?? 0;
              const opacity = Math.max(0.08, count / maxVal);
              return (
                <div
                  key={col}
                  className="rp-heatmap-cell"
                  style={{ background: `rgba(99,102,241,${opacity.toFixed(2)})` }}
                  title={`${row}${col}: ${count} booking${count !== 1 ? 's' : ''}`}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="rp-heatmap-legend">
        <span>Low</span>
        <div
          className="rp-heatmap-gradient"
          style={{ background: 'linear-gradient(to right, rgba(99,102,241,0.1), rgba(99,102,241,1))' }}
        />
        <span>High Popularity</span>
      </div>
    </div>
  );
}

function CancellationHeatmap({ heatmapData }) {
  if (!heatmapData || !heatmapData.seatTypes || heatmapData.events.length === 0) {
    return <NoData />;
  }
  const { seatTypes, events, data } = heatmapData;
  const maxVal = Math.max(...data.flat(), 1);

  return (
    <div className="rp-heatmap-wrap">
      <div style={{ display: 'flex', marginLeft: 80, marginBottom: 4, gap: 3 }}>
        {events.map(ev => (
          <div key={ev} style={{ width: 90, textAlign: 'center', fontSize: 11, color: '#64748b', flexShrink: 0 }}>
            {ev.length > 14 ? ev.slice(0, 13) + '…' : ev}
          </div>
        ))}
      </div>
      <div className="rp-heatmap-rows">
        {seatTypes.map((row, ri) => (
          <div key={row} className="rp-heatmap-row">
            <div className="rp-heatmap-row-label" style={{ width: 76 }}>{row}</div>
            {(data[ri] || []).map((val, ci) => {
              const intensity = val / maxVal;
              return (
                <div
                  key={ci}
                  className="rp-heatmap-cell"
                  style={{
                    width: 90,
                    background: `rgba(239,68,68,${(intensity * 0.85).toFixed(2)})`,
                    fontSize: 12
                  }}
                  title={`${row} / ${events[ci]}: ${val}%`}
                >
                  <span className="rp-cancel-pct">{val > 0 ? `${val}%` : ''}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="rp-heatmap-legend">
        <span>Low</span>
        <div
          className="rp-heatmap-gradient"
          style={{ background: 'linear-gradient(to right, rgba(239,68,68,0.1), rgba(239,68,68,0.9))' }}
        />
        <span>High Cancellation Rate</span>
      </div>
    </div>
  );
}

// ─── Reports page ─────────────────────────────────────────────────────────────

function Reports() {
  const [period, setPeriod] = useState('this-year');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading]       = useState(true);

  const periodLabel = PERIOD_LABELS[period];

  useEffect(() => {
    const token   = localStorage.getItem('adminToken');
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      axios.get(`${API_URL}/admin/reports/kpi`,                  { headers }),  // [0]  kpi
      axios.get(`${API_URL}/admin/reports/revenue-by-category`,  { headers }),  // [1]  r1
      axios.get(`${API_URL}/admin/reports/seat-heatmap`,         { headers }),  // [2]  r2 (heatmap)
      axios.get(`${API_URL}/admin/reports/user-growth`,          { headers }),  // [3]  r3
      axios.get(`${API_URL}/admin/reports/revenue-by-venue`,     { headers }),  // [4]  r4
      axios.get(`${API_URL}/admin/reports/bookings-by-hour`,     { headers }),  // [5]  r5
      axios.get(`${API_URL}/admin/reports/booking-vs-capacity`,  { headers }),  // [6]  r6
      axios.get(`${API_URL}/admin/reports/venue-utilization`,    { headers }),  // [7]  r7
      axios.get(`${API_URL}/admin/reports/seat-type-revenue`,    { headers }),  // [8]  r8
      axios.get(`${API_URL}/admin/reports/customer-retention`,   { headers }),  // [9]  r9
      axios.get(`${API_URL}/admin/reports/interest-by-category`, { headers }),  // [10] r10
      axios.get(`${API_URL}/admin/reports/peak-showtime-hours`,  { headers }),  // [11] r11
      axios.get(`${API_URL}/admin/reports/cancellation-heatmap`, { headers }),  // [12] r12
    ])
    .then(([kpiRes, r1Res, r2Res, r3Res, r4Res, r5Res, r6Res, r7Res, r8Res, r9Res, r10Res, r11Res, r12Res]) => {
      setReportData({
        kpi: kpiRes.data,
        r1:  r1Res.data,
        r2:  r2Res.data,
        r3:  r3Res.data,
        r4:  r4Res.data,
        r5:  r5Res.data,
        r6:  r6Res.data,
        r7:  r7Res.data,
        r8:  r8Res.data,
        r9:  r9Res.data,
        r10: r10Res.data,
        r11: r11Res.data,
        r12: r12Res.data,
      });
    })
    .catch(err => {
      console.error('Reports fetch error:', err);
    })
    .finally(() => {
      setLoading(false);
    });
  }, []);

  // ── Build chart data objects from API response ────────────────────────────

  // Report 1 — Revenue by Category (Grouped Bar)
  const r1ChartData = reportData?.r1 ? {
    labels: reportData.r1.labels,
    datasets: [
      { label: 'Concert', data: reportData.r1.datasets.Concert || [], backgroundColor: 'rgba(168,85,247,0.8)', borderRadius: 4 },
      { label: 'Movie',   data: reportData.r1.datasets.Movie   || [], backgroundColor: 'rgba(59,130,246,0.8)',  borderRadius: 4 },
      { label: 'Seminar', data: reportData.r1.datasets.Seminar || [], backgroundColor: 'rgba(45,212,191,0.8)',  borderRadius: 4 },
    ]
  } : null;

  // Report 3 — User Growth (Line)
  const r3ChartData = reportData?.r3 ? {
    labels: reportData.r3.labels,
    datasets: [{
      label:                'New Users',
      data:                 reportData.r3.data,
      borderColor:          '#6366f1',
      backgroundColor:      'rgba(99,102,241,0.15)',
      fill:                 true,
      tension:              0.4,
      pointBackgroundColor: '#6366f1',
      pointRadius:          4
    }]
  } : null;

  // Report 4 — Revenue by Venue (Multi-line)
  const VENUE_COLORS = {
    'Impact Arena':      '#6366f1',
    'SF Cinema Paragon': '#22c55e',
    'BITEC Bangkok':     '#f59e0b',
  };
  const r4ChartData = reportData?.r4 ? {
    labels:   reportData.r4.labels,
    datasets: Object.entries(reportData.r4.datasets).map(([name, data]) => ({
      label:           name,
      data,
      borderColor:     VENUE_COLORS[name] || '#94a3b8',
      backgroundColor: 'transparent',
      tension:         0.4,
      pointRadius:     3
    }))
  } : null;

  // Report 5 — Bookings by Hour (Bar) — filter to hours with data
  const r5ChartData = reportData?.r5 ? (() => {
    // Only show hours 0-23 that have at least 1 booking, or always show 0-23
    const labels = reportData.r5.labels;
    const data   = reportData.r5.data;
    return {
      labels,
      datasets: [{
        label:           'Bookings',
        data,
        backgroundColor: data.map((_, i) => {
          const h = parseInt(labels[i]);
          return h >= 14 ? 'rgba(99,102,241,0.85)' : 'rgba(99,102,241,0.4)';
        }),
        borderRadius: 5
      }]
    };
  })() : null;

  // Report 6 — Booking vs Capacity (Horizontal Grouped Bar)
  const r6ChartData = reportData?.r6?.length > 0 ? {
    labels:   reportData.r6.map(d => d.label),
    datasets: [
      { label: 'Capacity', data: reportData.r6.map(d => d.capacity), backgroundColor: 'rgba(100,116,139,0.6)', borderRadius: 4 },
      { label: 'Sold',     data: reportData.r6.map(d => d.sold),     backgroundColor: 'rgba(99,102,241,0.85)', borderRadius: 4 },
    ]
  } : null;
  const r6Options = {
    ...CHART_DEFAULTS,
    indexAxis: 'y',
    scales: {
      x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#64748b', font: { family: 'DM Sans', size: 11 } } },
      y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#64748b', font: { family: 'DM Sans', size: 11 } } }
    }
  };

  // Report 7 — Venue Utilization (Grouped Bar)
  const r7ChartData = reportData?.r7 ? {
    labels:   reportData.r7.labels,
    datasets: [
      { label: 'Concert', data: reportData.r7.datasets.Concert || [], backgroundColor: 'rgba(168,85,247,0.8)', borderRadius: 4 },
      { label: 'Movie',   data: reportData.r7.datasets.Movie   || [], backgroundColor: 'rgba(59,130,246,0.8)', borderRadius: 4 },
      { label: 'Seminar', data: reportData.r7.datasets.Seminar || [], backgroundColor: 'rgba(20,184,166,0.8)', borderRadius: 4 },
    ]
  } : null;

  // Report 8 — Seat Type Revenue (Doughnut)
  const SEAT_COLORS = ['rgba(168,85,247,0.85)', 'rgba(99,102,241,0.85)', 'rgba(20,184,166,0.85)'];
  const SEAT_DOT_COLORS = ['#a855f7', '#6366f1', '#14b8a6'];
  const r8ChartData = reportData?.r8?.labels?.length > 0 ? {
    labels: reportData.r8.labels,
    datasets: [{
      data:            reportData.r8.data,
      backgroundColor: SEAT_COLORS.slice(0, reportData.r8.labels.length),
      borderWidth:     0
    }]
  } : null;
  const r8Legend = reportData?.r8?.labels?.length > 0
    ? reportData.r8.labels.map((label, i) => {
        const total = reportData.r8.total || 1;
        const pct   = total > 0 ? Math.round((reportData.r8.data[i] / total) * 100) : 0;
        return { label, value: `${pct}%`, color: SEAT_DOT_COLORS[i] || '#94a3b8' };
      })
    : [];

  // Report 9 — Customer Retention (Doughnut)
  const r9ChartData = reportData?.r9?.data?.length > 0 ? {
    labels: reportData.r9.labels,
    datasets: [{
      data:            reportData.r9.data,
      backgroundColor: ['rgba(99,102,241,0.85)', 'rgba(100,116,139,0.5)'],
      borderWidth:     0
    }]
  } : null;
  const r9Total  = reportData?.r9 ? (reportData.r9.data[0] + reportData.r9.data[1]) || 1 : 1;
  const r9Legend = reportData?.r9?.data?.length > 0
    ? [
        { label: 'Repeat Customers',   value: `${Math.round((reportData.r9.data[0] / r9Total) * 100)}%`, color: '#6366f1' },
        { label: 'One-time Customers', value: `${Math.round((reportData.r9.data[1] / r9Total) * 100)}%`, color: '#64748b' },
      ]
    : [];

  // Report 10 — Interest by Category (Area)
  const r10ChartData = reportData?.r10 ? {
    labels:   reportData.r10.labels,
    datasets: [
      { label: 'Concert', data: reportData.r10.datasets.Concert || [], borderColor: '#a855f7', backgroundColor: 'rgba(168,85,247,0.12)', fill: true, tension: 0.4, pointRadius: 3 },
      { label: 'Movie',   data: reportData.r10.datasets.Movie   || [], borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.08)',  fill: true, tension: 0.4, pointRadius: 3 },
      { label: 'Seminar', data: reportData.r10.datasets.Seminar || [], borderColor: '#14b8a6', backgroundColor: 'rgba(20,184,166,0.06)',  fill: true, tension: 0.4, pointRadius: 3 },
    ]
  } : null;

  // Report 11 — Peak Showtime Hours (Grouped Bar)
  const r11ChartData = reportData?.r11 ? {
    labels:   reportData.r11.labels,
    datasets: [
      { label: 'Concert', data: reportData.r11.datasets.Concert || [], backgroundColor: 'rgba(168,85,247,0.8)', borderRadius: 4 },
      { label: 'Movie',   data: reportData.r11.datasets.Movie   || [], backgroundColor: 'rgba(59,130,246,0.8)', borderRadius: 4 },
      { label: 'Seminar', data: reportData.r11.datasets.Seminar || [], backgroundColor: 'rgba(20,184,166,0.8)', borderRadius: 4 },
    ]
  } : null;

  // ── KPI values ────────────────────────────────────────────────────────────
  const kpi = reportData?.kpi;
  const totalRevenueDisplay = kpi
    ? kpi.totalRevenue >= 1_000_000
      ? `฿${(kpi.totalRevenue / 1_000_000).toFixed(2)}M`
      : `฿${kpi.totalRevenue.toLocaleString()}`
    : '—';
  const totalBookingsDisplay = kpi
    ? kpi.totalBookings.toLocaleString()
    : '—';
  const topCategoryDisplay = kpi ? kpi.topCategory : '—';

  return (
    <div className="rp-root">
      <div className="rp-header">
        <div>
          <div className="rp-title">Reports &amp; Analytics</div>
          <div className="rp-subtitle">12 reports · {periodLabel}</div>
        </div>
        <select
          className="rp-period-select"
          value={period}
          onChange={e => setPeriod(e.target.value)}
        >
          <option value="this-month">This Month</option>
          <option value="last-month">Last Month</option>
          <option value="this-year">This Year</option>
        </select>
      </div>

      {/* KPI Cards */}
      <div className="rp-kpi-row">
        <div className="rp-kpi">
          <div className="rp-kpi-label">Total Revenue</div>
          <div className="rp-kpi-value">
            {loading ? '...' : totalRevenueDisplay}
          </div>
          <div className="rp-kpi-sub">{periodLabel} · Historical 2024</div>
        </div>
        <div className="rp-kpi">
          <div className="rp-kpi-label">Total Bookings</div>
          <div className="rp-kpi-value">
            {loading ? '...' : totalBookingsDisplay}
          </div>
          <div className="rp-kpi-sub">{periodLabel} · Tickets sold</div>
        </div>
        <div className="rp-kpi">
          <div className="rp-kpi-label">Top Category</div>
          <div className="rp-kpi-value" style={{ fontSize: 22 }}>
            {loading ? '...' : topCategoryDisplay}
          </div>
          <div className="rp-kpi-sub">Highest revenue in 2024</div>
        </div>
      </div>

      {/* 2-column chart grid */}
      <div className="rp-grid">

        {/* Report 1 — Revenue by Category */}
        <div className="rp-chart-card">
          <div className="rp-chart-title">Report 1 — Revenue by Category</div>
          <div className="rp-chart-subtitle">Monthly revenue (THB) · {periodLabel}</div>
          <div className="rp-chart-inner">
            {loading ? <Spinner /> : r1ChartData ? <Bar data={r1ChartData} options={CHART_DEFAULTS} /> : <NoData />}
          </div>
        </div>

        {/* Report 3 — Platform User Growth */}
        <div className="rp-chart-card">
          <div className="rp-chart-title">Report 3 — Platform User Growth</div>
          <div className="rp-chart-subtitle">Monthly new registrations · {periodLabel}</div>
          <div className="rp-chart-inner">
            {loading ? <Spinner /> : r3ChartData ? <Line data={r3ChartData} options={CHART_DEFAULTS} /> : <NoData />}
          </div>
        </div>

        {/* Report 4 — Revenue by Venue */}
        <div className="rp-chart-card">
          <div className="rp-chart-title">Report 4 — Revenue by Venue</div>
          <div className="rp-chart-subtitle">Monthly venue revenue (THB) · {periodLabel}</div>
          <div className="rp-chart-inner">
            {loading ? <Spinner /> : r4ChartData ? <Line data={r4ChartData} options={CHART_DEFAULTS} /> : <NoData />}
          </div>
        </div>

        {/* Report 5 — Bookings by Hour */}
        <div className="rp-chart-card">
          <div className="rp-chart-title">Report 5 — Bookings by Hour</div>
          <div className="rp-chart-subtitle">Total payments per hour of day · {periodLabel}</div>
          <div className="rp-chart-inner">
            {loading ? <Spinner /> : r5ChartData ? (
              <Bar data={r5ChartData} options={{ ...CHART_DEFAULTS, plugins: { ...CHART_DEFAULTS.plugins, legend: { display: false } } }} />
            ) : <NoData />}
          </div>
        </div>

        {/* Report 6 — Booking vs Capacity */}
        <div className="rp-chart-card">
          <div className="rp-chart-title">Report 6 — Booking vs Capacity</div>
          <div className="rp-chart-subtitle">Capacity vs sold tickets per showtime · {periodLabel}</div>
          <div className="rp-chart-inner">
            {loading ? <Spinner /> : r6ChartData ? <Bar data={r6ChartData} options={r6Options} /> : <NoData />}
          </div>
        </div>

        {/* Report 7 — Venue Utilization by Category */}
        <div className="rp-chart-card">
          <div className="rp-chart-title">Report 7 — Venue Utilization by Category</div>
          <div className="rp-chart-subtitle">Number of showtimes per venue × category · {periodLabel}</div>
          <div className="rp-chart-inner">
            {loading ? <Spinner /> : r7ChartData ? <Bar data={r7ChartData} options={CHART_DEFAULTS} /> : <NoData />}
          </div>
        </div>

        {/* Report 8 — Seat Type Revenue */}
        <div className="rp-chart-card">
          <div className="rp-chart-title">Report 8 — Seat Type Revenue</div>
          <div className="rp-chart-subtitle">Revenue share by seat type · {periodLabel}</div>
          <div className="rp-chart-inner" style={{ minHeight: 180 }}>
            {loading ? <Spinner /> : r8ChartData ? (
              <DoughnutWithLegend data={r8ChartData} options={DOUGHNUT_OPTIONS} legend={r8Legend} />
            ) : <NoData />}
          </div>
        </div>

        {/* Report 9 — Customer Retention */}
        <div className="rp-chart-card">
          <div className="rp-chart-title">Report 9 — Customer Retention</div>
          <div className="rp-chart-subtitle">Repeat vs one-time customers · {periodLabel}</div>
          <div className="rp-chart-inner" style={{ minHeight: 180 }}>
            {loading ? <Spinner /> : r9ChartData ? (
              <DoughnutWithLegend data={r9ChartData} options={DOUGHNUT_OPTIONS} legend={r9Legend} />
            ) : <NoData />}
          </div>
        </div>

        {/* Report 10 — Customer Interest by Category */}
        <div className="rp-chart-card">
          <div className="rp-chart-title">Report 10 — Customer Interest by Category</div>
          <div className="rp-chart-subtitle">Bookings trend by category · {periodLabel}</div>
          <div className="rp-chart-inner">
            {loading ? <Spinner /> : r10ChartData ? <Line data={r10ChartData} options={CHART_DEFAULTS} /> : <NoData />}
          </div>
        </div>

        {/* Report 11 — Peak Showtime Hours by Category */}
        <div className="rp-chart-card">
          <div className="rp-chart-title">Report 11 — Peak Showtime Hours by Category</div>
          <div className="rp-chart-subtitle">Tickets sold by hour and category · {periodLabel}</div>
          <div className="rp-chart-inner">
            {loading ? <Spinner /> : r11ChartData ? <Bar data={r11ChartData} options={CHART_DEFAULTS} /> : <NoData />}
          </div>
        </div>

        {/* Report 2 — Seat Popularity Heatmap (full width) */}
        <div className="rp-chart-card full-width">
          <div className="rp-chart-title">Report 2 — Seat Popularity Heatmap</div>
          <div className="rp-chart-subtitle">Impact Arena · seat selection frequency · {periodLabel}</div>
          {loading ? <Spinner /> : <SeatHeatmap heatmapData={reportData?.r2} />}
        </div>

        {/* Report 12 — Cancellation Rate Heatmap (full width) */}
        <div className="rp-chart-card full-width">
          <div className="rp-chart-title">Report 12 — Cancellation Rate Heatmap</div>
          <div className="rp-chart-subtitle">Cancellation % by seat type &times; event · {periodLabel}</div>
          {loading ? <Spinner /> : <CancellationHeatmap heatmapData={reportData?.r12} />}
        </div>

      </div>
    </div>
  );
}

export default Reports;
