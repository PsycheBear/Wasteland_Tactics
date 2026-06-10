// Left-hand synergy panel — TFT-style tier ladders plus the active augment
// list. Memoized: it only re-renders when the board's synergies or the
// augment list actually change, not on every parent render.

import React from 'react';
import { GameIcon, createGameIcon } from '../GameIcon.jsx';
import { AUGMENT_POOL } from '../../data/augments.js';

function SynergyPanel({ synergies, augments }) {
  return (
    <div className="wt-synergy-panel">
      <div className="wt-panel-header">SYNERGIES</div>
      {synergies.length === 0 ? <div className="wt-synergy-empty">No active synergies</div> : synergies.map(s => {
        // TFT-style tier ladder: surface every threshold (2, 3, ...) and highlight reached ones.
        // bonuses is keyed by count thresholds — derive the ladder from that data.
        const tiers = Object.keys(s.bonuses).map(Number).sort((a, b) => a - b);
        const reachedTiers = tiers.filter(t => s.count >= t);
        const activeTier = reachedTiers.length ? reachedTiers[reachedTiers.length - 1] : null;
        const nextTier = tiers.find(t => s.count < t);
        const displayBonus = activeTier ? s.bonuses[activeTier] : (nextTier ? `Need ${nextTier - s.count} more for ${s.bonuses[nextTier]}` : s.bonuses[tiers[0]]);
        return (
        <div key={s.trait} className={`wt-synergy-row ${s.count >= 2 ? 'wt-synergy-row-active' : ''}`} style={{ '--synergy-color': s.color, borderColor: s.count >= 2 ? `${s.color}44` : undefined, boxShadow: s.count >= 2 ? `0 0 8px ${s.color}33` : undefined }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <GameIcon iconImg={s.iconImg} icon={s.icon} size={14} />
            <span style={{ color: s.color, fontWeight: 'bold', fontSize: 11 }}>{s.name}</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: s.count >= 2 ? s.color : 'var(--ui-text-dim)' }}>{s.count}</span>
          </div>
          {/* TFT-style tier ladder: 2 › 4 › 6 with reached tiers bright + active tier outlined. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3, fontFamily: "'Share Tech Mono', monospace" }}>
            {tiers.map((t, idx) => {
              const reached = s.count >= t;
              const isActive = t === activeTier;
              return (
                <React.Fragment key={t}>
                  <span
                    title={`${t}: ${s.bonuses[t]}`}
                    className={isActive ? 'wt-synergy-tier-active' : ''}
                    style={{
                      fontSize: 10, fontWeight: 'bold',
                      color: reached ? s.color : `${s.color}55`,
                      textShadow: isActive ? `0 0 6px ${s.color}88` : 'none',
                      padding: isActive ? '0 3px' : 0,
                      background: isActive ? `${s.color}22` : 'transparent',
                      borderRadius: 2,
                      minWidth: 10, textAlign: 'center',
                      // animation's box-shadow uses currentColor — that's `color` above.
                    }}
                  >{t}</span>
                  {idx < tiers.length - 1 && (
                    <span style={{ fontSize: 9, color: s.color, opacity: s.count >= tiers[idx + 1] ? 0.7 : 0.25 }}>{'›'}</span>
                  )}
                </React.Fragment>
              );
            })}
          </div>
          <div style={{ fontSize: 8, opacity: activeTier ? 0.75 : 0.45, marginTop: 3, lineHeight: 1.3 }}>{displayBonus}</div>
        </div>
        );
      })}
      {augments.length > 0 && (
        <div style={{ marginTop: 8, borderTop: '1px solid var(--ui-border-dim)', paddingTop: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 'bold', color: '#cc66ff', marginBottom: 4 }}>AUGMENTS</div>
          {augments.map(augId => {
            const aug = AUGMENT_POOL.find(a => a.id === augId);
            if (!aug) return null;
            return React.createElement('div', { key: augId, style: { fontSize: 9, marginBottom: 2, opacity: 0.8, display: 'flex', alignItems: 'center', gap: 3 } }, createGameIcon(aug.iconImg, aug.icon, 10), ` ${aug.name}`);
          })}
        </div>
      )}
    </div>
  );
}

export default React.memo(SynergyPanel);
