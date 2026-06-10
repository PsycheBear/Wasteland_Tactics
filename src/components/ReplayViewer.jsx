// ReplayViewer — steps through a stored combat log.
//
// Replay format (see useSave.js): { time, round, opponent, log: any[], result }
// `log` is a flat array of log entries (combat.js emits these as strings or
// React-renderable nodes — we just render them as-is and step an index).
//
// Controls: prev/next arrows, play/pause, and a 0.5x / 1x / 2x speed picker.
// The viewer paints over the parent panel and closes via `onClose`.

import React, { useEffect, useRef, useState } from 'react';
import { loadReplays } from '../hooks/useSave.js';
import Modal from './Modal.jsx';

const SPEEDS = [0.5, 1, 2];
const BASE_INTERVAL_MS = 500; // 1x speed = one action every 500ms

export default function ReplayViewer({ onClose, initialReplay = null }) {
  const [replays] = useState(() => loadReplays());
  const [selectedIdx, setSelectedIdx] = useState(() => {
    if (initialReplay && Array.isArray(replays)) {
      const i = replays.findIndex(r => r.time === initialReplay.time);
      return i >= 0 ? i : 0;
    }
    return 0;
  });
  const replay = replays?.[selectedIdx] || null;
  const log = replay?.log || [];

  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const timerRef = useRef(null);

  // Reset step pointer when switching replays.
  useEffect(() => { setStep(0); setPlaying(false); }, [selectedIdx]);

  // Play loop — interval scaled by speed multiplier.
  useEffect(() => {
    clearInterval(timerRef.current);
    if (!playing) return;
    timerRef.current = setInterval(() => {
      setStep(s => {
        if (s + 1 >= log.length) { setPlaying(false); return s; }
        return s + 1;
      });
    }, BASE_INTERVAL_MS / speed);
    return () => clearInterval(timerRef.current);
  }, [playing, speed, log.length]);

  const fmtTime = (t) => {
    try { return new Date(t).toLocaleString(); } catch { return ''; }
  };

  return (
    <Modal onClose={onClose} label="Combat replays" zIndex="var(--z-toast)" panelStyle={{
      background: 'var(--ui-panel, #0a0a0a)', border: '2px solid var(--ui-border, #33ff33)', borderRadius: 8, padding: 24,
      width: 'clamp(300px, 92vw, 700px)', maxHeight: '80vh', display: 'flex', flexDirection: 'column',
      color: 'var(--ui-text, #ddd)', fontFamily: "'Share Tech Mono', monospace",
    }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 16, color: 'var(--ui-primary, #33ff33)', letterSpacing: 2 }}>REPLAYS</div>
          <button onClick={onClose} style={{ background: 'transparent', color: 'inherit', border: '1px solid var(--ui-border-dim, #444)', borderRadius: 3, padding: '2px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>Close</button>
        </div>

        {replays.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', opacity: 0.6 }}>No replays saved yet. Finish a combat round to record one.</div>
        ) : (
          <>
            {/* Replay picker — list down the side */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
              {replays.map((r, i) => (
                <button
                  key={r.time}
                  onClick={() => setSelectedIdx(i)}
                  style={{
                    padding: '4px 10px', fontSize: 11,
                    background: i === selectedIdx ? 'rgba(50,180,50,0.25)' : 'rgba(255,255,255,0.05)',
                    border: i === selectedIdx ? '1px solid var(--ui-primary, #33ff33)' : '1px solid var(--ui-border-dim, #444)',
                    borderRadius: 3, color: 'inherit', cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  R{r.round} · {r.opponent || '?'} · {r.result === 'win' ? 'W' : 'L'}
                </button>
              ))}
            </div>

            <div style={{ fontSize: 10, opacity: 0.5, marginBottom: 6 }}>{replay && fmtTime(replay.time)}</div>

            {/* Log preview window */}
            <div style={{
              flex: 1, overflowY: 'auto', minHeight: 180, maxHeight: '50vh',
              background: 'rgba(0,0,0,0.4)', border: '1px solid var(--ui-border-dim, #444)', borderRadius: 4, padding: 8,
              fontSize: 12, lineHeight: 1.55,
            }}>
              {log.slice(0, step + 1).map((entry, idx) => (
                <div key={idx} style={{ opacity: idx === step ? 1 : 0.55 }}>
                  {typeof entry === 'string' ? entry : (entry?.text || JSON.stringify(entry))}
                </div>
              ))}
              {log.length === 0 && <div style={{ opacity: 0.5 }}>Log empty.</div>}
            </div>

            {/* Transport controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
              <button onClick={() => setStep(s => Math.max(0, s - 1))} style={controlBtn}>{'◀'} Prev</button>
              <button onClick={() => setPlaying(p => !p)} style={{ ...controlBtn, minWidth: 80 }}>{playing ? 'Pause' : 'Play'}</button>
              <button onClick={() => setStep(s => Math.min(log.length - 1, s + 1))} style={controlBtn}>Next {'▶'}</button>
              <div style={{ marginLeft: 12, fontSize: 11, opacity: 0.7 }}>Speed:</div>
              {SPEEDS.map(s => (
                <button key={s} onClick={() => setSpeed(s)} style={{
                  ...controlBtn,
                  background: speed === s ? 'rgba(50,180,50,0.25)' : controlBtn.background,
                  borderColor: speed === s ? 'var(--ui-primary, #33ff33)' : controlBtn.borderColor,
                }}>{s}x</button>
              ))}
              <div style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.7 }}>
                Step {Math.min(step + 1, log.length)} / {log.length}
              </div>
            </div>
          </>
        )}
    </Modal>
  );
}

const controlBtn = {
  padding: '4px 10px', fontSize: 11,
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid var(--ui-border-dim, #444)',
  borderRadius: 3, color: 'inherit', cursor: 'pointer', fontFamily: "'Share Tech Mono', monospace",
};
