import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import { useAuth } from '../../../context/AuthContext';
import './AdminLogin.css';

function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { adminLogin } = useAdminAuth();
  const { setAuthSession } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await adminLogin(username, password);

    if (result.success) {
      setAuthSession(result.user, result.token);
      navigate('/admin/events');
    } else {
      setError(result.error);
    }

    setIsLoading(false);
  };

  return (
    <div className="admin-login-root">
      <div className="admin-login-blob admin-login-blob-1" />
      <div className="admin-login-blob admin-login-blob-2" />

      <div className="admin-login-card">
        <div className="admin-login-logo">
          Ticket<span>Admin</span>.
        </div>
        <div className="admin-login-subtitle">Administration &amp; Analytics Platform</div>

        <div className="admin-login-badge">
          <span className="admin-login-badge-dot" />
          System operational
        </div>

        <form onSubmit={handleSubmit}>
          <div className="admin-login-field">
            <label className="admin-login-label" htmlFor="username">Username</label>
            <input
              className="admin-login-input"
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin@example.com"
              required
              disabled={isLoading}
              autoComplete="username"
            />
          </div>

          <div className="admin-login-field">
            <label className="admin-login-label" htmlFor="password">Password</label>
            <input
              className="admin-login-input"
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={isLoading}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="admin-login-error">{error}</div>
          )}

          <button type="submit" className="admin-login-btn" disabled={isLoading}>
            {isLoading ? 'Signing in...' : 'Sign In to Admin'}
          </button>
        </form>

        <div className="admin-login-footer">
          <span className="admin-login-footer-dot" />
          System operational · TicketAdmin v1.0
        </div>
      </div>
    </div>
  );
}

export default AdminLogin;
