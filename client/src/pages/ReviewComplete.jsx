import React, { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import api from '../services/api';

export default function ReviewComplete() {
  const { sessionId } = useParams();
  const location = useLocation();
  const state = location.state || {};
  const { totalImages = 0, liked = 0, disliked = 0, annotationCount = 0 } = state;
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setHistoryLoading(true);

    api
      .getReviewerProjectHistory(sessionId)
      .then((data) => {
        if (!mounted) return;
        setHistoryData(data.history || []);
      })
      .catch(() => {
        if (!mounted) return;
        setHistoryData([]);
      })
      .finally(() => {
        if (mounted) setHistoryLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [sessionId]);

  return (
    <div className="app-shell complete-screen">
      {/* Floating emoji */}
      <div className="complete-emoji" style={{ fontSize: 80, marginBottom: 16 }}>🎉</div>

      <div className="fade-in">
        <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 8 }}>
          Thank You!
        </h1>
        <p style={{ color: 'var(--sub)', fontSize: 15, lineHeight: 1.6, maxWidth: 320, margin: '0 auto' }}>
          Your feedback has been submitted successfully.
          The creative team will review your input.
        </p>
      </div>

      {/* Summary stats */}
      <div className="fade-in" style={{ display: 'flex', gap: 12, marginTop: 28, animationDelay: '0.15s' }}>
        <div className="stat-card glass-card" style={{ minWidth: 85, flex: 1 }}>
          <div className="num" style={{ fontSize: 32, color: 'var(--like)' }}>{liked}</div>
          <div className="label">Approved</div>
        </div>
        <div className="stat-card glass-card" style={{ minWidth: 85, flex: 1 }}>
          <div className="num" style={{ fontSize: 32, color: 'var(--dislike)' }}>{disliked}</div>
          <div className="label">Rejected</div>
        </div>
        {annotationCount > 0 && (
          <div className="stat-card glass-card" style={{ minWidth: 85, flex: 1 }}>
            <div className="num" style={{ fontSize: 32, color: 'var(--accent)' }}>{annotationCount}</div>
            <div className="label">Notes</div>
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="glass-panel fade-in" style={{ padding: '16px 24px', marginTop: 24, fontSize: 14, color: 'var(--sub)', lineHeight: 1.8, animationDelay: '0.25s', maxWidth: 360 }}>
        <div>📊 <strong style={{ color: 'var(--text)' }}>{totalImages}</strong> images reviewed</div>
        <div>🔒 Your review link is now used and cannot be resubmitted</div>
      </div>

      <div className="glass-panel fade-in" style={{ padding: '16px 18px', marginTop: 16, width: '100%', maxWidth: 520, animationDelay: '0.3s' }}>
        <div style={{ fontSize: 12, letterSpacing: '0.08em', color: 'var(--sub)', textTransform: 'uppercase', marginBottom: 10 }}>
          Your Project History
        </div>

        {historyLoading ? (
          <div style={{ color: 'var(--sub)', fontSize: 13 }}>Loading history…</div>
        ) : historyData.length === 0 ? (
          <div style={{ color: 'var(--sub)', fontSize: 13 }}>No previous submissions found for this project.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {historyData.map((entry) => (
              <div
                key={`${entry.sessionId}-${entry.submittedAt}`}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  padding: '10px 12px',
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 8,
                  alignItems: 'center',
                  background: 'rgba(255,255,255,0.02)',
                }}
              >
                <div>
                  <div style={{ color: 'var(--text)', fontWeight: 700, fontSize: 13 }}>
                    {entry.sessionTitle}
                  </div>
                  <div style={{ color: 'var(--sub)', fontSize: 12, marginTop: 2 }}>
                    {new Date(entry.submittedAt).toLocaleString()} · {entry.totalImagesReviewed} reviewed
                  </div>
                </div>

                <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--sub)' }}>
                  <div style={{ color: 'var(--like)', fontWeight: 700 }}>{entry.liked} approved</div>
                  <div style={{ color: 'var(--dislike)', fontWeight: 700 }}>{entry.disliked} rejected</div>
                  {entry.annotationCount > 0 && (
                    <div style={{ color: 'var(--accent)', fontWeight: 700 }}>{entry.annotationCount} notes</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Branding footer */}
      <div className="fade-in" style={{ marginTop: 32, animationDelay: '0.35s' }}>
        <div className="logo" style={{ fontSize: 18, opacity: 0.4 }}>
          Creative<span>Swipe</span>
        </div>
      </div>
    </div>
  );
}
