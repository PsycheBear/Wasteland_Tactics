// === AUGMENT SYSTEM ===
//
// All augments declare both an `icon` (legacy emoji fallback) and an
// `iconImg` (SVG path under public/images/icons/aug-*.svg). The project no
// longer renders emojis — the icon strings are intentionally empty and
// GameIcon renders the iconImg instead. See GameIcon.jsx for the lookup.
import { BASE } from '../baseUrl.js';
import { extraAugments } from './extraAugments.js';
import { CHARACTER_AUGMENTS } from './characterAugments.js';
export const AUGMENT_POOL = [
  { id: 'vault_training', name: 'Vault-Tec Training', icon: '', iconImg: `${BASE}/images/icons/aug-vault-training.svg`, desc: '+5 ATK to all units', effect: { atkAdd: 5 } },
  { id: 'rad_resist', name: 'Rad Resistance', icon: '', iconImg: `${BASE}/images/icons/aug-rad-resist.svg`, desc: 'All units take 15% less ability damage', effect: { abilityResist: 0.15 } },
  { id: 'scavenger', name: 'Scavenger', icon: '', iconImg: `${BASE}/images/icons/aug-scavenger.svg`, desc: '+1 gold per round', effect: { bonusGold: 1 } },
  { id: 'overclocked', name: 'Overclocked', icon: '', iconImg: `${BASE}/images/icons/aug-overclocked.svg`, desc: 'Units gain AP 20% faster', effect: { apGainMult: 0.2 } },
  { id: 'wasteland_hard', name: 'Wasteland Hardened', icon: '', iconImg: `${BASE}/images/icons/aug-wasteland-hard.svg`, desc: '+100 HP to all units', effect: { hpAdd: 100 } },
  { id: 'trigger_disc', name: 'Trigger Discipline', icon: '', iconImg: `${BASE}/images/icons/aug-trigger-disc.svg`, desc: '+10% crit chance', effect: { critAdd: 0.1 } },
  { id: 'pack_rat', name: 'Pack Rat', icon: '', iconImg: `${BASE}/images/icons/aug-pack-rat.svg`, desc: '+2 bench slots', effect: { benchAdd: 2 } },
  { id: 'arms_dealer', name: 'Arms Dealer', icon: '', iconImg: `${BASE}/images/icons/aug-arms-dealer.svg`, desc: 'Item stat bonuses +50%', effect: { itemMult: 1.5 } },
  { id: 'fast_learner', name: 'Fast Learner', icon: '', iconImg: `${BASE}/images/icons/aug-fast-learner.svg`, desc: '+1 XP per round', effect: { bonusXp: 1 } },
  { id: 'field_medic', name: 'Field Medic', icon: '', iconImg: `${BASE}/images/icons/aug-field-medic.svg`, desc: 'Support synergy heal doubled', effect: { healMult: 2 } },
  { id: 'guerrilla', name: 'Guerrilla Tactics', icon: '', iconImg: `${BASE}/images/icons/aug-guerrilla.svg`, desc: 'First strike deals 2x damage', effect: { firstStrikeMult: 2 } },
  { id: 'fortified', name: 'Fortified Position', icon: '', iconImg: `${BASE}/images/icons/aug-fortified.svg`, desc: '+20 DEF to all units', effect: { defAdd: 20 } },
  { id: 'nuka_addict', name: 'Nuka Addict', icon: '', iconImg: `${BASE}/images/icons/aug-nuka-addict.svg`, desc: 'Abilities deal 15% more damage', effect: { abilityDmgMult: 0.15 } },
  { id: 'econ_scale', name: 'Economy of Scale', icon: '', iconImg: `${BASE}/images/icons/aug-econ-scale.svg`, desc: 'Interest cap raised to 7', effect: { interestCap: 7 } },
  { id: 'lucky_find', name: 'Lucky Find', icon: '', iconImg: `${BASE}/images/icons/aug-lucky-find.svg`, desc: '20% chance of free shop reroll', effect: { freeReroll: 0.2 } },
  { id: 'high_roller', name: 'High Roller', icon: '', iconImg: `${BASE}/images/icons/aug-high-roller.svg`, desc: 'One free re-spin per Lucky 38 round', effect: { reSpinLucky38: true } },
  // Spread Wave 1 extras at the bottom of the pool. Same schema, same offer path.
  ...extraAugments,
  // Character-tied augments (Cait / Robot Dog / Virgil). They surface in the
  // regular offer flow; Game.jsx handles their imperative grant/transform side-effects.
  ...CHARACTER_AUGMENTS,
];
