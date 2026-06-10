// Augment offer modal — TFT-style redesign.
//
// Visual: ornate gold/purple framed cards with hex icon plate, name, description,
// and a per-card reroll button at the bottom (up to 3 rerolls each).
// Behaviour: clicking the card picks the augment. Clicking the reroll arrow
// swaps that one slot for a fresh augment pulled from `availableAugments`
// that isn't currently shown. Each slot starts with 3 rerolls.
//
// Props:
//   choice              — { options: [aug, aug, aug] } or null
//   onPick(aug)         — callback when player picks one
//   availableAugments   — full pool of un-owned augments (used to seed rerolls)

import React, { useState, useEffect, useRef } from 'react';
import { createGameIcon } from './GameIcon.jsx';
import Modal from './Modal.jsx';

const REROLLS_PER_SLOT = 3;

function pickFresh(pool, exclude) {
  const candidates = pool.filter(a => !exclude.includes(a.id));
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export default function AugmentPicker({ choice, onPick, availableAugments = [] }) {
  // Internal mirror of the displayed augments so we can reroll individual slots.
  const [displayed, setDisplayed] = useState(null);
  const [rerollsLeft, setRerollsLeft] = useState([REROLLS_PER_SLOT, REROLLS_PER_SLOT, REROLLS_PER_SLOT]);
  // Track the last choice id-set so we reset when a NEW offer arrives.
  const lastKeyRef = useRef(null);

  useEffect(() => {
    if (!choice) {
      setDisplayed(null);
      lastKeyRef.current = null;
      return;
    }
    const key = (choice.options || []).map(o => o.id).join('|');
    if (lastKeyRef.current !== key) {
      setDisplayed(choice.options || []);
      setRerollsLeft([REROLLS_PER_SLOT, REROLLS_PER_SLOT, REROLLS_PER_SLOT]);
      lastKeyRef.current = key;
    }
  }, [choice]);

  if (!choice || !displayed) return null;

  const handleReroll = (idx) => {
    if ((rerollsLeft[idx] || 0) <= 0) return;
    const excludeIds = displayed.map(d => d.id);
    const fresh = pickFresh(availableAugments, excludeIds);
    if (!fresh) return;
    setDisplayed(prev => {
      const next = [...prev];
      next[idx] = fresh;
      return next;
    });
    setRerollsLeft(prev => {
      const next = [...prev];
      next[idx] = Math.max(0, next[idx] - 1);
      return next;
    });
  };

  return (
    // No onClose: augment choice is mandatory — the modal only adds the focus
    // trap so keyboard users can't tab out into the game underneath.
    <Modal label="Choose an augment" zIndex="var(--z-overlay)" scrimStyle={{
      background: 'radial-gradient(ellipse at center, rgba(10,20,30,0.94) 0%, rgba(3,6,10,0.97) 70%)',
      backdropFilter: 'blur(6px)',
    }} panelStyle={{
      textAlign: 'center',
      animation: 'wt-aug-panel-in 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
    }}>
        <div style={{
          fontSize: 36, fontWeight: 'bold', color: '#e8c780', marginBottom: 22,
          letterSpacing: 6, textTransform: 'uppercase',
          textShadow: '0 0 18px rgba(95,200,230,0.5), 0 0 30px rgba(212,175,106,0.35), 0 2px 0 rgba(0,0,0,0.7)',
          fontFamily: '"Cinzel", "Trajan Pro", "Cambria", Georgia, serif',
        }}>
          CHOOSE ONE
        </div>
        <div style={{ display: 'flex', gap: 18, justifyContent: 'center', alignItems: 'flex-start' }}>
          {displayed.map((aug, idx) => {
            const isGrant = !!aug.grantUnit;
            const isTransform = !!aug.transformUnit;
            const badgeLabel = isTransform
              ? `Transforms ${aug.transformUnit.from} → ${aug.transformUnit.to}`
              : isGrant
                ? `Grants 1★ ${aug.grantUnit.id}`
                : null;
            const remaining = rerollsLeft[idx] || 0;
            return (
              <div key={`${aug.id}_${idx}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, position: 'relative' }}>
                {/* Ornate frame — TFT-style: layered borders with gold + purple
                    accent and an inner darker plate. */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onPick?.(aug)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick?.(aug); } }}
                  className="wt-aug-card"
                  style={{
                    width: 180, height: 280, padding: '20px 16px 22px',
                    cursor: 'pointer',
                    position: 'relative',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                    background: 'linear-gradient(180deg, rgba(14,26,38,0.96) 0%, rgba(8,16,24,0.96) 100%)',
                    border: '3px solid transparent',
                    backgroundImage: `
                      linear-gradient(180deg, rgba(14,26,38,0.96), rgba(8,16,24,0.96)),
                      linear-gradient(180deg, #e8c780 0%, #5fc8e6 50%, #c8a25e 100%)
                    `,
                    backgroundOrigin: 'border-box',
                    backgroundClip: 'padding-box, border-box',
                    borderRadius: 10,
                    boxShadow: '0 0 24px rgba(95,200,230,0.35), inset 0 0 22px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)',
                    transition: 'transform 0.18s ease, box-shadow 0.18s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px) scale(1.03)'; e.currentTarget.style.boxShadow = '0 0 36px rgba(95,200,230,0.6), inset 0 0 22px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.12)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 0 24px rgba(95,200,230,0.35), inset 0 0 22px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)'; }}
                >
                  {badgeLabel && (
                    <div style={{
                      position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)',
                      fontSize: 8, fontWeight: 'bold', letterSpacing: 1.4,
                      background: 'linear-gradient(180deg, #e8c780, #b88c3e)',
                      color: '#1a1410',
                      padding: '2px 10px', borderRadius: 3,
                      whiteSpace: 'nowrap', textTransform: 'uppercase',
                      boxShadow: '0 0 8px rgba(255,215,106,0.7)',
                      border: '1px solid rgba(0,0,0,0.45)',
                      fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
                    }}>{isTransform ? 'TRANSFORM' : 'GRANT'}</div>
                  )}
                  {/* Hex icon plate */}
                  <div style={{
                    width: 78, height: 78, marginTop: 6,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    position: 'relative',
                  }}>
                    {/* Hex SVG background */}
                    <svg viewBox="0 0 100 100" width="78" height="78" style={{ position: 'absolute', inset: 0 }} aria-hidden="true">
                      <defs>
                        <linearGradient id={`aug-hex-${idx}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#1e3850" />
                          <stop offset="100%" stopColor="#0a1620" />
                        </linearGradient>
                      </defs>
                      <polygon
                        points="50,4 92,28 92,72 50,96 8,72 8,28"
                        fill={`url(#aug-hex-${idx})`}
                        stroke="#5fc8e6"
                        strokeWidth="2.5"
                        style={{ filter: 'drop-shadow(0 0 8px rgba(95,200,230,0.55))' }}
                      />
                      <polygon
                        points="50,14 84,32 84,68 50,86 16,68 16,32"
                        fill="none"
                        stroke="rgba(255,215,106,0.5)"
                        strokeWidth="1"
                      />
                    </svg>
                    <div style={{ position: 'relative', zIndex: 1, transform: 'scale(1.1)' }}>
                      {createGameIcon(aug.iconImg, aug.icon, 36)}
                    </div>
                  </div>
                  {/* Name */}
                  <div style={{
                    fontSize: 15, fontWeight: 700, color: '#e8c780',
                    textShadow: '0 0 8px rgba(95,200,230,0.4), 0 1px 0 rgba(0,0,0,0.7)',
                    letterSpacing: 1, marginTop: 2, lineHeight: 1.15,
                    fontFamily: '"Cinzel", "Trajan Pro", "Cambria", Georgia, serif',
                  }}>{aug.name}</div>
                  {/* Description plate */}
                  <div style={{
                    flex: 1,
                    marginTop: 4, padding: '8px 10px',
                    background: 'rgba(0,0,0,0.45)',
                    border: '1px solid rgba(95,200,230,0.3)',
                    borderRadius: 5,
                    fontSize: 10, lineHeight: 1.4, color: '#ede1c2',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    textAlign: 'center',
                    width: '100%',
                    boxShadow: 'inset 0 0 12px rgba(95,200,230,0.08)',
                  }}>{aug.desc || aug.description}</div>
                  {badgeLabel && (
                    <div style={{ fontSize: 9, color: '#ffcc66', fontStyle: 'italic', marginTop: 2 }}>{badgeLabel}</div>
                  )}
                </div>
                {/* Reroll button — below the card. Disabled when exhausted. */}
                <button
                  onClick={(e) => { e.stopPropagation(); handleReroll(idx); }}
                  disabled={remaining <= 0}
                  title={remaining > 0 ? `Reroll this slot (${remaining} left)` : 'No rerolls left for this slot'}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    width: 130, padding: '6px 10px',
                    background: remaining > 0 ? 'linear-gradient(180deg, rgba(30,55,75,0.9), rgba(10,20,30,0.9))' : 'rgba(30,15,40,0.6)',
                    border: `2px solid ${remaining > 0 ? '#5fc8e6' : '#5a3a78'}`,
                    borderRadius: 5,
                    color: remaining > 0 ? '#e8c780' : '#666',
                    cursor: remaining > 0 ? 'pointer' : 'not-allowed',
                    fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
                    fontSize: 10, fontWeight: 'bold', letterSpacing: 1.4,
                    boxShadow: remaining > 0 ? '0 0 8px rgba(95,200,230,0.35), inset 0 1px 0 rgba(255,255,255,0.08)' : 'none',
                    transition: 'transform 0.15s, box-shadow 0.15s',
                  }}
                  onMouseEnter={(e) => { if (remaining > 0) { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 0 14px rgba(95,200,230,0.65)'; } }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = remaining > 0 ? '0 0 8px rgba(95,200,230,0.35), inset 0 1px 0 rgba(255,255,255,0.08)' : 'none'; }}
                >
                  {/* Circular arrow SVG */}
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M2 8 a 6 6 0 0 1 10.5 -4 M13 2 v 3 h -3" />
                    <path d="M14 8 a 6 6 0 0 1 -10.5 4 M3 14 v -3 h 3" />
                  </svg>
                  <span>REROLL {remaining}/{REROLLS_PER_SLOT}</span>
                </button>
              </div>
            );
          })}
        </div>
    </Modal>
  );
}
