// Augment offer modal — extracted from Game.jsx.
//
// When the game decides to offer an augment choice (after carousel rounds or
// on demand), the parent sets `choice` to `{ options: [aug, aug, aug] }` and
// renders <AugmentPicker choice={choice} onPick={...} />. Picking an option
// calls onPick(aug); the parent is then responsible for clearing the choice,
// applying the effect, and any side-effects (like extending the bench for
// `benchAdd` augments).
//
// Visual style preserved verbatim from the original inline modal — same
// purple Pip-Boy palette and hover behavior.

import React from 'react';
import { createGameIcon } from './GameIcon.jsx';

export default function AugmentPicker({ choice, onPick }) {
  if (!choice) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2500 }}>
      <div style={{ background: 'linear-gradient(180deg, #0a001a 0%, #0a0a00 100%)', border: '3px solid #9900ff', borderRadius: 8, padding: 30, textAlign: 'center', boxShadow: '0 0 40px rgba(153,0,255,0.5)' }}>
        <div style={{ fontSize: 24, fontWeight: 'bold', color: '#cc66ff', marginBottom: 16 }}>Choose an Augment</div>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
          {choice.options.map((aug, idx) => (
            <div
              key={idx}
              onClick={() => onPick?.(aug)}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(80,0,120,0.6)'; e.currentTarget.style.borderColor = '#cc66ff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(50,0,80,0.6)'; e.currentTarget.style.borderColor = '#9900ff'; }}
              style={{
                width: 120, padding: 16, background: 'rgba(50,0,80,0.6)', border: '2px solid #9900ff',
                borderRadius: 8, cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s',
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>{createGameIcon(aug.iconImg, aug.icon, 32)}</div>
              <div style={{ fontSize: 12, fontWeight: 'bold', color: '#ffffff', marginBottom: 4 }}>{aug.name}</div>
              <div style={{ fontSize: 10, color: '#cc99ff' }}>{aug.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
