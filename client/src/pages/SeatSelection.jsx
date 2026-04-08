import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useBooking } from '../context/BookingContext';
import axios from 'axios';
import './SeatSelection.css';

const API_URL = 'http://localhost:4000/api';

function SeatSelection() {
  const { showtimeId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { addToCart, selectedSeats, currentShowtime } = useBooking();
  
  const [showtime, setShowtime] = useState(null);
  const [seats, setSeats] = useState([]);
  const [bookedSeatIds, setBookedSeatIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const { event } = location.state || {};

  useEffect(() => {
    fetchShowtimeAndSeats();
  }, [showtimeId]);

  const fetchShowtimeAndSeats = async () => {
    try {
      const response = await axios.get(`${API_URL}/showtimes/${showtimeId}`);
      setShowtime(response.data);
      setSeats(response.data.Venue?.Seats || []);

      // Fetch actually booked seats for this showtime
      const bookedResponse = await axios.get(`${API_URL}/showtimes/${showtimeId}/booked-seats`);
      setBookedSeatIds(bookedResponse.data.bookedSeatIds || []);
    } catch (error) {
      console.error('Failed to fetch showtime:', error);
    } finally {
      setLoading(false);
    }
  };

  const isSeatBooked = (seatId) => bookedSeatIds.includes(seatId);

  const isSeatSelected = (seatId) => selectedSeats.some(s => s.SeatID === seatId);

  const handleSeatClick = (seat) => {
    if (isSeatBooked(seat.SeatID)) return;

    const seatWithPrice = {
      ...seat,
      calculatedPrice: parseFloat(showtime.BasePrice) * parseFloat(seat.SeatType?.PriceModifier || 1)
    };

    addToCart(seatWithPrice, showtime);
  };

  const calculateTotal = () => {
    return selectedSeats.reduce((sum, seat) => sum + seat.calculatedPrice, 0);
  };

  const handleProceedToCart = () => {
    navigate('/cart');
  };

  const getSeatColor = (seat) => {
    if (isSeatBooked(seat.SeatID)) return 'booked';
    if (isSeatSelected(seat.SeatID)) return 'selected';
    return seat.SeatType?.TypeName?.toLowerCase() || 'standard';
  };

  const groupSeatsByRow = () => {
    const grouped = {};
    seats.forEach(seat => {
      const row = seat.RowLabel || 'A';
      if (!grouped[row]) grouped[row] = [];
      grouped[row].push(seat);
    });
    return grouped;
  };

  if (loading) {
    return <div className="loading">Loading seats...</div>;
  }

  if (!showtime) {
    return <div className="error">Showtime not found</div>;
  }

  const groupedSeats = groupSeatsByRow();
  const total = calculateTotal();

  return (
    <div className="seat-selection-page">
      <div className="selection-header">
        <button onClick={() => navigate(`/events/${event?.EventID}`)} className="back-button">
          ← Back
        </button>
        <h1>Select Your Seats</h1>
        <p className="event-info">
          {event?.Title} • {new Date(showtime.StartDateTime).toLocaleString()}
        </p>
      </div>

      <div className="seat-legend">
        <div className="legend-item">
          <span className="legend-box vip"></span>
          <span>VIP (฿{showtime.BasePrice * 2})</span>
        </div>
        <div className="legend-item">
          <span className="legend-box standard"></span>
          <span>Standard (฿{showtime.BasePrice})</span>
        </div>
        <div className="legend-item">
          <span className="legend-box sofa"></span>
          <span>Sofa Bed (฿{showtime.BasePrice * 1.5})</span>
        </div>
        <div className="legend-item">
          <span className="legend-box selected"></span>
          <span>Selected</span>
        </div>
        <div className="legend-item">
          <span className="legend-box booked"></span>
          <span>Booked</span>
        </div>
      </div>

      <div className="screen">SCREEN</div>

      <div className="seat-map">
        {Object.entries(groupedSeats).map(([row, rowSeats]) => (
          <div key={row} className="seat-row">
            <div className="row-label">{row}</div>
            <div className="seats-container">
              {rowSeats.map(seat => (
                <button
                  key={seat.SeatID}
                  className={`seat ${getSeatColor(seat)}`}
                  onClick={() => handleSeatClick(seat)}
                  disabled={isSeatBooked(seat.SeatID)}
                  title={`${seat.SeatType?.TypeName} - Row ${seat.RowLabel} Seat ${seat.SeatNumber}`}
                >
                  {seat.SeatNumber}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {selectedSeats.length > 0 && (
        <div className="selection-summary">
          <div className="summary-content">
            <p className="selected-count">{selectedSeats.length} seat(s) selected</p>
            <p className="total-price">Total: ฿{total.toFixed(2)}</p>
            <button onClick={handleProceedToCart} className="proceed-button">
              Proceed to Cart →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SeatSelection;
