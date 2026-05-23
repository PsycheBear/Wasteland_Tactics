// Boss intro overlay.
//
// Two modes:
//   - Multi-frame: when the boss data has `introFrames: [<path>, <path>, ...]`
//     (e.g. Liberty Prime / Marcy each declared with 3 frame paths), the frames
//     are crossfaded across ~2 seconds using a CSS keyframe animation that's
//     parameterized by the frame count. No setInterval / requestAnimationFrame
//     in this component — purely declarative.
//   - Single-frame: when introFrames is null/empty, falls back to rendering the
//     existing big boss title/spotlight markup that Game.jsx used inline. This
//     keeps the call-site swap a no-op for bosses that don't have art yet.
//
// Skippable: any click or keypress fires onDone().

import React, { useEffect, useRef } from 'react';

export default function BossIntro({ boss, frames, durationMs = 2000, onDone }) {
  const ref = useRef(null);
  const framesList = Array.isArray(frames) && frames.length > 0 ? frames : (Array.isArray(boss?.introFrames) ? boss.introFrames : []);
  const styleId = `wt-boss-intro-anim-${framesList.length || 1}`;

  // Inject a one-off keyframe rule that crossfades through N frames using
  // discrete opacity stops. This avoids per-frame JS timing.
  useEffect(() => {
    // Inject the fade keyframe even for single-frame mode so the portrait banner
    // gets a graceful entrance.
    if (document.getElementById('wt-boss-frame-fade-style')) return;
    const baseStyle = document.createElement('style');
    baseStyle.id = 'wt-boss-frame-fade-style';
    baseStyle.textContent = `@keyframes wt-boss-frame-fade { 0% { opacity: 0; transform: translate(-50%, -50%) scale(0.85); } 30% { opacity: 1; transform: translate(-50%, -50%) scale(1.02); } 100% { opacity: 1; transform: translate(-50%, -50%) scale(1); } }`;
    document.head.appendChild(baseStyle);
  }, []);

  useEffect(() => {
    if (framesList.length < 2) return;
    if (document.getElementById(styleId)) return;
    const stops = framesList.map((_, i) => {
      const startPct = (i / framesList.length) * 100;
      const endPct = ((i + 1) / framesList.length) * 100;
      return `${startPct.toFixed(2)}% { opacity: 1; } ${(endPct - 0.01).toFixed(2)}% { opacity: 1; } ${endPct.toFixed(2)}% { opacity: 0; }`;
    }).join('\n');
    // Each frame's own animation: full opacity during its own slice, faded otherwise.
    // We define a single keyframe sequence that each frame uses with `animation-delay`.
    const css = `@keyframes wt-boss-frame-fade { 0% { opacity: 0; } 5% { opacity: 1; } 95% { opacity: 1; } 100% { opacity: 0; } }`;
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
    // Note: stops variable defined for future fine-grained sequencing; unused for now.
    void stops;
  }, [framesList.length, styleId]);

  useEffect(() => {
    if (!onDone) return;
    const t = setTimeout(() => onDone(), durationMs);
    const skip = () => onDone();
    window.addEventListener('keydown', skip, { once: true });
    window.addEventListener('click', skip, { once: true });
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', skip);
      window.removeEventListener('click', skip);
    };
  }, [durationMs, onDone]);

  if (!boss) return null;

  // Multi-frame crossfade — each frame has its own animation-delay so they
  // light up sequentially over the total duration.
  if (framesList.length >= 2) {
    const perFrame = durationMs / framesList.length;
    return (
      <div ref={ref} className="wt-boss-intro-multi" style={{
        position: 'absolute', inset: 0, pointerEvents: 'auto', cursor: 'pointer', zIndex: 50,
      }}>
        {framesList.map((src, idx) => (
          <img
            key={idx}
            src={src}
            alt={`${boss.name} intro frame ${idx + 1}`}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain',
              opacity: 0,
              animation: `wt-boss-frame-fade ${perFrame}ms ${idx * perFrame}ms ease-in-out forwards`,
              pointerEvents: 'none',
            }}
          />
        ))}
        <div className="wt-boss-spotlight" />
        <div className="wt-boss-title">
          <div className="wt-boss-title-name">{boss.name}</div>
          <div className="wt-boss-title-sub">WASTELAND BOSS</div>
        </div>
      </div>
    );
  }

  // Single-frame: prefer the boss's portrait art (PNG/webp under public/images/bosses/)
  // as a static banner. Falls back to SVG iconImg + glow ring when no portrait
  // exists (Radscorpion, Deathclaw). The animated ring + dramatic spotlight
  // makes the SVG-only path feel intentional instead of placeholder-y.
  const hasPortrait = !!boss.portrait;
  const fallbackIcon = boss.iconImg;
  return (
    <>
      <div className="wt-boss-spotlight" />
      {hasPortrait && (
        <img
          src={boss.portrait}
          alt={boss.name}
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
          style={{
            position: 'absolute', left: '50%', top: '40%', transform: 'translate(-50%, -50%)',
            maxWidth: '60%', maxHeight: '60%', objectFit: 'contain',
            filter: 'drop-shadow(0 0 30px rgba(255,80,80,0.7)) drop-shadow(0 0 60px rgba(0,0,0,0.9))',
            animation: 'wt-boss-frame-fade 1800ms ease-in-out',
            zIndex: 51, pointerEvents: 'none',
          }}
        />
      )}
      {!hasPortrait && fallbackIcon && (
        <div style={{
          position: 'absolute', left: '50%', top: '40%', transform: 'translate(-50%, -50%)',
          width: 280, height: 280, zIndex: 51, pointerEvents: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'wt-boss-frame-fade 1800ms ease-in-out',
        }}>
          {/* Pulsing red glow ring behind the SVG icon */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,40,40,0.45) 0%, rgba(120,0,0,0.25) 40%, transparent 70%)',
            animation: 'wt-boss-pulse-ring 2s ease-in-out infinite',
            filter: 'blur(8px)',
          }} />
          {/* Rotating outer rune ring */}
          <div style={{
            position: 'absolute', inset: '-20px', borderRadius: '50%',
            border: '2px dashed rgba(255,80,80,0.6)', boxShadow: '0 0 24px rgba(255,40,40,0.4)',
            animation: 'wt-boss-rune-spin 8s linear infinite',
          }} />
          <img
            src={fallbackIcon}
            alt={boss.name}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
            style={{
              width: 160, height: 160, objectFit: 'contain',
              filter: 'drop-shadow(0 0 12px rgba(255,80,80,0.9)) drop-shadow(0 0 30px rgba(120,0,0,0.7))',
              position: 'relative', zIndex: 1,
            }}
          />
        </div>
      )}
      <div className="wt-boss-title">
        <div className="wt-boss-title-name">{boss.name}</div>
        <div className="wt-boss-title-sub">WASTELAND BOSS</div>
      </div>
    </>
  );
}
