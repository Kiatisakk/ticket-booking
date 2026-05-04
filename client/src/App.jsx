import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useAdminAuth } from './context/AdminAuthContext';
import Navbar from './components/Navbar';

import Login from './pages/user/login/Login';
import Events from './pages/user/event/Events';
import Register from './pages/user/register/Register';
import EventDetails from './pages/user/eventdetail/EventDetails';
import SeatSelection from './pages/user/seatSelection/SeatSelection';
import BookingCart from './pages/user/BookingCart/BookingCart';
import Payment from './pages/user/payment/Payment';
import MyTickets from './pages/user/tickets/MyTickets';

import AdminLogin from './pages/admin/login/AdminLogin';
import AdminLayout from './pages/admin/layout/AdminLayout';
import EventManagement from './pages/admin/events/EventManagement';
import AddEvent from './pages/admin/events/AddEvent';
import EditEvent from './pages/admin/events/EditEvent';
import Transactions from './pages/admin/transactions/Transactions';
import Reports from './pages/admin/reports/Reports';

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

function AdminProtectedRoute({ children }) {
  const adminToken = localStorage.getItem('adminToken');
  if (!adminToken) return <Navigate to="/admin/login" replace />;
  return children;
}

function UserNavbarWrapper({ children }) {
  return (
    <>
      <Navbar />
      {children}
    </>
  );
}

function App() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading Application...</div>;
  }

  return (
    <Router>
      <Routes>
        {/* ── User Routes (with Navbar) ─────────────────────────────────── */}
        <Route
          path="/"
          element={
            <UserNavbarWrapper>
              {isAuthenticated ? <Navigate to="/events" /> : <Login />}
            </UserNavbarWrapper>
          }
        />
        <Route
          path="/register"
          element={
            <UserNavbarWrapper>
              {isAuthenticated ? <Navigate to="/events" /> : <Register />}
            </UserNavbarWrapper>
          }
        />
        <Route
          path="/dashboard"
          element={
            <UserNavbarWrapper>
              <ProtectedRoute><Dashboard /></ProtectedRoute>
            </UserNavbarWrapper>
          }
        />
        <Route
          path="/events"
          element={
            <UserNavbarWrapper>
              <ProtectedRoute><Events /></ProtectedRoute>
            </UserNavbarWrapper>
          }
        />
        <Route
          path="/events/:id"
          element={
            <UserNavbarWrapper>
              <ProtectedRoute><EventDetails /></ProtectedRoute>
            </UserNavbarWrapper>
          }
        />
        <Route
          path="/seats/:showtimeId"
          element={
            <UserNavbarWrapper>
              <ProtectedRoute><SeatSelection /></ProtectedRoute>
            </UserNavbarWrapper>
          }
        />
        <Route
          path="/cart"
          element={
            <UserNavbarWrapper>
              <ProtectedRoute><BookingCart /></ProtectedRoute>
            </UserNavbarWrapper>
          }
        />
        <Route
          path="/payment"
          element={
            <UserNavbarWrapper>
              <ProtectedRoute><Payment /></ProtectedRoute>
            </UserNavbarWrapper>
          }
        />
        <Route
          path="/my-tickets"
          element={
            <UserNavbarWrapper>
              <ProtectedRoute><MyTickets /></ProtectedRoute>
            </UserNavbarWrapper>
          }
        />

        {/* ── Admin Routes (no Navbar, own layout) ─────────────────────── */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route
          path="/admin"
          element={
            <AdminProtectedRoute>
              <AdminLayout />
            </AdminProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/admin/events" replace />} />
          <Route path="events" element={<EventManagement />} />
          <Route path="events/add" element={<AddEvent />} />
          <Route path="events/:id/edit" element={<EditEvent />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="reports" element={<Reports />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
