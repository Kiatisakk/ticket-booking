import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './MyTickets.css';

const API_URL = 'http://localhost:4000/api';

function MyTickets() {
  const { token } = useAuth();
  const location = useLocation();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(location.state?.message || '');
  const [cancellingId, setCancellingId] = useState(null);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const response = await axios.get(`${API_URL}/bookings/my`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBookings(response.data);
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (bookingId) => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) {
      return;
    }

    setCancellingId(bookingId);
    try {
      await axios.post(
        `${API_URL}/bookings/${bookingId}/cancel`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Update booking status in list
      setBookings(prev =>
        prev.map(b =>
          b.BookingID === bookingId ? { ...b, StatusID: 3, Status: { StatusName: 'Cancelled' } } : b
        )
      );
    } catch (error) {
      alert('Failed to cancel booking');
    } finally {
      setCancellingId(null);
    }
  };

  const getStatusColor = (statusId) => {
    switch (statusId) {
      case 1: return 'pending';
      case 2: return 'completed';
      case 3: return 'cancelled';
      default: return '';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return <div className="loading">Loading your tickets...</div>;
  }

  return (
    <div className="my-tickets-page">
      <div className="page-header">
        <h1>🎫 My Tickets</h1>
        <p>View and manage your bookings</p>
      </div>

      {message && (
        <div className="success-message">
          {message}
          <button onClick={() => setMessage('')} className="close-message">✕</button>
        </div>
      )}

      {bookings.length === 0 ? (
        <div className="no-bookings">
          <p>🎫 No bookings yet</p>
          <p>Browse events and book your favorite shows!</p>
        </div>
      ) : (
        <div className="bookings-list">
          {bookings.map(booking => {
            const showtime = booking.BookingDetails?.[0]?.Showtime;
            const seats = booking.BookingDetails?.map(d => ({
              row: d.Seat?.RowLabel,
              number: d.Seat?.SeatNumber,
              type: d.Seat?.SeatType?.TypeName
            }));

            return (
              <div key={booking.BookingID} className="booking-card">
                <div className="booking-header">
                  <h3>Booking #{booking.BookingID}</h3>
                  <span className={`status-badge ${getStatusColor(booking.StatusID)}`}>
                    {booking.Status?.StatusName || 'Unknown'}
                  </span>
                </div>

                <div className="booking-details">
                  {showtime && (
                    <>
                      <p className="event-name">🎬 {showtime.Event?.Title}</p>
                      <p className="booking-date">📅 {formatDate(showtime.StartDateTime)}</p>
                    </>
                  )}
                  <p className="booking-seats">
                    💺 {seats?.map(s => `${s.type} (${s.row}${s.number})`).join(', ')}
                  </p>
                  <p className="booking-total">💰 Total: ฿{Number(booking.TotalAmount || 0).toFixed(2)}</p>
                </div>

                {booking.StatusID === 1 && (
                  <button
                    onClick={() => handleCancel(booking.BookingID)}
                    disabled={cancellingId === booking.BookingID}
                    className="cancel-button"
                  >
                    {cancellingId === booking.BookingID ? 'Cancelling...' : 'Cancel Booking'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default MyTickets;
