import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
// เช็ก Path ของ AuthContext ให้ถูกต้อง (ถอยหลัง 3 โฟลเดอร์เพื่อเข้าหา src/context)
import { useAuth } from '../../../context/AuthContext';
import './Register.css';

function Register() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (password !== confirmPassword) {
      return setError('Passwords do not match');
    }

    setIsLoading(true);

    try {
      const result = await register(fullName, email, password);
      
      if (result.success) {
        navigate('/events');
      } else {
        setError(result.error || 'Registration failed');
      }
    } catch (err) {
      setError('An unexpected error occurred.');
    }

    setIsLoading(false);
  };

  return (
    <div className="register-container">
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
            <button className="tab" type="button" onClick={() => navigate('/')}>Sign In</button>
            <button className="tab active" type="button">Register</button>
          </div>

          {/* Register Form */}
          <form onSubmit={handleSubmit} className="form-panel active">
            <div className="field">
              <label htmlFor="fullName">Full Name</label>
              <input
                type="text"
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                required
                disabled={isLoading}
              />
            </div>

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
              <div className="password-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  required
                  disabled={isLoading}
                  minLength={6}
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            <div className="field">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <div className="password-wrapper">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  required
                  disabled={isLoading}
                  minLength={6}
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && <div className="error-message">{error}</div>}

            {/* Submit Button */}
            <button type="submit" className="btn" disabled={isLoading}>
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </button>

            {/* Terms */}
            <p className="terms">
              By registering you agree to our <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Register;