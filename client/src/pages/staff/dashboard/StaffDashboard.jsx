import React, { useEffect, useState } from 'react';
import './StaffDashboard.css';

const StaffDashboard = () => {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const token = localStorage.getItem('staffToken');
      const response = await fetch('http://localhost:4000/api/staff/dashboard', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch dashboard');
      const data = await response.json();
      setDashboard(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="dashboard-loading">Loading...</div>;
  if (error) return <div className="dashboard-error">Error: {error}</div>;

  return (
    <div className="staff-dashboard">
      <h2>Dashboard</h2>
      <p className="staff-dashboard-sub">Overview of your events and bookings</p>

      <div className="dashboard-cards">
        <div className="dashboard-card">
          <div className="card-icon-wrap events">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <div className="card-content">
            <h3>Total Events</h3>
            <p className="card-value">{dashboard?.totalEvents || 0}</p>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="card-icon-wrap bookings">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div className="card-content">
            <h3>Total Bookings</h3>
            <p className="card-value">{dashboard?.totalBookings || 0}</p>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="card-icon-wrap revenue">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <div className="card-content">
            <h3>Total Revenue</h3>
            <p className="card-value">{'\u0E3F'}{dashboard?.totalRevenue?.toFixed(2) || '0.00'}</p>
          </div>
        </div>
      </div>

      <div className="recent-events">
        <div className="recent-events-header">
          <h3>Recent Events</h3>
        </div>
        {dashboard?.recentEvents?.length > 0 ? (
          <div className="events-list">
            {dashboard.recentEvents.map((event) => (
              <div key={event.id} className="event-item">
                <div className="event-title">{event.title}</div>
                <div className="event-meta">
                  <span className="event-category">{event.category}</span>
                  <span className="event-date">
                    {new Date(event.createdAt).toLocaleDateString('th-TH')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="no-events">No events yet</p>
        )}
      </div>
    </div>
  );
};

export default StaffDashboard;
