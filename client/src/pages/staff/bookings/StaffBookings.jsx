import { useState, useEffect, useCallback } from 'react';
import './StaffBookings.css';

const API_URL = 'http://localhost:4000/api';

function getStatusClass(status) {
  switch (status?.toLowerCase()) {
    case 'completed': return 'sbk-badge sbk-badge-completed';
    case 'pending':   return 'sbk-badge sbk-badge-pending';
    case 'cancelled': return 'sbk-badge sbk-badge-cancelled';
    default:          return 'sbk-badge sbk-badge-pending';
  }
}

function formatDate(dt) {
  if (!dt) return '-';
  return new Date(dt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function StaffBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('staffToken');
      const params = new URLSearchParams();
      if (statusFilter !== 'All') params.append('status', statusFilter);

      const res = await fetch(`${API_URL}/staff/bookings?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setBookings(data);
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

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
    <div className="sbk-root">
      <div className="sbk-header">
        <div>
          <div className="sbk-title">Bookings</div>
          <div className="sbk-subtitle">{filtered.length} bookings for your events</div>
        </div>
      </div>

      <div className="sbk-filters">
        <input
          className="sbk-search"
          type="text"
          placeholder="Search by Booking ID, User name, or Email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="sbk-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="All">All Status</option>
          <option value="Pending">Pending</option>
          <option value="Completed">Completed</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>

      <div className="sbk-table-wrap">
        <div className="sbk-table-scroll">
          {loading ? (
            <div className="sbk-loading">Loading bookings...</div>
          ) : filtered.length === 0 ? (
            <div className="sbk-empty">No bookings found</div>
          ) : (
            <table className="sbk-table">
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
                    <td className="sbk-mono">#{bk.id}</td>
                    <td>
                      <div className="sbk-user-cell">
                        <span className="sbk-user-name">{bk.user}</span>
                      </div>
                    </td>
                    <td>
                      <div className="sbk-event-list">
                        {bk.events?.map((ev, i) => (
                          <span key={i} className="sbk-event-tag">{ev}</span>
                        ))}
                        {(!bk.events || bk.events.length === 0) && <span className="sbk-dash">-</span>}
                      </div>
                    </td>
                    <td className="sbk-center">{bk.seatCount}</td>
                    <td className="sbk-amount">{bk.totalAmount > 0 ? `฿${Number(bk.totalAmount).toLocaleString()}` : '-'}</td>
                    <td style={{ color: '#94a3b8', fontSize: '12px' }}>{formatDate(bk.bookingDate)}</td>
                    <td>
                      <span className={getStatusClass(bk.status)}>{bk.status}</span>
                    </td>
                    <td>
                      {bk.paymentStatus ? (
                        <span className="sbk-payment-info">
                          <span className={`sbk-pay-dot sbk-pay-${bk.paymentStatus?.toLowerCase()}`} />
                          {bk.paymentStatus}
                        </span>
                      ) : (
                        <span className="sbk-dash">No payment</span>
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

export default StaffBookings;
