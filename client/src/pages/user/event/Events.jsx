import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../../context/AuthContext';
import TableControls from '../../../components/TableControls';
import { normalizePaginatedPayload } from '../../../utils/tableView';
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
  const [hasLoaded, setHasLoaded] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusView, setStatusView] = useState('upcoming');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalRows, setTotalRows] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [cursor, setCursor] = useState(null);
  const [cursorDirection, setCursorDirection] = useState('next');
  const [cursorMeta, setCursorMeta] = useState({ hasNextPage: false, hasPrevPage: false, nextCursor: null, prevCursor: null });

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSearchTerm(searchInput.trim());
      setPage(1);
      setCursor(null);
      setCursorDirection('next');
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    let active = true;

    async function fetchEvents() {
      setLoading(true);
      try {
        const response = await axios.get(`${API_URL}/events`, {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            pagination: 'cursor',
            page,
            pageSize,
            cursor: cursor || undefined,
            direction: cursorDirection,
            status: statusView,
            search: searchTerm || undefined,
            category: categoryFilter !== 'all' ? categoryFilter : undefined
          }
        });
        const payload = normalizePaginatedPayload(response.data);
        if (!active) return;
        setEvents(payload.rows.map(normalizeEvent));
        setTotalRows(payload.totalRows);
        setTotalPages(payload.totalPages);
        setCursorMeta(payload.pagination?.type === 'cursor'
          ? payload.pagination
          : { hasNextPage: false, hasPrevPage: false, nextCursor: null, prevCursor: null });
      } catch (error) {
        console.error('Failed to fetch events:', error);
      } finally {
        if (active) {
          setHasLoaded(true);
          setLoading(false);
        }
      }
    }

    fetchEvents();
    return () => {
      active = false;
    };
  }, [token, searchTerm, categoryFilter, statusView, page, pageSize, cursor, cursorDirection]);

  const isPastView = statusView === 'past';
  const sectionTitle = isPastView ? 'Ended Events' : 'Upcoming Events';
  const emptyMessage = isPastView ? 'No ended events found' : 'No upcoming events found';

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
          {
            event.category === 'Movie' ? '🎬' :
            event.category === 'Concert' ? '🎵' :
            event.category === 'Seminar' ? '📚' : '🎫'
          }
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
          {isPast ? 'Event Ended' : 'View Details →'}
        </button>
      </div>
    );
  };

  if (loading && !hasLoaded) {
    return <div className="events-page"><div className="loading">Loading events...</div></div>;
  }

  return (
    <div className="events-page">
      <div className="events-hero">
        <div className="hero-glow"></div>
        <div className="events-hero-inner">
          <div className="hero-badge">
            <span role="img" aria-label="ticket">🎟</span> THAILAND'S TICKET PLATFORM
          </div>
          <h1 className="hero-title">
            Your next <span className="hero-highlight">unforgettable</span><br />
            experience starts here
          </h1>
          <p className="hero-sub">
            Concerts, movies, seminars — buy tickets in seconds, no queues.
          </p>
        </div>
      </div>

      <div className="events-main">
        <div className="events-view-tabs">
          <button
            type="button"
            className={`events-view-tab${statusView === 'upcoming' ? ' active' : ''}`}
            onClick={() => {
              setStatusView('upcoming');
              setPage(1);
              setCursor(null);
              setCursorDirection('next');
            }}
          >
            Upcoming
          </button>
          <button
            type="button"
            className={`events-view-tab${statusView === 'past' ? ' active' : ''}`}
            onClick={() => {
              setStatusView('past');
              setPage(1);
              setCursor(null);
              setCursorDirection('next');
            }}
          >
            Ended
          </button>
        </div>

        <div className="filters">
          <input
            type="text"
            placeholder="🔍 Search events..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="search-input"
          />

          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
              setCursor(null);
              setCursorDirection('next');
            }}
            className="filter-select"
          >
            <option value="all">All Categories</option>
            <option value="Movie">🎬 Movie</option>
            <option value="Concert">🎵 Concert</option>
            <option value="Seminar">📚 Seminar</option>
          </select>
        </div>

        <div className="events-section">
          <div className="events-section-header">
            <h2 className={`events-section-title${isPastView ? ' events-section-title-past' : ''}`}>
              {sectionTitle}
            </h2>
            <span className="events-section-count">{totalRows} events</span>
          </div>
          {loading && <div className="events-inline-loading">Refreshing events...</div>}
          {events.length === 0 ? (
            <div className="no-events"><p>{emptyMessage}</p></div>
          ) : (
            <div className="events-grid">
              {events.map(event => renderEventCard(event, isPastView || event.isPast))}
            </div>
          )}
        </div>

        <TableControls
          mode="cursor"
          page={page}
          pageSize={pageSize}
          totalRows={totalRows}
          totalPages={totalPages}
          hasPrevPage={cursorMeta.hasPrevPage}
          hasNextPage={cursorMeta.hasNextPage}
          onPrev={() => {
            setCursor(cursorMeta.prevCursor);
            setCursorDirection('prev');
            setPage(current => Math.max(current - 1, 1));
          }}
          onNext={() => {
            setCursor(cursorMeta.nextCursor);
            setCursorDirection('next');
            setPage(current => current + 1);
          }}
          onPageChange={(nextPage) => {
            setPage(nextPage);
            setCursor(null);
            setCursorDirection('next');
          }}
          onPageSizeChange={(nextSize) => {
            setPageSize(nextSize);
            setPage(1);
            setCursor(null);
            setCursorDirection('next');
          }}
        />
      </div>
    </div>
  );
}

export default Events;
