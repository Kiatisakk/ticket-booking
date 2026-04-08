import { createContext, useContext, useState } from 'react';
import axios from 'axios';

const BookingContext = createContext(null);

const API_URL = 'http://localhost:4000/api';

export function BookingProvider({ children }) {
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [currentShowtime, setCurrentShowtime] = useState(null);
  const [currentBooking, setCurrentBooking] = useState(null);
  const [loading, setLoading] = useState(false);

  const addToCart = (seat, showtime) => {
    setSelectedSeats(prev => {
      const exists = prev.find(s => s.SeatID === seat.SeatID);
      if (exists) {
        return prev.filter(s => s.SeatID !== seat.SeatID);
      }
      return [...prev, { ...seat, showtimeId: showtime.ShowtimeID }];
    });
    setCurrentShowtime(showtime);
  };

  const removeFromCart = (seatId) => {
    setSelectedSeats(prev => prev.filter(s => s.SeatID !== seatId));
  };

  const clearCart = () => {
    setSelectedSeats([]);
    setCurrentShowtime(null);
    setCurrentBooking(null);
  };

  const createBooking = async (token) => {
    if (!currentShowtime || selectedSeats.length === 0) {
      return { success: false, error: 'No seats selected' };
    }

    setLoading(true);
    try {
      const response = await axios.post(
        `${API_URL}/bookings`,
        {
          showtimeId: currentShowtime.ShowtimeID,
          seatIds: selectedSeats.map(s => s.SeatID)
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setCurrentBooking(response.data.booking);
      return { success: true, booking: response.data.booking };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to create booking'
      };
    } finally {
      setLoading(false);
    }
  };

  const processPayment = async (token, methodId) => {
    // If no booking exists, create one first
    let booking = currentBooking;
    if (!booking) {
      const bookingResult = await createBooking(token);
      if (!bookingResult.success) {
        return bookingResult;
      }
      booking = bookingResult.booking;
    }

    setLoading(true);
    try {
      const response = await axios.post(
        `${API_URL}/payments`,
        {
          bookingId: booking.BookingID,
          methodId: methodId
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      clearCart();
      return { success: true, payment: response.data.payment };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Payment failed'
      };
    } finally {
      setLoading(false);
    }
  };

  const value = {
    selectedSeats,
    currentShowtime,
    currentBooking,
    loading,
    addToCart,
    removeFromCart,
    clearCart,
    createBooking,
    processPayment
  };

  return (
    <BookingContext.Provider value={value}>
      {children}
    </BookingContext.Provider>
  );
}

export function useBooking() {
  const context = useContext(BookingContext);
  if (!context) {
    throw new Error('useBooking must be used within BookingProvider');
  }
  return context;
}
