// Themed PvE creep waves — TFT-style PvE rounds.
//
// TFT pattern: 3 opening PvE rounds (1, 2, 3) plus 1 mid-stage PvE round at
// the start of each new stage (8, 15, 22, 29, 36). 8 PvE rounds total.
//
// `creeps` lists the kebab-case creep IDs used by combat.js. They map to
// portraits under public/images/pve/<creep-id>.png. Each wave fields a
// homogenous group (TFT style); the engine still rolls the cost/stat curve.
//
// `dropTier` controls what the player picks at the end of the round:
//   - 'component' (default) → 3 choices of single item components
//   - 'completed'           → 3 choices of fully-built items (round 36 only)
//
// Iconography note: emojis were removed in favor of SVGs. Each wave declares
// `iconImg` (under public/images/icons/wave-<id>.svg) which the UI loads
// through GameIcon. The `icon` field is kept (empty string) for the
// emoji-fallback API shape — GameIcon prefers iconImg when present.
//
// Log lines prefix with [PVE] so Game.jsx's LOG_EMOJI_MAP renders a
// colored badge instead of an emoji glyph.

import { BASE } from '../baseUrl.js';

export const PVE_WAVES = {
  1: {
    name: 'Raider Gang',
    flavour: 'A handful of pipe-rifle thugs spoiling for trouble.',
    creeps: ['raider-1', 'raider-2'],
    icon: '',
    iconImg: `${BASE}/images/icons/wave-raider.svg`,
    color: '#a06030',
    logLine: '[PVE] A Raider Gang ambushes you!',
    dropTier: 'component',
  },
  2: {
    name: 'Triggerman Hit',
    flavour: 'Goodneighbor leftovers in matching suits and tommyguns.',
    creeps: ['triggerman', 'gunner'],
    icon: '',
    iconImg: `${BASE}/images/icons/wave-triggerman.svg`,
    color: '#7a5a30',
    logLine: '[PVE] Triggermen open fire from the alleys!',
    dropTier: 'component',
  },
  3: {
    name: 'The Pack',
    flavour: 'Nuka-World gang on too much Psycho.',
    creeps: ['pack-1', 'pack-2'],
    icon: '',
    iconImg: `${BASE}/images/icons/wave-pack.svg`,
    color: '#883344',
    logLine: '[PVE] The Pack howls and charges!',
    dropTier: 'component',
  },
  8: {
    name: 'Hood Disciples',
    flavour: 'Cult of Atom acolytes wreathed in radiation.',
    creeps: ['hood-disciple-1', 'hood-disciple-2'],
    icon: '',
    iconImg: `${BASE}/images/icons/wave-hood-disciple.svg`,
    color: '#669933',
    logLine: '[PVE] Hood Disciples emerge from the glow!',
    dropTier: 'component',
  },
  15: {
    name: 'Talon Company',
    flavour: 'Mercenaries in matching armor, paid to kill you specifically.',
    creeps: ['talon-company-1', 'talon-company-2'],
    icon: '',
    iconImg: `${BASE}/images/icons/wave-talon.svg`,
    color: '#555555',
    logLine: '[PVE] Talon Company moves in!',
    dropTier: 'component',
  },
  22: {
    name: 'Super Mutants',
    flavour: 'Big, green, angry. Pack item parts dropped at the end.',
    creeps: ['super-mutant'],
    icon: '',
    iconImg: `${BASE}/images/icons/wave-super-mutant.svg`,
    color: '#558844',
    logLine: '[PVE] Super Mutants smash through!',
    dropTier: 'component',
  },
  29: {
    name: 'Glowing Horde',
    flavour: 'Radiation-soaked feral ghouls — they explode on death.',
    creeps: ['glowing-one'],
    icon: '',
    iconImg: `${BASE}/images/icons/wave-glowing-horde.svg`,
    color: '#88cc44',
    logLine: '[PVE] The Glowing Horde descends!',
    dropTier: 'component',
  },
  36: {
    name: 'Sentry Bots',
    flavour: 'Pre-war military hardware, rusted but operational.',
    creeps: ['sentry-bot', 'sentry-bot-rusty'],
    icon: '',
    iconImg: `${BASE}/images/icons/wave-sentry-bot.svg`,
    color: '#888899',
    logLine: '[PVE] Sentry Bots activate and acquire targets!',
    // TFT 4-7 "Raptors" — late-game PvE round drops a fully-completed item.
    dropTier: 'completed',
  },
};

// Rounds that should be PvE even though they aren't 1-3 or a boss round.
export const EXTRA_PVE_ROUNDS = [8, 15, 22, 29, 36];

export function isPveRound(round) {
  if (round <= 3) return true;
  if (EXTRA_PVE_ROUNDS.includes(round)) return true;
  return false;
}

export function getPveWave(round) {
  return PVE_WAVES[round] || null;
}
