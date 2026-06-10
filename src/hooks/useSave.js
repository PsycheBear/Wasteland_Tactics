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
    // Quota exceeded: replays are the only unbounded-ish data we keep, so
    // evict them and retry once rather than silently losing the save.
    if (e && (e.name === 'QuotaExceededError' || e.code === 22)) {
      try {
        localStorage.removeItem(KEY_REPLAYS);
        localStorage.setItem(key, JSON.stringify(value));
        logError('localStorage quota hit — cleared replay buffer to save', { source: 'useSave.writeJSON', key });
        return true;
      } catch (retryErr) {
        logError(retryErr, { source: 'useSave.writeJSON.retry', key });
        return false;
      }
    }
    logError(e, { source: 'useSave.writeJSON', key });
    return false;
  }
}

// === Main run save (board / bench / augments / items / etc.) ===

// Bump this whenever the run-save shape changes, and add an explicit step in
// migrateSave so saves written by older builds keep loading.
export const SAVE_VERSION = 2;

// Migrate a parsed run-save to the current schema. Returns the migrated
// state, or null when the blob is unusable (wrong type, or written by a
// newer build than this one). Saves with no `version` field are treated as
// v1 (every pre-versioning build).
export function migrateSave(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return null;
  const version = state.version || 1;
  if (version > SAVE_VERSION) return null;
  const out = { ...state };
  // v1 → v2: version stamp introduced; field shapes unchanged. Normalize
  // everything loadGame depends on so missing/corrupt data degrades to a
  // fresh-run default instead of an NaN/undefined cascade.
  out.version = SAVE_VERSION;
  out.round = Number.isFinite(out.round) ? out.round : 1;
  out.gold = Number.isFinite(out.gold) ? out.gold : 10;
  out.hp = Number.isFinite(out.hp) ? out.hp : 100;
  out.level = Number.isFinite(out.level) ? out.level : 3;
  out.xp = Number.isFinite(out.xp) ? out.xp : 0;
  out.xpNeeded = Number.isFinite(out.xpNeeded) ? out.xpNeeded : 4;
  out.streak = Number.isFinite(out.streak) ? out.streak : 0;
  out.bench = Array.isArray(out.bench) ? out.bench : null;
  out.board = Array.isArray(out.board) ? out.board : null;
  out.pool = out.pool && typeof out.pool === 'object' && !Array.isArray(out.pool) ? out.pool : null;
  out.itemInventory = Array.isArray(out.itemInventory) ? out.itemInventory : [];
  out.augments = Array.isArray(out.augments) ? out.augments : [];
  return out;
}

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
