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
import { REPORTS, getReportById, normalizeReportId } from './reportConfig';
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
  Movie: 'rgba(56,189,248,0.88)',
  Seminar: 'rgba(20,184,166,0.82)'
};

const LINE_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#14b8a6', '#94a3b8'];
const SEAT_COLORS = ['rgba(168,85,247,0.85)', 'rgba(99,102,241,0.85)', 'rgba(20,184,166,0.85)', 'rgba(245,158,11,0.85)'];

const BAR_CHART_OPTIONS = {
  ...CHART_DEFAULTS,
  scales: {
    x: {
      ...CHART_DEFAULTS.scales.x,
      grid: { color: 'rgba(255,255,255,0.08)' }
    },
    y: {
      ...CHART_DEFAULTS.scales.y,
      grid: { color: 'rgba(148,163,184,0.16)' },
      ticks: { color: '#94a3b8', font: { family: 'DM Sans', size: 11 } }
    }
  }
};

const ZERO_VALUE_PLUGIN = {
  id: 'zeroValueLabels',
  afterDatasetsDraw(chart) {
    const { ctx, data } = chart;

    ctx.save();
    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 10px DM Sans';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      meta.data.forEach((bar, valueIndex) => {
        if (Number(dataset.data?.[valueIndex]) !== 0) return;
        ctx.fillText('0', bar.x, bar.y - 4);
      });
    });

    ctx.restore();
  }
};

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

function formatCellValue(value) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'number') return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return String(value);
}

function formatMoney(value) {
  const amount = Number(value || 0);
  if (amount >= 1000000) return `THB ${(amount / 1000000).toFixed(2)}M`;
  return `THB ${amount.toLocaleString()}`;
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(2)}%`;
}

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function scaleRatio(value, minValue, maxValue) {
  if (maxValue <= minValue) return value > 0 ? 1 : 0;
  return clamp((value - minValue) / (maxValue - minValue));
}

function rgbFromString(rgb) {
  return rgb.split(',').map(part => Number(part.trim()));
}

function rgbaFromTone(rgb, alpha) {
  return `rgba(${rgb},${alpha.toFixed(2)})`;
}

const VIRIDIS_STOPS = [
  [68, 1, 84],
  [59, 82, 139],
  [33, 145, 140],
  [94, 201, 98],
  [253, 231, 37]
];

const SEAT_HEATMAP_STOPS = [
  [22, 163, 74],
  [132, 204, 22],
  [250, 204, 21],
  [249, 115, 22],
  [220, 38, 38],
  [127, 29, 29]
];

function interpolateColorStops(stops, ratio) {
  const scaled = clamp(ratio) * (stops.length - 1);
  const index = Math.min(Math.floor(scaled), stops.length - 2);
  const local = scaled - index;
  const start = stops[index];
  const end = stops[index + 1];
  return start.map((channel, channelIndex) =>
    Math.round(channel + (end[channelIndex] - channel) * local)
  );
}

function interpolateViridis(ratio) {
  const rgb = interpolateColorStops(VIRIDIS_STOPS, ratio);
  return `rgb(${rgb.join(',')})`;
}

function seatHeatmapColor(ratio, value) {
  if (value <= 0) {
    return {
      background: '#111827',
      color: '#64748b'
    };
  }

  const rgb = interpolateColorStops(SEAT_HEATMAP_STOPS, ratio);
  const luminance = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
  return {
    background: `rgb(${rgb.join(',')})`,
    color: luminance > 0.58 ? '#111827' : '#f8fafc'
  };
}

function flattenNumericValues(matrix, { includeZero = true } = {}) {
  return (matrix || [])
    .flat()
    .filter(value => value !== null && value !== undefined && Number.isFinite(Number(value)))
    .map(Number)
    .filter(value => includeZero || value > 0);
}

function HeatmapLegend({ gradient, minLabel, maxLabel }) {
  return (
    <div className="rp-heatmap-legend">
      <span>{minLabel}</span>
      <div className="rp-heatmap-legend-bar" style={{ background: gradient }} />
      <span>{maxLabel}</span>
    </div>
  );
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

function barDatasets(datasets = {}) {
  return datasetEntries(datasets).map(dataset => ({
    ...dataset,
    barPercentage: 0.9,
    categoryPercentage: 0.72,
    borderRadius: 7,
    minBarLength: 2
  }));
}

function SeatHeatmap({ data }) {
  if (!data?.rows?.length || !data?.cols?.length) return <NoData />;

  const values = flattenNumericValues(data.data);
  const minValue = values.length ? Math.min(...values) : 0;
  const maxValue = values.length ? Math.max(...values) : 1;
  const legendGradient = `linear-gradient(90deg, ${SEAT_HEATMAP_STOPS.map(rgb => `rgb(${rgb.join(',')})`).join(', ')})`;

  return (
    <div className="rp-heatmap-wrap">
      <HeatmapLegend
        gradient={legendGradient}
        minLabel={`Lowest ${minValue.toLocaleString()}`}
        maxLabel={`Highest ${maxValue.toLocaleString()}`}
      />
      <div className="rp-heatmap-header" style={{ marginLeft: 56 }}>
        {data.cols.map(col => <div key={col} className="rp-heatmap-col">{col}</div>)}
      </div>
      {data.rows.map((row, rowIndex) => (
        <div key={row} className="rp-heatmap-row">
          <div className="rp-heatmap-row-label">{row}</div>
          {data.cols.map((col, colIndex) => {
            const value = data.data[rowIndex]?.[colIndex] || 0;
            const ratio = scaleRatio(value, minValue, maxValue);
            const color = seatHeatmapColor(ratio, value);
            return (
              <div
                key={`${row}-${col}`}
                className="rp-heatmap-cell"
                style={color}
                title={`${row}${col}: ${value}`}
              >
                {value.toLocaleString()}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

const HEATMAP_TONES = {
  red: { base: '239,68,68', text: '#fecaca' },
  orange: { base: '245,158,11', text: '#fde68a' },
  green: { base: '20,184,166', text: '#99f6e4' },
  purple: { base: '139,92,246', text: '#ddd6fe' }
};

function CancellationHeatmapGrid({ heatmap }) {
  if (!heatmap?.rows?.length || !heatmap?.cols?.length) return <NoData />;

  const tone = HEATMAP_TONES[heatmap.tone] || HEATMAP_TONES.red;
  const [r, g, b] = rgbFromString(tone.base);
  const nonZeroValues = flattenNumericValues(heatmap.data, { includeZero: false });
  const allValues = flattenNumericValues(heatmap.data);
  const minNonZero = nonZeroValues.length ? Math.min(...nonZeroValues) : 0;
  const maxValue = nonZeroValues.length ? Math.max(...nonZeroValues) : 0;
  const legendMin = nonZeroValues.length ? minNonZero : (allValues.length ? Math.min(...allValues) : 0);
  const legendMax = maxValue || (allValues.length ? Math.max(...allValues) : 0);
  const legendGradient = `linear-gradient(90deg, rgba(${r},${g},${b},0.20), rgba(${r},${g},${b},1))`;

  return (
    <div className="rp-cancel-heatmap">
      <h3>{heatmap.title}</h3>
      <HeatmapLegend
        gradient={legendGradient}
        minLabel={`Lowest Rate ${formatPercent(legendMin)}`}
        maxLabel={`Highest Rate ${formatPercent(legendMax)}`}
      />
      <div className="rp-cancel-heatmap-scroll">
        <div className="rp-cancel-heatmap-header">
          <div className="rp-cancel-axis">{heatmap.colLabel}</div>
          {heatmap.cols.map(col => (
            <div key={col} className="rp-cancel-col" title={col}>
              {col}
            </div>
          ))}
        </div>
        {heatmap.rows.map((row, rowIndex) => (
          <div key={row} className="rp-cancel-row">
            <div className="rp-cancel-row-label" title={row}>{row}</div>
            {heatmap.cols.map((col, colIndex) => {
              const rawValue = heatmap.data[rowIndex]?.[colIndex];
              const isMissing = rawValue === null || rawValue === undefined;
              const value = Number(rawValue || 0);
              const ratio = value > 0 ? scaleRatio(value, minNonZero, maxValue) : 0;
              const alpha = isMissing ? 0 : value === 0 ? 0.2 : 0.2 + ratio * 0.8;
              return (
                <div
                  key={`${row}-${col}`}
                  className={`rp-cancel-cell${isMissing ? ' missing' : ''}`}
                  style={{ background: isMissing ? 'rgba(255,255,255,0.035)' : rgbaFromTone(tone.base, alpha), color: value > 0 ? '#fff' : tone.text }}
                  title={`${row} / ${col}: ${isMissing ? 'N/A' : formatPercent(value)}`}
                >
                  {isMissing ? '-' : formatPercent(value)}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function CancellationHeatmaps({ data, selectedHeatmapKey }) {
  if (!data?.heatmaps?.length) return <NoData />;

  const selectedHeatmap = data.heatmaps.find(heatmap => heatmap.key === selectedHeatmapKey) || data.heatmaps[0];

  return (
    <div className="rp-cancel-grid">
      <CancellationHeatmapGrid heatmap={selectedHeatmap} />
    </div>
  );
}

function datasetForSelection(datasets, selectedKey) {
  if (!selectedKey || selectedKey === 'all') return datasets;
  return { [selectedKey]: datasets?.[selectedKey] || [] };
}

function buildChart(report, data, selectedCategory = 'all') {
  if (!data) return null;

  if (report.id === 'revenue-by-category') {
    if (!data.labels || !data.datasets) return null;
    const datasets = datasetForSelection(data.datasets, selectedCategory);

    return {
      chartData: {
        labels: data.labels,
        datasets: barDatasets(datasets)
      },
      options: BAR_CHART_OPTIONS,
      plugins: [ZERO_VALUE_PLUGIN],
      Component: Bar
    };
  }

  if (report.id === 'peak-showtime-hours') {
    if (!data.labels || !data.datasets) return null;
    const datasets = datasetForSelection(data.datasets, selectedCategory);

    return {
      chartData: {
        labels: data.labels,
        datasets: barDatasets(datasets)
      },
      options: {
        ...BAR_CHART_OPTIONS,
        scales: {
          ...BAR_CHART_OPTIONS.scales,
          y: {
            ...BAR_CHART_OPTIONS.scales.y,
            min: 0,
            max: 23,
            ticks: {
              color: '#64748b',
              font: { family: 'DM Sans', size: 11 },
              callback: value => `${String(value).padStart(2, '0')}:00`
            }
          }
        }
      },
      plugins: [ZERO_VALUE_PLUGIN],
      Component: Bar
    };
  }

  if (report.id === 'seat-type-revenue') {
    if (!data.rows?.length) return null;
    const rows = data.rows;

    return {
      chartData: {
        labels: rows.map(row => row.seatType),
        datasets: barDatasets({
          'Total Revenue': rows.map(row => Number(row.totalRevenue || 0))
        })
      },
      options: BAR_CHART_OPTIONS,
      plugins: [ZERO_VALUE_PLUGIN],
      Component: Bar
    };
  }

  if (report.id === 'venue-utilization') {
    if (!data.labels || !data.datasets) return null;
    const datasets = datasetForSelection(data.datasets, selectedCategory);

    return {
      chartData: {
        labels: data.labels,
        datasets: barDatasets(datasets)
      },
      options: BAR_CHART_OPTIONS,
      plugins: [ZERO_VALUE_PLUGIN],
      Component: Bar
    };
  }

  if (report.id === 'user-growth') {
    if (!data.labels || !data.data) return null;
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
    if (!data.labels || !data.datasets) return null;
    const datasets = report.id === 'interest-by-category'
      ? datasetForSelection(data.datasets, selectedCategory)
      : data.datasets;

    return {
      chartData: {
        labels: data.labels,
        datasets: datasetEntries(datasets).map((dataset, index) => ({
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
    if (!data.labels || !data.data) return null;
    return {
      chartData: {
        labels: data.labels,
        datasets: [{
          label: 'Bookings',
          data: data.data,
          backgroundColor: 'rgba(99,102,241,0.82)',
          borderRadius: 7,
          barPercentage: 0.9,
          categoryPercentage: 0.72,
          minBarLength: 2
        }]
      },
      options: { ...BAR_CHART_OPTIONS, plugins: { ...BAR_CHART_OPTIONS.plugins, legend: { display: false } } },
      plugins: [ZERO_VALUE_PLUGIN],
      Component: Bar
    };
  }

  if (report.id === 'booking-vs-capacity') {
    if (!Array.isArray(data)) return null;
    return {
      chartData: {
        labels: data.map(item => item.label),
        datasets: [
          { label: 'Capacity', data: data.map(item => item.capacity), backgroundColor: 'rgba(100,116,139,0.58)', borderRadius: 7, barPercentage: 0.9, categoryPercentage: 0.72, minBarLength: 2 },
          { label: 'Sold', data: data.map(item => item.sold), backgroundColor: 'rgba(99,102,241,0.82)', borderRadius: 7, barPercentage: 0.9, categoryPercentage: 0.72, minBarLength: 2 }
        ]
      },
      options: { ...BAR_CHART_OPTIONS, indexAxis: 'y' },
      plugins: [ZERO_VALUE_PLUGIN],
      Component: Bar
    };
  }

  if (report.id === 'customer-retention') {
    if (!data.labels || !data.data) return null;
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

function buildReportTable(report, data) {
  if (!data) return { columns: [], rows: [] };

  if (report.id === 'seat-heatmap') {
    if (data.details?.length) {
      return {
        columns: ['Seat Row', 'Seat Number', 'Bookings', 'Revenue'],
        rows: data.details.map(row => [
          row.rowLabel,
          row.seatNumber,
          row.bookings,
          formatMoney(row.revenue)
        ])
      };
    }

    return {
      columns: ['Seat Row', ...(data.cols || [])],
      rows: (data.rows || []).map((rowLabel, rowIndex) => [
        rowLabel,
        ...(data.cols || []).map((_, colIndex) => data.data?.[rowIndex]?.[colIndex] ?? 0)
      ])
    };
  }

  if (report.id === 'cancellation-rate') {
    const columns = ['Venue Name', 'Seat Type', 'Event', 'Booking Year', 'Booking Month', 'Showtime', 'Total Booking', 'Cancelled Count', 'Cancel Rate Percentage'];
    return {
      columns,
      rows: (data.rows || []).map(row => [
        row.venueName,
        row.seatType,
        row.eventTitle,
        row.bookingYear,
        row.bookingMonth,
        row.showtimeLabel,
        row.totalBooking,
        row.cancelledCount,
        row.cancelRatePercentage
      ])
    };
  }

  if (report.id === 'customer-retention') {
    return {
      columns: ['Customer Segment', 'Revenue Contribution', 'Users', 'Bookings'],
      rows: (data.rows || []).map(row => [
        row.segment,
        formatMoney(row.revenue),
        row.users,
        row.bookings
      ])
    };
  }

  if (report.id === 'peak-showtime-hours') {
    return {
      columns: ['Month', 'Category', 'Peak Hour', 'Tickets Sold'],
      rows: (data.rows || []).map(row => [
        row.month,
        row.category,
        row.peakHour,
        row.tickets
      ])
    };
  }

  if (report.id === 'booking-vs-capacity') {
    return {
      columns: ['Showtime', 'Venue', 'Capacity', 'Sold', 'Remaining', 'Occupancy Rate', 'Status'],
      rows: (data || []).map(row => [
        row.label,
        row.venue,
        row.capacity,
        row.sold,
        row.remaining,
        formatPercent(row.occupancyRatePct),
        row.status
      ])
    };
  }

  if (report.id === 'seat-type-revenue') {
    return {
      columns: ['Seat Type', 'Total Tickets Sold', 'Total Revenue', 'Avg Days in Advance'],
      rows: (data.rows || []).map(row => [
        row.seatType,
        row.totalTicketsSold,
        formatMoney(row.totalRevenue),
        row.avgDaysInAdvance
      ])
    };
  }

  if (Array.isArray(data)) {
    const columns = [...new Set(data.flatMap(row => Object.keys(row || {})))];
    return {
      columns: columns.map(column => column.replace(/([A-Z])/g, ' $1').replace(/^./, letter => letter.toUpperCase())),
      rows: data.map(row => columns.map(column => row?.[column]))
    };
  }

  if (data.labels && data.datasets) {
    const datasetNames = Object.keys(data.datasets);
    return {
      columns: ['Label', ...datasetNames],
      rows: data.labels.map((label, index) => [
        label,
        ...datasetNames.map(datasetName => data.datasets[datasetName]?.[index] ?? 0)
      ])
    };
  }

  if (data.labels && data.data) {
    return {
      columns: ['Label', 'Value'],
      rows: data.labels.map((label, index) => [label, data.data?.[index] ?? 0])
    };
  }

  return { columns: [], rows: [] };
}

function ReportTable({ report, data }) {
  const table = useMemo(() => buildReportTable(report, data), [report, data]);

  if (!table.columns.length || !table.rows.length) return <NoData />;

  return (
    <div className={`rp-table-wrap${report.id === 'cancellation-rate' ? ' wide' : ''}`}>
      <table className="rp-table">
        <thead>
          <tr>
            {table.columns.map(column => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={`${report.id}-${rowIndex}`}>
              {row.map((cell, cellIndex) => (
                <td key={`${report.id}-${rowIndex}-${cellIndex}`}>{formatCellValue(cell)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
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
  const [viewMode, setViewMode] = useState('table');
  const [selectedHeatmapType, setSelectedHeatmapType] = useState('venue-seat-type');

  const normalizedReportId = normalizeReportId(reportId);
  const selectedReport = getReportById(normalizedReportId);
  const isKnownReport = REPORTS.some(report => report.id === normalizedReportId);
  const hasDateFilter = selectedReport.filters.includes('date');
  const hasCategoryFilter = selectedReport.filters.includes('category');
  const hasVenueFilter = selectedReport.filters.includes('venue');
  const isTableOnlyReport = selectedReport.chart === 'tableOnly';
  const chart = useMemo(
    () => buildChart(selectedReport, reportData, selectedCategory),
    [selectedReport, reportData, selectedCategory]
  );
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

  if (reportId !== normalizedReportId) {
    return <Navigate to={`/admin/reports/${normalizedReportId}`} replace />;
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

          {!isTableOnlyReport && (
            <div className="rp-view-toggle" aria-label="Report view mode">
              <button
                type="button"
                className={viewMode === 'table' ? 'active' : ''}
                onClick={() => setViewMode('table')}
              >
                Table
              </button>
              <button
                type="button"
                className={viewMode === 'visualization' ? 'active' : ''}
                onClick={() => setViewMode('visualization')}
              >
                Visualization
              </button>
            </div>
          )}
        </div>

        {error && <div className="rp-error">{error}</div>}

        {!loading && viewMode === 'visualization' && selectedReport.chart === 'cancellationHeatmap' && reportData?.heatmaps?.length > 0 && (
          <label className="rp-heatmap-select">
            Heatmap Type
            <select value={selectedHeatmapType} onChange={e => setSelectedHeatmapType(e.target.value)}>
              {reportData.heatmaps.map(heatmap => (
                <option key={heatmap.key} value={heatmap.key}>{heatmap.title}</option>
              ))}
            </select>
          </label>
        )}

        <div className={`rp-visual ${selectedReport.chart.includes('Heatmap') ? 'heatmap' : ''}`}>
          {loading ? (
            <Spinner />
          ) : isTableOnlyReport || viewMode === 'table' ? (
            <ReportTable report={selectedReport} data={reportData} />
          ) : selectedReport.chart === 'seatHeatmap' ? (
            <SeatHeatmap data={reportData} />
          ) : selectedReport.chart === 'cancellationHeatmap' ? (
            <CancellationHeatmaps data={reportData} selectedHeatmapKey={selectedHeatmapType} />
          ) : ChartComponent ? (
            <ChartComponent data={chart.chartData} options={chart.options} plugins={chart.plugins || []} />
          ) : (
            <NoData />
          )}
        </div>
      </section>
    </div>
  );
}

export default Reports;
