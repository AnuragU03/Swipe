import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import AnnotationView from '../components/AnnotationView';

export default function SessionResults() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('files');
  const [copied, setCopied] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deletingImage, setDeletingImage] = useState(null);
  const [selectedReviewer, setSelectedReviewer] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const data = await api.getSession(id);
      setSession(data.session);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleExport = async (format) => {
    try {
      await api.exportSession(id, format);
    } catch (err) {
      alert('Export failed: ' + err.message);
    }
  };

  const toggleStatus = async () => {
    const newStatus = session.status === 'active' ? 'closed' : 'active';
    await api.updateSession(id, { status: newStatus });
    fetchData();
  };

  const handleDelete = async () => {
    try {
      await api.deleteSession(id);
      navigate('/');
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  const handleDeleteImage = async (imageId) => {
    setDeletingImage(imageId);
    try {
      await api.deleteImage(id, imageId);
      fetchData();
    } catch (err) {
      alert('Failed to delete image: ' + err.message);
    } finally {
      setDeletingImage(null);
    }
  };

  const reviewUrl = api.getPublicReviewUrl(id);
  const copyLink = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(reviewUrl);
      } else {
        const ta = document.createElement('textarea');
        ta.value = reviewUrl;
        ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      const input = document.querySelector('.share-link-url');
      if (input) { input.focus(); input.select(); }
    }
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-shell" style={{ justifyContent: 'center', alignItems: 'center', gap: 16 }}>
        <div style={{ fontSize: 48 }}>😕</div>
        <div className="error-box">{error}</div>
        <button className="btn-secondary" onClick={() => navigate('/')} style={{ maxWidth: 200 }}>
          ← Dashboard
        </button>
      </div>
    );
  }

  if (!session) return null;

  const images = session.images || [];
  const submissions = session.submissions || [];
  const totalLikes = images.reduce((s, img) => s + (img.likes || 0), 0);
  const totalDislikes = images.reduce((s, img) => s + (img.dislikes || 0), 0);
  const totalAnnotations = images.reduce((s, img) => s + (img.annotations?.length || 0), 0);

  return (
    <div className="app-shell">
      <div className="page">
        {/* Header */}
        <div className="header-bar" style={{ marginBottom: 20 }}>
          <button className="btn-ghost" onClick={() => navigate('/')}>← Back</button>
          <span className={`badge badge-${session.status}`}>
            {session.status === 'active' ? '🟢' : '🔴'} {session.status}
          </span>
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 20 }} className="anim-fade-up">
          {session.title}
        </h2>
        <div style={{ marginTop: -12, marginBottom: 16, color: 'var(--sub)', fontSize: 12 }}>
          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{session.clientName || 'Client'}</span>
          {' · '}
          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{session.projectName || 'Project'}</span>
          {' · '}
          <span>Client ID: {session.clientId || 'N/A'}</span>
          {' · '}
          <span>Project ID: {session.projectId || 'N/A'}</span>
        </div>

        {/* Share link */}
        <div className="share-link-box anim-fade-up" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
          <input
            className="share-link-url"
            type="text"
            readOnly
            value={reviewUrl}
            onFocus={(e) => e.target.select()}
            style={{
              flex: 1,
              minWidth: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              wordBreak: 'normal',
              overflowWrap: 'normal',
            }}
          />
          <button onClick={copyLink} style={{ flexShrink: 0 }}>{copied ? '✓ Copied' : 'Copy Link'}</button>
        </div>

        {/* Stats */}
        <div className="stats-grid anim-fade-up" style={{ marginBottom: 24 }}>
          <div className="stat-card">
            <div className="num">{submissions.length}</div>
            <div className="label">Reviews</div>
          </div>
          <div className="stat-card">
            <div className="num" style={{ color: 'var(--like)' }}>{totalLikes}</div>
            <div className="label">Likes</div>
          </div>
          <div className="stat-card">
            <div className="num" style={{ color: 'var(--dislike)' }}>{totalDislikes}</div>
            <div className="label">Dislikes</div>
          </div>
          <div className="stat-card">
            <div className="num" style={{ color: 'var(--accent)' }}>{totalAnnotations}</div>
            <div className="label">Notes</div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
          <button className="btn-secondary" onClick={toggleStatus} style={{ flex: 1, minWidth: 80, fontSize: 13 }}>
            {session.status === 'active' ? '⏸ Close' : '▶ Reopen'}
          </button>
          <button className="btn-secondary" onClick={() => handleExport('xlsx')} style={{ flex: 1, minWidth: 80, fontSize: 13 }}>
            📊 XLSX
          </button>
          <button className="btn-secondary" onClick={() => handleExport('csv')} style={{ flex: 1, minWidth: 80, fontSize: 13 }}>
            📄 CSV
          </button>
          <button className="btn-danger" onClick={() => setShowDelete(true)} style={{ flex: 1, minWidth: 80, fontSize: 13 }}>
            🗑 Delete
          </button>
        </div>

        {/* Tabs */}
        <div className="results-tabs" style={{ marginBottom: 24 }}>
          {['files', 'reviews'].map((tab) => (
            <button
              key={tab}
              className={`tab-btn ${activeTab === tab ? 'tab-btn-active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Files Tab */}
        {activeTab === 'files' && (
          <div className="image-grid">
            {images.map((img, i) => {
              const ct = (img.contentType || img.fileName || '').toLowerCase();
              const isVideo = ct.startsWith('video/') || /\.(mp4|mov|avi|webm|mkv)$/i.test(img.fileName || '');
              const isAudio = ct.startsWith('audio/') || /\.(mp3|wav|ogg|aac|flac)$/i.test(img.fileName || '');
              const isPdf = ct === 'application/pdf' || /\.pdf$/i.test(img.fileName || '');
              const isImage = !isVideo && !isAudio && !isPdf;
              const typeIcon = isVideo ? '🎬' : isAudio ? '🎵' : isPdf ? '📄' : null;
              const typeLabel = isVideo ? 'VIDEO' : isAudio ? 'AUDIO' : isPdf ? 'PDF' : null;
              const typeColor = isVideo ? '#45b7d1' : isAudio ? '#ff9ff3' : isPdf ? '#feca57' : null;

              return (
              <div key={img.id || i} className="image-thumb" style={{ aspectRatio: '3/4', position: 'relative' }}>
                {isImage && <img src={img.url || img.signedUrl} alt="" />}
                {isVideo && (
                  <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, rgba(69,183,209,0.15), rgba(69,183,209,0.05))' }}>
                    <div style={{ fontSize: 40, marginBottom: 6 }}>🎬</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#45b7d1', textAlign: 'center', padding: '0 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{img.fileName || 'Video'}</div>
                  </div>
                )}
                {isAudio && (
                  <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, rgba(255,159,243,0.15), rgba(255,159,243,0.05))' }}>
                    <div style={{ fontSize: 40, marginBottom: 6 }}>🎵</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#ff9ff3', textAlign: 'center', padding: '0 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{img.fileName || 'Audio'}</div>
                  </div>
                )}
                {isPdf && (
                  <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, rgba(254,202,87,0.15), rgba(254,202,87,0.05))' }}>
                    <div style={{ fontSize: 40, marginBottom: 6 }}>📄</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#feca57', textAlign: 'center', padding: '0 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{img.fileName || 'PDF'}</div>
                  </div>
                )}
                {typeLabel && (
                  <div style={{
                    position: 'absolute', top: 6, left: 6,
                    padding: '2px 8px', borderRadius: 6,
                    background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
                    color: typeColor, border: `1px solid ${typeColor}33`,
                  }}>
                    {typeIcon} {typeLabel}
                  </div>
                )}
                <div className="image-thumb-badge">
                  <span style={{ color: 'var(--like)' }}>👍{img.likes || 0}</span>
                  <span style={{ color: 'var(--sub)' }}>·</span>
                  <span style={{ color: 'var(--dislike)' }}>👎{img.dislikes || 0}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Delete "${img.fileName || `Image ${i + 1}`}"?`)) {
                      handleDeleteImage(img.id);
                    }
                  }}
                  disabled={deletingImage === img.id}
                  style={{
                    position: 'absolute', top: 6, right: 6,
                    width: 28, height: 28, borderRadius: '50%',
                    background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,77,109,0.4)',
                    color: 'var(--dislike)', fontSize: 14, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: deletingImage === img.id ? 0.4 : 1,
                  }}
                >
                  {deletingImage === img.id ? '…' : '🗑'}
                </button>
              </div>
              );
            })}
          </div>
        )}

        {/* Reviews Tab */}
        {activeTab === 'reviews' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {submissions.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--sub)', padding: 40 }}>No reviews yet</div>
            ) : (
              <>
                {/* Horizontal scrollable reviewer name chips */}
                <div style={{
                  display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8,
                  WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                }}>
                  {submissions.map((sub, si) => {
                    const isSelected = selectedReviewer === si;
                    const likes = (sub.decisions || []).filter(d => d.liked).length;
                    const dislikes = (sub.decisions || []).filter(d => !d.liked).length;
                    return (
                      <button
                        key={sub.id || si}
                        onClick={() => setSelectedReviewer(isSelected ? null : si)}
                        style={{
                          flexShrink: 0, padding: '8px 14px', borderRadius: 20,
                          border: isSelected ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                          background: isSelected ? 'rgba(232,255,71,0.1)' : 'var(--surface)',
                          color: isSelected ? 'var(--accent)' : 'var(--text)',
                          fontSize: 13, fontWeight: 600, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 6,
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {sub.reviewerName}
                        <span style={{ fontSize: 11, opacity: 0.6 }}>👍{likes} 👎{dislikes}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Selected reviewer detail, or all reviewers */}
                {(() => {
                  const visibleSubs = selectedReviewer !== null ? [submissions[selectedReviewer]] : submissions;
                  return visibleSubs.map((sub, si) => {
                    const subAnnotations = [];
                    images.forEach(img => {
                      (img.annotations || [])
                        .filter(a => a.reviewer === sub.reviewerName || a.author === sub.reviewerName)
                        .forEach(a => subAnnotations.push({ ...a, image: img }));
                    });

                    return (
                      <div key={sub.id || si} className="reviewer-card fade-in">
                        <div className="reviewer-card-header">
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 15 }}>{sub.reviewerName}</div>
                            <div style={{ fontSize: 12, color: 'var(--sub)', marginTop: 2 }}>
                              {new Date(sub.submittedAt).toLocaleString()}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 10, fontSize: 14, fontWeight: 600 }}>
                            <span style={{ color: 'var(--like)' }}>👍 {(sub.decisions || []).filter(d => d.liked).length}</span>
                            <span style={{ color: 'var(--dislike)' }}>👎 {(sub.decisions || []).filter(d => !d.liked).length}</span>
                            {subAnnotations.length > 0 && (
                              <span style={{ color: 'var(--accent)' }}>📌 {subAnnotations.length}</span>
                            )}
                          </div>
                        </div>
                        <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {(sub.decisions || []).map((dec, di) => {
                            const img = images.find(im => im.id === dec.imageId);
                            const relAnn = subAnnotations.filter(a => a.imageId === dec.imageId);
                            const fct = (img?.contentType || img?.fileName || '').toLowerCase();
                            const fIsVideo = fct.startsWith('video/') || /\.(mp4|mov|avi|webm|mkv)$/i.test(img?.fileName || '');
                            const fIsAudio = fct.startsWith('audio/') || /\.(mp3|wav|ogg|aac|flac)$/i.test(img?.fileName || '');
                            const fIsPdf = fct === 'application/pdf' || /\.pdf$/i.test(img?.fileName || '');
                            const fIsImage = !fIsVideo && !fIsAudio && !fIsPdf;
                            const fIcon = fIsVideo ? '🎬' : fIsAudio ? '🎵' : fIsPdf ? '📄' : null;
                            const fColor = fIsVideo ? '#45b7d1' : fIsAudio ? '#ff9ff3' : fIsPdf ? '#feca57' : null;
                            const fLabel = fIsVideo ? 'VIDEO' : fIsAudio ? 'AUDIO' : fIsPdf ? 'PDF' : null;
                            return (
                              <div key={di} style={{
                                padding: '10px 12px',
                                background: dec.liked ? 'rgba(61,255,143,0.05)' : 'rgba(255,77,109,0.05)',
                                borderRadius: 10,
                                border: `1px solid ${dec.liked ? 'rgba(61,255,143,0.12)' : 'rgba(255,77,109,0.12)'}`,
                              }}>
                                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                  <div style={{ width: 40, height: 40, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: 'var(--surface-2)', position: 'relative' }}>
                                    {img && fIsImage && <img src={img.url || img.signedUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                                    {img && !fIsImage && (
                                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, ${fColor}25, ${fColor}0d)` }}>
                                        <span style={{ fontSize: 20 }}>{fIcon}</span>
                                      </div>
                                    )}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {img?.fileName || `File ${di + 1}`}
                                    </div>
                                    {fLabel && (
                                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: fColor, marginTop: 2 }}>
                                        {fIcon} {fLabel}
                                      </div>
                                    )}
                                  </div>
                                  <div style={{ fontSize: 18, flexShrink: 0 }}>{dec.liked ? '👍' : '👎'}</div>
                                </div>
                                {relAnn.length > 0 && (
                                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {relAnn.map((ann, ai) => (
                                      <div key={ai} style={{
                                        display: 'flex', gap: 8, alignItems: 'flex-start',
                                        padding: '6px 10px', borderRadius: 8,
                                        background: 'rgba(232,255,71,0.06)',
                                        border: '1px solid rgba(232,255,71,0.1)',
                                      }}>
                                        <span style={{
                                          width: 18, height: 18, borderRadius: '50%', background: 'var(--accent)',
                                          color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                          fontSize: 10, fontWeight: 800, flexShrink: 0, marginTop: 1,
                                        }}>{ai + 1}</span>
                                        <div style={{ fontSize: 13, lineHeight: 1.4, color: 'var(--text)' }}>
                                          {ann.comment}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Pin overview for this reviewer */}
                        {subAnnotations.length > 0 && (
                          <div style={{ padding: '0 10px 10px' }}>
                            {[...new Set(subAnnotations.map(a => a.imageId))].map(imgId => {
                              const img = images.find(im => im.id === imgId);
                              const pins = subAnnotations.filter(a => a.imageId === imgId);
                              if (!img) return null;
                              const pct = (img.contentType || img.fileName || '').toLowerCase();
                              const pIsImage = !pct.startsWith('video/') && !pct.startsWith('audio/') && pct !== 'application/pdf' && !/\.(mp4|mov|avi|webm|mkv|mp3|wav|ogg|aac|flac|pdf)$/i.test(img.fileName || '');
                              return (
                                <div key={imgId} style={{ marginTop: 10 }}>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--sub)', marginBottom: 8 }}>
                                    📌 Pins on {img.fileName || 'File'}
                                  </div>
                                  {pIsImage ? (
                                    <AnnotationView annotations={pins} imageUrl={img.url || img.signedUrl} />
                                  ) : (
                                    <div style={{ padding: 12, background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)' }}>
                                      {pins.map((ann, ai) => (
                                        <div key={ai} style={{
                                          display: 'flex', gap: 8, alignItems: 'flex-start',
                                          padding: '6px 10px', borderRadius: 8, marginBottom: 4,
                                          background: 'rgba(232,255,71,0.06)',
                                          border: '1px solid rgba(232,255,71,0.1)',
                                        }}>
                                          <span style={{
                                            width: 18, height: 18, borderRadius: '50%', background: 'var(--accent)',
                                            color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 10, fontWeight: 800, flexShrink: 0, marginTop: 1,
                                          }}>{ai + 1}</span>
                                          <div style={{ fontSize: 13, lineHeight: 1.4, color: 'var(--text)' }}>
                                            {ann.comment}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {showDelete && (
        <div className="confirm-overlay" onClick={() => setShowDelete(false)}>
          <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🗑</div>
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Delete Session?</h3>
            <p style={{ fontSize: 14, color: 'var(--sub)', lineHeight: 1.5, marginBottom: 20 }}>
              This will permanently delete all images, reviews, and annotations. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-secondary" onClick={() => setShowDelete(false)} style={{ flex: 1 }}>
                Cancel
              </button>
              <button className="btn-danger" onClick={handleDelete} style={{ flex: 1 }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
