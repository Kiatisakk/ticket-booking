import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import './AdminBookings.css';

const API_URL = 'http://localhost:4000/api';

function getStatusClass(status) {
  switch (status?.toLowerCase()) {
    case 'completed': return 'bk-badge bk-badge-completed';
    case 'pending':   return 'bk-badge bk-badge-pending';
    case 'cancelled': return 'bk-badge bk-badge-cancelled';
    default:          return 'bk-badge bk-badge-pending';
  }
}

function formatDate(dt) {
  if (!dt) return '-';
  return new Date(dt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function AdminBookings() {
  const { adminToken } = useAdminAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter !== 'All') params.status = statusFilter;

      const res = await axios.get(`${API_URL}/admin/bookings`, {
        headers: { Authorization: `Bearer ${adminToken}` },
        params
      });
      setBookings(res.data);
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [adminToken, statusFilter]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const filtered = bookings.filter(b => {
    const matchSearch = !search ||
      b.id?.toString().includes(search) ||
      b.user?.toLowerCase().includes(search.toLowerCase()) ||
      b.userEmail?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'All' || b.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="bk-root">
      <div className="bk-header">
        <div>
          <div className="bk-title">Bookings</div>
          <div className="bk-subtitle">{filtered.length} bookings</div>
        </div>
      </div>

      <div className="bk-filters">
        <input
          className="bk-search"
          type="text"
          placeholder="Search by Booking ID, User name, or Email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="bk-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="All">All Status</option>
          <option value="Pending">Pending</option>
          <option value="Completed">Completed</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>

      <div className="bk-table-wrap">
        <div className="bk-table-scroll">
          {loading ? (
            <div className="bk-loading">Loading bookings...</div>
          ) : filtered.length === 0 ? (
            <div className="bk-empty">No bookings found</div>
          ) : (
            <table className="bk-table">
              <thead>
                <tr>
                  <th>Booking ID</th>
                  <th>User</th>
                  <th>Event</th>
                  <th>Seats</th>
                  <th>Amount (THB)</th>
                  <th>Booking Date</th>
                  <th>Status</th>
                  <th>Payment</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(bk => (
                  <tr key={bk.id}>
                    <td className="bk-mono">#{bk.id}</td>
                    <td>
                      <div className="bk-user-cell">
                        <span className="bk-user-name">{bk.user}</span>
                        {bk.userRole && bk.userRole !== 'Customer' && (
                          <span className={`bk-role-badge bk-role-${bk.userRole?.toLowerCase()}`}>{bk.userRole}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="bk-event-list">
                        {bk.events?.map((ev, i) => (
                          <span key={i} className="bk-event-tag">{ev}</span>
                        ))}
                        {(!bk.events || bk.events.length === 0) && <span className="bk-dash">-</span>}
                      </div>
                    </td>
                    <td className="bk-center">{bk.seatCount}</td>
                    <td className="bk-amount">{bk.totalAmount > 0 ? `฿${Number(bk.totalAmount).toLocaleString()}` : '-'}</td>
                    <td style={{ color: '#94a3b8', fontSize: '12px' }}>{formatDate(bk.bookingDate)}</td>
                    <td>
                      <span className={getStatusClass(bk.status)}>{bk.status}</span>
                    </td>
                    <td>
                      {bk.paymentStatus ? (
                        <span className="bk-payment-info">
                          <span className={`bk-pay-dot bk-pay-${bk.paymentStatus?.toLowerCase()}`} />
                          {bk.paymentStatus}
                        </span>
                      ) : (
                        <span className="bk-dash">No payment</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminBookings;
