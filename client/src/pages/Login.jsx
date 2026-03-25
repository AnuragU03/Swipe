import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, register, reviewerLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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
        await register(email.trim(), password, name.trim());
        navigate('/', { replace: true });
      } else {
        try {
          await login(email.trim(), password);
          navigate('/', { replace: true });
          return;
        } catch (senderError) {
          try {
            await reviewerLogin(email.trim(), password);
            navigate('/reviewer', { replace: true });
            return;
          } catch {
            throw senderError;
          }
        }
      }
    } catch (err) {
      setError(err.message || 'Authentication failed');
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
            Collaborative Creative Review Platform
          </div>
        </div>

        <form onSubmit={handleSubmit} className="fade-in" style={{ animationDelay: '0.1s' }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16, textAlign: 'center' }}>
            {isRegister ? 'Create Account' : 'Welcome Back'}
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
              {!isRegister && (
                <button
                  type="button"
                  className="link-button"
                  onClick={() => setError('Please contact the support staff or the admin')}
                  style={{ marginTop: 10 }}
                >
                  Forgot Password?
                </button>
              )}
            </div>

            {error && <div className="error-box">{error}</div>}

            <button
              type="submit"
              className="btn-accent"
              disabled={loading}
              style={{ marginTop: 2, width: '100%' }}
            >
              {loading ? 'Please wait...' : isRegister ? 'Create Account' : 'Sign In'}
            </button>
          </div>
        </form>

        <div className="fade-in" style={{ textAlign: 'center', marginTop: 14, fontSize: 13, color: 'var(--sub)', animationDelay: '0.2s' }}>
          {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
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
