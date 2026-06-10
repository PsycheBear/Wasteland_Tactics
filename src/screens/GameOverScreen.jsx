// Full-screen game-over overlay: run summary + restart / share actions.

import React from 'react';
import { GameIcon } from '../components/GameIcon.jsx';
import { AUGMENT_POOL } from '../data/augments.js';

export default function GameOverScreen({ round, level, augments, itemInventory, onRestart }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 'var(--z-gameover)' }}>
      <div role="alertdialog" aria-label="Game over" style={{ background: 'linear-gradient(180deg, #1a0000 0%, #0a0a00 100%)', border: '3px solid #ff0000', borderRadius: 8, padding: 40, textAlign: 'center', boxShadow: '0 0 50px rgba(255,0,0,0.5)' }}>
        <div style={{ fontSize: 32, fontWeight: 'bold', color: '#ff0000', marginBottom: 16, letterSpacing: 4 }}>GAME OVER</div>
        <div style={{ fontSize: 32, fontWeight: 'bold', color: '#ff0000', marginBottom: 8 }}>YOU DIED</div>
        <div style={{ fontSize: 18, marginBottom: 12, opacity: 0.8 }}>Survived {round} rounds</div>
        <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 4 }}>Level {level} | {augments.length} augment{augments.length !== 1 ? 's' : ''} | {itemInventory.length} item{itemInventory.length !== 1 ? 's' : ''}</div>
        {augments.length > 0 && <div style={{ fontSize: 10, opacity: 0.5, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'center' }}>Augments: {augments.map(id => { const a = AUGMENT_POOL.find(x => x.id === id); return a ? <GameIcon key={id} iconImg={a.iconImg} icon={a.icon} size={12} /> : null; })}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button onClick={onRestart} style={{ padding: '12px 32px', fontSize: 16, background: 'rgba(0,100,0,0.6)', border: '2px solid var(--ui-border)', borderRadius: 4, color: 'var(--ui-primary)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 'bold' }}>RESTART</button>
          <button onClick={() => { navigator.clipboard?.writeText(`Wasteland Tactics - Survived ${round} rounds! Level ${level}, ${augments.length} augments.`); }} style={{ padding: '12px 16px', fontSize: 12, background: 'rgba(0,0,100,0.4)', border: '1px solid #6666ff', borderRadius: 4, color: '#6666ff', cursor: 'pointer', fontFamily: 'inherit' }}>Share</button>
        </div>
      </div>
    </div>
  );
}
