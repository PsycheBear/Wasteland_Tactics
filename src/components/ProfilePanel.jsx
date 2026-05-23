// ProfilePanel — lifetime stats + recent errors + build export/import.
//
// Stats source: localStorage `wt_player_stats` (read via useSave helpers).
// Errors: the ring buffer in lib/logger.js.
// Build codec: lib/buildCodec.js (Export → clipboard, Import → parses pasted
// text and calls back into the parent's onImport handler if provided).
//
// Replay viewer is opened by toggling local UI state inside this modal; it
// renders <ReplayViewer> when the user clicks "View Replays".
//
// Style intentionally matches the AugmentPicker modal pattern (dark panel,
// CRT borders, Share Tech Mono everywhere).

import React, { useState } from 'react';
import { loadPlayerStats } from '../hooks/useSave.js';
import { getRecentErrors } from '../lib/logger.js';
import { encode as encodeBuild, decode as decodeBuild } from '../lib/buildCodec.js';
import ReplayViewer from './ReplayViewer.jsx';

export default function ProfilePanel({ onClose, currentBuild = null, onImport = null }) {
  const [stats] = useState(() => loadPlayerStats());
  const [errors] = useState(() => getRecentErrors());
  const [importText, setImportText] = useState('');
  const [importMsg, setImportMsg] = useState('');
  const [showReplays, setShowReplays] = useState(false);

  const bossRecord = stats.bossRecord || {};

  const handleExport = async () => {
    if (!currentBuild) { setImportMsg('No active build to export.'); return; }
    try {
      const code = encodeBuild(currentBuild);
      try {
        await navigator.clipboard?.writeText(code);
        setImportMsg('Build code copied to clipboard.');
      } catch (_) {
        setImportMsg(code); // fall back to showing the code so the user can copy manually
      }
    } catch (e) {
      setImportMsg(`Export failed: ${e.message}`);
    }
  };

  const handleImport = () => {
    try {
      const parsed = decodeBuild(importText);
      if (typeof onImport === 'function') onImport(parsed);
      setImportMsg('Build imported.');
    } catch (e) {
      setImportMsg(`Import failed: ${e.message}`);
    }
  };

  if (showReplays) {
    return <ReplayViewer onClose={() => setShowReplays(false)} />;
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2700 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'linear-gradient(180deg, #00130a 0%, #0a0a0a 100%)',
        border: '3px solid var(--ui-border, #33ff33)', borderRadius: 8, padding: 24,
        minWidth: 480, maxWidth: 640, maxHeight: '85vh', overflowY: 'auto',
        color: 'var(--ui-text, #ddd)', fontFamily: "'Share Tech Mono', monospace",
        boxShadow: '0 0 40px rgba(51,255,51,0.25)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 18, color: 'var(--ui-primary, #33ff33)', letterSpacing: 2 }}>VAULT-TEC PROFILE</div>
          <button onClick={onClose} style={{ background: 'transparent', color: 'inherit', border: '1px solid var(--ui-border-dim, #444)', borderRadius: 3, padding: '2px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>Close</button>
        </div>

        {/* Lifetime stats */}
        <section style={{ marginBottom: 12 }}>
          <div style={sectionHeader}>Lifetime Stats</div>
          <div style={statRow}><span>Runs played</span><span>{stats.runs ?? 0}</span></div>
          <div style={statRow}><span>Best round</span><span>{stats.bestRound ?? 0}</span></div>
          <div style={statRow}><span>Total gold earned</span><span>{stats.totalGold ?? 0}</span></div>
          <div style={statRow}><span>Favorite trait</span><span>{stats.favoriteTrait || 'n/a'}</span></div>
        </section>

        {/* Boss record */}
        <section style={{ marginBottom: 12 }}>
          <div style={sectionHeader}>Boss Record</div>
          {Object.keys(bossRecord).length === 0 ? (
            <div style={{ opacity: 0.5, fontSize: 11 }}>No boss outcomes recorded yet.</div>
          ) : (
            Object.entries(bossRecord).map(([name, rec]) => (
              <div key={name} style={statRow}>
                <span>{name}</span>
                <span style={{ color: rec.wins > rec.losses ? '#88ff88' : '#ff8888' }}>{rec.wins}W / {rec.losses}L</span>
              </div>
            ))
          )}
        </section>

        {/* Build codec */}
        <section style={{ marginBottom: 12 }}>
          <div style={sectionHeader}>Build Codes</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
            <button onClick={handleExport} style={controlBtn}>Export Build</button>
            <button onClick={() => setShowReplays(true)} style={controlBtn}>View Replays</button>
          </div>
          <textarea
            value={importText}
            onChange={e => setImportText(e.target.value)}
            placeholder="Paste a build code here to import…"
            style={{
              width: '100%', minHeight: 60, boxSizing: 'border-box', padding: 8, fontSize: 11,
              background: 'rgba(0,0,0,0.4)', border: '1px solid var(--ui-border-dim, #444)',
              borderRadius: 3, color: 'inherit', fontFamily: 'inherit',
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
            <button onClick={handleImport} style={controlBtn}>Import Build</button>
            {importMsg && <span style={{ fontSize: 10, opacity: 0.8 }}>{importMsg}</span>}
          </div>
        </section>

        {/* Recent errors */}
        <section>
          <div style={sectionHeader}>Recent Errors</div>
          {errors.length === 0 ? (
            <div style={{ opacity: 0.5, fontSize: 11 }}>No errors logged.</div>
          ) : (
            <div style={{ maxHeight: 160, overflowY: 'auto', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--ui-border-dim, #444)', borderRadius: 4, padding: 6 }}>
              {errors.slice().reverse().map((e, i) => (
                <div key={i} style={{ fontSize: 10, marginBottom: 4, color: '#ffaa88', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  <span style={{ opacity: 0.5 }}>[{new Date(e.time).toLocaleTimeString()}]</span> {e.message}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

const sectionHeader = {
  fontSize: 12, color: 'var(--ui-primary, #33ff33)', letterSpacing: 1,
  borderBottom: '1px solid var(--ui-border-dim, #444)', paddingBottom: 4, marginBottom: 6,
};
const statRow = {
  display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: 11,
};
const controlBtn = {
  padding: '4px 10px', fontSize: 11,
  background: 'rgba(50,180,50,0.15)',
  border: '1px solid var(--ui-border, #33ff33)',
  borderRadius: 3, color: 'inherit', cursor: 'pointer', fontFamily: "'Share Tech Mono', monospace",
};
