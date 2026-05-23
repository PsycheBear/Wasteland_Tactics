// Trait definitions — 9 faction traits + 4 role traits.
//
// Schema (preserved from the previous overhaul wave):
//   id        — kebab-case key on this object
//   name      — display label (Title Case)
//   color     — hex string used by the trait pill + glow
//   icon      — unicode fallback rendered if the SVG fails
//   iconImg   — SVG path under public/images/icons/ (UI uses <img onError> fallback)
//   bonuses   — { tier: 'human description' } shown in tooltips
//   effect    — pure (count) => stat-modifier object; combat.js applies it
//
// Trait IDs are kebab-case strings (e.g. 'vault-dweller'). Every unit has
// exactly 2 traits in its `traits` array: one FACTION + one ROLE.
//
// Solo factions ('cabot', 'atom-cats') still hand out their bonus at count >= 1
// because they only have one member.

import { BASE } from '../baseUrl.js';

export const TRAITS = {
  // ── FACTION TRAITS ──────────────────────────────────────────────────────
  brotherhood: {
    name: 'Brotherhood',
    icon: '',
    iconImg: `${BASE}/images/icons/trait-brotherhood.svg`,
    color: '#3366CC',
    bonuses: {
      2: '+20 DEF',
      4: '+20 DEF, +15% ability resist',
      6: '+25% ability resist, +200 team shield',
    },
    effect: (count) => ({
      defAdd: count >= 2 ? 20 : 0,
      abilityResist: count >= 6 ? 0.25 : count >= 4 ? 0.15 : 0,
      teamShield: count >= 6 ? 200 : 0,
    }),
  },
  railroad: {
    name: 'Railroad',
    icon: '',
    iconImg: `${BASE}/images/icons/trait-railroad.svg`,
    color: '#888888',
    bonuses: {
      2: '+20% dodge',
      4: '+35% dodge, stealth at combat start (3s)',
    },
    effect: (count) => ({
      dodgeChance: count >= 4 ? 0.35 : count >= 2 ? 0.2 : 0,
      stealthStart: count >= 4 ? 3 : 0,
    }),
  },
  goodneighbor: {
    name: 'Goodneighbor',
    icon: '',
    iconImg: `${BASE}/images/icons/trait-goodneighbor.svg`,
    color: '#9933CC',
    bonuses: {
      2: '+15% lifesteal',
      4: '+30% lifesteal, +10% bonus gold on win',
    },
    effect: (count) => ({
      lifesteal: count >= 4 ? 0.3 : count >= 2 ? 0.15 : 0,
      bonusGold: count >= 4 ? 0.1 : 0,
    }),
  },
  minutemen: {
    name: 'Minutemen',
    icon: '',
    iconImg: `${BASE}/images/icons/trait-minutemen.svg`,
    color: '#4A90D9',
    bonuses: {
      2: 'Allies adjacent to a Minuteman gain +15 ATK',
      3: 'Adjacency +30 ATK, +10% attack speed',
    },
    effect: (count) => ({
      adjAtkAdd: count >= 3 ? 30 : count >= 2 ? 15 : 0,
      adjAtkSpeed: count >= 3 ? 0.1 : 0,
    }),
  },
  institute: {
    name: 'Institute',
    icon: '',
    iconImg: `${BASE}/images/icons/trait-institute.svg`,
    color: '#33CCCC',
    bonuses: {
      2: '+25% Ability Power',
      4: '+50% AP, abilities chain at 50% to nearby enemy',
    },
    effect: (count) => ({
      abilityMult: count >= 4 ? 1.5 : count >= 2 ? 1.25 : 1,
      abilityChain: count >= 4 ? 0.5 : 0,
    }),
  },
  cabot: {
    name: 'Cabot',
    icon: '',
    iconImg: `${BASE}/images/icons/trait-cabot.svg`,
    color: '#CC0066',
    bonuses: {
      1: 'JackCabot starts with 100% AP',
    },
    effect: (count) => ({
      startAp: count >= 1 ? 1.0 : 0,
    }),
  },
  wastelander: {
    name: 'Wastelander',
    icon: '',
    iconImg: `${BASE}/images/icons/trait-wastelander.svg`,
    color: '#8B4513',
    bonuses: {
      2: '+15% ATK',
      4: '+30% ATK',
      6: '+30% ATK, crits deal 2.5x damage',
    },
    effect: (count) => ({
      atkMult: count >= 4 ? 1.3 : count >= 2 ? 1.15 : 1,
      critMult: count >= 6 ? 2.5 : 1.5,
    }),
  },
  'vault-dweller': {
    name: 'Vault Dweller',
    icon: '',
    iconImg: `${BASE}/images/icons/trait-vault-dweller.svg`,
    color: '#3399FF',
    bonuses: {
      2: 'Regen 3% max HP per 4s',
      4: 'Regen 5%, revive once at 50% HP',
    },
    effect: (count) => ({
      ghoulRegen: count >= 4 ? 0.05 : count >= 2 ? 0.03 : 0,
      revive: count >= 4,
    }),
  },
  'atom-cats': {
    name: 'Atom Cats',
    icon: '',
    iconImg: `${BASE}/images/icons/trait-atom-cats.svg`,
    color: '#FF9900',
    bonuses: {
      1: '+20% ATK, reflect 15% damage taken',
    },
    effect: (count) => ({
      atkMult: count >= 1 ? 1.2 : 1,
      reflectDamage: count >= 1 ? 0.15 : 0,
    }),
  },
  // ── ROLE TRAITS ─────────────────────────────────────────────────────────
  vanguard: {
    name: 'Vanguard',
    icon: '',
    iconImg: `${BASE}/images/icons/trait-vanguard.svg`,
    color: '#C0392B',
    bonuses: {
      2: '+20% HP',
      4: '+40% HP, +15 DEF',
      6: '+40% HP, +30 DEF, taunt adjacent',
    },
    effect: (count) => ({
      hpMult: count >= 4 ? 1.4 : count >= 2 ? 1.2 : 1,
      defAdd: count >= 6 ? 30 : count >= 4 ? 15 : 0,
      taunt: count >= 6,
    }),
  },
  sniper: {
    name: 'Sniper',
    icon: '',
    iconImg: `${BASE}/images/icons/trait-sniper.svg`,
    color: '#556B2F',
    bonuses: {
      2: '+15% range, +20% long-range damage',
      4: '+25% range, ignore 30% armor',
    },
    effect: (count) => ({
      rangeMult: count >= 4 ? 1.25 : count >= 2 ? 1.15 : 1,
      longRangeDmg: count >= 4 ? 0.2 : count >= 2 ? 0.2 : 0,
      armorPierce: count >= 4 ? 0.3 : 0,
    }),
  },
  caster: {
    name: 'Caster',
    icon: '',
    iconImg: `${BASE}/images/icons/trait-caster.svg`,
    color: '#9B59B6',
    bonuses: {
      2: '+25% Ability Power',
      4: '+50% Ability Power',
      6: '+50% AP, abilities burn (15 dmg/s for 4s)',
    },
    effect: (count) => ({
      abilityMult: count >= 4 ? 1.5 : count >= 2 ? 1.25 : 1,
      abilityBurn: count >= 6 ? { dmg: 15, ticks: 8 } : null,
    }),
  },
  medic: {
    name: 'Medic',
    icon: '',
    iconImg: `${BASE}/images/icons/trait-medic.svg`,
    color: '#2E8B57',
    bonuses: {
      2: 'Heal lowest-HP ally 5% per 4s',
      4: '8% heal, revive lowest at 50% HP once',
      6: '12% heal, revive, immune to CC',
    },
    effect: (count) => ({
      healTick: count >= 6 ? 0.12 : count >= 4 ? 0.08 : count >= 2 ? 0.05 : 0,
      revive: count >= 4,
      ccImmune: count >= 6,
    }),
  },
};
