import { useNavigate } from 'react-router-dom';
import { useBooking } from '../../../context/BookingContext';
import './BookingCart.css';

function BookingCart() {
  const navigate = useNavigate();
  const { selectedSeats, currentShowtime, removeFromCart, clearCart } = useBooking();

  const calculateTotal = () => {
    return selectedSeats.reduce((sum, seat) => sum + (seat.calculatedPrice || seat.Price || 0), 0);
  };

  const handleRemove = (seatId) => {
    removeFromCart(seatId);
  };

  const handleProceedToPayment = async () => {
    try {
      const response = await axios.post('http://localhost:4000/api/bookings', {
        showtimeId: currentShowtime.ShowtimeID,
        seatIds: selectedSeats.map(s => s.SeatID), // ส่ง ID ที่นั่งไป
        totalAmount: calculateTotal()
      });

      const newBookingId = response.data.BookingID; 
      navigate(`/payment?bookingId=${newBookingId}`); 
      
    } catch (error) {
      console.error('Failed to create booking:', error);
      alert('ไม่สามารถสร้างใบจองได้ กรุณาลองใหม่');
    }
  };

  const handleClearCart = () => {
    if (window.confirm('Are you sure you want to clear your cart?')) {
      clearCart();
      navigate('/events');
    }
  };

  // -----------------------------------------
  // EMPTY STATE UI (Dark Theme)
  // -----------------------------------------
  if (selectedSeats.length === 0) {
    return (
      <div className="cart-page">
        <header className="navbar">
          <div className="nav-inner">
            <div className="nav-logo" onClick={() => navigate('/')} style={{cursor: 'pointer'}}>
              Ticket<span>App</span>.
            </div>
          </div>
        </header>
        
        <div className="empty-cart">
          <div className="empty-icon">🎟️</div>
          <h1>Your Cart is Empty</h1>
          <p>Looks like you haven't selected any seats yet.</p>
          <button onClick={() => navigate('/events')} className="btn-primary" style={{ maxWidth: '200px', margin: '0 auto' }}>
            Browse Events
          </button>
        </div>
      </div>
    );
  }

  // -----------------------------------------
  // MAIN CART UI
  // -----------------------------------------
  return (
    <div className="cart-page">
      {/* NAVBAR */}
      <header className="navbar">
        <div className="nav-inner">
          <div className="nav-logo" onClick={() => navigate('/')} style={{cursor: 'pointer'}}>
            Ticket<span>App</span>.
          </div>
          <button className="nav-back" onClick={() => navigate('/events')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Back to Events
          </button>
        </div>
      </header>

      {/* STEP INDICATOR */}
      <div className="steps">
        <div className="step">
          <div className="step-dot done">✓</div>
          <div className="step-label">Browse</div>
        </div>
        <div className="step-line done"></div>
        <div className="step">
          <div className="step-dot active">2</div>
          <div className="step-label active">Review Cart</div>
        </div>
        <div className="step-line"></div>
        <div className="step">
          <div className="step-dot">3</div>
          <div className="step-label">Checkout</div>
        </div>
      </div>

      <div className="cart-layout">
        
        {/* LEFT COLUMN: SEATS LIST */}
        <div className="cart-left">
          <div className="section-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            Selected Seats ({selectedSeats.length})
          </div>
          
          <div className="seats-list">
            {selectedSeats.map(seat => (
              <div key={seat.SeatID} className="seat-card">
                <div className="seat-icon">💺</div>
                <div className="seat-details">
                  <p className="seat-type">{seat.SeatType?.TypeName}</p>
                  <p className="seat-location">
                    Row <strong>{seat.RowLabel}</strong> • Seat <strong>{seat.SeatNumber}</strong>
                  </p>
                </div>
                <div className="seat-actions">
                  <p className="seat-price">฿{(seat.calculatedPrice || seat.Price || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                  <button onClick={() => handleRemove(seat.SeatID)} className="btn-remove" title="Remove seat">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button onClick={handleClearCart} className="btn-clear">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            Clear All Seats
          </button>
        </div>

        {/* RIGHT COLUMN: SUMMARY */}
        <div className="cart-right">
          <div className="summary-card">
            <div className="sc-title">Booking Summary</div>
            
            <div className="event-summary-row">
              <div className="event-icon">🎤</div>
              <div>
                <div className="event-info-title">{currentShowtime?.Event?.Title}</div>
                <div className="event-info-sub">
                  📅 {new Date(currentShowtime?.StartDateTime).toLocaleString()}
                  <br/>📍 {currentShowtime?.Venue?.VenueName}
                </div>
              </div>
            </div>

            <div className="order-lines">
              <div className="ol-row">
                <span>Total Seats</span>
                <span className="label">{selectedSeats.length} Ticket(s)</span>
              </div>
              <div className="ol-row">
                <span>Subtotal</span>
                <span>฿{calculateTotal().toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
              </div>
              <div className="ol-row">
                <span>Service fee</span>
                <span>฿0.00</span>
              </div>
            </div>

            <div className="order-total">
              <span>Total</span>
              <span style={{ color: 'var(--indigo-light)' }}>
                ฿{calculateTotal().toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              </span>
            </div>

            <button onClick={handleProceedToPayment} className="btn-primary">
              Proceed to Payment →
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

export default BookingCart;