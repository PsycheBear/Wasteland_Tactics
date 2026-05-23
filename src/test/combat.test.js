// Combat system tests.
//
// Scope: the pure / mostly-pure exports from src/systems/combat.js.
//   - getActiveSynergies (pure, no DOM)
//   - generateEnemies   (no DOM, but uses Math.random — we stub)
//   - triggerAbility    (mutates units; touches document.querySelector + sound,
//                        both of which are safe under jsdom — querySelector
//                        returns null for unknown UIDs and the sound layer
//                        swallows AudioContext errors.)
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
    // Preston alone gives Minutemen=1 + Support=1, neither hits the >=2 floor.
    const board = [makeBoardSlot('preston'), null, null];
    const synergies = getActiveSynergies(board);
    expect(synergies).toEqual([]);
  });

  it('activates a trait when 2 unique units share it (tier 1)', () => {
    // Preston (Minutemen, Support) + Piper (Minutemen, Support) -> count=2 for both.
    const board = [makeBoardSlot('preston'), makeBoardSlot('piper')];
    const synergies = getActiveSynergies(board);
    const traits = synergies.map(s => s.trait).sort();
    expect(traits).toEqual(['Minutemen', 'Support']);
    const minutemen = synergies.find(s => s.trait === 'Minutemen');
    expect(minutemen.count).toBe(2);
    // The TIER bonuses come from the trait config — they only kick in at 2/3.
    expect(minutemen.effect(2).hpMult).toBe(1.2);
    expect(minutemen.effect(3).hpMult).toBe(1.4);
  });

  it('counts only unique unit ids — duplicates of one unit count once', () => {
    // Three preston copies still = 1 unique Minutemen unit.
    const board = [
      makeBoardSlot('preston'),
      makeBoardSlot('preston', 2),
      makeBoardSlot('preston', 3),
    ];
    expect(getActiveSynergies(board)).toEqual([]);
  });

  it('reaches tier 3 when 3 unique units share a trait', () => {
    // Preston, Piper, MacCready all carry Minutemen.
    const board = [
      makeBoardSlot('preston'),
      makeBoardSlot('piper'),
      makeBoardSlot('maccready'),
    ];
    const minutemen = getActiveSynergies(board).find(s => s.trait === 'Minutemen');
    expect(minutemen.count).toBe(3);
    expect(minutemen.effect(3).hpMult).toBe(1.4);
    expect(minutemen.effect(3).defAdd).toBe(15);
  });
});

// ── generateEnemies ────────────────────────────────────────────────────────

describe('generateEnemies', () => {
  it('returns a 14-slot board', () => {
    const slots = generateEnemies(1);
    expect(slots).toHaveLength(14);
  });

  it('uses cost-1 units only on round 1', () => {
    // Run several times because of Math.random.
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

  it('produces a boss slot at round 21 with enrage mechanic', () => {
    const slots = generateEnemies(21);
    expect(slots[3].isBoss).toBe(true);
    expect(slots[3].bossMechanic).toBe('enrage');
    expect(slots[3].bossEnrageThreshold).toBe(0.5);
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

    // Force RNG so we know which two enemies get hit, but we just check counts.
    const ok = triggerAbility(moira, [moira], [enemyA, enemyB, enemyC], logs, 1, abilityUnits);
    expect(ok).toBe(true);

    const poisoned = [enemyA, enemyB, enemyC].filter(e => e.poisonTicks > 0);
    expect(poisoned).toHaveLength(2);
    for (const t of poisoned) {
      expect(t.poisonTicks).toBe(8);
      expect(t.poisonDmg).toBeGreaterThan(0); // 80 dmg / 8 ticks = 10 per tick
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
      // Also took the immediate hit (100 base dmg) — currentHp dropped.
      expect(t.currentHp).toBeLessThan(t.maxHp);
    }
  });

  it('dogmeat stuns the highest-ATK enemy', () => {
    const dog = makeUnit('dogmeat');
    const weak = makeUnit('preston', { isEnemy: true });
    const strong = makeUnit('strong', { isEnemy: true }); // strong.atk = 78
    const mid = makeUnit('cait', { isEnemy: true }); // cait.atk = 58
    expect(strong.atk).toBeGreaterThan(weak.atk);
    expect(strong.atk).toBeGreaterThan(mid.atk);

    const ok = triggerAbility(dog, [dog], [weak, strong, mid], [], 1, []);
    expect(ok).toBe(true);
    expect(strong.stunDuration).toBeGreaterThan(0);
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
    const tank = makeUnit('danse', { isEnemy: true });   // def 35
    const squishy = makeUnit('dogmeat', { isEnemy: true }); // def 15
    const baseTankDef = tank.def;

    const ok = triggerAbility(piper, [piper], [tank, squishy], [], 1, []);
    expect(ok).toBe(true);
    expect(tank.defShredPct).toBeCloseTo(0.5, 5);
    expect(tank.defShredDuration).toBe(10);
    expect(tank.def).toBeCloseTo(baseTankDef * 0.5, 5);
    expect(squishy.defShredPct).toBeUndefined();
  });

  it('marcy debuffs an enemy with a negative buffAtkMult', () => {
    const marcy = makeUnit('marcy');
    const target = makeUnit('strong', { isEnemy: true });
    const ok = triggerAbility(marcy, [marcy], [target], [], 1, []);
    expect(ok).toBe(true);
    expect(target.buffAtkMult).toBeCloseTo(0.75, 5);
    expect(target.buffDuration).toBe(8);
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
    // Wounded should have taken the 4x ATK execute hit.
    expect(wounded.currentHp).toBeLessThan(50);
    expect(fullHp.currentHp).toBe(fullHp.maxHp);
    expect(mid.currentHp).toBe(200);
  });

  it('deathclaw targets the highest-ATK enemy and ignores DEF', () => {
    const dc = makeUnit('deathclaw');
    const tank = makeUnit('danse', { isEnemy: true });   // atk 72
    const carry = makeUnit('strong', { isEnemy: true }); // atk 78
    const prevTankHp = tank.currentHp;
    const prevCarryHp = carry.currentHp;
    const ok = triggerAbility(dc, [dc], [tank, carry], [], 1, []);
    expect(ok).toBe(true);
    expect(carry.currentHp).toBeLessThan(prevCarryHp);
    expect(tank.currentHp).toBe(prevTankHp);
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
    expect(dead.buffAtkMult).toBe(1); // dead allies not buffed
  });

  it('sturges heals the lowest-HP-percent injured ally', () => {
    const stu = makeUnit('sturges');
    const fullA = makeUnit('preston');
    const woundedHigh = makeUnit('cait', { currentHp: 200 }); // out of 540
    const woundedLow = makeUnit('dogmeat', { currentHp: 50 }); // out of 350
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

// ── triggerAbility — Deacon untargetable & damage AoE ──────────────────────

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

  it('liberty Prime nukes all living enemies', () => {
    const lib = makeUnit('liberty');
    const e1 = makeUnit('preston', { isEnemy: true });
    const e2 = makeUnit('cait', { isEnemy: true });
    const e3 = makeUnit('moira', { isEnemy: true, currentHp: 0 });
    const ok = triggerAbility(lib, [lib], [e1, e2, e3], [], 1, []);
    expect(ok).toBe(true);
    expect(e1.currentHp).toBeLessThan(e1.maxHp);
    expect(e2.currentHp).toBeLessThan(e2.maxHp);
    expect(e3.currentHp).toBe(0); // dead enemies untouched
  });

  it('wiseman debuffs all living enemy ATK', () => {
    const wm = makeUnit('wiseman');
    const e1 = makeUnit('strong', { isEnemy: true });
    const e2 = makeUnit('cait', { isEnemy: true });
    const ok = triggerAbility(wm, [wm], [e1, e2], [], 1, []);
    expect(ok).toBe(true);
    expect(e1.buffAtkMult).toBeCloseTo(0.8, 5);
    expect(e2.buffAtkMult).toBeCloseTo(0.8, 5);
    expect(e1.buffDuration).toBe(8);
  });

  it('returns false for an unknown unit id (default branch)', () => {
    const fake = { id: 'nope_does_not_exist', uid: 'x', stars: 1, atk: 10 };
    const ok = triggerAbility(fake, [fake], [], [], 1, []);
    expect(ok).toBe(false);
  });
});

// ── Ghost AI scorer (Wave 3) ───────────────────────────────────────────────

describe('ghost AI — getCandidateScore', () => {
  const makeGhost = (boardIds = [], preferredTraits = []) => ({
    name: 'TestGhost', id: 99, board: boardIds.map(id => ({ id, stars: 1 })),
    preferredTraits, level: 5, alive: true, hp: 100,
  });

  it('scores higher-cost units above cheaper units (cost weight)', () => {
    const ghost = makeGhost([]);
    // Compare a 5-cost (deathclaw / liberty) to a 1-cost (preston) at the
    // same target round. Both have zero trait stack, so the cost term wins.
    const targetRound = 12;
    const aHigh = getCandidateScore(ghost, 'liberty', targetRound);
    const aLow = getCandidateScore(ghost, 'preston', targetRound);
    expect(aHigh).toBeGreaterThan(aLow);
  });

  it('applies trait-stacking bonus when board already shares the trait', () => {
    const empty = makeGhost([]);
    const stacked = makeGhost(['preston']); // preston carries Minutemen
    // Piper also has Minutemen — stacking with preston should score higher
    // than picking piper into an empty board.
    const piperEmpty = getCandidateScore(empty, 'piper', 6);
    const piperStack = getCandidateScore(stacked, 'piper', 6);
    expect(piperStack).toBeGreaterThan(piperEmpty);
  });

  it('rewards a 2-piece breakpoint by stacking over picking a different cost-equivalent unit', () => {
    // Ghost has preston (Minutemen+Support). Score piper (Minutemen+Support)
    // vs. e.g. dogmeat (Scout, no overlap) at the same round.
    const ghost = makeGhost(['preston']);
    const piperScore = getCandidateScore(ghost, 'piper', 6);
    const dogScore = getCandidateScore(ghost, 'dogmeat', 6);
    // Piper shares 2 traits with preston (each gives +50). Dog shares 0.
    expect(piperScore - dogScore).toBeGreaterThanOrEqual(50);
  });

  it('greedy fill picks the highest-scored available unit', () => {
    // Build a pool where only two units are stocked; ensure the higher-scored
    // one is bought first.
    const pool = {};
    for (const k of Object.keys(UNIT_DATABASE)) pool[k] = 0;
    pool.preston = 1;
    pool.liberty = 1;
    const ghost = { name: 'G', id: 1, board: [], preferredTraits: [], level: 5, alive: true, hp: 100 };
    ghostPlayerShop(ghost, pool, 12);
    expect(ghost.board.length).toBeGreaterThan(0);
    // Higher-cost liberty wins on cost weight at round 12.
    expect(ghost.board[0].id).toBe('liberty');
  });
});

describe('ghost AI — ghostEquipItem', () => {
  it('assigns the item to the highest-HP board unit', () => {
    // strong (hp=900) > danse (hp=720) > preston (hp=480)
    const ghost = {
      board: [
        { id: 'preston', stars: 1 },
        { id: 'strong', stars: 1 },
        { id: 'danse', stars: 1 },
      ],
    };
    const chosen = ghostEquipItem(ghost, 'fake-item-id');
    expect(chosen).toBe('strong');
    const target = ghost.board.find(u => u.id === 'strong');
    expect(target.items).toContain('fake-item-id');
  });

  it('returns null on an empty board', () => {
    expect(ghostEquipItem({ board: [] }, 'x')).toBeNull();
  });
});

// ── Difficulty multipliers (Wave 3) ────────────────────────────────────────

describe('generateEnemies with difficulty multipliers', () => {
  // We can't pick a unit deterministically without seeding Math.random, but we
  // CAN compare the same round produced under different difficulty IDs by
  // pinning Math.random to a known sequence.
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
    // Behaviour parity guard. Pin RNG and confirm that calling with default
    // (no difficulty) and with 'normal' produce identical stats.
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
    // hard / easy = 1.3 / 0.75
    expect(hardBoss[3].maxHp / easyBoss[3].maxHp).toBeCloseTo(1.3 / 0.75, 3);
  });
});
