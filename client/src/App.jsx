import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import Events from './pages/Events';
import EventDetails from './pages/EventDetails';
import SeatSelection from './pages/SeatSelection';
import BookingCart from './pages/BookingCart';
import Payment from './pages/Payment';
import MyTickets from './pages/MyTickets';
import './App.css';

function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <h1>Welcome, {user?.fullName}!</h1>
      <p>You are successfully logged in.</p>
      <p>Email: {user?.email}</p>
      <button onClick={logout} style={{ marginTop: '20px', padding: '10px 20px' }}>
        Logout
      </button>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>;
  }

  return isAuthenticated ? children : <Navigate to="/" replace />;
}

function App() {
  const { isAuthenticated } = useAuth();

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
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/events"
          element={
            <ProtectedRoute>
              <Events />
            </ProtectedRoute>
          }
        />
        <Route
          path="/events/:id"
          element={
            <ProtectedRoute>
              <EventDetails />
            </ProtectedRoute>
          }
        />
        <Route
          path="/seats/:showtimeId"
          element={
            <ProtectedRoute>
              <SeatSelection />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cart"
          element={
            <ProtectedRoute>
              <BookingCart />
            </ProtectedRoute>
          }
        />
        <Route
          path="/payment"
          element={
            <ProtectedRoute>
              <Payment />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-tickets"
          element={
            <ProtectedRoute>
              <MyTickets />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
