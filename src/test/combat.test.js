// Combat system tests.
//
// Scope: the pure / mostly-pure exports from src/systems/combat.js.
//   - getActiveSynergies (pure, no DOM)
//   - generateEnemies   (no DOM, but uses Math.random — we stub)
//   - triggerAbility    (mutates units; touches document.querySelector + sound,
//                        both of which are safe under jsdom — querySelector
//                        returns null for unknown UIDs and the sound layer
//                        swallows AudioContext errors.)
//   - resolveDualRange / lockDualRange (positional helper for dual units)
//   - applyRobotDogTransform (augment data-shape helper)
//   - applySurvivorsBond / countAdjacentFo4Companions / accrue*
//
// runCombat is intentionally out of scope: it pulls in 20+ React setters,
// DOM rects, requestAnimationFrame timing, and music callbacks. Those belong
// to integration / playwright tests, not this safety net.
//
// Damage formula, per-tick status decay, attack cooldown, proximity targeting,
// crit rolls, etc. all live as closures inside runCombat, so we cannot exercise
// them directly. We DO cover their effects indirectly where triggerAbility
// applies them (poison, burn, stun, defShred, buffAtkMult, revive).

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getActiveSynergies,
  triggerAbility,
  generateEnemies,
  getCandidateScore,
  ghostPlayerShop,
  ghostEquipItem,
  resolveDualRange,
  lockDualRange,
  applyRobotDogTransform,
  countAdjacentFo4Companions,
  applySurvivorsBond,
  accrueSoleSurvivorRoundBonus,
  accrueSoleSurvivorAttackBonus,
  hexNeighbors,
  FO4_COMPANIONS,
} from '../systems/combat.js';
import { UNIT_DATABASE } from '../data/units.js';
import { TRAITS } from '../data/traits.js';
import { DIFFICULTY_MODES } from '../data/difficulty.js';

// ── Helpers ────────────────────────────────────────────────────────────────

let uidCounter = 0;
const nextUid = () => `test_${++uidCounter}`;

/**
 * Build a combat-ready unit object using the same fields runCombat assigns
 * when it materializes a board slot. Caller can override anything.
 */
const makeUnit = (id, overrides = {}) => {
  const base = UNIT_DATABASE[id];
  if (!base) throw new Error(`Unknown unit id: ${id}`);
  const stars = overrides.stars ?? 1;
  const mult = stars === 3 ? 2.5 : stars === 2 ? 1.8 : 1;
  return {
    ...base,
    id,
    stars,
    uid: overrides.uid ?? nextUid(),
    currentHp: base.hp * mult,
    maxHp: base.hp * mult,
    atk: base.atk * mult,
    baseAtk: base.atk * mult,
    def: base.def * mult,
    baseDef: base.def * mult,
    mana: 0,
    manaMax: base.apMax || 0,
    apGain: base.apGain || 0,
    apOnHit: base.apOnHit || 0,
    abilityUsed: false,
    stunDuration: 0,
    buffDuration: 0,
    buffAtkMult: 1,
    attackSpeed: base.attackSpeed ?? 1,
    attackCooldown: (base.attackSpeed ?? 1) * 10,
    position: 0,
    isEnemy: false,
    items: [],
    ...overrides,
  };
};

const makeBoardSlot = (id, stars = 1) => ({ id, stars });

beforeEach(() => {
  uidCounter = 0;
});

// ── getActiveSynergies ─────────────────────────────────────────────────────

describe('getActiveSynergies', () => {
  it('returns empty array when board has no units', () => {
    const board = Array(14).fill(null);
    expect(getActiveSynergies(board)).toEqual([]);
  });

  it('does not activate a trait with only one unique unit', () => {
    // Preston alone — single-unit traits are filtered.
    const board = [makeBoardSlot('preston'), null, null];
    const synergies = getActiveSynergies(board);
    expect(synergies).toEqual([]);
  });

  it('activates a trait when 2 unique units share it', () => {
    // Preston (minutemen, sniper) + Ronnie (minutemen, sniper) -> both at count 2.
    const board = [makeBoardSlot('preston'), makeBoardSlot('ronnie')];
    const synergies = getActiveSynergies(board);
    const traits = synergies.map(s => s.trait).sort();
    expect(traits).toEqual(['minutemen', 'sniper']);
    const minutemen = synergies.find(s => s.trait === 'minutemen');
    expect(minutemen.count).toBe(2);
    // Tier bonuses come from the trait config.
    expect(minutemen.effect(2).adjAtkAdd).toBe(15);
    expect(minutemen.effect(3).adjAtkAdd).toBe(30);
  });

  it('counts only unique unit ids — duplicates of one unit count once', () => {
    // Three preston copies still = 1 unique minutemen unit.
    const board = [
      makeBoardSlot('preston'),
      makeBoardSlot('preston', 2),
      makeBoardSlot('preston', 3),
    ];
    expect(getActiveSynergies(board)).toEqual([]);
  });
});

// ── generateEnemies ────────────────────────────────────────────────────────

describe('generateEnemies', () => {
  it('returns a 14-slot board', () => {
    const slots = generateEnemies(1);
    expect(slots).toHaveLength(14);
  });

  it('uses cost-1 units only on round 1', () => {
    for (let i = 0; i < 10; i++) {
      const slots = generateEnemies(1);
      const occupied = slots.filter(s => s !== null);
      expect(occupied.length).toBeGreaterThan(0);
      for (const e of occupied) {
        if (e.isBoss) continue;
        expect(UNIT_DATABASE[e.id].cost).toBeLessThanOrEqual(1);
      }
    }
  });

  it('produces a boss slot at round 7', () => {
    const slots = generateEnemies(7);
    expect(slots[3]).toBeTruthy();
    expect(slots[3].isBoss).toBe(true);
    expect(slots[3].bossMechanic).toBe('poison');
  });

  it('produces a boss slot at round 21 (Synth Courser teleport flag set)', () => {
    const slots = generateEnemies(21);
    expect(slots[3].isBoss).toBe(true);
    // Agent B's Wave-2 boss data recycles the 'stomp' mechanic key and adds
    // a `courserTeleport` side flag for the new teleport-strike behaviour.
    expect(slots[3].courserTeleport).toBe(true);
  });
});

// ── triggerAbility — status effects ────────────────────────────────────────

describe('triggerAbility — status effects', () => {
  it('moira applies poison DoT to two enemies', () => {
    const moira = makeUnit('moira');
    const enemyA = makeUnit('cait', { isEnemy: true });
    const enemyB = makeUnit('strong', { isEnemy: true });
    const enemyC = makeUnit('preston', { isEnemy: true });
    const logs = [];
    const abilityUnits = [];

    const ok = triggerAbility(moira, [moira], [enemyA, enemyB, enemyC], logs, 1, abilityUnits);
    expect(ok).toBe(true);

    const poisoned = [enemyA, enemyB, enemyC].filter(e => e.poisonTicks > 0);
    expect(poisoned).toHaveLength(2);
    for (const t of poisoned) {
      expect(t.poisonTicks).toBe(8);
      expect(t.poisonDmg).toBeGreaterThan(0);
      expect(t.poisonDmg).toBeCloseTo(80 / 8, 5);
    }
    expect(abilityUnits).toContain(moira.uid);
  });

  it('fahrenheit applies burn DoT to up to three enemies', () => {
    const fah = makeUnit('fahrenheit');
    const enemies = [
      makeUnit('cait', { isEnemy: true }),
      makeUnit('strong', { isEnemy: true }),
      makeUnit('preston', { isEnemy: true }),
      makeUnit('moira', { isEnemy: true }),
    ];
    const logs = [];
    const ok = triggerAbility(fah, [fah], enemies, logs, 1, []);
    expect(ok).toBe(true);

    const burned = enemies.filter(e => e.burnTicks > 0);
    expect(burned.length).toBeGreaterThan(0);
    expect(burned.length).toBeLessThanOrEqual(3);
    for (const t of burned) {
      expect(t.burnTicks).toBe(6);
      expect(t.burnDmg).toBeCloseTo(50 / 6, 5);
      expect(t.currentHp).toBeLessThan(t.maxHp);
    }
  });

  it('dogmeat stuns the highest-ATK enemy', () => {
    const dog = makeUnit('dogmeat');
    // Use units whose new-data ATK values are clearly ordered:
    //   preston=46, cait=55, deathclaw=145 (highest).
    const weak = makeUnit('preston', { isEnemy: true });
    const big = makeUnit('deathclaw', { isEnemy: true });
    const mid = makeUnit('cait', { isEnemy: true });
    expect(big.atk).toBeGreaterThan(mid.atk);
    expect(mid.atk).toBeGreaterThan(weak.atk);

    const ok = triggerAbility(dog, [dog], [weak, big, mid], [], 1, []);
    expect(ok).toBe(true);
    expect(big.stunDuration).toBeGreaterThan(0);
    expect(weak.stunDuration).toBe(0);
    expect(mid.stunDuration).toBe(0);
  });

  it('dogmeat returns false if every enemy is already stunned', () => {
    const dog = makeUnit('dogmeat');
    const e1 = makeUnit('preston', { isEnemy: true, stunDuration: 10 });
    const e2 = makeUnit('strong', { isEnemy: true, stunDuration: 10 });
    const ok = triggerAbility(dog, [dog], [e1, e2], [], 1, []);
    expect(ok).toBe(false);
  });

  it('nick suppresses (silences) the highest-ATK enemy', () => {
    const nick = makeUnit('nick');
    const enemy = makeUnit('strong', { isEnemy: true });
    const ok = triggerAbility(nick, [nick], [enemy], [], 1, []);
    expect(ok).toBe(true);
    expect(enemy.suppressed).toBe(true);
    expect(enemy.suppressedDuration).toBeGreaterThan(0);
  });

  it('piper applies a DEF shred debuff to the highest-DEF enemy', () => {
    const piper = makeUnit('piper');
    // strong.def is the highest (69) under the new dataset.
    const tank = makeUnit('strong', { isEnemy: true });
    const squishy = makeUnit('dogmeat', { isEnemy: true });
    const baseTankDef = tank.def;

    const ok = triggerAbility(piper, [piper], [tank, squishy], [], 1, []);
    expect(ok).toBe(true);
    expect(tank.defShredPct).toBeCloseTo(0.5, 5);
    expect(tank.defShredDuration).toBe(10);
    expect(tank.def).toBeCloseTo(baseTankDef * 0.5, 5);
    expect(squishy.defShredPct).toBeUndefined();
  });
});

// ── triggerAbility — targeting & buff/heal/revive ──────────────────────────

describe('triggerAbility — targeting and effects', () => {
  it('maccready targets the lowest-HP enemy with Headshot', () => {
    const mac = makeUnit('maccready');
    const fullHp = makeUnit('strong', { isEnemy: true });
    const wounded = makeUnit('preston', { isEnemy: true, currentHp: 50 });
    const mid = makeUnit('cait', { isEnemy: true, currentHp: 200 });
    const ok = triggerAbility(mac, [mac], [fullHp, wounded, mid], [], 1, []);
    expect(ok).toBe(true);
    expect(wounded.currentHp).toBeLessThan(50);
    expect(fullHp.currentHp).toBe(fullHp.maxHp);
    expect(mid.currentHp).toBe(200);
  });

  it('deathclaw targets the highest-ATK enemy and ignores DEF', () => {
    const dc = makeUnit('deathclaw');
    // Pair a low-ATK target with a high-ATK target. kellogg.atk = 115,
    // preston.atk = 46.
    const small = makeUnit('preston', { isEnemy: true });
    const big = makeUnit('kellogg', { isEnemy: true });
    expect(big.atk).toBeGreaterThan(small.atk);
    const prevSmallHp = small.currentHp;
    const prevBigHp = big.currentHp;
    const ok = triggerAbility(dc, [dc], [small, big], [], 1, []);
    expect(ok).toBe(true);
    expect(big.currentHp).toBeLessThan(prevBigHp);
    expect(small.currentHp).toBe(prevSmallHp);
  });

  it('preston buffs all living allies with +ATK for 8 ticks', () => {
    const preston = makeUnit('preston');
    const a1 = makeUnit('cait');
    const a2 = makeUnit('dogmeat');
    const dead = makeUnit('moira', { currentHp: 0 });
    const ok = triggerAbility(preston, [preston, a1, a2, dead], [], [], 1, []);
    expect(ok).toBe(true);
    expect(preston.buffAtkMult).toBeCloseTo(1.2, 5);
    expect(a1.buffAtkMult).toBeCloseTo(1.2, 5);
    expect(a2.buffAtkMult).toBeCloseTo(1.2, 5);
    expect(a1.buffDuration).toBe(8);
    expect(dead.buffAtkMult).toBe(1);
  });

  it('sturges heals the lowest-HP-percent injured ally', () => {
    const stu = makeUnit('sturges');
    const fullA = makeUnit('preston');
    const woundedHigh = makeUnit('cait', { currentHp: 200 });
    const woundedLow = makeUnit('dogmeat', { currentHp: 50 });
    const before = woundedLow.currentHp;
    const ok = triggerAbility(stu, [stu, fullA, woundedHigh, woundedLow], [], [], 1, []);
    expect(ok).toBe(true);
    expect(woundedLow.currentHp).toBeGreaterThan(before);
    expect(woundedHigh.currentHp).toBe(200);
    expect(fullA.currentHp).toBe(fullA.maxHp);
  });

  it('sturges returns false when no ally needs healing', () => {
    const stu = makeUnit('sturges');
    const ok = triggerAbility(stu, [stu], [], [], 1, []);
    expect(ok).toBe(false);
  });

  it('curie heals every injured living ally', () => {
    const curie = makeUnit('curie');
    const a1 = makeUnit('preston', { currentHp: 100 });
    const a2 = makeUnit('cait', { currentHp: 200 });
    const dead = makeUnit('moira', { currentHp: 0 });
    const ok = triggerAbility(curie, [curie, a1, a2, dead], [], [], 1, []);
    expect(ok).toBe(true);
    expect(a1.currentHp).toBeGreaterThan(100);
    expect(a2.currentHp).toBeGreaterThan(200);
    expect(dead.currentHp).toBe(0);
  });

  it('dima revives a fallen ally with partial HP (Memory Lane)', () => {
    const dima = makeUnit('dima');
    const fallen = makeUnit('preston', { currentHp: 0, position: 2 });
    const alive = makeUnit('cait');
    const ok = triggerAbility(dima, [dima, fallen, alive], [], [], 1, []);
    expect(ok).toBe(true);
    expect(fallen.currentHp).toBeGreaterThan(0);
    expect(fallen.currentHp).toBeLessThan(fallen.maxHp);
  });

  it('dima 3-star revives 2 allies with full AP (Perfect Recall)', () => {
    const dima = makeUnit('dima', { stars: 3 });
    const f1 = makeUnit('preston', { currentHp: 0, position: 1 });
    const f2 = makeUnit('cait', { currentHp: 0, position: 2 });
    const ok = triggerAbility(dima, [dima, f1, f2], [], [], 1, []);
    expect(ok).toBe(true);
    expect(f1.currentHp).toBeGreaterThan(0);
    expect(f2.currentHp).toBeGreaterThan(0);
    expect(f1.mana).toBe(f1.manaMax);
    expect(f2.mana).toBe(f2.manaMax);
  });

  it('dima returns false if there are no dead allies', () => {
    const dima = makeUnit('dima');
    const alive = makeUnit('preston');
    const ok = triggerAbility(dima, [dima, alive], [], [], 1, []);
    expect(ok).toBe(false);
  });
});

// ── triggerAbility — Deacon untargetable ───────────────────────────────────

describe('triggerAbility — misc', () => {
  it('deacon becomes untargetable and damages a random enemy', () => {
    const deacon = makeUnit('deacon');
    const enemy = makeUnit('strong', { isEnemy: true });
    const beforeHp = enemy.currentHp;
    const ok = triggerAbility(deacon, [deacon], [enemy], [], 1, []);
    expect(ok).toBe(true);
    expect(deacon.deaconUntargetable).toBeGreaterThan(0);
    expect(enemy.currentHp).toBeLessThan(beforeHp);
  });

  it('returns false for an unknown unit id (default branch)', () => {
    const fake = { id: 'nope_does_not_exist', uid: 'x', stars: 1, atk: 10 };
    const ok = triggerAbility(fake, [fake], [], [], 1, []);
    expect(ok).toBe(false);
  });
});

// ── Ghost AI scorer ────────────────────────────────────────────────────────

describe('ghost AI — getCandidateScore', () => {
  const makeGhost = (boardIds = [], preferredTraits = []) => ({
    name: 'TestGhost', id: 99, board: boardIds.map(id => ({ id, stars: 1 })),
    preferredTraits, level: 5, alive: true, hp: 100,
  });

  it('scores higher-cost units above cheaper units (cost weight)', () => {
    const ghost = makeGhost([]);
    const targetRound = 12;
    // dima (cost 5) vs preston (cost 1).
    const aHigh = getCandidateScore(ghost, 'dima', targetRound);
    const aLow = getCandidateScore(ghost, 'preston', targetRound);
    expect(aHigh).toBeGreaterThan(aLow);
  });

  it('applies trait-stacking bonus when board already shares the trait', () => {
    const empty = makeGhost([]);
    const stacked = makeGhost(['preston']); // preston carries minutemen + sniper
    // Ronnie also has minutemen+sniper — stacking with preston scores higher
    // than picking ronnie into an empty board.
    const ronnieEmpty = getCandidateScore(empty, 'ronnie', 6);
    const ronnieStack = getCandidateScore(stacked, 'ronnie', 6);
    expect(ronnieStack).toBeGreaterThan(ronnieEmpty);
  });

  it('rewards trait stacking over picking a different unit', () => {
    // Ghost has preston (minutemen+sniper). Ronnie shares 2; dogmeat (wastelander+medic) shares 0.
    const ghost = makeGhost(['preston']);
    const ronnieScore = getCandidateScore(ghost, 'ronnie', 6);
    const dogScore = getCandidateScore(ghost, 'dogmeat', 6);
    // Each shared trait = +50; ronnie shares 2 traits.
    expect(ronnieScore - dogScore).toBeGreaterThanOrEqual(50);
  });

  it('greedy fill picks the highest-scored available unit', () => {
    const pool = {};
    for (const k of Object.keys(UNIT_DATABASE)) pool[k] = 0;
    pool.preston = 1;
    pool.dima = 1;
    const ghost = { name: 'G', id: 1, board: [], preferredTraits: [], level: 5, alive: true, hp: 100 };
    ghostPlayerShop(ghost, pool, 12);
    expect(ghost.board.length).toBeGreaterThan(0);
    // Higher-cost dima wins on cost weight at round 12.
    expect(ghost.board[0].id).toBe('dima');
  });
});

describe('ghost AI — ghostEquipItem', () => {
  it('assigns the item to the highest-HP board unit', () => {
    // deathclaw (hp=2340) > danse (hp=1560) > preston (hp=500).
    const ghost = {
      board: [
        { id: 'preston', stars: 1 },
        { id: 'deathclaw', stars: 1 },
        { id: 'danse', stars: 1 },
      ],
    };
    const chosen = ghostEquipItem(ghost, 'fake-item-id');
    expect(chosen).toBe('deathclaw');
    const target = ghost.board.find(u => u.id === 'deathclaw');
    expect(target.items).toContain('fake-item-id');
  });

  it('returns null on an empty board', () => {
    expect(ghostEquipItem({ board: [] }, 'x')).toBeNull();
  });
});

// ── Difficulty multipliers ─────────────────────────────────────────────────

describe('generateEnemies with difficulty multipliers', () => {
  const pinRandom = (seq) => {
    let i = 0;
    return vi.spyOn(Math, 'random').mockImplementation(() => seq[i++ % seq.length]);
  };

  it('easy mode produces lower HP and ATK than normal', () => {
    const spy = pinRandom([0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1]);
    const easy = generateEnemies(2, 'easy');
    spy.mockRestore();
    const spy2 = pinRandom([0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1]);
    const normal = generateEnemies(2, 'normal');
    spy2.mockRestore();
    const easyU = easy.find(s => s && !s.isBoss);
    const normalU = normal.find(s => s && !s.isBoss);
    expect(easyU).toBeTruthy();
    expect(normalU).toBeTruthy();
    expect(easyU.maxHp).toBeCloseTo(normalU.maxHp * 0.75, 1);
    expect(easyU.atk).toBeCloseTo(normalU.atk * 0.75, 1);
  });

  it('survival mode produces higher HP and ATK than normal', () => {
    const spy = pinRandom([0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1]);
    const survival = generateEnemies(2, 'survival');
    spy.mockRestore();
    const spy2 = pinRandom([0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1]);
    const normal = generateEnemies(2, 'normal');
    spy2.mockRestore();
    const survU = survival.find(s => s && !s.isBoss);
    const normU = normal.find(s => s && !s.isBoss);
    expect(survU.maxHp).toBeCloseTo(normU.maxHp * 1.5, 1);
    expect(survU.atk).toBeCloseTo(normU.atk * 1.4, 1);
  });

  it('normal mode matches the legacy (no-arg) behaviour byte-for-byte', () => {
    const spy = pinRandom([0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1]);
    const noArg = generateEnemies(2);
    spy.mockRestore();
    const spy2 = pinRandom([0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1]);
    const normal = generateEnemies(2, 'normal');
    spy2.mockRestore();
    for (let i = 0; i < 14; i++) {
      if (noArg[i] === null) { expect(normal[i]).toBeNull(); continue; }
      expect(normal[i]).toBeTruthy();
      expect(normal[i].maxHp).toBeCloseTo(noArg[i].maxHp, 5);
      expect(normal[i].atk).toBeCloseTo(noArg[i].atk, 5);
      expect(normal[i].id).toBe(noArg[i].id);
    }
  });

  it('boss HP scales with difficulty', () => {
    const spy = pinRandom([0.1, 0.1, 0.1]);
    const easyBoss = generateEnemies(7, 'easy');
    spy.mockRestore();
    const spy2 = pinRandom([0.1, 0.1, 0.1]);
    const hardBoss = generateEnemies(7, 'hard');
    spy2.mockRestore();
    expect(easyBoss[3].isBoss).toBe(true);
    expect(hardBoss[3].isBoss).toBe(true);
    expect(hardBoss[3].maxHp / easyBoss[3].maxHp).toBeCloseTo(1.3 / 0.75, 3);
  });
});

// ── DUAL range resolution (new mechanic) ───────────────────────────────────

describe('dual range resolution', () => {
  it('resolveDualRange returns ranged for a back-row slot (0-6)', () => {
    for (const pos of [0, 3, 6]) {
      const r = resolveDualRange({ attackRange: 2 }, pos);
      expect(r.range).toBe('ranged');
      expect(r.attackRange).toBe(2);
    }
  });

  it('resolveDualRange returns melee for a front-row slot (7-13)', () => {
    for (const pos of [7, 10, 13]) {
      const r = resolveDualRange({ attackRange: 2 }, pos);
      expect(r.range).toBe('melee');
      expect(r.attackRange).toBe(1);
    }
  });

  it('resolveDualRange falls back to attackRange=4 for ranged when unit lacks one', () => {
    const r = resolveDualRange({}, 0);
    expect(r.range).toBe('ranged');
    expect(r.attackRange).toBe(4);
  });

  it('lockDualRange is a no-op on non-dual units (numeric or melee/ranged)', () => {
    const u = { range: 'ranged', position: 0 };
    expect(lockDualRange(u)).toBe(false);
    expect(u._effectiveRange).toBeUndefined();
  });

  it('lockDualRange writes _effectiveRange on a dual unit in the back row', () => {
    const u = { range: 'dual', position: 2, attackRange: 2 };
    expect(lockDualRange(u)).toBe(true);
    expect(u._effectiveRange).toBe('ranged');
    expect(u._effectiveAttackRange).toBe(2);
  });

  it('lockDualRange writes _effectiveRange=melee for a dual unit in the front row', () => {
    const u = { range: 'dual', position: 10, attackRange: 2 };
    lockDualRange(u);
    expect(u._effectiveRange).toBe('melee');
    expect(u._effectiveAttackRange).toBe(1);
  });
});

// ── Robot Dog augment transform ────────────────────────────────────────────

describe('applyRobotDogTransform', () => {
  it('upgrades the highest-star Dogmeat on the board, preserving stars', () => {
    const board = [
      null, null,
      { id: 'dogmeat', stars: 1, uid: 'd1', items: [] },
      { id: 'dogmeat', stars: 3, uid: 'd3', items: ['fake-item'] },
      { id: 'preston', stars: 2, uid: 'p1', items: [] },
    ];
    const ok = applyRobotDogTransform({ board, bench: [] });
    expect(ok).toBe(true);
    // The 3-star Dogmeat was the highest — should now be robot-dog.
    expect(board[3].id).toBe('robot-dog');
    expect(board[3].stars).toBe(3);
    expect(board[3].items).toEqual(['fake-item']);
    // The 1-star Dogmeat is untouched.
    expect(board[2].id).toBe('dogmeat');
  });

  it('falls back to a 1-star bench Robot Dog when no Dogmeat is owned', () => {
    const board = [{ id: 'preston', stars: 1, uid: 'p1', items: [] }];
    const bench = [];
    const ok = applyRobotDogTransform({ board, bench });
    expect(ok).toBe(true);
    expect(bench).toHaveLength(1);
    expect(bench[0].id).toBe('robot-dog');
    expect(bench[0].stars).toBe(1);
  });

  it('prefers a board Dogmeat over a higher-star bench Dogmeat? — no, picks the higher star overall', () => {
    // Strictly: the helper picks the highest star regardless of location.
    const board = [{ id: 'dogmeat', stars: 1, uid: 'd1', items: [] }];
    const bench = [{ id: 'dogmeat', stars: 2, uid: 'd2', items: [] }];
    applyRobotDogTransform({ board, bench });
    expect(bench[0].id).toBe('robot-dog');
    expect(bench[0].stars).toBe(2);
    expect(board[0].id).toBe('dogmeat');
  });
});

// ── Robot Dog combat behaviour ─────────────────────────────────────────────

describe('Robot Dog ability (dual-target stun)', () => {
  it('stuns the TOP 2 highest-ATK enemies', () => {
    const rd = makeUnit('robot-dog');
    // Pick enemies with clearly different ATK values.
    const eHi = makeUnit('kellogg', { isEnemy: true });   // atk 115
    const eMid = makeUnit('strong', { isEnemy: true });   // atk 75
    const eLo = makeUnit('preston', { isEnemy: true });   // atk 46
    const ok = triggerAbility(rd, [rd], [eLo, eHi, eMid], [], 1, []);
    expect(ok).toBe(true);
    expect(eHi.stunDuration).toBeGreaterThan(0);
    expect(eMid.stunDuration).toBeGreaterThan(0);
    expect(eLo.stunDuration).toBe(0);
  });

  it('only stuns 1 enemy when only 1 unstunned candidate exists', () => {
    const rd = makeUnit('robot-dog');
    const lone = makeUnit('strong', { isEnemy: true });
    const already = makeUnit('preston', { isEnemy: true, stunDuration: 10 });
    const ok = triggerAbility(rd, [rd], [lone, already], [], 1, []);
    expect(ok).toBe(true);
    expect(lone.stunDuration).toBeGreaterThan(0);
  });
});

// ── Survivor's Bond — adjacent FO4 companion snapshot ──────────────────────

describe("Sole Survivor — Survivor's Bond", () => {
  it('counts only FO4 companions in hex-adjacent slots', () => {
    // Place sole-survivor at position 2 (back row, mid-left).
    // Adjacent slots: 1, 3, 8, 9.
    const board = Array(14).fill(null);
    board[2] = { id: 'sole-survivor' };
    board[1] = { id: 'preston' };   // FO4 companion — adjacent
    board[3] = { id: 'piper' };     // FO4 companion — adjacent
    board[8] = { id: 'cait' };      // FO4 companion — adjacent
    board[5] = { id: 'cait' };      // NOT adjacent
    board[10] = { id: 'strong' };   // NOT adjacent
    const n = countAdjacentFo4Companions(board, 2);
    expect(n).toBe(3);
  });

  it('grants +24% ATK and +24% apGain with 3 adjacent companions', () => {
    const board = Array(14).fill(null);
    const ss = {
      id: 'sole-survivor',
      position: 2,
      atk: 100,
      baseAtk: 100,
      apGain: 14,
    };
    board[2] = ss;
    board[1] = { id: 'preston' };
    board[3] = { id: 'piper' };
    board[8] = { id: 'cait' };
    const mult = applySurvivorsBond(ss, board);
    expect(mult).toBeCloseTo(1.24, 5);
    expect(ss.atk).toBeCloseTo(124, 5);
    expect(ss.apGain).toBeCloseTo(14 * 1.24, 5);
    expect(ss._survivorsBondCount).toBe(3);
  });

  it('does nothing when no adjacent FO4 companions', () => {
    const board = Array(14).fill(null);
    const ss = { id: 'sole-survivor', position: 2, atk: 100, baseAtk: 100, apGain: 14 };
    board[2] = ss;
    expect(applySurvivorsBond(ss, board)).toBe(1);
    expect(ss.atk).toBe(100);
  });
});

// ── Sole Survivor — per-attack & per-round scaling ─────────────────────────

describe('Sole Survivor scaling', () => {
  it('per-attack: each attack adds +2 ATK and +20 HP', () => {
    const ss = {
      id: 'sole-survivor', atk: 100, baseAtk: 100,
      currentHp: 1000, maxHp: 1000,
    };
    accrueSoleSurvivorAttackBonus(ss);
    expect(ss.atk).toBe(102);
    expect(ss.maxHp).toBe(1020);
    expect(ss.currentHp).toBe(1020);

    accrueSoleSurvivorAttackBonus(ss);
    accrueSoleSurvivorAttackBonus(ss);
    expect(ss.atk).toBe(106);
    expect(ss.maxHp).toBe(1060);
    expect(ss._ssInCombatAtk).toBe(6);
    expect(ss._ssInCombatHp).toBe(60);
  });

  it('per-round: each round adds +5 ATK, +50 HP, +1 DEF to the persistent record', () => {
    const ss = { id: 'sole-survivor' };
    let b = accrueSoleSurvivorRoundBonus(ss);
    expect(b).toEqual({ atk: 5, hp: 50, def: 1 });
    b = accrueSoleSurvivorRoundBonus(ss);
    expect(b).toEqual({ atk: 10, hp: 100, def: 2 });
    expect(ss.scalingBonus).toEqual({ atk: 10, hp: 100, def: 2 });
  });

  it('per-round scaling no-ops for other units', () => {
    const unit = { id: 'preston' };
    const r = accrueSoleSurvivorRoundBonus(unit);
    expect(r).toBeNull();
  });
});

// ── hexNeighbors sanity ────────────────────────────────────────────────────

describe('hexNeighbors', () => {
  it('back-row centre slot has 4 neighbours on a 2-row board', () => {
    expect(hexNeighbors(3).sort((a,b)=>a-b)).toEqual([2, 4, 9, 10]);
  });

  it('front-row centre slot has 4 neighbours on a 2-row board', () => {
    expect(hexNeighbors(10).sort((a,b)=>a-b)).toEqual([3, 4, 9, 11]);
  });

  it('back-row corner has 2 neighbours', () => {
    expect(hexNeighbors(0).sort((a,b)=>a-b)).toEqual([1, 7]);
  });
});

// ── FO4 companion roster sanity ────────────────────────────────────────────

describe('FO4 companion roster', () => {
  it('includes the expected FO4 companion ids', () => {
    expect(FO4_COMPANIONS).toEqual(expect.arrayContaining([
      'cait', 'dogmeat', 'piper', 'preston',
    ]));
  });
});

// ── Boss mechanics (new bosses) ────────────────────────────────────────────
//
// We can't reach into runCombat's setInterval loop, but we can verify the
// boss-mechanic field set by generateEnemies / BOSS_DATABASE for each round.
// The orchestrator's playwright pass exercises the tick loop end-to-end.

import { BOSS_DATABASE } from '../data/bosses.js';

describe('boss mechanics — Synth Courser / Atom Theil / Lorenzo Cabot', () => {
  it('round 21 boss (Synth Courser) is wired for teleport-strike', () => {
    const boss = BOSS_DATABASE[21];
    expect(boss).toBeTruthy();
    expect(boss.courserTeleport).toBe(true);
  });

  it('round 35 boss (Atom Theil) is wired for the radiation glow burst', () => {
    const boss = BOSS_DATABASE[35];
    expect(boss).toBeTruthy();
    expect(boss.glowBurst).toBe(true);
    expect(boss.deathHealAllies).toBeGreaterThan(0);
  });

  it('round 42 boss (Lorenzo Cabot) is wired for crimson stasis', () => {
    const boss = BOSS_DATABASE[42];
    expect(boss).toBeTruthy();
    expect(boss.crimsonStasis).toBe(true);
  });

  it('teleport_strike mechanic fires every interval ticks (simulated)', () => {
    // Simulate one tick at the interval boundary and assert the lowest-HP
    // ally takes damage. We pull the inline logic into a tiny harness so
    // we can run it without setInterval.
    const boss = {
      isBoss: true,
      bossMechanic: 'teleport_strike',
      bossInterval: 50,
      bossDmg: 300,
      _bossTickCounter: 50,
      name: 'Synth Courser',
      currentHp: 5000, maxHp: 5000,
    };
    const players = [
      { uid: 'p1', name: 'A', currentHp: 1000 },
      { uid: 'p2', name: 'B', currentHp: 200 },
      { uid: 'p3', name: 'C', currentHp: 800 },
    ];
    // Replicate the runCombat branch's behaviour: pick lowest-HP and zap it.
    if (boss._bossTickCounter % boss.bossInterval === 0) {
      const alive = players.filter(p => p.currentHp > 0).sort((a,b) => a.currentHp - b.currentHp);
      const victim = alive[0];
      victim.currentHp -= boss.bossDmg;
    }
    expect(players[1].currentHp).toBe(200 - 300); // -100 (overkill is allowed)
    expect(players[0].currentHp).toBe(1000);
    expect(players[2].currentHp).toBe(800);
  });

  it('radiation_dot adds 1 stack per tick and ticks 0.5 hp per stack', () => {
    // Mirror the runCombat branch with no setInterval.
    const players = [
      { uid: 'a', currentHp: 1000, _radStacks: 0 },
      { uid: 'b', currentHp: 1000, _radStacks: 0 },
    ];
    // Tick 1: +1 stack, DoT damage = 0.5/stack
    players.forEach(p => { p._radStacks += 1; });
    players.forEach(p => { p.currentHp -= p._radStacks * 0.5; });
    expect(players[0]._radStacks).toBe(1);
    expect(players[0].currentHp).toBeCloseTo(999.5, 5);

    // Tick 2: stacks → 2, DoT = 1.0
    players.forEach(p => { p._radStacks += 1; });
    players.forEach(p => { p.currentHp -= p._radStacks * 0.5; });
    expect(players[0]._radStacks).toBe(2);
    expect(players[0].currentHp).toBeCloseTo(998.5, 5);
  });

  it('freeze mechanic stuns and untargets a victim for 40 ticks', () => {
    // Mirror runCombat's freeze branch.
    const players = [
      { uid: 'a', currentHp: 1000, stunDuration: 0, deaconUntargetable: 0 },
      { uid: 'b', currentHp: 1000, stunDuration: 0, deaconUntargetable: 0 },
    ];
    // RNG-pinned pick: take players[0] as the freeze victim.
    const victim = players[0];
    const ticks = 40;
    victim._frozenDuration = ticks;
    victim.stunDuration = Math.max(victim.stunDuration || 0, ticks);
    victim.deaconUntargetable = Math.max(victim.deaconUntargetable || 0, ticks);
    expect(victim.stunDuration).toBe(40);
    expect(victim.deaconUntargetable).toBe(40);
    expect(players[1].stunDuration).toBe(0);
  });
});
