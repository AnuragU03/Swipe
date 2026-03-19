import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function Dashboard() {
  const { creator, logout } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClientId, setSelectedClientId] = useState('all');

  const loadSessions = () => {
    setLoading(true);
    api
      .listSessions()
      .then((data) => setSessions(data.sessions || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const normalize = (value, fallback) => {
    const text = (value || '').trim();
    return text || fallback;
  };

  const groupedClients = useMemo(() => {
    const groups = sessions.reduce((acc, session) => {
      const clientId = session.clientId || `client-${normalize(session.clientName, 'unknown').toLowerCase()}`;
      const clientName = normalize(session.clientName, 'Unknown Client');
      const projectId = session.projectId || `project-${normalize(session.projectName, 'unknown').toLowerCase()}`;
      const projectName = normalize(session.projectName, 'Untitled Project');

      if (!acc[clientId]) {
        acc[clientId] = {
          clientId,
          clientName,
          projects: {},
        };
      }

      if (!acc[clientId].projects[projectId]) {
        acc[clientId].projects[projectId] = {
          projectId,
          projectName,
          sessions: [],
        };
      }

      acc[clientId].projects[projectId].sessions.push(session);
      return acc;
    }, {});

    return Object.values(groups)
      .map((client) => ({
        ...client,
        projects: Object.values(client.projects)
          .map((project) => ({
            ...project,
            sessions: [...project.sessions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
          }))
          .sort((a, b) => a.projectName.localeCompare(b.projectName)),
      }))
      .sort((a, b) => a.clientName.localeCompare(b.clientName));
  }, [sessions]);

  useEffect(() => {
    if (selectedClientId === 'all') return;
    const exists = groupedClients.some((client) => client.clientId === selectedClientId);
    if (!exists) {
      setSelectedClientId('all');
    }
  }, [groupedClients, selectedClientId]);

  const visibleClients = useMemo(() => {
    if (selectedClientId === 'all') return groupedClients;
    return groupedClients.filter((client) => client.clientId === selectedClientId);
  }, [groupedClients, selectedClientId]);

  const openProjects = groupedClients.reduce(
    (sum, client) =>
      sum +
      client.projects.filter((project) =>
        project.sessions.some((session) => (session.status || '').toLowerCase() !== 'closed')
      ).length,
    0
  );

  const feedbackGiven = sessions.reduce((sum, session) => sum + (Number(session.submissionCount) || 0), 0);

  const renderStatus = (status) => {
    const normalized = String(status || 'draft').toLowerCase();
    const cls = normalized === 'active' ? 'badge-active' : normalized === 'closed' ? 'badge-closed' : 'badge-draft';
    return <span className={`badge ${cls}`}>{normalized}</span>;
  };

  return (
    <div className="app-shell">
      <div className="page">
        <div className="header-bar anim-fade-up" style={{ marginBottom: 20 }}>
          <div>
            <div className="logo">
              Creative<span>Swipe</span>
            </div>
            <div style={{ fontSize: 14, color: 'var(--sub)', marginTop: 4 }}>
              Welcome, {creator?.name || creator?.email || 'Creator'}
            </div>
          </div>
          <button className="btn-ghost" onClick={logout}>
            Logout
          </button>
        </div>

        <div className="stats-grid-3 anim-fade-up" style={{ marginBottom: 18 }}>
          <div className="stat-card glass-card">
            <div className="num">{openProjects}</div>
            <div className="label">Open Project</div>
          </div>
          <div className="stat-card glass-card">
            <div className="num" style={{ color: 'var(--like)' }}>
              {feedbackGiven}
            </div>
            <div className="label">Feedback Given</div>
          </div>
          <div className="stat-card glass-card">
            <div className="num" style={{ color: 'var(--accent)' }}>
              {groupedClients.length}
            </div>
            <div className="label">No of Clients</div>
          </div>
        </div>

        <div className="glass-panel anim-fade-up" style={{ marginBottom: 14, padding: 14 }}>
          <label className="field-label">Select Client</label>
          <select
            className="field"
            value={selectedClientId}
            onChange={(event) => setSelectedClientId(event.target.value)}
            style={{ cursor: 'pointer' }}
          >
            <option value="all">All Clients</option>
            {groupedClients.map((client) => (
              <option key={client.clientId} value={client.clientId}>
                {client.clientName}
              </option>
            ))}
          </select>
        </div>

        <button
          className="btn-accent anim-fade-up"
          onClick={() => navigate('/sessions/new')}
          style={{ marginBottom: 24 }}
        >
          + New Review Session
        </button>

        <div className="anim-fade-up" style={{ animationDelay: '0.1s' }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--sub)', marginBottom: 14, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Project Reviews
          </h3>

          {loading ? (
            <div className="loading-screen" style={{ height: 180 }}>
              <div className="spinner" />
            </div>
          ) : visibleClients.length === 0 ? (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--sub)', fontSize: 14 }}>
              No sessions yet. Create your first review session.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {visibleClients.map((client) => (
                <div key={client.clientId} className="dashboard-client-card fade-in">
                  <div className="dashboard-card-header" style={{ marginBottom: 10 }}>
                    <div>
                      <div className="dashboard-client-title">{client.clientName}</div>
                      <div className="dashboard-client-meta">
                        {client.projects.length} project{client.projects.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>

                  <div className="dashboard-project-list">
                    {client.projects.map((project) => (
                      <div key={project.projectId} className="dashboard-project-card">
                        {(() => {
                          const latestSession = project.sessions[0] || null;
                          const projectStatus = project.sessions.some((item) => String(item.status || '').toLowerCase() === 'active')
                            ? 'active'
                            : project.sessions.every((item) => String(item.status || '').toLowerCase() === 'closed')
                              ? 'closed'
                              : 'draft';

                          const projectImages = project.sessions
                            .flatMap((item) => item.previewImages || [])
                            .filter((image, idx, list) => image?.id && list.findIndex((candidate) => candidate.id === image.id) === idx)
                            .slice(0, 16);

                          const projectPostCount = project.sessions.reduce(
                            (sum, item) => sum + (Number(item.postCount) || 0),
                            0
                          );
                          const hasAnyUploads = project.sessions.some((item) => (Number(item.imageCount) || 0) > 0);
                          const resolvedPostCount = projectPostCount > 0 ? projectPostCount : hasAnyUploads ? 1 : 0;

                          const reviewerMap = new Map();
                          project.sessions.forEach((item) => {
                            (item.reviewerProgress || []).forEach((reviewer) => {
                              const email = String(reviewer.email || '').toLowerCase().trim();
                              if (!email) return;
                              const existing = reviewerMap.get(email) || {
                                name: reviewer.name || email,
                                email,
                                total: 0,
                                done: 0,
                              };

                              existing.total += 1;
                              if (String(reviewer.status || '').toLowerCase() === 'done') {
                                existing.done += 1;
                              }
                              if (!existing.name && reviewer.name) {
                                existing.name = reviewer.name;
                              }
                              reviewerMap.set(email, existing);
                            });
                          });

                          const reviewerProgress = Array.from(reviewerMap.values())
                            .map((reviewer) => ({
                              ...reviewer,
                              status: reviewer.done > 0 ? 'done' : 'pending',
                            }))
                            .sort((a, b) => a.name.localeCompare(b.name));

                          return (
                            <div
                              className="session-item"
                              onClick={() => latestSession && navigate(`/sessions/${latestSession.id}`)}
                            >
                              <div className="dashboard-thumb-scroll">
                                {projectImages.length > 0 ? (
                                  projectImages.map((image) => (
                                    <div key={image.id} className="dashboard-thumb-wrap">
                                      <img
                                        src={image.url}
                                        alt={image.fileName || 'Creative asset'}
                                        className="dashboard-thumb"
                                      />
                                      {Number(image.rowOrder) > 0 && (
                                        <span className="dashboard-post-badge">P{image.rowOrder}</span>
                                      )}
                                    </div>
                                  ))
                                ) : (
                                  <div className="dashboard-thumb-empty">No uploaded images</div>
                                )}
                              </div>

                              <div className="dashboard-session-topline">
                                <div className="dashboard-project-title">{project.projectName}</div>
                                <div>{renderStatus(projectStatus)}</div>
                              </div>

                              <div style={{ fontSize: 12, color: 'var(--sub)', marginTop: 4, marginBottom: 8 }}>
                                {project.sessions.length} session{project.sessions.length !== 1 ? 's' : ''} · {resolvedPostCount} post{resolvedPostCount !== 1 ? 's' : ''} · {projectImages.length > 0 ? projectImages.length : project.sessions.reduce((sum, item) => sum + (Number(item.imageCount) || 0), 0)} image(s)
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {reviewerProgress.length > 0 ? (
                                  reviewerProgress.map((reviewer) => (
                                    <div key={`${project.projectId}-${reviewer.email}`} className="dashboard-reviewer-row">
                                      <div className="dashboard-reviewer-name">{reviewer.name || reviewer.email}</div>
                                      <div className={`dashboard-reviewer-state ${reviewer.status === 'done' ? 'dashboard-reviewer-done' : 'dashboard-reviewer-pending'}`}>
                                        {reviewer.status === 'done' ? 'Done' : 'Pending'}
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <div className="dashboard-client-meta">No reviewer activity yet</div>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
