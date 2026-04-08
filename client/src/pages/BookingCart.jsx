import { useNavigate } from 'react-router-dom';
import { useBooking } from '../context/BookingContext';
import './BookingCart.css';

function BookingCart() {
  const navigate = useNavigate();
  const { selectedSeats, currentShowtime, removeFromCart, clearCart } = useBooking();

  const calculateTotal = () => {
    return selectedSeats.reduce((sum, seat) => sum + seat.calculatedPrice, 0);
  };

  const handleRemove = (seatId) => {
    removeFromCart(seatId);
  };

  const handleProceedToPayment = () => {
    navigate('/payment');
  };

  const handleClearCart = () => {
    if (window.confirm('Are you sure you want to clear your cart?')) {
      clearCart();
      navigate('/events');
    }
  };

  if (selectedSeats.length === 0) {
    return (
      <div className="empty-cart">
        <h1>🛒 Your Cart is Empty</h1>
        <p>No seats selected yet</p>
        <button onClick={() => navigate('/events')} className="browse-button">
          Browse Events
        </button>
      </div>
    );
  }

  return (
    <div className="cart-page">
      <div className="cart-header">
        <h1>🛒 Your Booking</h1>
        <p>{currentShowtime?.Event?.Title}</p>
        <p className="showtime-info">
          {new Date(currentShowtime?.StartDateTime).toLocaleString()} • 
          📍 {currentShowtime?.Venue?.VenueName}
        </p>
      </div>

      <div className="cart-content">
        <div className="seats-list">
          {selectedSeats.map(seat => (
            <div key={seat.SeatID} className="cart-seat-card">
              <div className="seat-details">
                <p className="seat-type">{seat.SeatType?.TypeName}</p>
                <p className="seat-location">
                  Row {seat.RowLabel} • Seat {seat.SeatNumber}
                </p>
                <p className="seat-price">฿{seat.calculatedPrice.toFixed(2)}</p>
              </div>
              <button
                onClick={() => handleRemove(seat.SeatID)}
                className="remove-button"
              >
                ✕ Remove
              </button>
            </div>
          ))}
        </div>

        <div className="cart-summary">
          <h2>Summary</h2>
          <div className="summary-row">
            <span>Seats:</span>
            <span>{selectedSeats.length}</span>
          </div>
          <div className="summary-row total">
            <span>Total Amount:</span>
            <span>฿{calculateTotal().toFixed(2)}</span>
          </div>
          <button onClick={handleProceedToPayment} className="checkout-button">
            Proceed to Payment →
          </button>
          <button onClick={handleClearCart} className="clear-button">
            Clear Cart
          </button>
        </div>
      </div>
    </div>
  );
}

export default BookingCart;
