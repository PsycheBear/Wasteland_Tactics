import React, { useState, useEffect, useRef } from 'react';

const BOOT_SEQUENCE = [
  { text: '', delay: 200 },
  { text: 'ROBCO INDUSTRIES (TM) UNIFIED OPERATING SYSTEM', delay: 0, style: 'header' },
  { text: 'COPYRIGHT 2287 ROBCO INDUSTRIES', delay: 80, style: 'dim' },
  { text: '–––––––––––––––––––––––––––––––––––––––––––––––', delay: 80, style: 'dim' },
  { text: '', delay: 100 },
  { text: '> Establishing uplink to Vault-Tec HQ...', delay: 300 },
  { text: '  [OK] Connection established', delay: 200, style: 'success' },
  { text: '> Loading WASTELAND TACTICAL SYSTEM v0.4.2...', delay: 250 },
  { text: '  [OK] Core modules loaded', delay: 180, style: 'success' },
  { text: '> Initializing combat subsystems...', delay: 200 },
  { text: '  ├─ V.A.T.S. targeting matrix............ ONLINE', delay: 150, style: 'sub' },
  { text: '  ├─ Unit database (22 records)........... LOADED', delay: 120, style: 'sub' },
  { text: '  ├─ Synergy algorithm v3.1............... COMPILED', delay: 130, style: 'sub' },
  { text: '  ├─ Lucky 38 casino protocols............ LINKED', delay: 140, style: 'sub' },
  { text: '  └─ Pip-Boy frequency calibration........ LOCKED', delay: 120, style: 'sub' },
  { text: '  [OK] All subsystems operational', delay: 200, style: 'success' },
  { text: '> Scanning wasteland frequencies...', delay: 350 },
  { text: '  [OK] 7 hostiles detected in sector', delay: 200, style: 'success' },
  { text: '> Decrypting field intel...', delay: 300 },
  { text: '  [OK] Intel decrypted — briefing ready', delay: 200, style: 'success' },
  { text: '', delay: 100 },
  { text: '–––––––––––––––––––––––––––––––––––––––––––––––', delay: 80, style: 'dim' },
  { text: '> SYSTEM READY. WELCOME, OVERSEER.', delay: 200, style: 'ready' },
  { text: '', delay: 100 },
  { text: 'Press any key to continue...', delay: 0, style: 'blink' },
];

const TIPS = [
  "War. War never changes.",
  "A 3-star unit requires nine copies total.",
  "Sell units you don't need to fund rerolls.",
  "The Lucky 38 awaits the bold and the foolish.",
  "Synergies are the key to victory in the wasteland.",
  "Items combine automatically when paired on a unit.",
  "Boss rounds appear every 7 rounds. Prepare accordingly.",
  "Place melee units in front, ranged units in back.",
  "Save your caps and earn interest — up to +5 per round.",
  "High Roller augment gives you a free re-spin at the Lucky 38.",
  "Raider synergy turns your crits into devastating blows.",
  "Ghoul units regenerate health and resist poison.",
  "Scout synergy grants attack speed and dodge chance.",
];

export default function LoadingScreen({ onComplete }) {
  const [lines, setLines] = useState([]);
  const [phase, setPhase] = useState('boot'); // 'boot' | 'ready'
  const [tipIndex] = useState(() => Math.floor(Math.random() * TIPS.length));
  const doneRef = useRef(false);

  // Boot sequence — type lines one by one
  useEffect(() => {
    const timers = [];
    let cumDelay = 200; // initial pause
    BOOT_SEQUENCE.forEach((entry, i) => {
      cumDelay += entry.delay * 0.5;
      timers.push(setTimeout(() => {
        setLines(prev => [...prev, entry]);
        if (i === BOOT_SEQUENCE.length - 1) setPhase('ready');
      }, cumDelay));
      // Add typing time between lines
      cumDelay += 30 + entry.text.length;
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  // Listen for any key/click once ready
  useEffect(() => {
    if (phase !== 'ready') return;
    const handler = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      onComplete?.();
    };
    // Small delay so the "press any key" is visible before accepting input
    const t = setTimeout(() => {
      document.addEventListener('click', handler);
      document.addEventListener('keydown', handler);
    }, 300);
    return () => {
      clearTimeout(t);
      document.removeEventListener('click', handler);
      document.removeEventListener('keydown', handler);
    };
  }, [phase, onComplete]);

  const getLineStyle = (style) => {
    switch (style) {
      case 'header': return { color: '#c8942a', fontWeight: 'bold', fontSize: 13 };
      case 'dim': return { color: '#5a4a20', opacity: 0.6 };
      case 'success': return { color: '#44cc44' };
      case 'sub': return { color: '#8a8a5a' };
      case 'ready': return { color: '#c8942a', fontWeight: 'bold', textShadow: '0 0 12px rgba(200,148,42,0.6)' };
      case 'blink': return { color: '#c8942a', animation: 'wt-boot-blink 1s step-end infinite', marginTop: 8 };
      default: return { color: '#88aa44' };
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: '#0a0a06',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Share Tech Mono', 'Courier New', monospace",
      fontSize: 12, lineHeight: 1.7, letterSpacing: 0.5,
      overflow: 'hidden',
    }}>
      {/* CRT scanlines */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2,
        background: 'repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)',
      }} />
      {/* Vignette */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
        background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.7) 100%)',
      }} />
      {/* Green phosphor glow */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
        background: 'radial-gradient(ellipse at 50% 50%, rgba(100,200,50,0.03) 0%, transparent 60%)',
      }} />
      {/* Noise */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1, opacity: 0.03,
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
      }} />
      {/* Moving scanline bar */}
      <div style={{
        position: 'absolute', left: 0, right: 0, height: 3, zIndex: 2, pointerEvents: 'none',
        background: 'linear-gradient(180deg, transparent, rgba(100,200,50,0.06), transparent)',
        animation: 'wt-boot-scanbar 4s linear infinite',
      }} />

      {/* Terminal content */}
      <div style={{
        position: 'relative', zIndex: 3,
        flex: 1, padding: '40px 60px', overflowY: 'auto',
        maxWidth: 800, width: '100%', margin: '0 auto',
      }}>
        {lines.map((entry, i) => (
          <div key={i} style={{
            ...getLineStyle(entry.style),
            animation: entry.style !== 'blink' ? `wt-boot-line-in 0.15s ease-out` : undefined,
            whiteSpace: 'pre',
          }}>
            {entry.text || '\u00A0'}
          </div>
        ))}
        {phase === 'boot' && (
          <span style={{ color: '#88aa44', animation: 'wt-boot-blink 0.6s step-end infinite' }}>█</span>
        )}
      </div>

      {/* Bottom bar */}
      <div style={{
        position: 'relative', zIndex: 3,
        padding: '12px 60px',
        borderTop: '1px solid rgba(200,148,42,0.15)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ color: 'rgba(200,148,42,0.2)', fontSize: 10, letterSpacing: 4 }}>VAULT-TEC INDUSTRIES</span>
        <span style={{ color: 'rgba(200,148,42,0.35)', fontSize: 10, fontStyle: 'italic' }}>"{TIPS[tipIndex]}"</span>
      </div>
    </div>
  );
}
