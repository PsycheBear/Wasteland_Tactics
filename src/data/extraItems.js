// === EXTRA COMPLETED ITEMS (Wave 1, integrated by Wave 2) ===
//
// Same schema as COMPLETED_ITEMS in items.js. Each entry has:
//   { name, icon, iconImg, recipe: [componentIdA, componentIdB], effects, desc }
//
// Integration note (Wave 2):
// The 6 original components produced 21 pairs, all of which items.js already
// fills. Wave 2 added a 7th component, `plasma_core`, which opens 7 new pairs
// (plasma_core + each existing component + plasma_core+plasma_core). The four
// extras below now claim four of those new slots — no collisions with the
// original 21. The `_replaces` hint field from Wave 1 was dropped because
// Wave 2 added a new component rather than swapping a recipe.
//
// Icon field is intentionally empty; GameIcon falls through to iconImg.
import { BASE } from '../baseUrl.js';

export const extraItems = [
  {
    // Crit-damage carry item built from a stacked plasma core.
    name: 'Plasma Cleaver',
    icon: '',
    iconImg: `${BASE}/images/icons/item-plasma-cleaver.svg`,
    recipe: ['plasma_core', 'plasma_core'],
    effects: { atk: 30, critChance: 0.2, critMult: 0.5 },
    desc: '+30 ATK, +20% crit chance, +50% crit damage',
  },
  {
    // AoE-on-death payload, built from plasma + fusion (high-energy).
    name: 'Bottle Cap Mine',
    icon: '',
    iconImg: `${BASE}/images/icons/item-bottle-cap-mine.svg`,
    recipe: ['plasma_core', 'fusion_cell'],
    effects: { aoeOnDeath: 250, abilityPower: 0.15 },
    desc: 'On death, explode for 250 AoE damage; +15% ability power',
  },
  {
    // Defensive sustain item built from plasma + scrap (rad-hardened plating).
    name: 'Rad-Hardened Plating',
    icon: '',
    iconImg: `${BASE}/images/icons/item-rad-hardened-plating.svg`,
    recipe: ['plasma_core', 'scrap_metal'],
    effects: { hp: 150, def: 25, poisonImmune: true, regenPerTick: 0.02 },
    desc: '+150 HP, +25 DEF, poison immune, regen 2% max HP/4s',
  },
  {
    // Tanky utility helm: stun immunity is the headliner.
    name: 'T-60 Power Helmet',
    icon: '',
    iconImg: `${BASE}/images/icons/item-t60-power-helmet.svg`,
    recipe: ['plasma_core', 'targeting_module'],
    effects: { hp: 150, def: 15, apGain: 0.1, stunResist: true },
    desc: '+150 HP, +15 DEF, +10% AP gain, stun immune',
  },
];
