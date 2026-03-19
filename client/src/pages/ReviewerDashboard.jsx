import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function ReviewerDashboard() {
  const navigate = useNavigate();
  const { reviewer, reviewerLogout } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .listReviewerSessions()
      .then((data) => setSessions(data.sessions || []))
      .catch((err) => setError(err.message || 'Failed to load sessions'))
      .finally(() => setLoading(false));
  }, []);

  const timeAgo = (dateStr) => {
    if (!dateStr) return 'just now';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="app-shell">
      <div className="page">
        <div className="header-bar anim-fade-up" style={{ marginBottom: 24 }}>
          <div>
            <div className="logo">
              Creative<span>Swipe</span>
            </div>
            <div style={{ fontSize: 14, color: 'var(--sub)', marginTop: 4 }}>
              Reviewer: {reviewer?.name || reviewer?.email || 'Account'}
            </div>
          </div>
          <button className="btn-ghost" onClick={reviewerLogout}>Logout</button>
        </div>

        <div style={{ marginBottom: 18, color: 'var(--sub)', fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Assigned Projects
        </div>

        {loading ? (
          <div className="loading-screen" style={{ height: 180 }}>
            <div className="spinner" />
          </div>
        ) : error ? (
          <div className="error-box">{error}</div>
        ) : sessions.length === 0 ? (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--sub)' }}>
            No shared projects yet. Open a sender link to claim a project.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {sessions.map((session) => (
              <div
                key={session.id}
                className="session-item"
                onClick={() => navigate(`/r/${session.id}`)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{session.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 2 }}>
                      {session.clientName || 'Client'} · {session.projectName || 'Project'}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--sub)', marginTop: 4 }}>
                      {session.imageCount || 0} items · {session.submissionCount || 0} reviews
                    </div>
                  </div>
                  <span className={`badge ${session.status === 'active' ? 'badge-active' : 'badge-closed'}`}>
                    {session.status}
                  </span>
                </div>
                <div style={{ marginTop: 10, fontSize: 12, color: 'var(--sub)' }}>
                  Updated {timeAgo(session.updatedAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
