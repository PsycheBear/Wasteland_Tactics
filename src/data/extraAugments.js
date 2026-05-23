// === EXTRA AUGMENTS (Wave 1) ===
// Same schema as AUGMENT_POOL entries in augments.js. A later wave will spread
// these into the existing pool. Icon image paths follow the project's naming
// convention (`aug-<id-with-dashes>.svg`); art for these may not exist yet,
// in which case the unicode `icon` field is the safe fallback.
import { BASE } from '../baseUrl.js';

export const extraAugments = [
  {
    id: 'mysterious_stranger',
    name: 'Mysterious Stranger',
    icon: '🕵️', // detective in coat
    iconImg: `${BASE}/images/icons/aug-mysterious-stranger.svg`,
    desc: '10% chance on attack to deal a 250 damage burst',
    effect: { strangerProc: 0.1, strangerDmg: 250 },
  },
  {
    id: 'hardened',
    name: 'Hardened',
    icon: '🛡️', // shield
    iconImg: `${BASE}/images/icons/aug-hardened.svg`,
    desc: 'First incoming damage each round is reduced to 0 for all units',
    effect: { firstHitImmunity: true },
  },
  {
    id: 'trigger_disc_2',
    name: 'Trigger Discipline II',
    icon: '🎯', // bullseye
    iconImg: `${BASE}/images/icons/aug-trigger-disc-2.svg`,
    desc: '+15% crit chance for ranged ballistic-weapon units',
    effect: { ballisticCritAdd: 0.15 },
  },
  {
    id: 'vault_resilience',
    name: 'Vault Resilience',
    icon: '🏠', // house / vault shelter
    iconImg: `${BASE}/images/icons/aug-vault-resilience.svg`,
    desc: '+20% HP to all units that share at least 2 traits with another ally',
    effect: { sharedTraitHpMult: 0.2, sharedTraitThreshold: 2 },
  },
];
