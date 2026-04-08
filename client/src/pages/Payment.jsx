import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBooking } from '../context/BookingContext';
import axios from 'axios';
import './Payment.css';

const API_URL = 'http://localhost:4000/api';

function Payment() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const { currentBooking, selectedSeats, currentShowtime, processPayment, loading } = useBooking();
  
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPaymentMethods();
  }, []);

  const fetchPaymentMethods = async () => {
    try {
      const response = await axios.get(`${API_URL}/payment-methods`);
      setPaymentMethods(response.data);
      if (response.data.length > 0) {
        setSelectedMethod(response.data[0].MethodID);
      }
    } catch (error) {
      console.error('Failed to fetch payment methods:', error);
    }
  };

  const handlePayment = async () => {
    if (!selectedMethod) {
      return setError('Please select a payment method');
    }

    setError('');

    console.log('Starting payment process...');

    try {
      const result = await processPayment(token, selectedMethod);
      
      if (result.success) {
        console.log('Payment successful:', result);
        navigate('/my-tickets', { 
          state: { 
            message: 'Payment successful! Your tickets are ready.' 
          } 
        });
      } else {
        console.error('Payment failed:', result.error);
        setError(result.error || 'Payment failed');
      }
    } catch (error) {
      console.error('Payment error:', error);
      setError('Payment processing failed. Please try again.');
    }
  };

  const calculateTotal = () => {
    return selectedSeats.reduce((sum, seat) => sum + seat.calculatedPrice, 0);
  };

  return (
    <div className="payment-page">
      <div className="payment-header">
        <button onClick={() => navigate('/cart')} className="back-button">
          ← Back to Cart
        </button>
        <h1>💳 Payment</h1>
      </div>

      <div className="payment-content">
        <div className="payment-form">
          <h2>Select Payment Method</h2>
          <div className="methods-list">
            {paymentMethods.map(method => (
              <label
                key={method.MethodID}
                className={`method-option ${selectedMethod === method.MethodID ? 'selected' : ''}`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value={method.MethodID}
                  checked={selectedMethod === method.MethodID}
                  onChange={(e) => setSelectedMethod(Number(e.target.value))}
                />
                <div className="method-info">
                  <p className="method-name">{method.MethodName}</p>
                </div>
              </label>
            ))}
          </div>

          {error && <div className="error-message">{error}</div>}

          <button
            onClick={handlePayment}
            disabled={loading || !selectedMethod}
            className="pay-button"
          >
            {loading ? 'Processing...' : 'Confirm Payment'}
          </button>
        </div>

        <div className="order-summary">
          <h2>Order Summary</h2>
          <div className="summary-event">
            <p className="event-name">{currentShowtime?.Event?.Title}</p>
            <p className="event-date">
              {new Date(currentShowtime?.StartDateTime).toLocaleString()}
            </p>
          </div>
          <div className="summary-seats">
            {selectedSeats.map(seat => (
              <div key={seat.SeatID} className="summary-seat">
                <span>
                  {seat.SeatType?.TypeName} - Row {seat.RowLabel} Seat {seat.SeatNumber}
                </span>
                <span>฿{seat.calculatedPrice.toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="summary-total">
            <span>Total</span>
            <span>฿{calculateTotal().toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Payment;
