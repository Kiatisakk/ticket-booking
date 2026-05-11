import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
import UserManagement from './pages/admin/users/UserManagement';
import AdminBookings from './pages/admin/bookings/AdminBookings';
import Transactions from './pages/admin/transactions/Transactions';
import Reports from './pages/admin/reports/Reports';
import SystemSettings from './pages/admin/settings/SystemSettings';
import MasterData from './pages/admin/masterData/MasterData';

import StaffLogin from './pages/staff/login/StaffLogin';
import StaffLayout from './pages/staff/layout/StaffLayout';

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
  const { adminToken, loading } = useAdminAuth();
  const location = useLocation();

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading Admin...</div>;
  if (!adminToken) return <Navigate to="/admin/login" replace state={{ from: location }} />;
  return children;
}

function StaffProtectedRoute({ children }) {
  const staffToken = localStorage.getItem('staffToken');
  if (!staffToken) return <Navigate to="/staff/login" replace />;
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
          <Route path="master-data" element={<MasterData />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="bookings" element={<AdminBookings />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="reports" element={<Navigate to="/admin/reports/revenue-by-category" replace />} />
          <Route path="reports/boking-vs-capacity" element={<Navigate to="/admin/reports/booking-vs-capacity" replace />} />
          <Route path="reports/:reportId" element={<Reports />} />
          <Route path="settings" element={<SystemSettings />} />
        </Route>

        {/* ── Staff Routes (no Navbar, own layout) ─────────────────────── */}
        <Route path="/staff/login" element={<StaffLogin />} />
        <Route
          path="/staff"
          element={
            <StaffProtectedRoute>
              <StaffLayout />
            </StaffProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/staff/events" replace />} />
          <Route path="dashboard" element={<Navigate to="/staff/events" replace />} />
          <Route path="events" element={<EventManagement />} />
          <Route path="events/create" element={<AddEvent />} />
          <Route path="events/:id" element={<EditEvent />} />
          <Route path="events/:id/edit" element={<EditEvent />} />
          <Route path="bookings" element={<Navigate to="/staff/events" replace />} />
          <Route path="transactions" element={<Navigate to="/staff/events" replace />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
