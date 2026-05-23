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
          {choice.options.map((aug, idx) => {
            // Character augments either grant a free unit or transform an existing one.
            // Surface the badge so the player knows the augment ties to a specific unit.
            const isGrant = !!aug.grantUnit;
            const isTransform = !!aug.transformUnit;
            const badgeLabel = isTransform
              ? `Transforms ${aug.transformUnit.from} → ${aug.transformUnit.to}`
              : isGrant
                ? `Grants 1★ ${aug.grantUnit.id}`
                : null;
            return (
              <div
                key={idx}
                role="button"
                tabIndex={0}
                onClick={() => onPick?.(aug)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick?.(aug); } }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(80,0,120,0.6)'; e.currentTarget.style.borderColor = '#cc66ff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(50,0,80,0.6)'; e.currentTarget.style.borderColor = '#9900ff'; }}
                style={{
                  width: 140, padding: 16, background: 'rgba(50,0,80,0.6)', border: '2px solid #9900ff',
                  borderRadius: 8, cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s',
                  position: 'relative',
                }}
              >
                {badgeLabel && (
                  <div style={{
                    position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                    fontSize: 8, fontWeight: 'bold', letterSpacing: 1,
                    background: '#cc66ff', color: '#0a001a',
                    padding: '2px 8px', borderRadius: 3,
                    whiteSpace: 'nowrap', textTransform: 'uppercase',
                  }}>{isTransform ? 'TRANSFORM' : 'GRANT'}</div>
                )}
                <div style={{ fontSize: 32, marginBottom: 8 }}>{createGameIcon(aug.iconImg, aug.icon, 32)}</div>
                <div style={{ fontSize: 12, fontWeight: 'bold', color: '#ffffff', marginBottom: 4 }}>{aug.name}</div>
                <div style={{ fontSize: 10, color: '#cc99ff' }}>{aug.desc || aug.description}</div>
                {badgeLabel && (
                  <div style={{ fontSize: 9, color: '#ffcc66', marginTop: 6, fontStyle: 'italic' }}>{badgeLabel}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
