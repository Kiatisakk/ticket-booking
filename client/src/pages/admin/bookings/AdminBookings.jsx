import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import TableControls from '../../../components/TableControls';
import { getPageRows, getTotalPages, nextSortConfig, sortLabel, sortRows } from '../../../utils/tableView';
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
  const [sortConfig, setSortConfig] = useState({ key: 'bookingId', direction: 'desc' });
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [cursor, setCursor] = useState(null);
  const [cursorDirection, setCursorDirection] = useState('next');
  const [cursorMeta, setCursorMeta] = useState({ hasNextPage: false, hasPrevPage: false, nextCursor: null, prevCursor: null });
  const [paginationMode, setPaginationMode] = useState('cursor');
  const serverSortableKeys = new Set(['bookingId', 'user', 'amount', 'bookingDate', 'status']);
  const serverMode = serverSortableKeys.has(sortConfig.key);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        pagination: 'cursor',
        cursor: cursor || undefined,
        direction: cursorDirection,
        page,
        pageSize,
        sortBy: sortConfig.key,
        sortOrder: sortConfig.direction,
        search: search || undefined
      };
      if (statusFilter !== 'All') params.status = statusFilter;

      const res = await axios.get(`${API_URL}/admin/bookings`, {
        headers: { Authorization: `Bearer ${adminToken}` },
        params
      });
      const payload = Array.isArray(res.data)
        ? { data: res.data, total: res.data.length, totalPages: 1 }
        : res.data;
      setBookings(payload.data || []);
      setTotalRows(payload.total || 0);
      setPaginationMode(payload.pagination?.type || 'page');
      setCursorMeta(payload.pagination?.type === 'cursor'
        ? payload.pagination
        : { hasNextPage: false, hasPrevPage: false, nextCursor: null, prevCursor: null });
      setTotalPages(payload.totalPages || getTotalPages(payload.total || 0, pageSize));
    } catch {
      setBookings([]);
      setTotalRows(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [adminToken, search, statusFilter, sortConfig, page, pageSize, serverMode, cursor, cursorDirection]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const sortAccessors = {
    bookingId: b => b.id,
    user: b => b.user,
    event: b => b.events?.join(', '),
    seats: b => b.seatCount,
    amount: b => b.totalAmount,
    bookingDate: b => b.bookingDate,
    status: b => b.status,
    payment: b => b.paymentStatus || ''
  };
  const sorted = serverMode ? bookings : sortRows(bookings, sortConfig, sortAccessors);
  const effectiveTotalPages = serverMode ? totalPages : getTotalPages(sorted.length, pageSize);
  const pageRows = serverMode ? bookings : getPageRows(sorted, Math.min(page, effectiveTotalPages), pageSize);
  const effectiveTotalRows = serverMode ? totalRows : sorted.length;

  useEffect(() => {
    setPage(1);
    setCursor(null);
    setCursorDirection('next');
  }, [search, statusFilter, pageSize]);

  const handleSort = (key) => {
    setSortConfig(current => nextSortConfig(current, key));
    setPage(1);
    setCursor(null);
    setCursorDirection('next');
  };

  return (
    <div className="bk-root">
      <div className="bk-header">
        <div>
          <div className="bk-title">Bookings</div>
          <div className="bk-subtitle">{effectiveTotalRows} bookings</div>
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
          ) : bookings.length === 0 ? (
            <div className="bk-empty">No bookings found</div>
          ) : (
            <table className="bk-table">
              <thead>
                <tr>
                  <th className="sortable-th"><button type="button" onClick={() => handleSort('bookingId')}>Booking ID <span className="sort-mark">{sortLabel(sortConfig, 'bookingId')}</span></button></th>
                  <th className="sortable-th"><button type="button" onClick={() => handleSort('user')}>User <span className="sort-mark">{sortLabel(sortConfig, 'user')}</span></button></th>
                  <th className="sortable-th"><button type="button" onClick={() => handleSort('event')}>Event <span className="sort-mark">{sortLabel(sortConfig, 'event')}</span></button></th>
                  <th className="sortable-th"><button type="button" onClick={() => handleSort('seats')}>Seats <span className="sort-mark">{sortLabel(sortConfig, 'seats')}</span></button></th>
                  <th className="sortable-th"><button type="button" onClick={() => handleSort('amount')}>Amount (THB) <span className="sort-mark">{sortLabel(sortConfig, 'amount')}</span></button></th>
                  <th className="sortable-th"><button type="button" onClick={() => handleSort('bookingDate')}>Booking Date <span className="sort-mark">{sortLabel(sortConfig, 'bookingDate')}</span></button></th>
                  <th className="sortable-th"><button type="button" onClick={() => handleSort('status')}>Status <span className="sort-mark">{sortLabel(sortConfig, 'status')}</span></button></th>
                  <th className="sortable-th"><button type="button" onClick={() => handleSort('payment')}>Payment <span className="sort-mark">{sortLabel(sortConfig, 'payment')}</span></button></th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(bk => (
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
        {!loading && bookings.length > 0 && (
          <TableControls
            mode={paginationMode === 'cursor' ? 'cursor' : 'page'}
            page={Math.min(page, effectiveTotalPages)}
            pageSize={pageSize}
            totalRows={effectiveTotalRows}
            totalPages={effectiveTotalPages}
            hasPrevPage={cursorMeta.hasPrevPage}
            hasNextPage={cursorMeta.hasNextPage}
            onPrev={() => {
              setCursor(cursorMeta.prevCursor);
              setCursorDirection('prev');
              setPage(current => Math.max(current - 1, 1));
            }}
            onNext={() => {
              setCursor(cursorMeta.nextCursor);
              setCursorDirection('next');
              setPage(current => current + 1);
            }}
            onPageChange={(nextPage) => {
              setPage(nextPage);
              setCursor(null);
              setCursorDirection('next');
            }}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
              setCursor(null);
              setCursorDirection('next');
            }}
          />
        )}
      </div>
    </div>
  );
}

export default AdminBookings;
