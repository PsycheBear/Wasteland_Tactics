import React, { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from 'react';
import { UNIT_DATABASE, MELEE_UNITS, isMeleeUnit } from '../data/units.js';
import { TRAITS } from '../data/traits.js';
import { ITEM_COMPONENTS, COMPLETED_ITEMS, ITEM_COMPONENT_KEYS, findCompletedItem, getRandomComponent } from '../data/items.js';
import { AUGMENT_POOL } from '../data/augments.js';
import { BOSS_DATABASE } from '../data/bosses.js';
import { isPveRound, getPveWave } from '../data/pveWaves.js';
import { IMAGES } from '../data/images.js';
import { COST_COLORS, TIER_LABELS, SHOP_ODDS, getRandomCost, POOL_SIZES, UNIT_KEYS, XP_TO_LEVEL, CAROUSEL_ROUNDS, ROUNDS_PER_STAGE, isCarouselRound, initPool, makeUid } from '../data/constants.js';
import { sound, WT_SETTINGS } from '../systems/audio.js';
import { getActiveSynergies, generateEnemies, initGhostPlayers, ghostPlayerShop, ghostPlayerBoard, runCombat, spawnFloat } from '../systems/combat.js';
import { CombatBars, UnitPlaceholder, UnitTooltip, UnitCard } from './UiComponents.jsx';
import { GameIcon, createGameIcon } from './GameIcon.jsx';
import Lucky38Carousel from './Lucky38Carousel.jsx';
import LoadingScreen from './LoadingScreen.jsx';
import DevTools from './DevTools.jsx';
import AugmentPicker from './AugmentPicker.jsx';
import BossIntro from './BossIntro.jsx';
import ProfilePanel from './ProfilePanel.jsx';
import DifficultySelector, { loadStoredDifficulty } from './DifficultySelector.jsx';
import { BASE } from '../baseUrl.js';
import { saveReplay } from '../hooks/useSave.js';
import { logError } from '../lib/logger.js';

/* ─── Combat log emoji → colored badge parser ─── */
const LOG_EMOJI_MAP = {
  '\u2B50': { label: 'UP', color: '#ffd700' },        // ⭐ upgrade
  '\uD83D\uDEE1\uFE0F': { label: 'DEF', color: '#6688ff' }, // 🛡️
  '\u2699\uFE0F': { label: 'TECH', color: '#708090' }, // ⚙️
  '\uD83D\uDC8A': { label: 'MED', color: '#ff6666' },  // 💊
  '\uD83D\uDC15': { label: 'DOG', color: '#cc8844' },  // 🐕
  '\uD83D\uDD0D': { label: 'DET', color: '#aaaaff' },  // 🔍
  '\uD83E\uDDE0': { label: 'PSI', color: '#cc66ff' },  // 🧠
  '\uD83D\uDD25': { label: 'FIRE', color: '#ff6600' },  // 🔥
  '\uD83D\uDCAA': { label: 'STR', color: '#ff6644' },  // 💪
  '\u26A1': { label: 'ZAP', color: '#ffff44' },         // ⚡
  '\uD83E\uDD8E': { label: 'CLAW', color: '#66cc66' },  // 🦎
  '\uD83E\uDDEA': { label: 'LAB', color: '#44ff88' },   // 🧪
  '\uD83D\uDCF0': { label: 'NEWS', color: '#ffcc44' },  // 📰
  '\u2622\uFE0F': { label: 'RAD', color: '#44ff44' },   // ☢️
  '\uD83C\uDFAF': { label: 'AIM', color: '#ffaa00' },   // 🎯
  '\uD83D\uDE24': { label: 'RAGE', color: '#ff4444' },  // 😤
  '\uD83D\uDC89': { label: 'HEAL', color: '#ff4444' },  // 💉
  '\uD83D\uDD75\uFE0F': { label: 'SPY', color: '#aa88cc' }, // 🕵️
  '\u2623\uFE0F': { label: 'BIO', color: '#669933' },   // ☣️
  '\uD83E\uDD16': { label: 'BOT', color: '#aaaaaa' },   // 🤖
  '\uD83D\uDC80': { label: 'KILL', color: '#ff4444' },  // 💀
  '\uD83D\uDC9A': { label: 'HEAL', color: '#2E8B57' },  // 💚
  '\uD83D\uDDFD': { label: 'USA', color: '#4488ff' },   // 🗽
  '\uD83E\uDD82': { label: 'BOSS', color: '#ff4444' },  // 🦂
  '\uD83E\uDD80': { label: 'BOSS', color: '#44aaff' },  // 🦀
  '\uD83D\uDC79': { label: 'BOSS', color: '#ffaa44' },  // 👹
  '\uD83D\uDC09': { label: 'BOSS', color: '#ff44ff' },  // 🐉
  '\uD83D\uDCA8': { label: 'JET', color: '#aaccff' },   // 💨
  '\uD83D\uDCA3': { label: 'BOOM', color: '#ffaa44' },  // 💣
  '\uD83C\uDF00': { label: 'VOID', color: '#cc66ff' },  // 🌀
  '\uD83E\uDE7A': { label: 'MED', color: '#66ffaa' },   // 🩺
  '\uD83D\uDD2D': { label: 'SCOPE', color: '#44ccff' }, // 🔭
  '\uD83D\uDD26': { label: 'LASER', color: '#ff4444' }, // 🔦
  '\uD83D\uDCA5': { label: 'CRIT', color: '#ff8844' },  // 💥
  '\uD83D\uDD2B': { label: 'GUN', color: '#aaaaaa' },   // 🔫
  '\uD83D\uDDE1\uFE0F': { label: 'BLADE', color: '#ff8844' }, // 🗡️
  '\u2694\uFE0F': { label: 'BLADE', color: '#ffaa00' }, // ⚔️
  '\uD83E\uDDF5': { label: 'WEAVE', color: '#cccccc' }, // 🧵
  '\uD83D\uDD27': { label: 'FIX', color: '#aaaaaa' },   // 🔧
  '\uD83D\uDC7B': { label: 'DODGE', color: '#aa66ff' }, // 👻
  '\uD83D\uDCAB': { label: 'HEAL', color: '#cc88ff' },  // 💫
  '\uD83C\uDFE5': { label: 'MED', color: '#44ff88' },   // 🏥
  '\uD83C\uDF89': { label: 'WIN', color: '#ffd700' },    // 🎉
  '\uD83E\uDDB4': { label: 'DOG', color: '#cc8844' },   // 🦴
  '\uD83C\uDF81': { label: 'ITEM', color: '#ffaa00' },   // 🎁
  '\uD83D\uDD29': { label: 'ITEM', color: '#aaaaaa' },   // 🔩
  '\uD83D\uDCB0': { label: 'CAPS', color: '#ffd700' },   // 💰
  '\u26A0\uFE0F': { label: 'WARN', color: '#ffaa00' },   // ⚠️
  '\uD83D\uDCBE': { label: 'SAVE', color: '#44aaff' },   // 💾
};

/* Terminal-style log prefixes based on emoji category */
const TERMINAL_PREFIX = {
  KILL: { prefix: '[KILL]', color: '#ff4444' },
  HEAL: { prefix: '[HEAL]', color: '#44cc88' },
  CRIT: { prefix: '[CRIT]', color: '#ffaa00' },
  ZAP:  { prefix: '[ZAP]',  color: '#cc8800' },
  FIRE: { prefix: '[FIRE]', color: '#ff6600' },
  BOSS: { prefix: '[BOSS]', color: '#ff4444' },
  WIN:  { prefix: '[SYS]',  color: '#c8942a' },
  SAVE: { prefix: '[SYS]',  color: '#c8942a' },
  WARN: { prefix: '[SYS]',  color: '#c8942a' },
  ITEM: { prefix: '[ITEM]', color: '#ffaa00' },
  CAPS: { prefix: '[CAPS]', color: '#ffd700' },
  UP:   { prefix: '[UP]',   color: '#ffd700' },
  DEF:  { prefix: '[DEF]',  color: '#6688ff' },
  TECH: { prefix: '[TECH]', color: '#708090' },
  MED:  { prefix: '[MED]',  color: '#44cc88' },
  DOG:  { prefix: '[ATK]',  color: '#cc8844' },
  DET:  { prefix: '[DET]',  color: '#aaaaff' },
  PSI:  { prefix: '[PSI]',  color: '#cc66ff' },
  STR:  { prefix: '[STR]',  color: '#ff6644' },
  CLAW: { prefix: '[ATK]',  color: '#66cc66' },
  NEWS: { prefix: '[DBF]',  color: '#ffcc44' },
  AIM:  { prefix: '[AIM]',  color: '#ffaa00' },
  RAGE: { prefix: '[DBF]',  color: '#ff4444' },
  SPY:  { prefix: '[SPY]',  color: '#aa88cc' },
  BIO:  { prefix: '[RAD]',  color: '#669933' },
  BOT:  { prefix: '[BOT]',  color: '#aaaaaa' },
  USA:  { prefix: '[USA]',  color: '#4488ff' },
  JET:  { prefix: '[JET]',  color: '#aaccff' },
  BOOM: { prefix: '[BOOM]', color: '#ffaa44' },
  VOID: { prefix: '[VOID]', color: '#cc66ff' },
  SCOPE:{ prefix: '[AIM]',  color: '#44ccff' },
  LASER:{ prefix: '[FIRE]', color: '#ff4444' },
  GUN:  { prefix: '[GUN]',  color: '#aaaaaa' },
  BLADE:{ prefix: '[ATK]',  color: '#ff8844' },
  WEAVE:{ prefix: '[DEF]',  color: '#cccccc' },
  FIX:  { prefix: '[FIX]',  color: '#aaaaaa' },
  DODGE:{ prefix: '[MISS]', color: '#aa66ff' },
};
// Map existing label → terminal prefix
const LABEL_TO_TERMINAL = {};
for (const [, v] of Object.entries(LOG_EMOJI_MAP)) {
  LABEL_TO_TERMINAL[v.label] = TERMINAL_PREFIX[v.label] || { prefix: '>', color: '#33ff33' };
}

let logActionCounter = 0;
function formatLogEntry(text, roundNum) {
  if (!text || typeof text !== 'string') return text;
  logActionCounter++;
  const ts = `[R${roundNum || '?'}-${String(logActionCounter % 100).padStart(2, '0')}]`;

  for (const [emoji, style] of Object.entries(LOG_EMOJI_MAP)) {
    if (text.startsWith(emoji)) {
      const rest = text.slice(emoji.length).trimStart();
      const tp = LABEL_TO_TERMINAL[style.label] || { prefix: '>', color: 'var(--ui-primary)' };
      return React.createElement('span', { style: { fontFamily: "'Share Tech Mono', monospace" } },
        React.createElement('span', { style: { color: 'var(--ui-text-dim)', fontSize: 8, marginRight: 4, opacity: 0.5 } }, ts),
        React.createElement('span', { style: { color: tp.color, fontWeight: 'bold', marginRight: 4, fontSize: 9 } }, tp.prefix),
        React.createElement('span', { style: { color: 'var(--ui-text)' } }, rest)
      );
    }
  }
  return React.createElement('span', { style: { fontFamily: "'Share Tech Mono', monospace" } },
    React.createElement('span', { style: { color: 'var(--ui-text-dim)', fontSize: 8, marginRight: 4, opacity: 0.5 } }, ts),
    React.createElement('span', { style: { color: 'var(--ui-secondary)', marginRight: 4 } }, '>'),
    React.createElement('span', { style: { color: 'var(--ui-text)' } }, text)
  );
}

function WastelandTactics() {
  const [playTransition, setPlayTransition] = useState(false);
  const pendingLoadRef = useRef(false);
  const [phase, setPhase] = useState('menu');
  const [menuTab, setMenuTab] = useState('main');
  const [shopTab, setShopTab] = useState('featured');
  const [armoryTab, setArmoryTab] = useState('themes');
  const [shopConfirm, setShopConfirm] = useState(null);
  const [currencyPopup, setCurrencyPopup] = useState(false);
  const [purchaseAnim, setPurchaseAnim] = useState(null);
  const [tabKey, setTabKey] = useState(0);
  const [playerCaps, setPlayerCaps] = useState(() => +(localStorage.getItem('wt_caps') || 0));
  const [playerStats, setPlayerStats] = useState(() => { try { return JSON.parse(localStorage.getItem('wt_player_stats') || '{}'); } catch { return {}; } });
  const getRank = (bestRound) => {
    if (!bestRound || bestRound < 5) return { name: 'Wastelander', color: '#888888', tier: 1, icon: '\u2606' };
    if (bestRound < 10) return { name: 'Scavenger', color: '#cccccc', tier: 2, icon: '\u2605' };
    if (bestRound < 15) return { name: 'Vault Dweller', color: '#1eff00', tier: 3, icon: '\u2605\u2605' };
    if (bestRound < 20) return { name: 'Knight', color: '#4488ff', tier: 4, icon: '\u2605\u2605\u2605' };
    if (bestRound < 25) return { name: 'Paladin', color: '#cc44ff', tier: 5, icon: '\u2605\u2605\u2605\u2605' };
    return { name: 'Elder', color: '#ffd700', tier: 6, icon: '\u2605\u2605\u2605\u2605\u2605' };
  };
  const rank = getRank(playerStats.bestRound);
  const [playerCrystals, setPlayerCrystals] = useState(() => +(localStorage.getItem('wt_crystals') || 0));
  const [ownedItems, setOwnedItems] = useState(() => { try { return JSON.parse(localStorage.getItem('wt_owned') || '[]'); } catch { return []; } });
  const buyShopItem = (item) => {
    if (ownedItems.includes(item.id)) return;
    if (item.currency === 'crystals' && playerCrystals < item.price) return;
    if (item.currency === 'caps' && playerCaps < item.price) return;
    setShopConfirm(item);
  };
  const spawnPurchaseConfetti = () => {
    setPurchaseAnim({ x: window.innerWidth / 2, y: window.innerHeight / 2, time: Date.now() });
    setTimeout(() => setPurchaseAnim(null), 1200);
  };
  const confirmPurchase = () => {
    if (!shopConfirm) return;
    const item = shopConfirm;
    if (item.currency === 'crystals') setPlayerCrystals(c => { const v = c - item.price; localStorage.setItem('wt_crystals', v); return v; });
    else setPlayerCaps(c => { const v = c - item.price; localStorage.setItem('wt_caps', v); return v; });
    setOwnedItems(prev => { const n = [...prev, item.id]; localStorage.setItem('wt_owned', JSON.stringify(n)); return n; });
    sound.purchaseCurrency();
    spawnPurchaseConfetti();
    setShopConfirm(null);
  };
  const [transitioning, setTransitioning] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const [vpSize, setVpSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => { const onResize = () => setVpSize({ w: window.innerWidth, h: window.innerHeight }); window.addEventListener('resize', onResize); return () => window.removeEventListener('resize', onResize); }, []);
  const [menuFirstLoad, setMenuFirstLoad] = useState(true);
  // Wave 3: difficulty selection persists across reloads. Defaults to 'normal'.
  const [difficultyId, setDifficultyId] = useState(() => loadStoredDifficulty('normal'));
  const startGame = (loadSave) => {
    try { sound.vaultDoor?.(); } catch(_) {}
    pendingLoadRef.current = loadSave;
    setPlayTransition(true);
    setShowContinuePrompt(false);
  };
  const onPlayTransitionComplete = () => {
    if (pendingLoadRef.current) loadGame();
    else setShop(prev => generateShop(prev));
    setPlayTransition(false);
    setPhase('prep');
  };
  const [round, setRound] = useState(1);
  const [gold, setGold] = useState(10);
  const [hp, setHpRaw] = useState(100);
  const hpRef = useRef(100);
  const setHp = (val) => { const v = typeof val === 'function' ? val(hpRef.current) : val; hpRef.current = v; setHpRaw(v); };
  const [level, setLevel] = useState(3);
  const [xp, setXp] = useState(0);
  const [xpNeeded, setXpNeeded] = useState(4);
  const [streak, setStreak] = useState(0);
  const [timer, setTimer] = useState(30);
  const [bench, setBench] = useState(Array(9).fill(null));
  const [board, setBoard] = useState(Array(14).fill(null));
  const [shop, setShop] = useState([]);
  const [selected, setSelected] = useState(null);
  const [log, setLog] = useState([]);
  const [combatUnits, setCombatUnits] = useState([]);
  const [combatEnemies, setCombatEnemies] = useState([]);
  const [animations, setAnimations] = useState({ attacking: [], hit: [], dying: [], ability: [] });
  const [bonusGold, setBonusGold] = useState(0); // For Dogmeat's Fetch ability
  const [itemInventory, setItemInventory] = useState([]); // Array of component key strings
  const [itemSelection, setItemSelection] = useState(null); // { items: [key, key, key] } for post-PvE pick
  const itemSelectionRef = useRef(null);
  useEffect(() => { itemSelectionRef.current = itemSelection; }, [itemSelection]);
  const [selectedItem, setSelectedItem] = useState(null); // Component key being placed on a unit
  const [augments, setAugments] = useState([]); // Array of augment IDs
  const [augmentChoice, setAugmentChoice] = useState(null); // { options: [aug, aug, aug] }
  const augmentChoiceRef = useRef(null);
  useEffect(() => { augmentChoiceRef.current = augmentChoice; }, [augmentChoice]);
  const [carouselActive, setCarouselActive] = useState(false);
  const [showTutorial, setShowTutorial] = useState(() => !localStorage.getItem('wt_tutorial_seen'));
  const [tutorialStep, setTutorialStep] = useState(0);
  const [hasSave, setHasSave] = useState(() => !!localStorage.getItem('wt_save'));
  const [showContinuePrompt, setShowContinuePrompt] = useState(false);
  const [combatTick, setCombatTick] = useState(0);
  const [incomeBreakdown, setIncomeBreakdown] = useState(null);
  const [showIncome, setShowIncome] = useState(false);
  const [shopFlipping, setShopFlipping] = useState(false);
  const [matchHistory, setMatchHistory] = useState([]);
  const [damageStats, setDamageStats] = useState({});
  const [unitTooltip, setUnitTooltip] = useState(null); // { unit, x, y } — right-click only
  const [draggedFrom, setDraggedFrom] = useState(null); // { location, index }
  const [dragOverTarget, setDragOverTarget] = useState(null); // { location, index }
  const [dragOverSell, setDragOverSell] = useState(false);
  const [pointerDrag, setPointerDrag] = useState(null); // { location, index, unit, startX, startY }
  const [itemDrag, setItemDrag] = useState(null); // { itemKey, invIndex, startX, startY }
  const itemDragPreviewRef = useRef(null);
  const itemDragMovedRef = useRef(false);
  const dragPreviewRef = useRef(null);
  const [floatingNumbers, setFloatingNumbers] = useState([]);
  const [noBoardFlash, setNoBoardFlash] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Wave 2: ProfilePanel modal (lifetime stats + build codec + replay viewer).
  // Toggle via Ctrl+Shift+P (a small hotkey added below). The panel can also be
  // opened by other UIs in the future by calling setProfileOpen(true).
  const [profileOpen, setProfileOpen] = useState(false);
  const [devToolsActivate, setDevToolsActivate] = useState(false);
  const [bossIntro, setBossIntro] = useState(null);
  const [cheatSheetOpen, setCheatSheetOpen] = useState(false);
  const [terminalTab, setTerminalTab] = useState('items');
  const [terminalSearch, setTerminalSearch] = useState('');
  const [encyclopediaUnit, setEncyclopediaUnit] = useState(null);
  const [schematicPick, setSchematicPick] = useState([]);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => {
    if (!cheatSheetOpen) return;
    const handler = (e) => {
      const tabMap = { '1': 'items', '2': 'pool', '3': 'odds', '4': 'synergies', '5': 'scout', '6': 'history', '7': 'damage', '8': 'leaderboard', '9': 'encyclopedia', '0': 'economy' };
      if (tabMap[e.key]) { setTerminalTab(tabMap[e.key]); setTerminalSearch(''); sound.terminalTab(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cheatSheetOpen]);

  // Wave 2: ProfilePanel hotkey — Ctrl+Shift+P (uppercase + lowercase to be safe)
  // toggles the panel. Wrapped in its own effect so it has no other dependencies.
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'P' || e.key === 'p')) {
        e.preventDefault();
        setProfileOpen(o => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  // incomeBreakdown persists until next round — shown in bottom bar
  const [settings, setSettings] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem('wt_settings') || '{}');
      return {
        volume: Math.min(100, Math.max(0, s.volume ?? 80)),
        musicVolume: Math.min(100, Math.max(0, s.musicVolume ?? 80)),
        animationSpeed: [0.5, 1, 1.5, 2, 3].includes(s.animationSpeed) ? s.animationSpeed : 1,
        scanlines: s.scanlines !== false,
        phosphor: s.phosphor !== false,
        crtMode: s.crtMode === true,
      };
    } catch (_) { return { volume: 80, musicVolume: 80, animationSpeed: 1, scanlines: true, phosphor: true, crtMode: false }; }
  });
  const draggingRef = useRef(false);
  const hasMovedRef = useRef(false);
  const justDraggedRef = useRef(false);
  const moveUnitRef = useRef(() => {});
  const sellUnitRef = useRef(() => {});

  // Pointer-based smooth drag – find drop target under point
  const getDropTarget = (clientX, clientY) => {
    const el = document.elementFromPoint(clientX, clientY);
    if (!el) return null;
    const slot = el.closest('[data-slot-location]');
    if (slot) {
      const loc = slot.getAttribute('data-slot-location');
      const idx = parseInt(slot.getAttribute('data-slot-index'), 10);
      if (loc && !isNaN(idx)) return { location: loc, index: idx };
    }
    if (el.closest('[data-sell-zone]')) return { sell: true };
    return null;
  };

  useEffect(() => {
    if (!pointerDrag) return;

    const onMove = (e) => {
      e.preventDefault();
      const dx = e.clientX - pointerDrag.startX, dy = e.clientY - pointerDrag.startY;
      if (!hasMovedRef.current && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
        hasMovedRef.current = true;
        draggingRef.current = true;
        setDraggedFrom({ location: pointerDrag.location, index: pointerDrag.index });
        setUnitTooltip(null);
      }
      if (hasMovedRef.current) {
        const el = dragPreviewRef.current;
        if (el) el.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;
        const target = getDropTarget(e.clientX, e.clientY);
        setDragOverSell(!!target?.sell);
        setDragOverTarget(target?.sell ? null : target);
      }
    };
    const cleanup = () => {
      draggingRef.current = false;
      setPointerDrag(null);
      setDraggedFrom(null);
      setDragOverTarget(null);
      setDragOverSell(false);
      hasMovedRef.current = false;
      document.removeEventListener('pointermove', onMove, { capture: true, passive: false });
      document.removeEventListener('pointerup', onUp, { capture: true });
      document.removeEventListener('pointercancel', onCancel, { capture: true });
    };
    const onUp = (e) => {
      if (hasMovedRef.current) {
        justDraggedRef.current = true;
        const target = getDropTarget(e.clientX, e.clientY);
        if (target) {
          if (target.sell) sellUnitRef.current(pointerDrag.location, pointerDrag.index);
          else if (target.location !== pointerDrag.location || target.index !== pointerDrag.index) {
            moveUnitRef.current(pointerDrag.location, pointerDrag.index, target.location, target.index);
          }
        }
      }
      cleanup();
    };
    const onCancel = () => {
      cleanup();
    };
    document.addEventListener('pointermove', onMove, { capture: true, passive: false });
    document.addEventListener('pointerup', onUp, { capture: true });
    document.addEventListener('pointercancel', onCancel, { capture: true });
    return () => cleanup();
  }, [pointerDrag]);

  useLayoutEffect(() => {
    if (!pointerDrag) return;
    const el = dragPreviewRef.current;
    if (el) el.style.transform = `translate(${pointerDrag.startX}px, ${pointerDrag.startY}px) translate(-50%, -50%)`;
  }, [pointerDrag]);

  // Item drag-and-drop system
  const equipItemRef = useRef(() => {});

  useEffect(() => {
    if (!itemDrag) return;
    const onMove = (e) => {
      e.preventDefault();
      const dx = e.clientX - itemDrag.startX, dy = e.clientY - itemDrag.startY;
      if (!itemDragMovedRef.current && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
        itemDragMovedRef.current = true;
      }
      if (itemDragMovedRef.current) {
        const el = itemDragPreviewRef.current;
        if (el) el.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;
        const target = getDropTarget(e.clientX, e.clientY);
        setDragOverTarget(target?.sell ? null : target);
      }
    };
    const cleanup = () => {
      setItemDrag(null);
      setDragOverTarget(null);
      itemDragMovedRef.current = false;
      document.removeEventListener('pointermove', onMove, { capture: true, passive: false });
      document.removeEventListener('pointerup', onUp, { capture: true });
      document.removeEventListener('pointercancel', onCancel, { capture: true });
    };
    const onUp = (e) => {
      if (itemDragMovedRef.current) {
        const target = getDropTarget(e.clientX, e.clientY);
        if (target && target.location) {
          equipItemRef.current(itemDrag.itemKey, target.location, target.index);
        }
      }
      cleanup();
    };
    const onCancel = () => cleanup();
    document.addEventListener('pointermove', onMove, { capture: true, passive: false });
    document.addEventListener('pointerup', onUp, { capture: true });
    document.addEventListener('pointercancel', onCancel, { capture: true });
    return () => cleanup();
  }, [itemDrag]);

  useLayoutEffect(() => {
    if (!itemDrag) return;
    const el = itemDragPreviewRef.current;
    if (el) el.style.transform = `translate(${itemDrag.startX}px, ${itemDrag.startY}px) translate(-50%, -50%)`;
  }, [itemDrag]);

  useEffect(() => {
    WT_SETTINGS.volume = settings.volume / 100;
    WT_SETTINGS.musicVolume = (settings.musicVolume ?? 80) / 100;
    WT_SETTINGS.sfxVolume = (settings.sfxVolume ?? 100) / 100;
    WT_SETTINGS.uiSoundVolume = (settings.uiSoundVolume ?? 80) / 100;
    WT_SETTINGS.ambientVolume = (settings.ambientVolume ?? 60) / 100;
    WT_SETTINGS.animationSpeed = settings.animationSpeed;
    WT_SETTINGS.scanlines = settings.scanlines;
    WT_SETTINGS.phosphor = settings.phosphor;
    WT_SETTINGS.crtMode = settings.crtMode;
    sound.updateVolume?.();
    try { localStorage.setItem('wt_settings', JSON.stringify(settings)); } catch (_) {}
  }, [settings]);
  const combatRef = useRef(null);
  const startCombatRef = useRef(() => {});
  const poolRef = useRef(initPool());
  const ghostPlayersRef = useRef(initGhostPlayers(poolRef.current));
  const [currentOpponent, setCurrentOpponent] = useState(null);
  const [scoutIndex, setScoutIndex] = useState(0);
  const xpMetaRef = useRef({ xpNeeded: 4, level: 3 });
  useEffect(() => { xpMetaRef.current = { xpNeeded, level }; });

  const levelRef = useRef(level);
  useEffect(() => { levelRef.current = level; }, [level]);
  const generateShop = useCallback((prevShop) => {
    // Return previous shop units to pool before rolling
    if (prevShop) {
      prevShop.forEach(u => { if (u) poolRef.current[u.id] = (poolRef.current[u.id] || 0) + 1; });
    }
    const currentLevel = levelRef.current;
    return Array(5).fill(null).map(() => {
      const cost = getRandomCost(currentLevel);
      const avail = UNIT_KEYS.filter(k => UNIT_DATABASE[k].cost === cost && poolRef.current[k] > 0);
      const candidates = avail.length > 0 ? avail : UNIT_KEYS.filter(k => poolRef.current[k] > 0);
      if (candidates.length === 0) return null;
      const unitKey = candidates[Math.floor(Math.random() * candidates.length)];
      poolRef.current[unitKey]--;
      const unit = UNIT_DATABASE[unitKey];
      return { ...unit, id: unitKey, stars: 1, uid: makeUid(), items: [] };
    });
  }, []); // No level dependency — reads levelRef.current to avoid free shop refresh on level-up

  useEffect(() => () => { if (combatRef.current) clearInterval(combatRef.current); }, []);

  // Menu music (separate from game music) — Pip-Boy theme uses Fallout 4 main theme
  const menuMusicRef = useRef(null);
  const menuMusicThemeRef = useRef(null);
  const menuMusicStartedRef = useRef(false);
  useEffect(() => {
    let interactCleanup = () => {};
    if (phase === 'menu') {
      const isPipBoy = (settings.uiTheme || 'tactical') === 'default';
      const wantedSrc = isPipBoy ? `${BASE}/audio/music/fo4-main-theme.mp3` : `${BASE}/audio/menu-music.mp3`;
      // Switch track if theme changed
      if (menuMusicThemeRef.current !== wantedSrc) {
        if (menuMusicRef.current) { menuMusicRef.current.pause(); menuMusicRef.current = null; }
        menuMusicThemeRef.current = wantedSrc;
        menuMusicStartedRef.current = false;
      }
      if (!menuMusicRef.current) {
        menuMusicRef.current = new Audio(wantedSrc);
        menuMusicRef.current.loop = true;
      }
      menuMusicRef.current.volume = 0.3 * (settings.volume / 100) * ((settings.musicVolume ?? 80) / 100);
      const tryPlay = () => {
        if (!menuMusicRef.current || menuMusicStartedRef.current) return;
        menuMusicRef.current.play().then(() => { menuMusicStartedRef.current = true; }).catch(() => {});
      };
      tryPlay();
      // Retry on first user interaction (browser autoplay policy blocks play() before gesture)
      if (!menuMusicStartedRef.current) {
        const onInteract = () => { tryPlay(); interactCleanup(); };
        interactCleanup = () => { document.removeEventListener('click', onInteract); document.removeEventListener('keydown', onInteract); };
        document.addEventListener('click', onInteract);
        document.addEventListener('keydown', onInteract);
      }
      sound.stopPrepMusic();
      sound.stopBattleMusic();
    } else {
      if (menuMusicRef.current) { menuMusicRef.current.pause(); menuMusicRef.current.currentTime = 0; }
      menuMusicStartedRef.current = false;
      if (phase === 'prep') {
        sound.startPrepMusic(); sound.stopBattleMusic(); try { sound.stopCasinoMusic?.(); } catch(_) {} try { sound.stopBossMusic?.(); } catch(_) {} try { sound.prepStart?.(); } catch(_) {}
        setUnitTooltip(null); // Dismiss stale combat tooltips
        // Income breakdown tick-up overlay
        if (incomeBreakdown) { setShowIncome(true); setTimeout(() => setShowIncome(false), 3000); }
        // Winning unit celebration — only apply to player units (not enemies)
        if (streak > 0) {
          document.querySelectorAll('.wt-board-cell [data-unit-uid], .wt-bench-slot [data-unit-uid]').forEach(el => {
            el.classList.add('wt-celebrate');
            setTimeout(() => el.classList.remove('wt-celebrate'), 1000);
          });
        }
      }
      else if (phase === 'combat') { sound.stopPrepMusic(); sound.startBattleMusic(); try { sound.combatStart?.(); } catch(_) {} }
      else if (phase === 'carousel') { sound.stopPrepMusic(); sound.stopBattleMusic(); try { sound.stopBossMusic?.(); } catch(_) {} }
      else { sound.stopPrepMusic(); sound.stopBattleMusic(); try { sound.stopBossMusic?.(); } catch(_) {} }
    }
    return () => { if (menuMusicRef.current) { menuMusicRef.current.pause(); } sound.stopPrepMusic(); sound.stopBattleMusic(); interactCleanup(); };
  }, [phase, settings.uiTheme, settings.volume, settings.musicVolume]);

  useEffect(() => {
    if (phase !== 'prep') return;
    const interval = setInterval(() => {
      if (pausedRef.current || itemSelectionRef.current || augmentChoiceRef.current) return;
      setTimer(t => {
        if (t <= 1) { startCombatRef.current(); return settings.prepTimer || 30; }
        const next = t - 1;
        if (next <= 10 && next > 5) { try { sound.timerTick?.(); } catch(_) {} }
        if (next <= 5) { try { sound.timerUrgent?.(); } catch(_) {} }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, settings.prepTimer]);

  const buyUnit = (index) => {
    const unit = shop[index];
    if (!unit || gold < unit.cost) { try { sound.deny?.(); } catch(_) {} return; }
    const emptySlot = bench.findIndex(slot => slot === null);

    // Check if buying would trigger an upgrade even with full bench
    if (emptySlot === -1) {
      // Count existing copies on bench + board
      const allUnits = [...bench, ...board];
      const sameAt1 = allUnits.filter(u => u && u.id === unit.id && u.stars === 1).length;
      const sameAt2 = allUnits.filter(u => u && u.id === unit.id && u.stars === 2).length;
      // Allow buy if this unit would be the 3rd copy for a star upgrade
      const wouldUpgrade1 = sameAt1 >= 2; // buying 3rd 1-star
      const wouldUpgrade2 = sameAt2 >= 2 && sameAt1 >= 2; // chain to 3-star
      if (!wouldUpgrade1 && !wouldUpgrade2) { try { sound.invalidAction?.(); } catch(_) {} return; } // truly full, no upgrade possible
    }

    if (phase === 'combat') {
      // During combat, add to bench and check for bench-only upgrades
      let newBench = [...bench];

      if (emptySlot !== -1) {
        newBench[emptySlot] = { ...unit };
      } else {
        // Full bench during combat — remove 2 copies, place upgraded
        let removed = 0;
        newBench = newBench.map(u => {
          if (removed < 2 && u && u.id === unit.id && u.stars === 1) { removed++; return null; }
          return u;
        });
        const freeSlot = newBench.findIndex(slot => slot === null);
        if (freeSlot === -1) return;
        newBench[freeSlot] = { ...unit, stars: 2, uid: makeUid() };
        setLog(prev => [`⭐ ${unit.name} upgraded to 2 stars!`, ...prev.slice(0, 9)]);
        sound.upgrade();
        setTimeout(() => { const evolveEl = document.querySelector(`[data-unit-uid="${newBench[freeSlot]?.uid}"]`); if (evolveEl) { evolveEl.classList.add('wt-evolve-flash'); setTimeout(() => evolveEl.classList.remove('wt-evolve-flash'), 800); } }, 50);
        setBench(newBench);
        setGold(g => g - unit.cost);
        const newShop = [...shop]; newShop[index] = null; setShop(newShop);
        return;
      }

      // Check for upgrades on bench only (don't touch board during combat)
      let didUpgrade = true;
      while (didUpgrade) {
        didUpgrade = false;
        for (let starLevel = 1; starLevel <= 2; starLevel++) {
          const sameBench = newBench.filter(u => u && u.id === unit.id && u.stars === starLevel);
          if (sameBench.length >= 3) {
            const upgraded = { ...unit, stars: starLevel + 1, uid: makeUid() };
            let removed = 0;
            newBench = newBench.map(u => {
              if (removed < 3 && u && u.id === unit.id && u.stars === starLevel) { removed++; return null; }
              return u;
            });
            const upgradeSlot = newBench.findIndex(slot => slot === null);
            if (upgradeSlot !== -1) newBench[upgradeSlot] = upgraded;
            setLog(prev => [`⭐ ${unit.name} upgraded to ${upgraded.stars} stars!`, ...prev.slice(0, 9)]);
            sound.upgrade();
            setTimeout(() => { const evolveEl = document.querySelector(`[data-unit-uid="${upgraded?.uid}"]`); if (evolveEl) { evolveEl.classList.add('wt-evolve-flash'); setTimeout(() => evolveEl.classList.remove('wt-evolve-flash'), 800); } }, 50);
            didUpgrade = true;
            break;
          }
        }
      }

      setBench(newBench);
      setGold(g => g - unit.cost);
      const newShop = [...shop];
      newShop[index] = null;
      setShop(newShop);
      return;
    }

    // Add unit to bench first (or handle full-bench upgrade)
    let newBench = [...bench];
    let newBoard = [...board];

    if (emptySlot !== -1) {
      newBench[emptySlot] = { ...unit };
    } else {
      // Bench is full — we already verified upgrade is possible above
      // Remove 2 matching units to make room, then place the bought unit + do upgrade
      let removed = 0;
      newBench = newBench.map(u => {
        if (removed < 2 && u && u.id === unit.id && u.stars === 1) { removed++; return null; }
        return u;
      });
      if (removed < 2) {
        newBoard = newBoard.map(u => {
          if (removed < 2 && u && u.id === unit.id && u.stars === 1) { removed++; return null; }
          return u;
        });
      }
      const freeSlot = newBench.findIndex(slot => slot === null);
      if (freeSlot === -1) return; // safety bail
      // Place the upgraded unit directly
      const upgraded = { ...unit, stars: 2, uid: makeUid() };
      // Prefer placing on board where a removed unit was
      const boardSlot = newBoard.findIndex((u, idx) => u === null && board[idx]?.id === unit.id);
      if (boardSlot !== -1) {
        newBoard[boardSlot] = upgraded;
      } else {
        newBench[freeSlot] = upgraded;
      }
      setLog(prev => [`⭐ ${unit.name} upgraded to 2 stars!`, ...prev.slice(0, 9)]);
      sound.upgrade();
      setTimeout(() => { const evolveEl = document.querySelector(`[data-unit-uid="${upgraded?.uid}"]`); if (evolveEl) { evolveEl.classList.add('wt-evolve-flash'); setTimeout(() => evolveEl.classList.remove('wt-evolve-flash'), 800); } }, 50);
      setBench(newBench);
      setBoard(newBoard);
      setGold(g => g - unit.cost);
      const newShop = [...shop];
      newShop[index] = null;
      setShop(newShop);
      return;
    }

    // Check for upgrades (repeat to handle chain: 1→2→3)
    let didUpgrade = true;
    while (didUpgrade) {
      didUpgrade = false;
      for (let starLevel = 1; starLevel <= 2; starLevel++) {
        const allUnits = [...newBench, ...newBoard];
        const sameUnits = allUnits.filter(u => u && u.id === unit.id && u.stars === starLevel);

        if (sameUnits.length >= 3) {
          // Create upgraded unit
          const upgraded = { ...unit, stars: starLevel + 1, uid: makeUid() };

          // Find if any are on board (to place upgraded there)
          const onBoardIdx = newBoard.findIndex(u => u && u.id === unit.id && u.stars === starLevel);

          // Remove 3 units
          let removed = 0;
          newBench = newBench.map(u => {
            if (removed < 3 && u && u.id === unit.id && u.stars === starLevel) { removed++; return null; }
            return u;
          });
          newBoard = newBoard.map(u => {
            if (removed < 3 && u && u.id === unit.id && u.stars === starLevel) { removed++; return null; }
            return u;
          });

          // Place upgraded unit
          if (onBoardIdx !== -1 && newBoard[onBoardIdx] === null) {
            newBoard[onBoardIdx] = upgraded;
          } else {
            const upgradeSlot = newBench.findIndex(slot => slot === null);
            if (upgradeSlot !== -1) newBench[upgradeSlot] = upgraded;
          }

          setLog(prev => [`⭐ ${unit.name} upgraded to ${upgraded.stars} stars!`, ...prev.slice(0, 9)]);
          sound.upgrade();
          setTimeout(() => { const evolveEl = document.querySelector(`[data-unit-uid="${upgraded?.uid}"]`); if (evolveEl) { evolveEl.classList.add('wt-evolve-flash'); setTimeout(() => evolveEl.classList.remove('wt-evolve-flash'), 800); } }, 50);
          didUpgrade = true;
          break;
        }
      }
    }

    setBench(newBench);
    setBoard(newBoard);
    setGold(g => g - unit.cost);
    const newShop = [...shop];
    newShop[index] = null;
    setShop(newShop);
    sound.buy();
    try { sound.capsSpend?.(); } catch(_) {}
  };

  const refreshShop = () => {
    if (gold < 2) { try { sound.deny?.(); } catch(_) {} return; }
    sound.spendCaps();
    try { sound.capsSpend?.(); } catch(_) {}
    setGold(g => g - 2);
    setShopFlipping(true);
    setTimeout(() => setShopFlipping(false), 500);
    setShop(prev => generateShop(prev));
  };

  const buyXP = () => {
    if (gold < 4 || level >= 9) { try { sound.deny?.(); } catch(_) {} return; }
    sound.experienceUp();
    try { sound.capsSpend?.(); } catch(_) {}
    setGold(g => g - 4);
    setXp(x => {
      const { xpNeeded: needed, level: lvl } = xpMetaRef.current;
      const newXp = x + 4;
      if (newXp >= needed && lvl < 9) {
        const nextNeeded = XP_TO_LEVEL[lvl + 2] || 60;
        setLevel(l => l + 1);
        setXpNeeded(nextNeeded);
        xpMetaRef.current = { xpNeeded: nextNeeded, level: lvl + 1 };
        try { sound.levelUp?.(); } catch(_) {}
        return newXp - needed;
      }
      return newXp;
    });
  };

  const sellUnit = (location, index) => {
    if (location === 'board' && phase === 'combat') return;
    const unit = location === 'bench' ? bench[index] : board[index];
    if (!unit) return;
    // Return copies to shared pool (1★=1, 2★=3, 3★=9)
    const copies = unit.stars === 3 ? 9 : unit.stars === 2 ? 3 : 1;
    poolRef.current[unit.id] = (poolRef.current[unit.id] || 0) + copies;
    const sellValue = unit.cost * (unit.stars === 3 ? 9 : unit.stars === 2 ? 3 : 1);
    setGold(g => g + sellValue);
    try { sound.capsEarn?.(); } catch(_) {}
    // Return equipped items to inventory
    if (unit.items && unit.items.length > 0) {
      setItemInventory(prev => [...prev, ...unit.items]);
      setLog(prev => [`🔩 Recovered ${unit.items.length} item(s)`, ...prev.slice(0, 9)]);
    }
    if (location === 'bench') { const newBench = [...bench]; newBench[index] = null; setBench(newBench); }
    else { const newBoard = [...board]; newBoard[index] = null; setBoard(newBoard); }
    setSelected(null);
    setLog(prev => [`💰 Sold ${unit.name} for ${sellValue} caps`, ...prev.slice(0, 9)]);
    sound.sell();
  };

  // Item equip: assign item from inventory to a unit
  const equipItem = (itemKey, location, index) => {
    if (phase === 'combat') return;
    const arr = location === 'bench' ? bench : board;
    const original = arr[index];
    if (!original) return;
    // Clone the unit to avoid direct state mutation
    const unit = { ...original, items: [...(original.items || [])] };
    if (unit.items.length >= 3) {
      setLog(prev => ['⚠️ Unit already has 3 items!', ...prev.slice(0, 9)]);
      try { sound.invalidAction?.(); } catch(_) {}
      return;
    }
    // Check if this component + existing component = completed item
    const existingComponents = unit.items.filter(it => ITEM_COMPONENTS[it]);
    let combined = false;
    for (const existing of existingComponents) {
      const match = findCompletedItem(existing, itemKey);
      if (match) {
        // Replace only the first matching component with completed item
        const idx = unit.items.indexOf(existing);
        const newItems = [...unit.items];
        newItems.splice(idx, 1);
        newItems.push(match[0]);
        unit.items = newItems;
        combined = true;
        setLog(prev => [`⚙️ Combined into ${match[1].name}!`, ...prev.slice(0, 9)]);
        sound.upgrade();
        try { sound.craftItem?.(); } catch(_) {}
        break;
      }
    }
    if (!combined) {
      unit.items = [...unit.items, itemKey];
      const itemName = ITEM_COMPONENTS[itemKey]?.name || COMPLETED_ITEMS[itemKey]?.name || itemKey;
      setLog(prev => [`🔩 Equipped ${itemName} on ${unit.name}`, ...prev.slice(0, 9)]);
      sound.click();
      try { sound.equipItem?.(); } catch(_) {}
    }
    // Remove from inventory (compute index from prev to avoid stale closure)
    setItemInventory(prev => {
      const idx = prev.indexOf(itemKey);
      if (idx === -1) return prev;
      const n = [...prev]; n.splice(idx, 1); return n;
    });
    // Write cloned unit back into new array
    if (location === 'bench') { const newBench = [...bench]; newBench[index] = unit; setBench(newBench); }
    else { const newBoard = [...board]; newBoard[index] = unit; setBoard(newBoard); }
    setSelectedItem(null);
  };

  equipItemRef.current = equipItem;

  const moveUnit = (fromLoc, fromIdx, toLoc, toIdx) => {
    if (phase === 'combat') return;
    const fromArr = fromLoc === 'bench' ? bench : board;
    const toArr = toLoc === 'bench' ? bench : board;
    const unit = fromArr[fromIdx];
    if (!unit) return;
    try { sound.placeUnit?.(); } catch(_) {}
    if (toLoc === 'board' && fromLoc === 'bench') {
      const boardCount = board.filter(u => u !== null).length;
      const targetOccupied = board[toIdx] !== null;
      if (boardCount >= level && !targetOccupied) { try { sound.invalidAction?.(); } catch(_) {} return; }
    }
    const oldSynergies = getActiveSynergies(board);
    const newFrom = fromLoc === 'bench' ? [...bench] : [...board];
    const newTo = toLoc === 'bench' ? [...bench] : [...board];
    if (fromLoc === toLoc) {
      const temp = newFrom[toIdx]; newFrom[toIdx] = newFrom[fromIdx]; newFrom[fromIdx] = temp;
      if (fromLoc === 'bench') setBench(newFrom); else setBoard(newFrom);
    } else {
      const temp = newTo[toIdx]; newTo[toIdx] = newFrom[fromIdx]; newFrom[fromIdx] = temp;
      if (fromLoc === 'bench') { setBench(newFrom); setBoard(newTo); } else { setBoard(newFrom); setBench(newTo); }
    }
    // Check for synergy changes
    const newBoard = toLoc === 'board' ? newTo : (fromLoc === 'board' ? newFrom : board);
    const newSynergies = getActiveSynergies(newBoard);
    const oldSynCount = oldSynergies.length;
    const newSynCount = newSynergies.length;
    if (newSynCount > oldSynCount) { try { sound.synergize?.(); } catch(_) {} }
    else if (newSynCount < oldSynCount) { try { sound.synergizeOff?.(); } catch(_) {} }
    setSelected(null);
  };

  moveUnitRef.current = moveUnit;
  sellUnitRef.current = sellUnit;

  const startCombat = () => {
    if (phase !== 'prep') return;
    setUnitTooltip(null);
    if (combatRef.current) {
      clearInterval(combatRef.current);
      combatRef.current = null;
    }
    // Calculate synergy bonuses
    const synergies = getActiveSynergies(board);
    let hpMult = 1, atkMult = 1, defAdd = 0;
    synergies.forEach(s => {
      const effect = TRAITS[s.trait].effect(s.count);
      if (effect.hpMult) hpMult *= effect.hpMult;
      if (effect.atkMult) atkMult *= effect.atkMult;
      if (effect.defAdd) defAdd += effect.defAdd;
    });

    // === AUGMENT BONUSES ===
    let augAtkAdd = 0, augHpAdd = 0, augDefAdd = 0, augCritAdd = 0, augApGainMult = 1, augAbilityDmgMult = 1, augAbilityResist = 0, augHealMult = 1, augFirstStrikeMult = 1;
    augments.forEach(augId => {
      const aug = AUGMENT_POOL.find(a => a.id === augId);
      if (!aug) return;
      const e = aug.effect;
      if (e.atkAdd) augAtkAdd += e.atkAdd;
      if (e.hpAdd) augHpAdd += e.hpAdd;
      if (e.defAdd) augDefAdd += e.defAdd;
      if (e.critAdd) augCritAdd += e.critAdd;
      if (e.apGainMult) augApGainMult += e.apGainMult;
      if (e.abilityDmgMult) augAbilityDmgMult += e.abilityDmgMult;
      if (e.abilityResist) augAbilityResist += e.abilityResist;
      if (e.healMult) augHealMult *= e.healMult;
      if (e.firstStrikeMult) augFirstStrikeMult = e.firstStrikeMult;
    });

    // === NEW SYNERGY BONUSES ===
    let defMult = 1, abilityResist = 0, teamShield = 0, raiderCritChance = 0, raiderCritMult = 1.5, ghoulRegen = 0, ghoulPoisonImmune = false, ghoulDeathRadiation = false, scoutDodge = 0;
    synergies.forEach(s => {
      const effect = TRAITS[s.trait].effect(s.count);
      if (effect.defMult) defMult *= effect.defMult;
      if (effect.abilityResist) abilityResist = Math.max(abilityResist, effect.abilityResist);
      if (effect.teamShield) teamShield += effect.teamShield;
      if (effect.critChance) raiderCritChance = Math.max(raiderCritChance, effect.critChance);
      if (effect.critMult && effect.critMult > raiderCritMult) raiderCritMult = effect.critMult;
      if (effect.ghoulRegen) ghoulRegen = Math.max(ghoulRegen, effect.ghoulRegen);
      if (effect.poisonImmune) ghoulPoisonImmune = true;
      if (effect.deathRadiation) ghoulDeathRadiation = true;
      if (effect.dodgeChance) scoutDodge = Math.max(scoutDodge, effect.dodgeChance);
    });

    // === 3★ PASSIVE SYSTEM — check board for 3-star passive holders ===
    const moira3 = board.find(u => u && u.id === 'moira' && u.stars >= 3);
    const moiraResist = moira3 ? 0.15 : 0;
    const piper3 = board.find(u => u && u.id === 'piper' && u.stars >= 3);
    const piperCrit = piper3 ? 0.15 : 0;
    const preston3 = board.some(u => u && u.id === 'preston' && u.stars >= 3);
    const marcy3 = board.some(u => u && u.id === 'marcy' && u.stars >= 3);
    const marcyHpBonus = marcy3 ? 1.05 : 1;
    const wiseman3 = board.some(u => u && u.id === 'wiseman' && u.stars >= 3);
    const wisemanDefBonus = wiseman3 ? 10 : 0;
    const maxson3 = board.find(u => u && u.id === 'maxson' && u.stars >= 3);
    const liberty3 = board.find(u => u && u.id === 'liberty' && u.stars >= 3);
    const libertyAtkBonus = liberty3 ? 0.05 : 0;

    const boardUnits = board.filter(u => u !== null).map((u, i) => {
      const starMult = u.stars === 3 ? 2.5 : u.stars === 2 ? 1.8 : 1;
      const attackSpeed = UNIT_DATABASE[u.id]?.attackSpeed ?? 1.0;
      // === ITEM STAT BONUSES ===
      let itemAtk = 0, itemDef = 0, itemHp = 0, itemDodge = 0, itemApGainBonus = 0, itemAbilityPower = 0;
      let itemDamageReduction = 0, itemDefPierce = 0, itemStartAp = 0, itemTripleHit = 0;
      let itemEmergencyHeal = false, itemPoisonImmune = false, itemInvisibleTicks = 0;
      let itemAbilitySplash = 0, itemAbilityHeal = 0;
      let itemBurnOnAbility = 0, itemPoisonOnHit = 0, itemCritOnAbility = 0;
      let itemInvisOnAbility = 0, itemHealOnKill = 0, itemHealAllyOnAbility = 0;
      let itemHealOnDodge = 0, itemReflectDamage = 0, itemStunResist = false;
      let itemBonusDmgFromStealth = 0, itemCritChance = 0;
      (u.items || []).forEach(itemKey => {
        const comp = ITEM_COMPONENTS[itemKey];
        const completed = COMPLETED_ITEMS[itemKey];
        if (comp) {
          if (comp.stat === 'def') itemDef += comp.value;
          if (comp.stat === 'hp') itemHp += comp.value;
          if (comp.stat === 'atk') itemAtk += comp.value;
          if (comp.stat === 'apGain') itemApGainBonus += comp.value;
          if (comp.stat === 'dodge') itemDodge += comp.value;
          if (comp.stat === 'abilityPower') itemAbilityPower += comp.value;
        }
        if (completed) {
          const e = completed.effects;
          if (e.def) itemDef += e.def;
          if (e.hp) itemHp += e.hp;
          if (e.atk) itemAtk += e.atk;
          if (e.dodge) itemDodge += e.dodge;
          if (e.damageReduction) itemDamageReduction += e.damageReduction;
          if (e.defPierce) itemDefPierce += e.defPierce;
          if (e.startAp) itemStartAp += e.startAp;
          if (e.apGainBonus) itemApGainBonus += e.apGainBonus;
          if (e.tripleHit) itemTripleHit = e.tripleHit;
          if (e.emergencyHeal) itemEmergencyHeal = e.emergencyHeal;
          if (e.poisonImmune) itemPoisonImmune = true;
          if (e.invisibleTicks) itemInvisibleTicks = e.invisibleTicks;
          if (e.abilitySplash) itemAbilitySplash += e.abilitySplash;
          if (e.abilityHeal) itemAbilityHeal += e.abilityHeal;
          if (e.burnOnAbility) itemBurnOnAbility += e.burnOnAbility;
          if (e.poisonOnHit) itemPoisonOnHit += e.poisonOnHit;
          if (e.critOnAbility) itemCritOnAbility += e.critOnAbility;
          if (e.invisOnAbility) itemInvisOnAbility = Math.max(itemInvisOnAbility, e.invisOnAbility);
          if (e.healOnKill) itemHealOnKill += e.healOnKill;
          if (e.healAllyOnAbility) itemHealAllyOnAbility += e.healAllyOnAbility;
          if (e.healOnDodge) itemHealOnDodge += e.healOnDodge;
          if (e.reflectDamage) itemReflectDamage += e.reflectDamage;
          if (e.stunResist) itemStunResist = true;
          if (e.bonusDmgFromStealth) itemBonusDmgFromStealth += e.bonusDmgFromStealth;
          if (e.critChance) itemCritChance += e.critChance;
          if (e.abilityPower) itemAbilityPower += e.abilityPower;
        }
      });
      const unitDef = (u.def + defAdd + wisemanDefBonus + itemDef + augDefAdd) * defMult;
      const unitAtk = (u.atk * starMult * atkMult * (1 + libertyAtkBonus)) + itemAtk + augAtkAdd;
      // Maxson 3★: Brotherhood units gain +20% ATK
      const maxsonBonus = (maxson3 && UNIT_DATABASE[u.id]?.traits?.includes('Brotherhood')) ? 1.2 : 1;
      // Deacon 3★: first ability costs 50% less AP
      const deaconApDiscount = (u.id === 'deacon' && u.stars >= 3) ? 0.5 : 1;
      const baseApMax = UNIT_DATABASE[u.id]?.apMax || 0;
      const startMana = Math.max(
        preston3 ? Math.floor(baseApMax * 0.2) : 0,
        itemStartAp > 0 ? Math.floor(baseApMax * itemStartAp) : 0
      );
      return {
        ...u,
        currentHp: u.hp * starMult * hpMult * marcyHpBonus + teamShield + itemHp + augHpAdd,
        maxHp: u.hp * starMult * hpMult * marcyHpBonus + teamShield + itemHp + augHpAdd,
        baseAtk: unitAtk * maxsonBonus,
        atk: unitAtk * maxsonBonus,
        baseDef: unitDef,
        def: unitDef,
        damageResist: moiraResist + itemDamageReduction,
        abilityResist: abilityResist + augAbilityResist,
        critBonus: piperCrit + raiderCritChance + augCritAdd,
        critMult: raiderCritMult,
        dodge: itemDodge + scoutDodge,
        defPierce: itemDefPierce,
        itemTripleHit,
        _tripleHitCounter: 0,
        itemEmergencyHeal,
        _emergencyHealUsed: false,
        itemPoisonImmune: itemPoisonImmune,
        itemAbilitySplash,
        itemAbilityHeal,
        itemAbilityPower,
        itemInvisibleTicks,
        _invisibleTimer: itemInvisibleTicks,
        itemBurnOnAbility,
        itemPoisonOnHit,
        itemCritOnAbility,
        itemInvisOnAbility,
        itemHealOnKill,
        itemHealAllyOnAbility,
        itemHealOnDodge,
        itemReflectDamage,
        itemStunResist,
        itemBonusDmgFromStealth,
        itemCritChance,
        ghoulRegen,
        ghoulPoisonImmune,
        ghoulDeathRadiation,
        isGhoul: UNIT_DATABASE[u.id]?.traits?.includes('Ghoul'),
        position: board.findIndex((b, idx) => b && b.uid === u.uid),
        isEnemy: false,
        mana: startMana,
        manaMax: Math.floor(baseApMax * deaconApDiscount),
        apGain: (UNIT_DATABASE[u.id]?.apGain || 0) * (1 + itemApGainBonus) * augApGainMult,
        apOnHit: UNIT_DATABASE[u.id]?.apOnHit || 0,
        abilityUsed: false,
        buffDuration: 0,
        buffAtkMult: 1,
        stunDuration: 0,
        attackSpeed,
        attackCooldown: attackSpeed * 10,
        // 3★ passive flags
        firstAttack: true,
        killBonusAtk: 0,
        killBonusHp: 0,
        kelloggRevived: false,
        deaconUntargetable: 0,
        burnDmg: 0,
        burnTicks: 0,
      };
    });
    if (boardUnits.length === 0) {
      setLog(prev => ['⚠️ No units on board!', ...prev.slice(0, 9)]);
      setNoBoardFlash(true);
      setTimeout(() => setNoBoardFlash(false), 600);
      return;
    }
    sound.fight();
    // Ghost players shop from the pool each round
    const aliveGhosts = ghostPlayersRef.current.filter(g => g.alive);
    aliveGhosts.forEach(g => ghostPlayerShop(g, poolRef.current, round));
    // PvE rounds (1-3 + themed creep waves at 8/15/22/29) and boss rounds use generateEnemies;
    // PvP rounds use ghost army.
    const isPvE = isPveRound(round);
    const isBoss = round > 3 && round % 7 === 0 && BOSS_DATABASE[round];
    const pveWaveTheme = isPvE ? getPveWave(round) : null;
    if (pveWaveTheme && !isBoss) {
      setLog(prev => [pveWaveTheme.logLine, ...prev.slice(0, 9)]);
    }
    let enemyUnits;
    let opponent = null;
    if (isPvE || isBoss) {
      enemyUnits = generateEnemies(round, difficultyId);
    } else {
      // Pick a random alive ghost player to fight
      if (aliveGhosts.length > 0) {
        opponent = aliveGhosts[Math.floor(Math.random() * aliveGhosts.length)];
        enemyUnits = ghostPlayerBoard(opponent, round);
        setCurrentOpponent(opponent.name);
      } else {
        enemyUnits = generateEnemies(round, difficultyId);
      }
    }
    if (!opponent) setCurrentOpponent(null);
    setCombatUnits(boardUnits);
    setCombatEnemies(enemyUnits);
    setPhase('combat');
    setCombatTick(0);
    setTimer(settings.prepTimer || 30);
    setBonusGold(0);

    // Boss intro cinematic
    const bossData = isBoss ? BOSS_DATABASE[round] : null;
    const launchCombat = () => {
    runCombat(boardUnits, enemyUnits, {
      board,
      combatRef,
      round,
      hpRef,
      augments,
      xpMetaRef,
      XP_TO_LEVEL,
      setAnimations,
      setFloatingNumbers,
      setLog,
      setCombatUnits,
      setCombatEnemies,
      setStreak,
      setHp,
      setPhase,
      setGold,
      setXp,
      setLevel,
      setXpNeeded,
      setRound,
      setShop,
      setTimer,
      setBonusGold,
      setItemSelection,
      setAugmentChoice,
      setCombatTick,
      setIncomeBreakdown,
      setDamageStats,
      addMatchHistory: (entry) => {
        setMatchHistory(prev => [...prev, entry]);
        // Wave 2: also persist a trimmed replay to localStorage so ReplayViewer
        // can step through the last 5 fights. We pull the current log buffer at
        // call-time; combat.js's log is the source of truth for action ordering.
        try {
          saveReplay({
            round: entry?.round ?? round,
            opponent: entry?.opponent || currentOpponent?.name || '?',
            result: entry?.result || (entry?.win ? 'win' : 'loss'),
            log: entry?.log || [],
          });
        } catch (e) { logError(e, { source: 'addMatchHistory.saveReplay' }); }
      },
      currentOpponent: currentOpponent || null,
      generateShop,
      getRandomComponent,
      setCarouselActive,
      augAbilityDmgMult,
      augHealMult,
      augFirstStrikeMult,
      difficultyId,
      prepTimer: settings.prepTimer || 30,
      setPlayerStats,
      saveGame: () => saveGameRef.current?.(),
    });
    }; // end launchCombat

    if (bossData) {
      setBossIntro(bossData);
      try { sound.bossApproach?.(); } catch(_) {}
      try { sound.bossEntrance?.(); } catch(_) {}
      sound.stopBattleMusic();
      try { sound.startBossMusic?.(); } catch(_) {}
      setTimeout(() => {
        setBossIntro(null);
        launchCombat();
      }, 3500);
    } else {
      launchCombat();
    }
  };
  startCombatRef.current = startCombat;

  const restart = () => {
    if (combatRef.current) clearInterval(combatRef.current);
    setFloatingNumbers([]);
    xpMetaRef.current = { xpNeeded: 4, level: 3 };
    setPhase('menu'); setMenuTab('main'); setRound(1); setGold(10); setHp(100); setLevel(3); setXp(0); setXpNeeded(4); setStreak(0);
    setBench(Array(9).fill(null)); setBoard(Array(14).fill(null)); poolRef.current = initPool(); ghostPlayersRef.current = initGhostPlayers(poolRef.current); setCurrentOpponent(null); setShop(generateShop(null)); setLog([]); setTimer(settings.prepTimer || 30);
    setCombatUnits([]); setCombatEnemies([]);  setBonusGold(0);
    setUnitTooltip(null); setSelected(null);
    setItemInventory([]); setItemSelection(null); setSelectedItem(null);
    setAugments([]); setAugmentChoice(null);
    setMatchHistory([]); setDamageStats({});
    // Reset UI states that could leak between games
    setSettingsOpen(false); setCheatSheetOpen(false); setPaused(false); pausedRef.current = false;
    setCarouselActive(false); setBossIntro(null); setShowIncome(false);
    setAnimations({ attacking: [], hit: [], dying: [], ability: [] });
    setNoBoardFlash(false); setIncomeBreakdown(null);
    localStorage.removeItem('wt_save'); setHasSave(false);
  };

  const saveGameRef = useRef(null);
  const saveGame = () => {
    const state = {
      round, gold, hp: hpRef.current, level, xp, xpNeeded: xpMetaRef.current.xpNeeded, streak,
      bench: bench.map(u => u ? { id: u.id, stars: u.stars, uid: u.uid, items: u.items || [] } : null),
      board: board.map(u => u ? { id: u.id, stars: u.stars, uid: u.uid, items: u.items || [] } : null),
      pool: poolRef.current,
      itemInventory, augments,
    };
    localStorage.setItem('wt_save', JSON.stringify(state));
    setHasSave(true);
    setLog(prev => ['💾 Game saved!', ...prev.slice(0, 9)]);
  };
  saveGameRef.current = saveGame;

  const loadGame = () => {
    try { sound.holotapeInsert?.(); } catch(_) {}
    try {
      const raw = localStorage.getItem('wt_save');
      if (!raw) return;
      const state = JSON.parse(raw);
      if (combatRef.current) clearInterval(combatRef.current);
      setFloatingNumbers([]);
      const restoreUnit = (u) => {
        if (!u || !UNIT_DATABASE[u.id]) return null;
        return { ...UNIT_DATABASE[u.id], id: u.id, stars: u.stars, uid: u.uid, items: u.items || [] };
      };
      setPhase('prep');
      setRound(state.round || 1);
      setGold(state.gold || 10);
      setHp(state.hp || 100);
      setLevel(state.level || 3);
      setXp(state.xp || 0);
      setXpNeeded(state.xpNeeded || 4);
      xpMetaRef.current = { xpNeeded: state.xpNeeded || 4, level: state.level || 3 };
      setStreak(state.streak || 0);
      setBench(state.bench ? state.bench.map(restoreUnit) : Array(9).fill(null));
      setBoard(state.board ? state.board.map(restoreUnit) : Array(14).fill(null));
      if (state.pool) poolRef.current = state.pool;
      setItemInventory(state.itemInventory || []);
      setAugments(state.augments || []);
      setShop(generateShop(null));
      setTimer(settings.prepTimer || 30);
      setCombatUnits([]); setCombatEnemies([]); setBonusGold(0);
      setUnitTooltip(null); setItemSelection(null); setAugmentChoice(null);
      setLog(['💾 Game loaded!']);
    } catch (e) { setLog(prev => ['⚠️ Failed to load save', ...prev.slice(0, 9)]); }
  };

  const getColor = (cost) => ({ 1: '#888', 2: '#4CAF50', 3: '#2196F3', 4: '#9C27B0', 5: '#FF9800' }[cost] || '#888');
  const stars = (n) => '\u2605'.repeat(n);
  const synergies = useMemo(() => getActiveSynergies(board), [board]);

  // Image constants
  const ARENA_BG = IMAGES.arena_bg || '';
  const SHOP_BG = IMAGES.shop_bg || '';
  const FIGHT_BTN = IMAGES.fight_btn;
  const CAPS_IMG = IMAGES.caps;
  const LOGO_IMG = `${BASE}/logo.png`;

  // Helper to get unit image or generate placeholder
  const getUnitImage = (unitId, stars) => {
    const img = IMAGES[unitId]?.[stars] || IMAGES[unitId]?.[1];
    return img || null;
  };

  // Handlers for UnitCard callbacks
  const handleUnitPointerDown = (e, location, index, unit) => {
    setUnitTooltip(null);
    setPointerDrag({ location, index, unit, startX: e.clientX, startY: e.clientY });
    hasMovedRef.current = false;
    try { sound.pickupUnit?.(); } catch(_) {}
  };

  const handleUnitContextMenu = (e, unit) => {
    setUnitTooltip(prev => (prev?.unit?.uid === unit.uid ? null : { unit, x: e.clientX, y: e.clientY }));
  };

  const handleUnitClick = (e, unit, location, index) => {
    if (justDraggedRef.current) { justDraggedRef.current = false; return; }
    setUnitTooltip(null);
    if (selectedItem && unit) { equipItem(selectedItem, location, index); return; }
    if (selected && selected.location !== location) { moveUnit(selected.location, selected.index, location, index); }
    else { setSelected((selected && selected.location === location && selected.index === index) ? null : { unit, location, index }); }
  };

  return (
    <div
      data-theme={settings.uiTheme || 'tactical'}
      style={{
        minHeight: '100vh',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(180deg, #1a1a0f 0%, #0d0d08 50%, #1a1a0f 100%)',
        fontFamily: '"Share Tech Mono", "Courier New", monospace',
        color: 'var(--ui-text)',
        padding: '4px 8px',
        margin: '0 auto',
        overflow: 'hidden',
        cursor: pointerDrag || draggedFrom ? 'grabbing' : 'default',
        userSelect: draggedFrom ? 'none' : 'auto',
        ['--wt-anim-speed']: settings.animationSpeed,
        fontSize: settings.fontSize === 'small' ? 12 : settings.fontSize === 'large' ? 16 : 14,
        ['--wt-font-scale']: settings.fontSize === 'small' ? 0.85 : settings.fontSize === 'large' ? 1.15 : 1,
      }}>
      {playTransition && <LoadingScreen onComplete={onPlayTransitionComplete} />}
      {/* ═══ MAIN MENU — TFT Launcher Style ═══ */}
      {phase === 'menu' && (
        <div onMouseMove={e => { setMousePos({ x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight }); }} style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', animation: 'wt-menu-flicker 8s ease-in-out infinite' }}>
          {/* Background — theme-specific, mouse parallax */}
          {(() => {
            const t = settings.uiTheme || 'tactical';
            const bgs = {
              tactical: { img: `${BASE}/menu-bg.jpg`, overlay: 'linear-gradient(90deg, rgba(10,6,2,0.6) 0px, rgba(10,6,2,0.3) 600px, rgba(5,3,1,0.15) 1000px, rgba(5,3,1,0.1) 100%)' },
              default: { img: `${BASE}/pipboy-bg.jpg`, overlay: 'none' },
              vault: { grad: 'radial-gradient(ellipse at 60% 40%, #0a0a22 0%, #050518 40%, #020210 70%, #010108 100%)', overlay: 'linear-gradient(90deg, rgba(0,0,12,0.7) 0px, rgba(0,0,12,0.4) 600px, transparent 1000px)' },
              nuka: { grad: 'radial-gradient(ellipse at 60% 40%, #1a0808 0%, #100404 40%, #080202 70%, #040101 100%)', overlay: 'linear-gradient(90deg, rgba(12,2,2,0.7) 0px, rgba(12,2,2,0.4) 600px, transparent 1000px)' },
            };
            const bg = bgs[t] || bgs.tactical;
            return (<>
              <div style={{ position: 'fixed', ...(t === 'default' ? { inset: 0, backgroundImage: `url(${bg.img})`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', backgroundColor: '#0a0a06' } : { inset: -20, ...(bg.img ? { backgroundImage: `url(${bg.img})`, backgroundSize: 'cover', backgroundPosition: 'center 30%' } : { background: bg.grad }), transform: `translate(${(mousePos.x - 0.5) * -15}px, ${(mousePos.y - 0.5) * -10}px)`, transition: 'transform 0.3s ease-out' }), zIndex: 0 }} />
              <div style={{ position: 'fixed', inset: 0, background: bg.overlay, zIndex: 1, transition: 'background 0.5s' }} />
            </>);
          })()}
          {/* Floating dust particles */}
          {[
            { left: '15%', top: '20%', size: 2, anim: 'wt-dust-float-1', dur: '14s', delay: '0s' },
            { left: '70%', top: '60%', size: 1.5, anim: 'wt-dust-float-2', dur: '18s', delay: '2s' },
            { left: '40%', top: '75%', size: 2.5, anim: 'wt-dust-float-3', dur: '16s', delay: '5s' },
            { left: '85%', top: '30%', size: 1.5, anim: 'wt-dust-float-4', dur: '20s', delay: '1s' },
            { left: '55%', top: '45%', size: 2, anim: 'wt-dust-float-5', dur: '15s', delay: '8s' },
            { left: '25%', top: '85%', size: 1.5, anim: 'wt-dust-float-1', dur: '17s', delay: '4s' },
            { left: '90%', top: '15%', size: 2, anim: 'wt-dust-float-3', dur: '19s', delay: '7s' },
            { left: '60%', top: '80%', size: 1, anim: 'wt-dust-float-2', dur: '22s', delay: '3s' },
            { left: '35%', top: '35%', size: 2, anim: 'wt-dust-float-4', dur: '16s', delay: '10s' },
            { left: '80%', top: '50%', size: 1.5, anim: 'wt-dust-float-5', dur: '13s', delay: '6s' },
          ].map((p, i) => (
            <div key={i} style={{
              position: 'fixed', left: p.left, top: p.top,
              width: p.size, height: p.size, borderRadius: '50%',
              background: 'rgba(200,160,100,0.6)',
              pointerEvents: 'none', zIndex: 7,
              animation: `${p.anim} ${p.dur} ease-in-out ${p.delay} infinite`,
            }} />
          ))}

          {/* Warm amber glow from left where UI sits */}
          <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse 40% 60% at 20% 50%, rgba(40,25,5,0.3) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 8, animation: 'wt-menu-glow-pulse 4s ease-in-out infinite' }} />
          {/* Soft scanlines */}
          <div style={{ position: 'fixed', inset: 0, background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.08) 0px, rgba(0,0,0,0.08) 1px, transparent 1px, transparent 3px)', pointerEvents: 'none', zIndex: 10 }} />
          {/* Moving scanline bar — warm tint */}
          <div style={{ position: 'fixed', left: 0, right: 0, height: '6px', background: 'linear-gradient(180deg, transparent, rgba(255,180,60,0.04), transparent)', pointerEvents: 'none', zIndex: 10, animation: 'wt-menu-scanline-move 8s linear infinite' }} />
          {/* Heavy vignette */}
          <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse 80% 75% at 50% 50%, transparent 0%, rgba(0,0,0,0.4) 60%, rgba(0,0,0,0.85) 100%)', pointerEvents: 'none', zIndex: 9 }} />
          {/* Noise texture */}
          <div style={{ position: 'fixed', inset: 0, opacity: 0.015, background: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")', pointerEvents: 'none', zIndex: 10, animation: 'wt-menu-noise 0.5s steps(4) infinite' }} />

          {/* ── Top Navigation Bar ── */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '0 24px', height: 60, background: 'linear-gradient(180deg, rgba(20,12,5,0.95) 0%, rgba(10,6,2,0.9) 100%)', borderBottom: '1px solid var(--ui-border-dim)', zIndex: 11, backdropFilter: 'blur(8px)', position: 'relative', width: '100vw', marginLeft: 'calc(-50vw + 50%)', paddingLeft: 'max(24px, calc(50vw - 50% + 24px))', paddingRight: 'max(24px, calc(50vw - 50% + 24px))' }}>
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 30 }}>
              <img src={LOGO_IMG} alt="" style={{ height: 52, objectFit: 'contain', filter: 'drop-shadow(0 0 6px rgba(255,180,0,0.3))', mixBlendMode: 'lighten', opacity: menuFirstLoad ? 0 : 1, animation: menuFirstLoad ? 'wt-menu-fade-in 0.8s ease-out 0.1s forwards' : 'none' }} />
            </div>
            {/* Nav tabs */}
            {[
              { id: 'main', label: 'HOME' },
              { id: 'cosmetics', label: 'ARMORY' },
              { id: 'shop', label: 'SHOP' },
              { id: 'settings', label: 'SETTINGS' },
            ].map(tab => (
              <button key={tab.id} className="wt-menu-nav-tab" onClick={() => { setMenuTab(tab.id); setMenuFirstLoad(false); setTabKey(k => k + 1); }} style={{
                padding: '0 24px', height: 60, fontSize: 14, fontWeight: 'bold', letterSpacing: 2,
                background: menuTab === tab.id ? 'rgba(180,120,40,0.12)' : 'transparent',
                border: 'none', borderBottom: menuTab === tab.id ? '2px solid var(--ui-primary)' : '2px solid transparent',
                color: menuTab === tab.id ? 'var(--ui-text)' : 'var(--ui-text-dim)', cursor: 'pointer',
                fontFamily: 'inherit',
              }}>
                {tab.label}
              </button>
            ))}
            {/* Spacer */}
            <div style={{ flex: 1 }} />
            {/* Profile area — Vault-Tec style */}
            <div className="wt-profile-area" onClick={() => { /* TODO: open profile/stats panel */ }} style={{ '--profile-glow': rank.color, display: 'flex', alignItems: 'center', gap: 10, padding: '4px 12px', height: 52 }}>
              {/* Rank + stats */}
              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--ui-text)', fontWeight: 'bold', letterSpacing: 2 }}>OVERSEER</div>
                <span className="wt-rank-badge" style={{ fontSize: 8, color: rank.color, fontWeight: 'bold', padding: '1px 6px', background: `${rank.color}15`, border: `1px solid ${rank.color}33`, borderRadius: 2, letterSpacing: 0.5, marginTop: 2, display: 'inline-block', textAlign: 'center' }}>{rank.name.toUpperCase()}</span>
              </div>
              {/* Avatar — clean circle, no frame overlay */}
              <div style={{ width: 42, height: 42, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
                <img src={`${BASE}/images/profile/vault-boy.webp`} alt="Vault Boy" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 10%' }} />
              </div>
            </div>
          </div>

          {/* ── Content Area ── */}
          {(() => {
            const isPipBoy = (settings.uiTheme || 'tactical') === 'default';
            // Calculate pip-boy screen position using per-tab settings
            const pipTabPos = {
              main: { L: 32.2, T: 20.0, W: 25.5, H: 48.0, r: 16 },
              cosmetics: { L: 17.1, T: 13.6, W: 38.9, H: 53.2, r: 24 },
              shop: { L: 16.8, T: 13.6, W: 40.9, H: 53.2, r: 24 },
              settings: { L: 17.1, T: 12.7, W: 39.9, H: 53.2, r: 24 },
            };
            const getPipScreen = (tab) => {
              const vw = vpSize.w, vh = vpSize.h;
              const imgRatio = 1280 / 800, vpRatio = vw / vh;
              let imgW, imgH, imgX, imgY;
              if (vpRatio > imgRatio) { imgH = vh; imgW = vh * imgRatio; imgX = (vw - imgW) / 2; imgY = 0; }
              else { imgW = vw; imgH = vw / imgRatio; imgX = 0; imgY = (vh - imgH) / 2; }
              const p = pipTabPos[tab] || pipTabPos.main;
              const r = p.r;
              return {
                position: 'fixed',
                left: imgX + imgW * p.L / 100, top: imgY + imgH * p.T / 100,
                width: imgW * p.W / 100, height: imgH * p.H / 100,
                zIndex: 12,
                overflow: 'hidden',
                borderRadius: `${r}px`,
                clipPath: `inset(0 round ${r}px)`,
                display: 'flex', flexDirection: 'column',
              };
            };
            const pipBoyScreen = isPipBoy ? getPipScreen(menuTab) : null;
            return (<>
            {/* Pip-Boy screen positions are hardcoded per-tab */}
            {/* Pip-Boy screen overlays — only when pipboy theme active */}
            {isPipBoy && menuTab !== 'main' && (
              <div style={{ ...pipBoyScreen, pointerEvents: 'none' }}>
                <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 50%, rgba(0,40,0,0.15) 0%, rgba(0,20,0,0.3) 60%, rgba(0,10,0,0.5) 100%)', zIndex: 20 }} />
                <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.12) 0px, rgba(0,0,0,0.12) 1px, transparent 1px, transparent 2px)', zIndex: 21 }} />
              </div>
            )}
          <div style={isPipBoy && menuTab !== 'main' ? { ...pipBoyScreen, zIndex: 13 } : { flex: 1, display: 'flex', flexDirection: 'column', zIndex: 11 }}
            className={isPipBoy && menuTab !== 'main' ? 'wt-menu-scroll' : undefined}>

            {/* HOME TAB */}
            {menuTab === 'main' && (
              <div key={tabKey} className="wt-tab-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', ...((settings.uiTheme || 'tactical') === 'default' ? { position: 'relative' } : {}) }}>
                {/* Pip-Boy screen container — only for green theme */}
                {(settings.uiTheme || 'tactical') === 'default' && (<>
                  {/* Pip-Boy CRT screen container */}
                  <div style={getPipScreen('main')}>
                    {/* Screen glow overlay */}
                    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 50%, rgba(0,40,0,0.15) 0%, rgba(0,20,0,0.3) 60%, rgba(0,10,0,0.5) 100%)', pointerEvents: 'none', zIndex: 1 }} />
                    {/* Scanlines */}
                    <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.12) 0px, rgba(0,0,0,0.12) 1px, transparent 1px, transparent 2px)', pointerEvents: 'none', zIndex: 2 }} />
                    {/* Content — compact to fit CRT */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '10px 14px', position: 'relative', zIndex: 0, overflow: 'hidden' }}>
                      <div style={{ fontSize: 8, color: '#00ff00', letterSpacing: 3, marginBottom: 2, opacity: 0.5 }}>ROBCO INDUSTRIES (TM) TERMLINK</div>
                      <div style={{ fontSize: 7, color: '#00aa00', marginBottom: 6, opacity: 0.3 }}>VAULT-TEC PIP-BOY MARK IV</div>
                      <img src={LOGO_IMG} alt="Wasteland Tactics" style={{ height: 48, objectFit: 'contain', alignSelf: 'flex-start', filter: 'brightness(0.6) saturate(0) sepia(1) hue-rotate(70deg) saturate(3) brightness(0.7)', mixBlendMode: 'lighten', marginBottom: 4 }} />
                      <div style={{ fontSize: 14, color: '#00ff00', letterSpacing: 3, marginBottom: 2, fontWeight: 'bold', textShadow: '0 0 6px rgba(0,255,0,0.3)' }}>SEASON 1</div>
                      <div style={{ fontSize: 9, color: '#00aa00', letterSpacing: 2, marginBottom: 8, opacity: 0.5 }}>THE COMMONWEALTH</div>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                        {[{ l: '22 UNITS' }, { l: '8 SYNERGIES' }, { l: '20 ITEMS' }].map((c, i) => (
                          <div key={i} style={{ padding: '2px 8px', border: '1px solid #00ff0033', borderRadius: 2, fontSize: 8, color: '#00ff00' }}>{c.l}</div>
                        ))}
                      </div>
                      {/* Buttons */}
                      <button onClick={() => startGame(false)} style={{
                        width: '100%', maxWidth: 180, padding: '8px 0', fontSize: 14, fontWeight: 'bold', letterSpacing: 4,
                        background: 'rgba(0,40,0,0.5)', border: '1px solid #00ff00', borderRadius: 3,
                        color: '#00ff00', cursor: 'pointer', fontFamily: 'inherit',
                        textShadow: '0 0 8px rgba(0,255,0,0.5)', transition: 'all 0.2s', marginBottom: 4,
                      }}
                      onMouseEnter={e => { sound.terminalTab(); e.currentTarget.style.background = 'rgba(0,80,0,0.5)'; e.currentTarget.style.boxShadow = '0 0 16px rgba(0,255,0,0.2)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,40,0,0.5)'; e.currentTarget.style.boxShadow = 'none'; }}
                      >PLAY</button>
                      {hasSave && (
                        <button onClick={() => startGame(true)} style={{
                          padding: '4px 14px', fontSize: 8, letterSpacing: 2,
                          background: 'transparent', border: '1px solid #00ff0044', borderRadius: 2,
                          color: '#00aa00', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s', marginBottom: 4,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#00ff00'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#00ff0044'; }}
                        >CONTINUE</button>
                      )}
                      {/* Wasteland tip */}
                      <div style={{ marginTop: 'auto', padding: '4px 6px', background: 'rgba(0,20,0,0.4)', border: '1px solid #00ff0015', borderRadius: 2 }}>
                        <div style={{ fontSize: 7, color: '#00ff00', letterSpacing: 1, marginBottom: 2, opacity: 0.5 }}>WASTELAND TIP</div>
                        <div style={{ fontSize: 8, color: '#00aa00', lineHeight: 1.3, opacity: 0.6 }}>{[
                          'Place tanks in the front row to absorb damage for your backline carries.',
                          'Save gold to earn interest — 1 bonus gold per 10 saved, up to +5 per round.',
                          'Buy 3 copies of a unit to upgrade to 2-star. 3 two-stars make a 3-star.',
                          'Check the Overseer Terminal for item recipes and shop odds.',
                          'Scout your opponents before combat to counter their positioning.',
                          'Loss streaking gives bonus gold too — sometimes losing early is a strategy.',
                          'Higher level means better shop odds for rare units. Level up strategically.',
                        ][Math.floor(Date.now() / 86400000) % 7]}</div>
                      </div>
                      {/* Footer */}
                      <div style={{ paddingTop: 4, borderTop: '1px solid #00ff0015', display: 'flex', justifyContent: 'space-between', fontSize: 7, color: '#00aa0033', marginTop: 4 }}>
                        <span>HP 100/100</span>
                        <span>ALPHA 0.4</span>
                        <span>CAPS: {gold || 0}</span>
                      </div>
                    </div>
                  </div>
                  {/* Patch notes — OUTSIDE the CRT, bottom-right of page */}
                  <div style={{
                    position: 'fixed', bottom: 30, right: 40, width: 280, zIndex: 11,
                    opacity: menuFirstLoad ? 0 : 1, animation: menuFirstLoad ? 'wt-menu-fade-in 0.6s ease-out 1s forwards' : 'none',
                  }}>
                    <div style={{ background: 'rgba(0,8,0,0.85)', border: '1px solid #00ff0022', borderRadius: 6, padding: 10, backdropFilter: 'blur(4px)' }}>
                      <div style={{ fontSize: 9, color: '#00ff00', letterSpacing: 2, marginBottom: 6, fontWeight: 'bold', opacity: 0.7 }}>WHAT'S NEW</div>
                      <div className="wt-menu-scroll" style={{ maxHeight: 160, overflowY: 'auto', fontSize: 9, lineHeight: 1.5 }}>
                        <div style={{ color: '#00aa00', marginBottom: 4 }}><span style={{ color: '#00ff00' }}>ALPHA 0.4</span> — Combat & Audio <span style={{ fontSize: 7, color: '#005500' }}>by Psyche</span></div>
                        <div style={{ color: '#007700' }}>- Weapon-specific attack VFX</div>
                        <div style={{ color: '#007700' }}>- Fallout 4 local audio loader</div>
                        <div style={{ color: '#007700' }}>- Terminal-style combat log</div>
                        <div style={{ color: '#007700' }}>- Music & SFX volume sliders</div>
                        <div style={{ color: '#007700' }}>- V.A.T.S. kill cam</div>
                        <div style={{ color: '#007700' }}>- Boss intro cinematics</div>
                        <div style={{ color: '#007700' }}>- 78 synthesized SFX</div>
                      </div>
                    </div>
                  </div>
                </>)}
                {/* Hero — content aligned left to show background artwork (non-pipboy themes) */}
                {(settings.uiTheme || 'tactical') !== 'default' && <div style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center',
                  position: 'relative', minHeight: 300, padding: '40px 5vw',
                }}>
                  {/* Left side dark gradient so text is readable over artwork */}
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(10,6,2,0.9) 0px, rgba(10,6,2,0.8) 400px, rgba(10,6,2,0.5) 700px, transparent 1000px)', pointerEvents: 'none' }} />

                  <div style={{ position: 'relative', zIndex: 1 }}>
                    {/* Season banner — typewriter + fade in */}
                    <div style={{ fontSize: 28, color: 'var(--ui-primary)', letterSpacing: 8, marginBottom: 16, opacity: menuFirstLoad ? 0 : 0.9, textShadow: '0 0 16px var(--ui-glow)', overflow: 'hidden', whiteSpace: 'nowrap', borderRight: '3px solid var(--ui-primary)', display: 'inline-block', fontWeight: 'bold', animation: menuFirstLoad ? 'wt-menu-fade-in 0.6s ease-out 0.2s forwards, wt-typewriter-reveal 1.2s steps(8) 0.5s both, wt-typewriter-cursor-blink 0.8s step-end infinite' : 'wt-typewriter-cursor-blink 0.8s step-end infinite' }}>{'>'} SEASON 1</div>
                    {/* Big logo with smoke + glow */}
                    <div style={{ position: 'relative', marginBottom: 8, opacity: menuFirstLoad ? 0 : 1, animation: menuFirstLoad ? 'wt-menu-fade-in 0.8s ease-out 0.4s forwards' : 'none' }}>
                      {/* Subtle warmth behind logo — no animation, just depth */}
                      <div style={{ position: 'absolute', left: '50%', top: '55%', width: 350, height: 180, marginLeft: -175, marginTop: -90, background: 'radial-gradient(ellipse, rgba(0,0,0,0.3) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
                      {/* Smoke wisps */}
                      <div style={{ position: 'absolute', left: '30%', bottom: '10%', width: 60, height: 60, background: 'radial-gradient(ellipse, rgba(180,140,80,0.15) 0%, transparent 70%)', borderRadius: '50%', animation: 'wt-smoke-drift-1 4s ease-out infinite', pointerEvents: 'none' }} />
                      <div style={{ position: 'absolute', left: '55%', bottom: '5%', width: 50, height: 50, background: 'radial-gradient(ellipse, rgba(200,150,80,0.12) 0%, transparent 70%)', borderRadius: '50%', animation: 'wt-smoke-drift-2 5s ease-out infinite 1s', pointerEvents: 'none' }} />
                      <div style={{ position: 'absolute', left: '70%', bottom: '15%', width: 40, height: 40, background: 'radial-gradient(ellipse, rgba(160,120,60,0.1) 0%, transparent 70%)', borderRadius: '50%', animation: 'wt-smoke-drift-3 4.5s ease-out infinite 2s', pointerEvents: 'none' }} />
                      {/* (embers removed) */}
                      {/* Logo image */}
                      <img src={LOGO_IMG} alt="Wasteland Tactics" style={{ height: 'min(220px, 20vh)', objectFit: 'contain', display: 'block', position: 'relative', mixBlendMode: 'lighten', opacity: 0.7, filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.9)) brightness(0.75) saturate(0.7) contrast(1.05)' }} />
                    </div>
                    <div style={{ fontSize: 18, color: 'var(--ui-text-dim)', letterSpacing: 5, marginBottom: 32, textShadow: '0 0 10px var(--ui-glow)', overflow: 'hidden', whiteSpace: 'nowrap', borderRight: '2px solid var(--ui-text-dim)', display: 'inline-block', opacity: menuFirstLoad ? 0 : 0.8, animation: menuFirstLoad ? 'wt-menu-fade-in 0.6s ease-out 1.2s forwards, wt-typewriter-reveal 1.8s steps(16) 1.5s both, wt-typewriter-cursor-blink 0.8s step-end 3.3s infinite' : 'wt-typewriter-cursor-blink 0.8s step-end infinite' }}>{'>'} THE COMMONWEALTH</div>

                    {/* Featured info cards */}
                    <div style={{ display: 'flex', gap: 10, marginBottom: 20, opacity: menuFirstLoad ? 0 : 1, animation: menuFirstLoad ? 'wt-menu-fade-in 0.6s ease-out 1.8s forwards' : 'none' }}>
                      {[
                        { label: '22 UNITS', sub: 'Draft & build', color: '#e8c060' },
                        { label: '8 SYNERGIES', sub: 'Combine traits', color: '#c89848' },
                        { label: '20 ITEMS', sub: 'Craft & equip', color: '#a08040' },
                      ].map((card, i) => (
                        <div key={i} style={{ padding: '8px 18px', background: 'rgba(10,6,2,0.7)', border: `1px solid ${card.color}33`, borderRadius: 4, textAlign: 'center', backdropFilter: 'blur(6px)' }}>
                          <div style={{ fontSize: 15, fontWeight: 'bold', color: card.color }}>{card.label}</div>
                          <div style={{ fontSize: 10, color: '#7a6030' }}>{card.sub}</div>
                        </div>
                      ))}
                    </div>

                    {/* Daily tip */}
                    <div style={{ marginBottom: 20, padding: '8px 14px', background: 'rgba(10,6,2,0.6)', border: '1px solid rgba(200,148,42,0.15)', borderRadius: 4, opacity: menuFirstLoad ? 0 : 1, animation: menuFirstLoad ? 'wt-menu-fade-in 0.6s ease-out 2.1s forwards' : 'none', backdropFilter: 'blur(4px)', maxWidth: 400 }}>
                      <div style={{ fontSize: 9, color: 'var(--ui-primary)', letterSpacing: 2, marginBottom: 3 }}>WASTELAND TIP</div>
                      <div style={{ fontSize: 11, color: 'var(--ui-text-dim)', lineHeight: 1.4 }}>{[
                        'Place tanks in the front row to absorb damage for your backline carries.',
                        'Save gold to earn interest — 1 bonus gold per 10 saved, up to +5 per round.',
                        'Buy 3 copies of a unit to upgrade to 2-star. 3 two-stars make a 3-star.',
                        'Check the Overseer Terminal for item recipes and shop odds.',
                        'Scout your opponents before combat to counter their positioning.',
                        'Loss streaking gives bonus gold too — sometimes losing early is a strategy.',
                        'Synergies activate at 2 and 3 units. Check the codex for breakpoints.',
                        'Higher level means better shop odds for rare units. Level up strategically.',
                      ][Math.floor(Date.now() / 86400000) % 8]}</div>
                    </div>

                    {/* Difficulty selector */}
                    <div style={{ marginBottom: 12, opacity: menuFirstLoad ? 0 : 1, animation: menuFirstLoad ? 'wt-menu-fade-in 0.6s ease-out 2.2s forwards' : 'none' }}>
                      <DifficultySelector value={difficultyId} onChange={setDifficultyId} />
                    </div>

                    {/* Buttons */}
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', opacity: menuFirstLoad ? 0 : 1, animation: menuFirstLoad ? 'wt-menu-fade-in 0.6s ease-out 2.4s forwards' : 'none' }}>
                      <button onClick={() => startGame(false)} disabled={false} style={{
                        width: 400, padding: '28px 0', fontSize: 30, fontWeight: 'bold', letterSpacing: 10,
                        background: 'linear-gradient(180deg, rgba(200,148,42,0.15) 0%, rgba(140,100,30,0.1) 50%, rgba(200,148,42,0.08) 100%)',
                        border: '1px solid var(--ui-border-dim)', borderRadius: 8, color: 'var(--ui-text)', cursor: 'pointer',
                        fontFamily: 'inherit', textShadow: '0 0 12px var(--ui-glow)',
                        boxShadow: '0 0 30px var(--ui-hover), 0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
                        backdropFilter: 'blur(12px)',
                        transition: 'all 0.25s',
                      }}
                      onMouseEnter={e => { sound.terminalTab(); e.currentTarget.style.boxShadow = '0 0 50px rgba(200,148,42,0.25), 0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)'; e.currentTarget.style.transform = 'scale(1.04)'; e.currentTarget.style.borderColor = 'rgba(200,148,42,0.6)'; }}
                      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 0 30px rgba(200,148,42,0.1), 0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)'; e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.borderColor = 'rgba(200,148,42,0.4)'; }}
                      >
                        PLAY
                      </button>

                      {hasSave && (
                        <button onClick={() => startGame(true)} disabled={false} style={{
                          padding: '14px 28px', fontSize: 14, letterSpacing: 2,
                          background: 'rgba(10,6,2,0.7)', border: '1px solid rgba(200,148,42,0.4)', borderRadius: 6,
                          color: 'var(--ui-primary)', cursor: 'pointer', fontFamily: 'inherit',
                          transition: 'all 0.2s', backdropFilter: 'blur(4px)',
                        }}
                        onMouseEnter={e => { sound.terminalTab(); e.currentTarget.style.background = 'rgba(200,148,42,0.15)'; e.currentTarget.style.borderColor = 'rgba(200,148,42,0.7)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(10,6,2,0.7)'; e.currentTarget.style.borderColor = 'rgba(200,148,42,0.4)'; }}
                        >
                          CONTINUE
                        </button>
                      )}
                    </div>
                  </div>
                </div>}

                {/* Patch notes — bottom right (non-pipboy only) */}
                {(settings.uiTheme || 'tactical') !== 'default' &&
                <div style={{
                  position: 'absolute', bottom: 50, right: 70, width: 320, zIndex: 2,
                  opacity: menuFirstLoad ? 0 : 1, animation: menuFirstLoad ? 'wt-menu-fade-in 0.6s ease-out 2.8s forwards' : 'none',
                }}>
                  <div style={{ background: 'rgba(10,6,2,0.8)', border: '1px solid rgba(200,148,42,0.2)', borderRadius: 6, padding: 14, backdropFilter: 'blur(6px)' }}>
                    <div style={{ fontSize: 11, color: 'var(--ui-primary)', letterSpacing: 2, marginBottom: 8, fontWeight: 'bold' }}>WHAT'S NEW</div>
                    <div className="wt-menu-scroll" style={{ maxHeight: 200, overflowY: 'auto', fontSize: 11, lineHeight: 1.7 }}>
                      <div style={{ color: 'var(--ui-text-dim)', marginBottom: 6 }}><span style={{ color: 'var(--ui-primary)' }}>ALPHA 0.4</span> — Combat Overhaul & Authentic Audio <span style={{ fontSize: 8, color: '#5a4020' }}>by Psyche</span></div>
                      <div style={{ color: '#8a7040', fontSize: 9, marginBottom: 4 }}>COMBAT ANIMATIONS</div>
                      <div style={{ color: '#7a6030' }}>- Weapon-specific attack VFX: muzzle flash, energy beams, melee lunge</div>
                      <div style={{ color: '#7a6030' }}>- Weapon-specific death animations: knockback, disintegration, ragdoll</div>
                      <div style={{ color: '#7a6030' }}>- Idle animations per weapon type during combat</div>
                      <div style={{ color: '#7a6030' }}>- V.A.T.S. kill cam on final enemy elimination</div>
                      <div style={{ color: '#7a6030' }}>- Boss intro cinematic with spotlight and name card</div>
                      <div style={{ color: '#7a6030' }}>- Kill notifications: "[Unit] eliminated [Unit]"</div>
                      <div style={{ color: '#7a6030' }}>- Dodge afterimage, stun/poison/burn indicators</div>
                      <div style={{ color: '#7a6030' }}>- 3-star legendary golden border + glow effects</div>
                      <div style={{ color: '#7a6030' }}>- Star evolution flash animation on upgrade</div>
                      <div style={{ color: '#7a6030' }}>- Damage-scaled screen shake (1-8px by hit type)</div>
                      <div style={{ color: '#8a7040', fontSize: 9, marginBottom: 4, marginTop: 8 }}>AUDIO OVERHAUL</div>
                      <div style={{ color: '#7a6030' }}>- 78 synthesized sound effects (Web Audio API)</div>
                      <div style={{ color: '#7a6030' }}>- Fallout 4 local audio loader (43 authentic FO4 sounds)</div>
                      <div style={{ color: '#7a6030' }}>- 17 downloaded MP3s from SoundBible/OrangeFreeSounds</div>
                      <div style={{ color: '#7a6030' }}>- Weapon-type combat sounds: pistol, laser, sledge, Fat Man</div>
                      <div style={{ color: '#7a6030' }}>- Pip-Boy UI clicks, VATS enter/exit, bottle cap clinks</div>
                      <div style={{ color: '#7a6030' }}>- Fallout 4 main theme on Pip-Boy UI theme</div>
                      <div style={{ color: '#7a6030' }}>- Music volume slider + SFX volume control</div>
                      <div style={{ color: '#8a7040', fontSize: 9, marginBottom: 4, marginTop: 8 }}>UI IMPROVEMENTS</div>
                      <div style={{ color: '#7a6030' }}>- Terminal-style combat log (green CRT with scanlines)</div>
                      <div style={{ color: '#7a6030' }}>- Player stats HUD moved to bottom-right</div>
                      <div style={{ color: '#7a6030' }}>- Income breakdown overlay after each round</div>
                      <div style={{ color: '#7a6030' }}>- Winning unit celebration animation</div>
                      <div style={{ color: '#7a6030' }}>- Scouting scope transition effect</div>
                      <div style={{ color: '#7a6030' }}>- Hover info card on board units during prep</div>
                      <div style={{ color: '#7a6030' }}>- Shop reroll card flip animation</div>
                      <div style={{ color: '#7a6030' }}>- Lucky 38 roulette wheel image with golden pointer</div>
                      <div style={{ color: '#7a6030' }}>- Vault Boy avatar (no gold frame overlay)</div>
                      <div style={{ color: '#7a6030' }}>- Fixed unit portrait sizes (consistent 44px)</div>
                      <div style={{ color: '#7a6030' }}>- Combat log matches active UI theme (no hardcoded green)</div>
                      <div style={{ color: '#7a6030' }}>- Panel headers with solid background and glow for visibility</div>
                      <div style={{ color: '#7a6030', marginBottom: 12 }}>- Board grid cells visible during prep phase for unit placement</div>

                      <div style={{ color: 'var(--ui-text-dim)', marginBottom: 6 }}><span style={{ color: 'var(--ui-primary)' }}>ALPHA 0.3</span> — The Lucky 38 & Visual Overhaul <span style={{ fontSize: 8, color: '#5a4020' }}>by Psyche</span></div>
                      <div style={{ color: '#8a7040', fontSize: 9, marginBottom: 4 }}>THE LUCKY 38</div>
                      <div style={{ color: '#7a6030' }}>- New Vegas-style roulette carousel between stages</div>
                      <div style={{ color: '#7a6030' }}>- Elevator cinematic entrance with neon flicker</div>
                      <div style={{ color: '#7a6030' }}>- 10-slice weighted wheel: caps, units, items, augments, HP, jackpot</div>
                      <div style={{ color: '#7a6030' }}>- Dramatic 8-second spin with slow-motion deceleration</div>
                      <div style={{ color: '#7a6030' }}>- Near-miss system teases jackpot on ~20% of spins</div>
                      <div style={{ color: '#7a6030' }}>- Jackpot celebration: screen shake, gold flash, particles</div>
                      <div style={{ color: '#7a6030' }}>- Nuka-Cola bust: lights dim, awkward silence, recovery</div>
                      <div style={{ color: '#7a6030' }}>- Reward fly-away animations to inventory</div>
                      <div style={{ color: '#7a6030' }}>- Post-spin summary with Luckiest Player badge</div>
                      <div style={{ color: '#7a6030' }}>- New augment: High Roller (free re-spin per carousel)</div>
                      <div style={{ color: '#8a7040', fontSize: 9, marginBottom: 4, marginTop: 8 }}>IN-GAME UI OVERHAUL</div>
                      <div style={{ color: '#7a6030' }}>- Complete visual overhaul matching main menu quality</div>
                      <div style={{ color: '#7a6030' }}>- Terminal-styled stage badges with type labels</div>
                      <div style={{ color: '#7a6030' }}>- Round tracker pips colored by type (PvE/PvP/Boss/Carousel)</div>
                      <div style={{ color: '#7a6030' }}>- Phase badges: PREP blinks, BOSS pulses red, LUCKY 38 gold</div>
                      <div style={{ color: '#7a6030' }}>- HP bar with tick marks, XP progress bar, streak arrows</div>
                      <div style={{ color: '#7a6030' }}>- Styled panel headers with accent underlines</div>
                      <div style={{ color: '#7a6030' }}>- Board vignette, reduced zone overlays, styled divider</div>
                      <div style={{ color: '#7a6030' }}>- FIGHT and SELL buttons match main menu PLAY style</div>
                      <div style={{ color: '#7a6030' }}>- Ambient effects: vignette, scanlines, floating dust</div>
                      <div style={{ color: '#7a6030' }}>- Styled shop buttons, log scrollbar, synergy rows</div>
                      <div style={{ color: '#7a6030', marginBottom: 12 }}>- Fixed Marcy Long white background</div>

                      <div style={{ color: 'var(--ui-text-dim)', marginBottom: 6 }}><span style={{ color: 'var(--ui-primary)' }}>ALPHA 0.2</span> — Icon Overhaul & UI Polish <span style={{ fontSize: 8, color: '#5a4020' }}>by Psyche</span></div>
                      <div style={{ color: '#8a7040', fontSize: 9, marginBottom: 4 }}>ICON SYSTEM</div>
                      <div style={{ color: '#7a6030' }}>- Replaced all 54 emoji icons with custom images</div>
                      <div style={{ color: '#7a6030' }}>- Hand-crafted SVG icons for bosses, traits, items, augments</div>
                      <div style={{ color: '#7a6030' }}>- Image-based icon system with emoji fallback</div>
                      <div style={{ color: '#7a6030' }}>- Support for PNG/SVG drop-in replacements</div>
                      <div style={{ color: '#8a7040', fontSize: 9, marginBottom: 4, marginTop: 8 }}>COMBAT LOG</div>
                      <div style={{ color: '#7a6030' }}>- Colored badge system replaces emoji prefixes</div>
                      <div style={{ color: '#7a6030' }}>- 50+ log message types with themed color labels</div>
                      <div style={{ color: '#7a6030' }}>- Improved readability and line spacing</div>
                      <div style={{ color: '#8a7040', fontSize: 9, marginBottom: 4, marginTop: 8 }}>UI POLISH</div>
                      <div style={{ color: '#7a6030' }}>- Redesigned profile area with Vault-Tec avatar frame</div>
                      <div style={{ color: '#7a6030' }}>- Gear-bordered avatar with hover glow animation</div>
                      <div style={{ color: '#7a6030' }}>- Star-based rank badges (Wastelander through Elder)</div>
                      <div style={{ color: '#7a6030' }}>- Clean section headers (removed emoji clutter)</div>
                      <div style={{ color: '#7a6030' }}>- Color-coded HP/ATK/DEF stat display</div>
                      <div style={{ color: '#7a6030' }}>- Full item names in crafting grid with overflow handling</div>
                      <div style={{ color: '#7a6030' }}>- Renamed Fusion Cell to Fusion Core</div>
                      <div style={{ color: '#7a6030' }}>- SVG gear icon for settings button</div>
                      <div style={{ color: '#7a6030', marginBottom: 12 }}>- Unicode stars replace emoji stars throughout</div>

                      <div style={{ color: 'var(--ui-text-dim)', marginBottom: 6 }}><span style={{ color: 'var(--ui-primary)' }}>ALPHA 0.1</span> — First Playable <span style={{ fontSize: 8, color: '#5a4020' }}>by Psyche</span></div>
                      <div style={{ color: '#8a7040', fontSize: 9, marginBottom: 4 }}>GAMEPLAY</div>
                      <div style={{ color: '#7a6030' }}>- 22 units across 5 cost tiers</div>
                      <div style={{ color: '#7a6030' }}>- 8 trait synergies with 2/3 breakpoints</div>
                      <div style={{ color: '#7a6030' }}>- 20 craftable items from 6 components</div>
                      <div style={{ color: '#7a6030' }}>- 15 augments at key rounds</div>
                      <div style={{ color: '#7a6030' }}>- 4 boss encounters (every 7 rounds)</div>
                      <div style={{ color: '#7a6030' }}>- Ghost army PvP (7 AI opponents)</div>
                      <div style={{ color: '#7a6030' }}>- Proximity-based combat targeting</div>
                      <div style={{ color: '#7a6030' }}>- Scouting opponents during prep</div>
                      <div style={{ color: '#7a6030' }}>- Star upgrades (3 copies → 2★ → 3★)</div>
                      <div style={{ color: '#8a7040', fontSize: 9, marginBottom: 4, marginTop: 8 }}>OVERSEER TERMINAL</div>
                      <div style={{ color: '#7a6030' }}>- Item schematics with interactive combos</div>
                      <div style={{ color: '#7a6030' }}>- Unit pool tracker with portraits</div>
                      <div style={{ color: '#7a6030' }}>- Shop odds table per level</div>
                      <div style={{ color: '#7a6030' }}>- Synergy codex with breakpoints</div>
                      <div style={{ color: '#7a6030' }}>- Opponent scouting overview</div>
                      <div style={{ color: '#7a6030' }}>- Match log & damage stats</div>
                      <div style={{ color: '#7a6030' }}>- Player standings leaderboard</div>
                      <div style={{ color: '#7a6030' }}>- Unit dossiers / encyclopedia</div>
                      <div style={{ color: '#7a6030' }}>- Economy simulator</div>
                      <div style={{ color: '#7a6030' }}>- Search & keyboard shortcuts</div>
                      <div style={{ color: '#8a7040', fontSize: 9, marginBottom: 4, marginTop: 8 }}>MAIN MENU</div>
                      <div style={{ color: '#7a6030' }}>- TFT-style launcher with warm wasteland theme</div>
                      <div style={{ color: '#7a6030' }}>- Wasteland background with mouse parallax</div>
                      <div style={{ color: '#7a6030' }}>- Custom gear logo with smoke & embers</div>
                      <div style={{ color: '#7a6030' }}>- Typewriter text animations</div>
                      <div style={{ color: '#7a6030' }}>- Staggered fade-in on first load</div>
                      <div style={{ color: '#7a6030' }}>- "Entering the Wasteland" play transition</div>
                      <div style={{ color: '#7a6030' }}>- Menu music with volume slider</div>
                      <div style={{ color: '#7a6030' }}>- Floating dust particles</div>
                      <div style={{ color: '#7a6030' }}>- Daily gameplay tips</div>
                      <div style={{ color: '#8a7040', fontSize: 9, marginBottom: 4, marginTop: 8 }}>SHOP</div>
                      <div style={{ color: '#7a6030' }}>- Bottle Caps & Nuka-Cola currencies</div>
                      <div style={{ color: '#7a6030' }}>- Board themes, card borders, bundles</div>
                      <div style={{ color: '#7a6030' }}>- Rarity system (Common/Rare/Epic/Legendary)</div>
                      <div style={{ color: '#7a6030' }}>- Purchase flow with confirmation</div>
                      <div style={{ color: '#7a6030' }}>- Currency packs popup</div>
                      <div style={{ color: '#8a7040', fontSize: 9, marginBottom: 4, marginTop: 8 }}>ARMORY</div>
                      <div style={{ color: '#7a6030' }}>- Board themes (Wasteland/Vault-Tec/Nuka-World)</div>
                      <div style={{ color: '#7a6030' }}>- 6 visual effect toggles</div>
                      <div style={{ color: '#7a6030' }}>- 3 damage number styles</div>
                      <div style={{ color: '#7a6030' }}>- Live preview panel</div>
                      <div style={{ color: '#8a7040', fontSize: 9, marginBottom: 4, marginTop: 8 }}>VISUALS & AUDIO</div>
                      <div style={{ color: '#7a6030' }}>- Combat VFX (particles, crits, heals, death)</div>
                      <div style={{ color: '#7a6030' }}>- Synthesized sound effects throughout</div>
                      <div style={{ color: '#7a6030' }}>- HP/mana bars with numeric values</div>
                      <div style={{ color: '#7a6030' }}>- Tier-colored unit card glows (W/G/B/P/Gold)</div>
                      <div style={{ color: '#7a6030' }}>- SVG portraits for all 22 units</div>
                      <div style={{ color: '#7a6030' }}>- Ultrawide support (up to 3440px+)</div>
                      <div style={{ color: '#7a6030' }}>- CRT scanlines, phosphor, curve effects</div>
                    </div>
                  </div>
                </div>}

                {/* Bottom bar (hidden on pipboy) */}
                {(settings.uiTheme || 'tactical') !== 'default' && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 24px', borderTop: '1px solid var(--ui-border-dim)', background: 'rgba(10,6,2,0.7)' }}>
                  <span style={{ fontSize: 9, color: 'rgba(180,120,40,0.3)', letterSpacing: 2 }}>ALPHA 0.4</span>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <span style={{ fontSize: 9, color: 'rgba(180,120,40,0.25)' }}>VAULT-TEC INDUSTRIES</span>
                    <span style={{ fontSize: 9, color: 'rgba(180,120,40,0.15)' }}>|</span>
                    <a href="https://discord.com" target="_blank" rel="noopener" style={{ fontSize: 12, fontWeight: 'bold', color: 'rgba(180,120,40,0.5)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#c8942a'} onMouseLeave={e => e.currentTarget.style.color = 'rgba(180,120,40,0.5)'}>Psychede1icBear</a>
                    <span style={{ fontSize: 10, color: 'rgba(180,120,40,0.2)' }}>·</span>
                    <a href="https://discord.com" target="_blank" rel="noopener" style={{ fontSize: 12, fontWeight: 'bold', color: 'rgba(180,120,40,0.5)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#c8942a'} onMouseLeave={e => e.currentTarget.style.color = 'rgba(180,120,40,0.5)'}>StacheNuggets</a>
                  </div>
                </div>}
              </div>
            )}

            {/* ARMORY TAB (Cosmetics) */}
            {menuTab === 'cosmetics' && (
              <div key={tabKey} className="wt-tab-content" style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(10,6,2,0.9) 0px, rgba(10,6,2,0.8) 400px, rgba(10,6,2,0.5) 700px, transparent 1000px)', pointerEvents: 'none', zIndex: 0 }} />
                {/* Left — settings */}
                <div className="wt-menu-scroll" style={{ padding: '24px 5vw', overflowY: 'auto', position: 'relative', zIndex: 1, width: 'min(600px, 45vw)' }}>
                  <div style={{ fontSize: 20, fontWeight: 'bold', color: 'var(--ui-text)', marginBottom: 12, letterSpacing: 3, textShadow: '0 0 10px var(--ui-glow)' }}>ARMORY</div>

                  {/* Sub-tabs */}
                  <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid rgba(200,148,42,0.15)' }}>
                    {[
                      { id: 'themes', label: 'THEMES' },
                      { id: 'boards', label: 'BOARDS' },
                      { id: 'effects', label: 'EFFECTS' },
                      { id: 'damage', label: 'DAMAGE' },
                    ].map(t => (
                      <button key={t.id} onClick={() => { sound.terminalTab(); setArmoryTab(t.id); }} style={{
                        padding: '8px 16px', fontSize: 11, fontWeight: 'bold', letterSpacing: 1,
                        background: armoryTab === t.id ? 'var(--ui-hover)' : 'transparent',
                        border: 'none', borderBottom: armoryTab === t.id ? '2px solid var(--ui-primary)' : '2px solid transparent',
                        color: armoryTab === t.id ? 'var(--ui-text)' : 'var(--ui-text-dim)', cursor: 'pointer', fontFamily: 'inherit',
                        transition: 'all 0.15s',
                      }}>{t.label}</button>
                    ))}
                  </div>

                  {/* UI Themes */}
                  {armoryTab === 'themes' && <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--ui-primary)', marginBottom: 10, borderBottom: '1px solid var(--ui-border-dim)', paddingBottom: 6, letterSpacing: 1 }}>UI THEME</div>
                    <div style={{ fontSize: 10, color: '#7a6030', marginBottom: 12 }}>Changes the entire game UI color scheme — menus, panels, borders, and text.</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {[
                        { id: 'tactical', name: 'Wasteland Tactical', primary: '#c8942a', secondary: '#e8c060', bg: '#1a1208', desc: 'Warm amber — the signature look', colors: ['#c8942a', '#e8c060', '#1a1208', '#7a6030'] },
                        { id: 'default', name: 'Pip-Boy', primary: '#00ff00', secondary: '#00aa00', bg: '#0a150a', desc: 'Classic Fallout terminal', colors: ['#00ff00', '#00aa00', '#0a150a', '#006600'] },
                        { id: 'vault', name: 'Vault-Tec Blue', primary: '#4488ff', secondary: '#6699cc', bg: '#0a0a1a', desc: 'Underground shelter cool blue', colors: ['#4488ff', '#6699cc', '#0a0a1a', '#334488'] },
                        { id: 'nuka', name: 'Nuka-Cola Red', primary: '#ff4444', secondary: '#ff8866', bg: '#1a0808', desc: 'Theme park crimson and fire', colors: ['#ff4444', '#ff8866', '#1a0808', '#884433'] },
                      ].map(theme => (
                        <div key={theme.id} onClick={() => { sound.terminalTab(); setSettings(s => ({ ...s, uiTheme: theme.id })); }} style={{
                          padding: 14, cursor: 'pointer',
                          background: 'rgba(10,6,2,0.5)',
                          border: `2px solid ${(settings.uiTheme || 'tactical') === theme.id ? theme.primary : '#333'}`,
                          borderRadius: 6, transition: 'all 0.2s',
                          boxShadow: (settings.uiTheme || 'tactical') === theme.id ? `0 0 16px ${theme.primary}33` : 'none',
                        }}>
                          {/* Color swatch bar */}
                          <div style={{ display: 'flex', gap: 3, marginBottom: 10 }}>
                            {theme.colors.map((c, i) => (
                              <div key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: c }} />
                            ))}
                          </div>
                          {/* Mock UI preview */}
                          <div style={{ width: '100%', height: 50, borderRadius: 4, marginBottom: 8, background: theme.bg, border: `1px solid ${theme.primary}33`, position: 'relative', overflow: 'hidden', padding: 6 }}>
                            <div style={{ width: '60%', height: 3, background: theme.primary, borderRadius: 2, marginBottom: 4, opacity: 0.6 }} />
                            <div style={{ width: '40%', height: 3, background: theme.secondary, borderRadius: 2, marginBottom: 4, opacity: 0.4 }} />
                            <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
                              {[1,2,3].map(i => <div key={i} style={{ width: 14, height: 16, borderRadius: 2, border: `1px solid ${theme.primary}44`, background: `${theme.primary}11` }} />)}
                            </div>
                          </div>
                          <div style={{ fontSize: 11, fontWeight: 'bold', color: (settings.uiTheme || 'tactical') === theme.id ? theme.primary : '#aaa' }}>{theme.name}</div>
                          <div style={{ fontSize: 9, color: '#666', marginTop: 2 }}>{theme.desc}</div>
                          {(settings.uiTheme || 'tactical') === theme.id && <div style={{ fontSize: 9, color: theme.primary, marginTop: 4, fontWeight: 'bold' }}>EQUIPPED</div>}
                        </div>
                      ))}
                    </div>
                  </div>}

                  {/* Board Skins */}
                  {armoryTab === 'boards' && <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--ui-primary)', marginBottom: 10, borderBottom: '1px solid var(--ui-border-dim)', paddingBottom: 6, letterSpacing: 1 }}>ARENA BOARDS</div>
                    <div style={{ fontSize: 10, color: '#7a6030', marginBottom: 12 }}>Changes the battlefield background and grid lines during combat.</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {[
                        { id: 'arena2', name: 'Dustbowl', image: `${BASE}/arena-2.png`, border: '#a08040' },
                        { id: 'arena1', name: 'Ruined Pit', image: `${BASE}/arena-1.png`, border: '#c85a20' },
                        { id: 'arena3', name: 'The Cage', image: `${BASE}/arena-3.png`, border: '#666688' },
                        { id: 'arena4', name: 'Fight Club', image: `${BASE}/arena-4.png`, border: '#aa6644' },
                        { id: 'arena5', name: 'Rubble Ring', image: `${BASE}/arena-5.png`, border: '#777766' },
                      ].map(skin => {
                        const isImageSkin = !!skin.image;
                        return (
                        <div key={skin.id} onClick={() => { sound.terminalTab(); setSettings(s => ({ ...s, boardSkin: skin.id })); }} style={{
                          padding: 12, textAlign: 'center', cursor: 'pointer',
                          background: 'rgba(10,6,2,0.5)',
                          border: `2px solid ${(settings.boardSkin || 'arena2') === skin.id ? '#ffd700' : '#333'}`,
                          borderRadius: 6, transition: 'all 0.2s',
                          boxShadow: (settings.boardSkin || 'arena2') === skin.id ? '0 0 16px rgba(255,215,0,0.25)' : 'none',
                        }}>
                          <div style={{ width: '100%', height: 60, borderRadius: 4, marginBottom: 8, position: 'relative', overflow: 'hidden',
                            backgroundImage: `url(${skin.image})`, backgroundSize: 'cover', backgroundPosition: 'center',
                            border: `1px solid ${skin.border}44`,
                          }} />
                          <div style={{ fontSize: 11, fontWeight: 'bold', color: (settings.boardSkin || 'arena2') === skin.id ? '#ffd700' : '#aaa' }}>{skin.name}</div>
                          {(settings.boardSkin || 'arena2') === skin.id && <div style={{ fontSize: 9, color: '#ffd700', marginTop: 4, fontWeight: 'bold' }}>EQUIPPED</div>}
                        </div>
                        );
                      })}
                    </div>
                  </div>}

                  {/* Visual Effects */}
                  {armoryTab === 'effects' && <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--ui-primary)', marginBottom: 10, borderBottom: '1px solid var(--ui-border-dim)', paddingBottom: 6, letterSpacing: 1 }}>VISUAL EFFECTS</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {[
                        { key: 'scanlines', name: 'CRT Scanlines', desc: 'Horizontal lines overlay the screen like an old CRT monitor. Adds retro atmosphere without affecting gameplay.', icon: (<svg width="20" height="20" viewBox="0 0 20 20"><rect x="2" y="3" width="16" height="12" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2"/><path d="M5 18 L15 18" stroke="currentColor" strokeWidth="1"/><path d="M4 6 L16 6 M4 9 L16 9 M4 12 L16 12" stroke="currentColor" strokeWidth="0.5" opacity="0.5"/></svg>) },
                        { key: 'phosphor', name: 'Phosphor Glow', desc: 'Subtle green glow emanates from the center of the screen during combat, simulating a terminal phosphor display.', icon: (<svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" strokeWidth="1.2"/><circle cx="10" cy="10" r="3" fill="currentColor" opacity="0.3"/><circle cx="10" cy="10" r="1" fill="currentColor"/></svg>) },
                        { key: 'crtMode', name: 'CRT Curve', desc: 'Adds barrel distortion and edge darkening to simulate a curved glass CRT screen with bloom lighting.', icon: (<svg width="20" height="20" viewBox="0 0 20 20"><path d="M3 5 Q2 10 3 15 L17 15 Q18 10 17 5 Z" fill="none" stroke="currentColor" strokeWidth="1.2"/><path d="M6 8 L14 8 M6 11 L14 11" stroke="currentColor" strokeWidth="0.5" opacity="0.4"/></svg>) },
                        { key: 'screenShake', name: 'Screen Shake', desc: 'The arena shakes on heavy hits and ability impacts. Adds impact feel to combat without affecting controls.', icon: (<svg width="20" height="20" viewBox="0 0 20 20"><path d="M3 10 L5 6 L8 14 L11 4 L14 16 L17 10" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg>) },
                        { key: 'particleFx', name: 'Combat Particles', desc: 'Spark bursts on hits, rising ash on deaths, heal wisps, and crit flashes. Disable for better performance on low-end devices.', icon: (<svg width="20" height="20" viewBox="0 0 20 20"><circle cx="6" cy="6" r="1.5" fill="currentColor"/><circle cx="14" cy="5" r="1" fill="currentColor" opacity="0.6"/><circle cx="10" cy="12" r="2" fill="currentColor" opacity="0.4"/><circle cx="15" cy="14" r="1.2" fill="currentColor" opacity="0.7"/><circle cx="4" cy="15" r="0.8" fill="currentColor" opacity="0.5"/></svg>) },
                        { key: 'abilityVfx', name: 'Ability Effects', desc: 'Flashy visual effects when units cast abilities — starbursts, energy arcs, shield bubbles, and projectile trails.', icon: (<svg width="20" height="20" viewBox="0 0 20 20"><polygon points="10,1 12,7 18,8 13,12 15,18 10,14 5,18 7,12 2,8 8,7" fill="none" stroke="currentColor" strokeWidth="1"/></svg>) },
                      ].map(fx => {
                        const val = settings[fx.key] !== undefined ? settings[fx.key] : true;
                        return (
                        <div key={fx.key} onClick={() => { sound.terminalTab(); setSettings(s => ({ ...s, [fx.key]: !(s[fx.key] !== undefined ? s[fx.key] : true) })); }} style={{
                          display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px',
                          background: val ? 'rgba(40,25,5,0.5)' : 'rgba(15,10,5,0.4)',
                          border: `1px solid ${val ? 'rgba(200,148,42,0.3)' : '#333'}`,
                          borderRadius: 4, cursor: 'pointer', transition: 'all 0.15s',
                        }}>
                          <span style={{ display: 'flex', alignItems: 'center', color: val ? 'var(--ui-primary)' : '#555' }}>{fx.icon}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 'bold', color: val ? 'var(--ui-text)' : '#777' }}>{fx.name}</div>
                            <div style={{ fontSize: 9, color: '#7a6030', lineHeight: 1.4 }}>{fx.desc}</div>
                          </div>
                          <div style={{ width: 40, height: 20, borderRadius: 10, background: val ? 'var(--ui-bg-solid)' : '#1a1208', border: `1px solid ${val ? 'var(--ui-primary)' : '#444'}`, position: 'relative', transition: 'all 0.2s', flexShrink: 0 }}>
                            <div style={{ width: 16, height: 16, borderRadius: '50%', background: val ? 'var(--ui-primary)' : '#555', position: 'absolute', top: 1, left: val ? 21 : 1, transition: 'left 0.2s', boxShadow: val ? '0 0 6px var(--ui-glow)' : 'none' }} />
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </div>}

                  {/* Damage Style */}
                  {armoryTab === 'damage' && <div>
                    <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--ui-primary)', marginBottom: 10, borderBottom: '1px solid var(--ui-border-dim)', paddingBottom: 6, letterSpacing: 1 }}>DAMAGE NUMBERS</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                      {[
                        { id: 'default', name: 'Classic', desc: 'Large yellow numbers for your hits, red for enemy hits. Crits show bigger with an exclamation mark.', preview: '-247' },
                        { id: 'minimal', name: 'Minimal', desc: 'Small clean white numbers that stay out of the way. Good for reading the battlefield clearly.', preview: '-247' },
                        { id: 'pip', name: 'Pip-Boy', desc: 'Green monochrome numbers matching the terminal aesthetic. All damage in Vault-Tec green.', preview: '-247' },
                      ].map(s => {
                        const isActive = (settings.dmgStyle || 'default') === s.id;
                        const previewColor = s.id === 'default' ? '#ffcc00' : s.id === 'minimal' ? '#ffffff' : '#00ff00';
                        const previewSize = s.id === 'minimal' ? 14 : 20;
                        return (
                        <div key={s.id} onClick={() => { sound.terminalTab(); setSettings(prev => ({ ...prev, dmgStyle: s.id })); }} style={{
                          padding: 12, textAlign: 'center', cursor: 'pointer',
                          background: isActive ? 'rgba(40,25,5,0.5)' : 'rgba(15,10,5,0.3)',
                          border: `2px solid ${isActive ? 'var(--ui-primary)' : '#333'}`,
                          borderRadius: 4, transition: 'all 0.15s',
                        }}>
                          <div style={{ fontSize: previewSize, fontWeight: 'bold', color: previewColor, textShadow: `0 0 6px ${previewColor}66`, marginBottom: 6, fontFamily: 'inherit' }}>{s.preview}</div>
                          <div style={{ fontSize: 12, fontWeight: 'bold', color: isActive ? 'var(--ui-text)' : '#777' }}>{s.name}</div>
                          <div style={{ fontSize: 9, color: 'var(--ui-text-dim)', lineHeight: 1.3, marginTop: 4 }}>{s.desc}</div>
                          {isActive && <div style={{ fontSize: 9, color: 'var(--ui-primary)', marginTop: 4, fontWeight: 'bold' }}>ACTIVE</div>}
                        </div>
                        );
                      })}
                    </div>
                  </div>}
                </div>

                {/* Spacer + Live Preview — hidden on themes tab */}
                {armoryTab !== 'themes' && <><div style={{ flex: 1 }} />
                {/* Right — Live Preview (far right) */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1, padding: '24px 40px', minWidth: 340, background: 'rgba(5,3,1,0.6)', backdropFilter: 'blur(12px)', borderLeft: '1px solid rgba(200,148,42,0.08)', margin: '12px 12px 12px 0', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: '#7a6030', letterSpacing: 2, marginBottom: 12 }}>LIVE PREVIEW</div>
                  {/* Mini battlefield preview */}
                  <div key={settings.boardSkin || 'arena2'} style={(() => {
                    const imageSkins = {
                      arena1: { image: `${BASE}/arena-1.png`, border: '#c85a20' },
                      arena2: { image: `${BASE}/arena-2.png`, border: '#a08040' },
                      arena3: { image: `${BASE}/arena-3.png`, border: '#666688' },
                      arena4: { image: `${BASE}/arena-4.png`, border: '#aa6644' },
                      arena5: { image: `${BASE}/arena-5.png`, border: '#777766' },
                    };
                    const currentSkin = settings.boardSkin || 'arena2';
                    const imgSkin = imageSkins[currentSkin] || imageSkins.arena2;
                    return {
                      width: 280, height: 200, borderRadius: 8, padding: 12, boxSizing: 'content-box',
                      backgroundImage: `url(${imgSkin.image})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      border: `2px solid ${imgSkin.border}`,
                      position: 'relative', overflow: 'hidden', flexShrink: 0, animation: 'wt-theme-swap 0.3s ease-out',
                    };
                  })()}>
                    {/* Scanlines overlay on preview */}
                    {(settings.scanlines !== false) && <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 1px, transparent 1px, transparent 3px)', pointerEvents: 'none', borderRadius: 6 }} />}
                    {/* Phosphor glow */}
                    {(settings.phosphor !== false) && <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 50%, rgba(0,255,0,0.06) 0%, transparent 50%)', pointerEvents: 'none' }} />}
                    {/* CRT curve */}
                    {settings.crtMode && <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 30px rgba(0,0,0,0.4)', borderRadius: '8%', pointerEvents: 'none' }} />}
                    {/* Screen shake indicator */}
                    {(settings.screenShake !== false) && <div style={{ position: 'absolute', top: 6, left: 6, fontSize: 7, color: 'rgba(200,148,42,0.4)', letterSpacing: 1 }}>SHAKE ON</div>}
                    {/* Ability VFX indicator */}
                    {(settings.abilityVfx !== false) && <div style={{ position: 'absolute', top: 60, left: '50%', transform: 'translateX(-50%)', width: 20, height: 20, borderRadius: '50%', border: '1px solid rgba(255,200,0,0.2)', background: 'radial-gradient(circle, rgba(255,200,0,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />}
                    {/* Animated enemy row */}
                    <div style={{ position: 'absolute', top: 20, left: 0, right: 0, display: 'flex', gap: 4, justifyContent: 'center' }}>
                      {[1,2,3,4].map(i => (
                        <div key={i} style={{
                          width: 28, height: 32, borderRadius: 3, background: 'rgba(255,0,0,0.2)', border: '1px solid rgba(255,0,0,0.3)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          animation: i === 2 ? 'wt-preview-hit 4s ease-in-out 1.5s infinite' : i === 4 ? 'wt-preview-death 8s ease-in-out 6s infinite' : 'none',
                        }}>
                          <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'rgba(255,80,80,0.3)' }} />
                        </div>
                      ))}
                    </div>
                    {/* Divider */}
                    <div style={{ position: 'absolute', top: '50%', left: '10%', right: '10%', borderTop: '1px dashed rgba(0,255,0,0.15)' }} />
                    {/* Animated player row */}
                    <div style={{ position: 'absolute', bottom: 20, left: 0, right: 0, display: 'flex', gap: 4, justifyContent: 'center' }}>
                      {[1,2,3,4,5].map(i => (
                        <div key={i} style={{
                          width: 28, height: 32, borderRadius: 3, background: 'rgba(255,200,0,0.1)', border: '1px dashed rgba(255,200,0,0.2)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          animation: i === 3 ? 'wt-preview-attack 4s ease-in-out 1s infinite' : i === 1 ? 'wt-preview-attack 4s ease-in-out 2.5s infinite' : 'none',
                        }}>
                          <div style={{ width: 16, height: 16, borderRadius: '50%', background: `rgba(${[200,100,150,80,220][i-1]},${[180,200,100,180,160][i-1]},${[60,80,200,60,40][i-1]},0.4)` }} />
                        </div>
                      ))}
                    </div>
                    {/* Animated floating damage numbers */}
                    {(() => {
                      const dmg = settings.dmgStyle || 'default';
                      const col = dmg === 'default' ? '#ffcc00' : dmg === 'minimal' ? '#ffffff' : '#00ff00';
                      const sz = dmg === 'minimal' ? 9 : 12;
                      return (<>
                        <div style={{ position: 'absolute', top: 22, left: '55%', fontSize: sz, fontWeight: 'bold', color: col, textShadow: `0 0 4px ${col}66`, animation: 'wt-preview-float-dmg 4s ease-out 1.5s infinite', pointerEvents: 'none' }}>-142</div>
                        <div style={{ position: 'absolute', top: 25, left: '35%', fontSize: sz + 2, fontWeight: 'bold', color: dmg === 'default' ? '#ff8844' : col, textShadow: `0 0 6px ${dmg === 'default' ? '#ff440066' : col + '66'}`, animation: 'wt-preview-float-dmg 4s ease-out 3s infinite', pointerEvents: 'none' }}>-289!</div>
                      </>);
                    })()}
                    {/* Animated heal sparkles */}
                    {(settings.particleFx !== false) && <>
                      <div style={{ position: 'absolute', bottom: 55, left: 80, width: 3, height: 3, borderRadius: '50%', background: '#44ff44', boxShadow: '0 0 4px #44ff44', animation: 'wt-preview-heal-spark 3s ease-out 2s infinite', pointerEvents: 'none' }} />
                      <div style={{ position: 'absolute', bottom: 52, left: 88, width: 2, height: 2, borderRadius: '50%', background: '#88ff88', boxShadow: '0 0 3px #88ff88', animation: 'wt-preview-heal-spark 3s ease-out 2.3s infinite', pointerEvents: 'none' }} />
                      <div style={{ position: 'absolute', bottom: 58, left: 75, width: 2, height: 2, borderRadius: '50%', background: '#66ff66', animation: 'wt-preview-heal-spark 3s ease-out 2.6s infinite', pointerEvents: 'none' }} />
                    </>}
                    {/* Animated ability ring */}
                    {(settings.abilityVfx !== false) && <div style={{ position: 'absolute', top: 65, left: '42%', width: 24, height: 24, borderRadius: '50%', border: '1px solid rgba(255,200,0,0.4)', animation: 'wt-preview-ability-ring 4s ease-out 1s infinite', pointerEvents: 'none' }} />}
                    {/* Animated impact sparks */}
                    {(settings.particleFx !== false) && <>
                      <div style={{ position: 'absolute', top: 28, left: '53%', width: 4, height: 2, borderRadius: 1, background: '#ffaa33', animation: 'wt-preview-float-dmg 4s ease-out 1.6s infinite', pointerEvents: 'none' }} />
                      <div style={{ position: 'absolute', top: 30, left: '57%', width: 3, height: 1.5, borderRadius: 1, background: '#ffcc66', animation: 'wt-preview-float-dmg 4s ease-out 1.7s infinite', pointerEvents: 'none' }} />
                    </>}
                  </div>
                  {/* Current loadout */}
                  <div style={{ marginTop: 16, fontSize: 10, color: '#7a6030', textAlign: 'center', lineHeight: 1.8 }}>
                    <div>Board: <span style={{ color: '#a08040' }}>{(settings.boardSkin || 'arena2').charAt(0).toUpperCase() + (settings.boardSkin || 'arena2').slice(1)}</span></div>
                    <div>Damage: <span style={{ color: '#a08040' }}>{(settings.dmgStyle || 'default').charAt(0).toUpperCase() + (settings.dmgStyle || 'default').slice(1)}</span></div>
                    <div>Effects: <span style={{ color: '#a08040' }}>{[
                      settings.scanlines !== false && 'Scanlines',
                      settings.phosphor !== false && 'Phosphor',
                      settings.crtMode && 'CRT',
                      settings.screenShake !== false && 'Shake',
                      settings.particleFx !== false && 'Particles',
                      settings.abilityVfx !== false && 'Abilities',
                    ].filter(Boolean).join(', ') || 'None'}</span></div>
                  </div>
                </div>
                </>}
              </div>
            )}

            {/* SHOP TAB */}
            {menuTab === 'shop' && (() => {
              const SHOP_ITEMS = [
                { id: 'board_brotherhood', name: 'Brotherhood Citadel', desc: 'Steel fortress interior with riveted panels', category: 'boards', rarity: 'Rare', price: 200, currency: 'caps', color: '#6688aa', colors: ['#1a2030', '#0a1018', '#060a10'] },
                { id: 'board_institute', name: 'Institute Labs', desc: 'Clean white synth research facility', category: 'boards', rarity: 'Rare', price: 200, currency: 'caps', color: '#aabbcc', colors: ['#1a1a22', '#10101a', '#0a0a12'] },
                { id: 'board_glowing', name: 'Glowing Sea', desc: 'Radioactive green hellscape', category: 'boards', rarity: 'Epic', price: 50, currency: 'crystals', color: '#44ff44', colors: ['#0a1a0a', '#061006', '#040a04'] },
                { id: 'board_diamond', name: 'Diamond City', desc: 'Warm stadium lights and steel walls', category: 'boards', rarity: 'Common', price: 100, currency: 'caps', color: '#cc8844', colors: ['#1a1408', '#100c04', '#0a0804'] },
                { id: 'border_holo', name: 'Holographic', desc: 'Shimmering iridescent card border', category: 'borders', rarity: 'Rare', price: 150, currency: 'caps', color: '#88ddff' },
                { id: 'border_pa', name: 'Power Armor', desc: 'Heavy steel plated border', category: 'borders', rarity: 'Epic', price: 300, currency: 'caps', color: '#8899aa' },
                { id: 'border_nuka', name: 'Nuka-Cola', desc: 'Classic red Nuka branding', category: 'borders', rarity: 'Common', price: 150, currency: 'caps', color: '#44ccff' },
                { id: 'border_quantum', name: 'Quantum', desc: 'Glowing blue quantum energy', category: 'borders', rarity: 'Legendary', price: 75, currency: 'crystals', color: '#44aaff' },
                { id: 'border_vault', name: 'Vault-Tec Gold', desc: 'Premium Vault-Tec executive trim', category: 'borders', rarity: 'Legendary', price: 100, currency: 'crystals', color: '#ffd700' },
                { id: 'bundle_starter', name: 'Wasteland Starter Bundle', desc: 'Nuka-World Board + 500 Caps + Vault Boy Border', category: 'bundles', rarity: 'Epic', price: 4.99, currency: 'usd', color: '#c8942a' },
                { id: 'bundle_premium', name: 'Overseer Premium Pack', desc: 'All Board Themes + All Borders + 1000 Crystals', category: 'bundles', rarity: 'Legendary', price: 14.99, currency: 'usd', color: '#ffd700' },
              ];
              const RARITY_COLORS = { Common: '#cccccc', Rare: '#4488ff', Epic: '#cc44ff', Legendary: '#ffd700' };
              const filteredItems = shopTab === 'featured' ? SHOP_ITEMS.filter(i => i.rarity === 'Legendary' || i.rarity === 'Epic' || i.category === 'bundles') : SHOP_ITEMS.filter(i => i.category === shopTab);
              return (
              <div key={tabKey} className="wt-menu-scroll wt-tab-content" style={{ flex: 1, padding: '24px 5vw', overflowY: 'auto', position: 'relative' }}>
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(10,6,2,0.9) 0px, rgba(10,6,2,0.8) 400px, rgba(10,6,2,0.5) 700px, transparent 1000px)', pointerEvents: 'none' }} />
                <div style={{ maxWidth: 900, position: 'relative', zIndex: 1 }}>
                  {/* Header + Currency */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div>
                      <div style={{ fontSize: 22, fontWeight: 'bold', color: 'var(--ui-text)', letterSpacing: 3, textShadow: '0 0 10px var(--ui-glow)' }}>SHOP</div>
                      <div style={{ fontSize: 11, color: '#7a6030', marginTop: 4 }}>Exclusive cosmetics and upgrades</div>
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <div style={{ padding: '8px 16px', background: 'rgba(10,6,2,0.7)', border: '1px solid rgba(200,148,42,0.3)', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {CAPS_IMG ? <img src={CAPS_IMG} alt="" style={{ width: 18, height: 18 }} /> : <span style={{ fontSize: 16, color: '#e8c060' }}>C</span>}
                        <div style={{ fontSize: 16, fontWeight: 'bold', color: '#e8c060' }}>{playerCaps}</div>
                        <button onClick={() => setCurrencyPopup(true)} style={{ marginLeft: 4, width: 20, height: 20, borderRadius: '50%', background: 'rgba(200,148,42,0.2)', border: '1px solid rgba(200,148,42,0.4)', color: '#c8942a', fontSize: 14, fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit', padding: 0, lineHeight: 1 }}>+</button>
                      </div>
                      <div style={{ padding: '8px 16px', background: 'rgba(10,6,2,0.7)', border: '1px solid rgba(68,204,255,0.3)', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <img src={`${BASE}/nuka-cola.webp`} alt="Nuka-Cola" style={{ width: 20, height: 20, objectFit: 'contain' }} />
                        <div style={{ fontSize: 16, fontWeight: 'bold', color: '#44ccff' }}>{playerCrystals}</div>
                        <button onClick={() => setCurrencyPopup(true)} style={{ marginLeft: 4, width: 20, height: 20, borderRadius: '50%', background: 'rgba(255,60,30,0.2)', border: '1px solid rgba(68,204,255,0.4)', color: '#44ccff', fontSize: 14, fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit', padding: 0, lineHeight: 1 }}>+</button>
                      </div>
                    </div>
                  </div>

                  {/* Sub-tabs */}
                  <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid rgba(200,148,42,0.15)', paddingBottom: 0 }}>
                    {[
                      { id: 'featured', label: 'FEATURED' },
                      { id: 'boards', label: 'BOARDS' },
                      { id: 'borders', label: 'BORDERS' },
                      { id: 'bundles', label: 'BUNDLES' },
                    ].map(t => (
                      <button key={t.id} onClick={() => { sound.terminalTab(); setShopTab(t.id); }} style={{
                        padding: '8px 16px', fontSize: 11, fontWeight: 'bold', letterSpacing: 1,
                        background: shopTab === t.id ? 'var(--ui-hover)' : 'transparent',
                        border: 'none', borderBottom: shopTab === t.id ? '2px solid var(--ui-primary)' : '2px solid transparent',
                        color: shopTab === t.id ? 'var(--ui-text)' : 'var(--ui-text-dim)', cursor: 'pointer', fontFamily: 'inherit',
                        transition: 'all 0.15s',
                      }}>{t.label}</button>
                    ))}
                  </div>

                  {/* Items grid */}
                  {filteredItems.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: shopTab === 'bundles' ? '1fr' : shopTab === 'featured' ? 'repeat(auto-fill, minmax(220px, 1fr))' : 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                      {filteredItems.map(item => {
                        const owned = ownedItems.includes(item.id);
                        const canAfford = item.currency === 'usd' || (item.currency === 'crystals' ? playerCrystals >= item.price : playerCaps >= item.price);
                        const rarityColor = RARITY_COLORS[item.rarity];
                        return shopTab === 'bundles' || item.category === 'bundles' ? (
                          /* Bundle card — wide */
                          <div key={item.id} style={{ padding: 16, background: `linear-gradient(135deg, rgba(40,25,5,0.6) 0%, rgba(20,10,2,0.6) 100%)`, border: `1px solid ${rarityColor}33`, borderRadius: 8, display: 'flex', gap: 16, alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${rarityColor}66, transparent)`, animation: 'wt-shop-shimmer 3s linear infinite', backgroundSize: '200% 100%' }} />
                            <div style={{ width: 80, height: 80, background: `radial-gradient(circle, ${rarityColor}22 0%, rgba(10,6,2,0.4) 70%)`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${rarityColor}22`, flexShrink: 0 }}>
                              <svg width="36" height="36" viewBox="0 0 20 20"><rect x="2" y="4" width="16" height="12" rx="2" fill="none" stroke={rarityColor} strokeWidth="1"/><path d="M6 4 L6 2 L14 2 L14 4" fill="none" stroke={rarityColor} strokeWidth="1"/><path d="M8 8 L12 8 M10 6 L10 10" stroke={rarityColor} strokeWidth="1"/></svg>
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                                <span style={{ fontSize: 8, padding: '1px 6px', borderRadius: 2, background: `${rarityColor}22`, border: `1px solid ${rarityColor}44`, color: rarityColor, fontWeight: 'bold', letterSpacing: 1, animation: 'wt-shop-badge-pulse 2s ease-in-out infinite' }}>{item.rarity.toUpperCase()}</span>
                                {item.currency === 'usd' && <span style={{ fontSize: 8, padding: '1px 6px', borderRadius: 2, background: 'rgba(255,50,50,0.15)', border: '1px solid rgba(255,50,50,0.3)', color: '#ff6644', letterSpacing: 1 }}>LIMITED</span>}
                              </div>
                              <div style={{ fontSize: 16, fontWeight: 'bold', color: 'var(--ui-text)', marginBottom: 4 }}>{item.name}</div>
                              <div style={{ fontSize: 10, color: 'var(--ui-text-dim)', marginBottom: 8 }}>{item.desc}</div>
                              {owned ? (
                                <div style={{ fontSize: 11, fontWeight: 'bold', color: '#44aa44' }}>OWNED</div>
                              ) : (
                                <button onClick={() => { sound.terminalTab(); buyShopItem(item); }} style={{ padding: '6px 20px', fontSize: 12, fontWeight: 'bold', background: canAfford ? 'linear-gradient(180deg, rgba(180,120,30,0.9) 0%, rgba(100,65,15,0.9) 100%)' : 'rgba(30,20,10,0.5)', border: `1px solid ${canAfford ? '#c8942a' : '#444'}`, borderRadius: 4, color: canAfford ? '#fff8e0' : '#666', cursor: canAfford ? 'pointer' : 'not-allowed', fontFamily: 'inherit', letterSpacing: 1 }}>{item.currency === 'usd' ? `$${item.price}` : `${item.price} ${item.currency === 'crystals' ? 'NC' : 'C'}`}</button>
                              )}
                            </div>
                          </div>
                        ) : (
                          /* Standard item card */
                          <div key={item.id} style={{ padding: 14, background: 'rgba(10,6,2,0.6)', border: `1px solid ${rarityColor}22`, borderRadius: 6, textAlign: 'center', position: 'relative', opacity: owned ? 0.6 : 1 }}>
                            {/* Rarity badge */}
                            <div style={{ position: 'absolute', top: 6, right: 6, fontSize: 7, padding: '1px 5px', borderRadius: 2, background: `${rarityColor}22`, border: `1px solid ${rarityColor}33`, color: rarityColor, fontWeight: 'bold', letterSpacing: 1 }}>{item.rarity.toUpperCase()}</div>
                            {/* Preview */}
                            {item.category === 'boards' ? (
                              <div style={{ width: '100%', height: 60, background: `radial-gradient(ellipse at 50% 60%, ${item.colors[0]} 0%, ${item.colors[1]} 40%, ${item.colors[2]} 100%)`, borderRadius: 4, marginBottom: 8, border: `1px solid ${item.color}22`, position: 'relative', overflow: 'hidden' }}>
                                <div style={{ position: 'absolute', inset: 0, background: `repeating-linear-gradient(0deg, transparent, transparent 9px, ${item.color}08 9px, ${item.color}08 10px), repeating-linear-gradient(90deg, transparent, transparent 9px, ${item.color}08 9px, ${item.color}08 10px)` }} />
                              </div>
                            ) : (
                              <div style={{ width: 44, height: 56, margin: '0 auto 8px', border: `2px solid ${item.color}`, borderRadius: 4, background: 'rgba(0,0,0,0.3)', boxShadow: `0 0 8px ${item.color}33, inset 0 0 6px ${item.color}11` }} />
                            )}
                            <div style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--ui-text)', marginBottom: 2 }}>{item.name}</div>
                            <div style={{ fontSize: 9, color: 'var(--ui-text-dim)', marginBottom: 8, lineHeight: 1.3 }}>{item.desc}</div>
                            {owned ? (
                              <div style={{ fontSize: 10, fontWeight: 'bold', color: '#44aa44', padding: '4px 0' }}>OWNED</div>
                            ) : (
                              <button onClick={() => { sound.terminalTab(); buyShopItem(item); }} style={{ padding: '4px 14px', fontSize: 10, background: canAfford ? 'rgba(40,25,5,0.7)' : 'rgba(20,10,5,0.4)', border: `1px solid ${canAfford ? (item.currency === 'crystals' ? '#44ccff' : '#c8942a') : '#333'}`, borderRadius: 3, color: canAfford ? (item.currency === 'crystals' ? '#44ccff' : '#e8c060') : '#555', cursor: canAfford ? 'pointer' : 'not-allowed', fontFamily: 'inherit', transition: 'all 0.15s' }}>{item.price} {item.currency === 'crystals' ? 'NC' : 'C'}</button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Currency popup removed from here — now a modal */}
                </div>
              </div>
              );
            })()}

            {/* Currency purchase popup */}
            {currencyPopup && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={() => setCurrencyPopup(false)}>
                <div onClick={e => e.stopPropagation()} style={{ background: 'linear-gradient(180deg, rgba(30,18,5,0.98) 0%, rgba(15,8,2,0.98) 100%)', border: '2px solid var(--ui-primary)', borderRadius: 8, padding: 28, maxWidth: 500, boxShadow: '0 0 40px var(--ui-glow)' }}>
                  <div style={{ fontSize: 18, fontWeight: 'bold', color: 'var(--ui-text)', marginBottom: 16, letterSpacing: 2 }}>GET CURRENCY</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    {[
                      { caps: 500, crystals: 0, price: '$0.99', bonus: '' },
                      { caps: 1200, crystals: 25, price: '$2.99', bonus: 'POPULAR' },
                      { caps: 3000, crystals: 100, price: '$6.99', bonus: 'BEST VALUE' },
                      { caps: 0, crystals: 50, price: '$1.99', bonus: '' },
                      { caps: 0, crystals: 200, price: '$4.99', bonus: 'POPULAR' },
                      { caps: 0, crystals: 500, price: '$9.99', bonus: 'BEST VALUE' },
                    ].map((pack, i) => (
                      <div key={i} style={{ padding: 14, background: 'rgba(10,6,2,0.6)', border: `1px solid ${pack.crystals > 0 && pack.caps === 0 ? 'rgba(68,204,255,0.2)' : 'rgba(200,148,42,0.2)'}`, borderRadius: 6, textAlign: 'center', position: 'relative' }}>
                        {pack.bonus && <div style={{ position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)', padding: '2px 8px', background: pack.bonus === 'BEST VALUE' ? 'rgba(180,120,30,0.9)' : 'rgba(100,65,15,0.8)', border: '1px solid #c8942a', borderRadius: 3, fontSize: 7, fontWeight: 'bold', color: '#fff8e0', letterSpacing: 1, whiteSpace: 'nowrap' }}>{pack.bonus}</div>}
                        {pack.caps > 0 && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 2 }}><span style={{ fontSize: 20, fontWeight: 'bold', color: '#e8c060' }}>{pack.caps}</span>{CAPS_IMG ? <img src={CAPS_IMG} alt="" style={{ width: 16, height: 16 }} /> : <span style={{ color: '#e8c060' }}>C</span>}</div>}
                        {pack.crystals > 0 && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 2 }}>{pack.caps > 0 && <span style={{ color: '#888', fontSize: 11 }}>+</span>}<span style={{ fontSize: pack.caps > 0 ? 13 : 20, fontWeight: 'bold', color: '#44ccff' }}>{pack.crystals}</span><img src={`${BASE}/nuka-cola.webp`} alt="" style={{ width: 14, height: 14, objectFit: 'contain' }} /></div>}
                        <button onClick={() => { sound.purchaseCurrency(); setPlayerCaps(c => { const v = c + pack.caps; localStorage.setItem('wt_caps', v); return v; }); setPlayerCrystals(c => { const v = c + pack.crystals; localStorage.setItem('wt_crystals', v); return v; }); setCurrencyPopup(false); }} style={{ padding: '5px 18px', fontSize: 11, fontWeight: 'bold', background: 'linear-gradient(180deg, rgba(180,120,30,0.9) 0%, rgba(100,65,15,0.9) 100%)', border: '1px solid #c8942a', borderRadius: 4, color: '#fff8e0', cursor: 'pointer', fontFamily: 'inherit', letterSpacing: 1, marginTop: 6 }}>{pack.price}</button>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setCurrencyPopup(false)} style={{ marginTop: 16, width: '100%', padding: '8px', fontSize: 11, background: 'rgba(40,20,5,0.6)', border: '1px solid #664422', borderRadius: 4, color: '#aa8844', cursor: 'pointer', fontFamily: 'inherit' }}>CLOSE</button>
                </div>
              </div>
            )}

            {/* Purchase confetti */}
            {purchaseAnim && (
              <div style={{ position: 'fixed', inset: 0, zIndex: 200, pointerEvents: 'none' }}>
                {/* Center burst */}
                <div style={{ position: 'absolute', left: purchaseAnim.x, top: purchaseAnim.y, width: 60, height: 60, borderRadius: '50%', background: 'radial-gradient(circle, rgba(200,148,42,0.3) 0%, transparent 70%)', animation: 'wt-confetti-pop 0.8s ease-out forwards' }} />
                {/* Particles */}
                {[...Array(16)].map((_, i) => {
                  const angle = (Math.PI * 2 * i) / 16;
                  const dist = 60 + Math.random() * 80;
                  const dx = Math.cos(angle) * dist;
                  const dy = Math.sin(angle) * dist - 20;
                  const colors = ['#c8942a', '#e8c060', '#ffd700', '#ff8844', '#44ccff', '#ff4444'];
                  return <div key={i} style={{
                    position: 'absolute', left: purchaseAnim.x, top: purchaseAnim.y,
                    width: 4 + Math.random() * 4, height: 3 + Math.random() * 3,
                    background: colors[i % colors.length], borderRadius: 1,
                    animation: `wt-confetti-particle ${0.6 + Math.random() * 0.4}s ease-out forwards`,
                    transform: `translate(${dx}px, ${dy}px) rotate(${Math.random() * 360}deg)`,
                  }} />;
                })}
              </div>
            )}

            {/* Purchase confirmation modal */}
            {shopConfirm && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={() => setShopConfirm(null)}>
                <div onClick={e => e.stopPropagation()} style={{ background: 'linear-gradient(180deg, rgba(30,18,5,0.98) 0%, rgba(15,8,2,0.98) 100%)', border: '2px solid var(--ui-primary)', borderRadius: 8, padding: 28, textAlign: 'center', maxWidth: 340, boxShadow: '0 0 40px var(--ui-glow)' }}>
                  <div style={{ fontSize: 16, fontWeight: 'bold', color: 'var(--ui-text)', marginBottom: 8 }}>CONFIRM PURCHASE</div>
                  <div style={{ fontSize: 13, color: 'var(--ui-text-dim)', marginBottom: 4 }}>{shopConfirm.name}</div>
                  <div style={{ fontSize: 10, color: '#7a6030', marginBottom: 16 }}>{shopConfirm.desc}</div>
                  <div style={{ fontSize: 18, fontWeight: 'bold', color: shopConfirm.currency === 'crystals' ? '#44ccff' : '#e8c060', marginBottom: 16 }}>{shopConfirm.price} {shopConfirm.currency === 'crystals' ? 'Nuka-Cola' : shopConfirm.currency === 'usd' ? '' : 'Bottle Caps'}</div>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                    <button onClick={() => setShopConfirm(null)} style={{ padding: '8px 20px', fontSize: 12, background: 'rgba(40,20,5,0.6)', border: '1px solid #664422', borderRadius: 4, color: '#aa8844', cursor: 'pointer', fontFamily: 'inherit' }}>CANCEL</button>
                    <button onClick={confirmPurchase} style={{ padding: '8px 24px', fontSize: 12, fontWeight: 'bold', background: 'linear-gradient(180deg, rgba(180,120,30,0.9) 0%, rgba(100,65,15,0.9) 100%)', border: '1px solid #c8942a', borderRadius: 4, color: '#fff8e0', cursor: 'pointer', fontFamily: 'inherit', letterSpacing: 1 }}>BUY NOW</button>
                  </div>
                </div>
              </div>
            )}

            {/* SETTINGS TAB */}
            {menuTab === 'settings' && (
              <div key={tabKey} className="wt-menu-scroll wt-tab-content" style={{ flex: 1, padding: '24px 5vw', overflowY: 'auto', position: 'relative' }}>
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(10,6,2,0.9) 0px, rgba(10,6,2,0.8) 400px, rgba(10,6,2,0.5) 700px, transparent 1000px)', pointerEvents: 'none' }} />
                <div style={{ maxWidth: 'min(550px, 45vw)', position: 'relative', zIndex: 1 }}>
                  <div style={{ fontSize: 20, fontWeight: 'bold', color: 'var(--ui-text)', marginBottom: 20, letterSpacing: 3, textShadow: '0 0 10px var(--ui-glow)' }}>SETTINGS</div>

                  {/* Audio */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--ui-primary)', marginBottom: 10, borderBottom: '1px solid var(--ui-border-dim)', paddingBottom: 4, letterSpacing: 1 }}>AUDIO</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, background: 'rgba(20,12,5,0.5)', border: '1px solid rgba(200,148,42,0.15)', borderRadius: 6, padding: 16 }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <label style={{ fontSize: 11, color: '#a08040' }}>Master Volume</label>
                          <span style={{ fontSize: 11, color: '#e8c060', fontWeight: 'bold' }}>{settings.volume}%</span>
                        </div>
                        <input type="range" min="0" max="100" value={settings.volume} onChange={e => setSettings(s => ({ ...s, volume: +e.target.value }))} style={{ width: '100%', accentColor: '#c8942a' }} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <label style={{ fontSize: 11, color: '#a08040' }}>Music Volume</label>
                          <span style={{ fontSize: 11, color: '#e8c060', fontWeight: 'bold' }}>{settings.musicVolume ?? 80}%</span>
                        </div>
                        <input type="range" min="0" max="100" value={settings.musicVolume ?? 80} onChange={e => setSettings(s => ({ ...s, musicVolume: +e.target.value }))} style={{ width: '100%', accentColor: '#c8942a' }} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <label style={{ fontSize: 11, color: '#a08040' }}>SFX Volume</label>
                          <span style={{ fontSize: 11, color: '#e8c060', fontWeight: 'bold' }}>{settings.sfxVolume ?? 80}%</span>
                        </div>
                        <input type="range" min="0" max="100" value={settings.sfxVolume ?? 80} onChange={e => setSettings(s => ({ ...s, sfxVolume: +e.target.value }))} style={{ width: '100%', accentColor: '#c8942a' }} />
                      </div>
                    </div>
                  </div>

                  {/* Gameplay */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--ui-primary)', marginBottom: 10, borderBottom: '1px solid var(--ui-border-dim)', paddingBottom: 4, letterSpacing: 1 }}>GAMEPLAY</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, background: 'rgba(20,12,5,0.5)', border: '1px solid rgba(200,148,42,0.15)', borderRadius: 6, padding: 16 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, marginBottom: 6, color: '#a08040' }}>Animation Speed</label>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {[{ v: 0.5, l: '0.5x' }, { v: 1, l: '1x' }, { v: 1.5, l: '1.5x' }, { v: 2, l: '2x' }, { v: 3, l: '3x' }].map(opt => (
                            <button key={opt.v} onClick={() => { sound.terminalTab(); setSettings(s => ({ ...s, animationSpeed: opt.v })); }} style={{
                              flex: 1, padding: '7px 0', fontSize: 11, fontWeight: 'bold',
                              background: settings.animationSpeed === opt.v ? 'rgba(60,40,10,0.6)' : 'rgba(15,10,5,0.4)',
                              border: `1px solid ${settings.animationSpeed === opt.v ? 'var(--ui-primary)' : '#444'}`,
                              borderRadius: 4, color: settings.animationSpeed === opt.v ? 'var(--ui-text)' : '#888',
                              cursor: 'pointer', fontFamily: 'inherit',
                            }}>{opt.l}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, marginBottom: 6, color: '#a08040' }}>Prep Timer (seconds)</label>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {[{ v: 15, l: '15s' }, { v: 30, l: '30s' }, { v: 45, l: '45s' }, { v: 60, l: '60s' }].map(opt => (
                            <button key={opt.v} onClick={() => { sound.terminalTab(); setSettings(s => ({ ...s, prepTimer: opt.v })); }} style={{
                              flex: 1, padding: '7px 0', fontSize: 11, fontWeight: 'bold',
                              background: (settings.prepTimer || 30) === opt.v ? 'rgba(60,40,10,0.6)' : 'rgba(15,10,5,0.4)',
                              border: `1px solid ${(settings.prepTimer || 30) === opt.v ? 'var(--ui-primary)' : '#444'}`,
                              borderRadius: 4, color: (settings.prepTimer || 30) === opt.v ? 'var(--ui-text)' : '#888',
                              cursor: 'pointer', fontFamily: 'inherit',
                            }}>{opt.l}</button>
                          ))}
                        </div>
                      </div>
                      <div onClick={() => { sound.terminalTab(); setSettings(s => ({ ...s, autoFight: !s.autoFight })); }} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', cursor: 'pointer',
                      }}>
                        <div>
                          <div style={{ fontSize: 11, color: '#a08040' }}>Auto-Fight</div>
                          <div style={{ fontSize: 9, color: '#666' }}>Automatically start combat when timer runs out (already default — this skips the button)</div>
                        </div>
                        <div style={{ width: 40, height: 20, borderRadius: 10, background: settings.autoFight ? 'var(--ui-bg-solid)' : '#1a1208', border: `1px solid ${settings.autoFight ? 'var(--ui-primary)' : '#444'}`, position: 'relative', transition: 'all 0.2s', flexShrink: 0, marginLeft: 12 }}>
                          <div style={{ width: 16, height: 16, borderRadius: '50%', background: settings.autoFight ? 'var(--ui-primary)' : '#555', position: 'absolute', top: 1, left: settings.autoFight ? 21 : 1, transition: 'left 0.2s', boxShadow: settings.autoFight ? '0 0 6px var(--ui-glow)' : 'none' }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Display */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--ui-primary)', marginBottom: 10, borderBottom: '1px solid var(--ui-border-dim)', paddingBottom: 4, letterSpacing: 1 }}>DISPLAY</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, background: 'rgba(20,12,5,0.5)', border: '1px solid rgba(200,148,42,0.15)', borderRadius: 6, padding: 16 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, marginBottom: 6, color: '#a08040' }}>Font Size</label>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {[{ v: 'small', l: 'Small', size: '12px' }, { v: 'medium', l: 'Default', size: '14px' }, { v: 'large', l: 'Large', size: '16px' }].map(opt => (
                            <button key={opt.v} onClick={() => { sound.terminalTab(); setSettings(s => ({ ...s, fontSize: opt.v })); }} style={{
                              flex: 1, padding: '7px 0', fontSize: 11, fontWeight: 'bold',
                              background: (settings.fontSize || 'medium') === opt.v ? 'rgba(60,40,10,0.6)' : 'rgba(15,10,5,0.4)',
                              border: `1px solid ${(settings.fontSize || 'medium') === opt.v ? 'var(--ui-primary)' : '#444'}`,
                              borderRadius: 4, color: (settings.fontSize || 'medium') === opt.v ? 'var(--ui-text)' : '#888',
                              cursor: 'pointer', fontFamily: 'inherit',
                            }}>{opt.l}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Data */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--ui-primary)', marginBottom: 10, borderBottom: '1px solid var(--ui-border-dim)', paddingBottom: 4, letterSpacing: 1 }}>DATA</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(20,12,5,0.5)', border: '1px solid rgba(200,148,42,0.15)', borderRadius: 6, padding: 16 }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => { sound.terminalTab(); try { const data = JSON.stringify({ settings, save: localStorage.getItem('wt_save') }); navigator.clipboard.writeText(data); } catch(e){} }} style={{
                          flex: 1, padding: '8px', fontSize: 11, background: 'rgba(40,25,5,0.5)', border: '1px solid #c8942a', borderRadius: 4, color: '#e8c060', cursor: 'pointer', fontFamily: 'inherit',
                        }}>EXPORT SAVE</button>
                        <button onClick={() => { sound.terminalTab(); try { const data = prompt('Paste exported save data:'); if (data) { const parsed = JSON.parse(data); if (parsed.save) localStorage.setItem('wt_save', parsed.save); if (parsed.settings) { localStorage.setItem('wt_settings', JSON.stringify(parsed.settings)); setSettings(s => ({ ...s, ...parsed.settings })); } setHasSave(!!parsed.save); } } catch(e) { alert('Invalid save data'); } }} style={{
                          flex: 1, padding: '8px', fontSize: 11, background: 'rgba(40,25,5,0.5)', border: '1px solid #c8942a', borderRadius: 4, color: '#e8c060', cursor: 'pointer', fontFamily: 'inherit',
                        }}>IMPORT SAVE</button>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => { sound.terminalTab(); if (confirm('Reset shop purchases only? Game saves will be kept.')) { localStorage.removeItem('wt_caps'); localStorage.removeItem('wt_crystals'); localStorage.removeItem('wt_owned'); setPlayerCaps(0); setPlayerCrystals(0); setOwnedItems([]); } }} style={{
                          flex: 1, padding: '8px', fontSize: 11, background: 'rgba(60,30,5,0.4)', border: '1px solid #aa6622', borderRadius: 4, color: '#cc8844', cursor: 'pointer', fontFamily: 'inherit',
                        }}>RESET SHOP ONLY</button>
                        <button onClick={() => { sound.terminalTab(); if (confirm('This will delete ALL saved data including purchases. Are you sure?')) { localStorage.removeItem('wt_save'); localStorage.removeItem('wt_settings'); localStorage.removeItem('wt_tutorial_seen'); localStorage.removeItem('wt_caps'); localStorage.removeItem('wt_crystals'); localStorage.removeItem('wt_owned'); setHasSave(false); setPlayerCaps(0); setPlayerCrystals(0); setOwnedItems([]); } }} style={{
                          flex: 1, padding: '8px', fontSize: 11, background: 'rgba(60,10,5,0.4)', border: '1px solid #aa4422', borderRadius: 4, color: '#ff6644', cursor: 'pointer', fontFamily: 'inherit',
                        }}>RESET ALL DATA</button>
                      </div>
                      <button onClick={() => { sound.terminalTab(); setShowTutorial(true); setTutorialStep(0); }} style={{
                        width: '100%', padding: '8px', fontSize: 11,
                        background: 'rgba(20,15,40,0.4)', border: '1px solid #6666aa', borderRadius: 4,
                        color: '#aaaaff', cursor: 'pointer', fontFamily: 'inherit',
                      }}>REPLAY TUTORIAL</button>
                    </div>
                  </div>

                  {/* Language */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--ui-primary)', marginBottom: 10, borderBottom: '1px solid var(--ui-border-dim)', paddingBottom: 4, letterSpacing: 1 }}>LANGUAGE</div>
                    <div style={{ background: 'rgba(20,12,5,0.5)', border: '1px solid rgba(200,148,42,0.15)', borderRadius: 6, padding: 16 }}>
                      <select value={settings.language || 'en'} onChange={e => { sound.terminalTab(); setSettings(s => ({ ...s, language: e.target.value })); }} style={{ width: '100%', padding: '8px 12px', background: 'rgba(15,10,5,0.6)', border: '1px solid rgba(200,148,42,0.3)', borderRadius: 4, color: '#e8c060', fontFamily: 'inherit', fontSize: 12, cursor: 'pointer', appearance: 'none', backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath d=\'M2 4 L6 8 L10 4\' fill=\'none\' stroke=\'%23c8942a\' stroke-width=\'1.5\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}>
                        <option value="en" style={{ background: '#1a1208', color: '#e8c060' }}>English</option>
                        <option value="es" style={{ background: '#1a1208', color: '#e8c060' }} disabled>Español (Coming Soon)</option>
                        <option value="fr" style={{ background: '#1a1208', color: '#e8c060' }} disabled>Français (Coming Soon)</option>
                        <option value="de" style={{ background: '#1a1208', color: '#e8c060' }} disabled>Deutsch (Coming Soon)</option>
                        <option value="ja" style={{ background: '#1a1208', color: '#e8c060' }} disabled>日本語 (Coming Soon)</option>
                      </select>
                    </div>
                  </div>

                  {/* Keybinds */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--ui-primary)', marginBottom: 10, borderBottom: '1px solid var(--ui-border-dim)', paddingBottom: 4, letterSpacing: 1 }}>KEYBINDS</div>
                    <div style={{ background: 'rgba(20,12,5,0.5)', border: '1px solid rgba(200,148,42,0.15)', borderRadius: 6, padding: 16 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: '8px 12px', fontSize: 10 }}>
                        {[
                          { action: 'Start Combat', key: settings.keybinds?.fight || 'Space', id: 'fight' },
                          { action: 'Refresh Shop', key: settings.keybinds?.refresh || 'D', id: 'refresh' },
                          { action: 'Buy XP', key: settings.keybinds?.buyxp || 'F', id: 'buyxp' },
                          { action: 'Toggle Terminal', key: settings.keybinds?.terminal || 'Tab', id: 'terminal' },
                        ].map(bind => (
                          <React.Fragment key={bind.id}>
                            <div style={{ color: '#a08040', display: 'flex', alignItems: 'center' }}>{bind.action}</div>
                            <button onClick={() => {
                              sound.terminalTab();
                              const handler = (e) => {
                                e.preventDefault();
                                const keyName = e.key === ' ' ? 'Space' : e.key.length === 1 ? e.key.toUpperCase() : e.key;
                                setSettings(s => ({ ...s, keybinds: { ...(s.keybinds || {}), [bind.id]: keyName } }));
                                window.removeEventListener('keydown', handler);
                              };
                              window.addEventListener('keydown', handler, { once: true });
                            }} style={{
                              padding: '4px 8px', fontSize: 11, fontWeight: 'bold', textAlign: 'center',
                              background: 'rgba(30,18,5,0.6)', border: '1px solid rgba(200,148,42,0.3)', borderRadius: 3,
                              color: '#e8c060', cursor: 'pointer', fontFamily: 'inherit',
                              transition: 'all 0.15s',
                            }}
                            onFocus={e => { e.currentTarget.textContent = '...'; e.currentTarget.style.borderColor = '#c8942a'; }}
                            onBlur={e => { e.currentTarget.textContent = bind.key; e.currentTarget.style.borderColor = 'rgba(200,148,42,0.3)'; }}
                            >{bind.key}</button>
                          </React.Fragment>
                        ))}
                      </div>
                      <div style={{ fontSize: 8, color: '#5a4020', marginTop: 8 }}>Click a key to rebind, then press the new key</div>
                    </div>
                  </div>

                  {/* Dev Tools */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ borderTop: '1px solid #ff660033', paddingTop: 14 }}>
                      <button onClick={() => { setDevToolsActivate(true); }} style={{ width: '100%', padding: '10px 16px', fontSize: 11, fontWeight: 'bold', background: 'rgba(80,20,0,0.2)', border: '1px solid #ff6600', borderRadius: 4, color: '#ff8844', cursor: 'pointer', fontFamily: 'inherit', letterSpacing: 2, transition: 'all 0.15s' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(120,40,0,0.3)'; e.currentTarget.style.boxShadow = '0 0 12px rgba(255,102,0,0.2)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(80,20,0,0.2)'; e.currentTarget.style.boxShadow = 'none'; }}>DEV TOOLS</button>
                      <div style={{ fontSize: 8, color: '#885533', marginTop: 4, textAlign: 'center' }}>Visual element inspector — select and adjust any UI element</div>
                    </div>
                  </div>

                </div>
                {/* Controls — bottom right, left of credits */}
                <div style={{ position: 'absolute', bottom: 20, right: 370, width: 240, zIndex: 2 }}>
                  <div style={{ background: 'rgba(5,3,1,0.55)', border: '1px solid rgba(200,148,42,0.1)', borderRadius: 8, padding: 14, backdropFilter: 'blur(16px)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03), 0 4px 20px rgba(0,0,0,0.3)' }}>
                    <div style={{ fontSize: 11, color: 'var(--ui-primary)', letterSpacing: 2, marginBottom: 8, fontWeight: 'bold' }}>CONTROLS</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: '5px 10px', fontSize: 9 }}>
                      <div style={{ color: '#a08040', fontWeight: 'bold' }}>Left Click</div><div style={{ color: '#6a5030' }}>Select / buy / place units</div>
                      <div style={{ color: '#a08040', fontWeight: 'bold' }}>Right Click</div><div style={{ color: '#6a5030' }}>Unit tooltip (stats, items)</div>
                      <div style={{ color: '#a08040', fontWeight: 'bold' }}>Drag</div><div style={{ color: '#6a5030' }}>Move units on board/bench</div>
                      <div style={{ color: '#a08040', fontWeight: 'bold' }}>Drag Item</div><div style={{ color: '#6a5030' }}>Equip component onto unit</div>
                      <div style={{ color: '#a08040', fontWeight: 'bold' }}>1-0 Keys</div><div style={{ color: '#6a5030' }}>Switch Terminal tabs</div>
                    </div>
                  </div>
                </div>
                {/* Credits — bottom right */}
                <div style={{ position: 'absolute', bottom: 20, right: 70, width: 280, zIndex: 2 }}>
                  <div style={{ background: 'rgba(5,3,1,0.55)', border: '1px solid rgba(200,148,42,0.1)', borderRadius: 8, padding: 16, textAlign: 'center', backdropFilter: 'blur(16px)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03), 0 4px 20px rgba(0,0,0,0.3)' }}>
                    <div style={{ fontSize: 11, color: 'var(--ui-primary)', letterSpacing: 2, marginBottom: 8, fontWeight: 'bold' }}>CREDITS</div>
                    <div style={{ fontSize: 10, color: '#a08040', marginBottom: 6 }}>WASTELAND TACTICS — ALPHA 0.1</div>
                    <div style={{ fontSize: 10, color: '#7a6030', lineHeight: 1.8 }}>
                      <div><span style={{ color: '#8a7040' }}>Design & Development</span></div>
                      <div style={{ color: 'var(--ui-text)', fontWeight: 'bold' }}>Psychede1icBear</div>
                      <div style={{ color: 'var(--ui-text)', fontWeight: 'bold' }}>StacheNuggets</div>
                      <div style={{ marginTop: 6 }}><span style={{ color: '#8a7040' }}>Built With</span></div>
                      <div>React 18 + Vite 6</div>
                      <div style={{ marginTop: 6 }}><span style={{ color: '#8a7040' }}>Inspired By</span></div>
                      <div>Teamfight Tactics · Fallout 4</div>
                    </div>
                    <div style={{ marginTop: 8, fontSize: 8, color: '#4a3020' }}>VAULT-TEC APPROVED</div>
                  </div>
                </div>
              </div>
            )}
          </div>
          </>);
          })()}

          {/* Volume control — fixed right side */}
          <div style={{ position: 'fixed', bottom: 120, right: 16, zIndex: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            {/* Vertical volume bar — uses native range input rotated */}
            <div style={{
              width: 36, height: 120, borderRadius: 18,
              background: 'rgba(10,6,2,0.5)',
              border: '1px solid rgba(200,148,42,0.12)',
              backdropFilter: 'blur(12px)',
              position: 'relative', overflow: 'hidden',
            }}>
              {/* Fill from bottom */}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                height: `${settings.volume}%`,
                background: 'linear-gradient(0deg, rgba(200,148,42,0.35) 0%, rgba(200,148,42,0.1) 100%)',
                borderRadius: '0 0 18px 18px',
                transition: 'height 0.1s ease-out',
                boxShadow: '0 -4px 12px rgba(200,148,42,0.15), inset 0 0 8px rgba(200,148,42,0.1)',
                pointerEvents: 'none',
              }} />
              {/* Glass highlight */}
              <div style={{ position: 'absolute', top: 4, left: 6, right: 14, bottom: 4, borderRadius: 12, background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 50%)', pointerEvents: 'none' }} />
              {/* Speaker icon at bottom */}
              <div style={{ position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)', opacity: 0.4, pointerEvents: 'none' }}>
                <svg width="14" height="14" viewBox="0 0 16 16">
                  <path d="M3 6 L3 10 L6 10 L10 13 L10 3 L6 6 Z" fill="#a08040" />
                </svg>
              </div>
              {/* Volume percentage */}
              <div style={{ position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)', fontSize: 8, color: 'rgba(200,148,42,0.5)', fontWeight: 'bold', pointerEvents: 'none' }}>{settings.volume}</div>
              {/* Hidden native range input — rotated vertical, handles all interaction */}
              <input type="range" min="0" max="100" value={settings.volume}
                onChange={e => { const v = +e.target.value; setSettings(s => ({ ...s, volume: v })); if (menuMusicRef.current) menuMusicRef.current.volume = 0.3 * (v / 100) * ((settings.musicVolume ?? 80) / 100); }}
                style={{ position: 'absolute', width: 120, height: 36, top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(-90deg)', opacity: 0, cursor: 'pointer', margin: 0 }}
              />
            </div>
            {/* Restart button */}
            <button onClick={() => { if (menuMusicRef.current) { menuMusicRef.current.currentTime = 0; menuMusicRef.current.play().catch(() => {}); } }} title="Restart track" style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'rgba(10,6,2,0.5)', border: '1px solid rgba(200,148,42,0.12)',
              backdropFilter: 'blur(12px)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: 0.5, transition: 'opacity 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}
            >
              <svg width="12" height="12" viewBox="0 0 16 16">
                <path d="M8 2 A6 6 0 1 1 2 8" fill="none" stroke="#a08040" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M8 0 L8 4 L5 2 Z" fill="#a08040"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Transition overlay removed — using initial loading screen only */}

      {/* ═══ GAME UI (only when not on menu) ═══ */}
      {phase !== 'menu' && (<>

      {/* Settings panel — reworked overlay */}
      {settingsOpen && (
        <div className="wt-settings-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3100, animation: 'wt-settings-fade-in 0.25s ease-out' }} onClick={() => setSettingsOpen(false)}>
          <div className="wt-menu-scroll" style={{ background: 'linear-gradient(180deg, rgba(25,15,5,0.98) 0%, rgba(10,6,2,0.99) 50%, rgba(5,3,1,0.99) 100%)', border: '2px solid var(--ui-border)', borderRadius: 10, padding: '28px 36px', width: 560, maxWidth: '92vw', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 0 40px var(--ui-glow), 0 8px 32px rgba(0,0,0,0.6)', animation: 'wt-settings-panel-in 0.3s ease-out' }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid var(--ui-border-dim)', paddingBottom: 10 }}>
              <span style={{ fontSize: 18, fontWeight: 'bold', color: 'var(--ui-text)', letterSpacing: 3, textShadow: '0 0 10px var(--ui-glow)' }}>SETTINGS</span>
              <button onClick={() => setSettingsOpen(false)} style={{ background: 'transparent', border: '1px solid var(--ui-border-dim)', borderRadius: 4, color: 'var(--ui-primary)', cursor: 'pointer', fontSize: 14, padding: '2px 8px', fontFamily: 'inherit', transition: 'all 0.15s' }} onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--ui-primary)'; e.currentTarget.style.background = 'var(--ui-hover)'; }} onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--ui-border-dim)'; e.currentTarget.style.background = 'transparent'; }}>ESC</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* ─── AUDIO ─── */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 'bold', color: 'var(--ui-primary)', marginBottom: 10, letterSpacing: 1, borderBottom: '1px solid var(--ui-border-dim)', paddingBottom: 4 }}>AUDIO</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px' }}>
                  {[
                    { key: 'volume', label: 'Master Volume', fallback: 80, preview: null },
                    { key: 'musicVolume', label: 'Music', fallback: 80, preview: null },
                    { key: 'sfxVolume', label: 'Sound Effects', fallback: 100, preview: () => { try { sound.hit?.(); } catch(_) {} } },
                    { key: 'uiSoundVolume', label: 'UI Sounds', fallback: 80, preview: () => { try { sound.click?.(); } catch(_) {} } },
                    { key: 'ambientVolume', label: 'Ambient', fallback: 60, preview: () => { try { sound.geigerTick?.(); } catch(_) {} } },
                  ].map(s => (
                    <div key={s.key}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 3 }}>
                        <span style={{ color: 'var(--ui-text-dim)' }}>{s.label}</span>
                        <span style={{ color: 'var(--ui-text)', fontWeight: 'bold' }}>{settings[s.key] ?? s.fallback}%</span>
                      </div>
                      <input type="range" min="0" max="100" value={settings[s.key] ?? s.fallback} onChange={e => { setSettings(prev => ({ ...prev, [s.key]: +e.target.value })); if (s.preview) s.preview(); }} style={{ width: '100%', accentColor: 'var(--ui-primary)' }} />
                    </div>
                  ))}
                </div>
              </div>

              {/* ─── GAMEPLAY ─── */}
              <div style={{ borderTop: '1px solid var(--ui-border-dim)', paddingTop: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 'bold', color: 'var(--ui-primary)', marginBottom: 10, letterSpacing: 1, borderBottom: '1px solid var(--ui-border-dim)', paddingBottom: 4 }}>GAMEPLAY</div>
                <div style={{ marginBottom: 4, fontSize: 10, color: 'var(--ui-text-dim)' }}>Combat Speed</div>
                <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
                  {[{ v: 0.5, l: '0.5x' }, { v: 1, l: '1x' }, { v: 1.5, l: '1.5x' }, { v: 2, l: '2x' }, { v: 3, l: '3x' }].map(opt => (
                    <button key={opt.v} onClick={() => { sound.terminalTab(); setSettings(s => ({ ...s, animationSpeed: opt.v })); }} style={{
                      flex: 1, padding: '6px 0', fontSize: 11, fontWeight: 'bold',
                      background: settings.animationSpeed === opt.v ? 'var(--ui-hover)' : 'transparent',
                      border: `1px solid ${settings.animationSpeed === opt.v ? 'var(--ui-border)' : 'var(--ui-border-dim)'}`,
                      borderRadius: 4, color: settings.animationSpeed === opt.v ? 'var(--ui-text)' : 'var(--ui-text-dim)',
                      cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                      boxShadow: settings.animationSpeed === opt.v ? '0 0 8px var(--ui-glow)' : 'none',
                    }}>{opt.l}</button>
                  ))}
                </div>
              </div>

              {/* ─── VISUAL ─── */}
              <div style={{ borderTop: '1px solid var(--ui-border-dim)', paddingTop: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 'bold', color: 'var(--ui-primary)', marginBottom: 10, letterSpacing: 1, borderBottom: '1px solid var(--ui-border-dim)', paddingBottom: 4 }}>VISUAL</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 20px' }}>
                  {[
                    { key: 'scanlines', name: 'CRT Scanlines' },
                    { key: 'phosphor', name: 'Phosphor Glow' },
                    { key: 'crtMode', name: 'CRT Curve' },
                    { key: 'screenShake', name: 'Screen Shake' },
                    { key: 'particleFx', name: 'Particles' },
                    { key: 'reducedAnimations', name: 'Reduced Animations' },
                  ].map(fx => {
                    const val = fx.key === 'reducedAnimations' ? (settings[fx.key] || false) : (settings[fx.key] !== undefined ? settings[fx.key] : true);
                    return (
                    <div key={fx.key} onClick={() => { sound.terminalTab(); setSettings(s => ({ ...s, [fx.key]: fx.key === 'reducedAnimations' ? !s[fx.key] : !(s[fx.key] !== undefined ? s[fx.key] : true) })); }} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', cursor: 'pointer',
                    }}>
                      <span style={{ fontSize: 10, color: val ? 'var(--ui-text)' : 'var(--ui-text-dim)' }}>{fx.name}</span>
                      <div style={{ width: 34, height: 18, borderRadius: 9, background: val ? 'var(--ui-bg-solid)' : '#222', border: `1px solid ${val ? 'var(--ui-border)' : '#444'}`, position: 'relative', transition: 'all 0.2s', flexShrink: 0 }}>
                        <div style={{ width: 14, height: 14, borderRadius: '50%', background: val ? 'var(--ui-primary)' : '#555', position: 'absolute', top: 1, left: val ? 17 : 1, transition: 'left 0.2s', boxShadow: val ? '0 0 4px var(--ui-glow)' : 'none' }} />
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>

              {/* ─── FALLOUT 4 AUDIO ─── */}
              <div style={{ borderTop: '1px solid var(--ui-border-dim)', paddingTop: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 'bold', color: 'var(--ui-primary)', marginBottom: 4, letterSpacing: 1, borderBottom: '1px solid var(--ui-border-dim)', paddingBottom: 4 }}>FALLOUT 4 AUDIO</div>
                <div style={{ fontSize: 9, color: 'var(--ui-text-dim)', marginBottom: 8 }}>Point to your Fallout 4 install to use authentic sounds</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="text" placeholder="C:\Program Files\Steam\steamapps\common\Fallout 4" value={settings.fo4Path || ''} onChange={e => setSettings(s => ({ ...s, fo4Path: e.target.value }))} style={{ flex: 1, padding: '6px 10px', fontSize: 10, background: 'rgba(0,0,0,0.4)', border: '1px solid var(--ui-border-dim)', borderRadius: 4, color: 'var(--ui-text)', fontFamily: 'inherit' }} />
                  <button onClick={() => {
                    try {
                      localStorage.setItem('wt_fo4_cache_dir', settings.fo4Path || '');
                      fetch('/fo4-audio/ui/pipboy-click.wav', { method: 'HEAD' }).then(r => {
                        setSettings(s => ({ ...s, fo4Status: r.ok ? 'found' : 'not_found' }));
                      }).catch(() => setSettings(s => ({ ...s, fo4Status: 'not_found' })));
                    } catch(_) { setSettings(s => ({ ...s, fo4Status: 'not_found' })); }
                  }} style={{ padding: '6px 14px', fontSize: 10, fontWeight: 'bold', background: 'var(--ui-hover)', border: '1px solid var(--ui-border-dim)', borderRadius: 4, color: 'var(--ui-primary)', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>TEST</button>
                </div>
                {settings.fo4Status && (
                  <div style={{ marginTop: 6, fontSize: 10, color: settings.fo4Status === 'found' ? '#44ff44' : '#ff4444', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 14 }}>{settings.fo4Status === 'found' ? '✓' : '✗'}</span>
                    {settings.fo4Status === 'found' ? 'FO4 audio files detected' : 'FO4 audio files not found'}
                  </div>
                )}
              </div>

              {/* ─── BOTTOM BUTTONS ─── */}
              <div style={{ borderTop: '1px solid var(--ui-border-dim)', paddingTop: 14, display: 'flex', gap: 10 }}>
                <button onClick={() => { sound.terminalTab(); saveGame(); setSettingsOpen(false); }} style={{ flex: 1, padding: '8px', fontSize: 11, fontWeight: 'bold', background: 'var(--ui-hover)', border: '1px solid var(--ui-border-dim)', borderRadius: 4, color: 'var(--ui-primary)', cursor: 'pointer', fontFamily: 'inherit', letterSpacing: 1 }}>SAVE</button>
                <button onClick={() => { sound.terminalTab(); loadGame(); setSettingsOpen(false); }} disabled={!hasSave} style={{ flex: 1, padding: '8px', fontSize: 11, fontWeight: 'bold', background: hasSave ? 'var(--ui-hover)' : 'rgba(30,30,30,0.3)', border: `1px solid ${hasSave ? 'var(--ui-border-dim)' : '#333'}`, borderRadius: 4, color: hasSave ? 'var(--ui-primary)' : '#555', cursor: hasSave ? 'pointer' : 'not-allowed', fontFamily: 'inherit', letterSpacing: 1 }}>LOAD</button>
                <button onClick={() => { sound.terminalTab(); setSettings({ volume: 80, musicVolume: 80, sfxVolume: 100, uiSoundVolume: 80, ambientVolume: 60, animationSpeed: 1, scanlines: true, phosphor: true, crtMode: false, screenShake: true, particleFx: true, abilityVfx: true, reducedAnimations: false, boardSkin: 'arena2', uiTheme: settings.uiTheme }); }} style={{ flex: 1, padding: '8px', fontSize: 11, fontWeight: 'bold', background: 'rgba(40,30,10,0.4)', border: '1px solid var(--ui-border-dim)', borderRadius: 4, color: 'var(--ui-text-dim)', cursor: 'pointer', fontFamily: 'inherit', letterSpacing: 1 }}>DEFAULTS</button>
                <button onClick={() => { if (confirm('Return to main menu? Unsaved progress will be lost.')) { sound.terminalTab(); restart(); } }} style={{ flex: 1, padding: '8px', fontSize: 11, fontWeight: 'bold', background: 'rgba(60,10,5,0.3)', border: '1px solid #664422', borderRadius: 4, color: '#cc8844', cursor: 'pointer', fontFamily: 'inherit', letterSpacing: 1 }}>MENU</button>
              </div>

              {/* ─── DEV TOOLS ─── */}
              <div style={{ borderTop: '1px solid #ff660033', paddingTop: 14, marginTop: 6 }}>
                <button onClick={() => { setSettingsOpen(false); setDevToolsActivate(true); }} style={{ width: '100%', padding: '10px 16px', fontSize: 11, fontWeight: 'bold', background: 'rgba(80,20,0,0.2)', border: '1px solid #ff6600', borderRadius: 4, color: '#ff8844', cursor: 'pointer', fontFamily: 'inherit', letterSpacing: 2, transition: 'all 0.15s' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(120,40,0,0.3)'; e.currentTarget.style.boxShadow = '0 0 12px rgba(255,102,0,0.2)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(80,20,0,0.2)'; e.currentTarget.style.boxShadow = 'none'; }}>DEV TOOLS</button>
                <div style={{ fontSize: 8, color: '#885533', marginTop: 4, textAlign: 'center' }}>Visual element inspector — select and adjust any UI element</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Green phosphor tint - stronger when phosphor enabled */}
      {settings.phosphor && (
        <div style={{ position: 'fixed', inset: 0, background: phase === 'combat' ? 'radial-gradient(ellipse at 50% 50%, rgba(0,255,0,0.06) 0%, rgba(0,255,0,0.02) 40%, transparent 70%)' : 'radial-gradient(ellipse at 50% 50%, rgba(0,255,0,0.03) 0%, transparent 60%)', pointerEvents: 'none', zIndex: 998, animation: phase === 'combat' ? 'wt-phosphor-pulse 2s ease-in-out infinite' : 'none' }} />
      )}
      {/* CRT mode - screen curve + bloom */}
      {settings.crtMode && (
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 997, boxShadow: 'inset 0 0 80px rgba(0,255,0,0.03)', borderRadius: '3%', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: '-5%', background: 'radial-gradient(ellipse 70% 70% at 50% 50%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.25) 100%)', borderRadius: '50%' }} />
        </div>
      )}

      {/* Game ambient overlays */}
      <div className="wt-game-vignette" />
      {settings.scanlines !== false && <div className="wt-game-scanlines" />}
      <div className="wt-game-border" />
      {settings.particleFx !== false && Array.from({ length: 8 }, (_, i) => (
        <div key={`dust-${i}`} className="wt-dust-particle" style={{
          left: `${10 + (i * 11) % 80}%`,
          '--dust-duration': `${12 + (i * 3) % 10}s`,
          '--dust-delay': `${i * 1.8}s`,
        }} />
      ))}

      {/* Top Bar — Thin TFT-style HUD */}
      {(() => {
        const currentStage = Math.ceil(round / ROUNDS_PER_STAGE);
        const roundInStage = ((round - 1) % ROUNDS_PER_STAGE) + 1;
        const totalStages = Math.max(currentStage + 2, 7);
        const isBoss = round > 3 && round % 7 === 0;
        const stageType = currentStage <= 1 ? 'PvE' : isBoss ? 'BOSS' : 'PvP';
        const stageTypeColor = isBoss ? '#ff4444' : currentStage <= 1 ? '#ff9900' : 'var(--ui-primary)';
        return (
          <div className="wt-top-bar">
            {/* Left — Logo + Settings */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {LOGO_IMG ? <img src={LOGO_IMG} alt="WT" style={{ height: 32, objectFit: 'contain', filter: 'drop-shadow(0 0 8px rgba(0,255,0,0.5))' }} /> : <span style={{ fontSize: 18, fontWeight: 'bold', textShadow: '0 0 10px var(--ui-primary)' }}>☢️ WT</span>}
              <button onClick={() => setSettingsOpen(o => !o)} style={{ background: 'transparent', border: '1px solid var(--ui-border)', borderRadius: 4, color: 'var(--ui-primary)', cursor: 'pointer', padding: '3px 6px', fontSize: 14 }} title="Settings"><svg width="14" height="14" viewBox="0 0 20 20"><path d="M10 7a3 3 0 100 6 3 3 0 000-6zm7.3 2.2l-1.4-.3a5.8 5.8 0 00-.7-1.7l.8-1.2-1.4-1.4-1.2.8a5.8 5.8 0 00-1.7-.7L11.4.3h-2l-.3 1.4a5.8 5.8 0 00-1.7.7L6.2 1.6 4.8 3l.8 1.2a5.8 5.8 0 00-.7 1.7l-1.4.3v2l1.4.3c.1.6.4 1.2.7 1.7l-.8 1.2 1.4 1.4 1.2-.8c.5.3 1.1.6 1.7.7l.3 1.4h2l.3-1.4a5.8 5.8 0 001.7-.7l1.2.8 1.4-1.4-.8-1.2c.3-.5.6-1.1.7-1.7l1.4-.3z" fill="currentColor"/></svg></button>
            </div>

            {/* Center — Stage + Progress */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <div className="wt-stage-badge">
                <span className={`wt-stage-type ${isBoss ? 'wt-stage-type-boss' : currentStage <= 1 ? 'wt-stage-type-pve' : 'wt-stage-type-pvp'}`}>{isBoss ? 'BOSS' : currentStage <= 1 ? 'ENCOUNTER' : 'SKIRMISH'}</span>
                <span className="wt-stage-number">{currentStage}-{roundInStage}</span>
                {isBoss && BOSS_DATABASE[round] && <span style={{ fontSize: 10, color: '#44ccff', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: 3 }}><GameIcon iconImg={BOSS_DATABASE[round].iconImg} icon={BOSS_DATABASE[round].icon} size={14} /> {BOSS_DATABASE[round].name}</span>}
              </div>
              {/* Progress dots */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {Array.from({ length: totalStages }, (_, si) => {
                  const stageNum = si + 1;
                  const isCurrentStage = stageNum === currentStage;
                  const isPast = stageNum < currentStage;
                  return (
                    <React.Fragment key={si}>
                      <div style={{ display: 'flex', gap: 2 }}>
                        {Array.from({ length: ROUNDS_PER_STAGE }, (_, ri) => {
                          const absRound = (stageNum - 1) * ROUNDS_PER_STAGE + ri + 1;
                          const isPvE = absRound <= 3;
                          const isRoundBoss = absRound > 3 && absRound % 7 === 0;
                          const isCurrentRound = isCurrentStage && ri + 1 === roundInStage;
                          const isRoundPast = isPast || (isCurrentStage && ri + 1 < roundInStage);
                          const isCarousel = isCarouselRound(absRound);
                          const pipType = isCarousel ? 'carousel' : isPvE ? 'pve' : isRoundBoss ? 'boss' : 'pvp';
                          const pipTypeLabel = isCarousel ? 'Lucky 38 Carousel' : isPvE ? 'PvE Encounter' : isRoundBoss ? 'Boss Fight' : 'PvP Skirmish';
                          const pipIcon = isCarousel ? '$' : isPvE ? '☢' : isRoundBoss ? '☠' : '⚔';
                          const pipStatus = isRoundPast ? 'Completed' : isCurrentRound ? 'Current' : 'Upcoming';
                          return (
                            <div key={ri} className={`wt-pip wt-pip-${pipType} ${isCurrentRound ? 'wt-pip-current' : ''} wt-pip-hover`} style={{
                              width: isCarousel ? 10 : isRoundBoss ? 12 : isCurrentRound ? 11 : 8,
                              height: isCarousel ? 10 : isRoundBoss ? 12 : isCurrentRound ? 11 : 8,
                              border: isCarousel ? '1.5px solid #ffd700' : isRoundBoss ? '1.5px solid #ffd700' : isCurrentRound ? '2px solid var(--ui-border)' : '1px solid var(--ui-border-dim)',
                              opacity: isRoundPast ? 0.35 : isCurrentRound ? 1 : 0.6,
                            }}>
                              <div className="wt-pip-tooltip">
                                <div style={{ fontWeight: 'bold', color: 'var(--ui-primary)' }}>{pipIcon} Round {absRound}</div>
                                <div style={{ color: pipType === 'boss' ? '#ff4444' : pipType === 'carousel' ? '#ffd700' : pipType === 'pve' ? '#ff9900' : 'var(--ui-text-dim)' }}>{pipTypeLabel}</div>
                                <div style={{ opacity: 0.5 }}>Stage {stageNum} \u2022 {pipStatus}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {si < totalStages - 1 && <div style={{ width: 6, height: 1, background: isPast ? 'var(--ui-secondary)' : 'var(--ui-border-dim)' }} />}
                    </React.Fragment>
                  );
                })}
              </div>
              {/* Phase badge */}
              <div className={`wt-phase-badge ${phase === 'carousel' ? 'wt-phase-carousel' : phase === 'combat' ? (isBoss ? 'wt-phase-boss' : 'wt-phase-combat') : phase === 'gameover' ? 'wt-phase-dead' : 'wt-phase-prep'}`}>
                {phase === 'carousel' ? 'LUCKY 38' : phase === 'combat' ? (isBoss ? 'BOSS FIGHT' : currentOpponent ? `vs ${currentOpponent}` : 'COMBAT') : phase === 'gameover' ? 'DEAD' : 'PREP'}
              </div>
            </div>

            {/* Stats moved to bottom-right HUD */}
          </div>
        );
      })()}

      {/* Player Stats HUD — Bottom bar, full width */}
      <div className="wt-stats-hud" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', background: 'var(--ui-panel)', borderTop: '1px solid var(--ui-border-dim)', padding: '4px 10px', zIndex: 100, backdropFilter: 'blur(6px)' }}>
        <div className="wt-stat-block">
          <div className="wt-stat-label">TIMER</div>
          <div className={`wt-stat-value ${timer <= 5 ? 'wt-timer-urgent' : ''}`} style={{ fontSize: 18, color: timer <= 10 && timer > 5 ? '#ffaa00' : timer <= 5 ? '#ff0000' : 'var(--ui-primary)' }}>{timer}s</div>
        </div>
        <div className="wt-stat-block">
          <div className="wt-stat-label">CAPS</div>
          <div className="wt-stat-value" style={{ fontSize: 16, color: '#ffd700', display: 'flex', alignItems: 'center', gap: 3 }}>{CAPS_IMG ? <img src={CAPS_IMG} alt="" style={{ width: 14, height: 14 }} /> : '$'}{gold}</div>
        </div>
        <div className="wt-stat-block">
          <div className="wt-stat-label">HP</div>
          <div className="wt-hp-bar-frame">
            <div className="wt-hp-bar-fill" style={{ width: `${hp}%`, background: hp > 50 ? '#00cc00' : hp > 25 ? '#ddaa00' : '#cc2222' }} />
          </div>
          <div style={{ fontSize: 7, marginTop: 1, color: hp > 50 ? '#00cc00' : hp > 25 ? '#ddaa00' : '#cc2222', fontFamily: "'Share Tech Mono', monospace" }}>{hp}/100</div>
        </div>
        <div className="wt-stat-block">
          <div className="wt-stat-label">LV</div>
          <div className="wt-stat-value" style={{ fontSize: 14 }}>{level}</div>
          <div className="wt-xp-bar"><div className="wt-xp-bar-fill" style={{ width: `${(xp / xpNeeded) * 100}%` }} /></div>
        </div>
        <div className="wt-stat-block">
          <div className="wt-stat-label">STREAK</div>
          <div className={`wt-stat-value ${streak > 0 ? 'wt-streak-win' : streak < 0 ? 'wt-streak-lose' : ''}`} style={{ fontSize: 12 }}>
            {streak > 0 ? `${'▲'.repeat(Math.min(streak, 5))}` : streak < 0 ? `${'▼'.repeat(Math.min(Math.abs(streak), 5))}` : '—'}
          </div>
        </div>
      </div>

      {/* Main game area — TFT-style layout */}
      <div className="wt-main-layout">
        {/* Left panel - Synergies */}
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
              {/* Tier ladder pills — reached tiers get the trait colour, unreached are dim. */}
              <div style={{ display: 'flex', gap: 3, marginTop: 3 }}>
                {tiers.map(t => {
                  const reached = s.count >= t;
                  const isActive = t === activeTier;
                  return (
                    <span
                      key={t}
                      title={`${t}: ${s.bonuses[t]}`}
                      style={{
                        fontSize: 8, fontWeight: 'bold', padding: '1px 5px', borderRadius: 2,
                        background: reached ? s.color : 'transparent',
                        color: reached ? '#0a0a0a' : `${s.color}88`,
                        border: `1px solid ${reached ? s.color : `${s.color}44`}`,
                        outline: isActive ? `1px solid ${s.color}` : 'none',
                        outlineOffset: 1,
                      }}
                    >{t}</span>
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

        {/* Center column — Board, Bench, Shop stacked */}
        <div className="wt-center-column">
          {/* Arena */}
          <div className="wt-combat-arena wt-arena-frame" style={(() => {
            const imageSkins = {
              arena1: { image: `${BASE}/arena-1.png`, border: '#c85a20' },
              arena2: { image: `${BASE}/arena-2.png`, border: '#a08040' },
              arena3: { image: `${BASE}/arena-3.png`, border: '#666688' },
              arena4: { image: `${BASE}/arena-4.png`, border: '#aa6644' },
              arena5: { image: `${BASE}/arena-5.png`, border: '#777766' },
            };
            const currentSkin = settings.boardSkin || 'arena2';
            const imgSkin = imageSkins[currentSkin] || imageSkins.arena2;
            return {
              backgroundImage: `url(${imgSkin.image})`,
              backgroundSize: '100% 100%',
              backgroundPosition: 'center',
              borderColor: imgSkin.border,
            };
          })()}>
            <div className="wt-board-vignette" />
            {bossIntro && (
              <BossIntro
                boss={bossIntro}
                frames={Array.isArray(bossIntro.introFrames) ? bossIntro.introFrames : null}
                onDone={() => { /* boss intro auto-dismiss handled by existing timeout in setBossIntro flow */ }}
              />
            )}
            {/* PvE creep-wave banner — shown when on a themed PvE round, in either prep or combat.
                Non-intrusive: thin coloured bar, no full overlay. */}
            {isPveRound(round) && !(round > 3 && round % 7 === 0 && BOSS_DATABASE[round]) && getPveWave(round) && (() => {
              const wave = getPveWave(round);
              return (
                <div style={{
                  maxWidth: 780, width: '100%', margin: '0 auto 6px',
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '4px 12px',
                  background: `linear-gradient(90deg, ${wave.color}33, transparent 60%)`,
                  border: `1px solid ${wave.color}66`,
                  borderRadius: 3,
                  fontFamily: "'Share Tech Mono', monospace",
                }}>
                  <span style={{ fontSize: 18, lineHeight: 1 }}>{wave.icon}</span>
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 'bold', color: wave.color, letterSpacing: 1, textTransform: 'uppercase' }}>{wave.name}</span>
                    <span style={{ fontSize: 9, opacity: 0.65, color: 'var(--ui-text)' }}>{wave.flavour}</span>
                  </div>
                  <span style={{ fontSize: 9, color: wave.color, opacity: 0.85, whiteSpace: 'nowrap' }}>PvE · item drop</span>
                </div>
              );
            })()}
            {/* Combat progress bar */}
            {phase === 'combat' && (
              <div style={{ maxWidth: 780, width: '100%', margin: '0 auto 8px', position: 'relative', height: 18, background: '#111', border: '1px solid var(--ui-secondary)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.max(0, (1 - combatTick / 150) * 100)}%`,
                  height: '100%',
                  background: `linear-gradient(90deg, #00ff00 ${Math.max(0, 100 - combatTick / 1.5)}%, #ff0000)`,
                  transition: 'width 0.1s linear',
                }} />
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace', fontSize: 10, color: 'var(--ui-primary)', textShadow: '0 0 4px var(--ui-primary)' }}>
                  COMBAT {combatTick}/150
                </div>
              </div>
            )}
            {/* Enemy board / Scout preview — only for ghost PvP rounds (not PvE creep waves, not bosses) */}
            {phase === 'prep' && round > 3 && !isPveRound(round) && !(round % 7 === 0 && BOSS_DATABASE[round]) && (() => {
              const aliveGhosts = ghostPlayersRef.current.filter(g => g.alive);
              if (aliveGhosts.length === 0) return null;
              const sIdx = scoutIndex % aliveGhosts.length;
              const scouted = aliveGhosts[sIdx];
              return (
                <div style={{ marginBottom: 4, position: 'relative' }}>
                  <div className="wt-scouting-scope" />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: '#ff9900', fontWeight: 'bold' }}>SCOUTING:</span>
                    <button onClick={() => setScoutIndex(i => (i - 1 + aliveGhosts.length) % aliveGhosts.length)} style={{ background: 'transparent', border: '1px solid #ff990066', borderRadius: 3, color: '#ff9900', cursor: 'pointer', padding: '1px 6px', fontFamily: 'inherit', fontSize: 11 }}>◀</button>
                    <span style={{ fontSize: 12, color: '#ffcc00', fontWeight: 'bold' }}>{scouted.name}</span>
                    <span style={{ fontSize: 9, color: '#aa8800' }}>LV.{scouted.level} · {scouted.board.length} units · {scouted.hp} HP</span>
                    <button onClick={() => setScoutIndex(i => (i + 1) % aliveGhosts.length)} style={{ background: 'transparent', border: '1px solid #ff990066', borderRadius: 3, color: '#ff9900', cursor: 'pointer', padding: '1px 6px', fontFamily: 'inherit', fontSize: 11 }}>▶</button>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {scouted.board.map((u, idx) => {
                      const unitImg = getUnitImage(u.id, u.stars);
                      return (
                        <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 3, background: 'rgba(255,100,0,0.1)', border: `1px solid ${COST_COLORS[UNIT_DATABASE[u.id]?.cost] || '#666'}44`, borderRadius: 3, width: 52 }}>
                          {unitImg ? (
                            <img src={unitImg} alt={UNIT_DATABASE[u.id]?.name} style={{ width: 32, height: 32, objectFit: 'contain' }} />
                          ) : (
                            <UnitPlaceholder name={UNIT_DATABASE[u.id]?.name} size={32} />
                          )}
                          <div style={{ fontSize: 8, color: COST_COLORS[UNIT_DATABASE[u.id]?.cost] || '#888' }}>{UNIT_DATABASE[u.id]?.name?.split(' ')[0]}</div>
                          <div style={{ fontSize: 8 }}>{stars(u.stars)}</div>
                        </div>
                      );
                    })}
                    {scouted.board.length === 0 && <div style={{ fontSize: 10, opacity: 0.4 }}>No units yet</div>}
                  </div>
                </div>
              );
            })()}
            {/* Isometric perspective wrapper — tilts the board like a TFT table */}
            <div className="wt-iso-perspective">
            <div className="wt-iso-tilt">
            <div className={phase === 'combat' ? 'wt-enter-enemy' : ''}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, maxWidth: 780, width: '100%', margin: '0 auto', overflow: 'visible' }}>
                {Array(14).fill(null).map((_, i) => {
                  const enemy = phase === 'combat' ? combatEnemies[i] : null;
                  const isEnemyAttacking = enemy && animations.attacking.includes(enemy.uid);
                  const isEnemyHit = enemy && animations.hit.includes(enemy.uid);
                  const isEnemyDying = enemy && animations.dying.includes(enemy.uid);
                  const isEnemyAbility = enemy && animations.ability?.includes(enemy.uid);
                  const enemyAnimClass = isEnemyAbility ? 'wt-anim-ability-enemy' : isEnemyDying ? 'wt-anim-dying-enemy' : isEnemyHit ? 'wt-anim-hit-enemy' : isEnemyAttacking ? 'wt-anim-attack-enemy' : '';
                  return (
                    <div key={i} data-unit-uid={enemy?.uid} className={enemyAnimClass}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        if (!enemy) return;
                        setUnitTooltip(prev => (prev?.unit?.uid === enemy.uid ? null : { unit: enemy, x: e.clientX, y: e.clientY }));
                      }}
                      style={{
                      width: '100%', aspectRatio: '1/1.15', overflow: 'visible',
                      background: enemy ? 'rgba(120,0,0,0.25)' : 'rgba(0,0,0,0.2)',
                      border: `2px solid ${enemy ? 'rgba(255,60,60,0.45)' : 'rgba(180,80,80,0.3)'}`,
                      borderRadius: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      position: 'relative', cursor: enemy ? 'context-menu' : 'default',
                      opacity: isEnemyDying ? undefined : enemy && enemy.currentHp <= 0 ? 0.3 : 1,
                      transition: enemyAnimClass ? 'none' : 'transform 0.15s ease-out, opacity 0.15s',
                    }}>
                      {enemy && (<>
                        {/* Flat shadow on the board plane */}
                        <div style={{ position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)', width: '80%', height: 8, background: 'rgba(0,0,0,0.4)', borderRadius: '50%', filter: 'blur(4px)', pointerEvents: 'none' }} />
                        {/* Counter-rotate enemy unit to face camera */}
                        <div className="wt-iso-unit" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'visible' }}>
                          {getUnitImage(enemy.id, enemy.stars) ? (
                            <img src={getUnitImage(enemy.id, enemy.stars)} alt={enemy.name} style={{ width: 44, height: 44, objectFit: 'contain' }} />
                          ) : (
                            <UnitPlaceholder name={enemy.name} size={48} />
                          )}
                          <div style={{ fontSize: 9 }}>{stars(enemy.stars)}</div>
                          <CombatBars currentHp={enemy.currentHp} maxHp={enemy.maxHp} mana={enemy.mana} manaMax={enemy.manaMax} variant="enemy" compact />
                        </div>
                      </>)}
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Divider */}
            <div className="wt-board-divider">
              <span className="wt-board-divider-text">
                {'☢ THE WASTELAND '}
                <span style={{ color: board.filter(u => u).length >= level ? '#ff4444' : 'var(--ui-primary)', fontWeight: 'bold' }}>
                  {board.filter(u => u).length}/{level}
                </span>
              </span>
            </div>
            {/* Player board */}
            <div className={`${phase === 'combat' ? 'wt-enter-player' : ''} ${noBoardFlash ? 'wt-no-board-flash' : ''}`}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, maxWidth: 780, width: '100%', margin: '0 auto', overflow: 'visible' }}>
                {board.map((unit, i) => (
                  <div key={i}
                    data-slot-location="board"
                    data-slot-index={i}
                    onClick={() => {
                      if (justDraggedRef.current) { justDraggedRef.current = false; return; }
                      if (selected && !unit) { moveUnit(selected.location, selected.index, 'board', i); }
                      else if (unit) { setSelected(selected?.location === 'board' && selected?.index === i ? null : { unit, location: 'board', index: i }); }
                    }}
                    onMouseEnter={(e) => { if (phase === 'prep' && unit) setUnitTooltip({ unit, x: e.clientX, y: e.clientY }); }}
                    onMouseLeave={() => { if (phase === 'prep') setUnitTooltip(null); }}
                    className={`wt-board-cell ${phase === 'prep' ? 'wt-board-cell-prep' : 'wt-board-cell-combat'} ${unit ? 'wt-board-cell-occupied' : 'wt-board-cell-empty'} ${(itemDrag && dragOverTarget?.location === 'board' && dragOverTarget?.index === i && unit) ? 'wt-board-cell-item-drop' : ''} ${(!itemDrag && dragOverTarget?.location === 'board' && dragOverTarget?.index === i) ? 'wt-board-cell-unit-drop' : ''}`}
                    style={{ width: '100%', aspectRatio: '1/1.15', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: phase === 'prep' ? 'pointer' : 'default', overflow: 'visible' }}>
                    {unit ? <UnitCard unit={unit} location="board" index={i} small isBoard
                      selected={selected} draggedFrom={draggedFrom} phase={phase}
                      combatUnits={combatUnits} animations={animations}
                      onPointerDown={handleUnitPointerDown} onContextMenu={handleUnitContextMenu}
                      onClick={handleUnitClick} selectedItem={selectedItem} />
                    : <span style={{ fontSize: 16, color: '#ffd70033', fontWeight: 'bold', userSelect: 'none', lineHeight: 1 }}>+</span>}
                  </div>
                ))}
              </div>
            </div>
            </div>{/* end wt-iso-tilt */}
            </div>{/* end wt-iso-perspective */}
          </div>

          {/* Bench — directly under arena, same width */}
          <div className="wt-bench-strip">
            {/* Items — left of bench */}
            <div style={{ width: 120, display: 'flex', flexDirection: 'column', gap: 3, paddingRight: 8, borderRight: '1px solid var(--ui-border-dim)', flexShrink: 0 }}>
              <div className="wt-items-header">ITEMS{itemInventory.length > 0 ? ` (${itemInventory.length})` : ''}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {itemInventory.length === 0 ? (
                  <div style={{ fontSize: 9, opacity: 0.4 }}>No items</div>
                ) : itemInventory.map((itemKey, idx) => {
                  const comp = ITEM_COMPONENTS[itemKey];
                  if (!comp) return null;
                  const recipes = Object.values(COMPLETED_ITEMS).filter(item => item.recipe.includes(itemKey)).map(item => `${item.icon} ${item.name}: ${item.desc}`);
                  const tooltip = `${comp.name} (${comp.desc})\n\nCombines into:\n${recipes.join('\n')}`;
                  return React.createElement('div', {
                    key: idx,
                    title: tooltip,
                    onClick: () => { if (phase === 'prep') setSelectedItem(selectedItem === itemKey ? null : itemKey); },
                    onPointerDown: (e) => {
                      if (phase !== 'prep' || e.button !== 0) return;
                      e.preventDefault();
                      e.stopPropagation();
                      setItemDrag({ itemKey, invIndex: idx, startX: e.clientX, startY: e.clientY });
                    },
                    style: {
                      width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: selectedItem === itemKey ? 'rgba(0,255,0,0.3)' : 'rgba(0,0,0,0.4)',
                      border: selectedItem === itemKey ? '2px solid var(--ui-border)' : '1px solid #555',
                      borderRadius: 3, cursor: phase === 'prep' ? 'grab' : 'pointer', fontSize: 16,
                      userSelect: 'none', touchAction: 'none',
                    }
                  }, createGameIcon(comp.iconImg, comp.icon, 16));
                })}
              </div>
              {/* Income under items */}
              <div style={{ marginTop: 2, borderTop: '1px solid var(--ui-border-dim)', paddingTop: 3 }}>
                <div style={{ fontSize: 8, fontWeight: 'bold', color: 'var(--ui-primary)', letterSpacing: 1 }}>INCOME</div>
                {incomeBreakdown ? (<>
                  <div style={{ fontSize: 8, color: '#00cc00' }}>Base +{incomeBreakdown.base} · Int +{incomeBreakdown.interest} · Str +{incomeBreakdown.streak}</div>
                  <div style={{ fontSize: 9, fontWeight: 'bold', color: '#44ff44' }}>= +{incomeBreakdown.total}g</div>
                </>) : <div style={{ fontSize: 8, opacity: 0.4 }}>Round 1</div>}
              </div>
              {selectedItem && (() => {
                const selComp = ITEM_COMPONENTS[selectedItem];
                return React.createElement('div', { style: { fontSize: 8, color: '#aaffaa', marginTop: 2 } }, `Drag ${selComp?.name} onto unit`);
              })()}
            </div>
            {/* Bench slots */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 8px' }}>
              <div style={{ fontSize: 9, fontWeight: 'bold', marginBottom: 2, opacity: 0.7 }}>BENCH ({bench.filter(u => u).length}/9)</div>
              <div style={{ display: 'flex', gap: 3, justifyContent: 'center' }}>
                {bench.map((unit, i) => (
                  <div key={i}
                    data-slot-location="bench"
                    data-slot-index={i}
                    onClick={() => {
                      if (justDraggedRef.current) { justDraggedRef.current = false; return; }
                      if (selected && !unit) { moveUnit(selected.location, selected.index, 'bench', i); }
                      else if (unit) { setSelected(selected?.location === 'bench' && selected?.index === i ? null : { unit, location: 'bench', index: i }); }
                    }}
                    style={(() => {
                      const isItemDragOver = itemDrag && dragOverTarget?.location === 'bench' && dragOverTarget?.index === i && unit;
                      const isUnitDragOver = !itemDrag && dragOverTarget?.location === 'bench' && dragOverTarget?.index === i;
                      return {
                        width: 'calc((100% - 24px) / 9)', minWidth: 48, aspectRatio: '1/1.1',
                        background: isItemDragOver ? 'rgba(255,170,0,0.3)' : isUnitDragOver ? 'rgba(0,255,0,0.25)' : (unit ? 'transparent' : 'rgba(0,100,0,0.3)'),
                        border: `2px ${(isItemDragOver || isUnitDragOver) ? 'solid' : 'dashed'} ${isItemDragOver ? '#ffaa00' : isUnitDragOver ? '#00ff00' : (unit ? 'transparent' : '#00660044')}`,
                        borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                        transition: 'background 0.15s, border-color 0.15s',
                        boxShadow: isItemDragOver ? '0 0 14px rgba(255,170,0,0.5)' : 'none',
                      };
                    })()}>
                    {unit ? <UnitCard unit={unit} location="bench" index={i} small
                      selected={selected} draggedFrom={draggedFrom} phase={phase}
                      combatUnits={combatUnits} animations={animations}
                      onPointerDown={handleUnitPointerDown} onContextMenu={handleUnitContextMenu}
                      onClick={handleUnitClick} selectedItem={selectedItem} />
                    : <span style={{ fontSize: 10, color: 'var(--ui-text-dim)', opacity: 0.5, fontWeight: 'bold', userSelect: 'none' }}>{i + 1}</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Shop bar — TFT style: controls left, cards center, fight+sell right */}
          <div className="wt-shop-bar">
            {/* Left — Reroll + Buy XP */}
            {phase === 'prep' ? (
              <div className="wt-shop-controls">
                <button onClick={refreshShop} disabled={gold < 2} className={`wt-shop-btn ${gold < 2 ? 'wt-shop-btn-disabled' : ''}`} style={{ fontSize: 11 }}>
                  REROLL 2g
                </button>
                <button onClick={buyXP} disabled={gold < 4 || level >= 9} className={`wt-shop-btn ${gold < 4 || level >= 9 ? 'wt-shop-btn-disabled' : ''}`} style={{ fontSize: 11, '--ui-primary': gold >= 4 && level < 9 ? '#4488ff' : undefined, '--ui-border': gold >= 4 && level < 9 ? '#4488ff' : undefined, '--ui-glow': gold >= 4 && level < 9 ? 'rgba(68,136,255,0.3)' : undefined }}>
                  BUY XP 4g
                </button>
              </div>
            ) : <div style={{ width: 80 }} />}

            {/* Center — Shop cards */}
            <div className="wt-shop-cards">
              {shop.map((unit, i) => (
                <div key={unit ? `${i}-${unit.uid}` : `empty-${i}`} onClick={() => { setUnitTooltip(null); unit && buyUnit(i); }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    if (!unit) return;
                    setUnitTooltip(prev => (prev?.unit?.uid === unit.uid ? null : { unit, x: e.clientX, y: e.clientY }));
                  }}
                  onMouseEnter={() => { if (unit) { try { sound.hover?.(); } catch(_) {} } }}
                  className={`wt-shop-card ${shopFlipping ? 'wt-shop-flip' : 'wt-shop-deal'}`}
                  style={{ width: 68, height: 90, animationDelay: `${i * 0.08}s`, background: unit ? `linear-gradient(180deg, ${getColor(unit.cost)}66 0%, ${getColor(unit.cost)}33 100%)` : 'rgba(30,30,30,0.7)', border: `2px solid ${unit ? getColor(unit.cost) : '#333'}`, borderRadius: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: unit && gold >= unit.cost ? 'pointer' : 'not-allowed', opacity: unit ? (gold >= unit.cost ? 1 : 0.5) : 0.3, '--shop-glow-color': unit ? getColor(unit.cost) : 'transparent' }}>
                  {unit ? (<>
                    {getUnitImage(unit.id, 1) ? (
                      <img src={getUnitImage(unit.id, 1)} alt={unit.name} style={{ width: 32, height: 32, objectFit: unit.id === 'nick' ? 'cover' : 'contain', borderRadius: unit.id === 'nick' ? '50%' : undefined }} />
                    ) : (
                      <UnitPlaceholder name={unit.name} size={32} />
                    )}
                    <div style={{ fontSize: 9, textAlign: 'center', marginTop: 1, textShadow: '1px 1px 1px black', lineHeight: 1.1 }}>{unit.name}</div>
                    <div style={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap', lineHeight: 1 }}>
                      {(UNIT_DATABASE[unit.id]?.traits || []).map(t => {
                        const trait = TRAITS[t];
                        return trait ? <span key={t} title={trait.name} style={{ fontSize: 8, opacity: 0.8 }}><GameIcon iconImg={trait.iconImg} icon={trait.icon} size={10} /></span> : null;
                      })}
                    </div>
                    <div style={{ fontSize: 9, color: '#ffd700', display: 'flex', alignItems: 'center', gap: 2 }}>{unit.cost}{CAPS_IMG ? <img src={CAPS_IMG} alt="" style={{ width: 10, height: 10 }} /> : '💰'}</div>
                  </>) : <div style={{ fontSize: 9, opacity: 0.5 }}>SOLD</div>}
                </div>
              ))}
            </div>

            {/* Right — Fight + Sell stacked */}
            {phase === 'prep' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                <button
                  onClick={startCombat}
                  className="wt-fightBtn wt-fightBtn-prep wt-pipboy-btn wt-pipboy-btn--fight"
                >
                  <span>FIGHT</span>
                </button>
                <div
                  data-sell-zone
                  className={`wt-pipboy-btn wt-pipboy-btn--sell${dragOverSell ? ' wt-sell-dragover' : ''}`}
                >
                  <span>SELL</span>
                </div>
              </div>
            ) : <div style={{ width: 110 }} />}
          </div>
        </div>

        {/* Right panel — Unit Info & Combat Log */}
        <div className="wt-info-panel" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Unit Info */}
          <div style={{ background: 'var(--ui-bg)', border: '2px solid var(--ui-border-dim)', borderRadius: 4, padding: 8 }}>
            <div className="wt-panel-header">UNIT INFO</div>
            {selected ? (
              <div>
                <div style={{ fontSize: 13, fontWeight: 'bold', marginBottom: 3 }}>{selected.unit.name}</div>
                <div style={{ fontSize: 10, marginBottom: 3 }}>{stars(selected.unit.stars)}</div>
                <div style={{ fontSize: 9, opacity: 0.8, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>{selected.unit.traits.map((t, i) => { const tr = TRAITS[t]; return tr ? <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>{i > 0 && ' \u2022 '}<GameIcon iconImg={tr.iconImg} icon={tr.icon} size={10} /> {t}</span> : null; })}</div>
                <div style={{ fontSize: 9, marginBottom: 6 }}><div><span style={{color:'#44ff44'}}>HP {selected.unit.hp}</span> <span style={{color:'#ff6666'}}>ATK {selected.unit.atk}</span> <span style={{color:'#6688ff'}}>DEF {selected.unit.def}</span></div></div>
                <div style={{ fontSize: 9, padding: 4, background: 'rgba(0,0,0,0.3)', borderRadius: 3 }}><div style={{ fontWeight: 'bold', color: '#ffff00' }}>{selected.unit.ability}</div><div style={{ opacity: 0.7 }}>{selected.unit.abilityDesc}</div>{UNIT_DATABASE[selected.unit.id]?.passiveDesc && (<div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 2, marginTop: 3 }}><div style={{ fontWeight: 'bold', color: selected.unit.stars >= 3 ? '#ff9900' : '#666', fontSize: 8 }}>{selected.unit.stars >= 3 ? '\u2605' : '\u2606'} 3\u2605 Passive</div><div style={{ opacity: selected.unit.stars >= 3 ? 0.9 : 0.4, fontSize: 8 }}>{UNIT_DATABASE[selected.unit.id].passiveDesc}</div></div>)}</div>
                {selected.unit.items && selected.unit.items.length > 0 && (
                  <div style={{ marginTop: 4, padding: 3, background: 'rgba(0,0,0,0.3)', borderRadius: 3 }}>
                    <div style={{ fontSize: 8, fontWeight: 'bold', color: '#ffaa00', marginBottom: 2 }}>Items:</div>
                    {selected.unit.items.map((itemKey, idx) => {
                      const comp = ITEM_COMPONENTS[itemKey];
                      const completed = COMPLETED_ITEMS[itemKey];
                      const name = comp?.name || completed?.name || itemKey;
                      const desc = comp?.desc || completed?.desc || '';
                      const iconImg = comp?.iconImg || completed?.iconImg;
                      const icon = comp?.icon || completed?.icon || '?';
                      return React.createElement('div', { key: idx, style: { fontSize: 8, marginBottom: 1, display: 'flex', alignItems: 'center', gap: 2 } }, createGameIcon(iconImg, icon, 9), ` ${name}: ${desc}`);
                    })}
                  </div>
                )}
                {(selected.location === 'bench' || (selected.location === 'board' && phase !== 'combat')) && (
                  <button onClick={() => sellUnit(selected.location, selected.index)} style={{ marginTop: 6, width: '100%', padding: '3px 6px', fontSize: 9, background: 'rgba(100,0,0,0.6)', border: '1px solid #ff0000', borderRadius: 3, color: '#ff0000', cursor: 'pointer', fontFamily: 'inherit' }}>
                    Sell for {selected.unit.cost * (selected.unit.stars === 3 ? 9 : selected.unit.stars === 2 ? 3 : 1)} caps
                  </button>
                )}
              </div>
            ) : <div style={{ textAlign: 'center', opacity: 0.5, fontSize: 10 }}>Select a unit</div>}
          </div>
          {/* Combat Log — Theme-matching terminal */}
          <div style={{ flex: 1, background: 'var(--ui-bg)', border: '2px solid var(--ui-border-dim)', borderRadius: 4, padding: 8, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative', overflow: 'hidden' }}>
            <div className="wt-panel-header">COMBAT LOG</div>
            <div className="wt-log-panel" style={{ flex: 1, fontSize: 11, overflow: 'auto' }}>{log.map((l, i) => <div key={i} className="wt-log-entry" style={{ padding: '3px 0', opacity: Math.max(0.3, 1 - i * 0.05), lineHeight: 1.5 }}>{formatLogEntry(l, round)}</div>)}{!log.length && <div className="wt-log-empty">Awaiting orders<span className="wt-terminal-cursor">█</span></div>}</div>
            <div style={{ color: 'var(--ui-text-dim)', fontFamily: "'Share Tech Mono', monospace", fontSize: 7, marginTop: 4, borderTop: '1px solid var(--ui-border-dim)', paddingTop: 3, opacity: 0.4 }}>TERMLINK PROTOCOL<span className="wt-terminal-cursor" style={{ marginLeft: 4 }}>█</span></div>
          </div>
        </div>
      </div>

      {/* Overseer Terminal — fixed above the bottom HUD bar */}
      <div style={{ position: 'fixed', bottom: 36, left: 0, right: 0, zIndex: 1050, display: 'flex', flexDirection: 'column', alignItems: 'stretch', pointerEvents: 'none' }}>
        {/* Terminal panel — expands upward */}
        {cheatSheetOpen && (
          <div className="wt-terminal" style={{
            maxHeight: '50vh', overflowY: 'auto',
            background: 'radial-gradient(ellipse at 50% 50%, rgba(0,30,0,0.98) 0%, rgba(0,10,0,0.99) 70%, rgba(0,5,0,1) 100%)',
            border: '3px solid var(--ui-border-dim)', borderBottom: 'none',
            borderRadius: '6px 6px 0 0',
            padding: 0,
            boxShadow: '0 -4px 30px var(--ui-glow), inset 0 0 60px rgba(0,255,0,0.05)',
            overflow: 'hidden',
            pointerEvents: 'auto',
          }}>
            {/* Terminal Header */}
            <div style={{
              padding: '10px 16px 8px',
              borderBottom: '1px solid var(--ui-border-dim)',
              background: 'rgba(0,40,0,0.3)',
            }}>
              <div style={{ fontSize: 11, color: 'var(--ui-secondary)', opacity: 0.7, letterSpacing: 1 }}>ROBCO INDUSTRIES (TM) TERMLINK</div>
              <div style={{ fontSize: 10, color: 'var(--ui-text-dim)', opacity: 0.5, marginTop: 2 }}>VAULT-TEC OVERSEER WORKSTATION v4.2.77</div>
              <div style={{ fontSize: 13, color: 'var(--ui-primary)', marginTop: 6, textShadow: '0 0 10px var(--ui-glow)' }}>
                {'>'} WELCOME, OVERSEER<span className="wt-terminal-cursor"></span>
              </div>
            </div>

            {/* Terminal Navigation */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--ui-border-dim)', padding: '6px 16px', background: 'rgba(0,30,0,0.2)', alignItems: 'center' }}>
              {[
                { id: 'items', label: '[1] SCHEMATICS' },
                { id: 'pool', label: '[2] FIELD INTEL' },
                { id: 'odds', label: '[3] SHOP ODDS' },
                { id: 'synergies', label: '[4] SYNERGY CODEX' },
                { id: 'scout', label: '[5] SCOUTING' },
                { id: 'history', label: '[6] MATCH LOG' },
                { id: 'damage', label: '[7] DAMAGE STATS' },
                { id: 'leaderboard', label: '[8] STANDINGS' },
                { id: 'encyclopedia', label: '[9] DOSSIERS' },
                { id: 'economy', label: '[10] ECON SIM' },
              ].map(tab => (
                <button key={tab.id}
                  className={`wt-terminal-tab ${terminalTab === tab.id ? 'wt-terminal-tab-active' : ''}`}
                  onClick={() => { setTerminalTab(tab.id); setTerminalSearch(''); sound.terminalTab(); }}
                >
                  {'>'} {tab.label}
                </button>
              ))}
              <div style={{ marginLeft: 'auto' }}>
                <button
                  onClick={() => setPaused(p => !p)}
                  style={{
                    padding: '5px 16px', cursor: 'pointer',
                    background: paused ? 'rgba(255,0,0,0.2)' : 'rgba(0,255,0,0.1)',
                    border: `1px solid ${paused ? '#ff4444' : 'var(--ui-border)'}`,
                    borderRadius: 2, fontFamily: 'inherit', fontSize: 11, letterSpacing: 1,
                    color: paused ? '#ff4444' : 'var(--ui-primary)',
                    textShadow: paused ? '0 0 8px rgba(255,0,0,0.5)' : '0 0 8px var(--ui-glow)',
                  }}
                >
                  {paused ? '▶ RESUME' : '⏸ PAUSE'}
                </button>
              </div>
            </div>

            {/* Terminal Content */}
            <div style={{ padding: 16, minHeight: 200 }}>
              {/* SCHEMATICS TAB — Item Combos */}
              {terminalTab === 'items' && (() => {
                const pick = schematicPick;
                const togglePick = (key) => {
                  setSchematicPick(prev => {
                    if (prev.includes(key)) return prev.filter(k => k !== key);
                    if (prev.length >= 2) return [prev[1], key];
                    return [...prev, key];
                  });
                };
                const resultItem = pick.length === 2
                  ? Object.entries(COMPLETED_ITEMS).find(([_, item]) =>
                      (item.recipe[0] === pick[0] && item.recipe[1] === pick[1]) ||
                      (item.recipe[0] === pick[1] && item.recipe[1] === pick[0])
                    )
                  : null;
                return (
                <div>
                  <div style={{ fontSize: 11, color: '#00cc00', marginBottom: 10, letterSpacing: 1 }}>
                    {'>'} SELECT TWO COMPONENTS TO VIEW SCHEMATIC:
                  </div>
                  {/* Clickable component selector */}
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 12 }}>
                    {Object.entries(ITEM_COMPONENTS).map(([key, comp]) => {
                      const isSelected = pick.includes(key);
                      const selIdx = pick.indexOf(key);
                      return (
                        <div key={key} onClick={() => togglePick(key)} style={{
                          width: 70, padding: '8px 4px', textAlign: 'center', cursor: 'pointer',
                          background: isSelected ? 'rgba(0,255,0,0.15)' : 'rgba(0,20,0,0.4)',
                          border: `2px solid ${isSelected ? 'var(--ui-border)' : 'var(--ui-border-dim)'}`,
                          borderRadius: 4, transition: 'all 0.15s',
                          boxShadow: isSelected ? '0 0 10px rgba(0,255,0,0.3)' : 'none',
                        }}>
                          <div style={{ fontSize: 24 }}><GameIcon iconImg={comp.iconImg} icon={comp.icon} size={24} /></div>
                          <div style={{ fontSize: 9, color: isSelected ? 'var(--ui-primary)' : 'var(--ui-secondary)', marginTop: 2 }}>{comp.name}</div>
                          {isSelected && <div style={{ fontSize: 8, color: '#44ff44', fontWeight: 'bold', marginTop: 2 }}>#{selIdx + 1}</div>}
                        </div>
                      );
                    })}
                  </div>
                  {/* Result display */}
                  <div style={{
                    padding: 12, background: resultItem ? 'rgba(0,60,0,0.4)' : 'rgba(0,10,0,0.3)',
                    border: `2px solid ${resultItem ? 'var(--ui-border)' : 'var(--ui-border-dim)'}`,
                    borderRadius: 6, textAlign: 'center', minHeight: 60,
                    transition: 'all 0.2s',
                    boxShadow: resultItem ? '0 0 20px rgba(0,255,0,0.15)' : 'none',
                  }}>
                    {pick.length < 2 ? (
                      <div style={{ fontSize: 11, color: 'var(--ui-secondary)', opacity: 0.5 }}>
                        {pick.length === 0 ? 'Select first component...' : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><GameIcon iconImg={ITEM_COMPONENTS[pick[0]]?.iconImg} icon={ITEM_COMPONENTS[pick[0]]?.icon} size={14} /> {ITEM_COMPONENTS[pick[0]]?.name} + ?</span>}
                      </div>
                    ) : resultItem ? (
                      <div>
                        <div style={{ fontSize: 14, color: 'var(--ui-primary)', marginBottom: 4 }}>
                          <GameIcon iconImg={ITEM_COMPONENTS[pick[0]]?.iconImg} icon={ITEM_COMPONENTS[pick[0]]?.icon} size={14} /> + <GameIcon iconImg={ITEM_COMPONENTS[pick[1]]?.iconImg} icon={ITEM_COMPONENTS[pick[1]]?.icon} size={14} /> =
                        </div>
                        <div style={{ fontSize: 28, marginBottom: 4 }}><GameIcon iconImg={resultItem[1].iconImg} icon={resultItem[1].icon} size={28} /></div>
                        <div style={{ fontSize: 16, fontWeight: 'bold', color: 'var(--ui-primary)', textShadow: '0 0 8px var(--ui-glow)' }}>{resultItem[1].name}</div>
                        <div style={{ fontSize: 11, color: '#00cc00', marginTop: 4 }}>{resultItem[1].desc}</div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 11, color: '#44ccff' }}>
                        <GameIcon iconImg={ITEM_COMPONENTS[pick[0]]?.iconImg} icon={ITEM_COMPONENTS[pick[0]]?.icon} size={14} /> + <GameIcon iconImg={ITEM_COMPONENTS[pick[1]]?.iconImg} icon={ITEM_COMPONENTS[pick[1]]?.icon} size={14} /> = No known schematic
                      </div>
                    )}
                  </div>
                  {/* Combo Grid */}
                  <div style={{ marginTop: 12, borderTop: '1px solid var(--ui-border-dim)', paddingTop: 8 }}>
                    <div style={{ fontSize: 10, color: 'var(--ui-secondary)', marginBottom: 6, letterSpacing: 1 }}>{'>'} FULL COMBINATION GRID:</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '100px repeat(6, 1fr)', gap: 2, fontSize: 10 }}>
                      <div style={{ color: 'var(--ui-secondary)', fontSize: 9, padding: 4 }}>COMPONENTS</div>
                      {Object.entries(ITEM_COMPONENTS).map(([key, c]) => (
                        <div key={key} onClick={() => togglePick(key)} style={{
                          textAlign: 'center', padding: 3, borderBottom: '1px solid var(--ui-border-dim)', cursor: 'pointer',
                          background: pick.includes(key) ? 'rgba(0,255,0,0.1)' : 'transparent',
                        }}>
                          <div style={{ fontSize: 16 }}><GameIcon iconImg={c.iconImg} icon={c.icon} size={16} /></div>
                          <div style={{ fontSize: 7, color: '#00cc00', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                        </div>
                      ))}
                      {Object.entries(ITEM_COMPONENTS).map(([rowKey, rowComp]) => (
                        <React.Fragment key={rowKey}>
                          <div onClick={() => togglePick(rowKey)} style={{
                            display: 'flex', alignItems: 'center', gap: 4, padding: '4px 4px',
                            borderRight: '1px solid var(--ui-border-dim)', cursor: 'pointer',
                            background: pick.includes(rowKey) ? 'rgba(0,255,0,0.1)' : 'transparent',
                          }}>
                            <span style={{ fontSize: 14 }}><GameIcon iconImg={rowComp.iconImg} icon={rowComp.icon} size={14} /></span>
                            <span style={{ fontSize: 8, color: '#00cc00', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rowComp.name}</span>
                          </div>
                          {Object.keys(ITEM_COMPONENTS).map(colKey => {
                            const combo = Object.values(COMPLETED_ITEMS).find(item =>
                              (item.recipe[0] === rowKey && item.recipe[1] === colKey) ||
                              (item.recipe[0] === colKey && item.recipe[1] === rowKey)
                            );
                            const isHighlighted = pick.length === 2 && combo && resultItem && combo === resultItem[1];
                            const isRowOrColSelected = pick.includes(rowKey) || pick.includes(colKey);
                            return (
                              <div key={colKey} title={combo ? `${combo.name}\n${combo.desc}` : ''} onClick={() => {
                                if (combo) { setSchematicPick(combo.recipe.slice()); }
                              }} style={{
                                textAlign: 'center', padding: 4, fontSize: 15,
                                background: isHighlighted ? 'rgba(0,255,0,0.35)' : isRowOrColSelected && combo ? 'rgba(0,80,0,0.3)' : combo ? 'rgba(0,40,0,0.25)' : 'rgba(0,0,0,0.3)',
                                border: isHighlighted ? '2px solid var(--ui-border)' : '1px solid rgba(0,100,0,0.15)',
                                borderRadius: 2, cursor: combo ? 'pointer' : 'default',
                                transition: 'all 0.15s',
                                boxShadow: isHighlighted ? '0 0 8px rgba(0,255,0,0.4)' : 'none',
                              }}>
                                {combo ? <GameIcon iconImg={combo.iconImg} icon={combo.icon} size={15} /> : <span style={{ color: '#003300' }}>·</span>}
                              </div>
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </div>
                );
              })()}

              {/* FIELD INTEL TAB — Pool Tracker */}
              {terminalTab === 'pool' && (
                <div>
                  <div style={{ fontSize: 11, color: '#00cc00', marginBottom: 10, letterSpacing: 1 }}>
                    {'>'} ACCESSING WASTELAND PERSONNEL DATABASE...
                  </div>
                  <input
                    type="text"
                    value={terminalSearch}
                    onChange={e => setTerminalSearch(e.target.value)}
                    placeholder="Search units..."
                    style={{ width: '100%', padding: '4px 8px', marginBottom: 8, background: 'rgba(0,20,0,0.6)', border: '1px solid var(--ui-secondary)', borderRadius: 3, color: 'var(--ui-primary)', fontFamily: 'inherit', fontSize: 11, boxSizing: 'border-box' }}
                  />
                  {[1, 2, 3, 4, 5].map(cost => {
                    const units = UNIT_KEYS.filter(k => UNIT_DATABASE[k].cost === cost).filter(k => !terminalSearch || UNIT_DATABASE[k].name.toLowerCase().includes(terminalSearch.toLowerCase()));
                    const maxPool = POOL_SIZES[cost];
                    const tierColor = COST_COLORS[cost];
                    const tierName = TIER_LABELS[cost];
                    return (
                      <div key={cost} style={{ marginBottom: 12 }}>
                        <div style={{
                          fontSize: 12, fontWeight: 'bold', marginBottom: 6,
                          borderBottom: `2px solid ${tierColor}44`, paddingBottom: 4,
                          display: 'flex', alignItems: 'center', gap: 8,
                        }}>
                          <span style={{
                            padding: '2px 10px', borderRadius: 3, fontSize: 10, fontWeight: 'bold', letterSpacing: 1,
                            background: `${tierColor}22`, border: `1px solid ${tierColor}66`, color: tierColor,
                            textShadow: `0 0 8px ${tierColor}66`,
                          }}>
                            {tierName.toUpperCase()}
                          </span>
                          <span style={{ color: 'var(--ui-secondary)', fontSize: 10 }}>COST {cost} — {maxPool} PER UNIT IN POOL</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 4 }}>
                          {units.map(unitKey => {
                            const remaining = poolRef.current[unitKey] ?? 0;
                            const pct = remaining / maxPool;
                            const barColor = pct > 0.5 ? tierColor : pct > 0.2 ? '#aaaa00' : pct > 0 ? '#ff6600' : '#ff0000';
                            const unitImg = getUnitImage(unitKey, 1);
                            return (
                              <div key={unitKey} style={{
                                padding: '6px 8px', background: 'rgba(0,15,0,0.5)',
                                border: `1px solid ${tierColor}33`, borderRadius: 3,
                                borderLeft: `3px solid ${tierColor}`,
                                display: 'flex', alignItems: 'center', gap: 8,
                              }}>
                                {/* Unit portrait */}
                                {unitImg ? (
                                  <img src={unitImg} alt={UNIT_DATABASE[unitKey].name} style={{
                                    width: 36, height: 36, objectFit: 'contain', borderRadius: 3,
                                    border: `1px solid ${tierColor}66`,
                                    flexShrink: 0,
                                  }} />
                                ) : (
                                  <div style={{
                                    width: 36, height: 36, borderRadius: 3,
                                    background: `linear-gradient(135deg, ${tierColor}33 0%, ${tierColor}11 100%)`,
                                    border: `1px solid ${tierColor}66`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 16, fontWeight: 'bold', color: tierColor,
                                    flexShrink: 0,
                                  }}>
                                    {UNIT_DATABASE[unitKey].name.charAt(0)}
                                  </div>
                                )}
                                {/* Unit info */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                                    <span style={{ fontSize: 10, color: tierColor, fontWeight: 'bold' }}>{UNIT_DATABASE[unitKey].name}</span>
                                    <span style={{ fontSize: 10, fontWeight: 'bold', color: barColor }}>{remaining}/{maxPool}</span>
                                  </div>
                                  {/* Pool bar */}
                                  <div style={{ width: '100%', height: 5, background: 'rgba(0,0,0,0.6)', borderRadius: 2, overflow: 'hidden' }}>
                                    <div style={{
                                      width: `${pct * 100}%`, height: '100%',
                                      background: `linear-gradient(90deg, ${barColor}, ${barColor}aa)`,
                                      borderRadius: 2, transition: 'width 0.3s',
                                      boxShadow: `0 0 6px ${barColor}66`,
                                    }} />
                                  </div>
                                  <div style={{ fontSize: 8, color: 'var(--ui-secondary)', opacity: 0.6, marginTop: 2 }}>
                                    {UNIT_DATABASE[unitKey].traits.join(' · ')}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

              {/* SHOP ODDS TAB */}
              {terminalTab === 'odds' && (
                <div>
                  <div style={{ fontSize: 11, color: '#00cc00', marginBottom: 10, letterSpacing: 1 }}>
                    {'>'} ACCESSING PROCUREMENT PROBABILITY MATRIX...
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--ui-secondary)', marginBottom: 8 }}>
                    {'>'} CURRENT LEVEL: <span style={{ color: 'var(--ui-primary)', fontWeight: 'bold', fontSize: 14 }}>LV.{level}</span> — Your odds are highlighted below.
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--ui-border-dim)' }}>
                          <th style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--ui-secondary)', fontSize: 10 }}>LEVEL</th>
                          {[1, 2, 3, 4, 5].map(cost => (
                            <th key={cost} style={{ padding: '6px 10px', textAlign: 'center', color: COST_COLORS[cost], fontSize: 10, textShadow: `0 0 6px ${COST_COLORS[cost]}44` }}>
                              {TIER_LABELS[cost].toUpperCase()}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(SHOP_ODDS).map(([lvl, odds]) => {
                          const isCurrentLevel = +lvl === level;
                          return (
                            <tr key={lvl} style={{
                              background: isCurrentLevel ? 'rgba(0,255,0,0.1)' : 'transparent',
                              borderBottom: '1px solid var(--ui-border-dim)',
                            }}>
                              <td style={{ padding: '5px 10px', color: isCurrentLevel ? 'var(--ui-primary)' : 'var(--ui-secondary)', fontWeight: isCurrentLevel ? 'bold' : 'normal', fontSize: isCurrentLevel ? 13 : 11 }}>
                                {isCurrentLevel ? '▶ ' : '  '}LV.{lvl}
                              </td>
                              {odds.map((pct, i) => (
                                <td key={i} style={{
                                  padding: '5px 10px', textAlign: 'center',
                                  color: pct === 0 ? '#333' : COST_COLORS[i + 1],
                                  fontWeight: pct > 0 && isCurrentLevel ? 'bold' : 'normal',
                                  fontSize: isCurrentLevel ? 13 : 11,
                                  textShadow: pct > 0 && isCurrentLevel ? `0 0 6px ${COST_COLORS[i + 1]}66` : 'none',
                                }}>
                                  {pct > 0 ? `${pct}%` : '—'}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ marginTop: 12, padding: 8, background: 'rgba(0,20,0,0.4)', borderRadius: 3, border: '1px solid var(--ui-border-dim)' }}>
                    <div style={{ fontSize: 10, color: 'var(--ui-secondary)', marginBottom: 4, letterSpacing: 1 }}>{'>'} ECONOMY INTEL:</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 9, color: '#00cc00' }}>
                      <div>💰 <span style={{ color: 'var(--ui-primary)' }}>Interest:</span> +1g per 10g saved (max 5)</div>
                      <div>🔄 <span style={{ color: 'var(--ui-primary)' }}>Reroll:</span> 2g to refresh shop</div>
                      <div>📈 <span style={{ color: 'var(--ui-primary)' }}>Buy XP:</span> 4g for 4 XP</div>
                      <div>🔥 <span style={{ color: 'var(--ui-primary)' }}>Win streak:</span> +1/2/3g at 2/4/6+ wins</div>
                      <div>💀 <span style={{ color: 'var(--ui-primary)' }}>Loss streak:</span> +1/2/3g at 2/4/6+ losses</div>
                      <div>⭐ <span style={{ color: 'var(--ui-primary)' }}>3-star:</span> 3x of 2★ (9 copies total)</div>
                    </div>
                  </div>
                </div>
              )}

              {/* SYNERGY CODEX TAB */}
              {terminalTab === 'synergies' && (
                <div>
                  <div style={{ fontSize: 11, color: '#00cc00', marginBottom: 10, letterSpacing: 1 }}>
                    {'>'} ACCESSING TACTICAL SYNERGY DATABASE...
                  </div>
                  <input
                    type="text"
                    value={terminalSearch}
                    onChange={e => setTerminalSearch(e.target.value)}
                    placeholder="Search synergies..."
                    style={{ width: '100%', padding: '4px 8px', marginBottom: 8, background: 'rgba(0,20,0,0.6)', border: '1px solid var(--ui-secondary)', borderRadius: 3, color: 'var(--ui-primary)', fontFamily: 'inherit', fontSize: 11, boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {Object.entries(TRAITS).filter(([key, trait]) => !terminalSearch || trait.name.toLowerCase().includes(terminalSearch.toLowerCase())).map(([traitKey, trait]) => {
                      const traitUnits = UNIT_KEYS.filter(k => UNIT_DATABASE[k].traits.includes(traitKey));
                      const activeSyn = synergies.find(s => s.trait === traitKey);
                      const activeCount = activeSyn?.count || 0;
                      return (
                        <div key={traitKey} style={{
                          padding: 8, background: activeCount >= 2 ? 'rgba(0,40,0,0.5)' : 'rgba(0,15,0,0.4)',
                          border: `1px solid ${activeCount >= 2 ? trait.color + '88' : 'var(--ui-border-dim)'}`,
                          borderLeft: `3px solid ${trait.color}`,
                          borderRadius: 3,
                        }}>
                          {/* Trait header */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <span style={{ fontSize: 18 }}><GameIcon iconImg={trait.iconImg} icon={trait.icon} size={18} /></span>
                            <span style={{ fontSize: 13, fontWeight: 'bold', color: trait.color, textShadow: activeCount >= 2 ? `0 0 8px ${trait.color}66` : 'none' }}>{trait.name}</span>
                            {activeCount >= 2 && (
                              <span style={{ marginLeft: 'auto', fontSize: 10, padding: '1px 6px', background: `${trait.color}33`, border: `1px solid ${trait.color}66`, borderRadius: 2, color: trait.color, fontWeight: 'bold' }}>
                                {activeCount} ACTIVE
                              </span>
                            )}
                          </div>
                          {/* Breakpoints */}
                          <div style={{ marginBottom: 6 }}>
                            {Object.entries(trait.bonuses).map(([count, desc]) => (
                              <div key={count} style={{
                                fontSize: 9, padding: '2px 0',
                                color: activeCount >= +count ? 'var(--ui-primary)' : 'var(--ui-secondary)',
                                opacity: activeCount >= +count ? 1 : 0.6,
                              }}>
                                <span style={{ color: activeCount >= +count ? trait.color : '#666', fontWeight: 'bold' }}>({count})</span> {desc}
                              </div>
                            ))}
                          </div>
                          {/* Units in this trait */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                            {traitUnits.map(unitKey => {
                              const cost = UNIT_DATABASE[unitKey].cost;
                              return (
                                <span key={unitKey} style={{
                                  fontSize: 8, padding: '1px 5px', borderRadius: 2,
                                  background: 'rgba(0,0,0,0.3)', border: `1px solid ${COST_COLORS[cost]}44`,
                                  color: COST_COLORS[cost],
                                }}>
                                  {UNIT_DATABASE[unitKey].name}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SCOUTING TAB */}
              {terminalTab === 'scout' && (
                <div>
                  <div style={{ fontSize: 11, color: '#00cc00', marginBottom: 10, letterSpacing: 1 }}>
                    {'>'} ACCESSING OPPONENT SURVEILLANCE FEEDS...
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {ghostPlayersRef.current.map(ghost => (
                      <div key={ghost.id} style={{
                        padding: 10, background: ghost.alive ? 'rgba(0,20,0,0.4)' : 'rgba(30,0,0,0.3)',
                        border: `1px solid ${ghost.alive ? 'var(--ui-border-dim)' : '#aa000044'}`,
                        borderRadius: 4, opacity: ghost.alive ? 1 : 0.5,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 'bold', color: ghost.alive ? 'var(--ui-primary)' : '#ff4444' }}>{ghost.name}</span>
                          <div style={{ display: 'flex', gap: 8, fontSize: 10 }}>
                            <span style={{ color: 'var(--ui-secondary)' }}>LV.{ghost.level}</span>
                            <span style={{ color: ghost.hp > 50 ? '#00ff00' : ghost.hp > 25 ? '#ffff00' : '#ff4444' }}>{ghost.hp} HP</span>
                            {!ghost.alive && <span style={{ color: '#44ccff', fontWeight: 'bold' }}>ELIMINATED</span>}
                          </div>
                        </div>
                        {/* Preferred traits */}
                        <div style={{ fontSize: 9, color: 'var(--ui-secondary)', marginBottom: 6 }}>
                          Favors: {ghost.preferredTraits.map((t, i) => { const tr = TRAITS[t]; return tr ? <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>{i > 0 && ' \u00B7 '}<GameIcon iconImg={tr.iconImg} icon={tr.icon} size={9} /> {t}</span> : t; })}
                        </div>
                        {/* HP bar */}
                        <div style={{ width: '100%', height: 4, background: 'rgba(0,0,0,0.5)', borderRadius: 2, overflow: 'hidden', marginBottom: 6 }}>
                          <div style={{ width: `${ghost.hp}%`, height: '100%', background: ghost.hp > 50 ? '#00ff00' : ghost.hp > 25 ? '#ffff00' : '#ff4444', borderRadius: 2, transition: 'width 0.3s' }} />
                        </div>
                        {/* Board units */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                          {ghost.board.length === 0 ? (
                            <div style={{ fontSize: 9, opacity: 0.4 }}>No units</div>
                          ) : ghost.board.map((u, idx) => {
                            const unitImg = getUnitImage(u.id, u.stars);
                            const cost = UNIT_DATABASE[u.id]?.cost || 1;
                            return (
                              <div key={idx} style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center',
                                padding: 2, background: 'rgba(0,0,0,0.3)',
                                border: `1px solid ${COST_COLORS[cost]}44`, borderRadius: 3, width: 44,
                              }}>
                                {unitImg ? (
                                  <img src={unitImg} alt="" style={{ width: 26, height: 26, objectFit: 'contain' }} />
                                ) : (
                                  <UnitPlaceholder name={UNIT_DATABASE[u.id]?.name} size={26} />
                                )}
                                <div style={{ fontSize: 7, color: COST_COLORS[cost] }}>{UNIT_DATABASE[u.id]?.name?.split(' ')[0]}</div>
                                <div style={{ fontSize: 7 }}>{stars(u.stars)}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* MATCH LOG TAB */}
              {terminalTab === 'history' && (
                <div>
                  <div style={{ fontSize: 11, color: '#00cc00', marginBottom: 10, letterSpacing: 1 }}>
                    {'>'} COMBAT ENGAGEMENT LOG
                  </div>
                  {matchHistory.length === 0 ? (
                    <div style={{ fontSize: 11, color: 'var(--ui-secondary)', opacity: 0.5 }}>No engagements recorded.</div>
                  ) : (
                    <div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'inherit' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--ui-border-dim)' }}>
                            {['RND', 'RESULT', 'OPPONENT', 'DMG TAKEN', 'UNITS ALIVE'].map(h => (
                              <th key={h} style={{ padding: '4px 6px', textAlign: 'left', color: '#00cc00', fontWeight: 'bold', fontSize: 10, letterSpacing: 1 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {matchHistory.map((entry, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid var(--ui-border-dim)' }}>
                              <td style={{ padding: '3px 6px', color: 'var(--ui-primary)' }}>{entry.round}</td>
                              <td style={{ padding: '3px 6px', color: entry.won ? 'var(--ui-primary)' : '#ff4444', fontWeight: 'bold' }}>{entry.won ? 'W' : 'L'}</td>
                              <td style={{ padding: '3px 6px', color: '#00cc00' }}>{entry.opponent}</td>
                              <td style={{ padding: '3px 6px', color: entry.damage > 0 ? '#ff4444' : 'var(--ui-primary)' }}>{entry.damage}</td>
                              <td style={{ padding: '3px 6px', color: 'var(--ui-secondary)' }}>{entry.unitsAlive}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div style={{ marginTop: 10, padding: '6px 8px', background: 'rgba(0,20,0,0.4)', border: '1px solid var(--ui-border-dim)', borderRadius: 4, fontSize: 10, display: 'flex', gap: 16 }}>
                        <span style={{ color: 'var(--ui-primary)' }}>WINS: {matchHistory.filter(e => e.won).length}</span>
                        <span style={{ color: '#44ccff' }}>LOSSES: {matchHistory.filter(e => !e.won).length}</span>
                        <span style={{ color: '#ffaa00' }}>TOTAL DMG TAKEN: {matchHistory.reduce((s, e) => s + e.damage, 0)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* DAMAGE STATS TAB */}
              {terminalTab === 'damage' && (() => {
                const entries = Object.keys(damageStats)
                  .filter(k => !k.endsWith('_name'))
                  .map(uid => ({ uid, name: damageStats[uid + '_name'] || uid, damage: Math.round(damageStats[uid]) }))
                  .sort((a, b) => b.damage - a.damage);
                const maxDmg = entries.length > 0 ? entries[0].damage : 1;
                return (
                  <div>
                    <div style={{ fontSize: 11, color: '#00cc00', marginBottom: 10, letterSpacing: 1 }}>
                      {'>'} LAST ENGAGEMENT — UNIT DAMAGE OUTPUT
                    </div>
                    {entries.length === 0 ? (
                      <div style={{ fontSize: 11, color: 'var(--ui-secondary)', opacity: 0.5 }}>No combat data recorded.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {entries.map(e => (
                          <div key={e.uid} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 110, fontSize: 10, color: 'var(--ui-primary)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</span>
                            <div style={{ flex: 1, height: 14, background: 'rgba(0,0,0,0.4)', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
                              <div style={{
                                width: `${Math.max(2, (e.damage / maxDmg) * 100)}%`, height: '100%',
                                background: 'linear-gradient(90deg, var(--ui-secondary), var(--ui-primary))',
                                borderRadius: 2, transition: 'width 0.3s',
                              }} />
                            </div>
                            <span style={{ width: 50, fontSize: 10, color: '#00cc00', textAlign: 'right', flexShrink: 0 }}>{e.damage}</span>
                          </div>
                        ))}
                        <div style={{ marginTop: 8, fontSize: 10, color: 'var(--ui-secondary)', opacity: 0.7 }}>
                          TOTAL: {entries.reduce((s, e) => s + e.damage, 0)} damage
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* LEADERBOARD TAB */}
              {terminalTab === 'leaderboard' && (() => {
                const allPlayers = [
                  { name: 'YOU (Overseer)', hp, level, unitCount: board.filter(u => u).length, alive: hp > 0, isPlayer: true },
                  ...ghostPlayersRef.current.map(g => ({ name: g.name, hp: g.hp, level: g.level, unitCount: g.board.length, alive: g.alive, isPlayer: false }))
                ].sort((a, b) => b.alive - a.alive || b.hp - a.hp);
                return (
                  <div>
                    <div style={{ fontSize: 11, color: '#00cc00', marginBottom: 10, letterSpacing: 1 }}>
                      {'>'} WASTELAND STANDINGS — ROUND {round}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {allPlayers.map((p, idx) => {
                        const rank = idx + 1;
                        const isEliminated = !p.alive;
                        return (
                          <div key={p.name + idx} style={{
                            display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px',
                            background: p.isPlayer ? 'rgba(0,60,0,0.5)' : isEliminated ? 'rgba(30,0,0,0.3)' : 'rgba(0,20,0,0.3)',
                            border: `1px solid ${p.isPlayer ? 'var(--ui-border-dim)' : isEliminated ? '#aa000033' : 'var(--ui-border-dim)'}`,
                            borderRadius: 4, opacity: isEliminated ? 0.5 : 1,
                          }}>
                            <span style={{ fontSize: 14, fontWeight: 'bold', color: rank <= 3 ? '#ffcc00' : 'var(--ui-secondary)', width: 28, textAlign: 'center' }}>
                              #{rank}
                            </span>
                            <span style={{ fontSize: 12, fontWeight: p.isPlayer ? 'bold' : 'normal', color: p.isPlayer ? '#44ff44' : isEliminated ? '#ff4444' : 'var(--ui-primary)', flex: 1 }}>
                              {p.name}
                            </span>
                            {/* HP Bar */}
                            <div style={{ width: 120, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ flex: 1, height: 6, background: 'rgba(0,0,0,0.5)', borderRadius: 3, overflow: 'hidden' }}>
                                <div style={{
                                  width: `${Math.max(0, p.hp)}%`, height: '100%',
                                  background: p.hp > 50 ? '#00ff00' : p.hp > 25 ? '#ffff00' : '#ff4444',
                                  borderRadius: 3, transition: 'width 0.3s',
                                }} />
                              </div>
                              <span style={{ fontSize: 10, color: p.hp > 50 ? '#00ff00' : p.hp > 25 ? '#ffff00' : '#ff4444', width: 32, textAlign: 'right' }}>
                                {p.hp}
                              </span>
                            </div>
                            <span style={{ fontSize: 10, color: 'var(--ui-secondary)', width: 40, textAlign: 'center' }}>LV.{p.level}</span>
                            <span style={{ fontSize: 10, color: 'var(--ui-secondary)', width: 50, textAlign: 'center' }}>{p.unitCount} units</span>
                            {isEliminated && (
                              <span style={{ fontSize: 9, color: '#44ccff', fontWeight: 'bold', letterSpacing: 1, padding: '1px 6px', border: '1px solid #ff444466', borderRadius: 2 }}>
                                ELIMINATED
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* ENCYCLOPEDIA TAB */}
              {terminalTab === 'encyclopedia' && (
                <div style={{ display: 'flex', gap: 12, height: 400 }}>
                  {/* Left: Unit list grouped by cost */}
                  <div style={{ width: 200, overflowY: 'auto', borderRight: '1px solid var(--ui-border-dim)', paddingRight: 10 }}>
                    {[1, 2, 3, 4, 5].map(cost => {
                      const unitsOfCost = Object.entries(UNIT_DATABASE).filter(([, u]) => u.cost === cost);
                      if (unitsOfCost.length === 0) return null;
                      return (
                        <div key={cost} style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 10, fontWeight: 'bold', color: COST_COLORS[cost], letterSpacing: 1, marginBottom: 4, borderBottom: `1px solid ${COST_COLORS[cost]}44`, paddingBottom: 2 }}>
                            {TIER_LABELS[cost]} — {cost} CAPS
                          </div>
                          {unitsOfCost.map(([key, unit]) => {
                            const img = getUnitImage(key, 1);
                            return (
                              <div key={key}
                                onClick={() => setEncyclopediaUnit(key)}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 6, padding: '3px 6px', cursor: 'pointer',
                                  background: encyclopediaUnit === key ? 'rgba(0,60,0,0.5)' : 'transparent',
                                  border: encyclopediaUnit === key ? '1px solid var(--ui-border-dim)' : '1px solid transparent',
                                  borderRadius: 3, marginBottom: 2,
                                }}
                              >
                                {img ? (
                                  <img src={img} alt="" style={{ width: 22, height: 22, objectFit: 'contain' }} />
                                ) : (
                                  <UnitPlaceholder name={unit.name} size={22} />
                                )}
                                <span style={{ fontSize: 10, color: COST_COLORS[cost] }}>{unit.name}</span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                  {/* Right: Unit dossier */}
                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    {!encyclopediaUnit ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--ui-secondary)', opacity: 0.5, fontSize: 12 }}>
                        {'>'} SELECT A UNIT TO VIEW DOSSIER
                      </div>
                    ) : (() => {
                      const unit = UNIT_DATABASE[encyclopediaUnit];
                      const img = getUnitImage(encyclopediaUnit, 1);
                      const cost = unit.cost;
                      const unitTraits = unit.traits || [];
                      // Find other units sharing traits
                      const synergyUnits = {};
                      unitTraits.forEach(t => {
                        synergyUnits[t] = Object.entries(UNIT_DATABASE)
                          .filter(([k, u]) => k !== encyclopediaUnit && u.traits?.includes(t))
                          .map(([k, u]) => ({ key: k, name: u.name, cost: u.cost }));
                      });
                      return (
                        <div>
                          {/* Header */}
                          <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
                            <div style={{ width: 80, height: 80, background: 'rgba(0,0,0,0.4)', border: `2px solid ${COST_COLORS[cost]}`, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {img ? (
                                <img src={img} alt="" style={{ width: 70, height: 70, objectFit: 'contain' }} />
                              ) : (
                                <UnitPlaceholder name={unit.name} size={70} />
                              )}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 16, fontWeight: 'bold', color: COST_COLORS[cost], letterSpacing: 1 }}>{unit.name}</div>
                              <div style={{ fontSize: 11, color: COST_COLORS[cost], opacity: 0.8, marginBottom: 6 }}>
                                {TIER_LABELS[cost]} — {cost} Caps
                              </div>
                              {/* Traits */}
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {unitTraits.map(t => {
                                  const trait = TRAITS[t];
                                  return trait ? (
                                    <span key={t} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 3, background: `${trait.color}22`, border: `1px solid ${trait.color}66`, color: trait.color }}>
                                      <GameIcon iconImg={trait.iconImg} icon={trait.icon} size={10} /> {t}
                                    </span>
                                  ) : null;
                                })}
                              </div>
                            </div>
                          </div>
                          {/* Stats */}
                          <div style={{ marginBottom: 12, padding: 10, background: 'rgba(0,20,0,0.3)', border: '1px solid var(--ui-border-dim)', borderRadius: 4 }}>
                            <div style={{ fontSize: 10, fontWeight: 'bold', color: '#00cc00', letterSpacing: 1, marginBottom: 6 }}>COMBAT STATISTICS</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                              {[
                                { label: 'HP', value: unit.hp, color: '#44ff44' },
                                { label: 'ATK', value: unit.atk, color: '#ff6644' },
                                { label: 'DEF', value: unit.def, color: '#6699ff' },
                                { label: 'Range', value: unit.range, color: '#ffcc44' },
                                { label: 'ATK Speed', value: unit.attackSpeed ? `${unit.attackSpeed}s` : 'N/A', color: '#ffcc44' },
                                { label: 'AP Cost', value: unit.apMax || 'N/A', color: '#cc66ff' },
                              ].map(s => (
                                <div key={s.label} style={{ fontSize: 10 }}>
                                  <span style={{ color: 'var(--ui-secondary)' }}>{s.label}: </span>
                                  <span style={{ color: s.color, fontWeight: 'bold' }}>{s.value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          {/* Ability */}
                          {unit.ability && (
                            <div style={{ marginBottom: 12, padding: 10, background: 'rgba(0,20,0,0.3)', border: '1px solid #cc66ff33', borderRadius: 4 }}>
                              <div style={{ fontSize: 10, fontWeight: 'bold', color: '#cc66ff', letterSpacing: 1, marginBottom: 4 }}>ABILITY: {unit.ability}</div>
                              <div style={{ fontSize: 10, color: '#00cc00', lineHeight: 1.4 }}>{unit.abilityDesc || 'No description available.'}</div>
                            </div>
                          )}
                          {/* Passive */}
                          {unit.passiveDesc && (
                            <div style={{ marginBottom: 12, padding: 10, background: 'rgba(0,20,0,0.3)', border: '1px solid #ffaa0033', borderRadius: 4 }}>
                              <div style={{ fontSize: 10, fontWeight: 'bold', color: '#ffaa00', letterSpacing: 1, marginBottom: 4 }}>PASSIVE</div>
                              <div style={{ fontSize: 10, color: '#00cc00', lineHeight: 1.4 }}>{unit.passiveDesc}</div>
                            </div>
                          )}
                          {/* Synergy tip */}
                          <div style={{ padding: 10, background: 'rgba(0,20,0,0.3)', border: '1px solid var(--ui-border-dim)', borderRadius: 4 }}>
                            <div style={{ fontSize: 10, fontWeight: 'bold', color: '#00cc00', letterSpacing: 1, marginBottom: 6 }}>SYNERGY INTEL</div>
                            {unitTraits.map(t => {
                              const trait = TRAITS[t];
                              const others = synergyUnits[t] || [];
                              if (!trait || others.length === 0) return null;
                              return (
                                <div key={t} style={{ marginBottom: 6 }}>
                                  <div style={{ fontSize: 10, color: trait.color, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 3 }}><GameIcon iconImg={trait.iconImg} icon={trait.icon} size={10} /> {t} — shares trait with:</div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                                    {others.map(o => (
                                      <span key={o.key}
                                        onClick={() => setEncyclopediaUnit(o.key)}
                                        style={{ fontSize: 9, padding: '1px 6px', borderRadius: 2, cursor: 'pointer', background: 'rgba(0,0,0,0.3)', border: `1px solid ${COST_COLORS[o.cost]}44`, color: COST_COLORS[o.cost] }}
                                      >
                                        {o.name}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* ECONOMY SIMULATOR TAB */}
              {terminalTab === 'economy' && (() => {
                const baseIncome = round >= 5 ? 5 : round >= 4 ? 4 : round >= 3 ? 3 : 2;
                const interest = Math.min(Math.floor(gold / 10), 5);
                const absStreak = Math.abs(streak);
                const streakBonus = absStreak >= 6 ? 3 : absStreak >= 4 ? 2 : absStreak >= 2 ? 1 : 0;
                return (
                  <div>
                    <div style={{ fontSize: 11, color: '#00cc00', marginBottom: 10, letterSpacing: 1 }}>
                      {'>'} ECONOMY SIMULATION TERMINAL
                    </div>

                    {/* Current State */}
                    <div style={{ marginBottom: 14, padding: 10, background: 'rgba(0,20,0,0.3)', border: '1px solid var(--ui-border-dim)', borderRadius: 4 }}>
                      <div style={{ fontSize: 10, fontWeight: 'bold', color: '#00cc00', letterSpacing: 1, marginBottom: 6 }}>CURRENT STATUS</div>
                      <div style={{ display: 'flex', gap: 20, fontSize: 11 }}>
                        <span>Level: <span style={{ color: '#44ff44', fontWeight: 'bold' }}>{level}</span></span>
                        <span>Gold: <span style={{ color: '#ffcc00', fontWeight: 'bold' }}>{gold}</span></span>
                        <span>XP: <span style={{ color: '#cc66ff', fontWeight: 'bold' }}>{xp}/{xpNeeded}</span></span>
                        <span>Round: <span style={{ color: '#44ff44', fontWeight: 'bold' }}>{round}</span></span>
                        <span>Streak: <span style={{ color: streak > 0 ? '#44ff44' : streak < 0 ? '#ff6644' : 'var(--ui-secondary)', fontWeight: 'bold' }}>{streak}</span></span>
                      </div>
                    </div>

                    {/* Rounds to Level Calculator */}
                    <div style={{ marginBottom: 14, padding: 10, background: 'rgba(0,20,0,0.3)', border: '1px solid #cc66ff33', borderRadius: 4 }}>
                      <div style={{ fontSize: 10, fontWeight: 'bold', color: '#cc66ff', letterSpacing: 1, marginBottom: 6 }}>ROUNDS TO LEVEL UP</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4, fontSize: 10 }}>
                        <div style={{ fontWeight: 'bold', color: 'var(--ui-secondary)' }}>Target</div>
                        <div style={{ fontWeight: 'bold', color: 'var(--ui-secondary)' }}>XP Needed</div>
                        <div style={{ fontWeight: 'bold', color: 'var(--ui-secondary)' }}>Natural (2/rnd)</div>
                        <div style={{ fontWeight: 'bold', color: 'var(--ui-secondary)' }}>Buying XP (4g)</div>
                      </div>
                      {Array.from({ length: Math.max(0, 9 - level) }, (_, i) => {
                        const targetLvl = level + 1 + i;
                        // Calculate total XP needed from current state to target level
                        let totalXpNeeded = xpNeeded - xp; // XP to next level first
                        for (let lv = level + 1; lv < targetLvl; lv++) {
                          totalXpNeeded += XP_TO_LEVEL[lv + 1] || 60;
                        }
                        const naturalRounds = Math.ceil(totalXpNeeded / 2);
                        // Buying XP: 4g buys 4xp, so 6xp per round (2 natural + 4 bought)
                        const buyingRounds = Math.ceil(totalXpNeeded / 6);
                        return (
                          <div key={targetLvl} style={{ display: 'contents' }}>
                            <div style={{ padding: '2px 0', color: '#44ff44', fontSize: 10 }}>Level {targetLvl}</div>
                            <div style={{ padding: '2px 0', color: '#ffcc00', fontSize: 10 }}>{totalXpNeeded} XP</div>
                            <div style={{ padding: '2px 0', color: '#00cc00', fontSize: 10 }}>{naturalRounds} rounds</div>
                            <div style={{ padding: '2px 0', color: '#cc66ff', fontSize: 10 }}>{buyingRounds} rounds</div>
                          </div>
                        );
                      })}
                      {level >= 9 && <div style={{ fontSize: 10, color: '#ffcc00', marginTop: 4 }}>MAX LEVEL REACHED</div>}
                    </div>

                    {/* Interest Breakpoints */}
                    <div style={{ marginBottom: 14, padding: 10, background: 'rgba(0,20,0,0.3)', border: '1px solid #ffcc0033', borderRadius: 4 }}>
                      <div style={{ fontSize: 10, fontWeight: 'bold', color: '#ffcc00', letterSpacing: 1, marginBottom: 6 }}>INTEREST BREAKPOINTS</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                        {[10, 20, 30, 40, 50].map(threshold => {
                          const intGold = Math.min(Math.floor(threshold / 10), 5);
                          const isActive = gold >= threshold;
                          return (
                            <div key={threshold} style={{
                              padding: '6px 8px', textAlign: 'center', borderRadius: 4,
                              background: isActive ? 'rgba(0,60,0,0.4)' : 'rgba(0,0,0,0.3)',
                              border: `1px solid ${isActive ? '#ffcc0066' : 'var(--ui-border-dim)'}`,
                            }}>
                              <div style={{ fontSize: 12, fontWeight: 'bold', color: isActive ? '#ffcc00' : '#666' }}>{threshold}g</div>
                              <div style={{ fontSize: 10, color: isActive ? '#44ff44' : '#555' }}>+{intGold}g</div>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--ui-secondary)', opacity: 0.6, marginTop: 6 }}>
                        Current gold: {gold}g = +{interest}g interest (max +5g at 50g)
                      </div>
                    </div>

                    {/* Income Projection */}
                    <div style={{ padding: 10, background: 'rgba(0,20,0,0.3)', border: '1px solid #44ff4433', borderRadius: 4 }}>
                      <div style={{ fontSize: 10, fontWeight: 'bold', color: '#44ff44', letterSpacing: 1, marginBottom: 6 }}>NEXT ROUND INCOME PROJECTION</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--ui-secondary)' }}>Base Income:</span>
                          <span style={{ color: '#44ff44', fontWeight: 'bold' }}>+{baseIncome}g</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--ui-secondary)' }}>Interest ({gold}g):</span>
                          <span style={{ color: '#ffcc00', fontWeight: 'bold' }}>+{interest}g</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--ui-secondary)' }}>Streak Bonus ({streak >= 0 ? '+' : ''}{streak}):</span>
                          <span style={{ color: absStreak > 0 ? '#44ff44' : '#666', fontWeight: 'bold' }}>+{streakBonus}g</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--ui-border-dim)', paddingTop: 4, marginTop: 2 }}>
                          <span style={{ color: 'var(--ui-primary)', fontWeight: 'bold' }}>Projected Total:</span>
                          <span style={{ color: '#44ff44', fontWeight: 'bold', fontSize: 13 }}>+{baseIncome + interest + streakBonus}g</span>
                        </div>
                        <div style={{ fontSize: 9, color: 'var(--ui-secondary)', opacity: 0.5, marginTop: 4 }}>
                          * Win bonus (+1g) not included. Augment bonuses calculated separately.
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

            {/* Terminal Footer */}
            <div style={{ padding: '6px 16px', borderTop: '1px solid var(--ui-border-dim)', background: 'rgba(0,30,0,0.2)', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 9, color: 'var(--ui-secondary)', opacity: 0.5 }}>VAULT-TEC PROPRIETARY — AUTHORIZED ACCESS ONLY</span>
              <span style={{ fontSize: 9, color: 'var(--ui-secondary)', opacity: 0.5 }}>ROUND {round} | LV.{level}</span>
            </div>
          </div>
        )}
        {/* Terminal toggle button */}
        <button onClick={() => { setCheatSheetOpen(o => { if (!o) sound.terminalOpen(); return !o; }); }} style={{
          width: '100%', padding: '6px 16px', fontSize: 12,
          background: cheatSheetOpen ? 'rgba(0,30,0,0.95)' : 'rgba(10,8,4,0.92)',
          border: '1px solid var(--ui-border-dim)', borderBottom: 'none',
          borderRadius: cheatSheetOpen ? '0' : '6px 6px 0 0',
          color: 'var(--ui-primary)',
          cursor: 'pointer', fontFamily: '"Share Tech Mono", monospace', textAlign: 'center',
          textShadow: '0 0 8px var(--ui-glow)',
          letterSpacing: 2,
          pointerEvents: 'auto',
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          boxShadow: '0 -2px 10px rgba(0,0,0,0.4)',
        }}>
          {cheatSheetOpen ? '▼ CLOSE TERMINAL' : '▶ OVERSEER TERMINAL'}
        </button>
      </div>

      {/* Pointer drag preview – smooth floating card */}
      {pointerDrag && (
        <div ref={dragPreviewRef} style={{
          position: 'fixed', left: 0, top: 0,
          transform: `translate(${pointerDrag.startX}px, ${pointerDrag.startY}px) translate(-50%, -50%)`,
          width: 54, height: 66, zIndex: 2500, pointerEvents: 'none',
          willChange: 'transform',
          background: `linear-gradient(180deg, ${getColor(pointerDrag.unit.cost)}88 0%, ${getColor(pointerDrag.unit.cost)}44 100%)`,
          border: '2px solid #00ff00', borderRadius: 4, boxShadow: '0 0 20px rgba(0,255,0,0.5)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          {getUnitImage(pointerDrag.unit.id, pointerDrag.unit.stars) ? (
            <img src={getUnitImage(pointerDrag.unit.id, pointerDrag.unit.stars)} alt="" style={{ width: 42, height: 42, objectFit: pointerDrag.unit.id === 'nick' ? 'cover' : 'contain', borderRadius: pointerDrag.unit.id === 'nick' ? '50%' : undefined }} />
          ) : (
            <UnitPlaceholder name={pointerDrag.unit.name} size={42} />
          )}
          <div style={{ fontSize: 9 }}>{stars(pointerDrag.unit.stars)}</div>
        </div>
      )}

      {/* Item drag preview – floating icon follows pointer */}
      {itemDrag && (() => {
        const comp = ITEM_COMPONENTS[itemDrag.itemKey];
        if (!comp) return null;
        return React.createElement('div', {
          ref: itemDragPreviewRef,
          style: {
            position: 'fixed', left: 0, top: 0,
            transform: `translate(${itemDrag.startX}px, ${itemDrag.startY}px) translate(-50%, -50%)`,
            width: 42, height: 42, zIndex: 2500, pointerEvents: 'none',
            willChange: 'transform',
            background: 'linear-gradient(180deg, rgba(255,170,0,0.7) 0%, rgba(100,60,0,0.7) 100%)',
            border: '2px solid #ffaa00', borderRadius: 6,
            boxShadow: '0 0 20px rgba(255,170,0,0.6), 0 0 40px rgba(255,170,0,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22,
          }
        }, createGameIcon(comp.iconImg, comp.icon, 22));
      })()}

      {/* Floating damage numbers */}
      {floatingNumbers.map(({ id, damage, isCrit, x, y, isEnemyHit }) => (
        <div key={id} className="wt-float-up" style={{
          position: 'fixed', left: x, top: y,
          fontSize: isCrit ? 24 : 18, fontWeight: 'bold', pointerEvents: 'none', zIndex: 2600,
          color: isEnemyHit ? '#ff4444' : (isCrit ? '#ff8844' : '#ffcc00'),
          textShadow: isEnemyHit
            ? '0 0 6px #ff0000, 0 0 12px #880000, 1px 1px 0 #000'
            : (isCrit
              ? '0 0 8px #ff8844, 0 0 16px #ff4400, 1px 1px 0 #000'
              : '0 0 6px #ffcc00, 0 0 12px #886600, 1px 1px 0 #000'),
        }}>
          {isEnemyHit ? '-' : '-'}{damage}{isCrit ? '!' : ''}
        </div>
      ))}

      {/* Income overlay removed — now shown permanently in bottom bar */}

      {/* Unit Tooltip */}
      <UnitTooltip unitTooltip={unitTooltip} onClose={() => setUnitTooltip(null)} />

      {/* Item Selection Overlay — Glassmorphism */}
      {itemSelection && (() => {
        const STAT_COLORS = { def: '#6688ff', hp: '#44cc88', atk: '#ff6666', apGain: '#cc88ff', dodge: '#aa66ff', abilityPower: '#ffaa00' };
        const STAT_RARITY = { def: { color: '#888', label: 'Common' }, hp: { color: '#888', label: 'Common' }, atk: { color: '#4CAF50', label: 'Uncommon' }, apGain: { color: '#2196F3', label: 'Rare' }, dodge: { color: '#9C27B0', label: 'Epic' }, abilityPower: { color: '#FF9800', label: 'Legendary' } };
        // Find what this component can combine into
        const getCombinesInto = (itemKey) => {
          const results = [];
          for (const [ciKey, ci] of Object.entries(COMPLETED_ITEMS)) {
            if (ci.recipe.includes(itemKey)) results.push(ci);
          }
          return results;
        };
        return (
        <div className="wt-item-select-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(14,27,43,0.4)', backdropFilter: 'blur(12px) saturate(1.4) brightness(0.85)', WebkitBackdropFilter: 'blur(12px) saturate(1.4) brightness(0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2500 }}>
          {/* Animated shimmer overlay */}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(120deg, transparent 30%, rgba(212,168,68,0.03) 50%, transparent 70%)', backgroundSize: '200% 100%', animation: 'wt-item-shimmer 3s ease-in-out infinite', pointerEvents: 'none' }} />
          {/* Modal container */}
          <div style={{
            background: 'rgba(14,27,43,0.7)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(212,168,68,0.3)', borderRadius: 16, padding: '36px 48px',
            textAlign: 'center', maxWidth: 700, width: '90vw',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 20px 60px rgba(0,0,0,0.5)',
          }}>
            {/* Header */}
            <div style={{ fontSize: 26, fontWeight: 'bold', color: '#D4A844', marginBottom: 6, letterSpacing: 2, textShadow: '0 0 20px rgba(212,168,68,0.4), 0 0 40px rgba(212,168,68,0.15)' }}>Choose an Item Component</div>
            <div style={{ fontSize: 11, color: 'rgba(200,180,140,0.5)', marginBottom: 28, letterSpacing: 0.5 }}>Components combine into full items when paired on a unit</div>
            {/* Cards */}
            <div style={{ display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap' }}>
              {itemSelection.items.map((itemKey, idx) => {
                const comp = ITEM_COMPONENTS[itemKey];
                if (!comp) return null;
                const rarity = STAT_RARITY[comp.stat] || { color: '#888', label: 'Common' };
                const statColor = STAT_COLORS[comp.stat] || '#aaffaa';
                const combinesInto = getCombinesInto(itemKey);
                return (
                  <div key={idx} className="wt-item-card-select"
                    onClick={() => {
                      setItemInventory(prev => [...prev, itemKey]);
                      setItemSelection(null);
                      setLog(prev => [`🔩 Acquired ${comp.name}!`, ...prev.slice(0, 9)]);
                      sound.upgrade();
                    }}
                    style={{
                      width: 160, minHeight: 200, padding: '20px 16px 16px',
                      background: 'rgba(10,18,30,0.6)',
                      border: `1.5px solid ${rarity.color}55`,
                      borderRadius: 12, cursor: 'pointer', textAlign: 'center',
                      transition: 'all 0.25s ease-out',
                      position: 'relative', overflow: 'hidden',
                      animation: `wt-item-card-enter 0.4s ease-out ${idx * 0.1}s both`,
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'scale(1.05) translateY(-4px)';
                      e.currentTarget.style.borderColor = rarity.color;
                      e.currentTarget.style.boxShadow = `0 0 20px ${rarity.color}33, 0 8px 32px rgba(0,0,0,0.4)`;
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = '';
                      e.currentTarget.style.borderColor = `${rarity.color}55`;
                      e.currentTarget.style.boxShadow = '';
                    }}
                  >
                    {/* Rarity glow behind icon */}
                    <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', width: 90, height: 90, background: `radial-gradient(circle, ${rarity.color}15 0%, transparent 70%)`, pointerEvents: 'none', transition: 'opacity 0.25s' }} />
                    {/* Icon */}
                    <div style={{ position: 'relative', marginBottom: 12 }}>
                      {createGameIcon(comp.iconImg, comp.icon, 64)}
                    </div>
                    {/* Rarity label */}
                    <div style={{ fontSize: 8, fontWeight: 'bold', color: rarity.color, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6, opacity: 0.8 }}>{rarity.label}</div>
                    {/* Name */}
                    <div style={{ fontSize: 14, fontWeight: 'bold', color: '#fff', marginBottom: 6, lineHeight: 1.2 }}>{comp.name}</div>
                    {/* Stat bonus */}
                    <div style={{ fontSize: 13, fontWeight: 'bold', color: statColor, marginBottom: 8 }}>{comp.desc}</div>
                    {/* Combines into */}
                    {combinesInto.length > 0 && (
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8, marginTop: 4 }}>
                        <div style={{ fontSize: 8, color: 'rgba(200,180,140,0.4)', letterSpacing: 0.5, marginBottom: 4 }}>COMBINES INTO</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, justifyContent: 'center' }}>
                          {combinesInto.slice(0, 3).map((ci, i) => (
                            <span key={i} style={{ fontSize: 8, color: 'rgba(212,168,68,0.7)', background: 'rgba(212,168,68,0.08)', padding: '1px 5px', borderRadius: 3, border: '1px solid rgba(212,168,68,0.15)' }}>{ci.name}</span>
                          ))}
                          {combinesInto.length > 3 && <span style={{ fontSize: 8, color: 'rgba(200,180,140,0.3)' }}>+{combinesInto.length - 3}</span>}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        );
      })()}

      {/* Continue Prompt */}
      {showContinuePrompt && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3100 }}>
          <div style={{ background: 'linear-gradient(180deg, #001a00 0%, #0a0a00 100%)', border: '3px solid var(--ui-border)', borderRadius: 8, padding: 30, textAlign: 'center', boxShadow: '0 0 50px var(--ui-glow)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>☢️</div>
            <div style={{ fontSize: 20, fontWeight: 'bold', color: 'var(--ui-primary)', marginBottom: 16 }}>Save Found!</div>
            <div style={{ fontSize: 14, color: '#aaffaa', marginBottom: 20 }}>Continue your previous run?</div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={() => { setShowContinuePrompt(false); }} style={{ padding: '10px 24px', fontSize: 14, background: 'rgba(100,0,0,0.4)', border: '1px solid #ff6666', borderRadius: 4, color: '#ff6666', cursor: 'pointer', fontFamily: 'inherit' }}>New Game</button>
              <button onClick={() => { loadGame(); setShowContinuePrompt(false); }} style={{ padding: '10px 24px', fontSize: 14, background: 'rgba(0,100,0,0.6)', border: '2px solid var(--ui-border)', borderRadius: 4, color: 'var(--ui-primary)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 'bold' }}>Continue</button>
            </div>
          </div>
        </div>
      )}

      {/* Tutorial Overlay */}
      {showTutorial && (() => {
        const steps = [
          { title: 'Welcome to Wasteland Tactics!', text: 'A Fallout-themed auto-battler. Build a team, fight enemies, survive as long as you can!', icon: '☢️' },
          { title: 'Buy Units', text: 'Spend Caps in the shop to recruit Wasteland companions. Reroll the shop for 2 caps.', icon: '🛒' },
          { title: 'Place Your Team', text: 'Drag units from your bench onto the battlefield. Your level determines how many units can fight.', icon: '📋' },
          { title: 'Synergies Matter', text: 'Match unit traits (Minutemen, Wasteland, Scout, etc.) for powerful team bonuses!', icon: '⭐' },
          { title: 'Upgrade Stars', text: 'Buy 3 copies of the same unit to upgrade to 2★, then 3 copies of 2★ for 3★!', icon: '✨' },
          { title: 'Items & Augments', text: 'Win PvE rounds for item components. Combine 2 components on a unit for powerful completed items. Choose augments at key rounds!', icon: '🔩' },
        ];
        const step = steps[tutorialStep];
        return React.createElement('div', { style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 } },
          React.createElement('div', { style: { background: 'linear-gradient(180deg, #001a00 0%, #0a0a00 100%)', border: '3px solid var(--ui-border)', borderRadius: 8, padding: 30, textAlign: 'center', maxWidth: 400, boxShadow: '0 0 50px var(--ui-glow)' } },
            React.createElement('div', { style: { fontSize: 48, marginBottom: 12 } }, step.iconImg ? createGameIcon(step.iconImg, step.icon, 48) : step.icon),
            React.createElement('div', { style: { fontSize: 20, fontWeight: 'bold', color: 'var(--ui-primary)', marginBottom: 8 } }, step.title),
            React.createElement('div', { style: { fontSize: 14, color: '#aaffaa', marginBottom: 20, lineHeight: 1.5 } }, step.text),
            React.createElement('div', { style: { fontSize: 10, color: '#666', marginBottom: 12 } }, `${tutorialStep + 1} / ${steps.length}`),
            React.createElement('div', { style: { display: 'flex', gap: 12, justifyContent: 'center' } },
              React.createElement('button', { onClick: () => { setShowTutorial(false); localStorage.setItem('wt_tutorial_seen', '1'); }, style: { padding: '8px 16px', fontSize: 12, background: 'rgba(100,0,0,0.4)', border: '1px solid #ff6666', borderRadius: 4, color: '#ff6666', cursor: 'pointer', fontFamily: 'inherit' } }, 'Skip'),
              React.createElement('button', { onClick: () => { if (tutorialStep < steps.length - 1) setTutorialStep(s => s + 1); else { setShowTutorial(false); localStorage.setItem('wt_tutorial_seen', '1'); } }, style: { padding: '8px 24px', fontSize: 12, background: 'rgba(0,100,0,0.6)', border: '2px solid var(--ui-border)', borderRadius: 4, color: 'var(--ui-primary)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 'bold' } }, tutorialStep < steps.length - 1 ? 'Next →' : "Let's Go!")
            )
          )
        );
      })()}

      {/* Augment Choice Overlay — extracted to AugmentPicker.jsx */}
      <AugmentPicker
        choice={augmentChoice}
        onPick={(aug) => {
          setAugments(prev => [...prev, aug.id]);
          setAugmentChoice(null);
          // Apply immediate effects
          if (aug.effect.benchAdd) {
            setBench(prev => [...prev, ...Array(aug.effect.benchAdd).fill(null)]);
          }
          setLog(prev => [`⚡ Acquired augment: ${aug.name}!`, ...prev.slice(0, 9)]);
          sound.upgrade();
        }}
      />

      {/* Vault-Tec Profile Panel — opens via Ctrl+Shift+P */}
      {profileOpen && (
        <ProfilePanel
          onClose={() => setProfileOpen(false)}
          currentBuild={{ board, bench, augments, items: itemInventory }}
          onImport={(payload) => {
            try {
              if (Array.isArray(payload.board)) setBoard(payload.board);
              if (Array.isArray(payload.bench)) setBench(payload.bench);
              if (Array.isArray(payload.augments)) setAugments(payload.augments);
              if (Array.isArray(payload.items)) setItemInventory(payload.items);
              setLog(prev => [`💾 Build imported from code`, ...prev.slice(0, 9)]);
            } catch (e) { logError(e, { source: 'ProfilePanel.onImport' }); }
          }}
        />
      )}

      {/* Lucky 38 Carousel */}
      {phase === 'carousel' && carouselActive && (
        <Lucky38Carousel
          round={round} gold={gold} setGold={setGold} hp={hp} setHp={setHp}
          level={level} bench={bench} setBench={setBench}
          itemInventory={itemInventory} setItemInventory={setItemInventory}
          augments={augments} setAugmentChoice={setAugmentChoice}
          poolRef={poolRef} ghostPlayersRef={ghostPlayersRef}
          hasHighRoller={augments.includes('high_roller')}
          setLog={setLog} sound={sound}
          onComplete={() => {
            setCarouselActive(false);
            setPhase('prep');
            setTimer(settings.prepTimer || 30);
          }}
        />
      )}

      {/* Income Breakdown Overlay — suppressed if a higher-priority modal is open
          (item picker carousel, augment offer, boss intro, Lucky 38) to prevent stacking. */}
      {showIncome && incomeBreakdown && !itemSelection && !augmentChoice && !bossIntro && !carouselActive && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2500 }} onClick={() => setShowIncome(false)}>
          <div style={{ background: 'var(--ui-panel)', border: '2px solid var(--ui-border)', borderRadius: 8, padding: 24, minWidth: 260, fontFamily: "'Share Tech Mono', monospace", boxShadow: '0 0 30px var(--ui-glow)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 14, fontWeight: 'bold', color: 'var(--ui-primary)', letterSpacing: 2, marginBottom: 12, textAlign: 'center' }}>INCOME</div>
            {[
              { label: 'Base Income', value: incomeBreakdown.base, delay: '0s' },
              { label: 'Interest', value: incomeBreakdown.interest, delay: '0.3s' },
              { label: 'Streak Bonus', value: incomeBreakdown.streak, delay: '0.6s' },
              { label: 'Augment', value: incomeBreakdown.augment || 0, delay: '0.9s' },
            ].filter(r => r.value > 0).map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12, color: 'var(--ui-text)', opacity: 0, animation: `wt-income-line 0.3s ease-out ${r.delay} forwards` }}>
                <span>{r.label}</span>
                <span style={{ color: '#ffd700', fontWeight: 'bold' }}>+{r.value}</span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid var(--ui-border)', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 'bold', opacity: 0, animation: 'wt-income-line 0.4s ease-out 1.2s forwards' }}>
              <span style={{ color: 'var(--ui-primary)' }}>TOTAL</span>
              <span style={{ color: '#ffd700', textShadow: '0 0 8px rgba(255,215,0,0.5)' }}>+{incomeBreakdown.total}</span>
            </div>
            <div style={{ textAlign: 'center', marginTop: 12, fontSize: 9, opacity: 0.4 }}>Click to dismiss</div>
          </div>
        </div>
      )}

      {/* Game Over */}
      {phase === 'gameover' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2900 }}>
          <div style={{ background: 'linear-gradient(180deg, #1a0000 0%, #0a0a00 100%)', border: '3px solid #ff0000', borderRadius: 8, padding: 40, textAlign: 'center', boxShadow: '0 0 50px rgba(255,0,0,0.5)' }}>
            <div style={{ fontSize: 32, fontWeight: 'bold', color: '#ff0000', marginBottom: 16, letterSpacing: 4 }}>GAME OVER</div>
            <div style={{ fontSize: 32, fontWeight: 'bold', color: '#ff0000', marginBottom: 8 }}>YOU DIED</div>
            <div style={{ fontSize: 18, marginBottom: 12, opacity: 0.8 }}>Survived {round} rounds</div>
            <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 4 }}>Level {level} | {augments.length} augment{augments.length !== 1 ? 's' : ''} | {itemInventory.length} item{itemInventory.length !== 1 ? 's' : ''}</div>
            {augments.length > 0 && <div style={{ fontSize: 10, opacity: 0.5, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'center' }}>Augments: {augments.map(id => { const a = AUGMENT_POOL.find(a => a.id === id); return a ? <GameIcon key={id} iconImg={a.iconImg} icon={a.icon} size={12} /> : null; })}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button onClick={restart} style={{ padding: '12px 32px', fontSize: 16, background: 'rgba(0,100,0,0.6)', border: '2px solid var(--ui-border)', borderRadius: 4, color: 'var(--ui-primary)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 'bold' }}>RESTART</button>
              <button onClick={() => { navigator.clipboard?.writeText(`☢️ Wasteland Tactics - Survived ${round} rounds! Level ${level}, ${augments.length} augments.`); }} style={{ padding: '12px 16px', fontSize: 12, background: 'rgba(0,0,100,0.4)', border: '1px solid #6666ff', borderRadius: 4, color: '#6666ff', cursor: 'pointer', fontFamily: 'inherit' }}>Share</button>
            </div>
          </div>
        </div>
      )}

      </>)}
      {import.meta.env.DEV && <DevTools externalActivate={devToolsActivate} onActivateConsumed={() => setDevToolsActivate(false)} />}
    </div>
  );
}

export default WastelandTactics;
