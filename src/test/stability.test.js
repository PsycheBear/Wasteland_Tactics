// Stability-hardening regression tests (audit Phase 1).
//
// Covers the guards added after the June 2026 codebase audit:
//   - sanitizeCombatUnit: NaN/undefined stats must never reach the combat loop
//   - migrateSave: save-schema versioning + corrupted-blob rejection
//   - triggerAbility: every roster unit must tolerate empty target pools
//     (no allies / no enemies) without throwing

import { describe, it, expect } from 'vitest';
import { sanitizeCombatUnit, triggerAbility } from '../systems/combat.js';
import { migrateSave, SAVE_VERSION } from '../hooks/useSave.js';
import { UNIT_DATABASE } from '../data/units.js';

describe('sanitizeCombatUnit', () => {
  it('replaces non-finite core stats with safe defaults', () => {
    const u = sanitizeCombatUnit({
      hp: 200,
      maxHp: NaN,
      currentHp: undefined,
      atk: NaN,
      def: Infinity,
      mana: NaN,
      manaMax: undefined,
      attackSpeed: 0,
    });
    expect(Number.isFinite(u.maxHp)).toBe(true);
    expect(u.maxHp).toBeGreaterThan(0);
    expect(Number.isFinite(u.currentHp)).toBe(true);
    expect(u.currentHp).toBeLessThanOrEqual(u.maxHp);
    expect(Number.isFinite(u.atk)).toBe(true);
    expect(Number.isFinite(u.def)).toBe(true);
    expect(Number.isFinite(u.mana)).toBe(true);
    expect(Number.isFinite(u.manaMax)).toBe(true);
    expect(u.attackSpeed).toBeGreaterThan(0);
  });

  it('leaves healthy units untouched', () => {
    const u = sanitizeCombatUnit({
      hp: 500, maxHp: 900, currentHp: 450, atk: 55, baseAtk: 55,
      def: 20, baseDef: 20, mana: 30, manaMax: 100, attackSpeed: 0.8,
    });
    expect(u.maxHp).toBe(900);
    expect(u.currentHp).toBe(450);
    expect(u.atk).toBe(55);
    expect(u.def).toBe(20);
    expect(u.attackSpeed).toBe(0.8);
  });

  it('tolerates null without throwing', () => {
    expect(() => sanitizeCombatUnit(null)).not.toThrow();
  });
});

describe('migrateSave', () => {
  const validV1 = {
    round: 7, gold: 23, hp: 88, level: 5, xp: 2, xpNeeded: 8, streak: 2,
    bench: [null], board: [null], pool: { preston: 10 },
    itemInventory: ['wonderGlue'], augments: ['aug_x'],
  };

  it('stamps un-versioned (v1) saves with the current version', () => {
    const out = migrateSave({ ...validV1 });
    expect(out).not.toBeNull();
    expect(out.version).toBe(SAVE_VERSION);
    expect(out.round).toBe(7);
    expect(out.gold).toBe(23);
  });

  it('normalizes missing/corrupt fields to fresh-run defaults', () => {
    const out = migrateSave({ round: 'NaN-bait', gold: null, bench: 'oops', pool: [1, 2] });
    expect(out.round).toBe(1);
    expect(out.gold).toBe(10);
    expect(out.hp).toBe(100);
    expect(out.bench).toBeNull();
    expect(out.pool).toBeNull();
    expect(out.itemInventory).toEqual([]);
    expect(out.augments).toEqual([]);
  });

  it('rejects non-object blobs', () => {
    expect(migrateSave(null)).toBeNull();
    expect(migrateSave('garbage')).toBeNull();
    expect(migrateSave([1, 2, 3])).toBeNull();
  });

  it('rejects saves from a newer build instead of guessing', () => {
    expect(migrateSave({ ...validV1, version: SAVE_VERSION + 1 })).toBeNull();
  });

  it('round-trips a current-version save unchanged', () => {
    const out = migrateSave({ ...validV1, version: SAVE_VERSION });
    expect(out.version).toBe(SAVE_VERSION);
    expect(out.itemInventory).toEqual(['wonderGlue']);
  });
});

describe('triggerAbility — empty target pools', () => {
  const makeCaster = (id) => {
    const base = UNIT_DATABASE[id];
    return {
      ...base,
      id,
      stars: 1,
      uid: `stab_${id}`,
      currentHp: base.hp,
      maxHp: base.hp,
      atk: base.atk,
      baseAtk: base.atk,
      def: base.def,
      baseDef: base.def,
      mana: base.apMax || 0,
      manaMax: base.apMax || 0,
      abilityUsed: false,
      stunDuration: 0,
      buffDuration: 0,
      buffAtkMult: 1,
      position: 0,
      items: [],
    };
  };

  const casterIds = Object.keys(UNIT_DATABASE).filter(id => (UNIT_DATABASE[id].apMax || 0) > 0);

  it('covers the full active-ability roster', () => {
    expect(casterIds.length).toBeGreaterThan(0);
  });

  it.each(casterIds)('%s ability does not throw with no enemies and no other allies', (id) => {
    const unit = makeCaster(id);
    expect(() => triggerAbility(unit, [unit], [], [], 1, [])).not.toThrow();
  });

  it.each(casterIds)('%s ability does not throw when all enemies are dead', (id) => {
    const unit = makeCaster(id);
    const corpse = { ...makeCaster('preston'), currentHp: 0, uid: 'stab_corpse' };
    expect(() => triggerAbility(unit, [unit], [corpse], [], 1, [])).not.toThrow();
  });
});
