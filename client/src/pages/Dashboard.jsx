import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import RoleFlowToggle from '../components/RoleFlowToggle';

function normalize(value, fallback) {
  const text = String(value || '').trim();
  return text || fallback;
}

function formatRelativeTime(value) {
  if (!value) return 'No recent activity';
  const time = new Date(value).getTime();
  if (!time) return 'No recent activity';
  const delta = Math.max(0, Date.now() - time);
  const minutes = Math.floor(delta / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function isVideoAsset(image) {
  const source = String(image?.contentType || image?.fileName || '').toLowerCase();
  return source.startsWith('video/') || /\.(mp4|mov|avi|webm|mkv)$/i.test(source);
}

export default function Dashboard() {
  const { creator, logout } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClientId, setSelectedClientId] = useState('all');

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    api
      .listSessions()
      .then((data) => {
        if (mounted) setSessions(data.sessions || []);
      })
      .catch(() => {
        if (mounted) setSessions([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const groupedClients = useMemo(() => {
    const groups = sessions.reduce((acc, session) => {
      const clientId = session.clientId || `client-${normalize(session.clientName, 'unknown').toLowerCase()}`;
      const projectId = session.projectId || `project-${normalize(session.projectName, 'unknown').toLowerCase()}`;

      if (!acc[clientId]) {
        acc[clientId] = {
          clientId,
          clientName: normalize(session.clientName, 'Unknown Client'),
          projects: {},
        };
      }

      if (!acc[clientId].projects[projectId]) {
        acc[clientId].projects[projectId] = {
          projectId,
          projectName: normalize(session.projectName, 'Untitled Project'),
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
            sessions: [...project.sessions].sort(
              (left, right) => new Date(right.updatedAt || right.createdAt || 0) - new Date(left.updatedAt || left.createdAt || 0)
            ),
          }))
          .filter((project) =>
            project.sessions.some(
              (session) => (Number(session.imageCount) || 0) > 0 || (session.previewImages || []).length > 0
            )
          )
          .sort((left, right) => left.projectName.localeCompare(right.projectName)),
      }))
      .filter((client) => client.projects.length > 0)
      .sort((left, right) => left.clientName.localeCompare(right.clientName));
  }, [sessions]);

  useEffect(() => {
    if (selectedClientId === 'all') return;
    if (!groupedClients.some((client) => client.clientId === selectedClientId)) {
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
        project.sessions.some((session) => String(session.status || '').toLowerCase() !== 'closed')
      ).length,
    0
  );

  const feedbackGiven = sessions.reduce((sum, session) => sum + (Number(session.submissionCount) || 0), 0);

  const renderStatus = (status) => {
    const normalizedStatus = String(status || 'draft').toLowerCase();
    const cls =
      normalizedStatus === 'active'
        ? 'badge-active'
        : normalizedStatus === 'closed'
          ? 'badge-closed'
          : 'badge-draft';
    return <span className={`badge ${cls}`}>{normalizedStatus}</span>;
  };

  return (
    <div className="app-shell">
      <div className="page">
        <div className="header-bar anim-fade-up" style={{ marginBottom: 14 }}>
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

        <div className="anim-fade-up" style={{ marginBottom: 10 }}>
          <RoleFlowToggle active="sender" />
        </div>

        <button
          className="btn-accent anim-fade-up"
          onClick={() => navigate('/sessions/new')}
          style={{ marginBottom: 10 }}
        >
          + New Review Session
        </button>

        <div className="anim-fade-up" style={{ marginBottom: 12 }}>
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

        <div className="stats-grid-3 anim-fade-up" style={{ marginBottom: 14 }}>
          <div className="stat-card">
            <div className="num">{openProjects}</div>
            <div className="label">Open Project</div>
          </div>
          <div className="stat-card">
            <div className="num" style={{ color: 'var(--like)' }}>{feedbackGiven}</div>
            <div className="label">Feedback Given</div>
          </div>
          <div className="stat-card">
            <div className="num" style={{ color: 'var(--accent)' }}>{groupedClients.length}</div>
            <div className="label">No of Clients</div>
          </div>
        </div>

        <div className="anim-fade-up" style={{ animationDelay: '0.1s' }}>
          <h3
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--sub)',
              marginBottom: 14,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            Project Reviews
          </h3>

          {loading ? (
            <div className="loading-screen" style={{ height: 180 }}>
              <div className="spinner" />
            </div>
          ) : visibleClients.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px 8px', color: 'var(--sub)', fontSize: 14 }}>
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
                    {client.projects.map((project) => {
                      const latestSession = project.sessions[0] || null;
                      const projectStatus = project.sessions.some((item) => String(item.status || '').toLowerCase() === 'active')
                        ? 'active'
                        : project.sessions.every((item) => String(item.status || '').toLowerCase() === 'closed')
                          ? 'closed'
                          : 'draft';

                      const projectImages = project.sessions
                        .flatMap((item) => item.previewImages || [])
                        .filter((image, index, list) => image?.id && list.findIndex((candidate) => candidate.id === image.id) === index)
                        .slice(0, 16);

                      const postCount = project.sessions.reduce((sum, item) => sum + (Number(item.postCount) || 0), 0);
                      const fallbackImages = project.sessions.reduce((sum, item) => sum + (Number(item.imageCount) || 0), 0);
                      const imageCount = projectImages.length > 0 ? projectImages.length : fallbackImages;
                      const reviewerNames = Array.from(
                        new Set(
                          project.sessions
                            .flatMap((item) => item.reviewerProgress || [])
                            .filter((reviewer) => String(reviewer.status || '').toLowerCase() === 'done')
                            .map((reviewer) => normalize(reviewer.name || reviewer.email, 'Reviewer'))
                        )
                      );
                      const visibleReviewerNames = reviewerNames.slice(0, 3);
                      const extraReviewerCount = Math.max(0, reviewerNames.length - visibleReviewerNames.length);
                      const totalApprovals = project.sessions.reduce((sum, item) => sum + (Number(item.likeCount) || 0), 0);
                      const totalRejections = project.sessions.reduce((sum, item) => sum + (Number(item.dislikeCount) || 0), 0);
                      const totalComments = project.sessions.reduce((sum, item) => sum + (Number(item.annotationCount) || 0), 0);
                      const lastActivity = project.sessions
                        .map((item) => item.updatedAt || item.createdAt)
                        .filter(Boolean)
                        .sort((left, right) => new Date(right) - new Date(left))[0];

                      return (
                        <div key={project.projectId} className="dashboard-project-card">
                          <div className="session-item" onClick={() => latestSession && navigate(`/sessions/${latestSession.id}`)}>
                            <div className="dashboard-thumb-scroll">
                              {projectImages.length > 0 ? (
                                projectImages.map((image) => (
                                  <div key={image.id} className="dashboard-thumb-wrap">
                                    {isVideoAsset(image) ? (
                                      <video
                                        src={image.url || image.signedUrl}
                                        className="dashboard-thumb"
                                        muted
                                        playsInline
                                        preload="metadata"
                                      />
                                    ) : (
                                      <img
                                        src={image.url || image.signedUrl}
                                        alt={image.fileName || 'Creative asset'}
                                        className="dashboard-thumb"
                                      />
                                    )}
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
                              {postCount} post{postCount !== 1 ? 's' : ''} | {imageCount} image{imageCount !== 1 ? 's' : ''}
                            </div>

                            <div className="dashboard-reviewer-row dashboard-reviewer-row-restored">
                              <div className="dashboard-reviewer-list">
                                {visibleReviewerNames.length > 0 ? (
                                  <>
                                    {visibleReviewerNames.map((name) => (
                                      <div key={name} className="dashboard-reviewer-name dashboard-reviewer-name-stack">
                                        {name}
                                      </div>
                                    ))}
                                    {extraReviewerCount > 0 && (
                                      <div className="dashboard-reviewer-more">+{extraReviewerCount} more</div>
                                    )}
                                  </>
                                ) : (
                                  <div className="dashboard-reviewer-name dashboard-reviewer-name-muted">
                                    No reviewers yet
                                  </div>
                                )}
                              </div>
                              <div className="dashboard-reviewer-metrics">
                                <span>👍 {Math.max(0, totalApprovals)}</span>
                                <span>👎 {Math.max(0, totalRejections)}</span>
                              </div>
                            </div>

                            <div className="dashboard-project-foot">
                              <div>{totalComments} comment{totalComments !== 1 ? 's' : ''}</div>
                              <div>{formatRelativeTime(lastActivity)}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
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
