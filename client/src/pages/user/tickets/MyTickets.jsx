import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';
import TableControls from '../../../components/TableControls';
import { normalizePaginatedPayload } from '../../../utils/tableView';
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
  const [activeTicketIndex, setActiveTicketIndex] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalRows, setTotalRows] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [cursor, setCursor] = useState(null);
  const [cursorDirection, setCursorDirection] = useState('next');
  const [cursorMeta, setCursorMeta] = useState({ hasNextPage: false, hasPrevPage: false, nextCursor: null, prevCursor: null });

  useEffect(() => {
    fetchBookings();
  }, [activeTab, page, pageSize, cursor, cursorDirection]);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/bookings/my`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          pagination: 'cursor',
          page,
          pageSize,
          cursor: cursor || undefined,
          direction: cursorDirection,
          status: activeTab === 'all' ? undefined : activeTab === 'upcoming' ? 'pending' : activeTab
        }
      });
      const payload = normalizePaginatedPayload(response.data);
      setBookings(payload.rows);
      setTotalRows(payload.totalRows);
      setTotalPages(payload.totalPages);
      setCursorMeta(payload.pagination?.type === 'cursor'
        ? payload.pagination
        : { hasNextPage: false, hasPrevPage: false, nextCursor: null, prevCursor: null });
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

  const expireBookingFromList = async (bookingId) => {
    setCancellingId(bookingId);
    try {
      await axios.post(
        `${API_URL}/bookings/${bookingId}/expire`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setBookings(prev =>
        prev.map(b =>
          b.BookingID === bookingId ? { ...b, StatusID: 3, Status: { StatusName: 'Cancelled' } } : b
        )
      );
      setMessage('Payment time expired. The booking was cancelled and seats were released.');
    } catch (error) {
      console.error('Failed to expire booking:', error);
      setMessage('This booking has expired. Refreshing your booking status...');
      fetchBookings();
    } finally {
      setCancellingId(null);
    }
  };

  const handlePayNow = (booking) => {
    const expireTime = new Date(booking.ExpiresAt).getTime();
    const now = new Date().getTime();

    if (now > expireTime) {
      expireBookingFromList(booking.BookingID);
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

  const getSeatTypeClass = (typeName = '') => {
    const normalized = typeName.toLowerCase().replace(/\s+/g, '-');
    if (normalized.includes('vip')) return 'seat-type-vip';
    if (normalized.includes('sofa')) return 'seat-type-sofa-bed';
    return 'seat-type-standard';
  };

  const sortSeats = (seatList) => [...seatList].sort((a, b) => {
    const rowCompare = String(a.rowLabel || '').localeCompare(String(b.rowLabel || ''), undefined, {
      numeric: true,
      sensitivity: 'base'
    });
    if (rowCompare !== 0) return rowCompare;

    return String(a.seatNumber || '').localeCompare(String(b.seatNumber || ''), undefined, {
      numeric: true,
      sensitivity: 'base'
    });
  });

  const filteredBookings = bookings;

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
          <button className={`ftab ${activeTab === 'all' ? 'active' : ''}`} onClick={() => { setActiveTab('all'); setPage(1); setCursor(null); setCursorDirection('next'); }}>All Bookings</button>
          <button className={`ftab ${activeTab === 'upcoming' ? 'active' : ''}`} onClick={() => { setActiveTab('upcoming'); setPage(1); setCursor(null); setCursorDirection('next'); }}>Pending</button>
          <button className={`ftab ${activeTab === 'completed' ? 'active' : ''}`} onClick={() => { setActiveTab('completed'); setPage(1); setCursor(null); setCursorDirection('next'); }}>Completed</button>
          <button className={`ftab ${activeTab === 'cancelled' ? 'active' : ''}`} onClick={() => { setActiveTab('cancelled'); setPage(1); setCursor(null); setCursorDirection('next'); }}>Cancelled</button>
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
              const venueName = showtime?.Venue?.VenueName || 'Venue TBD';
              const seats = booking.BookingDetails?.map(d => ({
                label: `${d.Seat?.RowLabel}${d.Seat?.SeatNumber}`,
                rowLabel: d.Seat?.RowLabel || '',
                seatNumber: d.Seat?.SeatNumber || '',
                typeName: d.Seat?.SeatType?.TypeName || 'Standard'
              })) || [];
              const sortedSeats = sortSeats(seats);
              const theme = getStatusTheme(booking.StatusID, booking.Status);
              const emojiInfo = getEventEmojiInfo(eventInfo.EventID);
              const ticketItems = (booking.BookingDetails || [])
                .filter(detail => detail.Ticket?.TicketNo)
                .map(detail => ({
                  ticketNo: detail.Ticket.TicketNo,
                  seat: {
                    label: `${detail.Seat?.RowLabel || ''}${detail.Seat?.SeatNumber || ''}`,
                    rowLabel: detail.Seat?.RowLabel || '',
                    seatNumber: detail.Seat?.SeatNumber || '',
                    typeName: detail.Seat?.SeatType?.TypeName || 'Standard'
                  }
                }));
              const sortedTicketItems = [...ticketItems].sort((a, b) => {
                const [seatA, seatB] = [a.seat, b.seat];
                const rowCompare = String(seatA.rowLabel || '').localeCompare(String(seatB.rowLabel || ''), undefined, {
                  numeric: true,
                  sensitivity: 'base'
                });
                if (rowCompare !== 0) return rowCompare;
                return String(seatA.seatNumber || '').localeCompare(String(seatB.seatNumber || ''), undefined, {
                  numeric: true,
                  sensitivity: 'base'
                });
              });
              const primaryTicket = sortedTicketItems[0];
              const ticketIdString = primaryTicket?.ticketNo || `BK-${booking.BookingID}`;

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
                          {venueName}
                        </div>
                      </div>
                      <div className="ticket-booking-row">
                        <span className="booking-id">BK-{booking.BookingID}</span>
                        <div className="seat-chips">
                          {sortedSeats.map((seat, i) => (
                            <span key={i} className={`seat-chip ${getSeatTypeClass(seat.typeName)}`}>
                              <span className="seat-dot" />
                              {seat.label}
                              <span className="seat-type-label">{seat.typeName}</span>
                            </span>
                          ))}
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
                    {theme.isPending ? (
                      <div style={{ color: '#f59e0b', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', padding: '12px' }}>
                        Payment Required
                      </div>
                    ) : theme.css !== 'cancelled' ? (
                      <>
                        <button
                          className="btn-view"
                          onClick={() => {
                            setActiveTicketIndex(0);
                            setSelectedTicket({
                              name: eventInfo.Title,
                              emoji: emojiInfo.char,
                              date: showtime ? formatDate(showtime.StartDateTime) : '',
                              location: venueName,
                              ticketNo: ticketIdString,
                              tickets: sortedTicketItems,
                              seats: sortedSeats
                            });
                          }}
                        >
                          View Ticket
                        </button>
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
              {(() => {
                const ticketOptions = selectedTicket.tickets?.length
                  ? selectedTicket.tickets
                  : selectedTicket.seats.map(s => ({ seat: s, ticketNo: selectedTicket.ticketNo }));
                const active = ticketOptions[Math.min(activeTicketIndex, ticketOptions.length - 1)] || ticketOptions[0];

                return (
                  <>
                    {ticketOptions.length > 1 && (
                      <div className="modal-ticket-switcher">
                        {ticketOptions.map((item, index) => (
                          <button
                            key={item.ticketNo}
                            type="button"
                            className={`modal-ticket-tab ${index === activeTicketIndex ? 'active' : ''}`}
                            onClick={() => setActiveTicketIndex(index)}
                          >
                            <span>{item.seat.label}</span>
                            <strong>{item.ticketNo}</strong>
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="modal-qr-box" style={{ background: '#fff', padding: '12px', borderRadius: '12px', display: 'inline-block', margin: '0 auto' }}>
                      <QRCodeSVG value={active.ticketNo} size={160} />
                    </div>
                    <div className="modal-ticket-no">{active.ticketNo}</div>
                    <div className={`modal-seat-chip ${getSeatTypeClass(active.seat.typeName)}`}>
                      <span className="seat-dot" />
                      {active.seat.label}
                      <span className="seat-type-label">{active.seat.typeName}</span>
                    </div>
                  </>
                );
              })()}
              <div className="modal-ticket-sub">Ticket No. · Present the selected QR at the venue entrance</div>
            </div>
            <button className="modal-close" onClick={() => setSelectedTicket(null)}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default MyTickets;
