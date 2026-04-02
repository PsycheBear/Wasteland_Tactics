// Game balance constants - easy to edit

import { UNIT_DATABASE } from './units.js';

export const COST_COLORS = { 1: '#888', 2: '#4CAF50', 3: '#2196F3', 4: '#9C27B0', 5: '#FF9800' };

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

export const UNIT_KEYS = Object.keys(UNIT_DATABASE);

export const XP_TO_LEVEL = { 4: 4, 5: 8, 6: 14, 7: 24, 8: 36, 9: 48 };

export const initPool = () => {
  const p = {};
  Object.keys(UNIT_DATABASE).forEach(k => { p[k] = POOL_SIZES[UNIT_DATABASE[k].cost] || 10; });
  return p;
};

export function makeUid() {
  return Math.random().toString(36).slice(2, 11);
}
