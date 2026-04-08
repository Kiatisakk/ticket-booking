import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to={isAuthenticated ? '/events' : '/'} className="navbar-logo">
          🎫 Ticket Booking
        </Link>

        <div className="navbar-links">
          {isAuthenticated ? (
            <>
              <Link to="/events" className="navbar-link">Events</Link>
              <Link to="/my-tickets" className="navbar-link">My Tickets</Link>
              <span className="navbar-user">👤 {user?.fullName}</span>
              <button onClick={handleLogout} className="navbar-btn">
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/" className="navbar-link">Login</Link>
              <Link to="/register" className="navbar-link">Register</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
