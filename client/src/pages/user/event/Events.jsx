import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Events.css';

const API_URL = 'http://localhost:4000/api';

function isEventPast(event) {
  if (!event.Showtimes || event.Showtimes.length === 0) return false;
  const now = new Date();
  // Event is past if ALL its showtimes are in the past
  return event.Showtimes.every(s => new Date(s.StartDateTime) < now);
}

function Events() {
  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const navigate = useNavigate();

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const response = await axios.get(`${API_URL}/events`);
      setEvents(response.data);
      setFilteredEvents(response.data);
    } catch (error) {
      console.error('Failed to fetch events:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let filtered = events;

    if (categoryFilter !== 'all') {
      filtered = filtered.filter(e => e.Category?.CategoryName === categoryFilter);
    }

    if (searchTerm) {
      filtered = filtered.filter(e =>
        e.Title?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredEvents(filtered);
  }, [searchTerm, categoryFilter, events]);

  if (loading) {
    return <div className="events-page"><div className="loading">Loading events...</div></div>;
  }

  const upcomingEvents = filteredEvents.filter(e => !isEventPast(e));
  const pastEvents     = filteredEvents.filter(e => isEventPast(e));

  const renderEventCard = (event, isPast) => (
    <div
      key={event.EventID}
      className={`event-card${isPast ? ' event-card-past' : ''}`}
      onClick={() => navigate(`/events/${event.EventID}`)}
    >
      {isPast && <div className="event-past-ribbon">Past Event</div>}
      <div className="event-icon">
        {
          event.Category?.CategoryName === 'Movie' ? '🎬' :
          event.Category?.CategoryName === 'Concert' ? '🎵' :
          event.Category?.CategoryName === 'Seminar' ? '📚' : '🎫'
        }
      </div>
      <h3>{event.Title}</h3>
      {event.Category?.CategoryName && (
        <div className="event-category">
          {event.Category.CategoryName}
        </div>
      )}
      <p className="event-description">
        {event.Description?.substring(0, 100)}...
      </p>

      {event.Showtimes?.length > 0 && (() => {
        const nearest = event.Showtimes
          .slice()
          .sort((a, b) => new Date(a.StartDateTime) - new Date(b.StartDateTime))[0];
        return (
          <div className={`event-booking-deadline${isPast ? ' event-deadline-past' : ''}`}>
            {isPast ? '📅 Was on:' : '⏰ Book by:'}{' '}
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
        );
      })()}

      <button className={`event-button${isPast ? ' event-button-past' : ''}`} disabled={isPast}>
        {isPast ? 'Event Ended' : 'View Details →'}
      </button>
    </div>
  );

  return (
    <div className="events-page">
      {/* Hero Banner Style adapted from your HTML */}
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
        {/* Filters */}
        <div className="filters">
          <input
            type="text"
            placeholder="🔍 Search events..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Categories</option>
            <option value="Movie">🎬 Movie</option>
            <option value="Concert">🎵 Concert</option>
            <option value="Seminar">📚 Seminar</option>
          </select>
        </div>

        {/* Upcoming Events */}
        <div className="events-section">
          <div className="events-section-header">
            <h2 className="events-section-title">Upcoming Events</h2>
            <span className="events-section-count">{upcomingEvents.length} events</span>
          </div>
          {upcomingEvents.length === 0 ? (
            <div className="no-events">
              <p>No upcoming events found</p>
            </div>
          ) : (
            <div className="events-grid">
              {upcomingEvents.map(event => renderEventCard(event, false))}
            </div>
          )}
        </div>

        {/* Past Events */}
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
      </div>
    </div>
  );
}

export default Events;