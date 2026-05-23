// === UNIT ROSTER ===
//
// 37 playable units + Robot Dog (Dogmeat-augment transform target).
//
// Schema:
//   id           — kebab-case key (e.g. 'sole-survivor')
//   name         — display name (Title Case)
//   cost         — 1..5
//   range        — 'melee' | 'ranged' | 'dual'   (kind; UI metadata)
//   faction      — one of TRAITS faction IDs
//   role         — one of TRAITS role IDs (vanguard/sniper/caster/medic)
//   traits       — [faction, role] (always 2 entries; combat reads these)
//   portraitBase — directory under public/ — UI agent reads <portraitBase>/<star>.png
//   attackRange  — numeric distance the auto-attack reaches (1 melee, 2-4 ranged)
//   hp, atk, def, attackSpeed, apMax, apGain, apOnHit
//   ability, abilityDesc, passiveDesc — UI labels (combat.js holds the impl)
//
// IDs preserved from the previous wave so combat.js ability switch keeps working:
//   preston, sturges, dogmeat, moira, piper, cait, hancock, nick, maccready,
//   strong, danse, dima, fahrenheit, curie, deacon, maxson, kellogg.
//   deathclaw is kept as a unit entry too (it's also a boss elsewhere).
//
// Stat baselines by cost (see spec):
//   Cost 1: HP 500 ATK 40 DEF 30   AP 100
//   Cost 2: HP 700 ATK 55 DEF 40   AP 100
//   Cost 3: HP 950 ATK 75 DEF 50   AP 100
//   Cost 4: HP 1300 ATK 100 DEF 65 AP 100
//   Cost 5: HP 1800 ATK 130 DEF 80 AP 100
// Modifiers (cumulative):
//   melee   +30% HP, +20% DEF
//   sniper  +15% ATK, +1 attackRange
//   caster  +20% AP gain, -10% ATK
//   vanguard +20% HP, +15% DEF
//   medic   heal-ability scaling (handled via ability text)

import { BASE } from '../baseUrl.js';

// Animation classification: melee units swing in close, dual units flip on positional rules.
// Combat.js still uses this for forward-lunge animation timing.
export const MELEE_UNITS = [
  'dogmeat', 'cait', 'sturges', 'strong', 'pickman', 'zeek',
  'deathclaw', 'robot-dog',
];
export const isMeleeUnit = (unitId) => MELEE_UNITS.includes(unitId);

// Units whose `range` is 'dual' — melee in front rows, ranged in back rows.
// Combat.js (Agent C) decides per-fight which mode they enter.
export const DUAL_RANGE_UNITS = ['hancock', 'sarah-lyon', 'sole-survivor'];
export const isDualRangeUnit = (unitId) => DUAL_RANGE_UNITS.includes(unitId);

// Unit IDs that should NOT appear in the shop pool (transform targets, etc).
export const NON_SHOPPABLE_UNITS = ['robot-dog'];

// Portrait helper. The UI agent reads <portraitBase>/<star>.png; this legacy
// helper returns the single-file fallback used by older UI paths.
export const getUnitPortrait = (unitId) => unitId ? `${BASE}/images/units/${unitId}.png` : null;

export const UNIT_DATABASE = {
  // ═══ COST 1 (12 units) ════════════════════════════════════════════════
  cade: {
    name: 'Cade', cost: 1, range: 'ranged',
    faction: 'brotherhood', role: 'medic',
    traits: ['brotherhood', 'medic'],
    portraitBase: 'images/units/cade',
    hp: 500, atk: 40, def: 30, attackRange: 2, attackSpeed: 0.95,
    apMax: 100, apGain: 12, apOnHit: 10,
    ability: 'Field Triage', abilityDesc: 'Heals lowest HP ally for 120 HP',
    passiveDesc: "Knight-Captain's Order: healed allies gain +10 DEF for 4s",
  },
  curie: {
    name: 'Curie', cost: 1, range: 'ranged',
    faction: 'vault-dweller', role: 'medic',
    traits: ['vault-dweller', 'medic'],
    portraitBase: 'images/units/curie',
    hp: 500, atk: 40, def: 30, attackRange: 2, attackSpeed: 0.9,
    apMax: 100, apGain: 12, apOnHit: 12,
    ability: 'Emergency Protocol', abilityDesc: 'Heals all allies for 80 HP',
    passiveDesc: 'Medical Marvels: healed allies gain +15% attack speed for 3s',
  },
  dogmeat: {
    name: 'Dogmeat', cost: 1, range: 'melee',
    faction: 'wastelander', role: 'medic',
    traits: ['wastelander', 'medic'],
    portraitBase: 'images/units/dogmeat',
    hp: 650, atk: 40, def: 36, attackRange: 1, attackSpeed: 0.65,
    apMax: 100, apGain: 14, apOnHit: 12,
    ability: 'Attack Dog', abilityDesc: 'Pounces on highest ATK enemy, stunning them',
    passiveDesc: 'Good Boy: +1 bonus caps on victory',
  },
  glory: {
    name: 'Glory', cost: 1, range: 'ranged',
    faction: 'railroad', role: 'vanguard',
    traits: ['railroad', 'vanguard'],
    portraitBase: 'images/units/glory',
    hp: 600, atk: 40, def: 35, attackRange: 2, attackSpeed: 0.9,
    apMax: 100, apGain: 12, apOnHit: 12,
    ability: 'Minigun Spray', abilityDesc: 'AoE shower hits up to 4 enemies for 70 each',
    passiveDesc: "Heavy's Stance: 10% damage reduction while above 60% HP",
  },
  irma: {
    name: 'Irma', cost: 1, range: 'ranged',
    faction: 'goodneighbor', role: 'medic',
    traits: ['goodneighbor', 'medic'],
    portraitBase: 'images/units/irma',
    hp: 500, atk: 40, def: 30, attackRange: 2, attackSpeed: 0.95,
    apMax: 100, apGain: 12, apOnHit: 10,
    ability: "Madam's Mercy", abilityDesc: 'Heals two lowest-HP allies for 90 each',
    passiveDesc: 'Memory Den Calm: allies regen 2% HP every 4s near Irma',
  },
  maccready: {
    name: 'MacCready', cost: 1, range: 'ranged',
    faction: 'wastelander', role: 'sniper',
    traits: ['wastelander', 'sniper'],
    portraitBase: 'images/units/maccready',
    hp: 500, atk: 46, def: 30, attackRange: 3, attackSpeed: 1.0,
    apMax: 100, apGain: 12, apOnHit: 10,
    ability: 'Headshot', abilityDesc: 'Executes lowest HP enemy for 4x ATK damage',
    passiveDesc: 'Killshot: 20% chance for 2x crit on attacks',
  },
  magnolia: {
    name: 'Magnolia', cost: 1, range: 'ranged',
    faction: 'goodneighbor', role: 'caster',
    traits: ['goodneighbor', 'caster'],
    portraitBase: 'images/units/magnolia',
    hp: 500, atk: 36, def: 30, attackRange: 2, attackSpeed: 0.95,
    apMax: 100, apGain: 14, apOnHit: 10,
    ability: "Siren's Lull", abilityDesc: 'Charms highest ATK enemy, redirecting their attack for 4s',
    passiveDesc: 'Third Rail Jazz: allies start with 10% AP',
  },
  moira: {
    name: 'Moira Brown', cost: 1, range: 'ranged',
    faction: 'vault-dweller', role: 'caster',
    traits: ['vault-dweller', 'caster'],
    portraitBase: 'images/units/moira',
    hp: 500, atk: 36, def: 30, attackRange: 2, attackSpeed: 1.0,
    apMax: 100, apGain: 14, apOnHit: 10,
    ability: 'Experimental Serum', abilityDesc: 'Poisons 2 enemies, dealing 80 damage over 4s',
    passiveDesc: 'Wasteland Survival: team +15% damage resist',
  },
  preston: {
    name: 'Preston Garvey', cost: 1, range: 'ranged',
    faction: 'minutemen', role: 'sniper',
    traits: ['minutemen', 'sniper'],
    portraitBase: 'images/units/preston',
    hp: 500, atk: 46, def: 30, attackRange: 3, attackSpeed: 0.95,
    apMax: 100, apGain: 12, apOnHit: 10,
    ability: 'Rally Minutemen', abilityDesc: '+20% ATK to all allies for 4s',
    passiveDesc: "General's Inspiration: allies start with 20% AP",
  },
  ronnie: {
    name: 'Ronnie Shaw', cost: 1, range: 'ranged',
    faction: 'minutemen', role: 'sniper',
    traits: ['minutemen', 'sniper'],
    portraitBase: 'images/units/ronnie',
    hp: 500, atk: 46, def: 30, attackRange: 3, attackSpeed: 0.95,
    apMax: 100, apGain: 12, apOnHit: 10,
    ability: 'Laser Musket Volley', abilityDesc: 'Charged blast hits highest HP enemy for 3x ATK',
    passiveDesc: 'Veteran Quartermaster: team +5 DEF',
  },
  sturges: {
    name: 'Sturges', cost: 1, range: 'melee',
    faction: 'minutemen', role: 'medic',
    traits: ['minutemen', 'medic'],
    portraitBase: 'images/units/sturges',
    hp: 650, atk: 40, def: 36, attackRange: 1, attackSpeed: 0.9,
    apMax: 100, apGain: 12, apOnHit: 12,
    ability: 'Repair Bot', abilityDesc: 'Heals lowest HP ally for 100 HP',
    passiveDesc: 'Scrap Armor: healed allies gain +10 DEF for 4s',
  },
  tom: {
    name: 'Tinker Tom', cost: 1, range: 'melee',
    faction: 'railroad', role: 'vanguard',
    traits: ['railroad', 'vanguard'],
    portraitBase: 'images/units/tom',
    hp: 650, atk: 42, def: 38, attackRange: 1, attackSpeed: 0.9,
    apMax: 100, apGain: 10, apOnHit: 12,
    ability: 'Conspiracy Wrench', abilityDesc: 'Bashes highest ATK enemy: 2.5x ATK + marks them for +30% damage taken (5s)',
    passiveDesc: 'Paranoid Engineer: Railroad allies +10% dodge',
  },

  // ═══ COST 2 (4 units) ═════════════════════════════════════════════════
  cait: {
    name: 'Cait', cost: 2, range: 'melee',
    faction: 'wastelander', role: 'vanguard',
    traits: ['wastelander', 'vanguard'],
    portraitBase: 'images/units/cait',
    hp: 1100, atk: 55, def: 55, attackRange: 1, attackSpeed: 0.7,
    apMax: 100, apGain: 16, apOnHit: 14,
    ability: 'Psycho', abilityDesc: '+30% ATK, -10% DEF for 5s',
    passiveDesc: 'Trigger Rush: below 30% HP, attack speed doubles',
  },
  deacon: {
    name: 'Deacon', cost: 2, range: 'ranged',
    faction: 'railroad', role: 'sniper',
    traits: ['railroad', 'sniper'],
    portraitBase: 'images/units/deacon',
    hp: 700, atk: 63, def: 40, attackRange: 4, attackSpeed: 0.85,
    apMax: 100, apGain: 14, apOnHit: 12,
    ability: 'Recall Code', abilityDesc: 'Becomes untargetable for 3s, then strikes random enemy for 2x ATK',
    passiveDesc: 'Master of Disguise: first ability costs 50% less AP',
  },
  nick: {
    name: 'Nick Valentine', cost: 2, range: 'ranged',
    faction: 'vault-dweller', role: 'medic',
    traits: ['vault-dweller', 'medic'],
    portraitBase: 'images/units/nick',
    hp: 700, atk: 55, def: 40, attackRange: 3, attackSpeed: 0.85,
    apMax: 100, apGain: 14, apOnHit: 14,
    ability: 'Suppression', abilityDesc: 'Silences the highest ATK enemy for 6s',
    passiveDesc: 'Synth Detective: marks lowest HP enemy, they take +20% damage',
  },
  piper: {
    name: 'Piper Wright', cost: 2, range: 'ranged',
    faction: 'vault-dweller', role: 'medic',
    traits: ['vault-dweller', 'medic'],
    portraitBase: 'images/units/piper',
    hp: 700, atk: 55, def: 40, attackRange: 3, attackSpeed: 0.95,
    apMax: 100, apGain: 12, apOnHit: 10,
    ability: 'Exposé', abilityDesc: 'Shreds highest DEF enemy, -50% DEF for 5s',
    passiveDesc: 'Public Occurrences: team +15% crit chance',
  },

  // ═══ COST 3 (6 units) ═════════════════════════════════════════════════
  fahrenheit: {
    name: 'Fahrenheit', cost: 3, range: 'ranged',
    faction: 'goodneighbor', role: 'medic',
    traits: ['goodneighbor', 'medic'],
    portraitBase: 'images/units/fahrenheit',
    hp: 950, atk: 75, def: 50, attackRange: 2, attackSpeed: 0.9,
    apMax: 100, apGain: 14, apOnHit: 12,
    ability: 'Incendiary Strike', abilityDesc: 'AoE blast dealing 100 damage + burn DoT',
    passiveDesc: 'Arsonist: attacks have 15% chance to burn for 50 DoT over 3s',
  },
  hancock: {
    name: 'Hancock', cost: 3, range: 'dual',
    faction: 'goodneighbor', role: 'caster',
    traits: ['goodneighbor', 'caster'],
    portraitBase: 'images/units/hancock',
    hp: 950, atk: 67, def: 50, attackRange: 2, attackSpeed: 0.95,
    apMax: 100, apGain: 16, apOnHit: 12,
    ability: 'Ghoulish Fury', abilityDesc: 'AoE radiation burst deals 150 damage to all enemies',
    passiveDesc: 'Of the People: heals allies 10% HP on kill',
  },
  ingram: {
    name: 'Proctor Ingram', cost: 3, range: 'ranged',
    faction: 'brotherhood', role: 'medic',
    traits: ['brotherhood', 'medic'],
    portraitBase: 'images/units/ingram',
    hp: 950, atk: 75, def: 50, attackRange: 2, attackSpeed: 0.85,
    apMax: 100, apGain: 12, apOnHit: 12,
    ability: 'Power Armor Patch', abilityDesc: 'Shields lowest-HP ally for 200 + 30% DEF for 5s',
    passiveDesc: 'Field Repairs: revives lowest-HP ally to 35% HP once per combat',
  },
  'mother-isolde': {
    name: 'Mother Isolde', cost: 3, range: 'ranged',
    faction: 'wastelander', role: 'caster',
    traits: ['wastelander', 'caster'],
    portraitBase: 'images/units/mother-isolde',
    hp: 950, atk: 67, def: 50, attackRange: 3, attackSpeed: 0.9,
    apMax: 100, apGain: 16, apOnHit: 12,
    ability: 'Atom Communion', abilityDesc: 'Beam of radiation hits 3 enemies for 130 damage each',
    passiveDesc: 'Glow Devotion: nearby Wastelander allies gain +10% ATK',
  },
  pickman: {
    name: 'Pickman', cost: 3, range: 'melee',
    faction: 'wastelander', role: 'caster',
    traits: ['wastelander', 'caster'],
    portraitBase: 'images/units/pickman',
    hp: 1235, atk: 67, def: 60, attackRange: 1, attackSpeed: 0.75,
    apMax: 100, apGain: 16, apOnHit: 14,
    ability: 'Gallery Showpiece', abilityDesc: 'Slashes highest-HP enemy for 4x ATK and bleeds them',
    passiveDesc: 'Art Connoisseur: crits restore 10% AP',
  },
  strong: {
    name: 'Strong', cost: 3, range: 'melee',
    faction: 'wastelander', role: 'vanguard',
    traits: ['wastelander', 'vanguard'],
    portraitBase: 'images/units/strong',
    hp: 1480, atk: 75, def: 69, attackRange: 1, attackSpeed: 0.75,
    apMax: 100, apGain: 12, apOnHit: 15,
    ability: 'Berserker Rage', abilityDesc: '+50% ATK and gains 200 HP shield for 6s',
    passiveDesc: 'Unstoppable: immune to stun/silence, +5% max HP per kill',
  },

  // ═══ COST 4 (7 units) ═════════════════════════════════════════════════
  danse: {
    name: 'Paladin Danse', cost: 4, range: 'ranged',
    faction: 'brotherhood', role: 'vanguard',
    traits: ['brotherhood', 'vanguard'],
    portraitBase: 'images/units/danse',
    hp: 1560, atk: 100, def: 75, attackRange: 2, attackSpeed: 0.9,
    apMax: 100, apGain: 12, apOnHit: 12,
    ability: 'Ad Victoriam', abilityDesc: 'Laser blast hits all enemies for 150 damage',
    passiveDesc: 'Brotherhood Shield: on death, 400 AoE + allies gain +25% DEF',
  },
  desdemona: {
    name: 'Desdemona', cost: 4, range: 'ranged',
    faction: 'railroad', role: 'caster',
    traits: ['railroad', 'caster'],
    portraitBase: 'images/units/desdemona',
    hp: 1300, atk: 90, def: 65, attackRange: 3, attackSpeed: 0.9,
    apMax: 100, apGain: 16, apOnHit: 12,
    ability: 'Liberty Signal', abilityDesc: 'Smoke bomb: allies gain stealth + 50% AP for 4s',
    passiveDesc: 'Cell Commander: Railroad allies gain +20% dodge',
  },
  'jack-cabot': {
    name: 'Jack Cabot', cost: 4, range: 'ranged',
    faction: 'cabot', role: 'caster',
    traits: ['cabot', 'caster'],
    portraitBase: 'images/units/jack-cabot',
    hp: 1300, atk: 90, def: 65, attackRange: 3, attackSpeed: 0.85,
    apMax: 100, apGain: 16, apOnHit: 14,
    ability: 'Mesmetron Pulse', abilityDesc: 'Mind-controls 2 enemies, redirecting them for 5s',
    passiveDesc: 'Lorenzo Serum: starts combat with 100% AP (Cabot synergy)',
  },
  kellogg: {
    name: 'Kellogg', cost: 4, range: 'ranged',
    faction: 'wastelander', role: 'sniper',
    traits: ['wastelander', 'sniper'],
    portraitBase: 'images/units/kellogg',
    hp: 1300, atk: 115, def: 65, attackRange: 4, attackSpeed: 0.85,
    apMax: 100, apGain: 12, apOnHit: 12,
    ability: 'Cybernetic Override', abilityDesc: 'Stuns 2 enemies for 3s and deals 150 damage',
    passiveDesc: 'Immortal Synth: on death, revive with 30% HP once per combat',
  },
  'madison-li': {
    name: 'Madison Li', cost: 4, range: 'ranged',
    faction: 'brotherhood', role: 'caster',
    traits: ['brotherhood', 'caster'],
    portraitBase: 'images/units/madison-li',
    hp: 1300, atk: 90, def: 65, attackRange: 3, attackSpeed: 0.85,
    apMax: 100, apGain: 16, apOnHit: 12,
    ability: 'Prototype Discharge', abilityDesc: 'Arc-lightning chains across 3 enemies for 180 damage',
    passiveDesc: 'Director of Science: team abilities +15% effect',
  },
  'sarah-lyon': {
    name: 'Sarah Lyon', cost: 4, range: 'dual',
    faction: 'brotherhood', role: 'vanguard',
    traits: ['brotherhood', 'vanguard'],
    portraitBase: 'images/units/sarah-lyon',
    hp: 1560, atk: 100, def: 75, attackRange: 2, attackSpeed: 0.9,
    apMax: 100, apGain: 12, apOnHit: 14,
    ability: 'Pride Lead', abilityDesc: 'Charges to highest-ATK enemy: 250 damage + taunt 3s',
    passiveDesc: "Lyons' Pride: Brotherhood allies gain +15% DEF",
  },
  zeek: {
    name: 'Zeek', cost: 4, range: 'melee',
    faction: 'atom-cats', role: 'vanguard',
    traits: ['atom-cats', 'vanguard'],
    portraitBase: 'images/units/zeek',
    hp: 2028, atk: 100, def: 89, attackRange: 1, attackSpeed: 0.7,
    apMax: 100, apGain: 12, apOnHit: 14,
    ability: 'Power Punch', abilityDesc: 'Power-armor haymaker: 3x ATK + knockback stun 2s',
    passiveDesc: 'Cool Cat: reflects 15% damage taken (Atom Cats solo)',
  },

  // ═══ COST 5 (8 units) ═════════════════════════════════════════════════
  cross: {
    name: 'Paladin Cross', cost: 5, range: 'ranged',
    faction: 'brotherhood', role: 'vanguard',
    traits: ['brotherhood', 'vanguard'],
    portraitBase: 'images/units/cross',
    hp: 2160, atk: 130, def: 92, attackRange: 2, attackSpeed: 0.85,
    apMax: 100, apGain: 12, apOnHit: 14,
    ability: 'Lyon Vanguard', abilityDesc: 'Hammer slam: 300 damage + 20% DEF buff to nearby allies 6s',
    passiveDesc: 'Veteran Paladin: nearby allies gain +15 DEF',
  },
  dima: {
    name: 'DiMA', cost: 5, range: 'ranged',
    faction: 'institute', role: 'caster',
    traits: ['institute', 'caster'],
    portraitBase: 'images/units/dima',
    hp: 1800, atk: 117, def: 80, attackRange: 3, attackSpeed: 0.85,
    apMax: 100, apGain: 16, apOnHit: 12,
    ability: 'Memory Lane', abilityDesc: 'Recalls an ally from death with 40% HP',
    passiveDesc: 'Perfect Recall: revives 2 allies, both with full AP',
  },
  maxson: {
    name: 'Elder Maxson', cost: 5, range: 'ranged',
    faction: 'brotherhood', role: 'vanguard',
    traits: ['brotherhood', 'vanguard'],
    portraitBase: 'images/units/maxson',
    hp: 2160, atk: 130, def: 92, attackRange: 3, attackSpeed: 0.9,
    apMax: 100, apGain: 12, apOnHit: 12,
    ability: 'Final Judgment', abilityDesc: 'Gatling laser hits 3 random enemies for 250 damage each',
    passiveDesc: 'Steel Commander: Brotherhood units gain +20% ATK',
  },
  shaun: {
    name: 'Shaun (Father)', cost: 5, range: 'ranged',
    faction: 'institute', role: 'caster',
    traits: ['institute', 'caster'],
    portraitBase: 'images/units/shaun',
    hp: 1800, atk: 117, def: 80, attackRange: 3, attackSpeed: 0.85,
    apMax: 100, apGain: 16, apOnHit: 12,
    ability: 'Synth Genesis', abilityDesc: 'Spawns 2 synth assistants (300 HP) for 8s',
    passiveDesc: 'Institute Director: Institute allies +30% AP gain',
  },
  'silver-shroud': {
    name: 'The Silver Shroud', cost: 5, range: 'ranged',
    faction: 'goodneighbor', role: 'medic',
    traits: ['goodneighbor', 'medic'],
    portraitBase: 'images/units/silver-shroud',
    hp: 1800, atk: 130, def: 80, attackRange: 3, attackSpeed: 0.95,
    apMax: 100, apGain: 14, apOnHit: 14,
    ability: 'Vigilante Justice', abilityDesc: 'Heals all allies 200 + +20% ATK for 5s',
    passiveDesc: 'Pulp Hero: revives ALL fallen allies once per fight at 30% HP',
  },
  'sole-survivor': {
    name: 'Sole Survivor', cost: 5, range: 'dual',
    faction: 'vault-dweller', role: 'vanguard',
    traits: ['vault-dweller', 'vanguard'],
    portraitBase: 'images/units/sole-survivor',
    hp: 2160, atk: 130, def: 92, attackRange: 2, attackSpeed: 0.85,
    apMax: 100, apGain: 14, apOnHit: 14,
    ability: 'V.A.T.S. Burst', abilityDesc: 'Targeted volley: 4 hits on highest-ATK enemy for 1.5x ATK each',
    passiveDesc: "Survivor's Bond: +8% ATK/AP per adjacent FO4 companion (max 96%); +2 ATK/+20 HP per hit; +5 ATK/+50 HP/+1 DEF per round won",
    unique: true,           // never combines, no star levels
    notStarUpgradable: true,
    perAttackAtkGrowth: 2,
    perAttackHpGrowth: 20,
    perRoundAtkGrowth: 5,
    perRoundHpGrowth: 50,
    perRoundDefGrowth: 1,
    survivorBondMult: 0.08,  // +8% ATK/AP per adjacent FO4 companion
    shopCapPerRefresh: 1,
  },
  virgil: {
    name: 'Brian Virgil', cost: 5, range: 'ranged',
    faction: 'institute', role: 'caster',
    traits: ['institute', 'caster'],
    portraitBase: 'images/units/virgil',
    hp: 1800, atk: 117, def: 80, attackRange: 3, attackSpeed: 0.85,
    apMax: 100, apGain: 16, apOnHit: 12,
    ability: 'FEV Mutation', abilityDesc: 'Transforms an enemy into a fragile super mutant (350 HP) for 6s',
    passiveDesc: 'Renegade Scientist: -25% ability cost for allied casters',
  },
  'x6-88': {
    name: 'X6-88', cost: 5, range: 'ranged',
    faction: 'institute', role: 'sniper',
    traits: ['institute', 'sniper'],
    portraitBase: 'images/units/x6-88',
    hp: 1800, atk: 150, def: 80, attackRange: 4, attackSpeed: 0.9,
    apMax: 100, apGain: 14, apOnHit: 12,
    ability: 'Coordinated Strike', abilityDesc: 'Teleport-strike lowest-HP enemy for 5x ATK; ignores armor',
    passiveDesc: 'Courser Combat Protocol: +20% damage vs marked targets',
  },

  // ═══ KEPT (legacy) ════════════════════════════════════════════════════
  deathclaw: {
    name: 'Deathclaw', cost: 5, range: 'melee',
    faction: 'wastelander', role: 'vanguard',
    traits: ['wastelander', 'vanguard'],
    portraitBase: 'images/units/deathclaw',
    hp: 2340, atk: 145, def: 96, attackRange: 1, attackSpeed: 0.55,
    apMax: 100, apGain: 15, apOnHit: 15,
    ability: 'Savage Strike', abilityDesc: 'Strikes hardest enemy for 3x ATK, ignoring DEF',
    passiveDesc: 'Apex Predator: each kill permanently +25% ATK',
  },

  // ═══ TRANSFORM TARGETS (not in shop) ══════════════════════════════════
  'robot-dog': {
    name: 'Robot Dog', cost: 1, range: 'melee',
    faction: 'wastelander', role: 'medic',
    traits: ['wastelander', 'medic'],
    portraitBase: 'images/units/dogmeat',  // uses DogmeatAugment.webp (Agent D)
    hp: 650, atk: 50, def: 36, attackRange: 1, attackSpeed: 0.65,
    apMax: 100, apGain: 14, apOnHit: 12,
    ability: 'Pneumatic Bite', abilityDesc: 'Stuns the two highest-ATK enemies for 2.5s',
    passiveDesc: 'Cleave: auto-attack hits primary target + 2 nearest enemies',
    notShoppable: true,
    cleaveAttack: true,
    dualTargetAbility: true,
  },
};

// Stamp legacy `portrait` field for any older UI paths that read it directly.
// New UI agent should read `portraitBase` + star level instead.
for (const id of Object.keys(UNIT_DATABASE)) {
  UNIT_DATABASE[id].portrait = getUnitPortrait(id);
  UNIT_DATABASE[id].id = id;
}
