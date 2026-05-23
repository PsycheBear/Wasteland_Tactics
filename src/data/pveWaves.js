// Themed PvE creep waves — TFT-style PvE rounds with named creeps.
// The combat engine still generates enemies the existing way; this file
// only supplies a *theme* (name, flavour, icon, log lines) that the UI
// surfaces during PvE rounds so they don't feel like generic ghost fights.
//
// Keyed by round number. Round 1-3 are the always-PvE opening; rounds
// 8 / 15 / 22 / 29 are between-boss PvE waves with stronger themes.

export const PVE_WAVES = {
  1: {
    name: 'Radroach Swarm',
    flavour: 'A skittering tide of irradiated vermin.',
    icon: '🪳', // 🪳
    color: '#a06030',
    logLine: '🪳 Radroaches emerge from the rubble!',
  },
  2: {
    name: 'Mole Rat Nest',
    flavour: 'Bristly hide, weak armour — drop fast or get bit.',
    icon: '🐀', // 🐀
    color: '#8a6b3a',
    logLine: '🐀 Mole rats burrow up underfoot!',
  },
  3: {
    name: 'Feral Ghouls',
    flavour: 'Shambling, fast, and they pile in fours.',
    icon: '☣️', // ☣️
    color: '#669933',
    logLine: '☣️ Feral ghouls charge from the wastes!',
  },
  8: {
    name: 'Yao Guai Pack',
    flavour: 'Rad-bears. They hit like trucks. Tank them.',
    icon: '🐻', // 🐻
    color: '#5a3a20',
    logLine: '🐻 A Yao Guai pack closes in!',
  },
  15: {
    name: 'Super Mutant Strike',
    flavour: 'Big, green, angry. Pack item parts dropped at the end.',
    icon: '👹', // 👹
    color: '#558844',
    logLine: '👹 Super Mutants smash through!',
  },
  22: {
    name: 'Mirelurk Hunters',
    flavour: 'Shelled, fast, and they target your back line.',
    icon: '🦀', // 🦀
    color: '#446688',
    logLine: '🦀 Mirelurks scuttle out of the muck!',
  },
  29: {
    name: 'Glowing Horde',
    flavour: 'Radiation-soaked feral ghouls — they explode on death.',
    icon: '💥', // 💥
    color: '#88cc44',
    logLine: '💥 The Glowing Horde descends!',
  },
};

// Rounds that should be PvE even though they aren't 1-3 or a boss round.
export const EXTRA_PVE_ROUNDS = [8, 15, 22, 29];

export function isPveRound(round) {
  if (round <= 3) return true;
  if (EXTRA_PVE_ROUNDS.includes(round)) return true;
  return false;
}

export function getPveWave(round) {
  return PVE_WAVES[round] || null;
}
