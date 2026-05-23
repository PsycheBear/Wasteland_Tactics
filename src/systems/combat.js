import { UNIT_DATABASE, MELEE_UNITS, isMeleeUnit } from '../data/units.js';
import { getWeaponType, WEAPON_COLORS } from './unitTypes.js';
import { TRAITS } from '../data/traits.js';
import { ITEM_COMPONENTS, COMPLETED_ITEMS, getRandomComponent } from '../data/items.js';
import { AUGMENT_POOL } from '../data/augments.js';
import { BOSS_DATABASE } from '../data/bosses.js';
import { getDifficultyMode, DEFAULT_DIFFICULTY_ID } from '../data/difficulty.js';
import { isPveRound, getPveWave } from '../data/pveWaves.js';
import { COST_COLORS, POOL_SIZES, UNIT_KEYS, XP_TO_LEVEL, CAROUSEL_ROUNDS, isCarouselRound, getRandomCost, makeUid } from '../data/constants.js';
import { sound, WT_SETTINGS } from './audio.js';

// ── FO4 Companion roster ─────────────────────────────────────────────
// Used by Sole Survivor's "Survivor's Bond" passive (each hex-adjacent FO4
// companion grants +8% ATK and +8% AP gain). Agent B is shipping the
// canonical list at `../data/fo4Companions.js` in the same wave; the
// integration step will swap this inline default for the real import.
// Until then this fallback keeps combat.js loadable and tests green.
// Canonical roster (12). Codsworth was removed in the character overhaul so
// the Survivor's Bond passive no longer searches for him.
export const FO4_COMPANIONS = [
  'cait', 'curie', 'danse', 'deacon', 'dogmeat',
  'hancock', 'maccready', 'nick', 'piper', 'preston', 'strong',
  'x6-88',
];

// ── Dual-range positional resolver ──────────────────────────────────
// Units with `range === 'dual'` (Agent B: Hancock, Sarah Lyon, Sole
// Survivor) resolve to ranged when they sit in the back row of their half
// of the board and to melee when they sit in the front row. Range LOCKS
// at the start of each combat round — it does not flip mid-fight if the
// unit is repositioned by abilities or knockbacks.
//
// Board layout: 14 slots / 2 rows of 7.
//   slots 0-6  = row 0 (player back / enemy back)
//   slots 7-13 = row 1 (player front / enemy front)
// For BOTH sides the back row is the slot's lower row index — the
// helper just looks at `pos` and decides. (When the spec talks about
// rows 1-4 it's a 4-row mental model; this engine uses 2 rows, so
// "back half" = row 0 and "front half" = row 1.)
//
// Returns `{ range: 'ranged'|'melee', attackRange: number }` for the
// effective values; the unit's static `attackRange` (number) is used
// as the ranged distance, falling back to 4 when not provided.
export const resolveDualRange = (unit, position) => {
  const isBack = Math.floor((position ?? 0) / 7) === 0;
  if (isBack) {
    // Back half → ranged. Prefer the unit's declared ranged distance.
    const declared = typeof unit.attackRange === 'number' ? unit.attackRange : null;
    return { range: 'ranged', attackRange: declared || 4 };
  }
  return { range: 'melee', attackRange: 1 };
};

// Apply dual-range lock to a unit in place. Idempotent; only fires when
// the unit's `range` field is the string 'dual' (Agent B's flag). Existing
// numeric `range` values (1..4) are left untouched, so non-dual units are
// completely unaffected.
export const lockDualRange = (unit) => {
  if (!unit || unit.range !== 'dual') return false;
  const eff = resolveDualRange(unit, unit.position ?? 0);
  unit._effectiveRange = eff.range;
  unit._effectiveAttackRange = eff.attackRange;
  return true;
};

// ── Robot Dog augment transform ─────────────────────────────────────
// `aug_robot_dog` augment (Agent B's `characterAugments.js`) upgrades
// the player's highest-star Dogmeat into a Robot Dog, preserving stars
// and equipped items. If no Dogmeat is owned, a 1★ Robot Dog is added
// to the bench. Game.jsx owns the augment-application orchestration —
// this helper does the data shape change in one place.
//
// `player` should expose `.board` (array of slots, may contain nulls)
// and `.bench` (array). Either may be undefined; we no-op gracefully.
// Returns `true` if a transformation or bench insertion happened.
export const applyRobotDogTransform = (player) => {
  if (!player) return false;
  const board = Array.isArray(player.board) ? player.board : [];
  const bench = Array.isArray(player.bench) ? player.bench : [];
  // Highest-star Dogmeat across board + bench. Ties broken by board first.
  let bestSrc = null; // { from: 'board'|'bench', idx: number, ref: unit }
  const scan = (arr, from) => {
    for (let i = 0; i < arr.length; i++) {
      const u = arr[i];
      if (!u || u.id !== 'dogmeat') continue;
      if (!bestSrc || (u.stars || 1) > (bestSrc.ref.stars || 1)) {
        bestSrc = { from, idx: i, ref: u };
      }
    }
  };
  scan(board, 'board');
  scan(bench, 'bench');
  if (bestSrc) {
    // In-place id swap. Stars + items + uid preserved.
    bestSrc.ref.id = 'robot-dog';
    return true;
  }
  // No Dogmeat — drop a fresh 1★ Robot Dog onto the bench. Game.jsx
  // is expected to materialize uid / make this a proper unit record.
  if (Array.isArray(player.bench)) {
    player.bench.push({ id: 'robot-dog', stars: 1, items: [] });
    return true;
  }
  return false;
};

// Hex-adjacent neighbours on the 2-row × 7-col board, used by Sole
// Survivor's Survivor's Bond passive. The board is stored linearly but
// laid out with offset rows: a unit at (row 0, col c) is adjacent to
// (row 0, c-1), (row 0, c+1), (row 1, c-1), (row 1, c); a unit at
// (row 1, c) is adjacent to (row 1, c-1), (row 1, c+1), (row 0, c),
// (row 0, c+1). (Two-row boards naturally cap neighbours at 4 not 6.)
export const hexNeighbors = (pos) => {
  const row = Math.floor(pos / 7);
  const col = pos % 7;
  const out = [];
  const push = (r, c) => { if (r >= 0 && r < 2 && c >= 0 && c < 7) out.push(r * 7 + c); };
  push(row, col - 1);
  push(row, col + 1);
  if (row === 0) { push(1, col - 1); push(1, col); }
  else { push(0, col); push(0, col + 1); }
  return out;
};

// Count hex-adjacent FO4 companions for a given board slot. Used by
// Sole Survivor's Survivor's Bond passive (+8% ATK/AP per adjacent
// companion). Exported for unit tests; the live runCombat path inlines
// the same arithmetic.
export const countAdjacentFo4Companions = (board, position) => {
  if (!Array.isArray(board) || typeof position !== 'number') return 0;
  let n = 0;
  for (const adj of hexNeighbors(position)) {
    const u = board[adj];
    if (u && FO4_COMPANIONS.includes(u.id)) n++;
  }
  return n;
};

// Apply the Survivor's Bond multiplier to a unit's atk + apGain in place.
// Returns the multiplier applied (1.0 if no bond). Idempotent — call once
// at combat start.
export const applySurvivorsBond = (unit, board) => {
  if (!unit || unit.id !== 'sole-survivor') return 1;
  const count = countAdjacentFo4Companions(board, unit.position);
  if (count <= 0) return 1;
  const mult = 1 + count * 0.08;
  unit.atk *= mult;
  unit.baseAtk = (unit.baseAtk || unit.atk) * mult;
  unit.apGain = (unit.apGain || 0) * mult;
  unit._survivorsBondCount = count;
  return mult;
};

// Apply Sole Survivor's per-round PERMANENT growth to a persistent unit
// record. Returns the new scalingBonus object.
export const accrueSoleSurvivorRoundBonus = (unit) => {
  if (!unit || unit.id !== 'sole-survivor') return null;
  const base = unit.scalingBonus || { atk: 0, hp: 0, def: 0 };
  const next = { atk: base.atk + 5, hp: base.hp + 50, def: base.def + 1 };
  unit.scalingBonus = next;
  return next;
};

// Apply Sole Survivor's per-attack IN-COMBAT growth in place. Mutates atk
// + maxHp + currentHp. Returns the new total in-combat bonus.
export const accrueSoleSurvivorAttackBonus = (unit) => {
  if (!unit || unit.id !== 'sole-survivor') return null;
  unit.atk += 2;
  unit.baseAtk = (unit.baseAtk || unit.atk) + 2;
  unit.maxHp += 20;
  unit.currentHp += 20;
  unit._ssInCombatAtk = (unit._ssInCombatAtk || 0) + 2;
  unit._ssInCombatHp = (unit._ssInCombatHp || 0) + 20;
  return { atk: unit._ssInCombatAtk, hp: unit._ssInCombatHp };
};

// ── Mothman darkness-shroud damage modifier ─────────────────────────
// When a unit takes damage and it's the Mothman boss with darkness_shroud
// active, look up the current phase's incoming-damage multiplier (thick
// halves AoE, thin doubles single-target). For any other target this is a
// pass-through (returns the original damage unchanged), so we can call it
// unconditionally on every damage write.
export const applyShroudMultiplier = (target, damage, isAoE) => {
  if (!target) return damage;
  // Lorenzo Cabot: takes 50% less damage while ANY player unit is frozen.
  if (target.isBoss && target.crimsonStasis && target._lorenzoActive) {
    damage = damage * 0.5;
  }
  if (!target.isBoss || target.bossMechanic !== 'darkness_shroud') return damage;
  const phases = target.shroudPhases;
  const effects = target.shroudEffects;
  if (!Array.isArray(phases) || !effects) return damage;
  const phaseName = phases[target._shroudPhaseIdx || 0];
  const eff = effects[phaseName];
  if (!eff) return damage;
  const mult = isAoE ? (eff.aoeIncomingMult ?? 1) : (eff.singleTargetIncomingMult ?? 1);
  return damage * mult;
};

// ── Grid distance for proximity targeting ───────────────────────────
// Board is 2 rows of 7: positions 0-6 = row 0, 7-13 = row 1
// Player front row (7-13) faces enemy front row (7-13), back rows face each other
const gridRow = (pos) => Math.floor(pos / 7);
const gridCol = (pos) => pos % 7;
const gridDist = (posA, posB, opposingSide = false) => {
  const colA = gridCol(posA), colB = gridCol(posB);
  const rowA = gridRow(posA), rowB = gridRow(posB);
  // When targeting the opposing side, front rows (row 1) are closest to each other
  // Effective row distance: player row 1 vs enemy row 1 = 0, row 1 vs row 0 = 1, row 0 vs row 0 = 2
  const effectiveRowDist = opposingSide ? (1 - rowA) + (1 - rowB) : Math.abs(rowA - rowB);
  return Math.abs(colA - colB) + effectiveRowDist;
};

// ── getActiveSynergies ──────────────────────────────────────────────
export const getActiveSynergies = (board) => {
  const boardUnits = board.filter(u => u !== null);
  const uniqueUnitTypes = [...new Set(boardUnits.map(u => u.id))];
  const traitCounts = {};
  uniqueUnitTypes.forEach(unitId => {
    const unit = UNIT_DATABASE[unitId];
    unit.traits.forEach(trait => { traitCounts[trait] = (traitCounts[trait] || 0) + 1; });
  });
  return Object.entries(traitCounts).filter(([trait, count]) => count >= 2).map(([trait, count]) => ({ trait, count, ...TRAITS[trait] }));
};

// ── Ghost Player System ─────────────────────────────────────────────
const GHOST_NAMES = ['Raider Boss', 'Vault Dweller', 'Brotherhood Knight', 'Railroad Agent', 'Institute Synth', 'Minuteman General', 'Wasteland Drifter'];

export const initGhostPlayers = (pool) => {
  // Pick 2 preferred traits per ghost to guide their drafting
  const allTraits = Object.keys(TRAITS);
  return GHOST_NAMES.map((name, i) => {
    const t1 = allTraits[Math.floor(Math.random() * allTraits.length)];
    let t2 = allTraits[Math.floor(Math.random() * allTraits.length)];
    while (t2 === t1) t2 = allTraits[Math.floor(Math.random() * allTraits.length)];
    return { name, id: i, preferredTraits: [t1, t2], board: [], level: 3, hp: 100, alive: true };
  });
};

// Ghost AI scorer (Wave 3) — replaces the previous random cost-weighted draft.
//
// For each pool-eligible candidate unit we compute:
//   score = costWeight                                    // higher-cost = stronger
//         + traitStackingBonus                            // 50 * (existing copies of this trait already on the board, summed across all of the candidate's traits) — naturally fills 2-piece breakpoints before 4-piece
//         + roundFitBonus                                 // penalises units far from the round's target avg cost (round/3)
//         + preferredTraitBonus                           // small thumb on the scale toward each ghost's two preferred traits
//
// We greedily pick the top-scored, in-pool candidate for each open slot.
// `getCandidateScore` is exported for unit tests.
export const getCandidateScore = (ghost, unitKey, round) => {
  const unit = UNIT_DATABASE[unitKey];
  if (!unit) return -Infinity;
  const costWeight = unit.cost * 10;

  // Trait stacking — count existing trait occurrences across ghost.board.
  // Each shared trait contributes +50 per existing copy of that trait,
  // so e.g. 1 existing Minutemen on the board makes a 2nd Minutemen pick +50.
  const traitCounts = {};
  for (const u of ghost.board) {
    const base = UNIT_DATABASE[u.id];
    if (!base) continue;
    for (const t of base.traits) traitCounts[t] = (traitCounts[t] || 0) + 1;
  }
  let traitStackingBonus = 0;
  for (const t of unit.traits) {
    traitStackingBonus += 50 * (traitCounts[t] || 0);
  }

  // Round-appropriate cost preference — penalise units far from the
  // round's target average cost (round/3). Keeps early ghosts on 1-cost
  // chaff and late ghosts on 4/5-cost carries.
  const targetCost = round / 3;
  const roundFitBonus = -10 * Math.abs(unit.cost - targetCost);

  const preferredTraitBonus = unit.traits.some(t => ghost.preferredTraits?.includes(t)) ? 8 : 0;

  return costWeight + traitStackingBonus + roundFitBonus + preferredTraitBonus;
};

export const ghostPlayerShop = (ghost, pool, round) => {
  if (!ghost.alive) return;
  // Ghost levels up roughly with the round
  ghost.level = Math.min(9, 3 + Math.floor(round / 3));
  const maxBoardSize = ghost.level;

  // Ghost tries to buy 1-2 units per round from the pool, picking the
  // highest-scoring in-pool candidate each iteration (greedy fill).
  const buyCount = round <= 3 ? 1 : Math.min(2, maxBoardSize - ghost.board.length);
  for (let b = 0; b < buyCount; b++) {
    if (ghost.board.length >= maxBoardSize) break;
    const candidates = UNIT_KEYS.filter(k => pool[k] > 0);
    if (candidates.length === 0) continue;
    let best = null;
    let bestScore = -Infinity;
    for (const k of candidates) {
      const s = getCandidateScore(ghost, k, round);
      if (s > bestScore) { bestScore = s; best = k; }
    }
    if (!best) continue;
    pool[best]--;
    ghost.board.push({ id: best, stars: 1, boughtRound: round });
  }

  // Upgrade: if ghost has 3 copies of same unit at same star level, upgrade
  const counts = {};
  ghost.board.forEach((u, i) => {
    const key = `${u.id}_${u.stars}`;
    if (!counts[key]) counts[key] = [];
    counts[key].push(i);
  });
  // Upgrade 1-star to 2-star, then 2-star to 3-star
  for (const starLevel of [1, 2]) {
    const counts2 = {};
    ghost.board.forEach((u, i) => {
      const key = `${u.id}_${u.stars}`;
      if (!counts2[key]) counts2[key] = [];
      counts2[key].push(i);
    });
    Object.entries(counts2).forEach(([key, indices]) => {
      if (indices.length >= 3 && key.endsWith(`_${starLevel}`)) {
        const unitId = ghost.board[indices[0]].id;
        const toRemove = new Set(indices.slice(0, 3));
        ghost.board = ghost.board.filter((_, i) => !toRemove.has(i));
        ghost.board.push({ id: unitId, stars: starLevel + 1, boughtRound: round });
      }
    });
  }
};

// Ghost item assignment (Wave 3). When a ghost holds completed items in its
// (optional) `ghost.items` array, equip each to whichever of its board units
// has the highest base HP. This is intentionally simple — it just picks the
// chunkiest unit on the team as the "items go on the tank" carrier.
//
// Returns the unit id chosen (or null if the board is empty), for tests.
export const ghostEquipItem = (ghost, itemId) => {
  if (!ghost?.board || ghost.board.length === 0) return null;
  let bestIdx = -1;
  let bestHp = -Infinity;
  for (let i = 0; i < ghost.board.length; i++) {
    const u = ghost.board[i];
    const base = UNIT_DATABASE[u?.id];
    if (!base) continue;
    const starMult = u.stars === 3 ? 2.5 : u.stars === 2 ? 1.8 : 1;
    const hp = base.hp * starMult;
    if (hp > bestHp) { bestHp = hp; bestIdx = i; }
  }
  if (bestIdx === -1) return null;
  const target = ghost.board[bestIdx];
  target.items = target.items || [];
  target.items.push(itemId);
  return target.id;
};

export const ghostPlayerBoard = (ghost, round) => {
  // Convert ghost's board into combat-ready enemy units (no items)
  const slots = Array(14).fill(null);
  const boardUnits = ghost.board.slice(0, ghost.level);
  const melee = boardUnits.filter(u => isMeleeUnit(u.id));
  const ranged = boardUnits.filter(u => !isMeleeUnit(u.id));
  let slotIdx = 0;

  // Place ranged in back row (0-6), melee in front row (7-13)
  ranged.forEach((u, i) => {
    if (i >= 7) return;
    const unit = UNIT_DATABASE[u.id];
    const stars = u.stars;
    const mult = stars === 3 ? 2.5 : stars === 2 ? 1.8 : 1;
    const roundScale = 1 + round * 0.05;
    const baseAtk = unit.atk * mult * roundScale;
    const attackSpeed = unit.attackSpeed ?? 1.0;
    slots[i] = {
      ...unit, id: u.id, stars, uid: `ghost_${ghost.id}_${slotIdx++}`,
      currentHp: unit.hp * mult * roundScale, maxHp: unit.hp * mult * roundScale,
      atk: baseAtk, baseAtk, baseDef: unit.def * mult, def: unit.def * mult,
      position: i, isEnemy: true, stunDuration: 0,
      mana: 0, manaMax: unit.apMax || 0, apGain: unit.apGain || 0, apOnHit: unit.apOnHit || 0,
      abilityUsed: false, buffDuration: 0, buffAtkMult: 1,
      attackSpeed, attackCooldown: attackSpeed * 10,
      items: [],
    };
  });
  melee.forEach((u, i) => {
    if (i >= 7) return;
    const unit = UNIT_DATABASE[u.id];
    const stars = u.stars;
    const mult = stars === 3 ? 2.5 : stars === 2 ? 1.8 : 1;
    const roundScale = 1 + round * 0.05;
    const baseAtk = unit.atk * mult * roundScale;
    const attackSpeed = unit.attackSpeed ?? 1.0;
    slots[7 + i] = {
      ...unit, id: u.id, stars, uid: `ghost_${ghost.id}_${slotIdx++}`,
      currentHp: unit.hp * mult * roundScale, maxHp: unit.hp * mult * roundScale,
      atk: baseAtk, baseAtk, baseDef: unit.def * mult, def: unit.def * mult,
      position: 7 + i, isEnemy: true, stunDuration: 0,
      mana: 0, manaMax: unit.apMax || 0, apGain: unit.apGain || 0, apOnHit: unit.apOnHit || 0,
      abilityUsed: false, buffDuration: 0, buffAtkMult: 1,
      attackSpeed, attackCooldown: attackSpeed * 10,
      items: [],
    };
  });
  // Lock dual-range units to ranged/melee based on their starting row.
  slots.forEach(s => { if (s) lockDualRange(s); });
  return slots;
};

// ── generateEnemies ─────────────────────────────────────────────────
// `difficultyId` (Wave 3) scales enemy HP/ATK via DIFFICULTY_MODES. Omit it
// or pass 'normal' to preserve the legacy 1.0x behavior — combat-parity tests
// assert that 'normal' produces identical numbers to the pre-Wave-3 engine.
export const generateEnemies = (round, difficultyId = DEFAULT_DIFFICULTY_ID) => {
  const diff = getDifficultyMode(difficultyId);
  const hpMult = diff.enemyHpMult;
  const atkMult = diff.enemyAtkMult;

  // === BOSS ROUND ===
  if (round > 3 && round % 7 === 0 && BOSS_DATABASE[round]) {
    const boss = BOSS_DATABASE[round];
    const roundScale = 1 + round * 0.04;
    const slots = Array(14).fill(null);
    const bossHp = boss.hp * roundScale * hpMult;
    const bossAtk = boss.atk * roundScale * atkMult;
    slots[3] = {
      name: boss.name, id: 'boss_' + round, stars: 3, uid: 'boss_0', isBoss: true,
      currentHp: bossHp, maxHp: bossHp,
      atk: bossAtk, baseAtk: bossAtk,
      baseDef: boss.def, def: boss.def, position: 3, isEnemy: true, stunDuration: 0,
      mana: 0, manaMax: 0, apGain: 0, apOnHit: 0, abilityUsed: false, buffDuration: 0, buffAtkMult: 1,
      attackSpeed: 0.8, attackCooldown: 8,
      traits: [], cost: 5, items: [],
      bossMechanic: boss.mechanic, bossInterval: boss.mechanicInterval,
      bossDmg: boss.mechanicDmg || 0, bossEnrageThreshold: boss.enrageThreshold || 0,
      enrageAtkMult: boss.enrageAtkMult || 2,
      // Side-flags for the new (Wave-2) bosses. The mechanic key may be
      // recycled ('stomp', 'poison', 'spawn') — these flags are what the
      // tick loop reads to dispatch the new behaviour.
      courserTeleport: !!boss.courserTeleport,
      glowBurst: !!boss.glowBurst,
      deathHealAllies: typeof boss.deathHealAllies === 'number' ? boss.deathHealAllies : 0,
      crimsonStasis: !!boss.crimsonStasis,
      stasisDuration: boss.stasisDuration || 0,
      // Mothman darkness-shroud bookkeeping. Phase index starts at 0 ('thick').
      // Only meaningful when bossMechanic === 'darkness_shroud'.
      shroudPhases: boss.shroudPhases || null,
      shroudEffects: boss.shroudEffects || null,
      _shroudPhaseIdx: 0,
      _bossTickCounter: 0, _enraged: false,
    };
    return slots;
  }

  // === PVE CREEP ROUND ===
  // Themed creep waves (raiders, triggermen, the pack, hood disciples, etc.)
  // pull from public/images/creeps/<id>.png with custom stats per round —
  // these are NOT shop-roster units. TFT-style krug/wolf/raptor equivalents.
  const pveWave = isPveRound(round) ? getPveWave(round) : null;
  if (pveWave && pveWave.creeps && pveWave.creeps.length > 0) {
    // Count + stats scale with round stage. Curve tuned to feel TFT-Krug-easy
    // on stage 1 and ramp predictably through stage 6 (round 42 endgame).
    const stage = Math.ceil(round / 7);
    const creepCount = Math.min(2 + Math.floor((round - 1) / 3), 5);
    const baseHpForRound = 250 + (stage - 1) * 200;       // 250, 450, 650, 850, 1050, 1250
    const baseAtkForRound = 24 + (stage - 1) * 18;        // 24, 42, 60, 78, 96, 114
    const baseDefForRound = 14 + (stage - 1) * 8;
    const creeps = Array(creepCount).fill(null).map((_, i) => {
      // Rotate through the wave's creep art so a wave of 4 with 2 art entries
      // produces an alternating squad.
      const creepArt = pveWave.creeps[i % pveWave.creeps.length];
      const ext = creepArt.endsWith('-courser') || creepArt === 'glowing-one' || creepArt === 'atom-theil' || creepArt === 'swan' ? 'webp' : 'png';
      const isMelee = /raider|pack|super-mutant|hood-disciple|triggerman/.test(creepArt);
      return {
        name: pveWave.name,
        id: `creep_${creepArt}_${i}`,                     // unique id, scoped to the round
        creepArt,                                          // UI hint: images/creeps/<creepArt>.<ext>
        creepArtExt: ext,
        stars: 1, uid: `enemy_creep_${round}_${i}`,
        currentHp: baseHpForRound * hpMult,
        maxHp: baseHpForRound * hpMult,
        atk: baseAtkForRound * atkMult,
        baseAtk: baseAtkForRound * atkMult,
        baseDef: baseDefForRound,
        def: baseDefForRound,
        position: 0, isEnemy: true, isCreep: true, stunDuration: 0,
        mana: 0, manaMax: 0, apGain: 0, apOnHit: 0,
        abilityUsed: true,                                 // creeps don't cast abilities
        buffDuration: 0, buffAtkMult: 1,
        attackSpeed: 1.0, attackCooldown: 10,
        traits: [], cost: 1, items: [],
        attackRange: isMelee ? 1 : 3,
        _meleeCreep: isMelee,
      };
    });
    const slots = Array(14).fill(null);
    // Melee creeps in the FRONT (closest to player) — positions 7-13.
    // Ranged creeps in the BACK row — positions 0-6.
    const meleeCreeps = creeps.filter(c => c._meleeCreep);
    const rangedCreeps = creeps.filter(c => !c._meleeCreep);
    meleeCreeps.forEach((c, i) => { if (i < 7) { c.position = 7 + i; slots[7 + i] = c; } });
    rangedCreeps.forEach((c, i) => { if (i < 7) { c.position = i; slots[i] = c; } });
    return slots;
  }

  // === GHOST-LIKE PVP ROUND (fallback for non-PvE non-boss rounds) ===
  const count = Math.min(Math.ceil(round / 2) + 1, 7);
  const maxCost = round <= 3 ? 1 : round <= 6 ? 2 : round <= 8 ? 3 : round <= 10 ? 4 : 5;
  const rawEnemies = Array(count).fill(null).map((_, i) => {
    const eligible = UNIT_KEYS.filter(k => UNIT_DATABASE[k].cost <= maxCost);
    const unitKey = eligible[Math.floor(Math.random() * eligible.length)];
    const unit = UNIT_DATABASE[unitKey];
    const starRoll = Math.random();
    const stars = round >= 12 ? (starRoll > 0.7 ? 3 : starRoll > 0.4 ? 2 : 1) :
                  round >= 5 ? (starRoll > 0.6 ? 2 : 1) : 1;
    const mult = stars === 3 ? 2.5 : stars === 2 ? 1.8 : 1;
    const roundScale = 1 + round * 0.06;
    const baseAtk = unit.atk * mult * roundScale * atkMult;
    const baseHp = unit.hp * mult * (1 + round * 0.08) * hpMult;
    const attackSpeed = unit.attackSpeed ?? 1.0;
    return {
      ...unit, id: unitKey, stars, uid: `enemy_${i}`,
      currentHp: baseHp, maxHp: baseHp,
      atk: baseAtk, baseAtk, baseDef: unit.def * mult, def: unit.def * mult, position: 0, isEnemy: true, stunDuration: 0,
      mana: 0, manaMax: unit.apMax || 0, apGain: unit.apGain || 0, apOnHit: unit.apOnHit || 0,
      abilityUsed: false, buffDuration: 0, buffAtkMult: 1,
      attackSpeed, attackCooldown: attackSpeed * 10,
      items: [],
    };
  });
  const melee = rawEnemies.filter(e => isMeleeUnit(e.id));
  const ranged = rawEnemies.filter(e => !isMeleeUnit(e.id));
  const slots = Array(14).fill(null);
  ranged.forEach((e, i) => { if (i < 7) { e.position = i; slots[i] = e; } });
  melee.forEach((e, i) => { if (i < 7) { e.position = 7 + i; slots[7 + i] = e; } });
  // Lock dual-range units to ranged/melee based on their starting row.
  slots.forEach(s => { if (s) lockDualRange(s); });
  return slots;
};

// ── spawnFloat ──────────────────────────────────────────────────────
export const spawnFloat = (damage, isCrit, targetUid, isEnemyHit = false, setFloatingNumbers) => {
  const id = `float_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  requestAnimationFrame(() => { try {
    const el = document.querySelector(`[data-unit-uid="${targetUid}"]`);
    let x = window.innerWidth / 2, y = window.innerHeight / 2;
    if (el) {
      const rect = el.getBoundingClientRect();
      // Random offset so multiple numbers don't stack on top of each other
      x = rect.left + rect.width / 2 + (Math.random() - 0.5) * 30;
      y = rect.top + rect.height * 0.3 + (Math.random() - 0.5) * 10;
    }
    setFloatingNumbers(prev => [...prev.slice(-19), { id, damage: Math.round(damage), isCrit, x, y, isEnemyHit }]);
    setTimeout(() => {
      try { setFloatingNumbers(prev => prev.filter(n => n.id !== id)); } catch(_){}
    }, 900);
  } catch(_) {} });
};

// ── triggerAbility ──────────────────────────────────────────────────
export const triggerAbility = (unit, allies, enemies, logs, abilityMult, abilityUnits) => {
  const starMult = unit.stars;
  // For targeted abilities, filter out untargetable units (Deacon stealth)
  const targetable = enemies.filter(e => e.currentHp > 0 && (e.deaconUntargetable || 0) <= 0);

  switch(unit.id) {
    case 'preston': {
      // Rally Minutemen: +20% ATK to all allies for 4s (8 ticks)
      const buffAmount = 0.2 * starMult * abilityMult;
      allies.forEach(ally => {
        if (ally.currentHp > 0) {
          ally.buffAtkMult = 1 + buffAmount;
          ally.buffDuration = 8;
        }
      });
      logs.unshift(`[UP] ${unit.name} rallies! +${Math.round(buffAmount * 100)}% ATK!`);
      abilityUnits.push(unit.uid);
      try { sound.abilityBuff?.(); } catch(_) { sound.ability(); }
      try { sound.bobbleheadWobble?.(); } catch(_) {}
      allies.forEach(ally => { if (ally.currentHp > 0) { const buffEl = document.querySelector(`[data-unit-uid="${ally.uid}"]`); if (buffEl) buffEl.classList.add('wt-buff-aura'); } });
      return true;
    }

    case 'sturges': {
      // Repair Bot: Heal lowest HP ally for 100 HP
      const healTarget = allies
        .filter(a => a.currentHp > 0 && a.currentHp < a.maxHp)
        .sort((a, b) => (a.currentHp / a.maxHp) - (b.currentHp / b.maxHp))[0];
      if (healTarget) {
        const healAmount = 100 * starMult * abilityMult;
        healTarget.currentHp = Math.min(healTarget.maxHp, healTarget.currentHp + healAmount);
        // 3★ Passive: Scrap Armor — healed ally gains +10 DEF for 4s (8 ticks)
        if (unit.stars >= 3) {
          healTarget.scrapArmorDef = 10;
          healTarget.scrapArmorDuration = 8;
          healTarget.def = (healTarget.baseDef ?? healTarget.def) + 10;
          logs.unshift(`[DEF] Scrap Armor: ${healTarget.name} gains +10 DEF!`);
        }
        logs.unshift(`[TECH] ${unit.name}'s Repair Bot heals ${healTarget.name} for ${Math.round(healAmount)}!`);
        abilityUnits.push(unit.uid);
        try { sound.abilityHeal?.(); } catch(_) { sound.ability(); }
        return true;
      }
      return false;
    }

    case 'cait': {
      // Psycho: +30% ATK, -10% DEF for 5s (10 ticks)
      const atkBuff = 0.3 * starMult * abilityMult;
      unit.buffAtkMult = 1 + atkBuff;
      unit.buffDuration = 10;
      unit.def = Math.max(0, (unit.baseDef ?? unit.def) * 0.9);
      logs.unshift(`[STIM] ${unit.name} uses Psycho! +${Math.round(atkBuff * 100)}% ATK!`);
      abilityUnits.push(unit.uid);
      try { sound.abilityBuff?.(); } catch(_) { sound.ability(); }
      { const buffEl = document.querySelector(`[data-unit-uid="${unit.uid}"]`); if (buffEl) buffEl.classList.add('wt-buff-aura'); }
      return true;
    }

    case 'dogmeat':
    case 'robot-dog': {
      // Attack Dog: Stun highest ATK enemy for 3s (6 ticks), scales with stars.
      // Robot Dog upgrade (aug_robot_dog transform) hits the TOP 2 highest-ATK
      // enemies instead of just one. Stun duration unchanged.
      const aliveEnemies = targetable.filter(e => (e.stunDuration || 0) <= 0);
      if (aliveEnemies.length === 0) return false;
      aliveEnemies.sort((a, b) => b.atk - a.atk);
      const stunCount = unit.id === 'robot-dog' ? 2 : 1;
      const stunTargets = aliveEnemies.slice(0, Math.min(stunCount, aliveEnemies.length));
      const stunTicks = (4 + starMult * 2) * abilityMult;
      stunTargets.forEach(t => {
        t.stunDuration = Math.round(stunTicks);
        const stunEl = document.querySelector(`[data-unit-uid="${t.uid}"]`); if (stunEl) stunEl.classList.add('wt-stunned');
      });
      logs.unshift(`[DOG] ${unit.name} pounces on ${stunTargets.map(t => t.name).join(' & ')}! Stunned for ${Math.round(stunTicks / 2)}s!`);
      abilityUnits.push(unit.uid);
      try { sound.abilityAoe?.(); } catch(_) { sound.ability(); }
      return true;
    }

    case 'nick': {
      // Suppression: silence highest ATK enemy (disable ability) for 6s (12 ticks), scales with stars
      const aliveEnemies = targetable.filter(e => !e.suppressed);
      if (aliveEnemies.length === 0) return false;
      aliveEnemies.sort((a, b) => b.atk - a.atk);
      const silenceTarget = aliveEnemies[0];
      const silenceTicks = (8 + starMult * 4) * abilityMult; // 12/16/20 ticks at 1/2/3 stars
      silenceTarget.suppressedDuration = Math.round(silenceTicks);
      silenceTarget.suppressed = true;
      logs.unshift(`[DET] ${unit.name} suppresses ${silenceTarget.name}! Silenced for ${Math.round(silenceTicks / 2)}s!`);
      abilityUnits.push(unit.uid);
      try { sound.abilityDebuff?.(); } catch(_) { sound.ability(); }
      return true;
    }

    case 'dima': {
      // Memory Lane: revive dead ally with 40% HP (scales with stars)
      // 3★ Passive: Perfect Recall — revive 2 allies, both with full AP
      const deadAllies = allies.filter(a => a.currentHp <= 0);
      if (deadAllies.length === 0) return false;
      deadAllies.sort((a, b) => a.position - b.position);
      const reviveCount = unit.stars >= 3 ? Math.min(2, deadAllies.length) : 1;
      const revivePct = 0.4 * (0.8 + starMult * 0.2) * abilityMult;
      for (let ri = 0; ri < reviveCount; ri++) {
        const reviveTarget = deadAllies[ri];
        reviveTarget.currentHp = Math.max(1, Math.floor(reviveTarget.maxHp * revivePct));
        if (unit.stars >= 3) reviveTarget.mana = reviveTarget.manaMax;
        logs.unshift(`[PSI] ${unit.name} recalls ${reviveTarget.name}! Revived with ${Math.round(reviveTarget.currentHp)} HP${unit.stars >= 3 ? ' + full AP!' : '!'}`);
      }
      abilityUnits.push(unit.uid);
      try { sound.abilityHeal?.(); } catch(_) { sound.ability(); }
      return true;
    }

    case 'strong': {
      // Berserker Rage: +50% ATK and gains 200 HP shield for 6s (12 ticks)
      const rageBuff = 0.5 * starMult * abilityMult;
      unit.buffAtkMult = 1 + rageBuff;
      unit.buffDuration = 12;
      const shieldAmt = 200 * starMult * abilityMult;
      unit.currentHp = Math.min(unit.maxHp + shieldAmt, unit.currentHp + shieldAmt);
      logs.unshift(`[STR] ${unit.name} RAGES! +${Math.round(rageBuff * 100)}% ATK, +${Math.round(shieldAmt)} HP shield!`);
      abilityUnits.push(unit.uid);
      try { sound.abilityBuff?.(); } catch(_) { sound.ability(); }
      try { sound.bobbleheadWobble?.(); } catch(_) {}
      { const buffEl = document.querySelector(`[data-unit-uid="${unit.uid}"]`); if (buffEl) buffEl.classList.add('wt-buff-aura'); }
      return true;
    }

    case 'danse': {
      // Ad Victoriam: laser blast hits all enemies for 150 damage
      const aliveEnemies = enemies.filter(e => e.currentHp > 0);
      if (aliveEnemies.length === 0) return false;
      const laserDmg = 150 * starMult * abilityMult;
      aliveEnemies.forEach(e => {
        const dmg = laserDmg * (0.85 + Math.random() * 0.3);
        e.currentHp -= applyShroudMultiplier(e, dmg, true);
      });
      logs.unshift(`[ZAP] ${unit.name}: AD VICTORIAM! Laser blast hits ${aliveEnemies.length} enemies for ~${Math.round(laserDmg)} each!`);
      abilityUnits.push(unit.uid);
      try { sound.abilityAoe?.(); } catch(_) { sound.ability(); }
      return true;
    }

    case 'deathclaw': {
      // Apex Predator: lunge at highest ATK enemy for 3x damage ignoring DEF
      const aliveEnemies = [...targetable];
      if (aliveEnemies.length === 0) return false;
      aliveEnemies.sort((a, b) => b.atk - a.atk);
      const prey = aliveEnemies[0];
      const strikeDmg = unit.atk * 3 * abilityMult;
      prey.currentHp -= strikeDmg;
      logs.unshift(`[CLAW] ${unit.name} SAVAGE STRIKE on ${prey.name}! ${Math.round(strikeDmg)} true damage!`);
      abilityUnits.push(unit.uid);
      try { sound.abilityAoe?.(); } catch(_) { sound.ability(); }
      return true;
    }
    case 'moira': {
      // Experimental Serum: poison 2 enemies, dealing 80 DoT over 4s (8 ticks)
      const aliveEnemies = [...targetable];
      if (aliveEnemies.length === 0) return false;
      const poisonDmg = 80 * starMult * abilityMult;
      const poisonTargets = [...aliveEnemies].sort(() => Math.random() - 0.5).slice(0, 2);
      poisonTargets.forEach(t => {
        t.poisonDmg = (t.poisonDmg || 0) + poisonDmg / 8;
        t.poisonTicks = 8;
        const poisonEl = document.querySelector(`[data-unit-uid="${t.uid}"]`); if (poisonEl) poisonEl.classList.add('wt-poisoned');
      });
      logs.unshift(`[LAB] ${unit.name}'s Serum poisons ${poisonTargets.map(t => t.name).join(' & ')}! ${Math.round(poisonDmg)} over 4s!`);
      abilityUnits.push(unit.uid);
      try { sound.abilityDebuff?.(); } catch(_) { sound.ability(); }
      return true;
    }

    case 'piper': {
      // Exposé: shred highest DEF enemy, -50% DEF for 5s (10 ticks)
      const aliveEnemies = [...targetable];
      if (aliveEnemies.length === 0) return false;
      aliveEnemies.sort((a, b) => b.def - a.def);
      const exposeTarget = aliveEnemies[0];
      exposeTarget.defShredPct = 0.5 * abilityMult;
      exposeTarget.defShredDuration = 10;
      exposeTarget.def = (exposeTarget.baseDef ?? exposeTarget.def) * (1 - exposeTarget.defShredPct);
      logs.unshift(`[NEWS] ${unit.name}'s Exposé shreds ${exposeTarget.name}'s DEF by ${Math.round(exposeTarget.defShredPct * 100)}%!`);
      abilityUnits.push(unit.uid);
      try { sound.abilityDebuff?.(); } catch(_) { sound.ability(); }
      return true;
    }

    case 'hancock': {
      // Ghoulish Fury: AoE radiation burst deals 100 damage to all enemies
      const aliveEnemies = enemies.filter(e => e.currentHp > 0);
      if (aliveEnemies.length === 0) return false;
      const radDmg = 100 * starMult * abilityMult;
      aliveEnemies.forEach(e => {
        e.currentHp -= applyShroudMultiplier(e, radDmg * (0.85 + Math.random() * 0.3), true);
      });
      logs.unshift(`[RAD] ${unit.name}'s Ghoulish Fury! ${Math.round(radDmg)} radiation damage to ${aliveEnemies.length} enemies!`);
      abilityUnits.push(unit.uid);
      try { sound.abilityAoe?.(); } catch(_) { sound.ability(); }
      try { sound.geigerTick?.(); } catch(_) {}
      return true;
    }

    case 'maccready': {
      // Headshot: execute lowest HP enemy for 4x ATK damage
      const aliveEnemies = [...targetable];
      if (aliveEnemies.length === 0) return false;
      aliveEnemies.sort((a, b) => a.currentHp - b.currentHp);
      const executeTarget = aliveEnemies[0];
      const execDmg = unit.atk * 4 * abilityMult;
      executeTarget.currentHp -= execDmg;
      logs.unshift(`[AIM] ${unit.name} HEADSHOT on ${executeTarget.name}! ${Math.round(execDmg)} damage!`);
      abilityUnits.push(unit.uid);
      try { sound.abilityAoe?.(); } catch(_) { sound.ability(); }
      return true;
    }

    case 'fahrenheit': {
      // Incendiary Strike: melee AoE dealing 100 damage + burn DoT to target and adjacent
      const aliveEnemies = [...targetable];
      if (aliveEnemies.length === 0) return false;
      const baseDmg = 100 * starMult * abilityMult;
      const burnPerTick = 50 * starMult * abilityMult / 6;
      const shuffled = [...aliveEnemies].sort(() => Math.random() - 0.5);
      const targets = shuffled.slice(0, Math.min(3, shuffled.length));
      targets.forEach(t => {
        t.currentHp -= applyShroudMultiplier(t, baseDmg, true);
        t.burnDmg = (t.burnDmg || 0) + burnPerTick;
        t.burnTicks = 6;
        const burnEl = document.querySelector(`[data-unit-uid="${t.uid}"]`); if (burnEl) burnEl.classList.add('wt-burning');
      });
      logs.unshift(`[FIRE] ${unit.name}'s Incendiary Strike! ${targets.map(t => t.name).join(', ')} for ${Math.round(baseDmg)} + burn!`);
      abilityUnits.push(unit.uid);
      try { sound.abilityAoe?.(); } catch(_) { sound.ability(); }
      return true;
    }

    case 'curie': {
      // Emergency Protocol: heal all allies for 80 HP
      const healAmount = 80 * starMult * abilityMult;
      let healed = 0;
      allies.forEach(ally => {
        if (ally.currentHp > 0 && ally.currentHp < ally.maxHp) {
          ally.currentHp = Math.min(ally.maxHp, ally.currentHp + healAmount);
          // 3★ Passive: Medical Marvels — healed allies gain +15% attack speed for 3s (6 ticks)
          if (unit.stars >= 3) {
            ally._preCurieAttackSpeed = ally.attackSpeed;
            ally.attackSpeed = ally.attackSpeed / 1.15;
            ally._curieAsBuff = 6;
          }
          healed++;
        }
      });
      if (healed === 0) return false;
      logs.unshift(`[HEAL] ${unit.name}'s Emergency Protocol heals ${healed} allies for ${Math.round(healAmount)}!${unit.stars >= 3 ? ' +15% AS!' : ''}`);
      abilityUnits.push(unit.uid);
      try { sound.abilityHeal?.(); } catch(_) { sound.ability(); }
      return true;
    }

    case 'deacon': {
      // Recall Code: become untargetable for 3s (6 ticks), then strike random enemy for 2x ATK
      unit.deaconUntargetable = 6;
      const aliveEnemies = [...targetable];
      if (aliveEnemies.length > 0) {
        const strikeTarget = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
        const strikeDmg = unit.atk * 2 * abilityMult;
        // Apply damage immediately
        if (strikeTarget.currentHp > 0) strikeTarget.currentHp -= strikeDmg;
        logs.unshift(`[SPY] ${unit.name} vanishes! Strikes ${strikeTarget.name} for ${Math.round(strikeDmg)} on return!`);
      }
      abilityUnits.push(unit.uid);
      try { sound.abilityBuff?.(); } catch(_) { sound.ability(); }
      return true;
    }

    case 'maxson': {
      // Final Judgment: gatling laser hits 3 random enemies for 200 damage each
      const aliveEnemies = [...targetable];
      if (aliveEnemies.length === 0) return false;
      const laserDmg = 200 * starMult * abilityMult;
      const targets = [...aliveEnemies].sort(() => Math.random() - 0.5).slice(0, Math.min(3, aliveEnemies.length));
      targets.forEach(t => {
        t.currentHp -= applyShroudMultiplier(t, laserDmg * (0.85 + Math.random() * 0.3), true);
      });
      logs.unshift(`[ZAP] ${unit.name}: FINAL JUDGMENT! Gatling laser hits ${targets.map(t => t.name).join(', ')} for ~${Math.round(laserDmg)} each!`);
      abilityUnits.push(unit.uid);
      try { sound.abilityAoe?.(); } catch(_) { sound.ability(); }
      return true;
    }

    case 'kellogg': {
      // Cybernetic Override: stun 2 enemies for 3s (6 ticks) + deal 150 damage
      const aliveEnemies = targetable.filter(e => (e.stunDuration || 0) <= 0);
      if (aliveEnemies.length === 0) return false;
      const stunDmg = 150 * starMult * abilityMult;
      const stunTicks = 6 * abilityMult;
      const targets = [...aliveEnemies].sort(() => Math.random() - 0.5).slice(0, Math.min(2, aliveEnemies.length));
      targets.forEach(t => {
        t.stunDuration = Math.round(stunTicks);
        t.currentHp -= applyShroudMultiplier(t, stunDmg, true);
        const stunEl = document.querySelector(`[data-unit-uid="${t.uid}"]`); if (stunEl) stunEl.classList.add('wt-stunned');
      });
      logs.unshift(`[BOT] ${unit.name}'s Cybernetic Override! Stuns & deals ${Math.round(stunDmg)} to ${targets.map(t => t.name).join(' & ')}!`);
      abilityUnits.push(unit.uid);
      try { sound.abilityDebuff?.(); } catch(_) { sound.ability(); }
      return true;
    }

    // ──────────────────────────────────────────────────────────────────
    // Character-overhaul roster additions (20 new units).
    // Same conventions as the existing cases: scale damage/heal by starMult
    // and abilityMult, push to abilityUnits, log with bracket-tag, sound,
    // return true on success.
    // ──────────────────────────────────────────────────────────────────

    case 'cade': {
      // Field Triage: heal lowest-HP ally for 120 HP
      const target = allies.filter(a => a.currentHp > 0 && a.currentHp < a.maxHp)
        .sort((a, b) => (a.currentHp / a.maxHp) - (b.currentHp / b.maxHp))[0];
      if (!target) return false;
      const healAmt = 120 * starMult * abilityMult;
      target.currentHp = Math.min(target.maxHp, target.currentHp + healAmt);
      logs.unshift(`[STIM] ${unit.name}'s Field Triage heals ${target.name} for ${Math.round(healAmt)}!`);
      abilityUnits.push(unit.uid);
      try { sound.abilityHeal?.(); } catch(_) { sound.ability(); }
      return true;
    }

    case 'glory': {
      // Minigun Spray: AoE hit up to 4 enemies for 70 each
      const aliveEnemies = targetable.slice().sort(() => Math.random() - 0.5).slice(0, 4);
      if (aliveEnemies.length === 0) return false;
      const dmg = 70 * starMult * abilityMult;
      aliveEnemies.forEach(e => { e.currentHp -= applyShroudMultiplier(e, dmg * (0.85 + Math.random() * 0.3), true); });
      logs.unshift(`[ATK] ${unit.name}'s Minigun Spray hits ${aliveEnemies.length} for ${Math.round(dmg)} each!`);
      abilityUnits.push(unit.uid);
      try { sound.abilityAoe?.(); } catch(_) { sound.ability(); }
      return true;
    }

    case 'irma': {
      // Madam's Mercy: heal 2 lowest-HP allies for 90 each
      const targets = allies.filter(a => a.currentHp > 0 && a.currentHp < a.maxHp)
        .sort((a, b) => (a.currentHp / a.maxHp) - (b.currentHp / b.maxHp)).slice(0, 2);
      if (targets.length === 0) return false;
      const healAmt = 90 * starMult * abilityMult;
      targets.forEach(t => { t.currentHp = Math.min(t.maxHp, t.currentHp + healAmt); });
      logs.unshift(`[STIM] ${unit.name}'s Madam's Mercy heals ${targets.length} allies for ${Math.round(healAmt)} each!`);
      abilityUnits.push(unit.uid);
      try { sound.abilityHeal?.(); } catch(_) { sound.ability(); }
      return true;
    }

    case 'magnolia': {
      // Siren's Lull: charm highest-ATK enemy — they target their own allies for 4s (8 ticks).
      const aliveEnemies = targetable.filter(e => !e.charmed);
      if (aliveEnemies.length === 0) return false;
      const target = aliveEnemies.sort((a, b) => b.atk - a.atk)[0];
      target.charmed = true;
      target.charmDuration = Math.round(8 * abilityMult);
      logs.unshift(`[BUF] ${unit.name}'s Siren's Lull charms ${target.name}!`);
      abilityUnits.push(unit.uid);
      try { sound.abilityDebuff?.(); } catch(_) { sound.ability(); }
      return true;
    }

    case 'ronnie': {
      // Laser Musket Volley: 3x ATK to highest-HP enemy
      const aliveEnemies = targetable;
      if (aliveEnemies.length === 0) return false;
      const target = aliveEnemies.sort((a, b) => b.currentHp - a.currentHp)[0];
      const dmg = unit.atk * 3 * starMult * abilityMult;
      target.currentHp -= applyShroudMultiplier(target, dmg, false);
      logs.unshift(`[ATK] ${unit.name}'s Laser Musket Volley blasts ${target.name} for ${Math.round(dmg)}!`);
      abilityUnits.push(unit.uid);
      try { sound.abilityShot?.(); } catch(_) { sound.ability(); }
      return true;
    }

    case 'tom': {
      // Conspiracy Wrench: melee bash highest-ATK enemy for 2.5x ATK and mark
      // them with +30% incoming damage for 5s (10 ticks).
      const aliveEnemies = targetable;
      if (aliveEnemies.length === 0) return false;
      const target = aliveEnemies.sort((a, b) => b.atk - a.atk)[0];
      const dmg = unit.atk * 2.5 * starMult * abilityMult;
      target.currentHp -= applyShroudMultiplier(target, dmg, false);
      target.markedDmgMult = 1.3;
      target.markedDuration = Math.round(10 * abilityMult);
      logs.unshift(`[ATK] ${unit.name} bashes ${target.name} for ${Math.round(dmg)} and marks them!`);
      abilityUnits.push(unit.uid);
      try { sound.abilityShot?.(); } catch(_) { sound.ability(); }
      return true;
    }

    case 'ingram': {
      // Power Armor Patch: shield lowest-HP ally 200 + 30% DEF for 5s (10 ticks)
      const target = allies.filter(a => a.currentHp > 0)
        .sort((a, b) => (a.currentHp / a.maxHp) - (b.currentHp / b.maxHp))[0];
      if (!target) return false;
      const shield = 200 * starMult * abilityMult;
      target.shield = (target.shield || 0) + shield;
      target.shieldDuration = 10;
      target.def = (target.baseDef ?? target.def) * 1.3;
      target.defBuffDuration = 10;
      logs.unshift(`[DEF] ${unit.name}'s Power Armor Patch shields ${target.name} for ${Math.round(shield)} + DEF!`);
      abilityUnits.push(unit.uid);
      try { sound.abilityBuff?.(); } catch(_) { sound.ability(); }
      return true;
    }

    case 'mother-isolde': {
      // Atom Communion: beam of radiation to 3 enemies for 130 each
      const aliveEnemies = targetable.slice().sort(() => Math.random() - 0.5).slice(0, 3);
      if (aliveEnemies.length === 0) return false;
      const dmg = 130 * starMult * abilityMult;
      aliveEnemies.forEach(e => { e.currentHp -= applyShroudMultiplier(e, dmg, true); });
      logs.unshift(`[RAD] ${unit.name}'s Atom Communion radiates ${aliveEnemies.length} enemies for ${Math.round(dmg)} each!`);
      abilityUnits.push(unit.uid);
      try { sound.abilityAoe?.(); } catch(_) { sound.ability(); }
      return true;
    }

    case 'pickman': {
      // Gallery Showpiece: 4x ATK to highest-HP enemy + bleed (DoT)
      const aliveEnemies = targetable;
      if (aliveEnemies.length === 0) return false;
      const target = aliveEnemies.sort((a, b) => b.currentHp - a.currentHp)[0];
      const dmg = unit.atk * 4 * starMult * abilityMult;
      target.currentHp -= applyShroudMultiplier(target, dmg, false);
      target.bleedDmg = 25 * starMult;
      target.bleedDuration = 8;
      logs.unshift(`[ATK] ${unit.name}'s Gallery Showpiece slashes ${target.name} for ${Math.round(dmg)} + bleed!`);
      abilityUnits.push(unit.uid);
      try { sound.abilityShot?.(); } catch(_) { sound.ability(); }
      return true;
    }

    case 'desdemona': {
      // Liberty Signal: allies stealth + 50% AP gain for 4s (8 ticks)
      allies.forEach(a => {
        if (a.currentHp > 0) {
          a.stealthed = true;
          a.stealthDuration = 8;
          a.apGainMult = 1.5;
          a.apGainDuration = 8;
        }
      });
      logs.unshift(`[STEALTH] ${unit.name}'s Liberty Signal: allies stealthed + 50% AP!`);
      abilityUnits.push(unit.uid);
      try { sound.abilityBuff?.(); } catch(_) { sound.ability(); }
      return true;
    }

    case 'jack-cabot': {
      // Mesmetron Pulse: mind-control 2 enemies for 5s (10 ticks)
      const aliveEnemies = targetable.filter(e => !e.charmed);
      if (aliveEnemies.length === 0) return false;
      const targets = aliveEnemies.sort((a, b) => b.atk - a.atk).slice(0, 2);
      targets.forEach(t => { t.charmed = true; t.charmDuration = Math.round(10 * abilityMult); });
      logs.unshift(`[BUF] ${unit.name}'s Mesmetron Pulse mind-controls ${targets.length} enemies!`);
      abilityUnits.push(unit.uid);
      try { sound.abilityDebuff?.(); } catch(_) { sound.ability(); }
      return true;
    }

    case 'madison-li': {
      // Prototype Discharge: arc lightning chains 3 enemies for 180 damage
      const aliveEnemies = targetable.slice().sort(() => Math.random() - 0.5).slice(0, 3);
      if (aliveEnemies.length === 0) return false;
      const dmg = 180 * starMult * abilityMult;
      aliveEnemies.forEach((e, idx) => {
        const arcDmg = dmg * (1 - idx * 0.15); // chain fall-off
        e.currentHp -= applyShroudMultiplier(e, arcDmg, true);
      });
      logs.unshift(`[ARC] ${unit.name}'s Prototype Discharge arcs to ${aliveEnemies.length} enemies!`);
      abilityUnits.push(unit.uid);
      try { sound.abilityAoe?.(); } catch(_) { sound.ability(); }
      return true;
    }

    case 'sarah-lyon': {
      // Pride Lead: charge highest-ATK enemy for 250 damage + taunt 3s
      const aliveEnemies = targetable;
      if (aliveEnemies.length === 0) return false;
      const target = aliveEnemies.sort((a, b) => b.atk - a.atk)[0];
      const dmg = 250 * starMult * abilityMult;
      target.currentHp -= applyShroudMultiplier(target, dmg, false);
      unit.taunting = true;
      unit.tauntDuration = 6;
      logs.unshift(`[ATK] ${unit.name}'s Pride Lead slams ${target.name} for ${Math.round(dmg)} + taunts!`);
      abilityUnits.push(unit.uid);
      try { sound.abilityShot?.(); } catch(_) { sound.ability(); }
      return true;
    }

    case 'zeek': {
      // Power Punch: 3x ATK + knockback stun 2s (4 ticks)
      const aliveEnemies = targetable.filter(e => (e.stunDuration || 0) <= 0);
      if (aliveEnemies.length === 0) return false;
      const target = aliveEnemies.sort((a, b) => b.atk - a.atk)[0];
      const dmg = unit.atk * 3 * starMult * abilityMult;
      target.currentHp -= applyShroudMultiplier(target, dmg, false);
      target.stunDuration = Math.round(4 * abilityMult);
      logs.unshift(`[ATK] ${unit.name}'s Power Punch knocks ${target.name} back for ${Math.round(dmg)}!`);
      abilityUnits.push(unit.uid);
      try { sound.abilityShot?.(); } catch(_) { sound.ability(); }
      return true;
    }

    case 'cross': {
      // Lyon Vanguard: 300 damage to nearest enemy + 20% DEF buff to adjacent allies 6s
      const aliveEnemies = targetable;
      if (aliveEnemies.length === 0) return false;
      const target = aliveEnemies[0];
      const dmg = 300 * starMult * abilityMult;
      target.currentHp -= applyShroudMultiplier(target, dmg, false);
      allies.filter(a => a.currentHp > 0 && Math.abs((a.position || 0) - (unit.position || 0)) <= 2).forEach(a => {
        a.def = (a.baseDef ?? a.def) * 1.2;
        a.defBuffDuration = 12;
      });
      logs.unshift(`[ATK] ${unit.name}'s Lyon Vanguard slams ${target.name} for ${Math.round(dmg)}!`);
      abilityUnits.push(unit.uid);
      try { sound.abilityBuff?.(); } catch(_) { sound.ability(); }
      return true;
    }

    case 'shaun': {
      // Synth Genesis: spawn 2 synth helpers (data-only flag, combat tick spawns them)
      unit.pendingSpawn = 2;
      unit.spawnHp = 300 * starMult * abilityMult;
      logs.unshift(`[INST] ${unit.name}'s Synth Genesis spawns 2 synth assistants!`);
      abilityUnits.push(unit.uid);
      try { sound.abilityBuff?.(); } catch(_) { sound.ability(); }
      return true;
    }

    case 'silver-shroud': {
      // Vigilante Justice: heal all allies 200 + 20% ATK for 5s
      const healAmt = 200 * starMult * abilityMult;
      const buffMult = 1 + 0.2 * starMult;
      allies.forEach(a => {
        if (a.currentHp > 0) {
          a.currentHp = Math.min(a.maxHp, a.currentHp + healAmt);
          a.buffAtkMult = buffMult;
          a.buffDuration = 10;
        }
      });
      logs.unshift(`[STIM] ${unit.name}'s Vigilante Justice heals & buffs the team!`);
      abilityUnits.push(unit.uid);
      try { sound.abilityHeal?.(); } catch(_) { sound.ability(); }
      return true;
    }

    case 'sole-survivor': {
      // V.A.T.S. Burst: 4 hits on highest-ATK enemy for 1.5x ATK each
      const aliveEnemies = targetable;
      if (aliveEnemies.length === 0) return false;
      const target = aliveEnemies.sort((a, b) => b.atk - a.atk)[0];
      const perHit = unit.atk * 1.5 * starMult * abilityMult;
      for (let i = 0; i < 4; i++) {
        if (target.currentHp <= 0) break;
        target.currentHp -= applyShroudMultiplier(target, perHit * (0.9 + Math.random() * 0.2), false);
      }
      logs.unshift(`[ATK] ${unit.name}'s V.A.T.S. Burst — 4 hits on ${target.name}!`);
      abilityUnits.push(unit.uid);
      try { sound.abilityShot?.(); } catch(_) { sound.ability(); }
      return true;
    }

    case 'virgil': {
      // FEV Mutation: transform an enemy into a fragile super mutant for 6s
      const aliveEnemies = targetable.filter(e => !e.mutated);
      if (aliveEnemies.length === 0) return false;
      const target = aliveEnemies.sort((a, b) => b.atk - a.atk)[0];
      target.mutated = true;
      target.mutateDuration = 12;
      target.atk = Math.max(1, target.baseAtk * 0.4);
      target.maxHp = 350 * starMult;
      target.currentHp = Math.min(target.currentHp, target.maxHp);
      logs.unshift(`[RAD] ${unit.name}'s FEV Mutation transforms ${target.name}!`);
      abilityUnits.push(unit.uid);
      try { sound.abilityDebuff?.(); } catch(_) { sound.ability(); }
      return true;
    }

    case 'x6-88': {
      // Coordinated Strike: teleport-strike lowest-HP enemy for 5x ATK; ignores armor
      const aliveEnemies = targetable;
      if (aliveEnemies.length === 0) return false;
      const target = aliveEnemies.sort((a, b) => a.currentHp - b.currentHp)[0];
      const dmg = unit.atk * 5 * starMult * abilityMult;
      target.currentHp -= applyShroudMultiplier(target, dmg, false);
      logs.unshift(`[INST] ${unit.name}'s Coordinated Strike executes ${target.name} for ${Math.round(dmg)}!`);
      abilityUnits.push(unit.uid);
      try { sound.abilityShot?.(); } catch(_) { sound.ability(); }
      return true;
    }

    default:
      return false;
  }
};

// ── runCombat ───────────────────────────────────────────────────────
export const runCombat = (playerUnits, enemyUnits, callbacks) => {
  const {
    board,
    combatRef,
    round,
    hpRef,
    augments,
    xpMetaRef,
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
    setItemInventory,
    setAugmentChoice,
    setCombatTick,
    setIncomeBreakdown,
    setDamageStats,
    addMatchHistory,
    generateShop,
    getRandomComponent: getRandomComponentCb,
    saveGame,
    setCarouselActive,
  } = callbacks;

  if (combatRef.current) {
    clearInterval(combatRef.current);
    combatRef.current = null;
  }
  let pUnits = [...playerUnits];
  // Reset per-combat flags
  pUnits.forEach(u => { u.kelloggRevived = false; });

  // Lock dual-range units (Hancock, Sarah Lyon, Sole Survivor) to ranged
  // or melee based on their START-OF-ROUND row. Range does NOT flip mid
  // fight if the unit is later repositioned by abilities/knockbacks.
  pUnits.forEach(u => lockDualRange(u));
  enemyUnits.forEach(u => { if (u) lockDualRange(u); });

  // ── Sole Survivor: combat-start bookkeeping ───────────────────────
  // (a) Merge the player's persistent per-round scaling bonus into the
  //     combat-unit's base stats. Game.jsx owns the persistent record
  //     (`unit.scalingBonus = { atk, hp, def }`) and we read it here so
  //     the combat clone reflects the bonus without permanently mutating
  //     base UNIT_DATABASE numbers.
  // (b) Reset the per-combat (in-fight) counter so per-attack stacks
  //     start at 0 each fight.
  // (c) Survivor's Bond — snapshot count of hex-adjacent FO4 companions
  //     on the player's board and apply +8% ATK / +8% AP gain per
  //     companion (capped naturally at 4 neighbours on this 2-row board).
  pUnits.forEach(u => {
    if (u.id !== 'sole-survivor') return;
    const persist = u.scalingBonus || { atk: 0, hp: 0, def: 0 };
    if (persist.atk) { u.atk += persist.atk; u.baseAtk = (u.baseAtk || u.atk) + persist.atk; }
    if (persist.hp) {
      u.maxHp += persist.hp;
      u.currentHp += persist.hp;
    }
    if (persist.def) { u.def += persist.def; u.baseDef = (u.baseDef ?? u.def) + persist.def; }
    u._ssInCombatAtk = 0;
    u._ssInCombatHp = 0;

    // Survivor's Bond — snapshot count of adjacent FO4 companions.
    applySurvivorsBond(u, board);
  });

  const enemySlots = enemyUnits;
  let eUnits = enemyUnits.filter(e => e != null);
  let logs = [];
  let tick = 0;
  let extraGold = 0;
  const damageStats = {};
  // Timer-based animation tracking — animations persist for their full CSS duration
  const ANIM_DURATIONS = { attacking: 450, hit: 450, ability: 550, dying: 600 };
  const animTimers = { attacking: {}, hit: {}, dying: {}, ability: {} };
  const scheduleAnim = (type, uid) => {
    if (animTimers[type][uid]) clearTimeout(animTimers[type][uid]);
    animTimers[type][uid] = setTimeout(() => {
      delete animTimers[type][uid];
      setAnimations({
        attacking: Object.keys(animTimers.attacking),
        hit: Object.keys(animTimers.hit),
        dying: Object.keys(animTimers.dying),
        ability: Object.keys(animTimers.ability),
      });
    }, ANIM_DURATIONS[type]);
  };
  const flushAnimState = () => {
    setAnimations({
      attacking: Object.keys(animTimers.attacking),
      hit: Object.keys(animTimers.hit),
      dying: Object.keys(animTimers.dying),
      ability: Object.keys(animTimers.ability),
    });
  };
  let lastCombatSig = '';
  let lastLogSnap = '';

  const getRect = (uid) => {
    const el = document.querySelector(`[data-unit-uid="${uid}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, el };
  };

  const screenShake = (magnitude = 3) => {
    const arena = document.querySelector('.wt-combat-arena');
    if (!arena) return;
    arena.style.setProperty('--shake-px', `${magnitude}px`);
    arena.classList.add('wt-screen-shake');
    setTimeout(() => arena.classList.remove('wt-screen-shake'), Math.min(100 + magnitude * 30, 400));
  };

  const spawnKillNotify = (killerName, victimName) => {
    const el = document.createElement('div');
    el.className = 'wt-kill-notify';
    el.innerHTML = `<span class="killer">${killerName}</span> <span class="action">eliminated</span> <span class="victim">${victimName}</span>`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  };

  const spawnRoundText = (text, type) => {
    const el = document.createElement('div');
    el.className = `wt-round-text wt-round-text-${type}`;
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2500);
  };

  const spawnVFX = (type, opts, rectMap = {}) => {
    const getR = (uid) => rectMap[uid] || getRect(uid);
    requestAnimationFrame(() => { try {
      if (type === 'lunge') {
        const { attackerUid, targetUid, unitId, isAbilityAttack } = opts;
        const aRect = getR(attackerUid);
        const tRect = getR(targetUid);
        if (!aRect?.el || !tRect) return;
        const melee = isMeleeUnit(unitId);
        let lungeFactor = 0.15, fwdMs = 80, backMs = 120;
        if (melee) {
          if (unitId === 'dogmeat') {
            if (isAbilityAttack) { lungeFactor = 0.85; fwdMs = 50; backMs = 60; }
            else { lungeFactor = 0.35; fwdMs = 60; backMs = 80; }
          } else if (unitId === 'cait') { lungeFactor = 0.6; fwdMs = 80; backMs = 120; }
          else if (unitId === 'sturges') { lungeFactor = 0.6; fwdMs = 100; backMs = 140; }
          else if (unitId === 'hancock') { lungeFactor = 0.45; fwdMs = 80; backMs = 130; }
          else { lungeFactor = 0.6; fwdMs = 80; backMs = 120; }
        }
        const dx = (tRect.x - aRect.x) * lungeFactor;
        const dy = (tRect.y - aRect.y) * lungeFactor;
        const el = aRect.el;
        const origTx = el.style.transform || '';
        if (unitId === 'sturges') {
          const windUpDeg = 8;
          el.style.transition = 'transform 20ms ease-out';
          el.style.transform = (origTx ? origTx + ' ' : '') + `rotate(-${windUpDeg}deg)`;
          setTimeout(() => {
            el.style.transition = `transform ${fwdMs}ms cubic-bezier(0.33, 1, 0.68, 1)`;
            el.style.transform = (origTx ? origTx + ' ' : '') + `translate(${dx}px, ${dy}px)`;
            setTimeout(() => {
              el.style.transition = `transform ${backMs}ms cubic-bezier(0.65, 0, 0.35, 1)`;
              el.style.transform = origTx || 'none';
              setTimeout(() => { el.style.transition = ''; el.style.transform = origTx || ''; }, backMs);
            }, fwdMs);
          }, 20);
        } else {
          el.style.transition = `transform ${fwdMs}ms cubic-bezier(0.33, 1, 0.68, 1)`;
          el.style.transform = (origTx ? origTx + ' ' : '') + `translate(${dx}px, ${dy}px)`;
          setTimeout(() => {
            el.style.transition = `transform ${backMs}ms cubic-bezier(0.65, 0, 0.35, 1)`;
            el.style.transform = origTx || 'none';
            setTimeout(() => { el.style.transition = ''; el.style.transform = origTx || ''; }, backMs);
          }, fwdMs);
        }
      } else if (type === 'projectile') {
        const { fromUid, toUid, unitId } = opts;
        const from = getR(fromUid);
        const to = getR(toUid);
        if (!from || !to) return;
        const dist = Math.hypot(to.x - from.x, to.y - from.y);
        const weaponType = getWeaponType(unitId);
        const wColors = WEAPON_COLORS[weaponType] || WEAPON_COLORS.ballistic;
        let color = wColors.primary, size = 8, travelMs = 180, glintBefore = 0, trail = false;
        if (unitId === 'preston') { color = '#4CAF50'; size = 10; travelMs = 280; }
        else if (unitId === 'moira') { color = '#888'; size = 8; travelMs = 200; }
        else if (unitId === 'piper') { color = '#999'; size = 6; travelMs = 140; }
        else if (unitId === 'maccready') { color = '#aaa'; size = 4; travelMs = 220; glintBefore = 50; }
        else if (unitId === 'nick') { color = '#4488ff'; size = 10; travelMs = 200; trail = true; }
        else if (unitId === 'dima') { color = '#8844ff'; size = 12; travelMs = 220; trail = true; }
        else { color = COST_COLORS[opts.cost] || '#888'; }
        const prestonColor = '#4CAF50';
        const runProj = () => {
          const projColor = unitId === 'preston' ? prestonColor : color;
          const projGlow = unitId === 'preston' ? `0 0 ${size}px ${prestonColor},0 0 ${size*2}px #ffd70088` : `0 0 ${size}px ${color},0 0 ${size*2}px ${color}88`;
          const proj = document.createElement('div');
          proj.style.cssText = `position:fixed;left:${from.x}px;top:${from.y}px;width:${size}px;height:${unitId === 'maccready' ? 2 : size}px;border-radius:50%;background:${projColor};box-shadow:${projGlow};transform:translate(-50%,-50%);z-index:2700;pointer-events:none;transition:transform ${travelMs}ms linear`;
          document.body.appendChild(proj);
          requestAnimationFrame(() => {
            proj.style.transform = `translate(-50%,-50%) translate(${to.x - from.x}px, ${to.y - from.y}px)`;
          });
          if (trail && (unitId === 'nick' || unitId === 'dima')) {
            const trailColor = unitId === 'dima' ? 'rgba(136,68,255,0.5)' : 'rgba(68,136,255,0.5)';
            for (let i = 0; i < 3; i++) {
              const trailP = document.createElement('div');
              trailP.style.cssText = `position:fixed;left:${from.x}px;top:${from.y}px;width:6px;height:6px;background:${trailColor};border-radius:50%;transform:translate(-50%,-50%);z-index:2699;pointer-events:none;transition:transform ${travelMs + 80 + i * 30}ms linear`;
              document.body.appendChild(trailP);
              const t = (to.x - from.x) * 0.3 * (i + 1) / 3;
              const ty = (to.y - from.y) * 0.3 * (i + 1) / 3;
              requestAnimationFrame(() => { trailP.style.transform = `translate(-50%,-50%) translate(${t}px,${ty}px)`; });
              setTimeout(() => { trailP.style.opacity = '0'; trailP.remove(); }, travelMs + 100);
            }
          }
          setTimeout(() => { proj.remove(); }, travelMs + 50);
          // Muzzle flash for ballistic weapons
          if (weaponType === 'ballistic') {
            const mf = document.createElement('div');
            mf.className = 'wt-muzzle-flash';
            mf.style.cssText = `position:fixed;left:${from.x}px;top:${from.y}px;transform:translate(-50%,-50%)`;
            document.body.appendChild(mf);
            setTimeout(() => mf.remove(), 150);
          }
          // Energy beam for energy weapons
          if (weaponType === 'energy') {
            const beam = document.createElement('div');
            const dx = to.x - from.x, dy = to.y - from.y;
            const len = Math.hypot(dx, dy);
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
            beam.className = 'wt-energy-beam';
            beam.style.cssText = `position:fixed;left:${from.x}px;top:${from.y}px;width:${len}px;color:${wColors.primary};background:${wColors.primary};transform-origin:left;transform:rotate(${angle}deg);z-index:2699;pointer-events:none`;
            document.body.appendChild(beam);
            setTimeout(() => beam.remove(), 250);
          }
        };
        if (glintBefore > 0 && from.el) {
          const glint = document.createElement('div');
          glint.style.cssText = `position:absolute;inset:-4px;background:radial-gradient(circle, rgba(255,255,255,0.9) 0%, transparent 70%);border-radius:4px;z-index:2600;pointer-events:none;animation:wt-scope-glint 80ms ease-out forwards`;
          from.el.style.position = 'relative';
          from.el.appendChild(glint);
          setTimeout(() => glint.remove(), 80);
          setTimeout(runProj, glintBefore);
        } else {
          runProj();
        }
      } else if (type === 'impact') {
        const { targetUid, isCrit, unitId } = opts;
        const tRect = getR(targetUid);
        if (!tRect) return;
        // Color palette: crits = orange/red, ability-specific colors, default = white/yellow sparks
        let colors;
        if (isCrit) {
          colors = ['#ff6633', '#ff4400', '#ffaa00', '#ff2200'];
        } else if (unitId === 'cait') {
          colors = ['#ff6633', '#ff4400', '#ff8844'];
        } else if (unitId === 'sturges') {
          colors = ['#00ff00', '#88ff44', '#ffdd00'];
        } else if (unitId === 'nick') {
          colors = ['#4488ff', '#88bbff', '#ffffff'];
        } else if (unitId === 'dima') {
          colors = ['#8844ff', '#aa66ff', '#ffffff'];
        } else if (unitId === 'dogmeat') {
          colors = ['#ff8800', '#ffaa44', '#ffffff'];
        } else {
          colors = ['#ffffff', '#ffffcc', '#ffdd88'];
        }
        let count = 6 + Math.floor(Math.random() * 3);
        let distBase = 30;
        if (unitId === 'sturges') { count = 12; distBase = 50; screenShake(3); }
        if (opts.isAbilityAttack && opts.unitId === 'dogmeat') { count = 14; distBase = 45; }
        for (let i = 0; i < count; i++) {
          const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
          const dist = distBase + Math.random() * 30;
          const dx = Math.cos(angle) * dist;
          const dy = Math.sin(angle) * dist;
          const color = colors[Math.floor(Math.random() * colors.length)];
          const rotation = Math.floor(Math.random() * 360);
          const sparkW = unitId === 'sturges' ? 8 : 6;
          const sparkH = unitId === 'sturges' ? 3 : 2;
          const p = document.createElement('div');
          p.style.cssText = `position:fixed;left:${tRect.x}px;top:${tRect.y}px;width:${sparkW}px;height:${sparkH}px;background:${color};border-radius:1px;transform:translate(-50%,-50%) rotate(${rotation}deg);z-index:2700;pointer-events:none;box-shadow:0 0 4px ${color}`;
          document.body.appendChild(p);
          p.animate([{ transform: `translate(-50%,-50%) rotate(${rotation}deg) translate(0,0)`, opacity: 1 }, { transform: `translate(-50%,-50%) rotate(${rotation}deg) translate(${dx}px,${dy}px)`, opacity: 0 }], { duration: 300, fill: 'forwards' });
          setTimeout(() => p.remove(), 350);
        }
        if (unitId === 'sturges') {
          const shock = document.createElement('div');
          shock.style.cssText = `position:fixed;left:${tRect.x}px;top:${tRect.y}px;width:60px;height:60px;margin:-30px 0 0 -30px;border:3px solid rgba(100,80,0,0.8);border-radius:50%;z-index:2698;pointer-events:none;animation:wt-shockwave 250ms ease-out forwards`;
          document.body.appendChild(shock);
          setTimeout(() => shock.remove(), 280);
        }
        // Impact flash element
        const impactFlash = document.createElement('div');
        impactFlash.className = 'wt-impact-flash';
        impactFlash.style.cssText = `position:fixed;left:${tRect.x}px;top:${tRect.y}px;transform:translate(-50%,-50%)`;
        document.body.appendChild(impactFlash);
        setTimeout(() => impactFlash.remove(), 200);
        // Crit flash: subtle gold radial pulse from hit position
        if (isCrit) {
          const flash = document.createElement('div');
          flash.style.cssText = `position:fixed;inset:0;background:radial-gradient(circle at ${tRect.x}px ${tRect.y}px, rgba(255,180,0,0.25) 0%, rgba(255,120,0,0.08) 40%, transparent 70%);z-index:2500;pointer-events:none`;
          document.body.appendChild(flash);
          flash.animate([{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 0 }], { duration: 200, fill: 'forwards' });
          setTimeout(() => flash.remove(), 220);
        }
      } else if (type === 'death') {
        // Death particles — weapon-type-aware
        const { targetUid, killerWeaponType } = opts;
        const tRect = getR(targetUid);
        if (!tRect) return;
        const kwt = killerWeaponType || 'ballistic';
        if (kwt === 'ballistic') {
          // Knockback particles flying backward + fade
          const side = opts.side === 'right' ? 1 : -1;
          for (let i = 0; i < 8; i++) {
            const p = document.createElement('div');
            const dx = side * (30 + Math.random() * 40);
            const dy = (Math.random() - 0.5) * 30;
            p.style.cssText = `position:fixed;left:${tRect.x}px;top:${tRect.y}px;width:4px;height:4px;background:#ffcc44;border-radius:50%;z-index:2700;pointer-events:none;box-shadow:0 0 4px #ffcc44`;
            document.body.appendChild(p);
            p.animate([{ transform: 'translate(-50%,-50%)', opacity: 1 }, { transform: `translate(-50%,-50%) translate(${dx}px,${dy}px)`, opacity: 0 }], { duration: 500, fill: 'forwards', easing: 'ease-out' });
            setTimeout(() => p.remove(), 550);
          }
          if (tRect.el) { tRect.el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards' }); }
        } else if (kwt === 'energy') {
          // Disintegration — 25 small colored particles scatter + bright flash
          const disColors = ['#ff3333', '#ff6644', '#44ff88', '#ff8888'];
          for (let i = 0; i < 25; i++) {
            const p = document.createElement('div');
            const angle = (Math.PI * 2 * i) / 25 + Math.random() * 0.4;
            const dist = 20 + Math.random() * 50;
            const dx = Math.cos(angle) * dist;
            const dy = Math.sin(angle) * dist;
            const c = disColors[Math.floor(Math.random() * disColors.length)];
            p.style.cssText = `position:fixed;left:${tRect.x}px;top:${tRect.y}px;width:3px;height:3px;background:${c};border-radius:50%;z-index:2700;pointer-events:none;box-shadow:0 0 3px ${c}`;
            document.body.appendChild(p);
            p.animate([{ transform: 'translate(-50%,-50%)', opacity: 1 }, { transform: `translate(-50%,-50%) translate(${dx}px,${dy}px)`, opacity: 0 }], { duration: 600, fill: 'forwards', easing: 'ease-out' });
            setTimeout(() => p.remove(), 650);
          }
          const flash = document.createElement('div');
          flash.style.cssText = `position:fixed;left:${tRect.x}px;top:${tRect.y}px;width:40px;height:40px;margin:-20px 0 0 -20px;background:radial-gradient(circle,rgba(255,100,100,0.9) 0%,transparent 70%);border-radius:50%;z-index:2701;pointer-events:none`;
          document.body.appendChild(flash);
          flash.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(2)' }], { duration: 300, fill: 'forwards' });
          setTimeout(() => flash.remove(), 350);
        } else if (kwt === 'melee') {
          // Larger impact particles + dust cloud
          for (let i = 0; i < 10; i++) {
            const p = document.createElement('div');
            const angle = (Math.PI * 2 * i) / 10 + Math.random() * 0.3;
            const dist = 25 + Math.random() * 35;
            const dx = Math.cos(angle) * dist;
            const dy = Math.sin(angle) * dist;
            p.style.cssText = `position:fixed;left:${tRect.x}px;top:${tRect.y}px;width:6px;height:6px;background:#ffffff;border-radius:50%;z-index:2700;pointer-events:none;box-shadow:0 0 4px #cccccc`;
            document.body.appendChild(p);
            p.animate([{ transform: 'translate(-50%,-50%)', opacity: 1 }, { transform: `translate(-50%,-50%) translate(${dx}px,${dy}px)`, opacity: 0 }], { duration: 500, fill: 'forwards', easing: 'ease-out' });
            setTimeout(() => p.remove(), 550);
          }
          const dust = document.createElement('div');
          dust.style.cssText = `position:fixed;left:${tRect.x}px;top:${tRect.y}px;width:50px;height:50px;margin:-25px 0 0 -25px;background:radial-gradient(circle,rgba(180,160,140,0.5) 0%,transparent 70%);border-radius:50%;z-index:2699;pointer-events:none`;
          document.body.appendChild(dust);
          dust.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(2.5)' }], { duration: 600, fill: 'forwards' });
          setTimeout(() => dust.remove(), 650);
        } else if (kwt === 'explosive') {
          // Upward particles + orange explosion flash + smoke
          for (let i = 0; i < 12; i++) {
            const p = document.createElement('div');
            const dx = (Math.random() - 0.5) * 60;
            const dy = -(30 + Math.random() * 50);
            p.style.cssText = `position:fixed;left:${tRect.x}px;top:${tRect.y}px;width:5px;height:5px;background:#ff6600;border-radius:50%;z-index:2700;pointer-events:none;box-shadow:0 0 6px #ff3300`;
            document.body.appendChild(p);
            p.animate([{ transform: 'translate(-50%,-50%)', opacity: 1 }, { transform: `translate(-50%,-50%) translate(${dx}px,${dy}px)`, opacity: 0 }], { duration: 600, fill: 'forwards', easing: 'ease-out' });
            setTimeout(() => p.remove(), 650);
          }
          const boom = document.createElement('div');
          boom.style.cssText = `position:fixed;left:${tRect.x}px;top:${tRect.y}px;width:60px;height:60px;margin:-30px 0 0 -30px;background:radial-gradient(circle,rgba(255,150,0,0.8) 0%,rgba(255,80,0,0.3) 50%,transparent 70%);border-radius:50%;z-index:2701;pointer-events:none`;
          document.body.appendChild(boom);
          boom.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(2)' }], { duration: 400, fill: 'forwards' });
          setTimeout(() => boom.remove(), 450);
          const smoke = document.createElement('div');
          smoke.style.cssText = `position:fixed;left:${tRect.x}px;top:${tRect.y - 10}px;width:40px;height:40px;margin:-20px 0 0 -20px;background:radial-gradient(circle,rgba(100,100,100,0.4) 0%,transparent 70%);border-radius:50%;z-index:2698;pointer-events:none`;
          document.body.appendChild(smoke);
          smoke.animate([{ opacity: 1, transform: 'scale(1) translateY(0)' }, { opacity: 0, transform: 'scale(2) translateY(-20px)' }], { duration: 800, fill: 'forwards' });
          setTimeout(() => smoke.remove(), 850);
        } else {
          // Default death particles (healer/stealth/unknown)
          const deathSymbols = ['\u{1F480}', '\u2726', '\u2726', '\u2726', '\u2726', '\u2726'];
          const particleCount = 5 + Math.floor(Math.random() * 2);
          for (let i = 0; i < particleCount; i++) {
            const p = document.createElement('div');
            const sym = deathSymbols[Math.floor(Math.random() * deathSymbols.length)];
            const offsetX = (Math.random() - 0.5) * 30;
            const driftX = (Math.random() - 0.5) * 20;
            const driftY = -(40 + Math.random() * 40);
            const delay = Math.random() * 100;
            const size = sym === '\u{1F480}' ? 14 : 8;
            p.textContent = sym;
            p.style.cssText = `position:fixed;left:${tRect.x + offsetX}px;top:${tRect.y}px;font-size:${size}px;color:rgba(200,180,160,0.9);z-index:2700;pointer-events:none;text-shadow:0 0 4px rgba(255,100,50,0.6)`;
            document.body.appendChild(p);
            setTimeout(() => {
              p.animate([
                { transform: 'translate(-50%,-50%) translate(0,0)', opacity: 1 },
                { transform: `translate(-50%,-50%) translate(${driftX}px,${driftY}px)`, opacity: 0 }
              ], { duration: 600, fill: 'forwards', easing: 'ease-out' });
            }, delay);
            setTimeout(() => p.remove(), 700 + delay);
          }
        }
      } else if (type === 'ability') {
        const { unitId, fromUid, toUid } = opts;
        const from = getR(fromUid);
        const to = toUid ? getR(toUid) : null;
        if (!from) return;
        const runAbilityVFX = () => {
          if (unitId === 'preston') {
            const sb = document.createElement('div');
            sb.style.cssText = `position:fixed;left:${from.x}px;top:${from.y}px;width:80px;height:80px;margin:-40px 0 0 -40px;background:repeating-conic-gradient(from 0deg,#ffd700 0deg 10deg,transparent 10deg 20deg);border-radius:50%;z-index:2700;pointer-events:none;animation:wt-starburst 500ms ease-out forwards`;
            document.body.appendChild(sb);
            setTimeout(() => sb.remove(), 550);
          } else if (unitId === 'sturges' && to) {
            const arc = document.createElement('div');
            arc.style.cssText = `position:fixed;left:${from.x}px;top:${from.y}px;width:${Math.hypot(to.x-from.x,to.y-from.y)}px;height:4px;background:linear-gradient(90deg,transparent,#00ff00);transform-origin:left;transform:rotate(${Math.atan2(to.y-from.y,to.x-from.x)}rad);z-index:2700;pointer-events:none;animation:wt-sweep 400ms ease-out forwards`;
            document.body.appendChild(arc);
            setTimeout(() => arc.remove(), 450);
          } else if (unitId === 'dogmeat' && to) {
            const bite = document.createElement('div');
            bite.style.cssText = `position:fixed;left:${to.x}px;top:${to.y}px;width:12px;height:12px;background:#ff6600;border-radius:50%;box-shadow:0 0 8px #ff6600;margin:-6px 0 0 -6px;z-index:2700;pointer-events:none;animation:wt-pop 200ms ease-out forwards`;
            document.body.appendChild(bite);
            setTimeout(() => bite.remove(), 250);
          } else if (unitId === 'cait') {
            const pill = document.createElement('div');
            pill.style.cssText = `position:fixed;left:${from.x}px;top:${from.y}px;width:16px;height:16px;background:#ff2222;border-radius:4px;margin:-8px 0 0 -8px;z-index:2700;pointer-events:none;animation:wt-pill-explode 500ms ease-out forwards`;
            document.body.appendChild(pill);
            setTimeout(() => pill.remove(), 550);
          } else if (unitId === 'nick' && to) {
            const ring = document.createElement('div');
            ring.style.cssText = `position:fixed;left:${to.x}px;top:${to.y}px;width:20px;height:20px;margin:-10px 0 0 -10px;border:3px solid #4488ff;border-radius:50%;z-index:2700;pointer-events:none;animation:wt-ring-expand 450ms ease-out forwards`;
            document.body.appendChild(ring);
            setTimeout(() => ring.remove(), 500);
          } else if (unitId === 'hancock' && (to || opts.allyUids?.length)) {
            const allyUids = opts.allyUids || [];
            allyUids.forEach((uid) => {
              const aRect = getR(uid);
              if (!aRect) return;
              const wisp = document.createElement('div');
              wisp.style.cssText = `position:fixed;left:${from.x}px;top:${from.y}px;width:6px;height:6px;background:#00ff88;border-radius:50%;margin:-3px 0 0 -3px;z-index:2700;pointer-events:none;transition:transform 400ms ease-out`;
              document.body.appendChild(wisp);
              requestAnimationFrame(() => { wisp.style.transform = `translate(${aRect.x - from.x}px, ${aRect.y - from.y}px)`; });
              setTimeout(() => wisp.remove(), 450);
            });
          } else if (unitId === 'moira') {
            const shield = document.createElement('div');
            shield.style.cssText = `position:fixed;left:${from.x}px;top:${from.y}px;width:80px;height:80px;margin:-40px 0 0 -40px;border:3px solid rgba(0,255,136,0.8);border-radius:50%;z-index:2700;pointer-events:none;animation:wt-bubble 400ms ease-out forwards`;
            document.body.appendChild(shield);
            setTimeout(() => shield.remove(), 450);
          } else if (unitId === 'piper' && to) {
            const excl = document.createElement('div');
            excl.style.cssText = `position:fixed;left:${to.x}px;top:${to.y-20}px;font-size:24px;font-weight:bold;color:#ffdd00;margin:-12px 0 0 -6px;z-index:2700;pointer-events:none;animation:wt-pop-excl 350ms ease-out forwards`;
            excl.textContent = '!';
            document.body.appendChild(excl);
            setTimeout(() => excl.remove(), 400);
          } else if (unitId === 'dima' && to) {
            const recall = document.createElement('div');
            recall.style.cssText = `position:fixed;left:${to.x}px;top:${to.y}px;width:60px;height:60px;margin:-30px 0 0 -30px;border:3px solid rgba(136,68,255,0.9);border-radius:50%;z-index:2700;pointer-events:none;animation:wt-recall 500ms ease-out forwards`;
            document.body.appendChild(recall);
            setTimeout(() => recall.remove(), 550);
          } else if (unitId === 'deathclaw' && to) {
            // Savage Strike — big red slash + screen shake
            screenShake(5);
            const slash = document.createElement('div');
            slash.style.cssText = `position:fixed;left:${to.x}px;top:${to.y}px;width:50px;height:50px;margin:-25px 0 0 -25px;background:radial-gradient(circle,rgba(255,0,0,0.6) 0%,transparent 70%);z-index:2700;pointer-events:none;animation:wt-pop 300ms ease-out forwards`;
            document.body.appendChild(slash);
            setTimeout(() => slash.remove(), 350);
          } else if (unitId === 'maxson' || unitId === 'mother-isolde') {
            // Big nuke flash for AoE radiation-style abilities (Final Judgment, Atom Communion).
            screenShake(8);
            const nuke = document.createElement('div');
            nuke.style.cssText = `position:fixed;inset:0;background:radial-gradient(circle at ${from.x}px ${from.y}px, rgba(255,200,0,0.5) 0%, rgba(255,80,0,0.2) 30%, transparent 60%);z-index:2500;pointer-events:none`;
            document.body.appendChild(nuke);
            nuke.animate([{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 0 }], { duration: 400, fill: 'forwards' });
            setTimeout(() => nuke.remove(), 450);
          } else if (unitId === 'danse') {
            // Ad Victoriam — blue laser sweep + screen shake
            screenShake(6);
            const laser = document.createElement('div');
            laser.style.cssText = `position:fixed;left:${from.x}px;top:${from.y}px;width:120px;height:4px;background:linear-gradient(90deg,#4488ff,#88bbff,transparent);transform-origin:left;z-index:2700;pointer-events:none;animation:wt-sweep 350ms ease-out forwards`;
            document.body.appendChild(laser);
            setTimeout(() => laser.remove(), 400);
          } else if (unitId === 'strong') {
            // Berserker Rage — red pulse from self + screen shake
            screenShake(3);
            const rage = document.createElement('div');
            rage.style.cssText = `position:fixed;left:${from.x}px;top:${from.y}px;width:70px;height:70px;margin:-35px 0 0 -35px;border:3px solid rgba(255,50,0,0.8);border-radius:50%;z-index:2700;pointer-events:none;animation:wt-ring-expand 400ms ease-out forwards`;
            document.body.appendChild(rage);
            setTimeout(() => rage.remove(), 450);
          } else if (unitId === 'maxson') {
            // Final Judgment — rapid gatling flash
            screenShake(6);
            for (let i = 0; i < 3; i++) {
              setTimeout(() => {
                const flash = document.createElement('div');
                flash.style.cssText = `position:fixed;left:${from.x + (Math.random()-0.5)*20}px;top:${from.y}px;width:6px;height:6px;background:#ff8800;border-radius:50%;box-shadow:0 0 8px #ff8800;margin:-3px 0 0 -3px;z-index:2700;pointer-events:none;animation:wt-pop 150ms ease-out forwards`;
                document.body.appendChild(flash);
                setTimeout(() => flash.remove(), 200);
              }, i * 80);
            }
          }
        };
        runAbilityVFX();
      } else if (type === 'heal') {
        const { targetUid } = opts;
        const tRect = getR(targetUid);
        if (!tRect) return;
        const healColors = ['#44ff88', '#88ffaa', '#aaffcc', '#ffffff', '#66ffaa'];
        const particleCount = 4 + Math.floor(Math.random() * 2);
        for (let i = 0; i < particleCount; i++) {
          const p = document.createElement('div');
          const color = healColors[Math.floor(Math.random() * healColors.length)];
          const offsetX = (Math.random() - 0.5) * 24;
          const driftX = (Math.random() - 0.5) * 12;
          const driftY = -(30 + Math.random() * 35);
          const delay = Math.random() * 80;
          p.textContent = '✦';
          p.style.cssText = `position:fixed;left:${tRect.x + offsetX}px;top:${tRect.y}px;font-size:${8 + Math.random() * 6}px;color:${color};z-index:2700;pointer-events:none;text-shadow:0 0 6px ${color}`;
          document.body.appendChild(p);
          setTimeout(() => {
            p.animate([
              { transform: 'translate(-50%,-50%) translate(0,0)', opacity: 1 },
              { transform: `translate(-50%,-50%) translate(${driftX}px,${driftY}px)`, opacity: 0 }
            ], { duration: 500, fill: 'forwards', easing: 'ease-out' });
          }, delay);
          setTimeout(() => p.remove(), 600 + delay);
        }
      }
    } catch(_) {} });
  };

  // Trait synergy lookups. New trait IDs are kebab-case (Wave: character overhaul):
  //   Medic   = old Support  (heal tick + revive)
  //   Caster  = old Tech     (ability multiplier)
  // The old Scout trait's attack-speed + first-strike mechanic is retired in the
  // new role system — kept here as a no-op so any downstream variables remain defined.
  const synergies = getActiveSynergies(board);
  const medicSynergy = synergies.find(s => s.trait === 'medic');
  const healTick = medicSynergy ? TRAITS.medic.effect(medicSynergy.count).healTick : 0;
  const supportRevive = medicSynergy ? TRAITS.medic.effect(medicSynergy.count).revive : false;
  let reviveUsed = false;

  // Scout retired in the new design — preserve variables for downstream readers.
  const asMult = 1;
  const firstStrike = false;

  // Caster role drives ability power (Tech equivalent in the new system).
  const casterSynergy = synergies.find(s => s.trait === 'caster');
  const baseAbilityMult = casterSynergy ? TRAITS.caster.effect(casterSynergy.count).abilityMult : 1;
  // Augment: Nuka Addict — abilities deal bonus damage
  const abilityMult = baseAbilityMult * (callbacks.augAbilityDmgMult || 1);
  // Augment: Field Medic — heal multiplier
  const augHealMult = callbacks.augHealMult || 1;
  // Augment: Guerrilla Tactics — first strike multiplier
  const augFirstStrikeMult = callbacks.augFirstStrikeMult || 1;

  sound.startCombat();

  const combatInterval = setInterval(() => {
    tick++;
    setCombatTick?.(tick);
    let attackingUnits = [];
    let hitUnits = [];
    let dyingUnits = [];
    let abilityUnits = [];

    const rectMap = {};
    document.querySelectorAll('[data-unit-uid]').forEach((el) => {
      const uid = el.getAttribute('data-unit-uid');
      if (!uid) return;
      const box = el.getBoundingClientRect();
      rectMap[uid] = { x: box.left + box.width / 2, y: box.top + box.height / 2, el };
    });

    // Support synergy heal every 40 ticks (4 seconds at 100ms per tick)
    if (healTick > 0 && tick % 40 === 0) {
      pUnits.forEach(unit => {
        if (unit.currentHp > 0 && unit.currentHp < unit.maxHp) {
          const healAmount = unit.maxHp * healTick * augHealMult;
          unit.currentHp = Math.min(unit.maxHp, unit.currentHp + healAmount);
          spawnVFX('heal', { targetUid: unit.uid }, rectMap);
          logs.unshift(`[HEAL] Support heals ${unit.name} for ${Math.round(healAmount)}`);
        }
      });
    }

    // Ghoul synergy regen every 40 ticks (4 seconds)
    if (tick % 40 === 0) {
      let ghoulRegenTriggered = false;
      pUnits.forEach(unit => {
        if (unit.isGhoul && unit.ghoulRegen > 0 && unit.currentHp > 0 && unit.currentHp < unit.maxHp) {
          const regenAmt = unit.maxHp * unit.ghoulRegen;
          unit.currentHp = Math.min(unit.maxHp, unit.currentHp + regenAmt);
          logs.unshift(`[BIO] Ghoul regen: ${unit.name} heals ${Math.round(regenAmt)}`);
          ghoulRegenTriggered = true;
        }
      });
      if (ghoulRegenTriggered) { try { sound.geigerTick?.(); } catch(_) {} }
    }

    // Burn DoT tick (Fahrenheit)
    pUnits.forEach(u => {
      if (u.burnTicks > 0 && u.currentHp > 0) { u.currentHp -= (u.burnDmg || 0); u.burnTicks--; if (u.burnTicks <= 0) { u.burnDmg = 0; const el = document.querySelector(`[data-unit-uid="${u.uid}"]`); if (el) el.classList.remove('wt-burning'); } }
    });
    eUnits.forEach(u => {
      if (u.burnTicks > 0 && u.currentHp > 0) { u.currentHp -= (u.burnDmg || 0); u.burnTicks--; if (u.burnTicks <= 0) { u.burnDmg = 0; const el = document.querySelector(`[data-unit-uid="${u.uid}"]`); if (el) el.classList.remove('wt-burning'); } }
    });

    // Deacon untargetable countdown
    pUnits.forEach(u => {
      if (u.deaconUntargetable > 0) u.deaconUntargetable--;
    });
    eUnits.forEach(u => {
      if (u.deaconUntargetable > 0) u.deaconUntargetable--;
    });

    // Item: Invisible timer countdown (Chinese Stealth Suit)
    pUnits.forEach(u => { if (u._invisibleTimer > 0) u._invisibleTimer--; });

    // Item: Super Stimpak emergency heal
    pUnits.forEach(u => {
      if (u.itemEmergencyHeal && !u._emergencyHealUsed && u.currentHp > 0 && u.currentHp / u.maxHp < 0.5) {
        const healAmt = u.maxHp * u.itemEmergencyHeal;
        u.currentHp = Math.min(u.maxHp, u.currentHp + healAmt);
        u._emergencyHealUsed = true;
        logs.unshift(`[STIM] Super Stimpak! ${u.name} heals ${Math.round(healAmt)} HP!`);
      }
    });

    // Item: Rad Suit poison immunity
    pUnits.forEach(u => {
      if (u.itemPoisonImmune && u.poisonTicks > 0) { u.poisonTicks = 0; u.poisonDmg = 0; }
    });

    // Update buff durations (per global tick)
    pUnits.forEach(unit => {
      if (unit.buffDuration > 0) {
        unit.buffDuration--;
        if (unit.buffDuration === 0) { unit.atk = unit.baseAtk; unit.def = unit.baseDef ?? unit.def; unit.buffAtkMult = 1; const el = document.querySelector(`[data-unit-uid="${unit.uid}"]`); if (el) el.classList.remove('wt-buff-aura'); }
      }
    });
    eUnits.forEach(unit => {
      if (unit.buffDuration > 0) {
        unit.buffDuration--;
        if (unit.buffDuration === 0) { unit.atk = unit.baseAtk; unit.def = unit.baseDef ?? unit.def; unit.buffAtkMult = 1; const el = document.querySelector(`[data-unit-uid="${unit.uid}"]`); if (el) el.classList.remove('wt-buff-aura'); }
      }
    });

    // Tick down stun and suppression durations (per global tick)
    pUnits.forEach(u => {
      if (u.stunDuration > 0) { u.stunDuration--; if (u.stunDuration <= 0) { const el = document.querySelector(`[data-unit-uid="${u.uid}"]`); if (el) el.classList.remove('wt-stunned'); } }
      if (u.suppressedDuration > 0) { u.suppressedDuration--; if (u.suppressedDuration <= 0) u.suppressed = false; }
      // Poison DoT on player units (Ghoul immune)
      if (u.poisonTicks > 0 && u.currentHp > 0) {
        if (u.ghoulPoisonImmune) { u.poisonTicks = 0; u.poisonDmg = 0; const el = document.querySelector(`[data-unit-uid="${u.uid}"]`); if (el) el.classList.remove('wt-poisoned'); }
        else { u.currentHp -= (u.poisonDmg || 0); u.poisonTicks--; if (u.poisonTicks <= 0) { u.poisonDmg = 0; const el = document.querySelector(`[data-unit-uid="${u.uid}"]`); if (el) el.classList.remove('wt-poisoned'); } }
      }
      // DEF shred on player units
      if (u.defShredDuration > 0) { u.defShredDuration--; if (u.defShredDuration <= 0) { u.def = u.baseDef ?? u.def; u.defShredPct = 0; } }
      // 3★ Strong: immune to stun and silence
      if (u.id === 'strong' && u.stars >= 3) { u.stunDuration = 0; u.suppressed = false; u.suppressedDuration = 0; }
      // Item: Fortified Helm — stun immune
      if (u.itemStunResist && u.stunDuration > 0) { u.stunDuration = 0; }
    });
    eUnits.forEach(u => {
      if (u.stunDuration > 0) { u.stunDuration--; if (u.stunDuration <= 0) { const el = document.querySelector(`[data-unit-uid="${u.uid}"]`); if (el) el.classList.remove('wt-stunned'); } }
      if (u.suppressedDuration > 0) { u.suppressedDuration--; if (u.suppressedDuration <= 0) u.suppressed = false; }
      // Poison DoT (Ghoul immune)
      if (u.poisonTicks > 0 && u.currentHp > 0) {
        if (u.ghoulPoisonImmune) { u.poisonTicks = 0; u.poisonDmg = 0; const el = document.querySelector(`[data-unit-uid="${u.uid}"]`); if (el) el.classList.remove('wt-poisoned'); }
        else { u.currentHp -= (u.poisonDmg || 0); u.poisonTicks--; if (u.poisonTicks <= 0) { u.poisonDmg = 0; const el = document.querySelector(`[data-unit-uid="${u.uid}"]`); if (el) el.classList.remove('wt-poisoned'); } }
      }
      // DEF shred expiry
      if (u.defShredDuration > 0) { u.defShredDuration--; if (u.defShredDuration <= 0) { u.def = u.baseDef ?? u.def; u.defShredPct = 0; } }
    });

    // === 3★ PASSIVE TICKS ===
    // Cait 3★: Trigger Rush — below 30% HP, double attack speed
    pUnits.forEach(u => {
      if (u.id === 'cait' && u.stars >= 3 && u.currentHp > 0) {
        const lowHp = u.currentHp / u.maxHp < 0.3;
        u.attackSpeed = lowHp ? (UNIT_DATABASE.cait.attackSpeed * 0.5) : UNIT_DATABASE.cait.attackSpeed;
      }
      // Scrap Armor expiry
      if (u.scrapArmorDuration > 0) { u.scrapArmorDuration--; if (u.scrapArmorDuration <= 0 && u.scrapArmorDef) { u.def = Math.max(0, u.def - u.scrapArmorDef); u.scrapArmorDef = 0; } }
    });
    // Curie 3★: Medical Marvels attack speed buff expiry
    pUnits.forEach(u => {
      if (u._curieAsBuff > 0) { u._curieAsBuff--; if (u._curieAsBuff <= 0) { u.attackSpeed = u._preCurieAttackSpeed || (UNIT_DATABASE[u.id]?.attackSpeed ?? 1.0); delete u._preCurieAttackSpeed; } }
    });
    // Nick 3★: Synth Detective — mark lowest HP enemy for +20% damage
    const nick3Marking = pUnits.some(u => u && u.id === 'nick' && u.stars >= 3 && u.currentHp > 0);
    if (nick3Marking) {
      eUnits.forEach(e => { e.marked = false; });
      const alive = eUnits.filter(e => e.currentHp > 0).sort((a, b) => a.currentHp - b.currentHp);
      if (alive.length > 0) alive[0].marked = true;
    }

    // === BOSS MECHANICS ===
    eUnits.forEach(u => {
      if (!u.isBoss || u.currentHp <= 0) return;
      u._bossTickCounter = (u._bossTickCounter || 0) + 1;
      if (u.bossMechanic === 'poison' && u._bossTickCounter % u.bossInterval === 0) {
        // Radscorpion: poison 2 random player units
        const targets = pUnits.filter(p => p.currentHp > 0).sort(() => Math.random() - 0.5).slice(0, 2);
        targets.forEach(t => { t.poisonDmg = (t.poisonDmg || 0) + u.bossDmg / 8; t.poisonTicks = 8; const poisonEl = document.querySelector(`[data-unit-uid="${t.uid}"]`); if (poisonEl) poisonEl.classList.add('wt-poisoned'); });
        if (targets.length > 0) logs.unshift(`[BOSS] ${u.name} stings ${targets.map(t => t.name).join(' & ')}! Poisoned!`);
      }
      if (u.bossMechanic === 'spawn' && u._bossTickCounter % u.bossInterval === 0) {
        // Mirelurk Queen: spawn a creep add
        const freeSlot = enemySlots.findIndex((s, i) => s === null && i !== 3);
        if (freeSlot !== -1) {
          const add = { name: 'Mirelurk Hatchling', id: 'boss_add', stars: 1, uid: `boss_add_${tick}`, currentHp: 200, maxHp: 200, atk: 30, baseAtk: 30, baseDef: 10, def: 10, position: freeSlot, isEnemy: true, stunDuration: 0, mana: 0, manaMax: 0, apGain: 0, apOnHit: 0, abilityUsed: true, buffDuration: 0, buffAtkMult: 1, attackSpeed: 0.8, attackCooldown: 8, traits: [], cost: 1, items: [] };
          enemySlots[freeSlot] = add;
          eUnits.push(add);
          logs.unshift(`[BOSS] ${u.name} spawns a Hatchling!`);
        }
      }
      if (u.bossMechanic === 'enrage' && !u._enraged && u.currentHp / u.maxHp <= u.bossEnrageThreshold) {
        // Behemoth: enrage at 50% HP
        u.atk = u.baseAtk * (u.enrageAtkMult || 2);
        u._enraged = true;
        logs.unshift(`[BOSS] ${u.name} ENRAGES! ATK doubled!`);
      }
      // Swan (round 14): enrage at <30% HP layered on a stomp boss.
      if (u.bossMechanic === 'stomp' && u.bossEnrageThreshold && !u._enraged && u.currentHp / u.maxHp <= u.bossEnrageThreshold) {
        u.atk = u.baseAtk * (u.enrageAtkMult || 1.5);
        u._enraged = true;
        logs.unshift(`[BOSS] ${u.name} ENRAGES! ATK +${Math.round(((u.enrageAtkMult || 1.5) - 1) * 100)}%!`);
      }
      if (u.bossMechanic === 'stomp' && u._bossTickCounter % u.bossInterval === 0) {
        // Mythic Deathclaw: AoE stomp
        const stompDmg = u.bossDmg;
        pUnits.filter(p => p.currentHp > 0).forEach(p => { p.currentHp -= stompDmg; });
        logs.unshift(`[BOSS] ${u.name} STOMPS! ${Math.round(stompDmg)} damage to all!`);
      }
      // Mothman 'darkness_shroud' — phase alternates between 'thick' and
      // 'thin' every SHROUD_PHASE_TICKS ticks. Damage taken by the boss is
      // modified on the attack path (see applyShroudMultiplier callsites).
      if (u.bossMechanic === 'darkness_shroud' && Array.isArray(u.shroudPhases) && u.shroudPhases.length > 0) {
        const SHROUD_PHASE_TICKS = 40; // ~4 seconds at 100ms/tick
        // _shroudPhaseIdx tracks the CURRENT phase index. Flip when ticks line up.
        if (u._bossTickCounter > 0 && u._bossTickCounter % SHROUD_PHASE_TICKS === 0) {
          u._shroudPhaseIdx = (u._shroudPhaseIdx + 1) % u.shroudPhases.length;
          const phaseName = u.shroudPhases[u._shroudPhaseIdx];
          if (phaseName === 'thick') logs.unshift(`[SHROUD] The shroud thickens...`);
          else if (phaseName === 'thin') logs.unshift(`[SHROUD] The shroud thins...`);
          else logs.unshift(`[SHROUD] The shroud shifts to ${phaseName}...`);
        }
      }

      // Synth Courser (round 21): every `bossInterval` ticks teleport-strike
      // the lowest-HP player unit for `bossDmg`. Agent B re-uses the 'stomp'
      // mechanic key + a `courserTeleport` flag — both must be present.
      if (u.courserTeleport) {
        const interval = u.bossInterval || 50;
        if (u._bossTickCounter > 0 && u._bossTickCounter % interval === 0) {
          const alive = pUnits.filter(p => p.currentHp > 0);
          if (alive.length > 0) {
            alive.sort((a, b) => a.currentHp - b.currentHp);
            const victim = alive[0];
            const strikeDmg = u.bossDmg || 300;
            victim.currentHp -= strikeDmg;
            spawnVFX('impact', { targetUid: victim.uid, isCrit: true, unitId: 'boss' }, rectMap);
            spawnFloat(strikeDmg, true, victim.uid, true, setFloatingNumbers);
            logs.unshift(`[ZAP] ${u.name} teleport-strikes ${victim.name} for ${Math.round(strikeDmg)}!`);
            try { sound.criticalHit?.(); } catch(_) {}
          }
        }
      }

      // Atom Theil (round 35): every tick add 1 stack of radiation DoT to
      // every player unit. Stacks NEVER fall off; each stack ticks 0.5 HP
      // (= 5/s at 100ms). Detected by the `glowBurst` flag set on the boss.
      if (u.glowBurst) {
        pUnits.forEach(p => {
          if (p.currentHp <= 0) return;
          p._radStacks = (p._radStacks || 0) + 1;
        });
        pUnits.forEach(p => {
          if (p.currentHp <= 0 || !p._radStacks) return;
          p.currentHp -= p._radStacks * 0.5;
        });
      }

      // Lorenzo Cabot (round 42): every `bossInterval` ticks freeze one
      // random player unit for `stasisDuration * 10` ticks (= 4s at the
      // default 8). Frozen = stunned + cannot be targeted. Boss takes 50%
      // less damage while ANY player is frozen (applied via
      // applyShroudMultiplier on the damage path through _lorenzoActive).
      // Detected by the `crimsonStasis` flag.
      if (u.crimsonStasis) {
        const interval = u.bossInterval || 80;
        if (u._bossTickCounter > 0 && u._bossTickCounter % interval === 0) {
          const alive = pUnits.filter(p => p.currentHp > 0 && !(p._frozenDuration > 0));
          if (alive.length > 0) {
            const victim = alive[Math.floor(Math.random() * alive.length)];
            const ticks = (u.stasisDuration || 8) * 5; // stasisDuration counted in half-seconds (8 → 40 ticks = 4s)
            victim._frozenDuration = ticks;
            victim.stunDuration = Math.max(victim.stunDuration || 0, ticks);
            victim.deaconUntargetable = Math.max(victim.deaconUntargetable || 0, ticks);
            const el = document.querySelector(`[data-unit-uid="${victim.uid}"]`); if (el) el.classList.add('wt-stunned');
            logs.unshift(`[FIX] ${u.name} freezes ${victim.name}!`);
          }
        }
        u._lorenzoActive = pUnits.some(p => (p._frozenDuration || 0) > 0);
      }
    });

    // Tick down frozen-duration on player units (used by lorenzo_cabot).
    pUnits.forEach(p => {
      if ((p._frozenDuration || 0) > 0) p._frozenDuration--;
    });

    // Tick down attack cooldowns — stunned units do NOT tick
    pUnits.forEach(unit => {
      if (unit.currentHp > 0 && unit.stunDuration <= 0) {
        unit.attackCooldown = Math.max(0, (unit.attackCooldown || 0) - asMult);
      }
    });
    eUnits.forEach(unit => {
      if (unit.currentHp > 0 && unit.stunDuration <= 0) {
        unit.attackCooldown = Math.max(0, (unit.attackCooldown || 0) - 1);
      }
    });

    // Player units that are ready attack (cooldown reached 0)
    pUnits.forEach(unit => {
      if (unit.currentHp <= 0 || unit.stunDuration > 0) return;
      if ((unit.attackCooldown || 0) > 0) return;
      const aliveEnemies = eUnits.filter(e => e.currentHp > 0 && (e.deaconUntargetable || 0) <= 0);
      if (aliveEnemies.length === 0) return;

      unit.attackCooldown = (unit.attackSpeed ?? 1) * 10;

      // Generate AP on attack (only when this unit attacks)
      unit.mana = Math.min(unit.manaMax, (unit.mana || 0) + (unit.apGain || 0) * asMult);

      // Check if ability should trigger (at full AP — active abilities only)
      let abilityTarget = null;
      let pAbilityTriggered = false;
      if (unit.manaMax > 0 && unit.mana >= unit.manaMax && !unit.abilityUsed && !unit.suppressed) {
        if (unit.id === 'dima') abilityTarget = pUnits.filter(a=>a.currentHp<=0).sort((a,b)=>a.position-b.position)[0];
        pAbilityTriggered = triggerAbility(unit, pUnits, eUnits, logs, abilityMult, abilityUnits);
        if (pAbilityTriggered) {
          if (['sturges','curie'].includes(unit.id)) abilityTarget = pUnits.filter(a=>a.currentHp>0&&a.currentHp<a.maxHp).sort((a,b)=>(a.currentHp/a.maxHp)-(b.currentHp/b.maxHp))[0];
          // VFX targeting buckets — keep in sync with the case handlers in triggerAbility.
          // Removed: marcy, codsworth, liberty, wiseman (no longer in roster).
          else if (['dogmeat','robot-dog','nick','deathclaw','magnolia','jack-cabot','tom','sarah-lyon','zeek','virgil'].includes(unit.id)) abilityTarget = eUnits.filter(e=>e.currentHp>0).sort((a,b)=>b.atk-a.atk)[0];
          else if (['danse','moira','hancock','maxson','kellogg','fahrenheit','glory','mother-isolde','madison-li','shaun'].includes(unit.id)) abilityTarget = eUnits.filter(e=>e.currentHp>0)[0];
          else if (unit.id === 'piper') abilityTarget = eUnits.filter(e=>e.currentHp>0).sort((a,b)=>b.def-a.def)[0];
          else if (['maccready','x6-88'].includes(unit.id)) abilityTarget = eUnits.filter(e=>e.currentHp>0).sort((a,b)=>a.currentHp-b.currentHp)[0];
          else if (['ronnie','pickman'].includes(unit.id)) abilityTarget = eUnits.filter(e=>e.currentHp>0).sort((a,b)=>b.currentHp-a.currentHp)[0];
          else if (['cade','irma','ingram','silver-shroud'].includes(unit.id)) abilityTarget = pUnits.filter(a=>a.currentHp>0&&a.currentHp<a.maxHp).sort((a,b)=>(a.currentHp/a.maxHp)-(b.currentHp/b.maxHp))[0];
          else if (['strong','preston','cait','deacon','desdemona','cross','sole-survivor'].includes(unit.id)) abilityTarget = { uid: unit.uid };
          if (abilityTarget) {
            spawnVFX('ability', { unitId: unit.id, fromUid: unit.uid, toUid: abilityTarget.uid }, rectMap);
            // Heal VFX for sturges (single target) and curie (all allies)
            if (unit.id === 'sturges') {
              spawnVFX('heal', { targetUid: abilityTarget.uid }, rectMap);
            } else if (unit.id === 'curie') {
              pUnits.filter(a => a.currentHp > 0).forEach(a => spawnVFX('heal', { targetUid: a.uid }, rectMap));
            }
          }
          unit.mana = 0;
          unit.abilityUsed = true;
          // Item: Jet Injector — heal 15% max HP on ability cast
          if (unit.itemAbilityHeal > 0) {
            const healAmt = unit.maxHp * unit.itemAbilityHeal;
            unit.currentHp = Math.min(unit.maxHp, unit.currentHp + healAmt);
            logs.unshift(`[JET] Jet Injector: ${unit.name} heals ${Math.round(healAmt)}!`);
          }
          // Item: Nuka Grenade — ability deals 25% bonus AoE splash
          if (unit.itemAbilitySplash > 0) {
            const splashDmg = unit.atk * unit.itemAbilitySplash;
            eUnits.filter(e => e.currentHp > 0).forEach(e => { e.currentHp -= splashDmg; });
            logs.unshift(`[BOOM] Nuka Grenade splash: ${Math.round(splashDmg)} to all enemies!`);
          }
          // Item: Nuka-Nuke — burn on ability
          if (unit.itemBurnOnAbility > 0) {
            const burnPerTick = unit.itemBurnOnAbility / 6;
            eUnits.filter(e => e.currentHp > 0).forEach(e => { e.burnDmg = (e.burnDmg || 0) + burnPerTick; e.burnTicks = Math.max(e.burnTicks || 0, 6); });
            logs.unshift(`[RAD] Nuka-Nuke burns all enemies for ${Math.round(unit.itemBurnOnAbility)}!`);
          }
          // Item: Quantum Scope — crit on ability (applies to next attack)
          if (unit.itemCritOnAbility > 0) {
            unit._abilityCritReady = true;
          }
          // Item: Phantom Device — invisible after ability
          if (unit.itemInvisOnAbility > 0) {
            unit._invisibleTimer = Math.max(unit._invisibleTimer || 0, unit.itemInvisOnAbility);
            logs.unshift(`[VOID] ${unit.name} vanishes after ability!`);
          }
          // Item: Combat Medic Kit — heal lowest ally on ability
          if (unit.itemHealAllyOnAbility > 0) {
            const lowestAlly = pUnits.filter(a => a.currentHp > 0 && a.uid !== unit.uid).sort((a, b) => (a.currentHp / a.maxHp) - (b.currentHp / b.maxHp))[0];
            if (lowestAlly) {
              lowestAlly.currentHp = Math.min(lowestAlly.maxHp, lowestAlly.currentHp + unit.itemHealAllyOnAbility);
              logs.unshift(`[MED] Combat Medic: ${lowestAlly.name} heals ${unit.itemHealAllyOnAbility}!`);
            }
          }
        }
      }

      // Proximity targeting: attack nearest enemy by grid distance
      aliveEnemies.sort((a, b) => gridDist(unit.position, a.position, true) - gridDist(unit.position, b.position, true) || a.position - b.position);
      const target = aliveEnemies[0];

      let damage = unit.atk * (unit.buffAtkMult || 1) * (1 + (unit.killBonusAtk || 0)) * (0.8 + Math.random() * 0.4);
      let isCrit = false;

      // Item: Quantum Scope — guaranteed crit after ability
      if (unit._abilityCritReady) {
        damage *= (unit.critMult || 1.5);
        isCrit = true;
        unit._abilityCritReady = false;
        logs.unshift(`[SCOPE] ${unit.name}'s Quantum Scope crit!`);
      }
      // Augment: Guerrilla Tactics — first strike deals bonus damage
      else if (augFirstStrikeMult > 1 && unit.firstAttack) {
        damage *= augFirstStrikeMult;
        isCrit = true;
        unit.firstAttack = false;
        logs.unshift(`[BLADE] ${unit.name} Guerrilla first strike! ${augFirstStrikeMult}x damage!`);
      }
      // 3★ Deathclaw: Apex Predator — first attack is auto-crit
      else if (unit.id === 'deathclaw' && unit.stars >= 3 && unit.firstAttack) {
        damage *= 2;
        isCrit = true;
        unit.firstAttack = false;
        logs.unshift(`[CLAW] ${unit.name} APEX STRIKE! Auto-crit!`);
      }
      // 3★ MacCready: Killshot — 20% chance for 2x crit on normal attacks
      else if (unit.id === 'maccready' && unit.stars >= 3 && Math.random() < 0.2) {
        damage *= 2;
        isCrit = true;
        logs.unshift(`[AIM] ${unit.name} KILLSHOT! 2x damage!`);
      }
      // Item: Laser Sight Barrel crit chance
      else if (unit.itemCritChance > 0 && Math.random() < unit.itemCritChance) {
        damage *= (unit.critMult || 1.5);
        isCrit = true;
        logs.unshift(`[LASER] ${unit.name} crits (Laser Sight)!`);
      }
      // Crit check: Piper 3★ + Raider synergy crit chance
      else if (unit.critBonus > 0 && Math.random() < unit.critBonus) {
        damage *= (unit.critMult || 1.5);
        isCrit = true;
        logs.unshift(`[CRIT] ${unit.name} crits!`);
      }
      // 3★ Nick: Synth Detective — marked enemy takes +20% damage
      if (target.marked) damage *= 1.2;

      // Item: DEF pierce (Gauss Rifle)
      const effectiveDef = unit.defPierce ? (target.def || 0) * (1 - unit.defPierce) : (target.def || 0);
      damage = Math.max(1, damage - effectiveDef * 0.5);
      // Item: ability power bonus on ability attacks
      if (unit.itemAbilityPower > 0 && pAbilityTriggered) damage *= (1 + unit.itemAbilityPower);
      // Item: Combat Rifle triple hit
      if (unit.itemTripleHit > 0) {
        unit._tripleHitCounter = (unit._tripleHitCounter || 0) + 1;
        if (unit._tripleHitCounter >= unit.itemTripleHit) { damage *= 2; unit._tripleHitCounter = 0; logs.unshift(`[GUN] ${unit.name}'s Combat Rifle: double damage!`); }
      }
      // Item: Infiltrator's Kit bonus damage from stealth
      if (unit.itemBonusDmgFromStealth > 0 && (unit._invisibleTimer || 0) > 0) {
        damage *= (1 + unit.itemBonusDmgFromStealth);
        logs.unshift(`[BLADE] ${unit.name} strikes from stealth! +${Math.round(unit.itemBonusDmgFromStealth * 100)}% damage!`);
        { const stealthEl = document.querySelector(`[data-unit-uid="${unit.uid}"]`); if (stealthEl) { stealthEl.classList.add('wt-stealth-attack'); setTimeout(() => stealthEl.classList.remove('wt-stealth-attack'), 400); } }
      }
      // Mothman: single-target auto-attacks are doubled in 'thin' phase.
      damage = applyShroudMultiplier(target, damage, false);
      target.currentHp -= damage;
      // Enemy target gains AP when hit (apOnHit)
      target.mana = Math.min(target.manaMax, (target.mana || 0) + (target.apOnHit || 0));
      damageStats[unit.uid] = (damageStats[unit.uid] || 0) + damage;
      if (!damageStats[unit.uid + '_name']) damageStats[unit.uid + '_name'] = unit.name;

      // ── Robot Dog: CLEAVE auto-attack ───────────────────────────
      // Hits primary + up to the 2 nearest other enemies for 60% damage.
      // Each cleaved hit still respects shroud / death VFX / damage stats.
      if (unit.id === 'robot-dog') {
        const others = eUnits.filter(e => e !== target && e.currentHp > 0 && (e.deaconUntargetable || 0) <= 0);
        others.sort((a, b) => gridDist(target.position, a.position) - gridDist(target.position, b.position));
        const cleaveTargets = others.slice(0, 2);
        cleaveTargets.forEach(ct => {
          let cleaveDmg = damage * 0.6;
          cleaveDmg = applyShroudMultiplier(ct, cleaveDmg, true);
          ct.currentHp -= cleaveDmg;
          damageStats[unit.uid] = (damageStats[unit.uid] || 0) + cleaveDmg;
          spawnVFX('impact', { targetUid: ct.uid, isCrit: false, unitId: unit.id }, rectMap);
          spawnFloat(cleaveDmg, false, ct.uid, false, setFloatingNumbers);
          hitUnits.push(ct.uid);
          if (ct.currentHp <= 0) dyingUnits.push(ct.uid);
        });
        if (cleaveTargets.length) {
          logs.unshift(`[BOT] ${unit.name} cleaves ${cleaveTargets.map(t => t.name).join(' & ')}!`);
        }
      }

      // ── Sole Survivor: per-attack in-combat scaling ─────────────
      // +2 ATK / +20 HP per completed attack. Resets each fight.
      if (unit.id === 'sole-survivor') accrueSoleSurvivorAttackBonus(unit);
      const pIsMelee = isMeleeUnit(unit.id);
      spawnVFX('lunge', { attackerUid: unit.uid, targetUid: target.uid, unitId: unit.id, isAbilityAttack: pAbilityTriggered && unit.id === 'dogmeat' }, rectMap);
      if (!pIsMelee) spawnVFX('projectile', { fromUid: unit.uid, toUid: target.uid, unitId: unit.id, cost: UNIT_DATABASE[unit.id]?.cost }, rectMap);
      spawnVFX('impact', { targetUid: target.uid, isCrit, unitId: unit.id, isAbilityAttack: pAbilityTriggered && unit.id === 'dogmeat' }, rectMap);
      spawnFloat(damage, isCrit, target.uid, false, setFloatingNumbers);
      { const wType = getWeaponType(unit.id);
        if (isCrit) { screenShake(4); try { if (sound.criticalHit) sound.criticalHit(); else sound.crit(); } catch(_) { sound.crit(); } }
        else if (wType === 'ballistic') { try { sound.gunshot?.(); } catch(_) {} if (!sound.gunshot) sound.hit(); }
        else if (wType === 'energy') { try { sound.laserZap?.(); } catch(_) {} if (!sound.laserZap) sound.hit(); }
        else if (wType === 'melee') { try { sound.meleeHit?.(); } catch(_) {} if (!sound.meleeHit) sound.hit(); }
        else if (wType === 'explosive') { try { sound.explosion?.(); } catch(_) {} if (!sound.explosion) sound.hit(); }
        else if (wType === 'healer') { try { sound.healChime?.(); } catch(_) {} if (!sound.healChime) sound.hit(); }
        else if (wType === 'stealth') { try { sound.stealthShimmer?.(); } catch(_) {} if (!sound.stealthShimmer) sound.hit(); }
        else { sound.hit(); }
      }
      attackingUnits.push(unit.uid);
      hitUnits.push(target.uid);
      logs.unshift(`${unit.name} hits ${target.name} for ${Math.round(damage)}${isCrit ? ' (CRIT!)' : ''}`);

      // Fahrenheit 3★ Passive: Arsonist — 15% chance to burn for 50 DoT over 3s (6 ticks)
      if (unit.id === 'fahrenheit' && unit.stars >= 3 && Math.random() < 0.15) {
        target.burnDmg = (target.burnDmg || 0) + 50 / 6;
        target.burnTicks = 6;
        { const burnEl = document.querySelector(`[data-unit-uid="${target.uid}"]`); if (burnEl) burnEl.classList.add('wt-burning'); }
        logs.unshift(`[FIRE] ${target.name} is burning!`);
      }
      // Item: Irradiated Blade — poison on hit
      if (unit.itemPoisonOnHit > 0) {
        target.poisonDmg = (target.poisonDmg || 0) + unit.itemPoisonOnHit / 6;
        target.poisonTicks = Math.max(target.poisonTicks || 0, 6);
        { const poisonEl = document.querySelector(`[data-unit-uid="${target.uid}"]`); if (poisonEl) poisonEl.classList.add('wt-poisoned'); }
        logs.unshift(`[BLADE] ${target.name} poisoned by Irradiated Blade!`);
      }
      // Item: Ballistic Weave — reflect damage to attacker (handled on enemy side)

      if (target.currentHp <= 0) {
        spawnVFX('death', { targetUid: target.uid, isPlayer: false, side: 'right', killerWeaponType: getWeaponType(unit.id) }, rectMap);
        spawnKillNotify(unit.name, target.name);
        try { sound.killConfirm?.(); } catch(_) {}
        sound.death();
        logs.unshift(`[KILL] ${target.name} defeated!`);
        dyingUnits.push(target.uid);
        // V.A.T.S. kill cam on last enemy kill
        const aliveEnemiesAfterKill = eUnits.filter(e => e.currentHp > 0 && e.uid !== target.uid);
        if (aliveEnemiesAfterKill.length === 0) {
          const topBar = document.createElement('div');
          topBar.className = 'wt-vats-letterbox wt-vats-letterbox-top';
          const botBar = document.createElement('div');
          botBar.className = 'wt-vats-letterbox wt-vats-letterbox-bottom';
          const scan = document.createElement('div');
          scan.className = 'wt-vats-scan';
          document.body.appendChild(topBar);
          document.body.appendChild(botBar);
          document.body.appendChild(scan);
          setTimeout(() => { topBar.remove(); botBar.remove(); scan.remove(); }, 1500);
        }
        // 3★ Hancock: Of the People — heals allies 10% HP on kill
        if (unit.id === 'hancock' && unit.stars >= 3) {
          const healAmount = unit.maxHp * 0.1;
          const livingAllies = pUnits.filter(a => a.currentHp > 0);
          livingAllies.forEach(ally => {
            if (ally.currentHp < ally.maxHp) {
              ally.currentHp = Math.min(ally.maxHp, ally.currentHp + healAmount);
            }
          });
          spawnVFX('ability', { unitId: 'hancock', fromUid: target.uid, allyUids: livingAllies.map(a => a.uid) }, rectMap);
          logs.unshift(`[HEAL] ${unit.name}'s Of the People heals team!`);
          abilityUnits.push(unit.uid);
        }
        // 3★ Deathclaw: Apex Predator — +25% ATK permanently per kill (cap +100%)
        if (unit.id === 'deathclaw' && unit.stars >= 3) {
          unit.killBonusAtk = Math.min((unit.killBonusAtk || 0) + 0.25, 1.0);
          logs.unshift(`[CLAW] Apex Predator! ${unit.name} ATK +25%! (total +${Math.round(unit.killBonusAtk * 100)}%)`);
        }
        // 3★ Strong: Unstoppable — +5% max HP permanently per kill (cap +50%)
        if (unit.id === 'strong' && unit.stars >= 3) {
          const killHpBonus = unit.killHpBonus || 0;
          if (killHpBonus < 0.5) {
            const hpGain = unit.maxHp * 0.05;
            unit.maxHp += hpGain;
            unit.currentHp += hpGain;
            unit.killHpBonus = killHpBonus + 0.05;
            logs.unshift(`[STR] Unstoppable! ${unit.name} gains +${Math.round(hpGain)} max HP!`);
          }
        }
        // Item: Medic's Rifle — heal on kill
        if (unit.itemHealOnKill > 0) {
          unit.currentHp = Math.min(unit.maxHp, unit.currentHp + unit.itemHealOnKill);
          logs.unshift(`[MED] ${unit.name} heals ${unit.itemHealOnKill} HP on kill!`);
        }
        // Atom Theil (glowBurst boss): on death, restore N% maxHp to all
        // remaining ally enemies (default 50%, configurable via `deathHealAllies`).
        if (target.isBoss && target.glowBurst && !target._atomTheilDeathDone) {
          target._atomTheilDeathDone = true;
          const healPct = typeof target.deathHealAllies === 'number' ? target.deathHealAllies : 0.5;
          eUnits.forEach(ally => {
            if (ally === target || ally.currentHp <= 0) return;
            const heal = ally.maxHp * healPct;
            ally.currentHp = Math.min(ally.maxHp, ally.currentHp + heal);
            spawnVFX('heal', { targetUid: ally.uid }, rectMap);
          });
          logs.unshift(`[RAD] ${target.name} blooms on death — allies restored ${Math.round(healPct * 100)}% HP!`);
        }
      }
    });

    // Enemy units that are ready attack
    eUnits.forEach(unit => {
      if (unit.currentHp <= 0 || unit.stunDuration > 0) return;
      if ((unit.attackCooldown || 0) > 0) return;
      const alivePlayers = pUnits.filter(p => p.currentHp > 0 && (p.deaconUntargetable || 0) <= 0);
      if (alivePlayers.length === 0) return;

      unit.attackCooldown = (unit.attackSpeed ?? 1) * 10;

      unit.mana = Math.min(unit.manaMax, (unit.mana || 0) + (unit.apGain || 0));

      let eAbilityTarget = null;
      let eAbilityTriggered = false;
      if (unit.manaMax > 0 && unit.mana >= unit.manaMax && !unit.abilityUsed && !unit.suppressed) {
        if (unit.id === 'dima') eAbilityTarget = eUnits.filter(a=>a.currentHp<=0).sort((a,b)=>a.position-b.position)[0];
        eAbilityTriggered = triggerAbility(unit, eUnits, pUnits, logs, 1, abilityUnits);
        if (eAbilityTriggered) {
          if (['sturges','curie','cade','irma','ingram','silver-shroud'].includes(unit.id)) eAbilityTarget = eUnits.filter(a=>a.currentHp>0&&a.currentHp<a.maxHp).sort((a,b)=>(a.currentHp/a.maxHp)-(b.currentHp/b.maxHp))[0];
          else if (['dogmeat','robot-dog','nick','deathclaw','magnolia','jack-cabot','tom','sarah-lyon','zeek','virgil'].includes(unit.id)) eAbilityTarget = pUnits.filter(p=>p.currentHp>0).sort((a,b)=>b.atk-a.atk)[0];
          else if (['danse','moira','hancock','maxson','kellogg','fahrenheit','glory','mother-isolde','madison-li','shaun'].includes(unit.id)) eAbilityTarget = pUnits.filter(p=>p.currentHp>0)[0];
          else if (unit.id === 'piper') eAbilityTarget = pUnits.filter(p=>p.currentHp>0).sort((a,b)=>b.def-a.def)[0];
          else if (['maccready','x6-88'].includes(unit.id)) eAbilityTarget = pUnits.filter(p=>p.currentHp>0).sort((a,b)=>a.currentHp-b.currentHp)[0];
          else if (['ronnie','pickman'].includes(unit.id)) eAbilityTarget = pUnits.filter(p=>p.currentHp>0).sort((a,b)=>b.currentHp-a.currentHp)[0];
          else if (['strong','preston','cait','deacon','desdemona','cross','sole-survivor'].includes(unit.id)) eAbilityTarget = { uid: unit.uid };
          spawnVFX('ability', { unitId: unit.id, fromUid: unit.uid, toUid: eAbilityTarget?.uid }, rectMap);
          // Heal VFX for enemy sturges/curie abilities
          if (unit.id === 'sturges' && eAbilityTarget) {
            spawnVFX('heal', { targetUid: eAbilityTarget.uid }, rectMap);
          } else if (unit.id === 'curie') {
            eUnits.filter(a => a.currentHp > 0).forEach(a => spawnVFX('heal', { targetUid: a.uid }, rectMap));
          }
          unit.mana = 0;
          unit.abilityUsed = true;
        }
      }

      // Filter out invisible player units
      const visiblePlayers = alivePlayers.filter(p => (p._invisibleTimer || 0) <= 0);
      if (visiblePlayers.length === 0) return;
      // Proximity targeting: attack nearest player by grid distance
      visiblePlayers.sort((a, b) => gridDist(unit.position, a.position, true) - gridDist(unit.position, b.position, true) || a.position - b.position);
      const target = visiblePlayers[0];

      // Item: stun resist (Fortified Helm)
      if (target.itemStunResist && target.stunDuration > 0) {
        target.stunDuration = 0;
      }
      // Item: dodge check (player unit dodges enemy attack)
      if ((target.dodge || 0) > 0 && Math.random() < target.dodge) {
        logs.unshift(`[DODGE] ${target.name} dodges ${unit.name}'s attack!`);
        // Dodge animation
        const dodgeEl = document.querySelector(`[data-unit-uid="${target.uid}"]`);
        if (dodgeEl) {
          dodgeEl.classList.add('wt-dodge');
          setTimeout(() => dodgeEl.classList.remove('wt-dodge'), 300);
        }
        try { sound.missWhiff?.(); } catch(_) {}
        // Item: Cloaked Stimpak — heal on dodge
        if (target.itemHealOnDodge > 0) {
          target.currentHp = Math.min(target.maxHp, target.currentHp + target.itemHealOnDodge);
          logs.unshift(`[HEAL] ${target.name} heals ${target.itemHealOnDodge} HP on dodge!`);
        }
        return;
      }

      let damage = unit.atk * (unit.buffAtkMult || 1) * (0.8 + Math.random() * 0.4);
      damage = Math.max(1, damage - (target.def || 0) * 0.5);
      if (target.damageResist > 0) damage *= (1 - target.damageResist);
      if (target.abilityResist > 0 && eAbilityTriggered) damage *= (1 - target.abilityResist);
      target.currentHp -= damage;
      // Item: Ballistic Weave — reflect damage back to attacker
      if (target.itemReflectDamage > 0) {
        const reflectDmg = damage * target.itemReflectDamage;
        unit.currentHp -= reflectDmg;
        logs.unshift(`[WEAVE] ${target.name} reflects ${Math.round(reflectDmg)} damage!`);
      }
      const eIsMelee = isMeleeUnit(unit.id);
      spawnVFX('lunge', { attackerUid: unit.uid, targetUid: target.uid, unitId: unit.id, isAbilityAttack: eAbilityTriggered && unit.id === 'dogmeat' }, rectMap);
      if (!eIsMelee) spawnVFX('projectile', { fromUid: unit.uid, toUid: target.uid, unitId: unit.id, cost: UNIT_DATABASE[unit.id]?.cost }, rectMap);
      spawnVFX('impact', { targetUid: target.uid, isCrit: false, unitId: unit.id, isAbilityAttack: eAbilityTriggered && unit.id === 'dogmeat' }, rectMap);
      spawnFloat(damage, false, target.uid, true, setFloatingNumbers);
      { const wType = getWeaponType(unit.id);
        if (wType === 'ballistic') { try { sound.gunshot?.(); } catch(_) {} if (!sound.gunshot) sound.hit(); }
        else if (wType === 'energy') { try { sound.laserZap?.(); } catch(_) {} if (!sound.laserZap) sound.hit(); }
        else if (wType === 'melee') { try { sound.meleeHit?.(); } catch(_) {} if (!sound.meleeHit) sound.hit(); }
        else if (wType === 'explosive') { try { sound.explosion?.(); } catch(_) {} if (!sound.explosion) sound.hit(); }
        else if (wType === 'healer') { try { sound.healChime?.(); } catch(_) {} if (!sound.healChime) sound.hit(); }
        else if (wType === 'stealth') { try { sound.stealthShimmer?.(); } catch(_) {} if (!sound.stealthShimmer) sound.hit(); }
        else { sound.hit(); }
      }
      target.mana = Math.min(target.manaMax, (target.mana || 0) + (target.apOnHit || 0));

      attackingUnits.push(unit.uid);
      hitUnits.push(target.uid);
      logs.unshift(`${unit.name} hits ${target.name} for ${Math.round(damage)}`);
      if (target.currentHp <= 0) {
        spawnVFX('death', { targetUid: target.uid, isPlayer: true, side: 'left', killerWeaponType: getWeaponType(unit.id) }, rectMap);
        spawnKillNotify(unit.name, target.name);
        try { sound.killConfirm?.(); } catch(_) {}
        sound.death();
        logs.unshift(`[KILL] ${target.name} defeated!`); dyingUnits.push(target.uid);
        // 3★ Danse: Brotherhood Shield — on death, 400 AoE + allies gain +25% DEF
        if (target.id === 'danse' && target.stars >= 3) {
          const explosionDmg = 400 * abilityMult;
          eUnits.filter(e => e.currentHp > 0).forEach(e => { e.currentHp -= explosionDmg; });
          pUnits.filter(a => a.currentHp > 0).forEach(a => {
            a.def = (a.baseDef ?? a.def) * 1.25;
          });
          logs.unshift(`[ZAP] Brotherhood Shield! Power armor explodes for ${Math.round(explosionDmg)}! Allies +25% DEF!`);
        }
        // Kellogg 3★: Immortal Synth — revive with 30% HP once
        if (target.id === 'kellogg' && target.stars >= 3 && !target.kelloggRevived) {
          target.currentHp = target.maxHp * 0.3;
          target.kelloggRevived = true;
          dyingUnits = dyingUnits.filter(uid => uid !== target.uid);
          logs.unshift(`[FIX] ${target.name}'s Immortal Synth! Revived with 30% HP!`);
        }
        // Ghoul death radiation: deal 20% max HP to all enemies on death
        if (target.isGhoul && target.ghoulDeathRadiation) {
          const radDmg = target.maxHp * 0.2;
          eUnits.filter(e => e.currentHp > 0).forEach(e => { e.currentHp -= radDmg; });
          logs.unshift(`[BIO] ${target.name} radiates on death! ${Math.round(radDmg)} damage to all enemies!`);
        }
      }
    });

    // Schedule timer-based animations so they persist for their full CSS duration
    attackingUnits.forEach(uid => scheduleAnim('attacking', uid));
    hitUnits.forEach(uid => scheduleAnim('hit', uid));
    dyingUnits.forEach(uid => scheduleAnim('dying', uid));
    abilityUnits.forEach(uid => scheduleAnim('ability', uid));
    if (attackingUnits.length || hitUnits.length || dyingUnits.length || abilityUnits.length) {
      flushAnimState();
    }

    // Support 3-count: revive weakest ally once if all would die
    if (supportRevive && !reviveUsed && !pUnits.some(u => u.currentHp > 0)) {
      const deadUnits = pUnits.filter(u => u.currentHp <= 0);
      if (deadUnits.length > 0) {
        deadUnits.sort((a, b) => a.maxHp - b.maxHp);
        const reviveTarget = deadUnits[0];
        reviveTarget.currentHp = reviveTarget.maxHp * 0.3;
        reviveUsed = true;
        logs.unshift(`[HEAL] Support revives ${reviveTarget.name} at 30% HP!`);
        sound.ability();
      }
    }

    while (logs.length > 120) logs.pop();

    const logSlice = logs.slice(0, 10);
    const logSnap = logSlice.join('\x01');
    if (logSnap !== lastLogSnap) {
      lastLogSnap = logSnap;
      setLog(logSlice);
    }

    const hpManaSig = (u) => (u ? `${Math.round(u.currentHp)}|${Math.round(u.mana ?? 0)}` : '');
    const combatSig = `${pUnits.map(hpManaSig).join(';')}~${enemySlots.map(hpManaSig).join(';')}`;
    if (combatSig !== lastCombatSig) {
      lastCombatSig = combatSig;
      setCombatUnits([...pUnits]);
      setCombatEnemies([...enemySlots]);
    }

    const playerAlive = pUnits.some(u => u.currentHp > 0);
    const enemyAlive = eUnits.some(u => u.currentHp > 0);

    if (!playerAlive || !enemyAlive || tick >= 150) {
      clearInterval(combatInterval);
      combatRef.current = null;
      // Clean up animation timers
      Object.values(animTimers).forEach(group => {
        Object.values(group).forEach(t => clearTimeout(t));
      });
      // Clean up combat CSS classes from all unit DOM elements
      document.querySelectorAll('[data-unit-uid]').forEach(el => {
        el.classList.remove('wt-stunned', 'wt-poisoned', 'wt-burning', 'wt-buff-aura', 'wt-debuffed', 'wt-dodge', 'wt-stealth-attack');
        el.style.transition = '';
        el.style.transform = '';
      });
      // Reset animation state
      setAnimations({ attacking: [], hit: [], dying: [], ability: [] });
      const won = enemyAlive === false;
      // 3★ Dogmeat Passive: Good Boy — +1 bonus caps on victory (no survival needed)
      const dogmeat3 = pUnits.find(u => u.id === 'dogmeat' && u.stars >= 3);
      if (won && dogmeat3) extraGold = 1;

      // ── Sole Survivor: per-round PERMANENT scaling ──────────────
      // +5 ATK / +50 HP / +1 DEF accrued at the end of every round
      // (win OR loss). The persistent record lives on the player's
      // board slot (`scalingBonus = { atk, hp, def }`) so it survives
      // across fights; we mirror onto both the combat-clone and the
      // board record so a subsequent buy/move keeps the gain.
      pUnits.forEach(u => {
        if (u.id !== 'sole-survivor') return;
        const next = accrueSoleSurvivorRoundBonus(u);
        if (next && Array.isArray(board)) {
          const rec = board.find(b => b && b.uid === u.uid);
          if (rec) rec.scalingBonus = next;
        }
      });

      // TFT-style player damage on loss: base by stage + sum of surviving enemy unit damage by cost.
      // Per-unit damage scales with cost (1c→1, 2c→1, 3c→2, 4c→3, 5c→4) with a small star bump
      // (+0 / +0 / +1 for 1★/2★/3★). Matches TFT's "you take more if they kept their stronger units".
      const currentStage = Math.ceil(round / 3);
      const baseDmg = currentStage <= 2 ? 0 : currentStage === 3 ? 2 : currentStage === 4 ? 3 : currentStage === 5 ? 5 : currentStage === 6 ? 6 : 7;
      const costDamage = { 1: 1, 2: 1, 3: 2, 4: 3, 5: 4 };
      const survivors = eUnits.filter(u => u.currentHp > 0);
      const unitDmg = survivors.reduce((a, u) => {
        const cost = UNIT_DATABASE[u.id]?.cost || 1;
        const perUnit = (costDamage[cost] || 1) + (u.stars === 3 ? 1 : 0);
        return a + perUnit;
      }, 0);
      const dmg = won ? 0 : baseDmg + unitDmg;
      // Stash the breakdown so the post-fight UI can show "5 (2 base + 3 from 2 survivors)".
      callbacks.setLastDamageBreakdown?.({ won, total: dmg, base: baseDmg, survivors: survivors.length, fromUnits: unitDmg, stage: currentStage });
      let nextStreak = 0;
      if (won) {
        logs.unshift('[VICTORY] You stand victorious!');
        setStreak(s => {
          nextStreak = Math.max(s + 1, 1);
          return nextStreak;
        });
        sound.victory();
        spawnRoundText('VICTORY', 'victory');
      } else {
        logs.unshift(`[DEFEAT] -${dmg} HP  ·  ${baseDmg} stage + ${unitDmg} from ${survivors.length} survivor${survivors.length === 1 ? '' : 's'}`);
        setStreak(s => {
          nextStreak = Math.min(s - 1, -1);
          return nextStreak;
        });
        sound.defeat();
        spawnRoundText('DEFEAT', 'defeat');
      }

      // Add Dogmeat bonus gold to log
      if (extraGold > 0 && won) {
        logs.unshift(`[DOG] Dogmeat fetched ${extraGold} bonus caps!`);
      }

      setLog(logs.slice(0, 10));
      setBonusGold(won ? extraGold : 0);
      setDamageStats?.(damageStats);
      const isPvERound = isPveRound(round);
      const isBossRound = round > 3 && round % 7 === 0;
      const pveWave = isPvERound ? getPveWave(round) : null;
      addMatchHistory?.({
        round,
        won,
        damage: dmg,
        opponent: isBossRound ? 'Boss' : isPvERound ? (pveWave?.name || 'PvE') : (callbacks.currentOpponent || 'Ghost'),
        unitsAlive: pUnits.filter(u => u.currentHp > 0).length,
      });

      setTimeout(() => {
        const finalHp = won ? hpRef.current : Math.max(0, hpRef.current - dmg);
        setHp(finalHp);

        if (!won && finalHp <= 0) {
          try {
            const stats = JSON.parse(localStorage.getItem('wt_player_stats') || '{}');
            stats.gamesPlayed = (stats.gamesPlayed || 0) + 1;
            stats.bestRound = Math.max(stats.bestRound || 0, round);
            stats.lastRound = round;
            localStorage.setItem('wt_player_stats', JSON.stringify(stats));
            callbacks.setPlayerStats?.(stats);
          } catch(_){}
          setPhase('gameover');
          return;
        }

        // Income & progression for next round (TFT economy)
        // Augment economy bonuses
        const augScavenger = augments.reduce((sum, id) => { const a = AUGMENT_POOL.find(x => x.id === id); return sum + (a?.effect?.bonusGold || 0); }, 0);
        const augBonusXp = augments.reduce((sum, id) => { const a = AUGMENT_POOL.find(x => x.id === id); return sum + (a?.effect?.bonusXp || 0); }, 0);
        const augInterestCap = augments.reduce((cap, id) => { const a = AUGMENT_POOL.find(x => x.id === id); return a?.effect?.interestCap ? Math.max(cap, a.effect.interestCap) : cap; }, 5);

        setGold(g => {
          const interest = Math.min(Math.floor(g / 10), augInterestCap);
          const absStreak = Math.abs(nextStreak);
          const streakBonus = absStreak >= 6 ? 3 : absStreak >= 4 ? 2 : absStreak >= 2 ? 1 : 0;
          const baseIncome = round >= 5 ? 5 : round >= 4 ? 4 : round >= 3 ? 3 : 2;
          const winBonus = won ? 1 : 0;
          const baseRaw = baseIncome + interest + streakBonus + winBonus + augScavenger;
          // Wave 3: difficulty.goldMult scales total earned income. Normal=1.0
          // so this is a no-op there (parity tests assert this).
          const diff = getDifficultyMode(callbacks.difficultyId);
          const goldMult = diff.goldMult;
          const base = Math.round(baseRaw * goldMult);
          const bonus = won ? extraGold : 0;
          setIncomeBreakdown?.({ base: baseIncome, interest, streak: streakBonus, augment: augScavenger, total: base + bonus });
          return g + base + bonus;
        });

        setXp(x => {
          const { xpNeeded: needed, level: lvl } = xpMetaRef.current;
          const gain = 2 + augBonusXp;
          const totalXp = x + gain;
          if (totalXp >= needed && lvl < 9) {
            const nextNeeded = XP_TO_LEVEL[lvl + 2] || 60;
            setLevel(l => l + 1);
            setXpNeeded(nextNeeded);
            xpMetaRef.current = { xpNeeded: nextNeeded, level: lvl + 1 };
            return totalXp - needed;
          }
          return totalXp;
        });

        // Item drops: any PvE round (themed creep waves) and boss rounds drop components.
        const isPvE = isPveRound(round);
        const isBossRound = round > 3 && round % 7 === 0;
        if (won && isPvE) {
          // PvE creeps drop items directly — TFT krug/wolf/raptor style. No picker.
          // Wave 36 (Sentry Bots) drops a fully-completed item per pveWaves.js dropTier.
          const wave = getPveWave(round);
          const dropTier = wave?.dropTier || 'component';
          if (dropTier === 'completed') {
            const completedKeys = Object.keys(COMPLETED_ITEMS);
            const drop = completedKeys[Math.floor(Math.random() * completedKeys.length)];
            setItemInventory?.(prev => [...prev, drop]);
            const dropName = COMPLETED_ITEMS[drop]?.name || drop;
            setLog(prev => [`[ITEM] ${wave?.name || 'PvE wave'} dropped ${dropName}!`, ...prev.slice(0, 9)]);
          } else {
            const drop = getRandomComponent();
            setItemInventory?.(prev => [...prev, drop]);
            const dropName = ITEM_COMPONENTS[drop]?.name || drop;
            setLog(prev => [`[ITEM] ${wave?.name || 'PvE wave'} dropped ${dropName}!`, ...prev.slice(0, 9)]);
          }
        } else if (won && isBossRound) {
          // Bosses still offer a CHOICE — they're milestone rewards.
          const drops = [getRandomComponent(), getRandomComponent(), getRandomComponent()];
          setItemSelection({ items: drops });
          setLog(prev => [`[GIFT] Choose an item component!`, ...prev.slice(0, 9)]);
        }

        // Augment choice spread across the 42-round game so endgame keeps progressing.
        const augmentRounds = [3, 8, 13, 18, 24, 30, 36];
        if (augmentRounds.includes(round)) {
          const available = AUGMENT_POOL.filter(a => !augments.includes(a.id));
          if (available.length >= 3) {
            const shuffled = [...available].sort(() => Math.random() - 0.5);
            setAugmentChoice({ options: shuffled.slice(0, 3) });
          }
        }

        setRound(r => r + 1);
        setShop(prev => generateShop(prev));
        setBonusGold(0);

        // Check if we just finished the last round of a stage — trigger Lucky 38 carousel
        if (isCarouselRound(round)) {
          setCarouselActive(true);
          setPhase('carousel');
        } else {
          setPhase('prep');
          setTimer(callbacks.prepTimer || 30);
        }
        // Auto-save at start of each prep phase (delay to let React flush state)
        setTimeout(() => { try { saveGame(); } catch(e) {} }, 500);
      }, 1500);
    }
  }, 100);
  combatRef.current = combatInterval;
};
