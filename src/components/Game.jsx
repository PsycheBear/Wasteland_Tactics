import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { UNIT_DATABASE, MELEE_UNITS, isMeleeUnit } from '../data/units.js';
import { TRAITS } from '../data/traits.js';
import { ITEM_COMPONENTS, COMPLETED_ITEMS, ITEM_COMPONENT_KEYS, findCompletedItem, getRandomComponent } from '../data/items.js';
import { AUGMENT_POOL } from '../data/augments.js';
import { BOSS_DATABASE } from '../data/bosses.js';
import { IMAGES } from '../data/images.js';
import { COST_COLORS, SHOP_ODDS, getRandomCost, POOL_SIZES, UNIT_KEYS, XP_TO_LEVEL, initPool, makeUid } from '../data/constants.js';
import { sound, WT_SETTINGS } from '../systems/audio.js';
import { getActiveSynergies, generateEnemies, runCombat, spawnFloat } from '../systems/combat.js';
import { CombatBars, UnitPlaceholder, UnitTooltip, UnitCard } from './UiComponents.jsx';

function WastelandTactics() {
  const [phase, setPhase] = useState('prep');
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
  const [selectedItem, setSelectedItem] = useState(null); // Component key being placed on a unit
  const [augments, setAugments] = useState([]); // Array of augment IDs
  const [augmentChoice, setAugmentChoice] = useState(null); // { options: [aug, aug, aug] }
  const [showTutorial, setShowTutorial] = useState(() => !localStorage.getItem('wt_tutorial_seen'));
  const [tutorialStep, setTutorialStep] = useState(0);
  const [hasSave, setHasSave] = useState(() => !!localStorage.getItem('wt_save'));
  const [showContinuePrompt, setShowContinuePrompt] = useState(() => !!localStorage.getItem('wt_save') && !!localStorage.getItem('wt_tutorial_seen'));
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
  const [settings, setSettings] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem('wt_settings') || '{}');
      return {
        volume: Math.min(100, Math.max(0, s.volume ?? 80)),
        animationSpeed: [0.5, 1, 1.5, 2].includes(s.animationSpeed) ? s.animationSpeed : 1,
        scanlines: s.scanlines !== false,
        phosphor: s.phosphor !== false,
        crtMode: s.crtMode === true,
      };
    } catch (_) { return { volume: 80, animationSpeed: 1, scanlines: true, phosphor: true, crtMode: false }; }
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
  const xpMetaRef = useRef({ xpNeeded: 4, level: 3 });
  useEffect(() => { xpMetaRef.current = { xpNeeded, level }; });

  const generateShop = useCallback((prevShop) => {
    // Return previous shop units to pool before rolling
    if (prevShop) {
      prevShop.forEach(u => { if (u) poolRef.current[u.id] = (poolRef.current[u.id] || 0) + 1; });
    }
    return Array(5).fill(null).map(() => {
      const cost = getRandomCost(level);
      const avail = UNIT_KEYS.filter(k => UNIT_DATABASE[k].cost === cost && poolRef.current[k] > 0);
      const candidates = avail.length > 0 ? avail : UNIT_KEYS.filter(k => poolRef.current[k] > 0);
      if (candidates.length === 0) return null;
      const unitKey = candidates[Math.floor(Math.random() * candidates.length)];
      poolRef.current[unitKey]--;
      const unit = UNIT_DATABASE[unitKey];
      return { ...unit, id: unitKey, stars: 1, uid: makeUid(), items: [] };
    });
  }, [level]);

  useEffect(() => { setShop(prev => generateShop(prev)); }, [generateShop]);

  useEffect(() => () => { if (combatRef.current) clearInterval(combatRef.current); }, []);

  // Handle prep music based on phase
  useEffect(() => {
    if (phase === 'prep') {
      sound.startPrepMusic();
    } else {
      sound.stopPrepMusic();
    }
    return () => sound.stopPrepMusic();
  }, [phase]);

  useEffect(() => {
    if (phase !== 'prep') return;
    const interval = setInterval(() => {
      setTimer(t => {
        if (t <= 1) { startCombatRef.current(); return 30; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  const buyUnit = (index) => {
    const unit = shop[index];
    if (!unit || gold < unit.cost) return;
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
      if (!wouldUpgrade1 && !wouldUpgrade2) return; // truly full, no upgrade possible
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
  };

  const refreshShop = () => {
    if (gold < 2) return;
    sound.spendCaps();
    setGold(g => g - 2);
    setShop(prev => generateShop(prev));
  };

  const buyXP = () => {
    if (gold < 4 || level >= 9) return;
    sound.spendCaps();
    setGold(g => g - 4);
    setXp(x => {
      const { xpNeeded: needed, level: lvl } = xpMetaRef.current;
      const newXp = x + 4;
      if (newXp >= needed && lvl < 9) {
        const nextNeeded = XP_TO_LEVEL[lvl + 2] || 60;
        setLevel(l => l + 1);
        setXpNeeded(nextNeeded);
        xpMetaRef.current = { xpNeeded: nextNeeded, level: lvl + 1 };
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
    const unit = arr[index];
    if (!unit) return;
    if (!unit.items) unit.items = [];
    if (unit.items.length >= 3) {
      setLog(prev => ['⚠️ Unit already has 3 items!', ...prev.slice(0, 9)]);
      return;
    }
    // Check if this component + existing component = completed item
    const existingComponents = unit.items.filter(it => ITEM_COMPONENTS[it]);
    let combined = false;
    for (const existing of existingComponents) {
      const match = findCompletedItem(existing, itemKey);
      if (match) {
        // Replace both components with completed item
        const newItems = unit.items.filter(it => it !== existing);
        newItems.push(match[0]);
        unit.items = newItems;
        combined = true;
        setLog(prev => [`⚙️ Combined into ${match[1].name}!`, ...prev.slice(0, 9)]);
        sound.upgrade();
        break;
      }
    }
    if (!combined) {
      unit.items.push(itemKey);
      const itemName = ITEM_COMPONENTS[itemKey]?.name || COMPLETED_ITEMS[itemKey]?.name || itemKey;
      setLog(prev => [`🔩 Equipped ${itemName} on ${unit.name}`, ...prev.slice(0, 9)]);
      sound.click();
    }
    // Remove from inventory
    const invIdx = itemInventory.indexOf(itemKey);
    if (invIdx !== -1) {
      setItemInventory(prev => { const n = [...prev]; n.splice(invIdx, 1); return n; });
    }
    if (location === 'bench') setBench([...bench]);
    else setBoard([...board]);
    setSelectedItem(null);
  };

  equipItemRef.current = equipItem;

  const moveUnit = (fromLoc, fromIdx, toLoc, toIdx) => {
    if (phase === 'combat') return;
    const fromArr = fromLoc === 'bench' ? bench : board;
    const toArr = toLoc === 'bench' ? bench : board;
    const unit = fromArr[fromIdx];
    if (!unit) return;
    if (toLoc === 'board' && fromLoc === 'bench') {
      const boardCount = board.filter(u => u !== null).length;
      if (boardCount >= level) return;
    }
    const newFrom = fromLoc === 'bench' ? [...bench] : [...board];
    const newTo = toLoc === 'bench' ? [...bench] : [...board];
    if (fromLoc === toLoc) {
      const temp = newFrom[toIdx]; newFrom[toIdx] = newFrom[fromIdx]; newFrom[fromIdx] = temp;
      if (fromLoc === 'bench') setBench(newFrom); else setBoard(newFrom);
    } else {
      const temp = newTo[toIdx]; newTo[toIdx] = newFrom[fromIdx]; newFrom[fromIdx] = temp;
      if (fromLoc === 'bench') { setBench(newFrom); setBoard(newTo); } else { setBoard(newFrom); setBench(newTo); }
    }
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
    let defMult = 1, abilityResist = 0, teamShield = 0, raiderCritChance = 0, raiderCritMult = 1.5, ghoulRegen = 0, ghoulPoisonImmune = false, ghoulDeathRadiation = false;
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
    const libertyAtkBonus = liberty3 ? 0.1 : 0;

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
        dodge: itemDodge,
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
    const enemyUnits = generateEnemies(round);
    setCombatUnits(boardUnits);
    setCombatEnemies(enemyUnits);
    setPhase('combat');
    setTimer(30);
    setBonusGold(0);
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
      generateShop,
      getRandomComponent,
      saveGame: () => {
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
      },
    });
  };
  startCombatRef.current = startCombat;

  const restart = () => {
    if (combatRef.current) clearInterval(combatRef.current);
    setFloatingNumbers([]);
    xpMetaRef.current = { xpNeeded: 4, level: 3 };
    setPhase('prep'); setRound(1); setGold(10); setHp(100); setLevel(3); setXp(0); setXpNeeded(4); setStreak(0);
    setBench(Array(9).fill(null)); setBoard(Array(14).fill(null)); poolRef.current = initPool(); setShop(generateShop(null)); setLog([]); setTimer(30);
    setCombatUnits([]); setCombatEnemies([]);  setBonusGold(0);
    setUnitTooltip(null);
    setItemInventory([]); setItemSelection(null); setSelectedItem(null);
    setAugments([]); setAugmentChoice(null);
    localStorage.removeItem('wt_save'); setHasSave(false);
  };

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

  const loadGame = () => {
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
      setTimer(30);
      setCombatUnits([]); setCombatEnemies([]); setBonusGold(0);
      setUnitTooltip(null); setItemSelection(null); setAugmentChoice(null);
      setLog(['💾 Game loaded!']);
    } catch (e) { setLog(prev => ['⚠️ Failed to load save', ...prev.slice(0, 9)]); }
  };

  const getColor = (cost) => ({ 1: '#888', 2: '#4CAF50', 3: '#2196F3', 4: '#9C27B0', 5: '#FF9800' }[cost] || '#888');
  const stars = (n) => '⭐'.repeat(n);
  const synergies = getActiveSynergies(board);

  // Image constants
  const ARENA_BG = IMAGES.arena_bg || '';
  const SHOP_BG = IMAGES.shop_bg || '';
  const FIGHT_BTN = IMAGES.fight_btn;
  const CAPS_IMG = IMAGES.caps;
  const LOGO_IMG = IMAGES.logo;

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
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #1a1a0f 0%, #0d0d08 50%, #1a1a0f 100%)',
        fontFamily: '"Share Tech Mono", "Courier New", monospace',
        color: '#00ff00',
        padding: 8,
        cursor: pointerDrag || draggedFrom ? 'grabbing' : 'default',
        userSelect: draggedFrom ? 'none' : 'auto',
        ['--wt-anim-speed']: settings.animationSpeed,
      }}>
      {/* Settings panel */}
      {settingsOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }} onClick={() => setSettingsOpen(false)}>
          <div style={{ background: 'linear-gradient(180deg, #0a1a0a 0%, #050d05 100%)', border: '2px solid #00ff00', borderRadius: 8, padding: 24, maxWidth: 360, minWidth: 300, boxShadow: '0 0 30px rgba(0,255,0,0.4)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid #00aa00', paddingBottom: 8 }}>
              <span style={{ fontSize: 18, fontWeight: 'bold' }}>⚙️ SETTINGS</span>
              <button onClick={() => setSettingsOpen(false)} style={{ background: 'transparent', border: 'none', color: '#00ff00', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Volume: {settings.volume}%</label>
                <input type="range" min="0" max="100" value={settings.volume} onChange={e => setSettings(s => ({ ...s, volume: +e.target.value }))} style={{ width: '100%', accentColor: '#00ff00' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Animation speed: {settings.animationSpeed}x</label>
                <select value={settings.animationSpeed} onChange={e => setSettings(s => ({ ...s, animationSpeed: +e.target.value }))} style={{ width: '100%', background: '#0a1a0a', color: '#00ff00', border: '1px solid #00aa00', borderRadius: 4, padding: 8, fontFamily: 'inherit' }}>
                  <option value={0.5}>0.5x (Slow)</option>
                  <option value={1}>1x (Normal)</option>
                  <option value={1.5}>1.5x</option>
                  <option value={2}>2x (Fast)</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12 }}>
                  <input type="checkbox" checked={settings.scanlines} onChange={e => setSettings(s => ({ ...s, scanlines: e.target.checked }))} style={{ accentColor: '#00ff00' }} />
                  Strong scanlines
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12 }}>
                  <input type="checkbox" checked={settings.phosphor} onChange={e => setSettings(s => ({ ...s, phosphor: e.target.checked }))} style={{ accentColor: '#00ff00' }} />
                  Green phosphor glow
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12 }}>
                  <input type="checkbox" checked={settings.crtMode} onChange={e => setSettings(s => ({ ...s, crtMode: e.target.checked }))} style={{ accentColor: '#00ff00' }} />
                  CRT effect (curve + bloom)
                </label>
              </div>
              {/* Save/Load */}
              <div style={{ borderTop: '1px solid #00aa00', paddingTop: 12, display: 'flex', gap: 8 }}>
                <button onClick={() => { saveGame(); setSettingsOpen(false); }} style={{ flex: 1, padding: '8px', fontSize: 11, background: 'rgba(0,80,0,0.5)', border: '1px solid #00aa00', borderRadius: 4, color: '#00ff00', cursor: 'pointer', fontFamily: 'inherit' }}>💾 Save</button>
                <button onClick={() => { loadGame(); setSettingsOpen(false); }} disabled={!hasSave} style={{ flex: 1, padding: '8px', fontSize: 11, background: hasSave ? 'rgba(0,80,0,0.5)' : 'rgba(30,30,30,0.5)', border: `1px solid ${hasSave ? '#00aa00' : '#444'}`, borderRadius: 4, color: hasSave ? '#00ff00' : '#666', cursor: hasSave ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>📂 Load</button>
              </div>
              <button onClick={() => { setShowTutorial(true); setTutorialStep(0); setSettingsOpen(false); }} style={{ width: '100%', padding: '6px', fontSize: 11, background: 'rgba(0,0,80,0.3)', border: '1px solid #6666aa', borderRadius: 4, color: '#aaaaff', cursor: 'pointer', fontFamily: 'inherit' }}>📖 Show Tutorial</button>
            </div>
          </div>
        </div>
      )}

      {/* Pip-Boy style scanlines - stronger when enabled */}
      <div style={{ position: 'fixed', inset: 0, background: settings.scanlines ? 'repeating-linear-gradient(0deg, rgba(0,0,0,0.12) 0px, rgba(0,0,0,0.12) 1px, rgba(0,0,0,0) 1px, rgba(0,0,0,0) 3px)' : 'repeating-linear-gradient(0deg, rgba(0,0,0,0.04) 0px, rgba(0,0,0,0.04) 1px, rgba(0,0,0,0) 1px, rgba(0,0,0,0) 3px)', pointerEvents: 'none', zIndex: 1000 }} />
      {/* Vignette / CRT edge falloff - explicit rgba to avoid browser gradient quirks */}
      <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse 80% 80% at 50% 50%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.3) 100%)', pointerEvents: 'none', zIndex: 999 }} />
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

      {/* Stage/Round Tracker - TFT style */}
      {(() => {
        const ROUNDS_PER_STAGE = 3;
        const currentStage = Math.ceil(round / ROUNDS_PER_STAGE);
        const roundInStage = ((round - 1) % ROUNDS_PER_STAGE) + 1;
        const totalStages = Math.max(currentStage + 2, 7);
        const isBoss = round > 3 && round % 7 === 0;
        const bossData = isBoss ? BOSS_DATABASE[round] : null;
        const stageTypes = { 1: 'PvE', default: 'PvP' };
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, padding: '4px 16px', marginBottom: 4, background: 'linear-gradient(180deg, rgba(0,30,0,0.9) 0%, rgba(0,20,0,0.7) 100%)', border: '1px solid #00aa0066', borderRadius: 4 }}>
            {Array.from({ length: totalStages }, (_, si) => {
              const stageNum = si + 1;
              const isCurrentStage = stageNum === currentStage;
              const isPast = stageNum < currentStage;
              const stageLabel = stageTypes[stageNum] || stageTypes.default;
              return (
                <div key={si} style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <div style={{ fontSize: 8, opacity: isCurrentStage ? 1 : 0.4, color: stageNum === 1 ? '#ff9900' : '#00ff00', fontWeight: isCurrentStage ? 'bold' : 'normal' }}>
                      {stageLabel}
                    </div>
                    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                      {Array.from({ length: ROUNDS_PER_STAGE }, (_, ri) => {
                        const roundNum = ri + 1;
                        const isCurrentRound = isCurrentStage && roundNum === roundInStage;
                        const isRoundPast = isPast || (isCurrentStage && roundNum < roundInStage);
                        return (
                          <div key={ri} style={{
                            width: isCurrentRound ? 18 : 10, height: isCurrentRound ? 18 : 10,
                            borderRadius: '50%',
                            background: isCurrentRound ? '#00ff00' : isRoundPast ? '#00aa00' : 'rgba(0,255,0,0.15)',
                            border: isCurrentRound ? '2px solid #00ff00' : '1px solid #00aa0044',
                            boxShadow: isCurrentRound ? '0 0 8px #00ff00' : 'none',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 7, fontWeight: 'bold', color: '#000',
                            transition: 'all 0.3s',
                          }}>
                            {isCurrentRound ? `${stageNum}-${roundNum}` : ''}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {si < totalStages - 1 && (
                    <div style={{ width: 12, height: 1, background: isPast ? '#00aa00' : '#00aa0033', margin: '0 2px', marginTop: 10 }} />
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', background: 'linear-gradient(180deg, rgba(0,50,0,0.8) 0%, rgba(0,30,0,0.6) 100%)', border: '2px solid #00ff00', borderRadius: 4, marginBottom: 8, boxShadow: '0 0 20px rgba(0,255,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {LOGO_IMG ? <img src={LOGO_IMG} alt="Wasteland Tactics" style={{ height: 36, objectFit: 'contain', filter: 'drop-shadow(0 0 8px rgba(0,255,0,0.5))' }} /> : <div style={{ fontSize: 20, fontWeight: 'bold', textShadow: '0 0 10px #00ff00' }}>☢️ WASTELAND TACTICS</div>}
          <div style={{ padding: '4px 12px', background: phase === 'combat' ? 'rgba(255,0,0,0.3)' : 'rgba(0,255,0,0.2)', border: `1px solid ${phase === 'combat' ? '#ff0000' : '#00ff00'}`, borderRadius: 2 }}>
            {phase === 'prep' && round > 3 && round % 7 === 0 && BOSS_DATABASE[round] ? `🏆 BOSS: ${BOSS_DATABASE[round].icon} ${BOSS_DATABASE[round].name}` : phase === 'prep' ? '📋 PREP' : phase === 'combat' ? '⚔️ COMBAT' : '💀 GAME OVER'}
          </div>
          <button onClick={() => setSettingsOpen(o => !o)} style={{ background: 'transparent', border: '1px solid #00ff00', borderRadius: 4, color: '#00ff00', cursor: 'pointer', padding: '4px 8px', fontSize: 16 }} title="Settings">⚙️</button>
        </div>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}><div style={{ fontSize: 12, opacity: 0.7 }}>TIMER</div><div style={{ fontSize: 24, fontWeight: 'bold', color: timer <= 5 ? '#ff0000' : '#00ff00' }}>{timer}s</div></div>
          <div style={{ textAlign: 'center' }}><div style={{ fontSize: 12, opacity: 0.7 }}>CAPS</div><div style={{ fontSize: 24, fontWeight: 'bold', color: '#ffd700', display: 'flex', alignItems: 'center', gap: 4 }}>{CAPS_IMG ? <img src={CAPS_IMG} alt="caps" style={{ width: 20, height: 20 }} /> : '💰'}{gold}</div></div>
          <div style={{ textAlign: 'center' }}><div style={{ fontSize: 12, opacity: 0.7 }}>HP</div><div style={{ width: 80, height: 16, background: '#1a1a1a', border: '1px solid #00ff00', borderRadius: 2, overflow: 'hidden' }}><div style={{ width: `${hp}%`, height: '100%', background: hp > 50 ? '#00ff00' : hp > 25 ? '#ffff00' : '#ff0000' }} /></div><div style={{ fontSize: 12 }}>{hp}/100</div></div>
          <div style={{ textAlign: 'center' }}><div style={{ fontSize: 12, opacity: 0.7 }}>LEVEL</div><div style={{ fontSize: 20, fontWeight: 'bold' }}>LV.{level}</div><div style={{ fontSize: 12 }}>XP: {xp}/{xpNeeded}</div></div>
          <div style={{ textAlign: 'center' }}><div style={{ fontSize: 12, opacity: 0.7 }}>STREAK</div><div style={{ fontSize: 20, fontWeight: 'bold', color: streak > 0 ? '#00ff00' : streak < 0 ? '#ff0000' : '#888' }}>{streak > 0 ? `W${streak}` : streak < 0 ? `L${Math.abs(streak)}` : '-'}</div></div>
        </div>
      </div>

      {/* Main game area */}
      <div className="wt-main-layout" style={{ display: 'flex', gap: 8 }}>
        {/* Left panel - Synergies */}
        <div className="wt-synergy-panel" style={{ width: 150, background: 'rgba(0,30,0,0.6)', border: '2px solid #00aa00', borderRadius: 4, padding: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 8, borderBottom: '1px solid #00aa00', paddingBottom: 4 }}>📊 SYNERGIES</div>
          {synergies.length === 0 ? <div style={{ fontSize: 10, opacity: 0.5, textAlign: 'center' }}>No active synergies</div> : synergies.map(s => (
            <div key={s.trait} style={{ marginBottom: 8, padding: 4, background: 'rgba(0,0,0,0.3)', borderRadius: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span>{s.icon}</span><span style={{ color: s.color, fontWeight: 'bold' }}>{s.name}</span><span style={{ marginLeft: 'auto' }}>{s.count}</span></div>
              <div style={{ fontSize: 9, opacity: 0.7, marginTop: 2 }}>{s.bonuses[s.count] || s.bonuses[2]}</div>
            </div>
          ))}
          {/* Active Augments */}
          {augments.length > 0 && (
            <div style={{ marginTop: 8, borderTop: '1px solid #00aa00', paddingTop: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 'bold', color: '#cc66ff', marginBottom: 4 }}>⚡ AUGMENTS</div>
              {augments.map(augId => {
                const aug = AUGMENT_POOL.find(a => a.id === augId);
                if (!aug) return null;
                return React.createElement('div', { key: augId, style: { fontSize: 9, marginBottom: 2, opacity: 0.8 } }, `${aug.icon} ${aug.name}`);
              })}
            </div>
          )}
        </div>

        {/* Center - Arena */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Battlefield with background */}
          <div style={{ background: 'linear-gradient(180deg, #0a150a 0%, #051005 100%)', backgroundImage: ARENA_BG ? `url(${ARENA_BG})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center', borderRadius: 4, padding: 16, border: '2px solid #00aa00', overflow: 'visible' }}>
            {/* Battlefield: enemies TOP, player BOTTOM, stacked vertically */}
            <div className="wt-combat-arena" style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 16 }}>
              {/* Enemy board - top half */}
              <div className={phase === 'combat' ? 'wt-enter-enemy' : ''} style={{ marginBottom: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 6, color: '#ff6666', textShadow: '1px 1px 2px black' }}>⚔️ ENEMY FORCES</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, maxWidth: 520, margin: '0 auto', overflow: 'visible' }}>
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
                        width: 66, height: 76, overflow: 'visible',
                        background: enemy ? 'rgba(255,0,0,0.3)' : 'rgba(255,0,0,0.1)',
                        border: `2px ${enemy ? 'solid' : 'dashed'} ${enemy ? '#ff0000' : '#ff000066'}`,
                        borderRadius: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        position: 'relative', cursor: enemy ? 'context-menu' : 'default',
                        opacity: isEnemyDying ? undefined : enemy && enemy.currentHp <= 0 ? 0.3 : 1,
                        transition: enemyAnimClass ? 'none' : 'transform 0.15s ease-out, opacity 0.15s',
                      }}>
                        {enemy && (<>
                          {getUnitImage(enemy.id, enemy.stars) ? (
                            <img src={getUnitImage(enemy.id, enemy.stars)} alt={enemy.name} style={{ width: 48, height: 48, objectFit: enemy.id === 'nick' ? 'cover' : 'contain', borderRadius: enemy.id === 'nick' ? '50%' : undefined }} />
                          ) : (
                            <UnitPlaceholder name={enemy.name} size={48} />
                          )}
                          <div style={{ fontSize: 9 }}>{stars(enemy.stars)}</div>
                          <CombatBars currentHp={enemy.currentHp} maxHp={enemy.maxHp} mana={enemy.mana} manaMax={enemy.manaMax} variant="enemy" compact />
                        </>)}
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* Horizontal divider between forces */}
              <div style={{ width: '100%', height: 1, margin: '8px 0', borderTop: '2px dashed #00aa0066', borderBottom: '2px dashed #ff000066' }} />
              {/* Player board - bottom half */}
              <div className={`${phase === 'combat' ? 'wt-enter-player' : ''} ${noBoardFlash ? 'wt-no-board-flash' : ''}`}>
                <div style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 6, textShadow: '1px 1px 2px black' }}>🎮 BATTLEFIELD ({board.filter(u => u).length}/{level})</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, maxWidth: 520, margin: '0 auto', overflow: 'visible' }}>
                  {board.map((unit, i) => (
                    <div key={i}
                      data-unit-uid={unit?.uid}
                      data-slot-location="board"
                      data-slot-index={i}
                      onClick={() => {
                        if (justDraggedRef.current) { justDraggedRef.current = false; return; }
                        if (selected && !unit) { moveUnit(selected.location, selected.index, 'board', i); }
                        else if (unit) { setSelected(selected?.location === 'board' && selected?.index === i ? null : { unit, location: 'board', index: i }); }
                      }}
                      style={(() => {
                        const isItemDragOver = itemDrag && dragOverTarget?.location === 'board' && dragOverTarget?.index === i && unit;
                        const isUnitDragOver = !itemDrag && dragOverTarget?.location === 'board' && dragOverTarget?.index === i;
                        return {
                          width: 66, height: 76,
                          background: isItemDragOver ? 'rgba(255,170,0,0.3)' : isUnitDragOver ? 'rgba(0,255,0,0.25)' : (unit ? 'transparent' : 'rgba(255,200,0,0.2)'),
                          border: `2px ${(isItemDragOver || isUnitDragOver) ? 'solid' : 'dashed'} ${isItemDragOver ? '#ffaa00' : isUnitDragOver ? '#00ff00' : (unit ? 'transparent' : '#ffd70066')}`,
                          borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'visible',
                          transition: 'background 0.15s, border-color 0.15s',
                          boxShadow: isItemDragOver ? '0 0 14px rgba(255,170,0,0.5)' : 'none',
                        };
                      })()}>
                      {unit && <UnitCard unit={unit} location="board" index={i} small
                        selected={selected} draggedFrom={draggedFrom} phase={phase}
                        combatUnits={combatUnits} animations={animations}
                        onPointerDown={handleUnitPointerDown} onContextMenu={handleUnitContextMenu}
                        onClick={handleUnitClick} selectedItem={selectedItem} />}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bench */}
            <div>
              <div style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 6, textShadow: '1px 1px 2px black' }}>📦 BENCH ({bench.filter(u => u).length}/9)</div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
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
                        width: 66, height: 76,
                        background: isItemDragOver ? 'rgba(255,170,0,0.3)' : isUnitDragOver ? 'rgba(0,255,0,0.25)' : (unit ? 'transparent' : 'rgba(0,100,0,0.3)'),
                        border: `2px ${(isItemDragOver || isUnitDragOver) ? 'solid' : 'dashed'} ${isItemDragOver ? '#ffaa00' : isUnitDragOver ? '#00ff00' : (unit ? 'transparent' : '#00660066')}`,
                        borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                        transition: 'background 0.15s, border-color 0.15s',
                        boxShadow: isItemDragOver ? '0 0 14px rgba(255,170,0,0.5)' : 'none',
                      };
                    })()}>
                    {unit && <UnitCard unit={unit} location="bench" index={i} small
                      selected={selected} draggedFrom={draggedFrom} phase={phase}
                      combatUnits={combatUnits} animations={animations}
                      onPointerDown={handleUnitPointerDown} onContextMenu={handleUnitContextMenu}
                      onClick={handleUnitClick} selectedItem={selectedItem} />}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Shop + Fight button row */}
          <div style={{ display: 'flex', gap: 8 }}>
            {/* Shop */}
            <div style={{ flex: 1, backgroundImage: `url(${SHOP_BG})`, backgroundSize: 'cover', border: '2px solid #aa8800', borderRadius: 4, padding: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 18, fontWeight: 'bold', color: '#ffd700', textShadow: '2px 2px 4px black' }}>🏪 WASTELAND SHOP</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={refreshShop} disabled={gold < 2} style={{ padding: '6px 12px', fontSize: 11, background: gold >= 2 ? 'rgba(0,100,0,0.8)' : 'rgba(50,50,50,0.8)', border: '1px solid #00ff00', borderRadius: 4, color: gold >= 2 ? '#00ff00' : '#666', cursor: gold >= 2 ? 'pointer' : 'not-allowed', fontFamily: 'inherit', textAlign: 'center', lineHeight: 1.3 }}>
                    Refresh<br/>(2 Caps)
                  </button>
                  <button onClick={buyXP} disabled={gold < 4 || level >= 9} style={{ padding: '6px 12px', fontSize: 11, background: gold >= 4 && level < 9 ? 'rgba(0,100,0,0.8)' : 'rgba(50,50,50,0.8)', border: '1px solid #00ff00', borderRadius: 4, color: gold >= 4 && level < 9 ? '#00ff00' : '#666', cursor: gold >= 4 && level < 9 ? 'pointer' : 'not-allowed', fontFamily: 'inherit', textAlign: 'center', lineHeight: 1.3 }}>
                    Buy XP<br/>(4 Caps)
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                {shop.map((unit, i) => (
                  <div key={unit ? `${i}-${unit.uid}` : `empty-${i}`} onClick={() => { setUnitTooltip(null); unit && buyUnit(i); }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      if (!unit) return;
                      setUnitTooltip(prev => (prev?.unit?.uid === unit.uid ? null : { unit, x: e.clientX, y: e.clientY }));
                    }}
                    className="wt-shop-card"
                    style={{ width: 70, height: 90, background: unit ? `linear-gradient(180deg, ${getColor(unit.cost)}66 0%, ${getColor(unit.cost)}33 100%)` : 'rgba(30,30,30,0.7)', border: `2px solid ${unit ? getColor(unit.cost) : '#333'}`, borderRadius: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: unit && gold >= unit.cost ? 'pointer' : 'not-allowed', opacity: unit ? (gold >= unit.cost ? 1 : 0.5) : 0.3 }}>
                    {unit ? (<>
                      {getUnitImage(unit.id, 1) ? (
                        <img src={getUnitImage(unit.id, 1)} alt={unit.name} style={{ width: 36, height: 36, objectFit: unit.id === 'nick' ? 'cover' : 'contain', borderRadius: unit.id === 'nick' ? '50%' : undefined }} />
                      ) : (
                        <UnitPlaceholder name={unit.name} size={36} />
                      )}
                      <div style={{ fontSize: 11, textAlign: 'center', marginTop: 2, textShadow: '1px 1px 1px black' }}>{unit.name}</div>
                      <div style={{ fontSize: 11, color: '#ffd700', display: 'flex', alignItems: 'center', gap: 2 }}>{unit.cost}{CAPS_IMG ? <img src={CAPS_IMG} alt="" style={{ width: 12, height: 12 }} /> : '💰'}</div>
                    </>) : <div style={{ fontSize: 10, opacity: 0.5 }}>SOLD</div>}
                  </div>
                ))}
              </div>
            </div>

            {/* Fight button + Sell zone */}
            {phase === 'prep' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div onClick={startCombat} style={{ cursor: 'pointer' }}>
                {FIGHT_BTN ? (
                  <img src={FIGHT_BTN} alt="FIGHT" className="wt-fightBtn wt-fightBtnImg" style={{ width: 200, height: 115, objectFit: 'contain', filter: 'drop-shadow(0 0 10px rgba(0,255,0,0.5))' }} />
                ) : (
                  <div className="wt-fightBtn" style={{ width: 150, height: 80, background: 'linear-gradient(180deg, #004400 0%, #002200 100%)', border: '3px solid #00ff00', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 'bold', color: '#00ff00', textShadow: '0 0 10px #00ff00' }}>⚔️ FIGHT</div>
                )}
                </div>
                {/* Sell zone */}
                <div
                  data-sell-zone
                  style={{
                    width: 200, height: 60,
                    background: dragOverSell ? 'rgba(255,0,0,0.4)' : 'rgba(255,0,0,0.2)',
                    border: '2px dashed #ff0000',
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 15,
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                >
                  <span style={{ color: '#ff6666', fontSize: 16, fontWeight: 'bold', textShadow: '1px 1px 2px black' }}>💰 SELL</span>
                </div>

                {/* Item Inventory */}
                {itemInventory.length > 0 && (
                  <div style={{ marginTop: 10, padding: 6, background: 'rgba(0,30,0,0.5)', border: '1px solid #00aa00', borderRadius: 4 }}>
                    <div style={{ fontSize: 10, fontWeight: 'bold', marginBottom: 4, color: '#ffaa00' }}>🔩 ITEMS ({itemInventory.length})</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {itemInventory.map((itemKey, idx) => {
                        const comp = ITEM_COMPONENTS[itemKey];
                        if (!comp) return null;
                        // Build tooltip showing all recipes this component is part of
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
                            width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: selectedItem === itemKey ? 'rgba(0,255,0,0.3)' : 'rgba(0,0,0,0.4)',
                            border: selectedItem === itemKey ? '2px solid #00ff00' : '1px solid #555',
                            borderRadius: 4, cursor: phase === 'prep' ? 'grab' : 'pointer', fontSize: 16,
                            userSelect: 'none', touchAction: 'none',
                          }
                        }, comp.icon);
                      })}
                    </div>
                    {selectedItem && (() => {
                      const selComp = ITEM_COMPONENTS[selectedItem];
                      const combos = Object.values(COMPLETED_ITEMS).filter(item => item.recipe.includes(selectedItem)).map(item => `${item.icon} + ${ITEM_COMPONENTS[item.recipe.find(r => r !== selectedItem) || item.recipe[0]]?.icon || '?'} = ${item.name}`);
                      return React.createElement('div', { style: { fontSize: 9, color: '#aaffaa', marginTop: 4 } },
                        React.createElement('div', null, `Drag ${selComp?.name} onto a unit to equip`),
                        React.createElement('div', { style: { marginTop: 2, color: '#ffaa00', fontSize: 8 } }, combos.join(' • '))
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right panel - Unit Info & Log */}
        <div className="wt-info-panel" style={{ width: 180, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ background: 'rgba(0,30,0,0.6)', border: '2px solid #00aa00', borderRadius: 4, padding: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 8, borderBottom: '1px solid #00aa00', paddingBottom: 4 }}>📋 UNIT INFO</div>
            {selected ? (
              <div>
                <div style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 4 }}>{selected.unit.name}</div>
                <div style={{ fontSize: 10, marginBottom: 4 }}>{stars(selected.unit.stars)}</div>
                <div style={{ fontSize: 10, opacity: 0.8, marginBottom: 4 }}>{selected.unit.traits.map(t => TRAITS[t]?.icon + ' ' + t).join(' • ')}</div>
                <div style={{ fontSize: 10, marginBottom: 8 }}><div>❤️ HP: {selected.unit.hp}</div><div>⚔️ ATK: {selected.unit.atk}</div><div>🛡️ DEF: {selected.unit.def}</div></div>
                <div style={{ fontSize: 10, padding: 4, background: 'rgba(0,0,0,0.3)', borderRadius: 4 }}><div style={{ fontWeight: 'bold', color: '#ffff00' }}>✨ {selected.unit.ability}</div><div style={{ opacity: 0.7 }}>{selected.unit.abilityDesc}</div><div style={{ color: '#4488ff', fontSize: 9, marginTop: 3 }}>🔷 Active — {UNIT_DATABASE[selected.unit.id]?.apMax || 0} AP</div>{UNIT_DATABASE[selected.unit.id]?.passiveDesc && (<div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 3, marginTop: 4 }}><div style={{ fontWeight: 'bold', color: selected.unit.stars >= 3 ? '#ff9900' : '#666', fontSize: 9 }}>{selected.unit.stars >= 3 ? '🔓' : '🔒'} 3★ Passive</div><div style={{ opacity: selected.unit.stars >= 3 ? 0.9 : 0.4, fontSize: 8 }}>{UNIT_DATABASE[selected.unit.id].passiveDesc}</div></div>)}</div>
                {selected.unit.items && selected.unit.items.length > 0 && (
                  <div style={{ marginTop: 6, padding: 4, background: 'rgba(0,0,0,0.3)', borderRadius: 4 }}>
                    <div style={{ fontSize: 9, fontWeight: 'bold', color: '#ffaa00', marginBottom: 2 }}>🔩 Items:</div>
                    {selected.unit.items.map((itemKey, idx) => {
                      const comp = ITEM_COMPONENTS[itemKey];
                      const completed = COMPLETED_ITEMS[itemKey];
                      const name = comp?.name || completed?.name || itemKey;
                      const desc = comp?.desc || completed?.desc || '';
                      const icon = comp?.icon || completed?.icon || '?';
                      return React.createElement('div', { key: idx, style: { fontSize: 8, marginBottom: 1 } }, `${icon} ${name}: ${desc}`);
                    })}
                  </div>
                )}
                {(selected.location === 'bench' || (selected.location === 'board' && phase !== 'combat')) && (
                  <button onClick={() => sellUnit(selected.location, selected.index)} style={{ marginTop: 8, width: '100%', padding: '4px 8px', fontSize: 10, background: 'rgba(100,0,0,0.6)', border: '1px solid #ff0000', borderRadius: 4, color: '#ff0000', cursor: 'pointer', fontFamily: 'inherit' }}>
                    💰 Sell for {selected.unit.cost * (selected.unit.stars === 3 ? 9 : selected.unit.stars === 2 ? 3 : 1)} {CAPS_IMG ? <img src={CAPS_IMG} alt="" style={{ width: 10, height: 10, verticalAlign: 'middle' }} /> : 'caps'}
                  </button>
                )}
              </div>
            ) : <div style={{ textAlign: 'center', opacity: 0.5, fontSize: 11 }}>Select a unit</div>}
          </div>
          <div style={{ flex: 1, background: 'rgba(0,30,0,0.6)', border: '2px solid #00aa00', borderRadius: 4, padding: 8, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 8, borderBottom: '1px solid #00aa00', paddingBottom: 4 }}>📜 COMBAT LOG</div>
            <div style={{ flex: 1, fontSize: 9, overflow: 'auto' }}>{log.map((l, i) => <div key={i} className="wt-log-entry" style={{ padding: '2px 0', borderBottom: '1px solid #002200', opacity: 1 - i * 0.08 }}>{l}</div>)}{!log.length && <div style={{ opacity: 0.5, textAlign: 'center' }}>No combat yet</div>}</div>
          </div>
        </div>
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
        }, comp.icon);
      })()}

      {/* Floating damage numbers */}
      {floatingNumbers.map(({ id, damage, isCrit, x, y, isEnemyHit }) => (
        <div key={id} className="wt-float-up" style={{
          position: 'fixed', left: x, top: y, transform: 'translate(-50%, -50%)',
          fontSize: 18, fontWeight: 'bold', pointerEvents: 'none', zIndex: 2600,
          color: isEnemyHit ? '#ffffff' : (isCrit ? '#ff8844' : '#00ff00'),
          textShadow: isEnemyHit ? '0 0 6px #fff, 0 0 12px #888' : (isCrit ? '0 0 6px #ff8844, 0 0 12px #ff4400' : '0 0 6px #00ff00, 0 0 12px #006600'),
        }}>
          -{damage}
        </div>
      ))}

      {/* Unit Tooltip */}
      <UnitTooltip unitTooltip={unitTooltip} onClose={() => setUnitTooltip(null)} />

      {/* Item Selection Overlay */}
      {itemSelection && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2500 }}>
          <div style={{ background: 'linear-gradient(180deg, #1a1a00 0%, #0a0a00 100%)', border: '3px solid #ffaa00', borderRadius: 8, padding: 30, textAlign: 'center', boxShadow: '0 0 40px rgba(255,170,0,0.5)' }}>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#ffaa00', marginBottom: 16 }}>🎁 Choose an Item Component</div>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
              {itemSelection.items.map((itemKey, idx) => {
                const comp = ITEM_COMPONENTS[itemKey];
                if (!comp) return null;
                return React.createElement('div', {
                  key: idx,
                  onClick: () => {
                    setItemInventory(prev => [...prev, itemKey]);
                    setItemSelection(null);
                    setLog(prev => [`🔩 Acquired ${comp.name}!`, ...prev.slice(0, 9)]);
                    sound.upgrade();
                  },
                  style: {
                    width: 100, padding: 16, background: 'rgba(0,50,0,0.6)', border: '2px solid #00aa00',
                    borderRadius: 8, cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s',
                  },
                  onMouseEnter: (e) => { e.currentTarget.style.background = 'rgba(0,100,0,0.6)'; e.currentTarget.style.borderColor = '#00ff00'; },
                  onMouseLeave: (e) => { e.currentTarget.style.background = 'rgba(0,50,0,0.6)'; e.currentTarget.style.borderColor = '#00aa00'; },
                }, React.createElement('div', { style: { fontSize: 32, marginBottom: 8 } }, comp.icon),
                   React.createElement('div', { style: { fontSize: 12, fontWeight: 'bold', color: '#ffffff', marginBottom: 4 } }, comp.name),
                   React.createElement('div', { style: { fontSize: 10, color: '#aaffaa' } }, comp.desc));
              })}
            </div>
          </div>
        </div>
      )}

      {/* Continue Prompt */}
      {showContinuePrompt && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3100 }}>
          <div style={{ background: 'linear-gradient(180deg, #001a00 0%, #0a0a00 100%)', border: '3px solid #00ff00', borderRadius: 8, padding: 30, textAlign: 'center', boxShadow: '0 0 50px rgba(0,255,0,0.3)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>☢️</div>
            <div style={{ fontSize: 20, fontWeight: 'bold', color: '#00ff00', marginBottom: 16 }}>Save Found!</div>
            <div style={{ fontSize: 14, color: '#aaffaa', marginBottom: 20 }}>Continue your previous run?</div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={() => { setShowContinuePrompt(false); }} style={{ padding: '10px 24px', fontSize: 14, background: 'rgba(100,0,0,0.4)', border: '1px solid #ff6666', borderRadius: 4, color: '#ff6666', cursor: 'pointer', fontFamily: 'inherit' }}>New Game</button>
              <button onClick={() => { loadGame(); setShowContinuePrompt(false); }} style={{ padding: '10px 24px', fontSize: 14, background: 'rgba(0,100,0,0.6)', border: '2px solid #00ff00', borderRadius: 4, color: '#00ff00', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 'bold' }}>Continue</button>
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
          React.createElement('div', { style: { background: 'linear-gradient(180deg, #001a00 0%, #0a0a00 100%)', border: '3px solid #00ff00', borderRadius: 8, padding: 30, textAlign: 'center', maxWidth: 400, boxShadow: '0 0 50px rgba(0,255,0,0.3)' } },
            React.createElement('div', { style: { fontSize: 48, marginBottom: 12 } }, step.icon),
            React.createElement('div', { style: { fontSize: 20, fontWeight: 'bold', color: '#00ff00', marginBottom: 8 } }, step.title),
            React.createElement('div', { style: { fontSize: 14, color: '#aaffaa', marginBottom: 20, lineHeight: 1.5 } }, step.text),
            React.createElement('div', { style: { fontSize: 10, color: '#666', marginBottom: 12 } }, `${tutorialStep + 1} / ${steps.length}`),
            React.createElement('div', { style: { display: 'flex', gap: 12, justifyContent: 'center' } },
              React.createElement('button', { onClick: () => { setShowTutorial(false); localStorage.setItem('wt_tutorial_seen', '1'); }, style: { padding: '8px 16px', fontSize: 12, background: 'rgba(100,0,0,0.4)', border: '1px solid #ff6666', borderRadius: 4, color: '#ff6666', cursor: 'pointer', fontFamily: 'inherit' } }, 'Skip'),
              React.createElement('button', { onClick: () => { if (tutorialStep < steps.length - 1) setTutorialStep(s => s + 1); else { setShowTutorial(false); localStorage.setItem('wt_tutorial_seen', '1'); } }, style: { padding: '8px 24px', fontSize: 12, background: 'rgba(0,100,0,0.6)', border: '2px solid #00ff00', borderRadius: 4, color: '#00ff00', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 'bold' } }, tutorialStep < steps.length - 1 ? 'Next →' : "Let's Go!")
            )
          )
        );
      })()}

      {/* Augment Choice Overlay */}
      {augmentChoice && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2500 }}>
          <div style={{ background: 'linear-gradient(180deg, #0a001a 0%, #0a0a00 100%)', border: '3px solid #9900ff', borderRadius: 8, padding: 30, textAlign: 'center', boxShadow: '0 0 40px rgba(153,0,255,0.5)' }}>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#cc66ff', marginBottom: 16 }}>⚡ Choose an Augment</div>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
              {augmentChoice.options.map((aug, idx) => (
                React.createElement('div', {
                  key: idx,
                  onClick: () => {
                    setAugments(prev => [...prev, aug.id]);
                    setAugmentChoice(null);
                    // Apply immediate effects
                    if (aug.effect.benchAdd) {
                      setBench(prev => [...prev, ...Array(aug.effect.benchAdd).fill(null)]);
                    }
                    setLog(prev => [`⚡ Acquired augment: ${aug.name}!`, ...prev.slice(0, 9)]);
                    sound.upgrade();
                  },
                  style: {
                    width: 120, padding: 16, background: 'rgba(50,0,80,0.6)', border: '2px solid #9900ff',
                    borderRadius: 8, cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s',
                  },
                  onMouseEnter: (e) => { e.currentTarget.style.background = 'rgba(80,0,120,0.6)'; e.currentTarget.style.borderColor = '#cc66ff'; },
                  onMouseLeave: (e) => { e.currentTarget.style.background = 'rgba(50,0,80,0.6)'; e.currentTarget.style.borderColor = '#9900ff'; },
                },
                  React.createElement('div', { style: { fontSize: 32, marginBottom: 8 } }, aug.icon),
                  React.createElement('div', { style: { fontSize: 12, fontWeight: 'bold', color: '#ffffff', marginBottom: 4 } }, aug.name),
                  React.createElement('div', { style: { fontSize: 10, color: '#cc99ff' } }, aug.desc)
                )
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Game Over */}
      {phase === 'gameover' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div style={{ background: 'linear-gradient(180deg, #1a0000 0%, #0a0a00 100%)', border: '3px solid #ff0000', borderRadius: 8, padding: 40, textAlign: 'center', boxShadow: '0 0 50px rgba(255,0,0,0.5)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>☠️</div>
            <div style={{ fontSize: 32, fontWeight: 'bold', color: '#ff0000', marginBottom: 8 }}>YOU DIED</div>
            <div style={{ fontSize: 18, marginBottom: 12, opacity: 0.8 }}>Survived {round} rounds</div>
            <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 4 }}>Level {level} | {augments.length} augment{augments.length !== 1 ? 's' : ''} | {itemInventory.length} item{itemInventory.length !== 1 ? 's' : ''}</div>
            {augments.length > 0 && <div style={{ fontSize: 10, opacity: 0.5, marginBottom: 12 }}>Augments: {augments.map(id => AUGMENT_POOL.find(a => a.id === id)?.icon || '').join(' ')}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button onClick={restart} style={{ padding: '12px 32px', fontSize: 16, background: 'rgba(0,100,0,0.6)', border: '2px solid #00ff00', borderRadius: 4, color: '#00ff00', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 'bold' }}>🔄 RESTART</button>
              <button onClick={() => { navigator.clipboard?.writeText(`☢️ Wasteland Tactics - Survived ${round} rounds! Level ${level}, ${augments.length} augments.`); }} style={{ padding: '12px 16px', fontSize: 12, background: 'rgba(0,0,100,0.4)', border: '1px solid #6666ff', borderRadius: 4, color: '#6666ff', cursor: 'pointer', fontFamily: 'inherit' }}>📋 Share</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WastelandTactics;
