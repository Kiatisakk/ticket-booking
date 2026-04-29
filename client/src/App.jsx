import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';

import Login from './pages/user/login/Login';
import Events from './pages/user/event/Events';

import Register from './pages/user/register/Register';
import EventDetails from './pages/user/eventdetail/EventDetails';
import SeatSelection from './pages/user/seatSelection/SeatSelection';
import BookingCart from "./pages/user/BookingCart/BookingCart";
import Payment from './pages/user/payment/Payment';
import MyTickets from './pages/user/tickets/MyTickets';

import './App.css';

function Dashboard() {
  const { user, logout } = useAuth();
  return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <h1>Welcome, {user?.fullName}!</h1>
      <p>Email: {user?.email}</p>
      <button onClick={logout} style={{ marginTop: '20px', padding: '10px 20px' }}>Logout</button>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>;
  return isAuthenticated ? children : <Navigate to="/" replace />;
}

function App() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading Application...</div>;
  }

  return (
    <Router>
      <Navbar />
      <Routes>
        <Route 
          path="/" 
          element={isAuthenticated ? <Navigate to="/events" /> : <Login />} 
        />
        <Route 
          path="/register" 
          element={isAuthenticated ? <Navigate to="/events" /> : <Register />} 
        />
        
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/events" element={<ProtectedRoute><Events /></ProtectedRoute>} />
        <Route path="/events/:id" element={<ProtectedRoute><EventDetails /></ProtectedRoute>} />
        <Route path="/seats/:showtimeId" element={<ProtectedRoute><SeatSelection /></ProtectedRoute>} />
        <Route path="/cart" element={<ProtectedRoute><BookingCart /></ProtectedRoute>} />
        <Route path="/payment" element={<ProtectedRoute><Payment /></ProtectedRoute>} />
        <Route path="/my-tickets" element={<ProtectedRoute><MyTickets /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;