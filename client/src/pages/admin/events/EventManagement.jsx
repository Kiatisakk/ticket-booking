import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import './EventManagement.css';

const API_URL = 'http://localhost:4000/api';

const MOCK_EVENTS = [
  { id: 1, title: 'BTS World Tour Bangkok', category: 'Concert', venue: 'Impact Arena', basePrice: 2500 },
  { id: 2, title: 'Avengers: Secret Wars', category: 'Movie', venue: 'SF Cinema Paragon', basePrice: 350 },
  { id: 3, title: 'Tech Summit 2025', category: 'Seminar', venue: 'BITEC Bangkok', basePrice: 1200 }
];

function getCategoryClass(cat) {
  const lower = (cat || '').toLowerCase();
  if (lower === 'concert') return 'em-badge em-badge-concert';
  if (lower === 'movie') return 'em-badge em-badge-movie';
  if (lower === 'seminar') return 'em-badge em-badge-seminar';
  return 'em-badge em-badge-default';
}

function EventManagement() {
  const navigate = useNavigate();
  const { adminToken } = useAdminAuth();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [tab, setTab] = useState('upcoming');

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (categoryFilter) params.category = categoryFilter;

      const res = await axios.get(`${API_URL}/admin/events`, {
        headers: { Authorization: `Bearer ${adminToken}` },
        params
      });
      setEvents(res.data);
    } catch {
      setEvents(MOCK_EVENTS);
    } finally {
      setLoading(false);
    }
  }, [adminToken, search, categoryFilter]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await axios.delete(`${API_URL}/admin/events/${deleteTarget.id}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      setEvents(prev => prev.filter(e => e.id !== deleteTarget.id));
    } catch {
      // still remove from local list for UX
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const filtered = events.filter(e => {
    const matchSearch = !search || e.title?.toLowerCase().includes(search.toLowerCase());
    const matchCat = !categoryFilter || e.category?.toLowerCase() === categoryFilter.toLowerCase();
    const matchTab = tab === 'upcoming' ? !e.isPast : e.isPast;
    return matchSearch && matchCat && matchTab;
  });

  const upcomingCount = events.filter(e => !e.isPast).length;
  const pastCount     = events.filter(e => e.isPast).length;

  const renderTable = (list) => (
    list.length === 0 ? (
      <div className="em-empty">
        <div className="em-empty-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </div>
        <div>No {tab} events found</div>
      </div>
    ) : (
      <table className="em-table">
        <thead>
          <tr>
            <th>Event ID</th>
            <th>Title</th>
            <th>Category</th>
            <th>Venue</th>
            <th>Base Price</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {list.map(event => (
            <tr key={event.id} className={event.isPast ? 'em-row-past' : ''}>
              <td className="em-id-cell">#{event.id}</td>
              <td className="em-title-cell">{event.title}</td>
              <td>
                <span className={getCategoryClass(event.category)}>{event.category}</span>
              </td>
              <td>{event.venue || '-'}</td>
              <td className="em-price-cell">
                {event.basePrice != null ? `฿${Number(event.basePrice).toLocaleString()}` : '-'}
              </td>
              <td>
                <span className={event.isPast ? 'em-status-badge em-status-past' : 'em-status-badge em-status-upcoming'}>
                  {event.isPast ? 'Past' : 'Upcoming'}
                </span>
              </td>
              <td>
                <div className="em-actions">
                  <button className="em-edit-btn" onClick={() => navigate(`/admin/events/${event.id}/edit`)}>
                    Edit
                  </button>
                  <button className="em-del-btn" onClick={() => setDeleteTarget(event)}>
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  );

  return (
    <div className="em-root">
      <div className="em-header">
        <div>
          <div className="em-title">Event Management</div>
          <div className="em-title-sub">{events.length} total events · {upcomingCount} upcoming · {pastCount} past</div>
        </div>
        <button className="em-add-btn" onClick={() => navigate('/admin/events/add')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Event
        </button>
      </div>

      <div className="em-tabs">
        <button className={`em-tab ${tab === 'upcoming' ? 'em-tab-active' : ''}`} onClick={() => setTab('upcoming')}>
          Upcoming Events ({upcomingCount})
        </button>
        <button className={`em-tab ${tab === 'past' ? 'em-tab-active' : ''}`} onClick={() => setTab('past')}>
          Past Events ({pastCount})
        </button>
      </div>

      <div className="em-filters">
        <input
          className="em-search"
          type="text"
          placeholder="Search events..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="em-filter-select" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
          <option value="">All Categories</option>
          <option value="Concert">Concert</option>
          <option value="Movie">Movie</option>
          <option value="Seminar">Seminar</option>
        </select>
      </div>

      <div className="em-table-wrap">
        {loading ? (
          <div className="em-loading">Loading events...</div>
        ) : renderTable(filtered)}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="em-modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="em-modal" onClick={e => e.stopPropagation()}>
            <div className="em-modal-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
              </svg>
            </div>
            <div className="em-modal-title">Delete Event</div>
            <div className="em-modal-desc">
              Are you sure you want to delete <strong>{deleteTarget.title}</strong>? This action cannot be undone.
            </div>
            <div className="em-modal-actions">
              <button className="em-modal-cancel" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="em-modal-confirm-del" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete Event'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EventManagement;
