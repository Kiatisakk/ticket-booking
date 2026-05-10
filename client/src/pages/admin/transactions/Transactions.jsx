import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import TableControls from '../../../components/TableControls';
import { getPageRows, getTotalPages, nextSortConfig, sortLabel, sortRows } from '../../../utils/tableView';
import './Transactions.css';

const API_URL = 'http://localhost:4000/api';

const MOCK_TRANSACTIONS = [
  { id: 1, bookingId: 1001, transactionId: 'TXN-9f3a21', method: 'Credit Card', amount: 2500, date: '2025-04-12T10:22:00Z', status: 'Success', user: 'Alice Johnson' },
  { id: 2, bookingId: 1002, transactionId: 'TXN-b2e88c', method: 'PromptPay',   amount:  700, date: '2025-04-11T14:05:00Z', status: 'Failed',  user: 'Bob Smith' },
  { id: 3, bookingId: 1004, transactionId: 'TXN-a1b2c3', method: 'Credit Card', amount:  350, date: '2025-04-09T16:45:00Z', status: 'Pending', user: 'Dan Lee' },
  { id: 4, bookingId: 1005, transactionId: 'TXN-d4e5f6', method: 'PromptPay',   amount:  900, date: '2025-04-08T11:15:00Z', status: 'Failed',  user: 'Eve Martinez' }
];

function getStatusClass(status) {
  switch (status?.toLowerCase()) {
    case 'success':   return 'tx-badge tx-badge-completed';
    case 'failed':    return 'tx-badge tx-badge-failed';
    case 'pending':   return 'tx-badge tx-badge-pending';
    case 'completed': return 'tx-badge tx-badge-completed';
    case 'refunded':  return 'tx-badge tx-badge-refunded';
    default:          return 'tx-badge tx-badge-pending';
  }
}

function formatDate(dt) {
  if (!dt) return '-';
  return new Date(dt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function Transactions() {
  const { adminToken } = useAdminAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [methodFilter, setMethodFilter] = useState('All');
  const [paidTarget, setPaidTarget] = useState(null);
  const [refundTarget, setRefundTarget] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter !== 'All') params.status = statusFilter;
      if (methodFilter !== 'All') params.method = methodFilter;

      const res = await axios.get(`${API_URL}/admin/transactions`, {
        headers: { Authorization: `Bearer ${adminToken}` },
        params
      });
      setTransactions(res.data);
    } catch {
      setTransactions(MOCK_TRANSACTIONS);
    } finally {
      setLoading(false);
    }
  }, [adminToken, statusFilter, methodFilter]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const filtered = transactions.filter(t => {
    const matchSearch = !search ||
      t.bookingId?.toString().includes(search) ||
      t.transactionId?.includes(search) ||
      t.user?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'All' || t.status === statusFilter;
    const matchMethod = methodFilter === 'All' || t.method?.toLowerCase().includes(methodFilter.toLowerCase());
    return matchSearch && matchStatus && matchMethod;
  });
  const sortAccessors = {
    bookingId: t => t.bookingId,
    transactionId: t => t.transactionId,
    user: t => t.user,
    method: t => t.method,
    amount: t => t.amount,
    date: t => t.date,
    status: t => t.status
  };
  const sorted = sortRows(filtered, sortConfig, sortAccessors);
  const totalPages = getTotalPages(sorted.length, pageSize);
  const pageRows = getPageRows(sorted, Math.min(page, totalPages), pageSize);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, methodFilter, pageSize]);

  const handleSort = (key) => {
    setSortConfig(current => nextSortConfig(current, key));
    setPage(1);
  };

  // All failed transactions get a generic error reason (no errorMessage in DB)
  const handleMarkPaid = async () => {
    if (!paidTarget) return;
    setProcessing(true);
    try {
      await axios.patch(`${API_URL}/admin/transactions/${paidTarget.id}/mark-paid`, {}, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      setTransactions(prev => prev.map(t =>
        t.id === paidTarget.id ? { ...t, status: 'Completed' } : t
      ));
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to mark as paid');
    } finally {
      setProcessing(false);
      setPaidTarget(null);
    }
  };

  const handleRefund = async () => {
    if (!refundTarget) return;
    setProcessing(true);
    try {
      await axios.patch(`${API_URL}/admin/transactions/${refundTarget.id}/refund`, {}, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      setTransactions(prev => prev.map(t =>
        t.id === refundTarget.id ? { ...t, status: 'Refunded' } : t
      ));
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to refund transaction');
    } finally {
      setProcessing(false);
      setRefundTarget(null);
    }
  };

  return (
    <div className="tx-root">
      <div className="tx-header">
        <div>
          <div className="tx-title">Transactions</div>
          <div className="tx-subtitle">{filtered.length} transactions</div>
        </div>
      </div>

      <div className="tx-filters">
        <input
          className="tx-search"
          type="text"
          placeholder="Search by Booking ID, Transaction ID, or User..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="tx-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="All">All Status</option>
          <option value="Pending">Pending</option>
          <option value="Success">Success</option>
          <option value="Failed">Failed</option>
          <option value="Refunded">Refunded</option>
        </select>
        <select className="tx-filter-select" value={methodFilter} onChange={e => setMethodFilter(e.target.value)}>
          <option value="All">All Methods</option>
          <option value="Credit Card">Credit Card</option>
          <option value="PromptPay">PromptPay</option>
          <option value="TrueMoney">TrueMoney</option>
          <option value="ShopeePay">ShopeePay</option>
        </select>
      </div>

      <div className="tx-table-wrap">
        <div className="tx-table-scroll">
          {loading ? (
            <div className="tx-loading">Loading transactions...</div>
          ) : filtered.length === 0 ? (
            <div className="tx-empty">No transactions found</div>
          ) : (
            <table className="tx-table">
              <thead>
                <tr>
                  <th className="sortable-th"><button type="button" onClick={() => handleSort('bookingId')}>Booking ID <span className="sort-mark">{sortLabel(sortConfig, 'bookingId')}</span></button></th>
                  <th className="sortable-th"><button type="button" onClick={() => handleSort('transactionId')}>Transaction ID <span className="sort-mark">{sortLabel(sortConfig, 'transactionId')}</span></button></th>
                  <th className="sortable-th"><button type="button" onClick={() => handleSort('user')}>User <span className="sort-mark">{sortLabel(sortConfig, 'user')}</span></button></th>
                  <th className="sortable-th"><button type="button" onClick={() => handleSort('method')}>Method <span className="sort-mark">{sortLabel(sortConfig, 'method')}</span></button></th>
                  <th className="sortable-th"><button type="button" onClick={() => handleSort('amount')}>Amount (THB) <span className="sort-mark">{sortLabel(sortConfig, 'amount')}</span></button></th>
                  <th className="sortable-th"><button type="button" onClick={() => handleSort('date')}>Date <span className="sort-mark">{sortLabel(sortConfig, 'date')}</span></button></th>
                  <th className="sortable-th"><button type="button" onClick={() => handleSort('status')}>Status <span className="sort-mark">{sortLabel(sortConfig, 'status')}</span></button></th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(tx => (
                  <tr key={tx.id}>
                    <td className="tx-mono">#{tx.bookingId}</td>
                    <td className="tx-mono">{tx.transactionId}</td>
                    <td>
                      <div className="tx-user-cell">
                        <span className="tx-user-name">{tx.user}</span>
                        {tx.userRole && tx.userRole !== 'Customer' && (
                          <span className={`tx-role-badge tx-role-${tx.userRole?.toLowerCase()}`}>{tx.userRole}</span>
                        )}
                      </div>
                    </td>
                    <td>{tx.method}</td>
                    <td className="tx-amount">฿{Number(tx.amount).toLocaleString()}</td>
                    <td style={{ color: '#94a3b8', fontSize: '12px' }}>{formatDate(tx.date)}</td>
                    <td>
                      <span className={getStatusClass(tx.status)}>{tx.status}</span>
                    </td>
                    <td>
                      {tx.status === 'Failed' ? (
                        <button className="tx-mark-paid-btn" onClick={() => setPaidTarget(tx)}>
                          Mark as Paid
                        </button>
                      ) : tx.status === 'Success' ? (
                        <button className="tx-refund-btn" onClick={() => setRefundTarget(tx)}>
                          Refund
                        </button>
                      ) : (
                        <span className="tx-dash">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {!loading && filtered.length > 0 && (
          <TableControls
            page={Math.min(page, totalPages)}
            pageSize={pageSize}
            totalRows={sorted.length}
            totalPages={totalPages}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        )}
      </div>

      {/* Mark as Paid Modal */}
      {paidTarget && (
        <div className="tx-modal-overlay" onClick={() => setPaidTarget(null)}>
          <div className="tx-modal" onClick={e => e.stopPropagation()}>
            <div className="tx-modal-icon paid">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <div className="tx-modal-title">Mark as Paid</div>
            <div className="tx-modal-booking-info">
              <div className="tx-modal-booking-row">
                <span>Booking ID</span>
                <strong>#{paidTarget.bookingId}</strong>
              </div>
              <div className="tx-modal-booking-row">
                <span>Transaction</span>
                <strong>{paidTarget.transactionId}</strong>
              </div>
              <div className="tx-modal-booking-row">
                <span>Customer</span>
                <strong>{paidTarget.user}</strong>
              </div>
              <div className="tx-modal-booking-row">
                <span>Amount</span>
                <strong style={{ color: '#22c55e' }}>฿{Number(paidTarget.amount).toLocaleString()}</strong>
              </div>
            </div>
            <div className="tx-modal-warning" style={{ background: 'rgba(34,197,94,0.08)', borderColor: 'rgba(34,197,94,0.2)', color: '#4ade80' }}>
              This will mark the failed transaction as successfully completed and generate tickets.
            </div>
            <div className="tx-modal-actions">
              <button className="tx-modal-cancel" onClick={() => setPaidTarget(null)}>Cancel</button>
              <button className="tx-modal-confirm-paid" onClick={handleMarkPaid} disabled={processing}>
                {processing ? 'Processing...' : 'Confirm Mark as Paid'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {refundTarget && (
        <div className="tx-modal-overlay" onClick={() => setRefundTarget(null)}>
          <div className="tx-modal" onClick={e => e.stopPropagation()}>
            <div className="tx-modal-icon refund">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
            </div>
            <div className="tx-modal-title">Refund Transaction</div>
            <div className="tx-modal-booking-info">
              <div className="tx-modal-booking-row">
                <span>Booking ID</span>
                <strong>#{refundTarget.bookingId}</strong>
              </div>
              <div className="tx-modal-booking-row">
                <span>Transaction</span>
                <strong>{refundTarget.transactionId}</strong>
              </div>
              <div className="tx-modal-booking-row">
                <span>Customer</span>
                <strong>{refundTarget.user}</strong>
              </div>
              <div className="tx-modal-booking-row">
                <span>Refund Amount</span>
                <strong style={{ color: '#f59e0b' }}>฿{Number(refundTarget.amount).toLocaleString()}</strong>
              </div>
            </div>
            <div className="tx-modal-warning">
              This will refund the payment, cancel the booking, and revoke all associated tickets. This action cannot be undone.
            </div>
            <div className="tx-modal-actions">
              <button className="tx-modal-cancel" onClick={() => setRefundTarget(null)}>Cancel</button>
              <button className="tx-modal-confirm-refund" onClick={handleRefund} disabled={processing}>
                {processing ? 'Processing...' : 'Confirm Refund'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Transactions;
