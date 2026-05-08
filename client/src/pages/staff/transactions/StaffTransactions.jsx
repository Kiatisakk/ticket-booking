import React, { useEffect, useState } from 'react';
import './StaffTransactions.css';

const StaffTransactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchTransactions();
  }, [statusFilter]);

  const fetchTransactions = async () => {
    try {
      const token = localStorage.getItem('staffToken');
      const url = new URL('http://localhost:4000/api/staff/transactions');
      if (statusFilter) {
        url.searchParams.append('status', statusFilter);
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch transactions');
      const data = await response.json();
      setTransactions(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="staff-transactions">
      <div className="transactions-header">
        <h2>My Event Transactions</h2>
        <p className="subtitle">View all bookings from events you created</p>
      </div>

      <div className="filter-section">
        <label htmlFor="status-filter">Filter by Payment Status:</label>
        <select 
          id="status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All</option>
          <option value="Success">Success</option>
          <option value="Pending">Pending</option>
          <option value="Failed">Failed</option>
          <option value="Refunded">Refunded</option>
        </select>
      </div>

      {error && <div className="error-message">{error}</div>}

      {transactions.length === 0 ? (
        <div className="no-transactions">
          <p>No transactions found</p>
        </div>
      ) : (
        <div className="transactions-container">
          {transactions.map((transaction) => (
            <div key={transaction.id} className="transaction-card">
              <div className="transaction-header">
                <div>
                  <h3>{transaction.customerName}</h3>
                  <p className="customer-email">{transaction.customerEmail}</p>
                </div>
                <div className="transaction-amount">
                  <span className="amount">฿{transaction.totalAmount.toFixed(2)}</span>
                  <span className={`payment-status ${transaction.paymentStatus.toLowerCase()}`}>
                    {transaction.paymentStatus}
                  </span>
                </div>
              </div>

              <div className="transaction-details">
                <div className="detail-row">
                  <span className="detail-label">Booking Date:</span>
                  <span>{new Date(transaction.bookingDate).toLocaleString('th-TH')}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Booking Status:</span>
                  <span>{transaction.bookingStatus}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Payment Method:</span>
                  <span>{transaction.paymentMethod}</span>
                </div>
                {transaction.transactionId && (
                  <div className="detail-row">
                    <span className="detail-label">Transaction ID:</span>
                    <span className="transaction-id">{transaction.transactionId}</span>
                  </div>
                )}
              </div>

              <div className="transaction-items">
                <h4>Booked Items</h4>
                {transaction.items?.map((item, idx) => (
                  <div key={idx} className="item">
                    <div className="item-info">
                      <strong>{item.eventName}</strong>
                      <span className="venue">{item.venueName}</span>
                      <span className="showtime">
                        {new Date(item.showtime).toLocaleString('th-TH')}
                      </span>
                      <span className="seat">Seat: {item.seat}</span>
                    </div>
                    <div className="item-price">
                      ฿{item.price.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StaffTransactions;
