import React, { useState, useEffect, useRef, useCallback } from 'react';
import { UNIT_DATABASE } from '../data/units.js';
import { COMPLETED_ITEMS, ITEM_COMPONENT_KEYS, getRandomComponent } from '../data/items.js';
import { AUGMENT_POOL } from '../data/augments.js';
import { UNIT_KEYS, getRandomCost, makeUid } from '../data/constants.js';
import { BASE } from '../baseUrl.js';

/* ─── Wheel Slice Definitions ─── */
// `icon` is a short ASCII label shown on the wheel. Emoji glyphs (radioactive
// symbol, chess pieces, etc.) were retired in favor of plain text/symbol
// characters that match the retro Pip-Boy aesthetic.
const WHEEL_SLICES = [
  { id: 'caps_small', label: 'Caps +2', icon: '¢', color: '#b8860b', colorEnd: '#8b6914', weight: 18, rarity: 'common' },
  { id: 'caps_large', label: 'Caps +5', icon: '$', color: '#daa520', colorEnd: '#b8860b', weight: 10, rarity: 'uncommon' },
  { id: 'unit_common', label: 'Free Unit', icon: 'U', color: '#2244aa', colorEnd: '#1a3388', weight: 16, rarity: 'common' },
  { id: 'unit_rare', label: 'Rare Unit', icon: 'R', color: '#6622aa', colorEnd: '#4a1880', weight: 10, rarity: 'uncommon' },
  { id: 'item_component', label: 'Item Part', icon: 'I', color: '#606878', colorEnd: '#484e58', weight: 14, rarity: 'common' },
  { id: 'full_item', label: 'Full Item', icon: 'F', color: '#1a8844', colorEnd: '#126633', weight: 6, rarity: 'rare' },
  { id: 'augment', label: 'Augment', icon: 'A', color: '#8822cc', colorEnd: '#661aa0', weight: 8, rarity: 'uncommon' },
  { id: 'hp_restore', label: 'HP +15', icon: '+', color: '#cc2222', colorEnd: '#991a1a', weight: 8, rarity: 'uncommon' },
  { id: 'jackpot', label: 'JACKPOT', icon: '7', color: '#cc0000', colorEnd: '#880000', weight: 3, rarity: 'legendary' },
  { id: 'nuka_bust', label: 'Nuka-Cola', icon: 'N', color: '#8b2500', colorEnd: '#5a1800', weight: 7, rarity: 'common' },
];

const RARITY_GLOW = {
  common: 'none',
  uncommon: '0 0 8px rgba(68,136,255,0.4)',
  rare: '0 0 12px rgba(255,153,0,0.5)',
  legendary: '0 0 20px rgba(255,68,68,0.7)',
};

const GHOST_REWARDS = ['Caps +3', 'Free Unit', 'Item Part', 'HP +10', 'Caps +2', 'Augment', 'Nuka-Cola'];

/* ─── Weighted Random Pick ─── */
function calculateSpin(slices) {
  const totalWeight = slices.reduce((sum, s) => sum + s.weight, 0);
  let roll = Math.random() * totalWeight;
  let winnerIndex = 0;
  for (let i = 0; i < slices.length; i++) {
    roll -= slices[i].weight;
    if (roll <= 0) { winnerIndex = i; break; }
  }

  const sliceAngle = 360 / slices.length;
  const sliceCenter = winnerIndex * sliceAngle + sliceAngle / 2;
  const offset = (Math.random() - 0.5) * (sliceAngle * 0.6);
  const targetAngle = 360 - sliceCenter + offset;
  const totalAngle = targetAngle + 360 * (4 + Math.floor(Math.random() * 2));

  return { winnerIndex, totalAngle };
}

/* ─── Build conic-gradient string with richer slice gradients ─── */
function buildConicGradient(slices) {
  const sliceAngle = 360 / slices.length;
  const segments = [];
  slices.forEach((s, i) => {
    const start = i * sliceAngle;
    const mid = start + sliceAngle * 0.5;
    const end = start + sliceAngle;
    // Each slice: lighter at edges, darker in middle for depth
    segments.push(`${s.color} ${start}deg`);
    segments.push(`${s.colorEnd || s.color} ${mid}deg`);
    segments.push(`${s.color} ${end}deg`);
  });
  return `conic-gradient(from 0deg, ${segments.join(', ')})`;
}

/* ─── Lucky 38 Carousel Component ─── */
export default function Lucky38Carousel({
  round, gold, setGold, hp, setHp, level,
  bench, setBench, itemInventory, setItemInventory,
  augments, setAugmentChoice, poolRef, ghostPlayersRef,
  hasHighRoller, setLog, sound, onComplete,
}) {
  const [stage, setStage] = useState('elevator');
  const [elevatorFloor, setElevatorFloor] = useState(1);
  const [doorsOpen, setDoorsOpen] = useState(false);
  const [neonLit, setNeonLit] = useState([]);
  const [wheelAngle, setWheelAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winResult, setWinResult] = useState(null);
  const [nearMiss, setNearMiss] = useState(false);
  const [rewardText, setRewardText] = useState('');
  const [hasUsedRespin, setHasUsedRespin] = useState(false);
  const [showJackpot, setShowJackpot] = useState(false);
  const [showBust, setShowBust] = useState(false);
  const [flyaway, setFlyaway] = useState(false);
  const [particles, setParticles] = useState([]);
  const [ghostRewards, setGhostRewards] = useState([]);
  const wheelRef = useRef(null);
  const spinResolveRef = useRef(null);
  const totalAngleRef = useRef(0);
  const spinTimersRef = useRef([]);
  useEffect(() => () => spinTimersRef.current.forEach(clearTimeout), []);

  /* ─── Elevator Entrance Sequence ─── */
  useEffect(() => {
    if (stage !== 'elevator') return;
    // Floor counter ticking up
    const floorInterval = setInterval(() => {
      setElevatorFloor(f => {
        if (f >= 38) { clearInterval(floorInterval); return 38; }
        return f + 1;
      });
    }, 55);
    try { sound?.elevatorHum?.(); } catch(_) {}
    const doorsTimer = setTimeout(() => {
      setDoorsOpen(true);
      try { sound?.elevatorDing?.(); } catch(_) {}
      try { sound?.doorsOpen?.(); } catch(_) {}
    }, 2500);
    const neonTimers = [];
    const neonLetters = ['L', 'U', 'C', 'K', 'Y', ' ', '3', '8'];
    neonLetters.forEach((_, i) => {
      neonTimers.push(setTimeout(() => {
        setNeonLit(prev => [...prev, i]);
        try { sound?.neonBuzz?.(); } catch(_) {}
      }, 3000 + i * 100));
    });
    const readyTimer = setTimeout(() => {
      setStage('ready');
      try { sound?.startCasinoMusic?.(); } catch(_) {}
    }, 4000);
    return () => {
      clearInterval(floorInterval);
      clearTimeout(doorsTimer);
      neonTimers.forEach(clearTimeout);
      clearTimeout(readyTimer);
    };
  }, [stage]);

  /* ─── Add random unit to bench ─── */
  const addRandomUnit = useCallback((costLevel) => {
    const cost = getRandomCost(costLevel);
    const available = UNIT_KEYS.filter(k => UNIT_DATABASE[k].cost === cost && (poolRef?.current?.[k] || 0) > 0);
    const candidates = available.length > 0 ? available : UNIT_KEYS.filter(k => (poolRef?.current?.[k] || 0) > 0);
    if (candidates.length === 0) return;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    if (poolRef?.current) poolRef.current[pick] = Math.max(0, (poolRef.current[pick] || 0) - 1);
    const unit = { ...UNIT_DATABASE[pick], id: pick, stars: 1, uid: makeUid(), items: [] };
    setBench(prev => {
      const idx = prev.findIndex(s => s === null);
      if (idx === -1) return prev; // bench full
      const next = [...prev];
      next[idx] = unit;
      return next;
    });
    return unit;
  }, [poolRef, setBench]);

  /* ─── Add jackpot 2-star unit ─── */
  const addJackpotUnit = useCallback(() => {
    const cost = Math.min(level + 1, 5);
    const available = UNIT_KEYS.filter(k => UNIT_DATABASE[k].cost >= cost && (poolRef?.current?.[k] || 0) >= 3);
    const candidates = available.length > 0 ? available : UNIT_KEYS.filter(k => (poolRef?.current?.[k] || 0) >= 3);
    if (candidates.length === 0) return addRandomUnit(level);
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    if (poolRef?.current) poolRef.current[pick] = Math.max(0, (poolRef.current[pick] || 0) - 3);
    const unit = { ...UNIT_DATABASE[pick], id: pick, stars: 2, uid: makeUid(), items: [] };
    setBench(prev => {
      const idx = prev.findIndex(s => s === null);
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = unit;
      return next;
    });
    return unit;
  }, [level, poolRef, setBench, addRandomUnit]);

  /* ─── Add random completed item ─── */
  const addRandomCompletedItem = useCallback(() => {
    const keys = Object.keys(COMPLETED_ITEMS);
    const pick = keys[Math.floor(Math.random() * keys.length)];
    setItemInventory(prev => [...prev, pick]);
    return COMPLETED_ITEMS[pick];
  }, [setItemInventory]);

  /* ─── Trigger augment choice ─── */
  const triggerAugmentChoice = useCallback(() => {
    const available = AUGMENT_POOL.filter(a => !augments.includes(a.id));
    if (available.length >= 3) {
      const shuffled = [...available].sort(() => Math.random() - 0.5);
      setAugmentChoice({ options: shuffled.slice(0, 3) });
    }
  }, [augments, setAugmentChoice]);

  /* ─── Apply reward ─── */
  const applyReward = useCallback((slice) => {
    let desc = '';
    switch (slice.id) {
      case 'caps_small': setGold(g => g + 2); desc = '+2 Caps'; break;
      case 'caps_large': setGold(g => g + 5); desc = '+5 Caps'; break;
      case 'unit_common': { const u = addRandomUnit(level); desc = u ? `${u.name} added to bench` : 'Bench full!'; break; }
      case 'unit_rare': { const u = addRandomUnit(Math.min(level + 1, 9)); desc = u ? `${u.name} (rare) added to bench` : 'Bench full!'; break; }
      case 'item_component': { const comp = getRandomComponent(); setItemInventory(prev => [...prev, comp]); desc = 'Item component acquired'; break; }
      case 'full_item': { const item = addRandomCompletedItem(); desc = item ? `${item.name} acquired!` : 'Item acquired'; break; }
      case 'augment': triggerAugmentChoice(); desc = 'Choose an augment!'; break;
      case 'hp_restore': setHp(h => Math.min(100, h + 15)); desc = '+15 HP restored'; break;
      case 'jackpot': { const u = addJackpotUnit(); desc = u ? `JACKPOT! 2-star ${u.name}!` : 'JACKPOT! Bonus unit!'; break; }
      case 'nuka_bust': setGold(g => g + 1); desc = '+1 Cap... better luck next time'; break;
      default: break;
    }
    setLog(prev => [`[LUCKY] Lucky 38: ${desc}`, ...prev.slice(0, 9)]);
    return desc;
  }, [setGold, setHp, setItemInventory, setLog, level, addRandomUnit, addJackpotUnit, addRandomCompletedItem, triggerAugmentChoice]);

  /* ─── Spin tick sound loop ─── */
  const spinTickRef = useRef(null);
  const startSpinTicks = useCallback((durationMs) => {
    // Play tick sounds that start fast and slow down over the spin duration
    let elapsed = 0;
    const totalTicks = 40;
    const playNextTick = () => {
      if (elapsed >= totalTicks) return;
      elapsed++;
      try { sound?.wheelTick?.(); } catch(_) {}
      // Interval starts at 80ms (fast) and grows to 600ms (slow) using easing
      const progress = elapsed / totalTicks;
      const eased = progress * progress * progress; // cubic easing — slow at end
      const interval = 80 + eased * 520;
      // Add tension beat in the last 30%
      if (progress > 0.7) { try { sound?.tensionBeat?.(); } catch(_) {} }
      spinTickRef.current = setTimeout(playNextTick, interval);
    };
    playNextTick();
  }, [sound]);
  const stopSpinTicks = useCallback(() => {
    if (spinTickRef.current) { clearTimeout(spinTickRef.current); spinTickRef.current = null; }
  }, []);

  /* ─── finishSpin ref (declared before doSpin to avoid TDZ) ─── */
  const finishSpinRef = useRef(null);

  /* ─── Spin the wheel ─── */
  const doSpin = useCallback(() => {
    if (spinning) return;
    setSpinning(true);
    setStage('spinning');
    try { sound?.leverPull?.(); } catch(_) {}

    const { winnerIndex, totalAngle } = calculateSpin(WHEEL_SLICES);
    const winner = WHEEL_SLICES[winnerIndex];
    totalAngleRef.current = totalAngle;

    // Near-miss logic: ~20% chance if not jackpot/full_item
    let finalAngle = totalAngle;
    let doNearMiss = false;
    if (winner.id !== 'jackpot' && winner.id !== 'full_item' && Math.random() < 0.2) {
      doNearMiss = true;
      const jackpotIdx = WHEEL_SLICES.findIndex(s => s.id === 'jackpot');
      const sliceAngle = 360 / WHEEL_SLICES.length;
      const jackpotCenter = jackpotIdx * sliceAngle + sliceAngle / 2;
      const nearTarget = 360 - jackpotCenter + 5 + Math.random() * 5;
      finalAngle = nearTarget + 360 * (4 + Math.floor(Math.random() * 2));
    }

    // Start tick sounds
    try { sound?.wheelSpin?.(); } catch(_) {}
    startSpinTicks(doNearMiss ? 7500 : 8500);

    const trackTimer = (fn, ms) => { const id = setTimeout(fn, ms); spinTimersRef.current.push(id); return id; };
    if (doNearMiss) {
      setWheelAngle(finalAngle);
      trackTimer(() => {
        stopSpinTicks();
        setNearMiss(true);
        try { sound?.nearMissSting?.(); } catch(_) {}
        trackTimer(() => {
          setNearMiss(false);
          const slippedAngle = finalAngle + 15;
          setWheelAngle(slippedAngle);
          // Calculate actual winner from final wheel position
          const sliceAngle = 360 / WHEEL_SLICES.length;
          const normalAngle = ((slippedAngle % 360) + 360) % 360;
          const pointerSliceIdx = Math.floor(((360 - normalAngle) % 360 + 360) % 360 / sliceAngle) % WHEEL_SLICES.length;
          const actualWinner = WHEEL_SLICES[pointerSliceIdx];
          trackTimer(() => finishSpinRef.current?.(actualWinner), 1500);
        }, 300);
      }, 7500);
    } else {
      setWheelAngle(totalAngle);
      trackTimer(() => { stopSpinTicks(); finishSpinRef.current?.(winner); }, 8500);
    }
  }, [spinning, startSpinTicks, stopSpinTicks]);

  const finishSpin = useCallback((winner) => {
    setSpinning(false);
    setWinResult(winner);
    const track = (fn, ms) => { spinTimersRef.current.push(setTimeout(fn, ms)); };

    if (winner.id === 'jackpot') {
      setStage('result');
      setShowJackpot(true);
      const p = Array.from({ length: 30 }, (_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * 400,
        y: (Math.random() - 0.5) * 400,
        color: ['#ffd700', '#ff4444', '#ff9900', '#ffff44'][Math.floor(Math.random() * 4)],
        size: 4 + Math.random() * 8,
        delay: Math.random() * 0.3,
      }));
      setParticles(p);
      try { sound?.winJackpot?.(); } catch(_) {}
      const desc = applyReward(winner);
      setRewardText(desc);
      track(() => {
        setShowJackpot(false);
        setParticles([]);
        if (hasHighRoller && !hasUsedRespin) {
          setStage('respin');
        } else {
          setStage('claim');
        }
      }, 3000);
    } else if (winner.id === 'nuka_bust') {
      setStage('result');
      setShowBust(true);
      try { sound?.bustPowerdown?.(); } catch(_) {}
      track(() => {
        setShowBust(false);
        try { sound?.bustRecovery?.(); } catch(_) {}
        const desc = applyReward(winner);
        setRewardText(desc);
        if (hasHighRoller && !hasUsedRespin) {
          setStage('respin');
        } else {
          setStage('claim');
        }
      }, 2000);
    } else {
      setStage('result');
      try { sound?.[winner.rarity === 'uncommon' || winner.rarity === 'rare' ? 'winUncommon' : 'winCommon']?.(); } catch(_) {}
      const desc = applyReward(winner);
      setRewardText(desc);
      track(() => {
        if (hasHighRoller && !hasUsedRespin) {
          setStage('respin');
        } else {
          setStage('claim');
        }
      }, 1500);
    }
  }, [applyReward, hasHighRoller, hasUsedRespin]);
  finishSpinRef.current = finishSpin;

  /* ─── Re-spin (High Roller augment) ─── */
  const doRespin = useCallback(() => {
    setHasUsedRespin(true);
    setWinResult(null);
    setRewardText('');
    setStage('ready');
    setSpinning(false);
    // Reset wheel for visual clarity (keep current angle as base)
  }, []);

  /* ─── Claim reward ─── */
  const doClaim = useCallback(() => {
    setStage('flyaway');
    setFlyaway(true);
    try { sound?.claimClick?.(); } catch(_) {}
    try { sound?.rewardFlyaway?.(); } catch(_) {}
    setTimeout(() => {
      // Generate ghost rewards for summary
      const ghosts = (ghostPlayersRef?.current || []).slice(0, 5).map((g, i) => ({
        name: g?.name || `Ghost ${i + 1}`,
        reward: GHOST_REWARDS[Math.floor(Math.random() * GHOST_REWARDS.length)],
      }));
      setGhostRewards(ghosts);
      setStage('summary');
    }, 800);
  }, [ghostPlayersRef]);

  /* ─── Dismiss summary ─── */
  const doExit = useCallback(() => {
    setStage('exit');
    try { sound?.stopCasinoMusic?.(); } catch(_) {}
    setTimeout(() => {
      onComplete();
    }, 600);
  }, [onComplete, sound]);

  /* ─── Skip respin, go to claim ─── */
  const skipRespin = useCallback(() => {
    setStage('claim');
  }, []);

  /* ─── Conic gradient for wheel ─── */
  const sliceAngle = 360 / WHEEL_SLICES.length;

  /* ─── Find luckiest ghost ─── */
  const luckiest = ghostRewards.length > 0
    ? ghostRewards.reduce((best, g) => (g.reward === 'Augment' || g.reward === 'Free Unit') ? g : best, ghostRewards[0])
    : null;

  return (
    <div className={`lucky38-overlay ${stage === 'exit' ? 'lucky38-exit' : ''}`}>
      {/* ─── ELEVATOR ENTRANCE ─── */}
      {stage === 'elevator' && (
        <div className="lucky38-elevator">
          <div className="lucky38-elevator-shaft">
            <div className="lucky38-floor-display">
              <span className="lucky38-floor-label">FLOOR</span>
              <span className="lucky38-floor-number">{elevatorFloor}</span>
            </div>
            <div className={`lucky38-doors ${doorsOpen ? 'lucky38-doors-open' : ''}`}>
              <div className="lucky38-door lucky38-door-left" />
              <div className="lucky38-door lucky38-door-right" />
            </div>
          </div>
          <div className="lucky38-neon-row">
            {['L', 'U', 'C', 'K', 'Y', ' ', '3', '8'].map((ch, i) => (
              <span key={i} className={`lucky38-neon-letter ${neonLit.includes(i) ? 'lucky38-neon-on' : ''}`}>
                {ch}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ─── WHEEL PHASE (ready / spinning / result / respin / claim) ─── */}
      {(stage === 'ready' || stage === 'spinning' || stage === 'result' || stage === 'respin' || stage === 'claim') && (
        <div className={`lucky38-casino ${showBust ? 'lucky38-bust-dim' : ''} ${showJackpot ? 'lucky38-shake' : ''}`}>
          {/* Neon border frame */}
          <div className="lucky38-neon-frame" />
          {/* Casino diamond pattern background */}
          <div className="lucky38-casino-pattern" />
          {/* Gold flash overlay for jackpot */}
          {showJackpot && <div className="lucky38-gold-flash" />}

          {/* Header — neon sign + round badge with more spacing */}
          <div className="lucky38-header" style={{ marginBottom: 16 }}>
            <div className="lucky38-title-sign">
              {'LUCKY 38'.split('').map((ch, i) => (
                <span key={i} className="lucky38-title-letter" style={{ animationDelay: `${i * 0.15}s` }}>{ch}</span>
              ))}
            </div>
            <div className="lucky38-round-display" style={{ marginTop: 8 }}>ROUND {round}</div>
          </div>

          {/*
            Wheel with roulette-wheel.png image.
            10 rewards mapped to 36° each starting from 12 o'clock clockwise.
            Pointer is a separate SVG arrow fixed at top center.
          */}
          <div className="lucky38-wheel-wrap" style={{ width: 480, height: 480, position: 'relative', marginTop: 8, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* Fixed golden pointer at top — relative to inner wheel, not wrap */}
            <div className="lucky38-img-pointer" style={{ top: 52 }}>
              <svg width="36" height="48" viewBox="0 0 36 48">
                <defs>
                  <linearGradient id="ptrG" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#ffd700" />
                    <stop offset="50%" stopColor="#daa520" />
                    <stop offset="100%" stopColor="#b8860b" />
                  </linearGradient>
                </defs>
                <polygon points="18,48 3,6 10,0 18,4 26,0 33,6" fill="url(#ptrG)" stroke="#8B6914" strokeWidth="1.5" />
                <circle cx="18" cy="14" r="3.5" fill="#ffd700" stroke="#8B6914" strokeWidth="1" />
              </svg>
            </div>

            {/* Wheel image — rotates */}
            <img
              ref={wheelRef}
              src={`${BASE}/images/lucky38/roulette-wheel.png`}
              alt="Lucky 38 Wheel"
              className={`lucky38-wheel-img ${nearMiss ? 'lucky38-near-miss' : ''}`}
              draggable={false}
              style={{
                width: 340, height: 340, objectFit: 'contain', flexShrink: 0,
                transform: `rotate(${wheelAngle}deg)`,
                transition: spinning ? 'transform 8s cubic-bezier(0.15, 0.85, 0.25, 1)' : (nearMiss ? 'transform 0.3s ease-out' : 'none'),
                filter: 'drop-shadow(0 0 12px rgba(200,148,42,0.4))',
              }}
            />

            {/* Label ring outside the wheel — pushed outward */}
            {WHEEL_SLICES.map((s, i) => {
              const angle = i * sliceAngle + sliceAngle / 2 + wheelAngle;
              const rad = (angle - 90) * Math.PI / 180;
              const r = 210;
              const x = Math.cos(rad) * r;
              const y = Math.sin(rad) * r;
              return (
                <div key={`lbl-${s.id}`} className="lucky38-outer-label" style={{
                  position: 'absolute', top: '50%', left: '50%',
                  transform: `translate(${x}px, ${y}px) translate(-50%, -50%)`,
                  opacity: spinning ? 0 : 0.9,
                  transition: 'opacity 0.5s',
                  fontSize: 9, fontWeight: 'bold', color: '#e8c060',
                  textShadow: '0 0 4px rgba(0,0,0,0.9), 0 1px 2px rgba(0,0,0,0.8)',
                  fontFamily: "'Share Tech Mono', monospace",
                  whiteSpace: 'nowrap', pointerEvents: 'none',
                  textAlign: 'center', width: 50,
                }}>
                  <span style={{ color: s.color }}>{s.icon}</span> {s.label}
                </div>
              );
            })}
          </div>

          {/* Jackpot celebration */}
          {showJackpot && (
            <div className="lucky38-jackpot-text">JACKPOT!</div>
          )}

          {/* Particles */}
          {particles.length > 0 && (
            <div className="lucky38-particles">
              {particles.map(p => (
                <div key={p.id} className="lucky38-particle" style={{
                  '--tx': `${p.x}px`, '--ty': `${p.y}px`,
                  background: p.color,
                  width: p.size, height: p.size,
                  animationDelay: `${p.delay}s`,
                }} />
              ))}
            </div>
          )}

          {/* Bust message */}
          {showBust && (
            <div className="lucky38-bust-msg">...better luck next time, wastelander</div>
          )}

          {/* Result display — styled reward card */}
          {winResult && (stage === 'result' || stage === 'respin' || stage === 'claim') && !showJackpot && !showBust && (
            <div className="lucky38-reward-card">
              <div className="lucky38-reward-icon" style={{ color: winResult.color }}>{winResult.icon}</div>
              <div className="lucky38-reward-label" style={{ color: winResult.color }}>{winResult.label}</div>
              <div className="lucky38-reward-desc">{rewardText}</div>
            </div>
          )}

          {/* Action buttons */}
          <div className="lucky38-actions">
            {stage === 'ready' && (
              <button className="lucky38-lever" onClick={doSpin}>
                <span className="lucky38-lever-text">PULL THE LEVER</span>
                <span className="lucky38-lever-sub">Feeling lucky?</span>
              </button>
            )}
            {stage === 'respin' && (
              <div style={{ display: 'flex', gap: 12, flexDirection: 'column', alignItems: 'center' }}>
                <div className="lucky38-respin-label">High Roller: Free re-spin available!</div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button className="lucky38-respin-btn" onClick={doRespin}>RE-SPIN</button>
                  <button className="lucky38-claim-btn" onClick={skipRespin}>KEEP</button>
                </div>
              </div>
            )}
            {stage === 'claim' && (
              <button className="lucky38-claim-btn" onClick={doClaim}>CLAIM</button>
            )}
          </div>
        </div>
      )}

      {/* ─── FLYAWAY ANIMATION ─── */}
      {stage === 'flyaway' && (
        <div className="lucky38-flyaway-wrap">
          <div className={`lucky38-flyaway-icon ${flyaway ? (() => {
            if (!winResult) return 'lucky38-flyaway-generic';
            if (winResult.id === 'caps_small' || winResult.id === 'caps_large' || winResult.id === 'nuka_bust') return 'lucky38-flyaway-caps';
            if (winResult.id === 'unit_common' || winResult.id === 'unit_rare' || winResult.id === 'jackpot') return 'lucky38-flyaway-bench';
            if (winResult.id === 'item_component' || winResult.id === 'full_item') return 'lucky38-flyaway-items';
            if (winResult.id === 'hp_restore') return 'lucky38-flyaway-hp';
            return 'lucky38-flyaway-generic';
          })() : ''}`} style={{ color: winResult?.color || '#ffd700' }}>
            {winResult?.label || 'Reward'}
          </div>
        </div>
      )}

      {/* ─── POST-SPIN SUMMARY ─── */}
      {stage === 'summary' && (
        <div className="lucky38-summary" onClick={doExit}>
          <div className="lucky38-summary-card">
            <div style={{ fontSize: 18, fontWeight: 'bold', color: '#ffd700', marginBottom: 12, letterSpacing: 2 }}>LUCKY 38 RESULTS</div>
            <div className="lucky38-summary-row lucky38-summary-you">
              <span style={{ color: '#44ff44', fontWeight: 'bold' }}>YOU</span>
              <span style={{ color: winResult?.color || '#fff' }}>{winResult?.label || 'Reward'}</span>
            </div>
            {ghostRewards.map((g, i) => (
              <div key={i} className={`lucky38-summary-row ${luckiest === g ? 'lucky38-summary-lucky' : ''}`}>
                <span style={{ opacity: 0.7 }}>{g.name}</span>
                <span>{g.reward}</span>
              </div>
            ))}
            {luckiest && (
              <div style={{ marginTop: 8, fontSize: 10, color: '#ffd700', textAlign: 'center' }}>
                Luckiest: {luckiest.name}
              </div>
            )}
            <div style={{ marginTop: 16, fontSize: 11, opacity: 0.5, textAlign: 'center' }}>Click to continue</div>
          </div>
        </div>
      )}
    </div>
  );
}
