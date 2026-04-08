import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './EventDetails.css';

const API_URL = 'http://localhost:4000/api';

function EventDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEventDetails();
  }, [id]);

  const fetchEventDetails = async () => {
    try {
      const response = await axios.get(`${API_URL}/events/${id}`);
      setEvent(response.data);
    } catch (error) {
      console.error('Failed to fetch event:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShowtimeSelect = (showtime) => {
    navigate(`/seats/${showtime.ShowtimeID}`, { state: { showtime, event } });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return <div className="loading">Loading event details...</div>;
  }

  if (!event) {
    return <div className="error">Event not found</div>;
  }

  return (
    <div className="event-details-page">
      <div className="event-details-header">
        <button onClick={() => navigate('/events')} className="back-button">
          ← Back to Events
        </button>
        <h1>{event.Title}</h1>
        <p className="category-badge">{event.Category?.CategoryName}</p>
      </div>

      <div className="event-info">
        <div className="description-section">
          <h2>About This Event</h2>
          <p>{event.Description}</p>
        </div>

        <div className="showtimes-section">
          <h2>📅 Available Showtimes</h2>
          {event.Showtimes && event.Showtimes.length > 0 ? (
            <div className="showtimes-list">
              {event.Showtimes.map(showtime => (
                <div key={showtime.ShowtimeID} className="showtime-card">
                  <div className="showtime-info">
                    <p className="showtime-date">{formatDate(showtime.StartDateTime)}</p>
                    <p className="showtime-venue">📍 {showtime.Venue?.VenueName}</p>
                    <p className="showtime-price">💰 Starting at ฿{showtime.BasePrice}</p>
                  </div>
                  <button
                    onClick={() => handleShowtimeSelect(showtime)}
                    className="select-showtime-btn"
                  >
                    Select Seats
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="no-showtimes">No showtimes available yet</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default EventDetails;
