// Combat progress bar — TFT-style slim drain bar with text ABOVE the bar
// (text overlaid on the gradient was unreadable). Color shifts in three
// discrete bands (green / amber / red) for clarity.
//
// Subscribes to the combat tick store directly so the 100ms tick only
// re-renders this bar, not the whole game tree.

import React from 'react';
import { useCombatTick } from '../../game/uiStores.js';

export default function CombatProgressBar() {
  const combatTick = useCombatTick();
  const remainingPct = Math.max(0, (1 - combatTick / 150) * 100);
  const remainingSec = Math.max(0, Math.ceil((150 - combatTick) / 10)); // 10 ticks ≈ 1 second
  const fillColor = remainingPct > 50 ? '#4eff4e' : remainingPct > 25 ? '#ffaa00' : '#ff4444';
  const glow = remainingPct > 50 ? 'rgba(78,255,78,0.4)' : remainingPct > 25 ? 'rgba(255,170,0,0.55)' : 'rgba(255,68,68,0.7)';
  return (
    <div style={{ maxWidth: 780, width: '100%', margin: '0 auto 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      {/* Timer text above */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'Share Tech Mono', monospace", fontSize: 10, letterSpacing: 1.5, color: fillColor, textShadow: `0 0 6px ${glow}` }}>
        <span style={{ opacity: 0.7 }}>COMBAT</span>
        <span style={{ fontWeight: 'bold', fontSize: 12 }}>{remainingSec}s</span>
      </div>
      {/* Slim drain bar */}
      <div style={{ width: '100%', height: 6, background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.6)' }}>
        <div style={{
          width: `${remainingPct}%`,
          height: '100%',
          background: `linear-gradient(180deg, ${fillColor} 0%, ${fillColor}cc 100%)`,
          boxShadow: `0 0 8px ${glow}, inset 0 1px 0 rgba(255,255,255,0.18)`,
          transition: 'width 0.1s linear, background 0.3s, box-shadow 0.3s',
        }} />
      </div>
    </div>
  );
}
