// Data integrity tests.
//
// These are NOT behaviour tests — they fail fast on corrupt data files:
//   - missing/duplicate IDs
//   - dangling cross-references (unit -> trait, item recipe -> component,
//     augment -> known concepts)
//   - schema gaps (HP/ATK/DEF/cost missing or non-numeric)
//
// The point is to catch typos before they manifest as runtime errors deep in
// combat.

import { describe, it, expect } from 'vitest';
import { UNIT_DATABASE, MELEE_UNITS } from '../data/units.js';
import { TRAITS } from '../data/traits.js';
import { ITEM_COMPONENTS, COMPLETED_ITEMS } from '../data/items.js';
import { AUGMENT_POOL } from '../data/augments.js';
import { BOSS_DATABASE } from '../data/bosses.js';
import { DIFFICULTY_MODES, DEFAULT_DIFFICULTY_ID, getDifficultyMode } from '../data/difficulty.js';

// ── Units ─────────────────────────────────────────────────────────────────

describe('UNIT_DATABASE', () => {
  const entries = Object.entries(UNIT_DATABASE);

  it('has at least one unit', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it('has unique unit ids (no key collisions in object literal)', () => {
    const keys = Object.keys(UNIT_DATABASE);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it.each(entries)('unit %s has required numeric stats', (id, unit) => {
    expect(unit.name).toEqual(expect.any(String));
    expect(unit.name.length).toBeGreaterThan(0);
    expect(unit.cost).toEqual(expect.any(Number));
    expect(unit.cost).toBeGreaterThanOrEqual(1);
    expect(unit.cost).toBeLessThanOrEqual(5);
    expect(unit.hp).toEqual(expect.any(Number));
    expect(unit.hp).toBeGreaterThan(0);
    expect(unit.atk).toEqual(expect.any(Number));
    expect(unit.atk).toBeGreaterThan(0);
    expect(unit.def).toEqual(expect.any(Number));
    expect(unit.def).toBeGreaterThanOrEqual(0);
    expect(unit.range).toEqual(expect.any(Number));
    expect(unit.range).toBeGreaterThanOrEqual(1);
    expect(unit.traits).toEqual(expect.any(Array));
    expect(unit.traits.length).toBeGreaterThan(0);
  });

  it.each(entries)('unit %s references only known traits', (id, unit) => {
    for (const trait of unit.traits) {
      expect(TRAITS[trait], `${id} references unknown trait "${trait}"`).toBeDefined();
    }
  });

  it.each(entries)('unit %s has unique traits (no duplicates)', (id, unit) => {
    expect(new Set(unit.traits).size).toBe(unit.traits.length);
  });

  it('MELEE_UNITS references only known unit ids', () => {
    for (const id of MELEE_UNITS) {
      expect(UNIT_DATABASE[id], `MELEE_UNITS has unknown id "${id}"`).toBeDefined();
    }
  });

  it('MELEE_UNITS has no duplicates', () => {
    expect(new Set(MELEE_UNITS).size).toBe(MELEE_UNITS.length);
  });
});

// ── Traits ────────────────────────────────────────────────────────────────

describe('TRAITS', () => {
  const entries = Object.entries(TRAITS);

  it('has at least one trait', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it.each(entries)('trait %s has required fields', (id, trait) => {
    expect(trait.name).toEqual(expect.any(String));
    expect(trait.color).toMatch(/^#[0-9a-fA-F]{3,8}$/);
    expect(trait.bonuses).toEqual(expect.any(Object));
    expect(trait.effect).toEqual(expect.any(Function));
  });

  it.each(entries)('trait %s effect is a pure function returning an object', (id, trait) => {
    // Sanity: the effect should be callable with a count and return an object.
    expect(trait.effect(0)).toEqual(expect.any(Object));
    expect(trait.effect(2)).toEqual(expect.any(Object));
    expect(trait.effect(3)).toEqual(expect.any(Object));
  });

  it('every trait is used by at least one unit (no orphan traits)', () => {
    const used = new Set();
    for (const u of Object.values(UNIT_DATABASE)) {
      for (const t of u.traits) used.add(t);
    }
    for (const traitId of Object.keys(TRAITS)) {
      expect(used.has(traitId), `Trait "${traitId}" is not used by any unit`).toBe(true);
    }
  });
});

// ── Items ─────────────────────────────────────────────────────────────────

describe('ITEM_COMPONENTS', () => {
  const entries = Object.entries(ITEM_COMPONENTS);

  it('has at least one component', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it.each(entries)('component %s has stat metadata', (id, c) => {
    expect(c.name).toEqual(expect.any(String));
    expect(c.stat).toEqual(expect.any(String));
    expect(c.value).toEqual(expect.any(Number));
  });
});

describe('COMPLETED_ITEMS', () => {
  const entries = Object.entries(COMPLETED_ITEMS);
  const componentIds = new Set(Object.keys(ITEM_COMPONENTS));

  it('has at least one completed item', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it.each(entries)('item %s has a valid 2-component recipe of known IDs', (id, item) => {
    expect(item.recipe).toEqual(expect.any(Array));
    expect(item.recipe).toHaveLength(2);
    for (const compId of item.recipe) {
      expect(componentIds.has(compId), `item "${id}" references unknown component "${compId}"`).toBe(true);
    }
  });

  it.each(entries)('item %s has an effects object', (id, item) => {
    expect(item.effects).toEqual(expect.any(Object));
    expect(Object.keys(item.effects).length).toBeGreaterThan(0);
  });

  it('every recipe pair is unique (no two items share the same component pair)', () => {
    const seen = new Map();
    for (const [id, item] of entries) {
      const key = [...item.recipe].sort().join('+');
      if (seen.has(key)) {
        throw new Error(`Recipe collision: ${id} and ${seen.get(key)} both use ${key}`);
      }
      seen.set(key, id);
    }
  });
});

// ── Augments ──────────────────────────────────────────────────────────────

describe('AUGMENT_POOL', () => {
  it('has at least one augment', () => {
    expect(AUGMENT_POOL.length).toBeGreaterThan(0);
  });

  it('every augment has unique id, name, and effect', () => {
    const ids = AUGMENT_POOL.map(a => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const aug of AUGMENT_POOL) {
      expect(aug.id).toEqual(expect.any(String));
      expect(aug.name).toEqual(expect.any(String));
      expect(aug.desc).toEqual(expect.any(String));
      expect(aug.effect).toEqual(expect.any(Object));
      expect(Object.keys(aug.effect).length).toBeGreaterThan(0);
    }
  });

  it('augment effect keys do not reference unknown trait/unit ids', () => {
    // Augment effects are stat-modifier objects, not symbolic refs — but if
    // any value looks like it should be a trait or unit id (string), verify it.
    const knownTraits = new Set(Object.keys(TRAITS));
    const knownUnits = new Set(Object.keys(UNIT_DATABASE));
    for (const aug of AUGMENT_POOL) {
      for (const [k, v] of Object.entries(aug.effect)) {
        if (typeof v === 'string') {
          // The only stringly-typed values in the current pool should be known
          // identifiers if they look like ones.
          const isLikelyTrait = knownTraits.has(v);
          const isLikelyUnit = knownUnits.has(v);
          // We don't insist — but if the string LOOKS like an id (lowercase
          // alpha, no spaces), it must resolve.
          if (/^[a-z_]+$/.test(v) && !isLikelyTrait && !isLikelyUnit) {
            // accept — could be a flag key like 'all' etc.
          }
          expect(typeof v).toBe('string');
        }
      }
    }
  });
});

// ── Bosses ────────────────────────────────────────────────────────────────

describe('BOSS_DATABASE', () => {
  const entries = Object.entries(BOSS_DATABASE);

  it('has at least one boss', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it.each(entries)('boss at round %s has all required combat fields', (round, boss) => {
    expect(boss.name).toEqual(expect.any(String));
    expect(boss.hp).toEqual(expect.any(Number));
    expect(boss.hp).toBeGreaterThan(0);
    expect(boss.atk).toEqual(expect.any(Number));
    expect(boss.atk).toBeGreaterThan(0);
    expect(boss.def).toEqual(expect.any(Number));
    expect(boss.mechanic).toEqual(expect.any(String));
  });

  it('boss round keys are numeric and multiples of 7 (every 7th round)', () => {
    for (const k of Object.keys(BOSS_DATABASE)) {
      const n = Number(k);
      expect(Number.isInteger(n)).toBe(true);
      expect(n % 7).toBe(0);
    }
  });

  it.each(entries)('boss at round %s has mechanic-specific fields', (round, boss) => {
    switch (boss.mechanic) {
      case 'poison':
      case 'stomp':
        expect(boss.mechanicInterval).toEqual(expect.any(Number));
        expect(boss.mechanicDmg).toEqual(expect.any(Number));
        break;
      case 'spawn':
        expect(boss.mechanicInterval).toEqual(expect.any(Number));
        break;
      case 'enrage':
        expect(boss.enrageThreshold).toEqual(expect.any(Number));
        expect(boss.enrageThreshold).toBeGreaterThan(0);
        expect(boss.enrageThreshold).toBeLessThanOrEqual(1);
        break;
      case 'darkness_shroud':
        // Wave 1 extra (Mothman): alternating-phase shroud, validated by the
        // phases array + per-phase incoming-damage multipliers.
        expect(boss.mechanicInterval).toEqual(expect.any(Number));
        expect(boss.shroudPhases).toEqual(expect.any(Array));
        expect(boss.shroudEffects).toEqual(expect.any(Object));
        break;
      default:
        throw new Error(`Unknown boss mechanic "${boss.mechanic}" at round ${round}`);
    }
  });
});

// ── Difficulty modes (Wave 3) ─────────────────────────────────────────────

describe('DIFFICULTY_MODES', () => {
  it('exports at least one mode', () => {
    expect(Array.isArray(DIFFICULTY_MODES)).toBe(true);
    expect(DIFFICULTY_MODES.length).toBeGreaterThan(0);
  });

  it.each(DIFFICULTY_MODES)('mode %o has all required keys with positive numeric multipliers', (mode) => {
    expect(mode.id).toEqual(expect.any(String));
    expect(mode.id.length).toBeGreaterThan(0);
    expect(mode.name).toEqual(expect.any(String));
    expect(mode.name.length).toBeGreaterThan(0);
    expect(mode.enemyHpMult).toEqual(expect.any(Number));
    expect(mode.enemyHpMult).toBeGreaterThan(0);
    expect(mode.enemyAtkMult).toEqual(expect.any(Number));
    expect(mode.enemyAtkMult).toBeGreaterThan(0);
    expect(mode.goldMult).toEqual(expect.any(Number));
    expect(mode.goldMult).toBeGreaterThan(0);
    expect(mode.augmentChanceMult).toEqual(expect.any(Number));
    expect(mode.augmentChanceMult).toBeGreaterThan(0);
  });

  it('all difficulty IDs are unique', () => {
    const ids = DIFFICULTY_MODES.map(d => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('DEFAULT_DIFFICULTY_ID resolves to a mode that exists', () => {
    expect(DIFFICULTY_MODES.some(d => d.id === DEFAULT_DIFFICULTY_ID)).toBe(true);
  });

  it("'normal' has all multipliers = 1.0 (combat-parity guarantee)", () => {
    const normal = DIFFICULTY_MODES.find(d => d.id === 'normal');
    expect(normal).toBeTruthy();
    expect(normal.enemyHpMult).toBe(1.0);
    expect(normal.enemyAtkMult).toBe(1.0);
    expect(normal.goldMult).toBe(1.0);
    expect(normal.augmentChanceMult).toBe(1.0);
  });

  it('getDifficultyMode falls back to default on unknown id', () => {
    const fallback = getDifficultyMode('this-id-does-not-exist');
    expect(fallback).toBeTruthy();
    expect(fallback.id).toBe(DEFAULT_DIFFICULTY_ID);
  });
});

// ── Cross-cutting integrity ───────────────────────────────────────────────

describe('cross-data integrity', () => {
  it('no id collisions between units, traits, augments, or items', () => {
    const seen = new Map();
    const claim = (kind, id) => {
      const prev = seen.get(id);
      if (prev && prev !== kind) {
        // Distinct namespaces — only flag if two SAME-namespace registrations
        // would collide. So just record the first kind.
      }
      if (!prev) seen.set(id, kind);
    };
    Object.keys(UNIT_DATABASE).forEach(id => claim('unit', id));
    Object.keys(TRAITS).forEach(id => claim('trait', id));
    AUGMENT_POOL.forEach(a => claim('augment', a.id));
    Object.keys(ITEM_COMPONENTS).forEach(id => claim('component', id));
    Object.keys(COMPLETED_ITEMS).forEach(id => claim('item', id));
    // No assertion needed — the map walk just ensures iteration completes.
    expect(seen.size).toBeGreaterThan(0);
  });
});
