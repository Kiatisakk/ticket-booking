import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from "../../../context/AuthContext";
import { useBooking } from "../../../context/BookingContext";
import axios from 'axios';
import './Payment.css';

const API_URL = 'http://localhost:4000/api';

function Payment() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = useAuth();
  const { setSelectedSeats, processPayment, loading } = useBooking();
  
  const passedBookingId = location.state?.bookingId;
  const passedTotalAmount = location.state?.totalAmount;
  const expireTime = location.state?.expireTime;
  const seats = location.state?.seats || []; // ที่นั่งที่ส่งมา

  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [error, setError] = useState('');
  const [errorFields, setErrorFields] = useState([]);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    fetchPaymentMethods();
    if (expireTime) {
      const timer = setInterval(() => {
        const now = new Date().getTime();
        const diff = Math.floor((expireTime - now) / 1000);
        if (diff <= 0) {
          clearInterval(timer);
          alert('หมดเวลาชำระเงิน ระบบได้คืนที่นั่งแล้ว');
          navigate('/my-tickets');
        }
        setTimeLeft(diff > 0 ? diff : 0);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [expireTime, navigate]);

  const fetchPaymentMethods = async () => {
    try {
      const response = await axios.get(`${API_URL}/payment-methods`);
      setPaymentMethods(response.data);
      if (response.data.length > 0) setSelectedMethod(response.data[0]);
    } catch (err) { console.error(err); }
  };

  const getMethodUI = (methodName) => {
    const name = methodName.toLowerCase();
    if (name.includes('credit') || name.includes('debit')) return { icon: '💳', sub: 'Visa, Mastercard', type: 'cc' };
    if (name.includes('promptpay')) return { icon: '📱', sub: 'QR Code', type: 'promptpay' };
    if (name.includes('truemoney')) return { icon: '🧡', sub: 'Wallet', type: 'wallet' };
    return { icon: '💵', sub: 'Standard Payment', type: 'other' };
  };

  const handleCancelOrder = async () => {
    if (!passedBookingId) return;
    if (window.confirm('คุณต้องการยกเลิกคำสั่งซื้อนี้? (ที่นั่งจะถูกปล่อยว่างทันที)')) {
      try {
        await axios.post(`${API_URL}/bookings/${passedBookingId}/cancel`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (seats.length > 0) {
          await axios.post(`${API_URL}/seats/unlock`, { seats: seats.map(s => s.SeatID) });
          setSelectedSeats([]);
        }
        alert('ยกเลิกรายการสำเร็จ');
        navigate('/my-tickets');
      } catch (err) { alert('เกิดข้อผิดพลาดในการยกเลิก'); }
    }
  };

const handlePayment = async () => {
    console.log("--- เริ่มกระบวนการชำระเงิน ---");
    console.log("Booking ID:", passedBookingId);
    console.log("Selected Method:", selectedMethod);

    let emptyFields = [];
    if (!fullName.trim()) emptyFields.push('fullName');
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!email.trim() || !emailRegex.test(email)) emptyFields.push('email');
    if (!phone.trim()) emptyFields.push('phone');

    if (emptyFields.length > 0) {
      console.log("Validation Failed:", emptyFields);
      console.log("errorFields state:", errorFields);
      setErrorFields(emptyFields);
      setError('กรุณากรอกข้อมูลติดต่อให้ถูกต้อง (เช่น ลืมใส่ @ ในอีเมล)');
      setTimeout(() => setErrorFields([]), 1500);
      return;
    }

    if (!selectedMethod) {
      console.log("No Payment Method Selected");
      return setError('กรุณาเลือกช่องทางการชำระเงิน');
    }

    if (!passedBookingId) {
      console.log("Error: No Booking ID found in state!");
      return setError('ไม่พบรหัสการจอง กรุณากลับไปเลือกที่นั่งใหม่');
    }

    setError('');

    try {
      console.log("กำลังส่งข้อมูลไปที่ processPayment...");
      const result = await processPayment(token, selectedMethod.MethodID, passedBookingId);
      
      console.log("ผลลัพธ์จาก Context:", result);

      if (result && result.success) {
        alert("ชำระเงินสำเร็จ!");
        navigate('/my-tickets');
      } else {
        setError(result?.error || 'การชำระเงินล้มเหลว');
      }
    } catch (err) {
      console.error("Payment Error Exception:", err);
      setError('เกิดข้อผิดพลาดรุนแรงขณะชำระเงิน');
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
        ⏱️ Your seats are held for <strong>{formatTime(timeLeft)}</strong>
      </div>

      <div className="checkout-layout">
        <div>
          <div className="form-card">
            <div className="fc-title">Contact Information</div>
            <div className="contact-grid">
              <div className="field">
                <label>Full Name</label>
                <input value={fullName} onChange={e => setFullName(e.target.value)} className={errorFields.includes('fullName') ? 'input-error-flash' : ''} type="text" />
              </div>
              <div className="field">
                <label>Email</label>
                <input value={email} onChange={e => setEmail(e.target.value)} className={errorFields.includes('email') ? 'input-error-flash' : ''} type="email" />
              </div>
              <div className="field">
                <label>Phone</label>
                <input value={phone} onChange={e => setPhone(e.target.value)} className={errorFields.includes('phone') ? 'input-error-flash' : ''} type="tel" />
              </div>
            </div>
          </div>

          <div className="form-card">
            <div className="fc-title">Payment Method</div>
            <div className="method-grid">
              {paymentMethods.map(method => {
                const ui = getMethodUI(method.MethodName);
                return (
                  <div key={method.MethodID} className={`method-card ${selectedMethod?.MethodID === method.MethodID ? 'selected' : ''}`} onClick={() => setSelectedMethod(method)}>
                    <div className="method-icon">{ui.icon}</div>
                    <div className="method-name">{method.MethodName}</div>
                    <div className="method-sub">{ui.sub}</div>
                  </div>
                );
              })}
            </div>

            {selectedMethod && getMethodUI(selectedMethod.MethodName).type === 'promptpay' && (
              <div className="promptpay-form active" style={{textAlign: 'center', marginTop: '20px'}}>
                <img src={`https://promptpay.io/0930626610/${passedTotalAmount}.png`} alt="QR" width="160" />
                <div className="qr-text">Scan to pay ฿{passedTotalAmount?.toLocaleString()}</div>
              </div>
            )}

            {selectedMethod && getMethodUI(selectedMethod.MethodName).type === 'cc' && (
              <div className="cc-form active" style={{marginTop: '20px'}}>
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
              <span className="label">{seats.map(s => `${s.RowLabel}${s.SeatNumber}`).join(', ') || 'No seats selected'}</span>
            </div>
            <div style={{ marginTop: '10px', paddingLeft: '10px', borderLeft: '2px solid #ddd' }}>
              {seats.map(seat => (
                <div key={seat.SeatID} className="ol-row" style={{ fontSize: '12px', marginBottom: '4px' }}>
                  <span>{seat.SeatType?.TypeName || 'Standard'}</span>
                  <span>฿{(seat.calculatedPrice || 0).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="order-total" style={{marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '15px'}}>
            <span>Total</span>
            <span>฿ {passedTotalAmount?.toLocaleString()}</span>
          </div>

          <button 
            className="btn-pay" 
            onClick={handlePayment} 
            disabled={loading || !selectedMethod} 
            style={{
              width: '100%', 
              padding: '15px', 
              background: (loading || !selectedMethod) ? '#ccc' : '#000', // เปลี่ยนสีให้เห็นชัด
              color: '#fff', 
              borderRadius: '8px', 
              marginTop: '20px', 
              cursor: (loading || !selectedMethod) ? 'not-allowed' : 'pointer',
              fontWeight: 'bold'
            }}
          >
            {loading ? 'Processing...' : `Pay ฿ ${passedTotalAmount?.toLocaleString()}`}
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