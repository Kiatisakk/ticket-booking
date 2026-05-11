import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import TableControls from '../../../components/TableControls';
import { nextSortConfig, sortLabel } from '../../../utils/tableView';
import './Transactions.css';

const API_URL = 'http://localhost:4000/api';

function getStatusClass(status) {
  switch (status?.toLowerCase()) {
    case 'success': return 'tx-badge tx-badge-completed';
    case 'failed': return 'tx-badge tx-badge-failed';
    case 'pending': return 'tx-badge tx-badge-pending';
    case 'completed': return 'tx-badge tx-badge-completed';
    default: return 'tx-badge tx-badge-pending';
  }
}

function formatDate(dt) {
  if (!dt) return '-';
  return new Date(dt).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function Transactions() {
  const { adminToken } = useAdminAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [methodFilter, setMethodFilter] = useState('All');
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        page,
        pageSize,
        sortBy: sortConfig.key,
        sortOrder: sortConfig.direction,
        search: search || undefined
      };
      if (statusFilter !== 'All') params.status = statusFilter;
      if (methodFilter !== 'All') params.method = methodFilter;

      const res = await axios.get(`${API_URL}/admin/transactions`, {
        headers: { Authorization: `Bearer ${adminToken}` },
        params
      });
      const payload = Array.isArray(res.data)
        ? { data: res.data, total: res.data.length, totalPages: 1 }
        : res.data;
      setTransactions(payload.data || []);
      setTotalRows(payload.total || 0);
      setTotalPages(payload.totalPages || 1);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load transactions');
      setTransactions([]);
      setTotalRows(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [adminToken, search, statusFilter, methodFilter, sortConfig, page, pageSize]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const pageRows = transactions;

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, methodFilter, pageSize]);

  const handleSort = (key) => {
    setSortConfig(current => nextSortConfig(current, key));
    setPage(1);
  };

  return (
    <div className="tx-root">
      <div className="tx-header">
        <div>
          <div className="tx-title">Transactions</div>
          <div className="tx-subtitle">{totalRows} read-only payment records</div>
        </div>
      </div>

      {error && <div className="tx-empty">{error}</div>}

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
          ) : transactions.length === 0 ? (
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
                  <th>Mode</th>
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
                    <td className="tx-amount">THB {Number(tx.amount).toLocaleString()}</td>
                    <td style={{ color: '#94a3b8', fontSize: '12px' }}>{formatDate(tx.date)}</td>
                    <td><span className={getStatusClass(tx.status)}>{tx.status}</span></td>
                    <td><span className="tx-dash">Read only</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {!loading && transactions.length > 0 && (
          <TableControls
            page={Math.min(page, totalPages)}
            pageSize={pageSize}
            totalRows={totalRows}
            totalPages={totalPages}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        )}
      </div>
    </div>
  );
}

export default Transactions;
