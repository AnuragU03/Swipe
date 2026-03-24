import React, { useRef, useState } from 'react';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export default function ZoomableImage({ src, alt, className = '' }) {
  const [scale, setScale] = useState(1);
  const pinchRef = useRef({
    active: false,
    startDistance: 0,
    startScale: 1,
  });

  const getDistance = (touches) => {
    const [a, b] = touches;
    const dx = a.clientX - b.clientX;
    const dy = a.clientY - b.clientY;
    return Math.hypot(dx, dy);
  };

  const handleTouchStart = (event) => {
    if (event.touches.length === 2) {
      pinchRef.current = {
        active: true,
        startDistance: getDistance(event.touches),
        startScale: scale,
      };
    }
  };

  const handleTouchMove = (event) => {
    if (!pinchRef.current.active || event.touches.length !== 2) return;
    const distance = getDistance(event.touches);
    const ratio = distance / (pinchRef.current.startDistance || distance);
    const nextScale = clamp(pinchRef.current.startScale * ratio, 1, 3);
    setScale(nextScale);
    event.preventDefault();
    event.stopPropagation();
  };

  const handleTouchEnd = (event) => {
    if (event.touches.length < 2) {
      pinchRef.current.active = false;
    }
  };

  const resetZoom = (event) => {
    event.stopPropagation();
    setScale(1);
  };

  return (
    <div
      className="zoomable-media"
      onDoubleClick={resetZoom}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onPointerDown={(event) => {
        if (scale > 1) {
          event.stopPropagation();
        }
      }}
      onPointerMove={(event) => {
        if (scale > 1) {
          event.stopPropagation();
        }
      }}
      onPointerUp={(event) => {
        if (scale > 1) {
          event.stopPropagation();
        }
      }}
      title={scale > 1 ? 'Double-tap to reset zoom' : 'Pinch to zoom'}
    >
      <img
        src={src}
        alt={alt}
        className={className}
        draggable={false}
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          transition: scale === 1 ? 'transform 0.2s ease' : 'none',
        }}
      />
    </div>
  );
}
