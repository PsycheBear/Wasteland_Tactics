// Thin wrappers around localStorage for the game's persistent state.
//
// These helpers don't manage React state — they're pure read/write functions
// over the `wt_*` keyspace. Callers (Game.jsx) still own their useState. The
// goal is to keep the JSON.parse/try-catch noise out of components.
//
// Added in Wave 2: a small replay buffer that retains the last 5 fights so
// ReplayViewer can step through them.

import { logError } from '../lib/logger.js';

const KEY_SAVE = 'wt_save';
const KEY_PLAYER_STATS = 'wt_player_stats';
const KEY_REPLAYS = 'wt_replays';
const MAX_REPLAYS = 5;

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null || raw === undefined ? fallback : JSON.parse(raw);
  } catch (e) {
    logError(e, { source: 'useSave.readJSON', key });
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    logError(e, { source: 'useSave.writeJSON', key });
    return false;
  }
}

// === Main run save (board / bench / augments / items / etc.) ===
export const loadRun = () => readJSON(KEY_SAVE, null);
export const saveRun = (state) => writeJSON(KEY_SAVE, state);
export const clearRun = () => {
  try { localStorage.removeItem(KEY_SAVE); } catch (_) {}
};
export const hasRun = () => {
  try { return !!localStorage.getItem(KEY_SAVE); } catch (_) { return false; }
};

// === Lifetime player stats (best round, totals, win/loss vs bosses) ===
//
// Shape (defensively read — older saves may be missing fields):
//   {
//     runs: number,
//     bestRound: number,
//     totalGold: number,
//     favoriteTrait: string,
//     bossRecord: { [bossName]: { wins, losses } },
//   }
export const loadPlayerStats = () => readJSON(KEY_PLAYER_STATS, {});
export const savePlayerStats = (stats) => writeJSON(KEY_PLAYER_STATS, stats);

// Convenience: increment a counter on the stats object and persist.
export const bumpPlayerStat = (key, delta = 1) => {
  const stats = loadPlayerStats();
  stats[key] = (stats[key] || 0) + delta;
  savePlayerStats(stats);
  return stats;
};

// Record a boss outcome on the persistent stats object. `result` is 'win' or 'loss'.
export const recordBossOutcome = (bossName, result) => {
  if (!bossName) return;
  const stats = loadPlayerStats();
  stats.bossRecord = stats.bossRecord || {};
  const rec = stats.bossRecord[bossName] = stats.bossRecord[bossName] || { wins: 0, losses: 0 };
  if (result === 'win') rec.wins += 1;
  else if (result === 'loss') rec.losses += 1;
  savePlayerStats(stats);
};

// === Replay buffer ===
//
// Each replay entry is shaped as:
//   { time: number, round: number, opponent: string, log: any[], result: 'win'|'loss' }
//
// `log` is the combat-engine action log produced by combat.js. ReplayViewer
// steps through it with prev/next/play and a speed control.

export const loadReplays = () => readJSON(KEY_REPLAYS, []);

export const saveReplay = (entry) => {
  const list = loadReplays();
  list.unshift({ time: Date.now(), ...entry });
  while (list.length > MAX_REPLAYS) list.pop();
  return writeJSON(KEY_REPLAYS, list);
};

export const clearReplays = () => {
  try { localStorage.removeItem(KEY_REPLAYS); } catch (_) {}
};
