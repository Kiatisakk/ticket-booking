import { Link, useNavigate, useLocation } from 'react-router-dom'; // เพิ่ม useLocation
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation(); // ดึงข้อมูล Path ปัจจุบัน

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // เช็กว่าตอนนี้อยู่หน้า Login หรือ Register หรือเปล่า
  const isAuthPage = location.pathname === '/' || location.pathname === '/register';

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to={isAuthenticated ? '/events' : '/'} className="navbar-logo">
          Ticket<span>App</span>.
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
            /* จะโชว์ปุ่ม Sign In / Register ก็ต่อเมื่อ "ไม่ได้อยู่" หน้า Auth เท่านั้น */
            !isAuthPage && (
              <>
                <Link to="/" className="navbar-link">Sign In</Link>
                <Link to="/register" className="navbar-link" style={{ marginRight: '5px' }}>
                  Register
                </Link>
                <span className="navbar-divider">|</span>
                <Link to="/admin/login" className="navbar-link" style={{ marginLeft: '5px' }}>
                  Admin
                </Link>
                <Link to="/staff/login" className="navbar-btn" style={{ textDecoration: 'none', display: 'inline-block' }}>
                  Staff
                </Link>
              </>
            )
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;