import { useEffect, useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import { REPORTS, getReportById, normalizeReportId } from './reportConfig';
import {
  CancellationHeatmaps,
  CustomerRetentionCharts,
  NoData,
  ReportTable,
  SeatHeatmap,
  Spinner,
  buildChart,
  formatMoney,
  getDefaultEndDate,
  getDefaultStartDate
} from './reportRenderer';
import './Reports.css';

const API_URL = 'http://localhost:4000/api';

function Reports() {
  const { reportId } = useParams();
  const { adminToken } = useAdminAuth();
  const [startDate, setStartDate] = useState(getDefaultStartDate);
  const [endDate, setEndDate] = useState(getDefaultEndDate);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedVenueId, setSelectedVenueId] = useState('all');
  const [venues, setVenues] = useState([]);
  const [reportData, setReportData] = useState(null);
  const [loadedReportId, setLoadedReportId] = useState(null);
  const [kpi, setKpi] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('table');
  const [selectedHeatmapType, setSelectedHeatmapType] = useState('venue-seat-type');
  const [selectedVenueSeries, setSelectedVenueSeries] = useState([]);

  const normalizedReportId = normalizeReportId(reportId);
  const selectedReport = getReportById(normalizedReportId);
  const isKnownReport = REPORTS.some(report => report.id === normalizedReportId);
  const currentReportData = loadedReportId === selectedReport.id ? reportData : null;
  const hasDateFilter = selectedReport.filters.includes('date');
  const hasCategoryFilter = selectedReport.filters.includes('category');
  const hasVenueFilter = selectedReport.filters.includes('venue');
  const isTableOnlyReport = selectedReport.chart === 'tableOnly';
  const venueSeriesOptions = useMemo(
    () => selectedReport.id === 'revenue-by-venue' ? Object.keys(currentReportData?.datasets || {}) : [],
    [selectedReport.id, currentReportData]
  );
  const chart = useMemo(
    () => buildChart(selectedReport, currentReportData, selectedCategory, selectedVenueSeries),
    [selectedReport, currentReportData, selectedCategory, selectedVenueSeries]
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
    if (!hasVenueFilter || !adminToken) return;

    axios.get(`${API_URL}/admin/venues`, { headers: { Authorization: `Bearer ${adminToken}` } })
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
  }, [adminToken, hasVenueFilter, selectedReport.requireVenue, selectedVenueId]);

  useEffect(() => {
    if (selectedReport.id !== 'revenue-by-venue') {
      setSelectedVenueSeries([]);
      return;
    }

    setSelectedVenueSeries(current => {
      const valid = current.filter(venue => venueSeriesOptions.includes(venue));
      return valid.length ? valid : venueSeriesOptions;
    });
  }, [selectedReport.id, venueSeriesOptions]);

  useEffect(() => {
    if (!adminToken) return;

    let active = true;
    const requestReportId = selectedReport.id;
    const headers = { Authorization: `Bearer ${adminToken}` };
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
    setLoadedReportId(null);

    Promise.all([
      axios.get(`${API_URL}/admin/reports/kpi`, { headers, params }),
      axios.get(`${API_URL}/admin/reports/${selectedReport.endpoint}`, { headers, params })
    ])
      .then(([kpiResponse, reportResponse]) => {
        if (!active) return;
        setKpi(kpiResponse.data);
        setReportData(reportResponse.data);
        setLoadedReportId(requestReportId);
      })
      .catch(err => {
        if (!active) return;
        console.error('Report fetch error:', err);
        setError(err.response?.data?.error || 'Failed to load report');
        setReportData(null);
        setLoadedReportId(requestReportId);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [adminToken, startDate, endDate, selectedCategory, selectedVenueId, selectedReport.id, selectedReport.endpoint, hasDateFilter, hasCategoryFilter, hasVenueFilter]);

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

        {!loading && viewMode === 'visualization' && selectedReport.chart === 'cancellationHeatmap' && currentReportData?.heatmaps?.length > 0 && (
          <label className="rp-heatmap-select">
            Heatmap Type
            <select value={selectedHeatmapType} onChange={e => setSelectedHeatmapType(e.target.value)}>
              {currentReportData.heatmaps.map(heatmap => (
                <option key={heatmap.key} value={heatmap.key}>{heatmap.title}</option>
              ))}
            </select>
          </label>
        )}

        {!loading && viewMode === 'visualization' && selectedReport.id === 'revenue-by-venue' && venueSeriesOptions.length > 0 && (
          <div className="rp-lov-panel" aria-label="Venue series filter">
            {venueSeriesOptions.map(venue => (
              <label key={venue} className="rp-lov-option">
                <input
                  type="checkbox"
                  checked={selectedVenueSeries.includes(venue)}
                  onChange={event => {
                    setSelectedVenueSeries(current => event.target.checked
                      ? [...current, venue]
                      : current.filter(item => item !== venue));
                  }}
                />
                <span>{venue}</span>
              </label>
            ))}
          </div>
        )}

        <div className={`rp-visual ${selectedReport.chart.includes('Heatmap') ? 'heatmap' : ''}`}>
          {loading ? (
            <Spinner />
          ) : isTableOnlyReport || viewMode === 'table' ? (
            <ReportTable report={selectedReport} data={currentReportData} />
          ) : selectedReport.chart === 'seatHeatmap' ? (
            <SeatHeatmap data={currentReportData} />
          ) : selectedReport.chart === 'cancellationHeatmap' ? (
            <CancellationHeatmaps data={currentReportData} selectedHeatmapKey={selectedHeatmapType} />
          ) : selectedReport.id === 'customer-retention' && chart ? (
            <CustomerRetentionCharts chart={chart} />
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
