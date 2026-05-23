// === BOSS DATA ===
import { BASE } from '../baseUrl.js';
import { extraBosses } from './extraBosses.js';
export const BOSS_DATABASE = {
  7: { name: 'Legendary Radscorpion', hp: 3000, atk: 60, def: 30, mechanic: 'poison', mechanicInterval: 30, mechanicDmg: 80, icon: '\u{1F982}', iconImg: `${BASE}/images/icons/boss-radscorpion.svg` },
  14: { name: 'Mirelurk Queen', hp: 5000, atk: 75, def: 35, mechanic: 'spawn', mechanicInterval: 50, icon: '\u{1F980}', iconImg: `${BASE}/images/icons/boss-mirelurk.svg` },
  21: { name: 'Behemoth', hp: 7000, atk: 90, def: 40, mechanic: 'enrage', enrageThreshold: 0.5, icon: '\u{1F479}', iconImg: `${BASE}/images/icons/boss-behemoth.svg` },
  28: { name: 'Mythic Deathclaw', hp: 10000, atk: 110, def: 45, mechanic: 'stomp', mechanicInterval: 40, mechanicDmg: 100, icon: '\u{1F409}', iconImg: `${BASE}/images/icons/boss-deathclaw.svg` },
};

// Spread Wave 1 extras under their round-number keys (Mothman at 35).
for (const b of extraBosses) {
  BOSS_DATABASE[b.round] = b;
}

// Boss ID is derived from the kebab-cased name (e.g. "Mirelurk Queen" -> "mirelurk-queen").
// Used both for the portrait path and as a stable identifier for stats / replay.
export const getBossId = (boss) => {
  if (!boss?.name) return null;
  return boss.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
};
export const getBossPortrait = (boss) => {
  const id = getBossId(boss);
  return id ? `${BASE}/images/bosses/${id}.png` : null;
};

// Stamp portrait + id fields on each boss for the UI layer's fallback path.
for (const [round, b] of Object.entries(BOSS_DATABASE)) {
  b.id = getBossId(b);
  b.portrait = getBossPortrait(b);
  // Make the round explicit on the boss object too (existing entries lacked it).
  if (b.round === undefined) b.round = Number(round);
}
