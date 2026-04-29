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
  
  const [ticketTiers, setTicketTiers] = useState([]);
  const [loadingPrices, setLoadingPrices] = useState(false);

  useEffect(() => {
    fetchEventDetails();
  }, [id]);

  useEffect(() => {
    if (event?.Showtimes && event.Showtimes.length > 0) {
      fetchTicketPrices(event.Showtimes[0].ShowtimeID, event.Showtimes[0].BasePrice);
    }
  }, [event]);

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

  const fetchTicketPrices = async (showtimeId, showtimeBasePrice) => {
    setLoadingPrices(true);
    try {
      const response = await axios.get(`${API_URL}/showtimes/${showtimeId}`);
      const seats = response.data.Venue?.Seats || [];
      const basePrice = Number(showtimeBasePrice) || 0;
      
      const tiersMap = new Map();

      seats.forEach(seat => {
        const typeName = seat.SeatType?.TypeName || seat.SeatType?.Name || 'Standard';
        const modifier = Number(seat.SeatType?.PriceModifier || seat.SeatType?.Price) || 1;
        const finalPrice = basePrice * modifier;

        if (!tiersMap.has(typeName)) {
          tiersMap.set(typeName, {
            name: typeName,
            price: finalPrice,
            description: seat.SeatType?.Description || `Zone: ${typeName}`
          });
        }
      });

      const tiersArray = Array.from(tiersMap.values()).sort((a, b) => b.price - a.price);
      setTicketTiers(tiersArray);

    } catch (error) {
      console.error('Failed to fetch ticket prices:', error);
    } finally {
      setLoadingPrices(false);
    }
  };

  const handleProceedToSeats = () => {
    if (event?.Showtimes && event.Showtimes.length > 0) {
      const firstShowtimeId = event.Showtimes[0].ShowtimeID;
      navigate(`/seats/${firstShowtimeId}`, { state: { event } });
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const getCategoryIcon = (categoryName) => {
    if (!categoryName) return { icon: '🎪', bg: 'linear-gradient(135deg, #1e293b, #334155)' };
    const name = categoryName.toLowerCase();
    if (name.includes('concert') || name.includes('music')) return { icon: '🎤', bg: 'linear-gradient(135deg, #4c1d95, #7c3aed)' };
    if (name.includes('movie') || name.includes('film') || name.includes('cinema')) return { icon: '🎬', bg: 'linear-gradient(135deg, #064e3b, #059669)' };
    if (name.includes('sport')) return { icon: '⚽', bg: 'linear-gradient(135deg, #7f1d1d, #dc2626)' };
    if (name.includes('theater') || name.includes('play') || name.includes('show')) return { icon: '🎭', bg: 'linear-gradient(135deg, #831843, #db2777)' };
    if (name.includes('exhibition') || name.includes('art')) return { icon: '🎨', bg: 'linear-gradient(135deg, #701a75, #c026d3)' };
    return { icon: '🎪', bg: 'linear-gradient(135deg, #1e3a5f, #1d4ed8)' };
  };

  if (loading) {
    return <div className="event-details-container"><div className="loading-state">Loading event details...</div></div>;
  }

  if (!event) {
    return <div className="event-details-container"><div className="error-state">Event not found</div></div>;
  }

  const categoryUI = getCategoryIcon(event.Category?.CategoryName);

  return (
    <div className="event-details-container">
      {/* EVENT HERO */}
      <div className="event-hero">
        <div className="hero-glow"></div>
        <div className="event-hero-inner">
          <div className="event-poster" style={{ background: categoryUI.bg }}>
            {categoryUI.icon}
          </div>
          <div className="event-hero-info">
            <div className="hero-cat-badge">{categoryUI.icon} {event.Category?.CategoryName || 'Event'}</div>
            <h1 className="hero-title">{event.Title}</h1>
            <div className="hero-meta">
              <span className="meta-item">📅 {event.Showtimes?.length > 0 ? formatDate(event.Showtimes[0].StartDateTime) : 'TBA'}</span>
              <span className="meta-item">📍 {event.Showtimes?.[0]?.Venue?.VenueName || 'Venue TBA'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN LAYOUT */}
      <div className="main-layout">
        <div className="layout-grid">
          
          <div className="content-column">
            
            {/* About This Event */}
            <div className="section-card">
              <div className="sc-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" />
                  <polyline points="13 2 13 9 20 9" />
                </svg>
                About This Event
              </div>
              <p className="description">{event.Description}</p>
            </div>

            {/* Available Showtimes*/}
            <div className="section-card">
              <div className="sc-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                Available Showtimes
              </div>
              
              {event.Showtimes && event.Showtimes.length > 0 ? (
                <div className="showtime-list">
                  {event.Showtimes.map(showtime => (
                    <div key={showtime.ShowtimeID} className="showtime-row readonly">
                      <div className="st-info">
                        <div className="st-date">{formatDate(showtime.StartDateTime)}</div>
                        <div className="st-time">Show {formatTime(showtime.StartDateTime)}</div>
                        <div className="st-enddate">
                            🗓️ Booking ends: {formatDate(showtime.StartDateTime)} at {formatTime(showtime.StartDateTime)}
                        </div>
                      </div>
                      <div className="st-status">
                         <span className="status-badge available">📍 {showtime.Venue?.VenueName}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-showtimes">No showtimes available yet</p>
              )}
            </div>

            {/* Ticket Prices*/}
            <div className="section-card">
              <div className="sc-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                </svg>
                Ticket Prices
              </div>
              
              {loadingPrices ? (
                <div className="loading-prices">Fetching real prices...</div>
              ) : ticketTiers.length > 0 ? (
                <div className="ticket-prices-list">
                  {ticketTiers.map((tier, index) => (
                    <div className="ticket-price-row" key={index}>
                      <div className="tp-info">
                        <h4>{tier.name}</h4>
                        <p>{tier.description}</p>
                      </div>
                      <div className="tp-price">
                        <span className="price-amount">฿ {tier.price.toLocaleString()}</span>
                        <span className="tier-badge" style={{ background: index === 0 ? '#422006' : '#1e3a8a', color: index === 0 ? '#facc15' : '#93c5fd' }}>
                          {index === 0 ? 'PREMIUM' : 'STANDARD'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-showtimes">No price data available.</p>
              )}
            </div>

          </div>

          <div className="sidebar-column">
            <div className="booking-panel">
              <h3 className="bp-title">Book Tickets</h3>
              <p className="bp-event-title">{event.Title}</p>
              
              <div className="bp-divider"></div>
              {event.Showtimes?.length > 0 && (
                <div className="bp-enddate-notice">
                  ⏰ Booking closes:
                  {event.Showtimes.map((showtime, index) => (
                    <div key={showtime.ShowtimeID} style={{ marginTop: index === 0 ? '6px' : '4px' }}>
                      <strong>
                        {formatDate(showtime.StartDateTime)} · {formatTime(showtime.StartDateTime)}
                      </strong>
                    </div>
                  ))}
                </div>
              )}
              <div className="bp-summary-list">
                {loadingPrices ? (
                   <span style={{ color: 'var(--muted2)', fontSize: '13px' }}>Loading prices...</span>
                ) : (
                  ticketTiers.map((tier, index) => (
                    <div className="bp-summary-row" key={index}>
                      <span>{tier.name}</span>
                      <strong>฿ {tier.price.toLocaleString()}</strong>
                    </div>
                  ))
                )}
              </div>

              <button 
                className="bp-checkout-btn" 
                onClick={handleProceedToSeats}
                disabled={!event.Showtimes || event.Showtimes.length === 0}
              >
                Select Showtime & Seats →
              </button>
              <p className="bp-note">🔒 You can choose your preferred showtime and seats on the next page.</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default EventDetails;