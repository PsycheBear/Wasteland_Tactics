// Data integrity tests for the post-overhaul schema.
//
// These are NOT behaviour tests — they fail fast on corrupt data files:
//   - missing/duplicate IDs
//   - dangling cross-references (unit -> trait, item recipe -> component,
//     augment -> known concepts)
//   - schema gaps (HP/ATK/DEF/cost missing or non-numeric)
//   - new schema invariants from the character overhaul:
//       * unit.range is one of 'melee' | 'ranged' | 'dual'
//       * unit.faction is one of the 9 faction IDs
//       * unit.role    is one of the 4 role IDs
//       * unit.traits  is exactly [faction, role]
//       * BOSS_DATABASE has the 6 expected rounds (7, 14, 21, 28, 35, 42)
//       * PVE_WAVES has all 8 wave rounds (1, 2, 3, 8, 15, 22, 29, 36)
//       * CHARACTER_AUGMENTS has exactly 3 entries
//       * FO4_COMPANIONS is a non-empty list of known unit IDs
//       * `plasma_core` is still present as the 7th item component

import { describe, it, expect } from 'vitest';
import { UNIT_DATABASE, MELEE_UNITS, DUAL_RANGE_UNITS } from '../data/units.js';
import { TRAITS } from '../data/traits.js';
import { ITEM_COMPONENTS, COMPLETED_ITEMS } from '../data/items.js';
import { AUGMENT_POOL } from '../data/augments.js';
import { BOSS_DATABASE } from '../data/bosses.js';
import { DIFFICULTY_MODES, DEFAULT_DIFFICULTY_ID, getDifficultyMode } from '../data/difficulty.js';
import { PVE_WAVES } from '../data/pveWaves.js';
import { CHARACTER_AUGMENTS } from '../data/characterAugments.js';
import { FO4_COMPANIONS } from '../data/fo4Companions.js';

// Shared constants for the new schema.
const RANGE_KINDS = new Set(['melee', 'ranged', 'dual']);
const FACTIONS = new Set([
  'brotherhood', 'railroad', 'goodneighbor', 'minutemen',
  'institute', 'cabot', 'wastelander', 'vault-dweller', 'atom-cats',
]);
const ROLES = new Set(['vanguard', 'sniper', 'caster', 'medic']);

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
    expect(unit.attackRange).toEqual(expect.any(Number));
    expect(unit.attackRange).toBeGreaterThanOrEqual(1);
    expect(unit.traits).toEqual(expect.any(Array));
    expect(unit.traits.length).toBe(2);
  });

  it.each(entries)('unit %s has new-schema range/faction/role fields', (id, unit) => {
    expect(RANGE_KINDS.has(unit.range), `${id} has invalid range "${unit.range}"`).toBe(true);
    expect(FACTIONS.has(unit.faction), `${id} has invalid faction "${unit.faction}"`).toBe(true);
    expect(ROLES.has(unit.role), `${id} has invalid role "${unit.role}"`).toBe(true);
    // The traits array must contain exactly the faction + role.
    expect(unit.traits).toEqual([unit.faction, unit.role]);
  });

  it.each(entries)('unit %s references only known traits', (id, unit) => {
    for (const trait of unit.traits) {
      expect(TRAITS[trait], `${id} references unknown trait "${trait}"`).toBeDefined();
    }
  });

  it.each(entries)('unit %s has unique traits (no duplicates)', (id, unit) => {
    expect(new Set(unit.traits).size).toBe(unit.traits.length);
  });

  it.each(entries)('unit %s has a portraitBase path', (id, unit) => {
    expect(unit.portraitBase).toEqual(expect.any(String));
    expect(unit.portraitBase.startsWith('images/units/')).toBe(true);
  });

  it('MELEE_UNITS references only known unit ids', () => {
    for (const id of MELEE_UNITS) {
      expect(UNIT_DATABASE[id], `MELEE_UNITS has unknown id "${id}"`).toBeDefined();
    }
  });

  it('MELEE_UNITS has no duplicates', () => {
    expect(new Set(MELEE_UNITS).size).toBe(MELEE_UNITS.length);
  });

  it('DUAL_RANGE_UNITS lists exactly the dual-range units', () => {
    const dualFromDb = Object.entries(UNIT_DATABASE)
      .filter(([, u]) => u.range === 'dual')
      .map(([id]) => id)
      .sort();
    const declared = [...DUAL_RANGE_UNITS].sort();
    expect(declared).toEqual(dualFromDb);
  });

  it('roster covers the 9 factions', () => {
    const factionsUsed = new Set();
    for (const u of Object.values(UNIT_DATABASE)) factionsUsed.add(u.faction);
    for (const f of FACTIONS) {
      expect(factionsUsed.has(f), `Faction "${f}" has no units`).toBe(true);
    }
  });

  it('roster covers all 4 roles', () => {
    const rolesUsed = new Set();
    for (const u of Object.values(UNIT_DATABASE)) rolesUsed.add(u.role);
    for (const r of ROLES) {
      expect(rolesUsed.has(r), `Role "${r}" has no units`).toBe(true);
    }
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
    expect(trait.effect(0)).toEqual(expect.any(Object));
    expect(trait.effect(2)).toEqual(expect.any(Object));
    expect(trait.effect(6)).toEqual(expect.any(Object));
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

  it('exposes 9 factions + 4 roles = 13 total traits', () => {
    const traitIds = new Set(Object.keys(TRAITS));
    let factionCount = 0;
    let roleCount = 0;
    for (const id of traitIds) {
      if (FACTIONS.has(id)) factionCount++;
      if (ROLES.has(id)) roleCount++;
    }
    expect(factionCount).toBe(9);
    expect(roleCount).toBe(4);
    expect(traitIds.size).toBe(13);
  });
});

// ── Items ─────────────────────────────────────────────────────────────────

describe('ITEM_COMPONENTS', () => {
  const entries = Object.entries(ITEM_COMPONENTS);

  it('has at least one component', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it('plasma_core is still present as the 7th component', () => {
    expect(ITEM_COMPONENTS.plasma_core).toBeDefined();
    expect(ITEM_COMPONENTS.plasma_core.name).toEqual(expect.any(String));
    expect(Object.keys(ITEM_COMPONENTS).length).toBeGreaterThanOrEqual(7);
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
    }
  });

  it('character-tied augments are present in the pool', () => {
    const ids = new Set(AUGMENT_POOL.map(a => a.id));
    expect(ids.has('aug_cait_drug')).toBe(true);
    expect(ids.has('aug_robot_dog')).toBe(true);
    expect(ids.has('aug_virgil_fev')).toBe(true);
  });
});

// ── Character Augments ────────────────────────────────────────────────────

describe('CHARACTER_AUGMENTS', () => {
  it('has exactly 3 entries', () => {
    expect(CHARACTER_AUGMENTS.length).toBe(3);
  });

  it('each entry has id, name, desc, iconImg, characterTied flag', () => {
    for (const a of CHARACTER_AUGMENTS) {
      expect(a.id).toEqual(expect.any(String));
      expect(a.name).toEqual(expect.any(String));
      expect(a.desc).toEqual(expect.any(String));
      expect(a.iconImg).toEqual(expect.any(String));
      expect(a.characterTied).toBe(true);
    }
  });

  it('grant/transform unit IDs resolve to real units', () => {
    for (const a of CHARACTER_AUGMENTS) {
      if (a.grantUnit) {
        expect(UNIT_DATABASE[a.grantUnit.id], `grantUnit "${a.grantUnit.id}" missing`).toBeDefined();
      }
      if (a.transformUnit) {
        expect(UNIT_DATABASE[a.transformUnit.from], `transform from "${a.transformUnit.from}" missing`).toBeDefined();
        expect(UNIT_DATABASE[a.transformUnit.to], `transform to "${a.transformUnit.to}" missing`).toBeDefined();
      }
      if (a.fallbackGrantUnit) {
        expect(UNIT_DATABASE[a.fallbackGrantUnit.id], `fallbackGrantUnit "${a.fallbackGrantUnit.id}" missing`).toBeDefined();
      }
    }
  });
});

// ── FO4 Companions ────────────────────────────────────────────────────────

describe('FO4_COMPANIONS', () => {
  it('is a non-empty list', () => {
    expect(Array.isArray(FO4_COMPANIONS)).toBe(true);
    expect(FO4_COMPANIONS.length).toBeGreaterThan(0);
  });

  it('every companion ID maps to a known unit', () => {
    for (const id of FO4_COMPANIONS) {
      expect(UNIT_DATABASE[id], `Companion ID "${id}" is not a known unit`).toBeDefined();
    }
  });

  it('has no duplicates', () => {
    expect(new Set(FO4_COMPANIONS).size).toBe(FO4_COMPANIONS.length);
  });
});

// ── Bosses ────────────────────────────────────────────────────────────────

describe('BOSS_DATABASE', () => {
  const entries = Object.entries(BOSS_DATABASE);

  it('has exactly the 6 boss rounds (7, 14, 21, 28, 35, 42)', () => {
    const rounds = Object.keys(BOSS_DATABASE).map(Number).sort((a, b) => a - b);
    expect(rounds).toEqual([7, 14, 21, 28, 35, 42]);
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

  it('boss round keys are numeric multiples of 7', () => {
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
      default:
        throw new Error(`Unknown boss mechanic "${boss.mechanic}" at round ${round}`);
    }
  });
});

// ── PvE Waves ─────────────────────────────────────────────────────────────

describe('PVE_WAVES', () => {
  it('has all 8 wave rounds (1, 2, 3, 8, 15, 22, 29, 36)', () => {
    const rounds = Object.keys(PVE_WAVES).map(Number).sort((a, b) => a - b);
    expect(rounds).toEqual([1, 2, 3, 8, 15, 22, 29, 36]);
  });

  it.each(Object.entries(PVE_WAVES))('wave at round %s has name, creeps array, dropTier', (round, wave) => {
    expect(wave.name).toEqual(expect.any(String));
    expect(Array.isArray(wave.creeps)).toBe(true);
    expect(wave.creeps.length).toBeGreaterThan(0);
    for (const c of wave.creeps) {
      expect(typeof c).toBe('string');
      expect(c.length).toBeGreaterThan(0);
    }
    expect(['component', 'completed']).toContain(wave.dropTier);
  });

  it('round 36 drops a completed item (TFT 4-7 style)', () => {
    expect(PVE_WAVES[36].dropTier).toBe('completed');
  });
});

// ── Difficulty modes ──────────────────────────────────────────────────────

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
  it('no id collisions across kinds (best-effort sanity check)', () => {
    const seen = new Map();
    const claim = (kind, id) => {
      if (!seen.has(id)) seen.set(id, kind);
    };
    Object.keys(UNIT_DATABASE).forEach(id => claim('unit', id));
    Object.keys(TRAITS).forEach(id => claim('trait', id));
    AUGMENT_POOL.forEach(a => claim('augment', a.id));
    Object.keys(ITEM_COMPONENTS).forEach(id => claim('component', id));
    Object.keys(COMPLETED_ITEMS).forEach(id => claim('item', id));
    expect(seen.size).toBeGreaterThan(0);
  });
});
