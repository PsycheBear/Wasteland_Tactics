import React, { useState, useEffect, useRef, useCallback } from 'react';
import { UNIT_DATABASE } from '../data/units.js';
import { COMPLETED_ITEMS, ITEM_COMPONENT_KEYS, getRandomComponent } from '../data/items.js';
import { AUGMENT_POOL } from '../data/augments.js';
import { UNIT_KEYS, getRandomCost, makeUid } from '../data/constants.js';
import { BASE } from '../baseUrl.js';

/* ─── Wheel Slice Definitions ─── */
// All 10 possible slices. Stage-scaled pools (see getWheelSlices) tweak the
// WEIGHT per round so early carousels lean components, late carousels lean
// power. The wheel display itself always shows all 10 slices for consistency.
const ALL_SLICES = [
  { id: 'caps_small', label: 'Caps +2', icon: '¢', color: '#b8860b', colorEnd: '#8b6914', rarity: 'common' },
  { id: 'caps_large', label: 'Caps +5', icon: '$', color: '#daa520', colorEnd: '#b8860b', rarity: 'uncommon' },
  { id: 'unit_common', label: 'Free Unit', icon: 'U', color: '#2244aa', colorEnd: '#1a3388', rarity: 'common' },
  { id: 'unit_rare', label: 'Rare Unit', icon: 'R', color: '#6622aa', colorEnd: '#4a1880', rarity: 'uncommon' },
  { id: 'item_component', label: 'Item Part', icon: 'I', color: '#606878', colorEnd: '#484e58', rarity: 'common' },
  { id: 'full_item', label: 'Full Item', icon: 'F', color: '#1a8844', colorEnd: '#126633', rarity: 'rare' },
  { id: 'augment', label: 'Augment', icon: 'A', color: '#8822cc', colorEnd: '#661aa0', rarity: 'uncommon' },
  { id: 'hp_restore', label: 'HP +15', icon: '+', color: '#cc2222', colorEnd: '#991a1a', rarity: 'uncommon' },
  { id: 'jackpot', label: 'JACKPOT', icon: '7', color: '#cc0000', colorEnd: '#880000', rarity: 'legendary' },
  { id: 'nuka_bust', label: 'Nuka-Cola', icon: 'N', color: '#8b2500', colorEnd: '#5a1800', rarity: 'common' },
];

// Stage-scaled weights. Stage 1 (rounds 3-9): components and units, no augment.
// Stage 2 (rounds 12-21): completed items + augments rise. Stage 3 (round 24+):
// jackpot, augments, big caps dominate. Sum doesn't need to be 100 — calculateSpin
// normalises against the totals.
const STAGE_WEIGHTS = {
  1: { caps_small: 16, caps_large: 6,  unit_common: 18, unit_rare: 8,  item_component: 20, full_item: 2,  augment: 0,  hp_restore: 12, jackpot: 2, nuka_bust: 6 },
  2: { caps_small: 8,  caps_large: 12, unit_common: 12, unit_rare: 14, item_component: 10, full_item: 12, augment: 12, hp_restore: 8,  jackpot: 5, nuka_bust: 7 },
  3: { caps_small: 2,  caps_large: 18, unit_common: 4,  unit_rare: 12, item_component: 4,  full_item: 18, augment: 16, hp_restore: 4,  jackpot: 10, nuka_bust: 7 },
};

function stageForRound(round) {
  if (round <= 9) return 1;
  if (round <= 21) return 2;
  return 3;
}

function getWheelSlices(round) {
  const weights = STAGE_WEIGHTS[stageForRound(round)] || STAGE_WEIGHTS[1];
  return ALL_SLICES.map(s => ({ ...s, weight: weights[s.id] ?? 1 }));
}

// Build the 3-card choice that follows the spin: the spin's winner + 2 alternates
// drawn from the same stage pool. Excludes duplicates and demotes nuka_bust if the
// winner wasn't a bust (so the player isn't tempted by a strictly-worse pick).
function buildChoiceOptions(winner, slices) {
  const alternatives = slices.filter(s => s.id !== winner.id && (winner.id === 'nuka_bust' || s.id !== 'nuka_bust'));
  // Weighted random pick without replacement
  const picks = [];
  const pool = [...alternatives];
  for (let i = 0; i < 2 && pool.length > 0; i++) {
    const totalW = pool.reduce((sum, s) => sum + (s.weight || 1), 0);
    let r = Math.random() * totalW;
    let idx = 0;
    for (; idx < pool.length; idx++) { r -= (pool[idx].weight || 1); if (r <= 0) break; }
    picks.push(pool[idx]); pool.splice(idx, 1);
  }
  // Always-include the spun winner first, then alternates. Shuffle for display order.
  return [winner, ...picks].sort(() => Math.random() - 0.5);
}

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
  // Skip the elevator entrance after the first carousel of the run. round=3 is
  // the first visit; later carousel rounds skip straight to the ready state so
  // the player isn't watching the same 4-second sequence every 4 rounds.
  const isFirstCarousel = round <= 3;
  const [stage, setStage] = useState(isFirstCarousel ? 'elevator' : 'ready');
  const [elevatorFloor, setElevatorFloor] = useState(isFirstCarousel ? 1 : 38);
  const [doorsOpen, setDoorsOpen] = useState(!isFirstCarousel);
  const [neonLit, setNeonLit] = useState(isFirstCarousel ? [] : [0,1,2,3,4,5,6,7]);
  // Choice picker state — after the spin lands, the player picks from 3 reward cards.
  const [choiceOptions, setChoiceOptions] = useState(null);
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

  // When skipping elevator (repeat carousels), kick off the casino music
  // immediately so the player lands on the ready state with audio + ambience.
  useEffect(() => {
    if (!isFirstCarousel) {
      try { sound?.startCasinoMusic?.(); } catch(_) {}
    }
  // run-once on mount; isFirstCarousel is derived from round, also static for this carousel instance
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  /* ─── Add jackpot unit — scales by round.
        Round ≤ 9  : 2★ unit at cost ≤ level
        Round 10-21: 2★ unit at cost = level+1 (legacy behaviour)
        Round 22+  : 3★ unit at cost ≤ level (huge endgame swing) ─── */
  const addJackpotUnit = useCallback(() => {
    const tier3 = round >= 22;
    const targetCost = tier3 ? Math.min(level, 5) : Math.min(level + 1, 5);
    const copiesNeeded = tier3 ? 9 : 3;
    const targetStars = tier3 ? 3 : 2;
    const available = UNIT_KEYS.filter(k => UNIT_DATABASE[k].cost >= targetCost && (poolRef?.current?.[k] || 0) >= copiesNeeded);
    const candidates = available.length > 0 ? available : UNIT_KEYS.filter(k => (poolRef?.current?.[k] || 0) >= Math.min(copiesNeeded, 3));
    if (candidates.length === 0) return addRandomUnit(level);
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    if (poolRef?.current) poolRef.current[pick] = Math.max(0, (poolRef.current[pick] || 0) - copiesNeeded);
    const unit = { ...UNIT_DATABASE[pick], id: pick, stars: targetStars, uid: makeUid(), items: [] };
    setBench(prev => {
      const idx = prev.findIndex(s => s === null);
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = unit;
      return next;
    });
    return unit;
  }, [level, poolRef, setBench, addRandomUnit, round]);

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
      case 'nuka_bust': setGold(g => Math.max(0, g - 5)); desc = '−5 Caps... house wins this round'; break;
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

    // Use stage-scaled weights so the same wheel visual yields different odds
    // by round. ALL_SLICES + getWheelSlices have the same length/order so the
    // winnerIndex maps cleanly back to the display slice.
    const stagedSlices = getWheelSlices(round);
    const { winnerIndex, totalAngle } = calculateSpin(stagedSlices);
    const winner = ALL_SLICES[winnerIndex];
    totalAngleRef.current = totalAngle;

    // Near-miss logic: ~20% chance if not jackpot/full_item
    let finalAngle = totalAngle;
    let doNearMiss = false;
    if (winner.id !== 'jackpot' && winner.id !== 'full_item' && Math.random() < 0.2) {
      doNearMiss = true;
      const jackpotIdx = ALL_SLICES.findIndex(s => s.id === 'jackpot');
      const sliceAngle = 360 / ALL_SLICES.length;
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
          const sliceAngle = 360 / ALL_SLICES.length;
          const normalAngle = ((slippedAngle % 360) + 360) % 360;
          const pointerSliceIdx = Math.floor(((360 - normalAngle) % 360 + 360) % 360 / sliceAngle) % ALL_SLICES.length;
          const actualWinner = ALL_SLICES[pointerSliceIdx];
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
      // Normal (non-jackpot, non-bust) spin: open the CHOICE PICKER. Player picks
      // 1 of 3 reward cards (the spun winner + 2 alternates from the same stage pool).
      // This is the TFT-style agency restore that the bold redesign aims for.
      try { sound?.[winner.rarity === 'uncommon' || winner.rarity === 'rare' ? 'winUncommon' : 'winCommon']?.(); } catch(_) {}
      const options = buildChoiceOptions(winner, getWheelSlices(round));
      setChoiceOptions(options);
      setStage('choice');
    }
  }, [applyReward, hasHighRoller, hasUsedRespin, round]);
  finishSpinRef.current = finishSpin;

  /* ─── Pick from the 3-card choice ─── */
  const pickChoice = useCallback((slice) => {
    setChoiceOptions(null);
    setWinResult(slice);
    setStage('result');
    try { sound?.[slice.rarity === 'uncommon' || slice.rarity === 'rare' ? 'winUncommon' : 'winCommon']?.(); } catch(_) {}
    const desc = applyReward(slice);
    setRewardText(desc);
    const track = (fn, ms) => { spinTimersRef.current.push(setTimeout(fn, ms)); };
    track(() => {
      if (hasHighRoller && !hasUsedRespin) {
        setStage('respin');
      } else {
        setStage('claim');
      }
    }, 1500);
  }, [applyReward, hasHighRoller, hasUsedRespin]);

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
      // Generate REAL ghost rewards by running calculateSpin per ghost against
      // the same stage-scaled pool the player faced. No more hardcoded labels.
      const stagedSlices = getWheelSlices(round);
      const ghosts = (ghostPlayersRef?.current || []).slice(0, 5).map((g, i) => {
        const { winnerIndex } = calculateSpin(stagedSlices);
        const ghostWin = ALL_SLICES[winnerIndex];
        return {
          name: g?.name || `Ghost ${i + 1}`,
          reward: ghostWin.label,
          color: ghostWin.color,
          rarity: ghostWin.rarity,
          icon: ghostWin.icon,
        };
      });
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
  const sliceAngle = 360 / ALL_SLICES.length;

  /* ─── Find luckiest ghost — prefer legendary, then rare, then uncommon ─── */
  const RARITY_RANK = { legendary: 4, rare: 3, uncommon: 2, common: 1 };
  const luckiest = ghostRewards.length > 0
    ? ghostRewards.reduce((best, g) => (RARITY_RANK[g.rarity] || 0) > (RARITY_RANK[best.rarity] || 0) ? g : best, ghostRewards[0])
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
      {(stage === 'ready' || stage === 'spinning' || stage === 'choice' || stage === 'result' || stage === 'respin' || stage === 'claim') && (
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
            {ALL_SLICES.map((s, i) => {
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

          {/* CHOICE PICKER — TFT-style 3-card pick after the spin lands.
              Player sees the spun winner + 2 alternates from the same stage pool
              and chooses one. Restores agency without losing the spin theater. */}
          {stage === 'choice' && choiceOptions && (
            <div className="lucky38-choice-panel" style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: 18,
              animation: 'lucky38-choice-in 280ms ease-out',
            }}>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#ffd700', letterSpacing: 3, textShadow: '0 0 12px rgba(255,215,0,0.6)' }}>
                CHOOSE YOUR REWARD
              </div>
              <div style={{ fontSize: 11, color: '#cc9900', opacity: 0.85 }}>
                Pick one. The wheel landed on <span style={{ color: '#ffd700', fontWeight: 'bold' }}>{winResult?.label}</span> — but you call the shot.
              </div>
              <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
                {choiceOptions.map((opt, i) => {
                  const isWinner = winResult && opt.id === winResult.id;
                  return (
                    <button
                      key={`${opt.id}_${i}`}
                      onClick={() => pickChoice(opt)}
                      className="lucky38-choice-card"
                      style={{
                        width: 140, padding: '14px 10px',
                        background: `linear-gradient(180deg, ${opt.color}88 0%, ${opt.colorEnd || opt.color}aa 100%)`,
                        border: `2px solid ${opt.color}`,
                        borderRadius: 8, cursor: 'pointer',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                        color: '#fff', fontFamily: "'Share Tech Mono', monospace",
                        boxShadow: `0 0 14px ${opt.color}66, inset 0 1px 0 rgba(255,255,255,0.08)`,
                        transition: 'transform 0.15s, box-shadow 0.15s, background 0.15s',
                        position: 'relative',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px) scale(1.04)'; e.currentTarget.style.boxShadow = `0 0 24px ${opt.color}, inset 0 1px 0 rgba(255,255,255,0.12)`; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = `0 0 14px ${opt.color}66, inset 0 1px 0 rgba(255,255,255,0.08)`; }}
                    >
                      {isWinner && (
                        <span style={{
                          position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                          fontSize: 8, fontWeight: 'bold', letterSpacing: 1.2,
                          background: '#ffd700', color: '#0a0a0a',
                          padding: '2px 7px', borderRadius: 3, textTransform: 'uppercase',
                          boxShadow: '0 0 6px rgba(255,215,0,0.8)',
                        }}>SPIN PICK</span>
                      )}
                      <div style={{ fontSize: 32, lineHeight: 1, fontWeight: 'bold', textShadow: '0 0 8px rgba(0,0,0,0.8)' }}>{opt.icon}</div>
                      <div style={{ fontSize: 13, fontWeight: 'bold', textAlign: 'center' }}>{opt.label}</div>
                      <div style={{ fontSize: 8, opacity: 0.75, textTransform: 'uppercase', letterSpacing: 1 }}>{opt.rarity}</div>
                    </button>
                  );
                })}
              </div>
            </div>
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
