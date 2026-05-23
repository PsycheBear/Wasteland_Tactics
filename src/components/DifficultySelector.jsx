// Difficulty selector — 4 inline pill buttons.
//
// Renders the DIFFICULTY_MODES list and lets the player tick between modes.
// Selection is persisted to localStorage under 'wt_difficulty' so it survives
// page reloads. Parent owns the controlled `value`/`onChange` pair.

import React from 'react';
import { DIFFICULTY_MODES } from '../data/difficulty.js';

const LS_KEY = 'wt_difficulty';

export const loadStoredDifficulty = (fallback = 'normal') => {
  try {
    const v = localStorage.getItem(LS_KEY);
    return v && DIFFICULTY_MODES.some(d => d.id === v) ? v : fallback;
  } catch (_) {
    return fallback;
  }
};

export const saveStoredDifficulty = (id) => {
  try { localStorage.setItem(LS_KEY, id); } catch (_) {}
};

export default function DifficultySelector({ value, onChange, compact = false }) {
  const handle = (id) => {
    saveStoredDifficulty(id);
    onChange?.(id);
  };
  return (
    <div style={{
      display: 'flex', gap: 6, alignItems: 'center',
      padding: compact ? '4px 0' : '6px 0',
      fontFamily: 'inherit',
    }}>
      <span style={{ fontSize: 10, letterSpacing: 2, color: 'var(--ui-text-dim, #b89854)', marginRight: 6 }}>DIFFICULTY</span>
      {DIFFICULTY_MODES.map(mode => {
        const active = mode.id === value;
        return (
          <button
            key={mode.id}
            type="button"
            onClick={() => handle(mode.id)}
            style={{
              padding: compact ? '3px 10px' : '5px 14px',
              fontSize: compact ? 10 : 11,
              fontWeight: active ? 'bold' : 'normal',
              letterSpacing: 1,
              borderRadius: 3,
              cursor: 'pointer',
              fontFamily: 'inherit',
              background: active ? 'rgba(200,148,42,0.25)' : 'rgba(15,10,5,0.5)',
              border: `1px solid ${active ? 'var(--ui-primary, #c8942a)' : 'rgba(200,148,42,0.25)'}`,
              color: active ? 'var(--ui-text, #f0e0a8)' : 'var(--ui-text-dim, #8a7040)',
              transition: 'all 0.15s',
            }}
          >
            {mode.name.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
