// === CHARACTER-TIED AUGMENTS ===
//
// Three augments tied to specific characters. Per spec, they are RANDOM
// augments in the regular pool (not locked behind owning the unit). The
// Cait/Virgil augments hand the player a free copy of the unit; the
// Dogmeat augment transforms the player's strongest Dogmeat into Robot Dog.
//
// Schema:
//   id           — kebab-case identifier (matches AUGMENT_POOL convention)
//   name, desc   — UI strings
//   icon         — unicode fallback
//   iconImg      — augment art under public/images/units/<id>/augment.webp
//   effect       — empty {} (these augments are handled imperatively in Game.jsx)
//   grantUnit    — { id, stars } to add to bench when offered
//   transformUnit — { from, to } to transform the strongest matching unit
//   characterTied — flag for the offer logic / UI to highlight these

import { BASE } from '../baseUrl.js';

export const CHARACTER_AUGMENTS = [
  {
    id: 'aug_cait_drug',
    name: 'Combat Drug Habit',
    desc: 'Adds a free Cait to your bench.',
    icon: '',
    iconImg: `${BASE}/images/units/cait/augment.webp`,
    effect: { grantUnitId: 'cait', grantStars: 1 },
    grantUnit: { id: 'cait', stars: 1 },
    characterTied: true,
  },
  {
    id: 'aug_robot_dog',
    name: 'Robot Dog',
    desc: 'Converts your strongest Dogmeat into Robot Dog (cleave attack, dual-target stun). If no Dogmeat owned, grants a 1★ Robot Dog.',
    icon: '',
    iconImg: `${BASE}/images/units/dogmeat/augment.webp`,
    effect: { transformFromId: 'dogmeat', transformToId: 'robot-dog' },
    transformUnit: { from: 'dogmeat', to: 'robot-dog' },
    fallbackGrantUnit: { id: 'robot-dog', stars: 1 },
    characterTied: true,
  },
  {
    id: 'aug_virgil_fev',
    name: 'FEV Cure Sample',
    desc: 'Adds a free Virgil to your bench.',
    icon: '',
    iconImg: `${BASE}/images/units/virgil/augment.webp`,
    effect: { grantUnitId: 'virgil', grantStars: 1 },
    grantUnit: { id: 'virgil', stars: 1 },
    characterTied: true,
  },
];
