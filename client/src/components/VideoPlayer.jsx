import React, { useRef, useState, useEffect, useCallback, useImperativeHandle } from 'react';

/**
 * VideoPlayer — custom HTML5 video player with:
 * - Play / pause toggle
 * - Scrub bar synced to currentTime
 * - Timestamp display (MM:SS)
 * - Mute toggle
 * - Exposes pause/play/seek controls via forwardRef
 */
const VideoPlayer = React.forwardRef(function VideoPlayer(
  { src, onTimeUpdate, style, className },
  ref
) {
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);

  const formatTime = (secs) => {
    const s = Math.floor(secs || 0);
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  };

  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current) return;
    const t = videoRef.current.currentTime;
    if (!scrubbing) setCurrentTime(t);
    if (onTimeUpdate) onTimeUpdate(t);
  }, [scrubbing, onTimeUpdate]);

  const handleLoadedMetadata = () => {
    if (videoRef.current) setDuration(videoRef.current.duration || 0);
  };

  const handlePlay = () => setPlaying(true);
  const handlePause = () => setPlaying(false);
  const handleEnded = () => setPlaying(false);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) videoRef.current.play();
    else videoRef.current.pause();
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setMuted(videoRef.current.muted);
  };

  const handleScrubChange = (e) => {
    const val = Number(e.target.value);
    setCurrentTime(val);
    if (videoRef.current) videoRef.current.currentTime = val;
  };

  useImperativeHandle(ref, () => ({
    play: async () => {
      if (!videoRef.current) return;
      await videoRef.current.play();
    },
    pause: () => {
      if (!videoRef.current) return;
      videoRef.current.pause();
    },
    seekTo: (secs, options = {}) => {
      if (!videoRef.current) return;
      const nextTime = Math.min(
        duration || Number.MAX_SAFE_INTEGER,
        Math.max(0, Number(secs) || 0)
      );
      videoRef.current.currentTime = nextTime;
      setCurrentTime(nextTime);
      if (options.play) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    },
    getCurrentTime: () => videoRef.current?.currentTime || 0,
    getElement: () => videoRef.current,
  }), [duration]);

  return (
    <div
      className={className}
      style={{
        position: 'relative', display: 'flex', flexDirection: 'column',
        background: '#000', borderRadius: 12, overflow: 'hidden',
        ...style,
      }}
    >
      {/* The actual video element */}
      <video
        ref={videoRef}
        src={src}
        playsInline
        muted={muted}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
        style={{ width: '100%', display: 'block', cursor: 'pointer', maxHeight: '55vh', objectFit: 'contain' }}
        onClick={togglePlay}
      />

      {/* Controls overlay */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 12px', background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(4px)',
      }}>
        {/* Play/Pause */}
        <button
          type="button"
          id="video-play-pause"
          onClick={togglePlay}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#fff', padding: 4, display: 'flex', alignItems: 'center', flexShrink: 0,
          }}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? (
            // Pause icon
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff">
              <rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>
            </svg>
          ) : (
            // Play icon
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff">
              <polygon points="5,3 19,12 5,21"/>
            </svg>
          )}
        </button>

        {/* Timestamp */}
        <span style={{ color: '#ddd', fontSize: 12, fontVariantNumeric: 'tabular-nums', flexShrink: 0, minWidth: 70 }}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        {/* Scrub bar */}
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.1}
          value={currentTime}
          onChange={handleScrubChange}
          onMouseDown={() => setScrubbing(true)}
          onMouseUp={() => setScrubbing(false)}
          onTouchStart={() => setScrubbing(true)}
          onTouchEnd={() => setScrubbing(false)}
          style={{
            flex: 1, accentColor: 'var(--accent, #6C5CE7)',
            cursor: 'pointer', height: 4,
          }}
          aria-label="Video seek"
        />

        {/* Mute */}
        <button
          type="button"
          id="video-mute-toggle"
          onClick={toggleMute}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#fff', padding: 4, display: 'flex', alignItems: 'center', flexShrink: 0,
          }}
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" strokeLinecap="round">
              <polygon points="11,5 6,9 2,9 2,15 6,15 11,19" /><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
              <polygon points="11,5 6,9 2,9 2,15 6,15 11,19" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
            </svg>
          )}
        </button>
      </div>
    </div>
  );
});

export default VideoPlayer;
