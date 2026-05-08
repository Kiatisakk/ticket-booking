import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAdminAuth } from '../../../context/AdminAuthContext';
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

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/admin/users`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      setUsers(res.data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  }, [adminToken]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filtered = users.filter(u => {
    const matchSearch = !search ||
      u.fullName?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.id?.toString().includes(search);
    const matchRole = roleFilter === 'All' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

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
          ) : filtered.length === 0 ? (
            <div className="um-empty">No users found</div>
          ) : (
            <table className="um-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Bookings</th>
                  <th>Registered</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(user => (
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
