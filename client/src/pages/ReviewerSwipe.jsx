import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import SwipeCard from '../components/SwipeCard';

export default function ReviewerSwipe() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [images, setImages] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [decisions, setDecisions] = useState([]);
  const [annotations, setAnnotations] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [pinMode, setPinMode] = useState(false);

  useEffect(() => {
    api
      .getSessionImages(sessionId, true)
      .then((data) => setImages(data.images || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [sessionId]);

  const currentImage = images[currentIndex];
  const isComplete = currentIndex >= images.length && images.length > 0;
  const progress = images.length > 0 ? (currentIndex / images.length) * 100 : 0;

  const upsertDecision = useCallback((imageId, liked) => {
    setDecisions((prev) => {
      const withoutCurrent = prev.filter((item) => item.imageId !== imageId);
      return [...withoutCurrent, { imageId, liked }];
    });
  }, []);

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => {
      if (prev >= images.length - 1) return images.length;
      return prev + 1;
    });
  }, [images.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const handleDecision = useCallback(
    (liked) => {
      if (!currentImage) return;
      upsertDecision(currentImage.id, liked);
      goNext();
    },
    [currentImage, goNext, upsertDecision]
  );

  const handleAnnotation = useCallback(
    (pin) => {
      if (!currentImage) return;
      setAnnotations((prev) => ({
        ...prev,
        [currentImage.id]: [...(prev[currentImage.id] || []), pin],
      }));
    },
    [currentImage]
  );

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const allAnnotations = Object.entries(annotations).flatMap(([imageId, pins]) =>
        pins.map((pin) => ({ imageId, ...pin }))
      );
      await api.submitReview(sessionId, decisions, allAnnotations);
      navigate(`/r/${sessionId}/complete`, {
        state: {
          totalImages: images.length,
          liked: decisions.filter((d) => d.liked).length,
          disliked: decisions.filter((d) => !d.liked).length,
          annotationCount: allAnnotations.length,
        },
      });
    } catch (err) {
      setError(err.message || 'Failed to submit review');
      setSubmitting(false);
    }
  };

  const renderTemplateCard = (image) => {
    if (!image) return null;
    const channel = String(image.templateChannel || '').toLowerCase();
    const text = image.templateText || '';
    const isVideo = String(image.contentType || '').startsWith('video/');
    const mediaUrl = image.url || image.signedUrl;

    if (channel.includes('instagram')) {
      return (
        <div className="platform-card ig-card reviewer-platform-card">
          <div className="ig-top">
            <div className="ig-avatar" />
            <div>
              <div className="ig-name">project_account</div>
              <div className="ig-meta">Shared review</div>
            </div>
          </div>
          <div className="ig-media">
            {isVideo ? (
              <video src={mediaUrl} controls muted playsInline />
            ) : (
              <img src={mediaUrl} alt={image.fileName || 'Creative'} />
            )}
          </div>
          <div className="ig-bottom">
            <div className="ig-actions">♡  💬  ✈  ⌲</div>
            <div className="ig-caption">{text || 'No caption provided.'}</div>
          </div>
        </div>
      );
    }

    if (channel.includes('linkedin')) {
      return (
        <div className="platform-card li-card reviewer-platform-card">
          <div className="li-top">
            <div className="li-avatar" />
            <div>
              <div className="li-company">Client Company</div>
              <div className="li-meta">Sponsored · just now</div>
            </div>
          </div>
          <div className="li-copy">{text || 'No post text provided.'}</div>
          <div className="li-media">
            {isVideo ? (
              <video src={mediaUrl} controls muted playsInline />
            ) : (
              <img src={mediaUrl} alt={image.fileName || 'Creative'} />
            )}
          </div>
          <div className="li-actions">
            <span>Like</span><span>Comment</span><span>Repost</span><span>Send</span>
          </div>
        </div>
      );
    }

    return (
      <div className="platform-card yt-card reviewer-platform-card">
        <div className="yt-media">
          {isVideo ? (
            <video src={mediaUrl} controls muted playsInline />
          ) : (
            <img src={mediaUrl} alt={image.fileName || 'Creative'} />
          )}
        </div>
        <div className="yt-content">
          <div className="yt-title">{text || 'No video title/description provided.'}</div>
          <div className="yt-meta">Shared review • Preview</div>
        </div>
      </div>
    );
  };

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev]);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <div style={{ color: 'var(--sub)', fontSize: 15 }}>Loading images…</div>
      </div>
    );
  }

  if (error && images.length === 0) {
    return (
      <div className="app-shell no-scroll" style={{ justifyContent: 'center', alignItems: 'center', gap: 16 }}>
        <div style={{ fontSize: 48 }}>😕</div>
        <div className="error-box">{error}</div>
      </div>
    );
  }

  if (isComplete) {
    const liked = decisions.filter((d) => d.liked).length;
    const disliked = decisions.filter((d) => !d.liked).length;

    return (
      <div className="app-shell no-scroll">
        <div className="complete-screen">
          <div className="complete-emoji anim-pop">✨</div>
          <h2 style={{ fontSize: 24, fontWeight: 800 }}>All Done!</h2>
          <p style={{ color: 'var(--sub)', fontSize: 15, lineHeight: 1.5, maxWidth: 300 }}>
            You reviewed {images.length} image{images.length !== 1 ? 's' : ''}.
          </p>

          <div style={{ display: 'flex', gap: 32 }}>
            <div className="stat-card" style={{ padding: '18px 24px' }}>
              <div className="num" style={{ color: 'var(--like)' }}>{liked}</div>
              <div className="label">Approved</div>
            </div>
            <div className="stat-card" style={{ padding: '18px 24px' }}>
              <div className="num" style={{ color: 'var(--dislike)' }}>{disliked}</div>
              <div className="label">Rejected</div>
            </div>
          </div>

          {error && <div className="error-box" style={{ width: '100%', maxWidth: 400 }}>{error}</div>}

          <div style={{ display: 'flex', gap: 12, width: '100%', maxWidth: 400 }}>
            <button
              className="btn-secondary"
              onClick={() => {
                setCurrentIndex(0);
                setDecisions([]);
                setAnnotations({});
              }}
              style={{ flex: 1 }}
            >
              ↺ Redo
            </button>
            <button
              className="btn-accent"
              onClick={handleSubmit}
              disabled={submitting}
              style={{ flex: 2 }}
            >
              {submitting ? 'Submitting…' : 'Submit Review ✓'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell no-scroll">
      <div className="header-bar" style={{ padding: '16px 20px 8px' }}>
        <div className="logo" style={{ fontSize: 18 }}>
          Creative<span>Swipe</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            className={`btn-secondary ${pinMode ? 'post-comment-active' : ''}`}
            onClick={() => setPinMode(!pinMode)}
            style={{ padding: '8px 12px', fontSize: 12, width: 'auto' }}
            title="Post Comment"
          >
            {pinMode ? 'Posting Comment…' : 'Post Comment'}
          </button>
          <span style={{ fontSize: 14, color: 'var(--sub)', fontWeight: 500 }}>
            {Math.min(currentIndex + 1, images.length)} / {images.length}
          </span>
          <button
            className="btn-ghost"
            onClick={() => navigate(`/r/${sessionId}`)}
            style={{ padding: '6px 12px', fontSize: 13 }}
          >
            EXIT
          </button>
        </div>
      </div>

      <div style={{ padding: '0 20px 8px', flexShrink: 0 }}>
        <div className="progress-bar">
          <div
            className="progress-fill progress-fill-glow"
            style={{ width: `${progress}%`, background: 'var(--accent)', color: 'var(--accent)' }}
          />
        </div>
      </div>

      <div style={{ flex: 1, position: 'relative', padding: '8px 20px 0', overflow: 'hidden' }}>
        {pinMode && (
          <div className="pin-mode-tip">
            <div className="pin-mode-tip-inner">
              <div className="pin-mode-dot" />
              Tap on the image to post a comment
            </div>
          </div>
        )}

        {currentImage && (
          <>
            <SwipeCard
              key={currentIndex}
              imageUrl={currentImage.url || currentImage.signedUrl}
              alt={currentImage.fileName || `Image ${currentIndex + 1}`}
              cardContent={renderTemplateCard(currentImage)}
              onDecision={handleDecision}
              onNavigate={(direction) => {
                if (direction === 'next') goNext();
                if (direction === 'prev') goPrev();
              }}
              navigationMode
              onAnnotationAdd={handleAnnotation}
              annotations={annotations[currentImage.id] || []}
              pinMode={pinMode}
              onPinModeUsed={() => setPinMode(false)}
            />
          </>
        )}
      </div>

      <div className="action-bar safe-pb" style={{ padding: '12px 20px 20px' }}>
        <button className="action-btn btn-dislike" onClick={() => handleDecision(false)}>✕</button>

        <button
          className="action-btn btn-undo"
          onClick={goPrev}
          disabled={currentIndex === 0}
          style={{ opacity: currentIndex === 0 ? 0.3 : 1 }}
        >↺</button>

        <button className="action-btn btn-like" onClick={() => handleDecision(true)}>✓</button>
      </div>
    </div>
  );
}
