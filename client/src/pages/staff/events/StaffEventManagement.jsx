import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './StaffEventManagement.css';

const StaffEventManagement = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const token = localStorage.getItem('staffToken');
      const response = await fetch('http://localhost:4000/api/staff/events', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch events');
      const data = await response.json();
      setEvents(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (eventId) => {
    if (!window.confirm('Are you sure you want to delete this event?')) return;

    try {
      const token = localStorage.getItem('staffToken');
      const response = await fetch(`http://localhost:4000/api/staff/events/${eventId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete event');
      }
      setEvents(events.filter(e => e.id !== eventId));
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="staff-event-management">
      <div className="event-management-header">
        <h2>My Events</h2>
        <button
          className="add-event-btn"
          onClick={() => navigate('/staff/events/create')}
        >
          + Create Event
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {events.length === 0 ? (
        <div className="no-events-message">
          <p>No events yet. Create your first event!</p>
        </div>
      ) : (
        <div className="events-table-container">
          <table className="events-table">
            <thead>
              <tr>
                <th>Event Name</th>
                <th>Category</th>
                <th>Venue</th>
                <th>Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td className="event-title-cell">{event.title}</td>
                  <td>{event.category}</td>
                  <td>{event.venue}</td>
                  <td>{event.startDateTime ? new Date(event.startDateTime).toLocaleDateString('th-TH') : '-'}</td>
                  <td>
                    <span className={`status-badge ${event.isPast ? 'past' : 'upcoming'}`}>
                      {event.isPast ? 'Past' : 'Upcoming'}
                    </span>
                  </td>
                  <td className="action-buttons">
                    <button
                      className="btn-view"
                      onClick={() => navigate(`/staff/events/${event.id}`)}
                    >
                      View
                    </button>
                    <button
                      className="btn-edit"
                      onClick={() => navigate(`/staff/events/${event.id}/edit`)}
                    >
                      Edit
                    </button>
                    {event.hasBookings ? (
                      <button
                        className="btn-delete btn-delete-disabled"
                        disabled
                        title="Cannot delete — has bookings"
                      >
                        Delete
                      </button>
                    ) : (
                      <button
                        className="btn-delete"
                        onClick={() => handleDelete(event.id)}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default StaffEventManagement;
