import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import { REPORTS, getReportById } from '../reports/reportConfig';
import './AdminLayout.css';

const NAV_ITEMS = [
  {
    to: '/admin/events',
    label: 'Event Management',
    icon: (
      <svg className="admin-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    )
  },
  {
    to: '/admin/master-data',
    label: 'Master Data',
    icon: (
      <svg className="admin-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
        <path d="M8 7h6M8 11h6M8 15h2" />
        <path d="M3 21h18" />
      </svg>
    )
  },
  {
    to: '/admin/users',
    label: 'User Management',
    icon: (
      <svg className="admin-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    )
  },
  {
    to: '/admin/bookings',
    label: 'Bookings',
    icon: (
      <svg className="admin-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
    )
  },
  {
    to: '/admin/transactions',
    label: 'Transactions',
    icon: (
      <svg className="admin-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    )
  },
  {
    to: '/admin/reports',
    label: 'Reports & Analytics',
    icon: (
      <svg className="admin-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    )
  },
  {
    to: '/admin/settings',
    label: 'System Settings',
    icon: (
      <svg className="admin-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" />
        <path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.05.05a2.1 2.1 0 1 1-2.97 2.97l-.05-.05a1.8 1.8 0 0 0-1.98-.36 1.8 1.8 0 0 0-1.1 1.66V21a2.1 2.1 0 1 1-4.2 0v-.08a1.8 1.8 0 0 0-1.1-1.66 1.8 1.8 0 0 0-1.98.36l-.05.05a2.1 2.1 0 1 1-2.97-2.97l.05-.05A1.8 1.8 0 0 0 4.6 15a1.8 1.8 0 0 0-1.66-1.1H2.9a2.1 2.1 0 1 1 0-4.2h.08A1.8 1.8 0 0 0 4.6 8a1.8 1.8 0 0 0-.36-1.98l-.05-.05A2.1 2.1 0 1 1 7.16 3l.05.05A1.8 1.8 0 0 0 9.2 3.4 1.8 1.8 0 0 0 10.3 1.74V1.7a2.1 2.1 0 1 1 4.2 0v.08a1.8 1.8 0 0 0 1.1 1.66 1.8 1.8 0 0 0 1.98-.36l.05-.05a2.1 2.1 0 1 1 2.97 2.97l-.05.05A1.8 1.8 0 0 0 19.4 8c.17.5.62.85 1.14.92h.56a2.1 2.1 0 1 1 0 4.2h-.08A1.8 1.8 0 0 0 19.4 15Z" />
      </svg>
    )
  }
];

const CUSTOMER_ITEMS = [
  { to: '/events', label: 'Browse Events' },
  { to: '/my-tickets', label: 'My Tickets' }
];

function getPageTitle(pathname) {
  if (pathname.includes('/events/add')) return 'Add Event';
  if (pathname.includes('/events') && pathname.includes('/edit')) return 'Edit Event';
  if (pathname.includes('/events')) return 'Event Management';
  if (pathname.includes('/master-data')) return 'Master Data';
  if (pathname.includes('/users')) return 'User Management';
  if (pathname.includes('/bookings')) return 'Bookings';
  if (pathname.includes('/transactions')) return 'Transactions';
  if (pathname.includes('/reports/')) {
    const reportId = pathname.split('/reports/')[1]?.split('/')[0];
    return getReportById(reportId).title;
  }
  if (pathname.includes('/reports')) return 'Reports & Analytics';
  if (pathname.includes('/settings')) return 'System Settings';
  return 'Admin';
}

function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { adminUser, adminLogout } = useAdminAuth();

  const handleLogout = () => {
    adminLogout();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/admin/login');
  };

  const initials = adminUser?.fullName
    ? adminUser.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'AD';

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-logo">
          <div className="admin-sidebar-logo-text">
            Ticket<span>Admin</span>.
          </div>
          <div className="admin-sidebar-logo-sub">Admin Panel</div>
        </div>

        <nav className="admin-sidebar-nav">
          <div className="admin-sidebar-section-label">Management</div>
          {NAV_ITEMS.map(item => {
            const isActive = location.pathname.startsWith(item.to);
            return (
              <div key={item.to}>
                <Link
                  to={item.to}
                  className={`admin-nav-link${isActive ? ' active' : ''}`}
                >
                  {item.icon}
                  {item.label}
                </Link>
                {item.to === '/admin/reports' && isActive && (
                  <div className="admin-report-subnav">
                    {REPORTS.map(report => {
                      const reportPath = `/admin/reports/${report.id}`;
                      return (
                        <Link
                          key={report.id}
                          to={reportPath}
                          className={`admin-report-link${location.pathname === reportPath ? ' active' : ''}`}
                        >
                          <span>{report.no}</span>
                          {report.title}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          <div className="admin-sidebar-section-label">Customer Area</div>
          {CUSTOMER_ITEMS.map(item => (
            <Link key={item.to} to={item.to} className="admin-nav-link">
              <svg className="admin-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-sidebar-user">
            <div className="admin-sidebar-avatar">{initials}</div>
            <div>
              <div className="admin-sidebar-user-name">{adminUser?.fullName || 'Admin'}</div>
              <div className="admin-sidebar-user-role">Administrator</div>
            </div>
          </div>
          <button className="admin-logout-btn" onClick={handleLogout}>
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
      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar-title">{getPageTitle(location.pathname)}</div>
          <div className="admin-topbar-right">
            <div className="admin-status-badge">
              <span className="admin-status-dot" />
              System Online
            </div>
          </div>
        </header>

        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;
