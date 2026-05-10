import { useEffect, useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
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
import { REPORTS, getReportById } from './reportConfig';
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
    legend: { position: 'right', labels: { color: '#94a3b8', font: { family: 'DM Sans', size: 12 }, boxWidth: 12 } },
    tooltip: CHART_DEFAULTS.plugins.tooltip
  }
};

const CATEGORY_COLORS = {
  Concert: 'rgba(168,85,247,0.82)',
  Movie: 'rgba(59,130,246,0.82)',
  Seminar: 'rgba(20,184,166,0.82)'
};

const LINE_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#14b8a6', '#94a3b8'];
const SEAT_COLORS = ['rgba(168,85,247,0.85)', 'rgba(99,102,241,0.85)', 'rgba(20,184,166,0.85)', 'rgba(245,158,11,0.85)'];

function getDefaultStartDate() {
  return '2025-05-01';
}

function getDefaultEndDate() {
  return new Date().toISOString().slice(0, 10);
}

function Spinner() {
  return <div className="rp-state">Loading report...</div>;
}

function NoData() {
  return <div className="rp-state muted">No data available</div>;
}

function formatMoney(value) {
  const amount = Number(value || 0);
  if (amount >= 1000000) return `THB ${(amount / 1000000).toFixed(2)}M`;
  return `THB ${amount.toLocaleString()}`;
}

function datasetEntries(datasets = {}) {
  return Object.entries(datasets).map(([label, data], index) => ({
    label,
    data,
    backgroundColor: CATEGORY_COLORS[label] || LINE_COLORS[index % LINE_COLORS.length],
    borderColor: CATEGORY_COLORS[label]?.replace('0.82', '1') || LINE_COLORS[index % LINE_COLORS.length],
    borderRadius: 5,
    tension: 0.38,
    fill: false,
    pointRadius: 3
  }));
}

function SeatHeatmap({ data }) {
  if (!data?.rows?.length || !data?.cols?.length) return <NoData />;

  const maxValue = Math.max(...data.data.flat(), 1);

  return (
    <div className="rp-heatmap-wrap">
      <div className="rp-heatmap-header" style={{ marginLeft: 56 }}>
        {data.cols.map(col => <div key={col} className="rp-heatmap-col">{col}</div>)}
      </div>
      {data.rows.map((row, rowIndex) => (
        <div key={row} className="rp-heatmap-row">
          <div className="rp-heatmap-row-label">{row}</div>
          {data.cols.map((col, colIndex) => {
            const value = data.data[rowIndex]?.[colIndex] || 0;
            const opacity = Math.max(0.08, value / maxValue);
            return (
              <div
                key={`${row}-${col}`}
                className="rp-heatmap-cell"
                style={{ background: `rgba(99,102,241,${opacity.toFixed(2)})` }}
                title={`${row}${col}: ${value}`}
              >
                {value || ''}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function FailureHeatmap({ data }) {
  if (!data?.seatTypes?.length || !data?.events?.length) return <NoData />;

  const maxValue = Math.max(...data.data.flat(), 1);

  return (
    <div className="rp-heatmap-wrap">
      <div className="rp-heatmap-header" style={{ marginLeft: 88 }}>
        {data.events.map(event => (
          <div key={event} className="rp-failure-col" title={event}>
            {event.length > 14 ? `${event.slice(0, 13)}...` : event}
          </div>
        ))}
      </div>
      {data.seatTypes.map((seatType, rowIndex) => (
        <div key={seatType} className="rp-heatmap-row">
          <div className="rp-heatmap-row-label wide">{seatType}</div>
          {data.events.map((event, colIndex) => {
            const value = data.data[rowIndex]?.[colIndex] || 0;
            const opacity = Math.max(0.08, value / maxValue);
            return (
              <div
                key={`${seatType}-${event}`}
                className="rp-heatmap-cell wide"
                style={{ background: `rgba(239,68,68,${opacity.toFixed(2)})` }}
                title={`${seatType} / ${event}: ${value}%`}
              >
                {value ? `${value}%` : ''}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function buildChart(report, data) {
  if (!data) return null;

  if (report.id === 'revenue-by-category' || report.id === 'venue-utilization' || report.id === 'peak-showtime-hours') {
    return {
      chartData: {
        labels: data.labels,
        datasets: datasetEntries(data.datasets)
      },
      options: CHART_DEFAULTS,
      Component: Bar
    };
  }

  if (report.id === 'user-growth') {
    return {
      chartData: {
        labels: data.labels,
        datasets: [{
          label: 'New Users',
          data: data.data,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99,102,241,0.14)',
          fill: true,
          tension: 0.4,
          pointRadius: 4
        }]
      },
      options: CHART_DEFAULTS,
      Component: Line
    };
  }

  if (report.id === 'revenue-by-venue' || report.id === 'interest-by-category') {
    return {
      chartData: {
        labels: data.labels,
        datasets: datasetEntries(data.datasets).map((dataset, index) => ({
          ...dataset,
          backgroundColor: 'transparent',
          borderColor: LINE_COLORS[index % LINE_COLORS.length],
          fill: report.id === 'interest-by-category'
        }))
      },
      options: CHART_DEFAULTS,
      Component: Line
    };
  }

  if (report.id === 'bookings-by-hour') {
    return {
      chartData: {
        labels: data.labels,
        datasets: [{
          label: 'Bookings',
          data: data.data,
          backgroundColor: 'rgba(99,102,241,0.82)',
          borderRadius: 5
        }]
      },
      options: { ...CHART_DEFAULTS, plugins: { ...CHART_DEFAULTS.plugins, legend: { display: false } } },
      Component: Bar
    };
  }

  if (report.id === 'booking-vs-capacity') {
    return {
      chartData: {
        labels: data.map(item => item.label),
        datasets: [
          { label: 'Capacity', data: data.map(item => item.capacity), backgroundColor: 'rgba(100,116,139,0.58)', borderRadius: 5 },
          { label: 'Sold', data: data.map(item => item.sold), backgroundColor: 'rgba(99,102,241,0.82)', borderRadius: 5 }
        ]
      },
      options: { ...CHART_DEFAULTS, indexAxis: 'y' },
      Component: Bar
    };
  }

  if (report.id === 'seat-type-revenue' || report.id === 'customer-retention') {
    return {
      chartData: {
        labels: data.labels,
        datasets: [{
          data: data.data,
          backgroundColor: SEAT_COLORS.slice(0, data.labels?.length || 0),
          borderWidth: 0
        }]
      },
      options: DOUGHNUT_OPTIONS,
      Component: Doughnut
    };
  }

  return null;
}

function Reports() {
  const { reportId } = useParams();
  const [startDate, setStartDate] = useState(getDefaultStartDate);
  const [endDate, setEndDate] = useState(getDefaultEndDate);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedVenueId, setSelectedVenueId] = useState('all');
  const [venues, setVenues] = useState([]);
  const [reportData, setReportData] = useState(null);
  const [kpi, setKpi] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const selectedReport = getReportById(reportId);
  const isKnownReport = REPORTS.some(report => report.id === reportId);
  const hasDateFilter = selectedReport.filters.includes('date');
  const hasCategoryFilter = selectedReport.filters.includes('category');
  const hasVenueFilter = selectedReport.filters.includes('venue');
  const chart = useMemo(() => buildChart(selectedReport, reportData), [selectedReport, reportData]);
  const ChartComponent = chart?.Component;
  const dateRangeLabel = hasDateFilter ? `${startDate} to ${endDate}` : 'Full historical range';
  const categoryLabel = hasCategoryFilter
    ? selectedCategory === 'all' ? 'all categories' : selectedCategory
    : 'all categories';
  const selectedVenue = venues.find(venue => String(venue.id) === String(selectedVenueId));
  const venueLabel = hasVenueFilter
    ? selectedVenueId === 'all' ? 'all venues' : selectedVenue?.name || 'selected venue'
    : 'all venues';
  const filterFieldCount = (hasCategoryFilter ? 1 : 0) + (hasDateFilter ? 2 : 0) + (hasVenueFilter ? 1 : 0);

  useEffect(() => {
    if (!hasVenueFilter) return;

    const token = localStorage.getItem('adminToken');
    axios.get(`${API_URL}/admin/venues`, { headers: { Authorization: `Bearer ${token}` } })
      .then(response => {
        setVenues(response.data);
        if (selectedReport.requireVenue && selectedVenueId === 'all' && response.data[0]) {
          setSelectedVenueId(String(response.data[0].id));
        }
      })
      .catch(err => {
        console.error('Venue filter fetch error:', err);
        setVenues([]);
      });
  }, [hasVenueFilter, selectedReport.requireVenue, selectedVenueId]);

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    const headers = { Authorization: `Bearer ${token}` };
    const params = {};
    if (hasDateFilter) {
      params.startDate = startDate;
      params.endDate = endDate;
    }
    if (hasCategoryFilter) {
      params.category = selectedCategory;
    }
    if (hasVenueFilter) {
      params.venueId = selectedVenueId;
    }

    setLoading(true);
    setError('');
    setReportData(null);

    Promise.all([
      axios.get(`${API_URL}/admin/reports/kpi`, { headers, params }),
      axios.get(`${API_URL}/admin/reports/${selectedReport.endpoint}`, { headers, params })
    ])
      .then(([kpiResponse, reportResponse]) => {
        setKpi(kpiResponse.data);
        setReportData(reportResponse.data);
      })
      .catch(err => {
        console.error('Report fetch error:', err);
        setError(err.response?.data?.error || 'Failed to load report');
        setReportData(null);
      })
      .finally(() => setLoading(false));
  }, [startDate, endDate, selectedCategory, selectedVenueId, selectedReport.endpoint, hasDateFilter, hasCategoryFilter, hasVenueFilter]);

  if (!isKnownReport) {
    return <Navigate to="/admin/reports/revenue-by-category" replace />;
  }

  return (
    <div className="rp-root">
      <div className="rp-header">
        <div>
          <div className="rp-title">Reports &amp; Analytics</div>
          <div className="rp-subtitle">Report {selectedReport.no} of 12 · {selectedReport.title}</div>
        </div>
      </div>

      {(hasDateFilter || hasCategoryFilter || hasVenueFilter) && (
        <div className={`rp-filter-panel cols-${filterFieldCount}`}>
          {hasCategoryFilter && (
            <label className="rp-filter-field">
              Category
              <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
                <option value="all">All Categories</option>
                <option value="Concert">Concert</option>
                <option value="Movie">Movie</option>
                <option value="Seminar">Seminar</option>
              </select>
            </label>
          )}

          {hasDateFilter && (
            <>
              <label className="rp-filter-field">
                From
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </label>

              <label className="rp-filter-field">
                To
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </label>
            </>
          )}

          {hasVenueFilter && (
            <label className="rp-filter-field">
              Venue
              <select value={selectedVenueId} onChange={e => setSelectedVenueId(e.target.value)}>
                {!selectedReport.requireVenue && <option value="all">All Venues</option>}
                {venues.map(venue => (
                  <option key={venue.id} value={venue.id}>{venue.name}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      <div className="rp-kpi-row">
        <div className="rp-kpi">
          <span className="rp-kpi-label">Total Revenue</span>
          <strong>{loading ? '...' : formatMoney(kpi?.totalRevenue)}</strong>
          <span>{dateRangeLabel}</span>
        </div>
        <div className="rp-kpi">
          <span className="rp-kpi-label">Total Bookings</span>
          <strong>{loading ? '...' : Number(kpi?.totalBookings || 0).toLocaleString()}</strong>
          <span>{categoryLabel}</span>
        </div>
        <div className="rp-kpi">
          <span className="rp-kpi-label">Top Category</span>
          <strong>{loading ? '...' : kpi?.topCategory || '-'}</strong>
          <span>Based on revenue</span>
        </div>
      </div>

      <section className="rp-report-card">
        <div className="rp-report-header">
          <div>
            <div className="rp-report-eyebrow">Report {selectedReport.no}</div>
            <h2>{selectedReport.title}</h2>
            <p>{selectedReport.description} Filter: {dateRangeLabel}, {categoryLabel}, {venueLabel}.</p>
          </div>
        </div>

        {error && <div className="rp-error">{error}</div>}

        <div className={`rp-visual ${selectedReport.chart.includes('Heatmap') ? 'heatmap' : ''}`}>
          {loading ? (
            <Spinner />
          ) : selectedReport.chart === 'seatHeatmap' ? (
            <SeatHeatmap data={reportData} />
          ) : selectedReport.chart === 'failureHeatmap' ? (
            <FailureHeatmap data={reportData} />
          ) : ChartComponent ? (
            <ChartComponent data={chart.chartData} options={chart.options} />
          ) : (
            <NoData />
          )}
        </div>
      </section>
    </div>
  );
}

export default Reports;
