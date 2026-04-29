import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';
import './MyTickets.css';

const API_URL = 'http://localhost:4000/api';

function MyTickets() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const location = useLocation();
  
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(location.state?.message || '');
  const [cancellingId, setCancellingId] = useState(null);
  
  // UI States
  const [activeTab, setActiveTab] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState(null);

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
      
      setBookings(prev =>
        prev.map(b =>
          b.BookingID === bookingId ? { ...b, StatusID: 3, Status: { StatusName: 'Cancelled' } } : b
        )
      );
      setMessage('Booking cancelled successfully.');
    } catch (error) {
      alert('Failed to cancel booking');
    } finally {
      setCancellingId(null);
    }
  };

  const handlePayNow = (booking) => {
    const createdTime = new Date(booking.BookingDate || booking.CreatedAt).getTime();
    const expireTime = createdTime + (5 * 60 * 1000); 
    const now = new Date().getTime();

    if (now > expireTime) {
      alert('หมดเวลาชำระเงินสำหรับรายการนี้แล้ว ระบบได้ยกเลิกการจองของคุณ');
      handleCancel(booking.BookingID);
      return;
    }

    navigate('/payment', { 
      state: { 
        bookingId: booking.BookingID,
        totalAmount: booking.TotalAmount,
        expireTime: expireTime
      } 
    });
  };

  const getStatusTheme = (statusId, statusObj) => {
    const statusName = (statusObj?.StatusName || '').toLowerCase();
    
    if (statusId === 1 || statusName.includes('pending')) {
      return { css: 'upcoming', label: '🟣 Pending', stripe: 'stripe-upcoming', isPending: true };
    }
    if (statusId === 2 || statusName.includes('complete') || statusName.includes('paid')) {
      return { css: 'completed', label: '✅ Completed', stripe: 'stripe-past', isPending: false };
    }
    if (statusId === 3 || statusName.includes('cancel')) {
      return { css: 'cancelled', label: '❌ Cancelled', stripe: 'stripe-cancelled', isPending: false };
    }
    
    return { css: 'past', label: `⚪ ${statusObj?.StatusName || 'Unknown'}`, stripe: 'stripe-past', isPending: false };
  };

  const getEventEmojiInfo = (eventId) => {
    const emojis = [
      { char: '🎤', bg: 'linear-gradient(135deg,#4c1d95,#7c3aed)' },
      { char: '🎶', bg: 'linear-gradient(135deg,#3b0764,#9333ea)' },
      { char: '🕷️', bg: 'linear-gradient(135deg,#1e3a5f,#1d4ed8)' },
      { char: '🎬', bg: 'linear-gradient(135deg,#064e3b,#059669)' }
    ];
    return emojis[(eventId || 0) % emojis.length];
  };

  const formatDate = (dateString) => {
    const d = new Date(dateString);
    const datePart = d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
    const timePart = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    return `${datePart} · ${timePart}`;
  };

  const filteredBookings = bookings.filter(b => {
    if (activeTab === 'all') return true;
    const theme = getStatusTheme(b.StatusID, b.Status);
    if (activeTab === 'upcoming' && theme.isPending) return true;
    if (activeTab === 'completed' && theme.css === 'completed') return true;
    if (activeTab === 'cancelled' && theme.css === 'cancelled') return true;
    return false;
  });

  const totalTicketsCount = bookings.reduce((sum, b) => sum + (b.BookingDetails?.length || 0), 0);

  if (loading) {
    return <div className="my-tickets-page"><div className="loading">Loading your tickets...</div></div>;
  }

  return (
    <div className="my-tickets-page">
      <div className="tickets-content-wrapper">
        {message && (
          <div className="success-message">
            {message}
            <button onClick={() => setMessage('')} className="close-message">✕</button>
          </div>
        )}

        <div className="page-header">
          <div className="page-title">My Tickets</div>
          <div className="page-sub">{bookings.length} bookings · {totalTicketsCount} tickets total</div>
        </div>

        <div className="filter-tabs">
          <button className={`ftab ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>All Bookings</button>
          <button className={`ftab ${activeTab === 'upcoming' ? 'active' : ''}`} onClick={() => setActiveTab('upcoming')}>Pending</button>
          <button className={`ftab ${activeTab === 'completed' ? 'active' : ''}`} onClick={() => setActiveTab('completed')}>Completed</button>
          <button className={`ftab ${activeTab === 'cancelled' ? 'active' : ''}`} onClick={() => setActiveTab('cancelled')}>Cancelled</button>
        </div>

        {filteredBookings.length === 0 ? (
          <div className="empty-state">
            <div className="empty-emoji">🎫</div>
            <div className="empty-title">No bookings found</div>
            <div className="empty-sub">You don't have any tickets in this category yet.</div>
            <button className="btn-browse" onClick={() => navigate('/')}>Browse Events</button>
          </div>
        ) : (
          <div className="ticket-list">
            {filteredBookings.map(booking => {
              const showtime = booking.BookingDetails?.[0]?.Showtime;
              const eventInfo = showtime?.Event || {};
              const seats = booking.BookingDetails?.map(d => `${d.Seat?.RowLabel}${d.Seat?.SeatNumber}`) || [];
              const theme = getStatusTheme(booking.StatusID, booking.Status);
              const emojiInfo = getEventEmojiInfo(eventInfo.EventID);
              const ticketIdString = `TKT-${10000 + booking.BookingID}`;

              return (
                <div key={booking.BookingID} className="ticket-card">
                  <div className={`ticket-stripe ${theme.stripe}`}></div>
                  <div className="ticket-body">
                    <div className="ticket-emoji" style={{ background: emojiInfo.bg }}>
                      {emojiInfo.char}
                    </div>
                    <div className="ticket-info">
                      <div className="ticket-status-row">
                        <span className={`status-badge status-${theme.css}`}>{theme.label}</span>
                      </div>
                      <div className="ticket-title">{eventInfo.Title || 'Unknown Event'}</div>
                      <div className="ticket-meta">
                        <div className="ticket-meta-item">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg> 
                          {showtime ? formatDate(showtime.StartDateTime) : 'Date TBD'}
                        </div>
                        <div className="ticket-meta-item">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg> 
                          {eventInfo.Location || 'Location TBD'}
                        </div>
                      </div>
                      <div className="ticket-booking-row">
                        <span className="booking-id">BK-{booking.BookingID}</span>
                        <div className="seat-chips">
                          {seats.map((seat, i) => <span key={i} className="seat-chip">{seat}</span>)}
                        </div>
                        <span style={{fontSize: '13px', fontWeight: '700', color: 'var(--text)'}}>
                          ฿ {Number(booking.TotalAmount || 0).toLocaleString()}
                        </span>
                        
                        {theme.isPending && (
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button 
                              style={{ padding: '6px 12px', background: '#3b82f6', color: 'white', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                              onClick={() => handlePayNow(booking)}
                            >
                              Pay Now
                            </button>
                            <button 
                              className="btn-cancel" 
                              onClick={() => handleCancel(booking.BookingID)}
                              disabled={cancellingId === booking.BookingID}
                            >
                              {cancellingId === booking.BookingID ? 'Cancelling...' : 'Cancel'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="ticket-qr-panel">
                    {theme.css !== 'cancelled' ? (
                      <>
                        <div className="qr-mini" style={{ background: '#fff', padding: '4px', borderRadius: '4px', display: 'inline-block', opacity: theme.isPending ? 0.3 : 1 }}>
                          <QRCodeSVG value={ticketIdString} size={72} />
                        </div>
                        <div className="qr-ticket-id">{ticketIdString}</div>
                        {theme.isPending && <div style={{ fontSize: '11px', color: '#f59e0b', marginTop: '4px' }}>Payment Required</div>}
                        {!theme.isPending && (
                          <button 
                            className="btn-view" 
                            onClick={() => setSelectedTicket({
                              name: eventInfo.Title,
                              emoji: emojiInfo.char,
                              date: showtime ? formatDate(showtime.StartDateTime) : '',
                              location: eventInfo.Location,
                              ticketNo: ticketIdString,
                              seats: seats
                            })}
                          >
                            View Ticket
                          </button>
                        )}
                      </>
                    ) : (
                      <div style={{ color: '#ef4444', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                        Cancelled
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* TICKET VIEW MODAL */}
      <div className={`modal-overlay ${selectedTicket ? 'open' : ''}`} onClick={(e) => { if(e.target.className.includes('modal-overlay')) setSelectedTicket(null); }}>
        {selectedTicket && (
          <div className="ticket-modal">
            <div className="modal-header-band">
              <div className="modal-event-emoji">{selectedTicket.emoji}</div>
              <div className="modal-event-name">{selectedTicket.name}</div>
              <div className="modal-event-meta">
                {selectedTicket.date} <br/> {selectedTicket.location}
              </div>
            </div>
            <div className="modal-qr-section">
              <div className="modal-qr-box" style={{ background: '#fff', padding: '12px', borderRadius: '12px', display: 'inline-block', margin: '0 auto' }}>
                <QRCodeSVG value={selectedTicket.ticketNo} size={160} />
              </div>
              <div className="modal-ticket-no">{selectedTicket.ticketNo}</div>
              <div className="modal-ticket-sub">Present this QR at the venue entrance</div>
              <div className="modal-seats">
                {selectedTicket.seats.map((s, i) => (
                  <div key={i} className="modal-seat-chip">{s}</div>
                ))}
              </div>
            </div>
            <button className="modal-close" onClick={() => setSelectedTicket(null)}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default MyTickets;