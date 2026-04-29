import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import './Login.css';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await login(email, password);

    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error);
    }

    setIsLoading(false);
  };

  return (
    <div className="login-container">
      {/* Background Blobs */}
      <div className="bg-blob blob1"></div>
      <div className="bg-blob blob2"></div>

      <div className="page">
        <div className="card">
          {/* Header */}
          <div className="logo">Ticket<span>App</span>.</div>
          <div className="logo-sub">Concerts · Movies · Events</div>

          {/* Tabs */}
          <div className="tabs">
            <button className="tab active" type="button">Sign In</button>
            <button className="tab" type="button" onClick={() => navigate('/register')}>Register</button>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="form-panel active">
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={isLoading}
              />
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={isLoading}
              />
            </div>

            {/* Error Message */}
            {error && <div className="error-message">{error}</div>}

            {/* Forgot Password Link */}
            <a href="#" className="forgot" onClick={(e) => e.preventDefault()}>Forgot password?</a>

            {/* Submit Button */}
            <button type="submit" className="btn" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>

            {/* Social Login Divider */}
            <div className="divider">or continue with</div>
            <button type="button" className="social-btn">
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>
          </form>

          {/* Demo Credentials */}
          <div className="demo-credentials">
            <p><strong>Demo Credentials:</strong></p>
            <p>Email: john@example.com</p>
            <p>Password: password123</p>
          </div>

        </div>
      </div>
    </div>
  );
}

export default Login;