// === BOSS DATA ===
//
// 6 bosses at rounds 7 / 14 / 21 / 28 / 35 / 42.
//
//   Round  7  RADSCORPION    — keep current poison stomp
//   Round 14  SWAN           — stomp AoE every 8s, +50% ATK below 30% HP
//   Round 21  SYNTH COURSER  — teleport-strike lowest-HP every 5s for 300 burst
//   Round 28  DEATHCLAW      — keep current stomp mechanic
//   Round 35  ATOM THEIL     — glow burst (stacking rad DoT), heals allies 50% on death
//   Round 42  LORENZO CABOT  — crimson stasis (freezes 1 unit per cast for 4s)
//
// `extraBosses.js` is kept for future content but exports an empty array now —
// Mothman and the older one-off bosses were retired in this overhaul.

import { BASE } from '../baseUrl.js';
import { extraBosses } from './extraBosses.js';

export const BOSS_DATABASE = {
  7: {
    name: 'Legendary Radscorpion',
    hp: 3000, atk: 60, def: 30,
    mechanic: 'poison', mechanicInterval: 30, mechanicDmg: 80,
    icon: '', iconImg: `${BASE}/images/icons/boss-radscorpion.svg`,
  },
  14: {
    name: 'Swan',
    hp: 5500, atk: 95, def: 40,
    // Stomp AoE every 8 ticks; combat.js applies an enrage @ <30% HP that
    // bumps ATK by +50% (handled the same way as the existing 'enrage'
    // mechanic but layered on a stomp boss — the engine reads both flags).
    mechanic: 'stomp', mechanicInterval: 16, mechanicDmg: 110,
    enrageThreshold: 0.3, enrageAtkMult: 1.5,
    icon: '', iconImg: `${BASE}/images/icons/boss-swan.svg`,
  },
  21: {
    name: 'Synth Courser',
    hp: 7000, atk: 95, def: 45,
    // Teleport-strike the lowest-HP enemy every 5 ticks for 300 burst damage.
    // Reuses the existing 'stomp' mechanic key (interval+dmg pattern) so
    // current combat plumbing renders the windup the same way.
    mechanic: 'stomp', mechanicInterval: 10, mechanicDmg: 300,
    courserTeleport: true,
    icon: '', iconImg: `${BASE}/images/icons/boss-synth-courser.svg`,
  },
  28: {
    name: 'Mythic Deathclaw',
    hp: 10000, atk: 110, def: 45,
    mechanic: 'stomp', mechanicInterval: 40, mechanicDmg: 100,
    icon: '', iconImg: `${BASE}/images/icons/boss-deathclaw.svg`,
  },
  35: {
    name: 'Atom Theil',
    hp: 13000, atk: 120, def: 50,
    // Glow burst: stacking radiation DoT on all enemies. Reuses 'poison'
    // mechanic plumbing for the per-tick tick application (so the engine's
    // existing tick loop drains it the same way).
    mechanic: 'poison', mechanicInterval: 12, mechanicDmg: 60,
    glowBurst: true,           // signals combat.js to stack the DoT
    deathHealAllies: 0.5,      // on boss death, heal allies 50% HP
    icon: '', iconImg: `${BASE}/images/icons/boss-atom-theil.svg`,
  },
  42: {
    name: 'Lorenzo Cabot',
    // Endgame tuning: was 18000 HP / 8s stasis (too brutal, <5% clear rate).
    // Trimmed to 14000 HP / 4s stasis targeting ~25-30% clear rate so the final
    // boss actually serves as a satisfying capstone instead of a wall.
    hp: 14000, atk: 145, def: 55,
    mechanic: 'spawn', mechanicInterval: 14,
    crimsonStasis: true, stasisDuration: 4,
    icon: '', iconImg: `${BASE}/images/icons/boss-lorenzo-cabot.svg`,
  },
};

// Spread any extras under their round-number keys. Currently empty.
for (const b of extraBosses) {
  BOSS_DATABASE[b.round] = b;
}

// Boss ID is derived from the kebab-cased name. Used for portrait path + replay.
export const getBossId = (boss) => {
  if (!boss?.name) return null;
  return boss.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
};

// Bosses have a mix of .png and .webp portrait files. Map the boss id to the
// correct extension so callers don't 404.
const BOSS_PORTRAIT_EXT = {
  'swan': 'webp',
  'synth-courser': 'webp',
  'atom-theil': 'webp',
  'lorenzo-cabot': 'png',
  // Round 7 & 28 bosses (Radscorpion, Deathclaw) don't have a PNG portrait
  // yet — they fall through to the SVG iconImg.
};

export const getBossPortrait = (boss) => {
  const id = getBossId(boss);
  if (!id) return null;
  const ext = BOSS_PORTRAIT_EXT[id];
  if (!ext) return null;
  return `${BASE}/images/bosses/${id}.${ext}`;
};

// Stamp portrait + id + round on each boss entry for the UI fallback path.
for (const [round, b] of Object.entries(BOSS_DATABASE)) {
  b.id = getBossId(b);
  b.portrait = getBossPortrait(b);
  if (b.round === undefined) b.round = Number(round);
}
