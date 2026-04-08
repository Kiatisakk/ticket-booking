import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Events.css';

const API_URL = 'http://localhost:4000/api';

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
    return <div className="loading">Loading events...</div>;
  }

  return (
    <div className="events-page">
      <div className="events-header">
        <h1>🎬 Browse Events</h1>
        <p>Find and book your favorite events</p>
      </div>

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

      {filteredEvents.length === 0 ? (
        <div className="no-events">
          <p>No events found</p>
        </div>
      ) : (
        <div className="events-grid">
          {filteredEvents.map(event => (
            <div
              key={event.EventID}
              className="event-card"
              onClick={() => navigate(`/events/${event.EventID}`)}
            >
              <div className="event-icon">
                {event.Category?.CategoryName === 'Movie' && '🎬'}
                {event.Category?.CategoryName === 'Concert' && '🎵'}
                {event.Category?.CategoryName === 'Seminar' && '📚'}
              </div>
              <h3>{event.Title}</h3>
              <p className="event-category">{event.Category?.CategoryName}</p>
              <p className="event-description">
                {event.Description?.substring(0, 100)}...
              </p>
              <button className="event-button">View Details</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Events;
