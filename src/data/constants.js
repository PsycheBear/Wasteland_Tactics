// Game balance constants - easy to edit

import { UNIT_DATABASE } from './units.js';

export const COST_COLORS = { 1: '#cccccc', 2: '#1eff00', 3: '#4488ff', 4: '#cc44ff', 5: '#ffd700' };
export const TIER_LABELS = { 1: 'Common', 2: 'Uncommon', 3: 'Rare', 4: 'Epic', 5: 'Legendary' };

export const SHOP_ODDS = {
  1: [100, 0, 0, 0, 0],
  2: [100, 0, 0, 0, 0],
  3: [75, 25, 0, 0, 0],
  4: [55, 30, 15, 0, 0],
  5: [45, 33, 20, 2, 0],
  6: [30, 40, 25, 5, 0],
  7: [19, 35, 30, 15, 1],
  8: [18, 25, 32, 22, 3],
  9: [15, 20, 25, 30, 10],
  10: [10, 15, 25, 30, 20],
  11: [5, 10, 20, 35, 30],
};

export const getRandomCost = (playerLevel) => {
  const odds = SHOP_ODDS[Math.min(playerLevel, 11)] || SHOP_ODDS[11];
  const roll = Math.random() * 100;
  let cum = 0;
  for (let i = 0; i < odds.length; i++) {
    cum += odds[i];
    if (roll < cum) return i + 1;
  }
  return 1;
};

export const POOL_SIZES = { 1: 13, 2: 10, 3: 7, 4: 5, 5: 5 };

// Units flagged `notShoppable: true` (e.g. Robot Dog from the Dogmeat augment,
// any boss-only units) are excluded from the shop pool. They can still exist
// on the board / bench via augment grants — they just never roll in the shop.
export const UNIT_KEYS = Object.keys(UNIT_DATABASE).filter(k => !UNIT_DATABASE[k].notShoppable);

export const XP_TO_LEVEL = { 4: 4, 5: 8, 6: 14, 7: 24, 8: 36, 9: 48 };

export const initPool = () => {
  const p = {};
  UNIT_KEYS.forEach(k => { p[k] = POOL_SIZES[UNIT_DATABASE[k].cost] || 10; });
  return p;
};

export function makeUid() {
  return Math.random().toString(36).slice(2, 11);
}

// Carousel triggers after the last round of each stage (every 3 rounds), starting after stage 1
// Stage 1 ends at round 3, stage 2 at round 6, etc. First carousel after round 3 (end of stage 1).
export const ROUNDS_PER_STAGE = 3;
export const isCarouselRound = (round) => round >= 3 && round % ROUNDS_PER_STAGE === 0;
// Keep array export for backward compat (used in pip rendering) — generates first 10 carousel rounds
export const CAROUSEL_ROUNDS = Array.from({ length: 10 }, (_, i) => (i + 1) * ROUNDS_PER_STAGE);
