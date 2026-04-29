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
      // ลองเปลี่ยนมาเช็คจากตัวแปรที่เรามี (ถ้า currentShowtime ไม่มี ให้ลองดูว่ามีในตะกร้าไหม)
      const showtimeIdFromSeats = selectedSeats.length > 0 ? selectedSeats[0].showtimeId : null;
      const targetShowtimeId = currentShowtime?.ShowtimeID || showtimeIdFromSeats;

      if (!targetShowtimeId || selectedSeats.length === 0) {
        return { success: false, error: 'No seats selected or showtime missing' };
      }

      setLoading(true);
      try {
        // *** จุดสำคัญ: ลองสลับชื่อ Key ระหว่างตัวพิมพ์เล็ก (Id) กับตัวพิมพ์ใหญ่ (ID) ***
        // ถ้าตัวเล็กไม่ได้ ให้เปลี่ยนเป็น showtimeID และ seatIDs ตามลำดับ
        const response = await axios.post(
          `${API_URL}/bookings`,
          {
            showtimeId: parseInt(targetShowtimeId, 10), 
            seatIds: selectedSeats.map(s => parseInt(s.SeatID, 10))
          },
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );

        setCurrentBooking(response.data.booking);
        return { success: true, booking: response.data.booking };
      } catch (error) {
        console.error("Create Booking Error Details:", error.response?.data);
        return {
          success: false,
          error: error.response?.data?.error || 'Failed to create booking'
        };
      } finally {
        setLoading(false);
      }
    };

const processPayment = async (token, methodId, bookingIdFromPage) => {
    // 1. ตรวจสอบว่ามี bookingId ส่งมาไหม (เราจะใช้จากหน้าที่ส่งมาเป็นหลัก)
    const bookingId = bookingIdFromPage || currentBooking?.BookingID;
    
    if (!bookingId) {
      // ถ้าไม่มีจริงๆ ถึงค่อยลองสร้างใหม่ (กันพลาด)
      const bookingResult = await createBooking(token);
      if (!bookingResult.success) {
        return bookingResult; 
      }
      return await processPayment(token, methodId, bookingResult.booking.BookingID);
    } 

    setLoading(true);
    try {
      const response = await axios.post(
        `${API_URL}/payments`,
        {
          bookingId: bookingId, // ใช้ ID ที่ได้มา
          methodId: methodId
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      // จ่ายเงินสำเร็จแล้ว ล้างข้อมูลทุกอย่าง
      clearCart();
      return { success: true, payment: response.data.payment };
    } catch (error) {
      console.error("Payment Error In Context:", error.response?.data);
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
    setSelectedSeats,
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