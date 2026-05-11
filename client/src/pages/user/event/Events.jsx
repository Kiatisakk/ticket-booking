import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../../context/AuthContext';
import TableControls from '../../../components/TableControls';
import './Events.css';

const API_URL = 'http://localhost:4000/api';

function normalizeEvent(event) {
  const showtimes = event.Showtimes || (event.startDateTime ? [{
    StartDateTime: event.startDateTime,
    BasePrice: event.basePrice,
    Venue: event.venue ? { VenueName: event.venue } : undefined
  }] : []);

  return {
    id: event.EventID || event.id,
    title: event.Title || event.title || 'Untitled event',
    description: event.Description || event.description || '',
    category: event.Category?.CategoryName || event.category || '',
    showtimes,
    isPast: typeof event.isPast === 'boolean'
      ? event.isPast
      : showtimes.length > 0 && showtimes.every(showtime => new Date(showtime.StartDateTime) < new Date())
  };
}

function getNextShowtime(event, isPast) {
  if (!event.showtimes.length) return null;
  const now = new Date();
  const sorted = event.showtimes
    .slice()
    .sort((a, b) => new Date(a.StartDateTime) - new Date(b.StartDateTime));

  if (isPast) return sorted[sorted.length - 1];
  return sorted.find(showtime => new Date(showtime.StartDateTime) >= now) || sorted[0];
}

function Events() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalRows, setTotalRows] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    let active = true;

    async function fetchEvents() {
      setLoading(true);
      try {
        const response = await axios.get(`${API_URL}/events`, {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            pagination: 'offset',
            page,
            pageSize,
            search: searchTerm || undefined,
            category: categoryFilter !== 'all' ? categoryFilter : undefined
          }
        });
        const payload = response.data;
        const rows = Array.isArray(payload) ? payload : payload.data || [];
        if (!active) return;
        setEvents(rows.map(normalizeEvent));
        setTotalRows(Array.isArray(payload) ? rows.length : payload.total || 0);
        setTotalPages(Array.isArray(payload) ? 1 : payload.totalPages || 1);
      } catch (error) {
        console.error('Failed to fetch events:', error);
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchEvents();
    return () => {
      active = false;
    };
  }, [token, searchTerm, categoryFilter, page, pageSize]);

  const upcomingEvents = events.filter(event => !event.isPast);
  const pastEvents = events.filter(event => event.isPast);

  const updateSearch = (value) => {
    setSearchTerm(value);
    setPage(1);
  };

  const updateCategory = (value) => {
    setCategoryFilter(value);
    setPage(1);
  };

  const renderEventCard = (event, isPast) => {
    const nearest = getNextShowtime(event, isPast);

    return (
      <div
        key={event.id}
        className={`event-card${isPast ? ' event-card-past' : ''}`}
        onClick={() => navigate(`/events/${event.id}`)}
      >
        {isPast && <div className="event-past-ribbon">Past Event</div>}
        <div className="event-icon">
          {event.category === 'Movie' ? 'Movie' : event.category === 'Concert' ? 'Live' : event.category === 'Seminar' ? 'Talk' : 'Event'}
        </div>
        <h3>{event.title}</h3>
        {event.category && <div className="event-category">{event.category}</div>}
        <p className="event-description">{event.description.substring(0, 100)}...</p>

        {nearest && (
          <div className={`event-booking-deadline${isPast ? ' event-deadline-past' : ''}`}>
            {isPast ? 'Last showtime:' : 'Next showtime:'}{' '}
            <span className="deadline-item">
              {new Date(nearest.StartDateTime).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
              })}
            </span>
          </div>
        )}

        <button className={`event-button${isPast ? ' event-button-past' : ''}`} disabled={isPast}>
          {isPast ? 'Event Ended' : 'View Details'}
        </button>
      </div>
    );
  };

  if (loading) {
    return <div className="events-page"><div className="loading">Loading events...</div></div>;
  }

  return (
    <div className="events-page">
      <div className="events-hero">
        <div className="hero-glow"></div>
        <div className="events-hero-inner">
          <div className="hero-badge">THAILAND'S TICKET PLATFORM</div>
          <h1 className="hero-title">
            Your next <span className="hero-highlight">unforgettable</span><br />
            experience starts here
          </h1>
          <p className="hero-sub">
            Concerts, movies, seminars - buy tickets in seconds, no queues.
          </p>
        </div>
      </div>

      <div className="events-main">
        <div className="filters">
          <input
            type="text"
            placeholder="Search events..."
            value={searchTerm}
            onChange={(e) => updateSearch(e.target.value)}
            className="search-input"
          />

          <select
            value={categoryFilter}
            onChange={(e) => updateCategory(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Categories</option>
            <option value="Movie">Movie</option>
            <option value="Concert">Concert</option>
            <option value="Seminar">Seminar</option>
          </select>
        </div>

        <div className="events-section">
          <div className="events-section-header">
            <h2 className="events-section-title">Upcoming Events</h2>
            <span className="events-section-count">{upcomingEvents.length} events</span>
          </div>
          {upcomingEvents.length === 0 ? (
            <div className="no-events"><p>No upcoming events found</p></div>
          ) : (
            <div className="events-grid">
              {upcomingEvents.map(event => renderEventCard(event, false))}
            </div>
          )}
        </div>

        {pastEvents.length > 0 && (
          <div className="events-section events-section-past">
            <div className="events-section-header">
              <h2 className="events-section-title events-section-title-past">Past Events</h2>
              <span className="events-section-count">{pastEvents.length} events</span>
            </div>
            <div className="events-grid">
              {pastEvents.map(event => renderEventCard(event, true))}
            </div>
          </div>
        )}

        <TableControls
          page={page}
          pageSize={pageSize}
          totalRows={totalRows}
          totalPages={totalPages}
          onPageChange={setPage}
          onPageSizeChange={(nextSize) => {
            setPageSize(nextSize);
            setPage(1);
          }}
        />
      </div>
    </div>
  );
}

export default Events;
