import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const SOCIAL_CHANNELS = ['LinkedIn', 'Instagram', 'YouTube'];

const makeRow = (channel = 'LinkedIn') => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
  channel,
  text: '',
  file: null,
});

const sanitizeFileName = (name = 'upload') => String(name).replace(/\s+/g, '_');
const formatBytes = (bytes) => `${((bytes || 0) / (1024 * 1024)).toFixed(1)} MB`;

export default function CreateSession() {
  const navigate = useNavigate();
  const bulkInputRef = useRef(null);
  const [uploadMode, setUploadMode] = useState('platform');
  const [selectedLayout, setSelectedLayout] = useState('LinkedIn');
  const [clientChoice, setClientChoice] = useState('other');
  const [projectChoice, setProjectChoice] = useState('other');
  const [clientName, setClientName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [deadline, setDeadline] = useState('');
  const [password, setPassword] = useState('');
  const [maxReviewers, setMaxReviewers] = useState('');
  const [historySessions, setHistorySessions] = useState([]);
  const [expectedReviewers, setExpectedReviewers] = useState([]);
  const [knownReviewerPick, setKnownReviewerPick] = useState('');
  const [newReviewerName, setNewReviewerName] = useState('');
  const [newReviewerEmail, setNewReviewerEmail] = useState('');
  const [platformRows, setPlatformRows] = useState([makeRow('LinkedIn')]);
  const [bulkFiles, setBulkFiles] = useState([]);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdSession, setCreatedSession] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let mounted = true;
    api.listSessions().then((data) => {
      if (mounted) setHistorySessions(data.sessions || []);
    }).catch(() => {
      if (mounted) setHistorySessions([]);
    });
    return () => { mounted = false; };
  }, []);

  const clientCatalog = useMemo(() => {
    const map = new Map();
    historySessions.forEach((session) => {
      const normalizedClient = String(session.clientName || '').trim();
      if (!normalizedClient) return;
      const clientId = session.clientId || `client-${normalizedClient.toLowerCase()}`;
      if (!map.has(clientId)) {
        map.set(clientId, { id: clientId, name: normalizedClient, projects: new Map(), reviewers: new Map() });
      }
      const client = map.get(clientId);
      if (session.projectId && session.projectName) {
        client.projects.set(session.projectId, { id: session.projectId, name: session.projectName });
      }
      (session.reviewerProgress || []).forEach((reviewer) => {
        const email = String(reviewer.email || '').toLowerCase().trim();
        if (!email) return;
        client.reviewers.set(email, {
          email,
          name: String(reviewer.name || '').trim() || email.split('@')[0],
        });
      });
    });
    return Array.from(map.values()).map((client) => ({
      ...client,
      projects: Array.from(client.projects.values()).sort((a, b) => a.name.localeCompare(b.name)),
      reviewers: Array.from(client.reviewers.values()).sort((a, b) => a.name.localeCompare(b.name)),
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [historySessions]);

  const selectedClient = useMemo(
    () => clientCatalog.find((client) => client.id === clientChoice) || null,
    [clientCatalog, clientChoice]
  );
  const projectOptions = selectedClient?.projects || [];
  const knownReviewers = selectedClient?.reviewers || [];

  useEffect(() => {
    if (!selectedClient) return;
    setClientName(selectedClient.name);
    setProjectChoice('other');
    setProjectName('');
  }, [selectedClient]);

  useEffect(() => {
    if (projectChoice === 'other') return;
    const project = projectOptions.find((item) => item.id === projectChoice);
    if (project) setProjectName(project.name);
  }, [projectChoice, projectOptions]);

  useEffect(() => {
    setPlatformRows((prev) => prev.map((row) => ({ ...row, channel: selectedLayout })));
  }, [selectedLayout]);

  const addReviewer = (reviewer) => {
    const email = String(reviewer?.email || '').toLowerCase().trim();
    const name = String(reviewer?.name || '').trim();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return;
    setExpectedReviewers((prev) => prev.some((item) => item.email === email) ? prev : [...prev, { email, name: name || email.split('@')[0] }]);
  };

  const readFileAsBase64 = (file) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const full = typeof reader.result === 'string' ? reader.result : '';
      resolve({
        id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        fileName: file.name,
        file,
        data: full.split(',')[1] || '',
        preview: full,
        contentType: file.type || 'application/octet-stream',
      });
    };
    reader.readAsDataURL(file);
  });

  const currentUploads = useMemo(() => {
    if (uploadMode === 'bulk') {
      return bulkFiles.map((file, index) => ({
        fileName: sanitizeFileName(file.fileName),
        file: file.file,
        data: file.data,
        contentType: file.contentType,
        rowId: file.id,
        rowOrder: index + 1,
      }));
    }
    return platformRows.filter((row) => row.file).map((row, index) => ({
      fileName: `${row.channel}_${index + 1}_${sanitizeFileName(row.file.fileName)}`,
      file: row.file.file,
      data: row.file.data,
      contentType: row.file.contentType,
      templateChannel: row.channel,
      templateText: row.text || '',
      rowId: row.id,
      rowOrder: index + 1,
    }));
  }, [bulkFiles, platformRows, uploadMode]);

  const totalUploadBytes = currentUploads.reduce((sum, item) => sum + Math.floor((String(item.data || '').length * 3) / 4), 0);
  const reviewUrl = createdSession ? api.getPublicReviewUrl(createdSession.id) : '';

  const renderPlatformPreview = (row) => {
    const media = row.file;
    const isVideo = String(media?.contentType || '').startsWith('video/');
    if (row.channel === 'Instagram') {
      return (
        <div className="platform-card ig-card">
          <div className="ig-top">
            <div className="ig-avatar" />
            <div>
              <div className="ig-name">{projectName || 'project_account'}</div>
              <div className="ig-meta">{clientName || 'Client'}</div>
            </div>
          </div>
          <div className="ig-media">
            {media ? (
              isVideo ? (
                <video src={media.preview} controls muted playsInline />
              ) : (
                <img src={media.preview} alt={media.fileName} />
              )
            ) : (
              <div className="social-preview-media-empty">Upload media for Instagram preview</div>
            )}
          </div>
          <div className="ig-bottom">
            <div className="ig-actions ig-actions-real">
              <span>♡</span>
              <span>💬</span>
              <span>✈</span>
              <span style={{ marginLeft: 'auto' }}>🔖</span>
            </div>
            <div className="ig-caption">
              <strong>{projectName || 'project_account'}</strong>{' '}
              {row.text || 'Captions will appear here.'}
            </div>
          </div>
        </div>
      );
    }
    if (row.channel === 'LinkedIn') {
      return <div className="platform-card li-card"><div className="li-top"><div className="li-avatar" /><div><div className="li-company">{clientName || 'Client Company'}</div><div className="li-meta">Sponsored | just now</div></div></div><div className="li-copy">{row.text || 'Captions will appear here.'}</div><div className="li-media">{media ? (isVideo ? <video src={media.preview} controls muted playsInline /> : <img src={media.preview} alt={media.fileName} />) : <div className="social-preview-media-empty">Upload image or video for LinkedIn preview</div>}</div><div className="li-actions"><span>Like</span><span>Comment</span><span>Repost</span><span>Send</span></div></div>;
    }
    return <div className="platform-card yt-card"><div className="yt-media">{media ? (isVideo ? <video src={media.preview} controls muted playsInline /> : <img src={media.preview} alt={media.fileName} />) : <div className="social-preview-media-empty">Upload media for YouTube preview</div>}</div><div className="yt-content"><div className="yt-title">{row.text || `${projectName || 'Project'} video title`}</div><div className="yt-meta">{clientName || 'Channel'} | Preview</div></div></div>;
  };

  const handlePlatformFileChange = async (rowIndex, fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const converted = await Promise.all(files.map((file) => readFileAsBase64(file)));
    setPlatformRows((prev) => {
      const next = [...prev];
      const currentRow = next[rowIndex];
      if (!currentRow) return prev;
      next[rowIndex] = { ...currentRow, file: converted[0] || null };
      if (converted.length > 1) {
        const extraRows = converted.slice(1).map((file) => ({
          id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
          channel: currentRow.channel,
          text: '',
          file,
        }));
        next.splice(rowIndex + 1, 0, ...extraRows);
      }
      return next;
    });
  };

  const handleBulkFileChange = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const converted = await Promise.all(files.map((file) => readFileAsBase64(file)));
    setBulkFiles((prev) => [...prev, ...converted]);
  };

  const removePlatformRow = (rowId) => {
    setPlatformRows((prev) => {
      if (prev.length === 1) {
        return prev.map((row) => (row.id === rowId ? { ...row, file: null, text: '' } : row));
      }
      return prev.filter((row) => row.id !== rowId);
    });
  };

  const removeBulkFile = (fileId) => {
    setBulkFiles((prev) => prev.filter((file) => file.id !== fileId));
  };

  const addPlatformRow = () => {
    setPlatformRows((prev) => [...prev, makeRow(selectedLayout)]);
  };

  const friendlyUploadError = (err) => {
    const message = String(err?.message || err?.data?.error || '').toLowerCase();
    if (
      message.includes('invalid string length') ||
      message.includes('payload too large') ||
      message.includes('entity too large') ||
      message.includes('request entity too large') ||
      message.includes('upload limit')
    ) {
      return 'You have exceeded the upload limit';
    }
    return err?.message || 'Failed to create session';
  };

  const handleCreate = async () => {
    setError('');
    setLoading(true);
    try {
      const generatedTitle = `${clientName.trim()} - ${projectName.trim()}`;
      const sessionData = {
        clientName: clientName.trim(),
        projectName: projectName.trim(),
        expectedReviewers,
      };
      if (clientChoice !== 'other') sessionData.clientId = clientChoice;
      if (projectChoice !== 'other') sessionData.projectId = projectChoice;
      if (deadline) sessionData.deadline = new Date(deadline).toISOString();
      if (password) sessionData.password = password;
      if (maxReviewers) sessionData.maxReviewers = parseInt(maxReviewers, 10);
      const { session } = await api.createSession(generatedTitle, sessionData);
      for (const upload of currentUploads) {
        await api.uploadImages(session.id, [upload]);
      }
      setCreatedSession(session);
      setStep(3);
    } catch (err) {
      setError(friendlyUploadError(err));
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(reviewUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.querySelector('.share-link-url');
      if (input) {
        input.focus();
        input.select();
      }
    }
  };

  const openNativeDateTimePicker = (event) => {
    if (typeof event.currentTarget.showPicker === 'function') {
      event.currentTarget.showPicker();
    }
  };

  return (
    <div className="app-shell">
      <div className="header-bar">
        <button
          className="btn-ghost"
          onClick={() => {
            if (step > 1 && !createdSession) setStep(step - 1);
            else navigate('/');
          }}
        >
          Back
        </button>
        <h2 style={{ fontSize: 18, fontWeight: 800 }}>
          {step === 3 ? 'Session Created' : 'New Review Session'}
        </h2>
        <div style={{ width: 64 }} />
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', width: '100%' }}>
        {step === 1 && (
          <div className="glass-panel fade-in" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 24 }}>Session Details</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="field-label">Client *</label>
                <select
                  className="field"
                  value={clientChoice}
                  onChange={(event) => {
                    const value = event.target.value;
                    setClientChoice(value);
                    if (value === 'other') {
                      setClientName('');
                      setProjectChoice('other');
                      setProjectName('');
                    }
                  }}
                >
                  <option value="other">New Client</option>
                  {clientCatalog.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
                {clientChoice === 'other' && (
                  <input
                    className="field"
                    style={{ marginTop: 10 }}
                    placeholder="e.g., Panda Media"
                    value={clientName}
                    onChange={(event) => setClientName(event.target.value)}
                  />
                )}
              </div>

              <div>
                <label className="field-label">Project *</label>
                <select
                  className="field"
                  value={projectChoice}
                  onChange={(event) => {
                    const value = event.target.value;
                    setProjectChoice(value);
                    if (value === 'other') setProjectName('');
                  }}
                >
                  <option value="other">New Project</option>
                  {projectOptions.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
                {projectChoice === 'other' && (
                  <input
                    className="field"
                    style={{ marginTop: 10 }}
                    placeholder="e.g., Spring Social Campaign"
                    value={projectName}
                    onChange={(event) => setProjectName(event.target.value)}
                  />
                )}
              </div>
              <div>
                <label className="field-label">Upload Mode *</label>
                <div className="layout-switch" style={{ marginTop: 8, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                  {['platform', 'bulk'].map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setUploadMode(mode)}
                      className={`layout-switch-btn ${uploadMode === mode ? 'layout-switch-btn-active' : ''}`}
                    >
                      {mode === 'platform' ? 'Platform Upload' : 'Bulk Upload'}
                    </button>
                  ))}
                </div>
              </div>

              {uploadMode === 'platform' && (
                <div>
                  <label className="field-label">Platform Layout *</label>
                  <div className="layout-switch" style={{ marginTop: 8 }}>
                    {SOCIAL_CHANNELS.map((channel) => (
                      <button
                        key={channel}
                        type="button"
                        onClick={() => setSelectedLayout(channel)}
                        className={`layout-switch-btn ${selectedLayout === channel ? 'layout-switch-btn-active' : ''}`}
                      >
                        {channel}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="field-label">Deadline (optional)</label>
                <div className="datetime-field-wrap">
                  <input
                    className="field field-datetime"
                    type="datetime-local"
                    value={deadline}
                    onChange={(event) => setDeadline(event.target.value)}
                    onClick={openNativeDateTimePicker}
                    onFocus={openNativeDateTimePicker}
                  />
                  <button
                    type="button"
                    className="datetime-trigger"
                    onClick={(event) => {
                      const input = event.currentTarget.previousElementSibling;
                      if (input) {
                        input.focus();
                        if (typeof input.showPicker === 'function') input.showPicker();
                      }
                    }}
                    aria-label="Open deadline picker"
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                      <rect x="3" y="5" width="18" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
                      <path d="M7 3v4M17 3v4M3 9h18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              </div>

              <div>
                <label className="field-label">Password Protection (optional)</label>
                <input
                  className="field"
                  type="text"
                  placeholder="Leave blank for no password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>

              <div>
                <label className="field-label">Max Reviewers (optional)</label>
                <input
                  className="field"
                  type="number"
                  min="1"
                  placeholder="Unlimited"
                  value={maxReviewers}
                  onChange={(event) => setMaxReviewers(event.target.value)}
                />
              </div>

              <div>
                <label className="field-label">People to Send Review Link</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    className="field"
                    value={knownReviewerPick}
                    onChange={(event) => setKnownReviewerPick(event.target.value)}
                  >
                    <option value="">Select previous reviewer</option>
                    {knownReviewers.map((reviewer) => (
                      <option key={reviewer.email} value={reviewer.email}>
                        {reviewer.name} ({reviewer.email})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ width: 90 }}
                    onClick={() => {
                      const reviewer = knownReviewers.find((item) => item.email === knownReviewerPick);
                      if (!reviewer) return;
                      addReviewer(reviewer);
                      setKnownReviewerPick('');
                    }}
                  >
                    Add
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginTop: 10 }}>
                  <input
                    className="field"
                    placeholder="Reviewer name"
                    value={newReviewerName}
                    onChange={(event) => setNewReviewerName(event.target.value)}
                  />
                  <input
                    className="field"
                    type="email"
                    placeholder="reviewer@email.com"
                    value={newReviewerEmail}
                    onChange={(event) => setNewReviewerEmail(event.target.value)}
                  />
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ width: 90 }}
                    onClick={() => {
                      addReviewer({ name: newReviewerName, email: newReviewerEmail });
                      setNewReviewerName('');
                      setNewReviewerEmail('');
                    }}
                  >
                    Add
                  </button>
                </div>

                {expectedReviewers.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                    {expectedReviewers.map((reviewer) => (
                      <button
                        key={reviewer.email}
                        type="button"
                        className="btn-ghost"
                        style={{ width: 'auto', padding: '8px 10px', fontSize: 12 }}
                        onClick={() => setExpectedReviewers((prev) => prev.filter((item) => item.email !== reviewer.email))}
                      >
                        {reviewer.name} | {reviewer.email} x
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                className="btn-accent"
                disabled={!clientName.trim() || !projectName.trim()}
                onClick={() => setStep(2)}
                style={{ marginTop: 8 }}
              >
                {uploadMode === 'bulk' ? 'Next: Bulk Upload' : 'Next: Platform Upload'}
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="glass-panel" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
                {uploadMode === 'bulk' ? 'Bulk Upload' : 'Platform Upload'}
              </h3>
              <div className="template-total-box">TOTAL UPLOAD: {currentUploads.length}</div>

              {uploadMode === 'bulk' ? (
                <>
                  <div className="bulk-storage-box">
                    <div className="bulk-storage-row"><span>This upload</span><strong>{formatBytes(totalUploadBytes)}</strong></div>
                    <div className="bulk-storage-row"><span>Account limit</span><strong>500.0 MB</strong></div>
                  </div>
                  <button type="button" className="bulk-dropzone" onClick={() => bulkInputRef.current?.click()}>
                    <input ref={bulkInputRef} type="file" accept="image/*,video/*" multiple hidden onChange={(event) => handleBulkFileChange(event.target.files)} />
                    <div className="bulk-dropzone-icon">+</div>
                    <div className="bulk-dropzone-title">Drag and drop files here</div>
                    <div className="bulk-dropzone-copy">Upload multiple files with no captions</div>
                  </button>
                  <div className="bulk-preview-grid">
                    {bulkFiles.length === 0 ? (
                      <div className="template-preview-item" style={{ color: 'var(--sub)', fontSize: 12 }}>Upload files to see previews.</div>
                    ) : (
                      bulkFiles.map((file, index) => (
                        <div key={file.id} className="bulk-preview-card template-preview-shell">
                          <button type="button" className="template-preview-remove" onClick={() => removeBulkFile(file.id)}>x</button>
                          <div className="bulk-preview-media">
                            {String(file.contentType || '').startsWith('video/') ? <video src={file.preview} controls muted playsInline /> : <img src={file.preview} alt={file.fileName} />}
                          </div>
                          <div className="bulk-preview-meta">Upload {index + 1}</div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {platformRows.map((row, rowIndex) => (
                      <div key={row.id} className="template-preview-card">
                        <div className="template-row-grid">
                          <div className="template-row-index">{rowIndex + 1}</div>
                          <label className="template-upload-box">
                            <input type="file" accept={selectedLayout === 'YouTube' ? 'video/*,image/*' : 'image/*,video/*'} multiple hidden onChange={(event) => handlePlatformFileChange(rowIndex, event.target.files)} />
                            {row.file ? 'Replace' : 'Upload'}
                          </label>
                          <textarea
                            className="template-text-box"
                            placeholder="Captions"
                            value={row.text}
                            onChange={(event) => setPlatformRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, text: event.target.value } : item)))}
                          />
                        </div>
                        <div className="template-row-preview-grid">
                          {row.file ? (
                            <div className="template-preview-item template-preview-shell">
                              <button type="button" className="template-preview-remove" onClick={() => removePlatformRow(row.id)}>x</button>
                              <div className="template-preview-btn" style={{ cursor: 'default' }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--sub)', marginBottom: 6 }}>Upload {rowIndex + 1}</div>
                                {renderPlatformPreview(row)}
                              </div>
                            </div>
                          ) : (
                            <div className="template-preview-item" style={{ color: 'var(--sub)', fontSize: 12 }}>Upload media to see preview.</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button type="button" className="btn-secondary" onClick={addPlatformRow} style={{ marginTop: 14, width: '100%' }}>+ Add Upload Row</button>
                </>
              )}
            </div>

            {error && <div className="error-box">{error}</div>}

            <button className="btn-accent" disabled={loading || currentUploads.length === 0} onClick={handleCreate}>
              {loading ? 'Creating session...' : `Create Session with ${currentUploads.length} Upload${currentUploads.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        )}

        {step === 3 && createdSession && (
          <div className="fade-in" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center' }}>
            <div className="complete-icon-badge" aria-hidden="true"><span className="complete-icon-glyph">OK</span></div>
            <h3 style={{ fontSize: 22, fontWeight: 800 }}>{createdSession.title}</h3>
            <p style={{ color: 'var(--sub)', fontSize: 14 }}>Share this link with your reviewers:</p>
            <div className="share-link-box" style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
              <input className="share-link-url" type="text" readOnly value={reviewUrl} onFocus={(event) => event.target.select()} style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} />
              <button onClick={copyLink} style={{ flexShrink: 0 }}>{copied ? 'Copied' : 'Copy Link'}</button>
            </div>
            <div style={{ display: 'flex', gap: 12, width: '100%' }}>
              <button className="btn-ghost" onClick={() => navigate(`/sessions/${createdSession.id}`)} style={{ flex: 1, padding: '14px 0' }}>View Results</button>
              <button className="btn-accent" onClick={() => navigate('/')} style={{ flex: 1 }}>Dashboard</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
