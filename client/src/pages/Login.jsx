import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        await register(email, password, name);
      } else {
        await login(email, password);
      }
      navigate('/');
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ maxWidth: 420, width: '100%', margin: '0 auto', padding: '0 20px' }}>

        {/* Hero icon + branding */}
        <div style={{ textAlign: 'center', marginBottom: 40 }} className="fade-in">
          <div style={{
            width: 72, height: 72, borderRadius: 20, margin: '0 auto 20px',
            background: 'linear-gradient(135deg, var(--accent), #a78bfa)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32, transform: 'rotate(-6deg)',
            boxShadow: '0 8px 32px rgba(168,85,247,0.35)',
          }}>🎨</div>
          <div className="logo" style={{ fontSize: 28, marginBottom: 6 }}>
            Creative<span>Swipe</span>
          </div>
          <div style={{ color: 'var(--sub)', fontSize: 13 }}>
            Collaborative Creative Review Platform
          </div>
        </div>

        {/* Glass form panel */}
        <form onSubmit={handleSubmit} className="glass-panel fade-in" style={{ animationDelay: '0.1s', padding: 28 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 24, textAlign: 'center' }}>
            {isRegister ? 'Create Account' : 'Welcome Back'}
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
                placeholder="••••••••"
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
              style={{ marginTop: 8, width: '100%' }}
            >
              {loading ? 'Please wait…' : isRegister ? 'Create Account' : 'Sign In'}
            </button>
          </div>
        </form>

        {/* Toggle */}
        <div className="fade-in" style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: 'var(--sub)', animationDelay: '0.2s' }}>
          {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            onClick={() => { setIsRegister(!isRegister); setError(''); }}
            style={{
              background: 'none', border: 'none',
              color: 'var(--accent)', fontWeight: 700,
              cursor: 'pointer', fontSize: 13,
            }}
          >
            {isRegister ? 'Sign In' : 'Register'}
          </button>
        </div>
      </div>
    </div>
  );
}
