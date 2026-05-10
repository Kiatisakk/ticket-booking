import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useBooking } from '../../../context/BookingContext';
import axios from 'axios';
import './Payment.css';

const API_URL = 'http://localhost:4000/api';

function Payment() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = useAuth();
  const { setSelectedSeats, processPayment, loading } = useBooking();

  const queryBookingId = new URLSearchParams(location.search).get('bookingId');
  const passedBookingId = location.state?.bookingId || queryBookingId;
  const initialSeats = location.state?.seats || [];

  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [error, setError] = useState('');
  const [summarySeats, setSummarySeats] = useState(initialSeats);
  const [summaryTotalAmount, setSummaryTotalAmount] = useState(Number(location.state?.totalAmount || 0));
  const [summaryExpireTime, setSummaryExpireTime] = useState(location.state?.expireTime || 0);

  useEffect(() => {
    fetchPaymentMethods();
  }, []);

  useEffect(() => {
    fetchBookingSummary();
  }, [passedBookingId, token]);

  useEffect(() => {
    if (!summaryExpireTime) return;

    let handledExpiry = false;
    const expireCurrentBooking = async () => {
      if (handledExpiry) return;
      handledExpiry = true;

      if (passedBookingId && token) {
        try {
          await axios.post(`${API_URL}/bookings/${passedBookingId}/expire`, {}, {
            headers: { Authorization: `Bearer ${token}` }
          });
        } catch (err) {
          console.error('Failed to expire booking:', err);
        }
      }

      setSelectedSeats([]);
      navigate('/my-tickets', {
        replace: true,
        state: { message: 'Payment time expired. The booking was cancelled and seats were released.' }
      });
    };

    const timer = setInterval(() => {
      const diff = Math.floor((summaryExpireTime - new Date().getTime()) / 1000);
      if (diff <= 0) {
        clearInterval(timer);
        expireCurrentBooking();
      }
      setTimeLeft(diff > 0 ? diff : 0);
    }, 1000);

    return () => clearInterval(timer);
  }, [summaryExpireTime, navigate, passedBookingId, token, setSelectedSeats]);

  const fetchPaymentMethods = async () => {
    try {
      const response = await axios.get(`${API_URL}/payment-methods`);
      setPaymentMethods(response.data);
      if (response.data.length > 0) setSelectedMethod(response.data[0]);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchBookingSummary = async () => {
    if (!passedBookingId || !token) return;

    try {
      const response = await axios.get(`${API_URL}/bookings/${passedBookingId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const booking = response.data;
      const mappedSeats = (booking.BookingDetails || []).map(detail => {
        const seat = detail.Seat || {};
        const basePrice = Number(detail.Showtime?.BasePrice || 0);
        const modifier = Number(seat.SeatType?.PriceModifier || 1);

        return {
          ...seat,
          SeatType: seat.SeatType,
          calculatedPrice: Number(detail.Ticket?.FinalPrice || basePrice * modifier),
          showtimeId: detail.ShowtimeID
        };
      });

      setSummarySeats(mappedSeats);
      setSummaryTotalAmount(Number(booking.TotalAmount || 0));
      setSummaryExpireTime(new Date(booking.ExpiresAt).getTime());
    } catch (err) {
      console.error('Failed to fetch booking summary:', err);
      setError('Failed to load booking summary');
    }
  };

  const getMethodUI = (methodName) => {
    const name = methodName.toLowerCase();
    if (name.includes('credit') || name.includes('debit')) {
      return { logo: 'VISA', accent: 'card', sub: 'Visa, Mastercard', type: 'cc' };
    }
    if (name.includes('promptpay')) {
      return { logo: 'PP', accent: 'promptpay', sub: 'QR Code', type: 'promptpay' };
    }
    if (name.includes('truemoney')) {
      return { logo: 'TMN', accent: 'wallet', sub: 'Wallet', type: 'wallet' };
    }
    return { logo: 'PAY', accent: 'other', sub: 'Standard Payment', type: 'other' };
  };

  const handleCancelOrder = async () => {
    if (!passedBookingId) return;

    if (window.confirm('Cancel this order? The seats will be released immediately.')) {
      try {
        await axios.post(`${API_URL}/bookings/${passedBookingId}/cancel`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (summarySeats.length > 0) {
          await axios.post(`${API_URL}/seats/unlock`, {
            seats: summarySeats.map(seat => seat.SeatID)
          });
          setSelectedSeats([]);
        }

        alert('Order cancelled successfully');
        navigate('/my-tickets');
      } catch (err) {
        alert('Failed to cancel order');
      }
    }
  };

  const handlePayment = async () => {
    if (!selectedMethod) {
      return setError('Please select a payment method.');
    }

    if (!passedBookingId) {
      return setError('Booking ID not found. Please select seats again.');
    }

    setError('');

    try {
      const result = await processPayment(token, selectedMethod.MethodID, passedBookingId);
      if (result?.success) {
        alert('Payment successful!');
        navigate('/my-tickets');
      } else {
        setError(result?.error || 'Payment failed');
      }
    } catch (err) {
      console.error('Payment Error Exception:', err);
      setError('Payment failed unexpectedly.');
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="payment-page">
      <div className="timer-notice">
        Your seats are held for <strong>{formatTime(timeLeft)}</strong>
      </div>

      <div className="checkout-layout">
        <div>
          <div className="form-card">
            <div className="payment-card-header">
              <div>
                <div className="fc-title">Payment Method</div>
                <div className="payment-card-subtitle">Choose a secure gateway to complete this order.</div>
              </div>
              <div className="gateway-logo" aria-label="Payment gateway">
                <span className="gateway-logo-mark">PG</span>
                <span>Gateway</span>
              </div>
            </div>
            <div className="method-grid">
              {paymentMethods.map(method => {
                const ui = getMethodUI(method.MethodName);
                return (
                  <div key={method.MethodID} className={`method-card ${selectedMethod?.MethodID === method.MethodID ? 'selected' : ''}`} onClick={() => setSelectedMethod(method)}>
                    <div className={`method-logo ${ui.accent}`}>{ui.logo}</div>
                    <div className="method-name">{method.MethodName}</div>
                    <div className="method-sub">{ui.sub}</div>
                  </div>
                );
              })}
            </div>

            {selectedMethod && getMethodUI(selectedMethod.MethodName).type === 'promptpay' && (
              <div className="promptpay-form active" style={{ textAlign: 'center', marginTop: '20px' }}>
                <img src={`https://promptpay.io/0930626610/${summaryTotalAmount}.png`} alt="QR" width="160" />
                <div className="qr-text">Scan to pay THB {summaryTotalAmount.toLocaleString()}</div>
              </div>
            )}

            {selectedMethod && getMethodUI(selectedMethod.MethodName).type === 'cc' && (
              <div className="cc-form active" style={{ marginTop: '20px' }}>
                <div className="field"><label>Card Number</label><input type="text" placeholder="xxxx xxxx xxxx xxxx" /></div>
              </div>
            )}
          </div>
        </div>

        <div className="summary-card">
          <div className="sc-title">Order Summary</div>

          <div className="order-lines">
            <div className="ol-row">
              <span>Seats</span>
              <span className="label">{summarySeats.map(s => `${s.RowLabel}${s.SeatNumber}`).join(', ') || 'No seats selected'}</span>
            </div>
            <div style={{ marginTop: '10px', paddingLeft: '10px', borderLeft: '2px solid #ddd' }}>
              {summarySeats.map(seat => (
                <div key={seat.SeatID} className="ol-row" style={{ fontSize: '12px', marginBottom: '4px' }}>
                  <span>{seat.SeatType?.TypeName || 'Standard'}</span>
                  <span>THB {(seat.calculatedPrice || 0).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="order-total" style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '15px' }}>
            <span>Total</span>
            <span>THB {summaryTotalAmount.toLocaleString()}</span>
          </div>

          {error && <div className="error-message" style={{ marginTop: '12px' }}>{error}</div>}

          <button
            className="btn-pay"
            onClick={handlePayment}
            disabled={loading || !selectedMethod}
          >
            <span>{loading ? 'Processing Payment' : 'Pay Now'}</span>
            <strong>THB {summaryTotalAmount.toLocaleString()}</strong>
          </button>

          <button onClick={handleCancelOrder} style={{ width: '100%', padding: '12px', marginTop: '10px', background: 'none', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '8px', cursor: 'pointer' }}>
            Cancel Order
          </button>
        </div>
      </div>
    </div>
  );
}

export default Payment;
