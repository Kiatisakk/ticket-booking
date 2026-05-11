import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import TableControls from '../../../components/TableControls';
import { nextSortConfig, sortLabel } from '../../../utils/tableView';
import './UserManagement.css';

const API_URL = 'http://localhost:4000/api';

function formatDate(dt) {
  if (!dt) return '-';
  return new Date(dt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function UserManagement() {
  const { adminToken } = useAdminAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [roleChanging, setRoleChanging] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'asc' });
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [cursor, setCursor] = useState(null);
  const [cursorDirection, setCursorDirection] = useState('next');
  const [cursorMeta, setCursorMeta] = useState({ hasNextPage: false, hasPrevPage: false, nextCursor: null, prevCursor: null });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/admin/users`, {
        headers: { Authorization: `Bearer ${adminToken}` },
        params: {
          pagination: 'cursor',
          pageSize,
          cursor: cursor || undefined,
          direction: cursorDirection,
          search: search || undefined,
          role: roleFilter
        }
      });
      const payload = Array.isArray(res.data) ? { data: res.data, total: res.data.length } : res.data;
      setUsers(payload.data || []);
      setTotalRows(payload.total || 0);
      setCursorMeta(payload.pagination || { hasNextPage: false, hasPrevPage: false, nextCursor: null, prevCursor: null });
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  }, [adminToken, pageSize, cursor, cursorDirection, search, roleFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const pageRows = users;

  useEffect(() => {
    setPage(1);
    setCursor(null);
    setCursorDirection('next');
  }, [search, roleFilter, pageSize]);

  const handleSort = (key) => {
    setSortConfig(current => nextSortConfig(current, key));
    setPage(1);
    setCursor(null);
    setCursorDirection('next');
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setProcessing(true);
    try {
      await axios.delete(`${API_URL}/admin/users/${deleteTarget.id}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      setUsers(prev => prev.filter(u => u.id !== deleteTarget.id));
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to delete user');
    } finally {
      setProcessing(false);
      setDeleteTarget(null);
    }
  };

  const handleRoleChange = async (userId, newRoleId) => {
    setRoleChanging(userId);
    try {
      const res = await axios.patch(`${API_URL}/admin/users/${userId}/role`, { roleId: newRoleId }, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      setUsers(prev => prev.map(u =>
        u.id === userId ? { ...u, role: res.data.role, roleId: newRoleId } : u
      ));
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to update role');
    } finally {
      setRoleChanging(null);
    }
  };

  const totalCustomers = users.filter(u => u.role === 'Customer').length;
  const totalAdmins = users.filter(u => u.role === 'Admin').length;
  const totalStaff = users.filter(u => u.role === 'Staff').length;

  return (
    <div className="um-root">
      <div className="um-header">
        <div>
          <div className="um-title">User Management</div>
          <div className="um-subtitle">{users.length} total users · {totalCustomers} customers · {totalStaff} staff · {totalAdmins} admins</div>
        </div>
      </div>

      <div className="um-filters">
        <input
          className="um-search"
          type="text"
          placeholder="Search by name, email, or ID..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="um-filter-select" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
          <option value="All">All Roles</option>
          <option value="Customer">Customer</option>
          <option value="Staff">Staff</option>
          <option value="Admin">Admin</option>
        </select>
      </div>

      <div className="um-table-wrap">
        <div className="um-table-scroll">
          {loading ? (
            <div className="um-loading">Loading users...</div>
          ) : users.length === 0 ? (
            <div className="um-empty">No users found</div>
          ) : (
            <table className="um-table">
              <thead>
                <tr>
                  <th className="sortable-th"><button type="button" onClick={() => handleSort('id')}>ID <span className="sort-mark">{sortLabel(sortConfig, 'id')}</span></button></th>
                  <th className="sortable-th"><button type="button" onClick={() => handleSort('name')}>Name <span className="sort-mark">{sortLabel(sortConfig, 'name')}</span></button></th>
                  <th className="sortable-th"><button type="button" onClick={() => handleSort('email')}>Email <span className="sort-mark">{sortLabel(sortConfig, 'email')}</span></button></th>
                  <th className="sortable-th"><button type="button" onClick={() => handleSort('role')}>Role <span className="sort-mark">{sortLabel(sortConfig, 'role')}</span></button></th>
                  <th className="sortable-th"><button type="button" onClick={() => handleSort('bookings')}>Bookings <span className="sort-mark">{sortLabel(sortConfig, 'bookings')}</span></button></th>
                  <th className="sortable-th"><button type="button" onClick={() => handleSort('registered')}>Registered <span className="sort-mark">{sortLabel(sortConfig, 'registered')}</span></button></th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(user => (
                  <tr key={user.id}>
                    <td className="um-mono">#{user.id}</td>
                    <td>
                      <div className="um-user-cell">
                        <div className="um-avatar">{user.fullName?.charAt(0)?.toUpperCase() || '?'}</div>
                        <span>{user.fullName}</span>
                      </div>
                    </td>
                    <td className="um-mono">{user.email}</td>
                    <td>
                      <span className={`um-role-badge um-role-${user.role?.toLowerCase()}`}>{user.role}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>{user.bookingsCount}</td>
                    <td style={{ color: '#94a3b8', fontSize: '12px' }}>{formatDate(user.createdAt)}</td>
                    <td>
                      {user.role === 'Admin' ? (
                        <span className="um-dash">-</span>
                      ) : user.bookingsCount > 0 ? (
                        <select
                          className="um-role-select"
                          value={user.roleId}
                          onChange={e => handleRoleChange(user.id, parseInt(e.target.value))}
                          disabled={roleChanging === user.id}
                        >
                          <option value={2}>Staff</option>
                          <option value={3}>Customer</option>
                        </select>
                      ) : (
                        <div className="um-action-group">
                          <select
                            className="um-role-select"
                            value={user.roleId}
                            onChange={e => handleRoleChange(user.id, parseInt(e.target.value))}
                            disabled={roleChanging === user.id}
                          >
                            <option value={2}>Staff</option>
                            <option value={3}>Customer</option>
                          </select>
                          <button className="um-delete-btn" onClick={() => setDeleteTarget(user)}>
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {!loading && users.length > 0 && (
          <TableControls
            mode="cursor"
            page={page}
            pageSize={pageSize}
            totalRows={totalRows}
            totalPages={1}
            hasPrevPage={cursorMeta.hasPrevPage}
            hasNextPage={cursorMeta.hasNextPage}
            onPrev={() => {
              setCursor(cursorMeta.prevCursor);
              setCursorDirection('prev');
            }}
            onNext={() => {
              setCursor(cursorMeta.nextCursor);
              setCursorDirection('next');
            }}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCursor(null);
              setCursorDirection('next');
            }}
          />
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="um-modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="um-modal" onClick={e => e.stopPropagation()}>
            <div className="um-modal-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            </div>
            <div className="um-modal-title">Delete User</div>
            <div className="um-modal-info">
              <div className="um-modal-row">
                <span>User</span>
                <strong>{deleteTarget.fullName}</strong>
              </div>
              <div className="um-modal-row">
                <span>Email</span>
                <strong>{deleteTarget.email}</strong>
              </div>
            </div>
            <div className="um-modal-warning">
              This will permanently delete this user account. This action cannot be undone.
            </div>
            <div className="um-modal-actions">
              <button className="um-modal-cancel" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="um-modal-confirm" onClick={handleDelete} disabled={processing}>
                {processing ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserManagement;
