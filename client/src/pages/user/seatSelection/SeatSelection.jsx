import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useBooking } from '../../../context/BookingContext';
import { useAuth } from '../../../context/AuthContext';
import axios from 'axios';
import SeatLayoutGenerator from './SeatLayoutGenerator';
import './SeatSelection.css';

const API_URL = 'http://localhost:4000/api';

function SeatSelection() {
  const { showtimeId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { token } = useAuth();
  
  const { selectedSeats, setSelectedSeats } = useBooking();
  
  const [activeShowtimeId, setActiveShowtimeId] = useState(showtimeId);
  const [showtime, setShowtime] = useState(null);
  const [seats, setSeats] = useState([]);
  const [bookedSeatIds, setBookedSeatIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allShowtimes, setAllShowtimes] = useState([]);

  const { event } = location.state || {};

  useEffect(() => {
    setSelectedSeats([]);
  }, [showtimeId, setSelectedSeats]);

  useEffect(() => {
    if (event?.EventID) {
      fetchAllShowtimes(event.EventID);
    }
  }, [event?.EventID]);

  useEffect(() => {
    fetchShowtimeAndSeats(activeShowtimeId);
  }, [activeShowtimeId]);

  const fetchAllShowtimes = async (eventId) => {
    try {
      const response = await axios.get(`${API_URL}/events/${eventId}`);
      setAllShowtimes(response.data.Showtimes || []);
    } catch (error) {
      console.error('Failed to fetch all showtimes:', error);
    }
  };

  const fetchShowtimeAndSeats = async (id) => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/showtimes/${id}`);
      setShowtime(response.data);
      setSeats(response.data.Venue?.Seats || []);

      const bookedResponse = await axios.get(`${API_URL}/showtimes/${id}/booked-seats`);
      setBookedSeatIds(bookedResponse.data.bookedSeatIds || []);
    } catch (error) {
      console.error('Failed to fetch showtime:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShowtimeTabClick = async (newShowtimeId) => {
    if (String(newShowtimeId) === String(activeShowtimeId)) return;

    if (selectedSeats.length > 0) {
      try {
        await axios.post(`${API_URL}/seats/unlock`, {
          seats: selectedSeats.map(s => s.SeatID)
        }).catch(() => {});
      } catch (error) {
        console.error('Error unlocking seats on tab switch:', error);
      }
      setSelectedSeats([]);
    }

    setActiveShowtimeId(String(newShowtimeId));
  };

  const isSeatBooked = (seatId) => bookedSeatIds.includes(seatId);
  const isSeatSelected = (seatId) => selectedSeats.some(s => s.SeatID === seatId);

  const handleSeatClick = async (seat) => {
    if (isSeatBooked(seat.SeatID)) {
      return;
    }

    const alreadySelected = isSeatSelected(seat.SeatID);

    if (alreadySelected) {
      try {
        await axios.post(`${API_URL}/seats/unlock`, { seats: [seat.SeatID] }).catch(() => {});
        setSelectedSeats(prev => prev.filter(s => s.SeatID !== seat.SeatID));
      } catch (error) {
        console.error('Error unlocking seat:', error);
      }
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/seats/lock`, {
        seatId: seat.SeatID,
        showtimeId: showtime.ShowtimeID
      });

      if (response.data.success) {
        const basePrice = Number(showtime?.BasePrice) || 0;
        const modifier = Number(seat.SeatType?.PriceModifier || seat.SeatType?.Price) || 1;
        const finalPrice = basePrice * modifier;

        const seatWithPrice = { 
          ...seat, 
          calculatedPrice: finalPrice, 
          showtimeId: showtime.ShowtimeID 
        };
        setSelectedSeats(prev => [...prev, seatWithPrice]);
      }
    } catch (error) {
      if (error.response && error.response.status === 409) {
        alert('ขออภัย ที่นั่งนี้เพิ่งถูกผู้ใช้งานอื่นเลือกไป กรุณาเลือกที่นั่งใหม่ครับ');
        fetchShowtimeAndSeats(activeShowtimeId);
      }
    }
  };

  const calculateSubtotal = () => {
    return selectedSeats.reduce((sum, seat) => sum + Number(seat.calculatedPrice || seat.Price || 0), 0);
  };

  const handleProceedToCheckout = async () => {
    console.log("Token current:", token);

    if (!token) {
      alert("กรุณาเข้าสู่ระบบก่อนทำการจอง");
      return navigate('/login');
    }

    try {
      const bookingData = {
        showtimeId: parseInt(activeShowtimeId, 10),
        seatIds: selectedSeats.map(s => parseInt(s.SeatID, 10))
      };  

      const response = await axios.post(`${API_URL}/bookings`, bookingData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data && response.data.booking) {
        navigate('/payment', { 
          state: { 
            bookingId: response.data.booking.BookingID,
            totalAmount: response.data.booking.TotalAmount,
            expireTime: new Date(response.data.booking.ExpiresAt).getTime(),
            seats: selectedSeats 
          } 
        });
      }
    } catch (error) {
      console.error('❌ Error 500 Details:', error.response?.data);
      
      const serverError = error.response?.data?.error;

      if (serverError === "Failed to create booking") {
        alert("ที่นั่งนี้อาจถูกจองไปแล้ว หรือเซิร์ฟเวอร์ขัดข้อง กรุณาลองใหม่อีกครั้ง");
      } else {
        alert(serverError || "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์ (500)");
      }
    }
  };

  const formatTabDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) return (
    <div className="seat-selection-container">
      <div className="loading">Loading seats...</div>
    </div>
  );

  if (!showtime) return (
    <div className="seat-selection-container">
      <div className="error">Showtime not found</div>
    </div>
  );

  const subtotal = calculateSubtotal();
  const total = subtotal;

  const isShowtimePast = new Date(showtime.StartDateTime) < new Date();

  return (
    <div className={`seat-selection-container${isShowtimePast ? ' seat-selection-past' : ''}`}>
      <div className="top-bar">
        <div className="top-bar-title">
          {event?.Title} — {new Date(showtime.StartDateTime).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
        </div>
        <div className="top-bar-sub">
          {isShowtimePast
            ? '⏹ This showtime has ended — booking is closed'
            : `📍 ${showtime.Venue?.VenueName} · Select your seats`
          }
        </div>
      </div>

      <div className="seat-layout">
        <SeatLayoutGenerator
          seats={seats}
          categoryName={event?.Category?.CategoryName}
          isSeatBooked={isSeatBooked}
          isSeatSelected={isSeatSelected}
          handleSeatClick={isShowtimePast ? () => {} : handleSeatClick}
          showtimeBasePrice={showtime.BasePrice}
        />

        <div className="booking-panel">
          <button onClick={() => navigate(`/events/${event?.EventID}`)} className="nav-back">
            ← Back to Event
          </button>
          
          <div className="bp-title">Your Selection</div>
          <div className="bp-sub">{event?.Title}</div>

          <div className="ss-label" style={{ marginTop: '8px' }}>Available Dates</div>
          
          <div className="showtime-tabs">
            {allShowtimes.map(st => {
              const stPast = new Date(st.StartDateTime) < new Date();
              return (
                <button
                  key={st.ShowtimeID}
                  className={`showtime-tab ${String(st.ShowtimeID) === String(activeShowtimeId) ? 'active' : ''}${stPast ? ' showtime-tab-past' : ''}`}
                  onClick={() => handleShowtimeTabClick(st.ShowtimeID)}
                  disabled={stPast}
                >
                  <span className="tab-date">{formatTabDate(st.StartDateTime)}{stPast ? ' (Ended)' : ''}</span>
                  <span className="tab-venue">{st.Venue?.VenueName}</span>
                </button>
              );
            })}
          </div>

          <div className="selected-seats-box">
            <div className="ss-label">Selected Seats ({selectedSeats.length})</div>
            <div id="seatChips">
              {selectedSeats.length === 0 ? (
                <span className="ss-empty">Click on a seat to select it</span>
              ) : (
                selectedSeats.map(s => (
                  <span key={s.SeatID} className="ss-chip" onClick={() => handleSeatClick(s)}>
                    Row {s.RowLabel}-{s.SeatNumber} <button>×</button>
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="price-breakdown">
            <div className="pb-row">
              <span>{selectedSeats.length} ticket(s)</span>
              <span>฿ {subtotal.toLocaleString()}</span>
            </div>
            <div className="pb-total"><span>Total</span><span>฿ {total.toLocaleString()}</span></div>
          </div>

          <button
            className={`btn-checkout${isShowtimePast ? ' btn-checkout-past' : ''}`}
            onClick={handleProceedToCheckout}
            disabled={isShowtimePast || selectedSeats.length === 0}
          >
            {isShowtimePast ? 'Showtime Ended' : 'Proceed to Checkout →'}
          </button>
          <p className="bp-note">
            {isShowtimePast ? 'This showtime has ended. Booking is no longer available.' : '🔒 Seats reserved for 15 min at checkout.'}
          </p>
        </div>
      </div>
    </div>
  );
}

export default SeatSelection;
