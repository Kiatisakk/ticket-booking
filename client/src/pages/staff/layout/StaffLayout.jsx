import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import './StaffLayout.css';

const NAV_ITEMS = [
  {
    to: '/staff/dashboard',
    label: 'Dashboard',
    icon: (
      <svg className="staff-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
    )
  },
  {
    to: '/staff/events',
    label: 'Event Management',
    icon: (
      <svg className="staff-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    )
  },
  {
    to: '/staff/bookings',
    label: 'Bookings',
    icon: (
      <svg className="staff-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
    )
  },
  {
    to: '/staff/transactions',
    label: 'Transactions',
    icon: (
      <svg className="staff-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    )
  }
];

function getPageTitle(pathname) {
  if (pathname.includes('/dashboard')) return 'Dashboard';
  if (pathname.includes('/events')) return 'Event Management';
  if (pathname.includes('/bookings')) return 'Bookings';
  if (pathname.includes('/transactions')) return 'Transactions';
  return 'Staff Portal';
}

const StaffLayout = () => {
  const [user, setUser] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const staffUser = localStorage.getItem('staffUser');
    if (!staffUser) {
      navigate('/staff/login');
      return;
    }
    setUser(JSON.parse(staffUser));
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('staffToken');
    localStorage.removeItem('staffUser');
    navigate('/staff/login');
  };

  const initials = user?.fullName
    ? user.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'ST';

  return (
    <div className="staff-layout">
      {/* Sidebar */}
      <aside className="staff-sidebar">
        <div className="staff-sidebar-logo">
          <div className="staff-sidebar-logo-text">
            Ticket<span>Staff</span>.
          </div>
          <div className="staff-sidebar-logo-sub">Staff Portal</div>
        </div>

        <nav className="staff-sidebar-nav">
          <div className="staff-sidebar-section-label">Management</div>
          {NAV_ITEMS.map(item => {
            const isActive = location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`staff-nav-link${isActive ? ' active' : ''}`}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="staff-sidebar-footer">
          <div className="staff-sidebar-user">
            <div className="staff-sidebar-avatar">{initials}</div>
            <div>
              <div className="staff-sidebar-user-name">{user?.fullName || 'Staff'}</div>
              <div className="staff-sidebar-user-role">Staff Member</div>
            </div>
          </div>
          <button className="staff-logout-btn" onClick={handleLogout}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="staff-main">
        <header className="staff-topbar">
          <div className="staff-topbar-title">{getPageTitle(location.pathname)}</div>
          <div className="staff-topbar-right">
            <div className="staff-status-badge">
              <span className="staff-status-dot" />
              System Online
            </div>
          </div>
        </header>

        <main className="staff-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default StaffLayout;
