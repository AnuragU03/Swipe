import React, { useRef, useState, useCallback, useEffect } from 'react';

const DRAG_THRESHOLD = 110;
const FLING_VELOCITY = 0.5;

const PIN_COLORS = [
  '#e8ff47', '#3dff8f', '#ff4d6d', '#a78bfa',
  '#f59e0b', '#22d3ee', '#fb7185',
];

export default function SwipeCard({
  imageUrl,
  alt = '',
  cardContent = null,
  onDecision,
  onNavigate,
  onAnnotationAdd,
  annotations = [],
  disabled = false,
  pinMode = false,
  onPinModeUsed,
  navigationMode = false,
}) {
  const cardRef = useRef(null);
  const startRef = useRef({ x: 0, y: 0, time: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showAnnotationInput, setShowAnnotationInput] = useState(null);
  const [annotationComment, setAnnotationComment] = useState('');
  const [annotationName, setAnnotationName] = useState(
    sessionStorage.getItem('reviewerName') || ''
  );
  const [pinStep, setPinStep] = useState('name');
  const [flash, setFlash] = useState(null);

  const absX = Math.abs(offset.x);
  const progress = Math.min(absX / DRAG_THRESHOLD, 1);
  const rotation = (offset.x / 15) * (1 - Math.abs(offset.y) / 600);

  const handlePointerDown = useCallback(
    (e) => {
      if (disabled || isAnimating || showAnnotationInput) return;

      if (pinMode && onAnnotationAdd && cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        setShowAnnotationInput({ x, y });
        setPinStep(annotationName ? 'comment' : 'name');
        setAnnotationComment('');
        return;
      }

      setIsDragging(true);
      startRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
    },
    [disabled, isAnimating, showAnnotationInput, pinMode, onAnnotationAdd, annotationName]
  );

  const handlePointerMove = useCallback(
    (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startRef.current.x;
      const dy = e.clientY - startRef.current.y;
      setOffset({ x: dx, y: dy });
    },
    [isDragging]
  );

  const fling = useCallback(
    (moveRight) => {
      setIsAnimating(true);
      const dir = moveRight ? 1 : -1;
      setFlash(navigationMode ? 'nav' : moveRight ? 'like' : 'dislike');
      setOffset({ x: dir * window.innerWidth * 1.5, y: 0 });

      setTimeout(() => {
        setFlash(null);
        setOffset({ x: 0, y: 0 });
        setIsAnimating(false);
        if (navigationMode) {
          onNavigate?.(moveRight ? 'prev' : 'next');
        } else {
          onDecision?.(moveRight);
        }
      }, 400);
    },
    [navigationMode, onDecision, onNavigate]
  );

  const handlePointerUp = useCallback(
    (e) => {
      if (!isDragging) return;
      setIsDragging(false);

      const dt = Date.now() - startRef.current.time;
      const dx = e.clientX - startRef.current.x;
      const dy = e.clientY - startRef.current.y;
      const velocity = Math.abs(dx) / dt;

      if (Math.abs(dx) < 5 && Math.abs(dy) < 5 && dt < 300) {
        if (pinMode && onAnnotationAdd && cardRef.current) {
          const rect = cardRef.current.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * 100;
          const y = ((e.clientY - rect.top) / rect.height) * 100;
          setShowAnnotationInput({ x, y });
          setPinStep(annotationName ? 'comment' : 'name');
          setAnnotationComment('');
        }
        return;
      }

      if (velocity > FLING_VELOCITY || absX > DRAG_THRESHOLD) {
        fling(dx > 0);
      } else {
        setOffset({ x: 0, y: 0 });
      }
    },
    [isDragging, absX, fling, pinMode, onAnnotationAdd, annotationName]
  );

  useEffect(() => {
    if (isDragging) {
      const move = (e) => handlePointerMove(e);
      const up = (e) => handlePointerUp(e);
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      return () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
    }
  }, [isDragging, handlePointerMove, handlePointerUp]);

  const handleAnnotationSubmit = () => {
    if (pinStep === 'name') {
      if (!annotationName.trim()) return;
      sessionStorage.setItem('reviewerName', annotationName.trim());
      setPinStep('comment');
      return;
    }

    if (!annotationComment.trim()) return;
    onAnnotationAdd?.({
      x: showAnnotationInput.x,
      y: showAnnotationInput.y,
      comment: annotationComment.trim(),
      author: annotationName.trim(),
    });
    setShowAnnotationInput(null);
    setAnnotationComment('');
    onPinModeUsed?.();
  };

  useEffect(() => {
    if (disabled || isAnimating || showAnnotationInput) return;
    const handler = (e) => {
      if (e.key === 'ArrowRight') {
        if (navigationMode) onNavigate?.('next');
        else fling(true);
      } else if (e.key === 'ArrowLeft') {
        if (navigationMode) onNavigate?.('prev');
        else fling(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [disabled, isAnimating, fling, navigationMode, onNavigate, showAnnotationInput]);

  const cardStyle = {
    transform: `translateX(${offset.x}px) translateY(${offset.y * 0.3}px) rotate(${rotation}deg)`,
    transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }} className="perspective-1000">
      <div className="ghost-card ghost-card-2" />
      <div className="ghost-card ghost-card-1" />

      <div
        ref={cardRef}
        className="swipe-card"
        style={{ ...cardStyle, cursor: pinMode ? 'crosshair' : undefined }}
        onPointerDown={handlePointerDown}
      >
        {cardContent ? (
          <div className="swipe-card-custom-content">{cardContent}</div>
        ) : (
          <img src={imageUrl} alt={alt} draggable={false} />
        )}

        {!cardContent && <div className="swipe-card-gradient" />}

        {!cardContent && (
          <div className="swipe-card-info">
            <p style={{ fontSize: 12, opacity: 0.7 }}>
              {pinMode ? '💬 Tap to post comment' : navigationMode ? 'Swipe or tap sides to navigate' : 'Swipe to decide'}
            </p>
          </div>
        )}

        {!pinMode && navigationMode && (
          <>
            <button
              type="button"
              className="swipe-tap-zone swipe-tap-zone-left"
              onClick={(e) => {
                e.stopPropagation();
                if (!isAnimating) onNavigate?.('prev');
              }}
              aria-label="Previous image"
            />
            <button
              type="button"
              className="swipe-tap-zone swipe-tap-zone-right"
              onClick={(e) => {
                e.stopPropagation();
                if (!isAnimating) onNavigate?.('next');
              }}
              aria-label="Next image"
            />
          </>
        )}

        {offset.x > 0 && (
          <div
            className="stamp stamp-approve"
            style={{
              transform: `rotate(-15deg) scale(${0.6 + progress * 0.4})`,
              opacity: progress,
            }}
          >
            {navigationMode ? 'PREV' : 'APPROVE'}
          </div>
        )}

        {offset.x < 0 && (
          <div
            className="stamp stamp-reject"
            style={{
              transform: `rotate(15deg) scale(${0.6 + progress * 0.4})`,
              opacity: progress,
            }}
          >
            {navigationMode ? 'NEXT' : 'TRASH'}
          </div>
        )}

        {annotations.map((pin, i) => (
          <div
            key={i}
            className="pin-marker"
            style={{
              left: `${pin.x}%`,
              top: `${pin.y}%`,
              background: PIN_COLORS[i % PIN_COLORS.length],
            }}
          >
            {i + 1}
          </div>
        ))}

        {showAnnotationInput && (
          <div className="pin-sheet-overlay" onClick={(e) => { e.stopPropagation(); setShowAnnotationInput(null); }}>
            <div
              className="pin-marker"
              style={{
                left: `${showAnnotationInput.x}%`,
                top: `${showAnnotationInput.y}%`,
                background: PIN_COLORS[annotations.length % PIN_COLORS.length],
              }}
            >
              {annotations.length + 1}
            </div>

            <div className="pin-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="pin-sheet-handle" />

              {pinStep === 'name' ? (
                <>
                  <label className="field-label">YOUR NAME</label>
                  <input
                    className="field"
                    placeholder="Enter your name"
                    value={annotationName}
                    onChange={(e) => setAnnotationName(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAnnotationSubmit();
                      if (e.key === 'Escape') setShowAnnotationInput(null);
                    }}
                  />
                </>
              ) : (
                <>
                  <label className="field-label">ADD COMMENT</label>
                  <textarea
                    className="field"
                    placeholder="What should be changed here?"
                    rows={2}
                    value={annotationComment}
                    onChange={(e) => setAnnotationComment(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleAnnotationSubmit();
                      }
                      if (e.key === 'Escape') setShowAnnotationInput(null);
                    }}
                  />
                </>
              )}
              <button className="btn-primary" onClick={handleAnnotationSubmit}>
                {pinStep === 'name' ? 'Next →' : 'Post Comment'}
              </button>
            </div>
          </div>
        )}

        {flash && (
          <div
            className="flash-overlay"
            style={{
              background: flash === 'like'
                ? 'rgba(61,255,143,0.25)'
                : flash === 'dislike'
                  ? 'rgba(255,77,109,0.25)'
                  : 'rgba(255,255,255,0.2)',
            }}
          />
        )}
      </div>
    </div>
  );
}
