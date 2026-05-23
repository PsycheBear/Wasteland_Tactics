// === DIFFICULTY MODES ===
//
// Difficulty selection scales enemy HP/ATK and player gold income via flat
// multiplicative factors. The 'normal' entry MUST have all multipliers equal
// to 1.0 — combat parity tests assert this.
//
// `augmentChanceMult` is informational for now (Wave 3 left the multiplier
// available on the data object so future tuning can use it without a schema
// migration). It is not yet wired into augment offer rolls.

export const DIFFICULTY_MODES = [
  { id: 'easy',     name: 'Easy',     enemyHpMult: 0.75, enemyAtkMult: 0.75, goldMult: 1.25, augmentChanceMult: 1.5 },
  { id: 'normal',   name: 'Normal',   enemyHpMult: 1.0,  enemyAtkMult: 1.0,  goldMult: 1.0,  augmentChanceMult: 1.0 },
  { id: 'hard',     name: 'Hard',     enemyHpMult: 1.3,  enemyAtkMult: 1.2,  goldMult: 0.9,  augmentChanceMult: 0.85 },
  { id: 'survival', name: 'Survival', enemyHpMult: 1.5,  enemyAtkMult: 1.4,  goldMult: 0.75, augmentChanceMult: 0.7 },
];

export const DEFAULT_DIFFICULTY_ID = 'normal';

// Helper: look up a mode by id, falling back to the default if unknown.
// Always returns a non-null object so callers can do `mode.enemyHpMult` safely.
export const getDifficultyMode = (id) => {
  return DIFFICULTY_MODES.find(d => d.id === id) ||
         DIFFICULTY_MODES.find(d => d.id === DEFAULT_DIFFICULTY_ID);
};
