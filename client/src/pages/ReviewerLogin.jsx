import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ReviewerLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { reviewerLogin, reviewerRegister, reviewer, loading: authLoading } = useAuth();

  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && reviewer) {
      navigate('/reviewer', { replace: true });
    }
  }, [authLoading, reviewer, navigate]);

  useEffect(() => {
    const state = location.state || {};
    if (state.mode === 'register') setIsRegister(true);
    if (state.mode === 'login') setIsRegister(false);
    if (typeof state.email === 'string') setEmail(state.email);
    if (typeof state.name === 'string') setName(state.name);
  }, [location.state]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        await reviewerRegister(name.trim(), email.trim(), password);
      } else {
        await reviewerLogin(email.trim(), password);
      }
      navigate('/reviewer', { replace: true });
    } catch (err) {
      if (!isRegister && err?.data?.code === 'RECEIVER_ACCOUNT_NOT_FOUND') {
        setIsRegister(true);
        setError('No receiver account was found for this email. Create one to continue.');
      } else {
        setError(err.message || 'Authentication failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell" style={{ minHeight: '100vh', justifyContent: 'center' }}>
      <div style={{ maxWidth: 520, width: '100%', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }} className="fade-in">
          <div className="logo" style={{ fontSize: 28, marginBottom: 6 }}>
            Creative<span>Swipe</span>
          </div>
          <div style={{ color: 'var(--sub)', fontSize: 13 }}>
            Receiver Dashboard Access
          </div>
        </div>

        <form onSubmit={handleSubmit} className="fade-in" style={{ animationDelay: '0.1s' }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16, textAlign: 'center' }}>
            {isRegister ? 'Create Receiver Account' : 'Receiver Sign In'}
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {isRegister && (
              <div>
                <label className="field-label">Name</label>
                <input
                  className="field"
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            )}

            <div>
              <label className="field-label">Email</label>
              <input
                className="field"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="field-label">Password</label>
              <input
                className="field"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            {error && <div className="error-box">{error}</div>}

            <button
              type="submit"
              className="btn-accent"
              disabled={loading}
              style={{ marginTop: 2, width: '100%' }}
            >
              {loading ? 'Please wait...' : isRegister ? 'Create Account' : 'Open Receiver Dashboard'}
            </button>

            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate('/login')}
              style={{ width: '100%' }}
            >
              Go to Sender Login
            </button>
          </div>
        </form>

        <div className="fade-in" style={{ textAlign: 'center', marginTop: 14, fontSize: 13, color: 'var(--sub)', animationDelay: '0.2s' }}>
          {isRegister ? 'Already have a receiver account?' : "Don't have a receiver account?"}{' '}
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError('');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent)',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            {isRegister ? 'Sign In' : 'Register'}
          </button>
        </div>
      </div>
    </div>
  );
}
