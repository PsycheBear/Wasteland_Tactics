// === ITEM SYSTEM ===
import { BASE } from '../baseUrl.js';
import { extraItems } from './extraItems.js';
export const ITEM_COMPONENTS = {
  scrap_metal: { name: 'Scrap Metal', icon: '\uD83D\uDD29', iconImg: `${BASE}/images/icons/item-scrap-metal.svg`, stat: 'def', value: 15, desc: '+15 DEF' },
  stimpak: { name: 'Stimpak', icon: '\uD83D\uDC89', iconImg: `${BASE}/images/icons/item-stimpak.png`, stat: 'hp', value: 200, desc: '+200 HP' },
  fusion_cell: { name: 'Fusion Core', icon: '\uD83D\uDD0B', iconImg: `${BASE}/images/icons/item-fusion-cell.png`, stat: 'atk', value: 15, desc: '+15 ATK' },
  targeting_module: { name: 'Targeting Module', icon: '\uD83C\uDFAF', iconImg: `${BASE}/images/icons/item-targeting-module.svg`, stat: 'apGain', value: 0.15, desc: '+15% AP gain' },
  stealth_boy: { name: 'Stealth Boy', icon: '\uD83D\uDC7B', iconImg: `${BASE}/images/icons/item-stealth-boy.png`, stat: 'dodge', value: 0.15, desc: '+15% dodge' },
  nuka_quantum: { name: 'Nuka-Cola Quantum', icon: '\uD83E\uDD64', iconImg: `${BASE}/images/icons/item-nuka-quantum.svg`, stat: 'abilityPower', value: 0.2, desc: '+20% ability power' },
  // 7th component \u2014 opens 7 new recipe pairs (plasma_core + each existing comp + plasma_core+plasma_core).
  // Flavor: a glowing green plasma cell drop. Used by the extra items wired in below.
  plasma_core: { name: 'Plasma Core', icon: '\uD83D\uDFE2', iconImg: `${BASE}/images/icons/item-plasma-core.svg`, stat: 'abilityPower', value: 0.15, desc: '+15% ability power' },
};
export const ITEM_COMPONENT_KEYS = Object.keys(ITEM_COMPONENTS);

export const COMPLETED_ITEMS = {
  power_armor: { name: 'Power Armor Frame', icon: '\uD83D\uDEE1\uFE0F', iconImg: `${BASE}/images/icons/item-power-armor.svg`, recipe: ['scrap_metal', 'scrap_metal'], effects: { def: 40, damageReduction: 0.15 }, desc: '+40 DEF, 15% damage reduction' },
  super_stimpak: { name: 'Super Stimpak', icon: '\uD83D\uDC8A', iconImg: `${BASE}/images/icons/item-super-stimpak.svg`, recipe: ['stimpak', 'stimpak'], effects: { emergencyHeal: 0.25 }, desc: 'Heal 25% max HP when first below 50%' },
  gauss_rifle: { name: 'Gauss Rifle', icon: '\uD83D\uDD2B', iconImg: `${BASE}/images/icons/item-gauss-rifle.svg`, recipe: ['fusion_cell', 'fusion_cell'], effects: { atk: 35, defPierce: 0.5 }, desc: '+35 ATK, pierce 50% DEF' },
  vats_module: { name: 'V.A.T.S. Module', icon: '\uD83D\uDCE1', iconImg: `${BASE}/images/icons/item-vats-module.svg`, recipe: ['targeting_module', 'targeting_module'], effects: { startAp: 0.5, apGainBonus: 0.3 }, desc: 'Start 50% AP, +30% AP gain' },
  stealth_suit: { name: 'Chinese Stealth Suit', icon: '\uD83E\uDD77', iconImg: `${BASE}/images/icons/item-stealth-suit.svg`, recipe: ['stealth_boy', 'stealth_boy'], effects: { dodge: 0.3, invisibleTicks: 6 }, desc: '30% dodge, invisible first 3s' },
  nuka_grenade: { name: 'Nuka Grenade', icon: '\uD83D\uDCA3', iconImg: `${BASE}/images/icons/item-nuka-grenade.svg`, recipe: ['nuka_quantum', 'fusion_cell'], effects: { abilitySplash: 0.25 }, desc: 'Ability deals 25% bonus AoE splash' },
  rad_suit: { name: 'Rad Resistance Suit', icon: '\u2622\uFE0F', iconImg: `${BASE}/images/icons/item-rad-suit.svg`, recipe: ['stimpak', 'scrap_metal'], effects: { hp: 200, def: 20, poisonImmune: true }, desc: '+200 HP, +20 DEF, poison immune' },
  jet_injector: { name: 'Jet Injector', icon: '\uD83D\uDCA8', iconImg: `${BASE}/images/icons/item-jet-injector.svg`, recipe: ['nuka_quantum', 'stimpak'], effects: { abilityHeal: 0.15 }, desc: 'On ability cast, heal 15% max HP' },
  combat_rifle: { name: 'Combat Rifle', icon: '\uD83D\uDD2B', iconImg: `${BASE}/images/icons/item-combat-rifle.svg`, recipe: ['fusion_cell', 'targeting_module'], effects: { atk: 20, tripleHit: 3 }, desc: '+20 ATK, every 3rd attack deals 2x' },
  chameleon_armor: { name: 'Chameleon Armor', icon: '\uD83E\uDD8E', iconImg: `${BASE}/images/icons/item-chameleon-armor.svg`, recipe: ['stealth_boy', 'scrap_metal'], effects: { def: 20, dodge: 0.2 }, desc: '+20 DEF, 20% dodge' },
  // Full combination grid — every component pair produces an item
  nuka_nuke: { name: 'Nuka-Nuke Launcher', icon: '\u2622\uFE0F', iconImg: `${BASE}/images/icons/item-nuka-nuke.svg`, recipe: ['nuka_quantum', 'nuka_quantum'], effects: { abilityPower: 0.45, burnOnAbility: 80 }, desc: '+45% ability power, ability burns for 80 dmg' },
  irradiated_blade: { name: 'Irradiated Blade', icon: '\u2694\uFE0F', iconImg: `${BASE}/images/icons/item-irradiated-blade.svg`, recipe: ['nuka_quantum', 'scrap_metal'], effects: { def: 15, abilityPower: 0.15, poisonOnHit: 30 }, desc: '+15 DEF, +15% ability power, attacks poison for 30 dmg' },
  quantum_scope: { name: 'Quantum Scope', icon: '\uD83D\uDD2D', iconImg: `${BASE}/images/icons/item-quantum-scope.svg`, recipe: ['nuka_quantum', 'targeting_module'], effects: { abilityPower: 0.2, critOnAbility: 0.35 }, desc: '+20% ability power, 35% ability crit chance' },
  phantom_device: { name: 'Phantom Device', icon: '\uD83C\uDF00', iconImg: `${BASE}/images/icons/item-phantom-device.svg`, recipe: ['nuka_quantum', 'stealth_boy'], effects: { abilityPower: 0.15, dodge: 0.15, invisOnAbility: 4 }, desc: '+15% AP, +15% dodge, invisible 2s after ability' },
  stim_rifle: { name: 'Medic\'s Rifle', icon: '\uD83C\uDFE5', iconImg: `${BASE}/images/icons/item-stim-rifle.svg`, recipe: ['stimpak', 'fusion_cell'], effects: { atk: 15, healOnKill: 150 }, desc: '+15 ATK, heal 150 HP on kill' },
  combat_medic: { name: 'Combat Medic Kit', icon: '\uD83E\uDE7A', iconImg: `${BASE}/images/icons/item-combat-medic.svg`, recipe: ['stimpak', 'targeting_module'], effects: { hp: 150, apGain: 0.1, healAllyOnAbility: 80 }, desc: '+150 HP, +10% AP gain, ability heals lowest ally 80' },
  cloak_stim: { name: 'Cloaked Stimpak', icon: '\uD83D\uDCAB', iconImg: `${BASE}/images/icons/item-cloak-stim.svg`, recipe: ['stimpak', 'stealth_boy'], effects: { hp: 150, dodge: 0.15, healOnDodge: 50 }, desc: '+150 HP, +15% dodge, heal 50 on dodge' },
  ballistic_weave: { name: 'Ballistic Weave', icon: '\uD83E\uDDF5', iconImg: `${BASE}/images/icons/item-ballistic-weave.svg`, recipe: ['scrap_metal', 'fusion_cell'], effects: { def: 20, atk: 15, reflectDamage: 0.1 }, desc: '+20 DEF, +15 ATK, reflect 10% damage' },
  fortified_helm: { name: 'Fortified Helm', icon: '\u26D1\uFE0F', iconImg: `${BASE}/images/icons/item-fortified-helm.svg`, recipe: ['scrap_metal', 'targeting_module'], effects: { def: 20, apGain: 0.1, stunResist: true }, desc: '+20 DEF, +10% AP gain, stun immune' },
  infiltrator_kit: { name: 'Infiltrator\'s Kit', icon: '\uD83D\uDDE1\uFE0F', iconImg: `${BASE}/images/icons/item-infiltrator-kit.svg`, recipe: ['targeting_module', 'stealth_boy'], effects: { apGain: 0.1, dodge: 0.15, bonusDmgFromStealth: 0.3 }, desc: '+10% AP gain, +15% dodge, +30% dmg from stealth' },
  laser_sight: { name: 'Laser Sight Barrel', icon: '\uD83D\uDD26', iconImg: `${BASE}/images/icons/item-laser-sight.svg`, recipe: ['fusion_cell', 'stealth_boy'], effects: { atk: 15, dodge: 0.1, critChance: 0.2 }, desc: '+15 ATK, +10% dodge, +20% crit chance' },
};

// Spread Wave 1 extras into the completed-items table. They use the new
// `plasma_core` component so no recipe collisions are possible.
// Keys are slugified from the display name (e.g. "Plasma Cleaver" \u2192 "plasma_cleaver").
for (const xi of extraItems) {
  const key = xi.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  COMPLETED_ITEMS[key] = { name: xi.name, icon: xi.icon, iconImg: xi.iconImg, recipe: xi.recipe, effects: xi.effects, desc: xi.desc };
}

export const findCompletedItem = (comp1, comp2) => {
  return Object.entries(COMPLETED_ITEMS).find(([key, item]) => {
    const r = item.recipe;
    return (r[0] === comp1 && r[1] === comp2) || (r[0] === comp2 && r[1] === comp1);
  });
};

export const getRandomComponent = () => ITEM_COMPONENT_KEYS[Math.floor(Math.random() * ITEM_COMPONENT_KEYS.length)];
