// Trait definitions
export const TRAITS = {
  Minutemen: { name: 'Minutemen', icon: '⭐', color: '#4A90D9', bonuses: { 2: '+20% HP', 3: '+40% HP, +15 DEF' }, effect: (count) => ({ hpMult: count >= 3 ? 1.4 : count >= 2 ? 1.2 : 1, defAdd: count >= 3 ? 15 : 0 }) },
  Wasteland: { name: 'Wasteland', icon: '☢️', color: '#8B4513', bonuses: { 2: '+15% ATK', 3: '+30% ATK' }, effect: (count) => ({ atkMult: count >= 3 ? 1.3 : count >= 2 ? 1.15 : 1 }) },
  Support: { name: 'Support', icon: '💚', color: '#2E8B57', bonuses: { 2: 'Heal allies 5% HP/4s', 3: 'Heal allies 8% HP/4s + Revive weakest ally once' }, effect: (count) => ({ healTick: count >= 3 ? 0.08 : count >= 2 ? 0.05 : 0, revive: count >= 3 }) },
  Tech: { name: 'Tech', icon: '⚙️', color: '#708090', bonuses: { 2: '+25% Ability Power', 3: '+60% Ability Power' }, effect: (count) => ({ abilityMult: count >= 3 ? 1.6 : count >= 2 ? 1.25 : 1 }) },
  Scout: { name: 'Scout', icon: '👁️', color: '#556B2F', bonuses: { 2: '+20% Attack Speed', 3: '+35% Attack Speed + first strike' }, effect: (count) => ({ asMult: count >= 3 ? 1.35 : count >= 2 ? 1.2 : 1, firstStrike: count >= 3 }) },
  Brotherhood: { name: 'Brotherhood', icon: '🛡️', color: '#3366CC', bonuses: { 2: '+20% DEF, 10% ability damage reduction', 3: '+40% DEF, 25% ability reduction, +200 team shield' }, effect: (count) => ({ defMult: count >= 3 ? 1.4 : count >= 2 ? 1.2 : 1, abilityResist: count >= 3 ? 0.25 : count >= 2 ? 0.1 : 0, teamShield: count >= 3 ? 200 : 0 }) },
  Raider: { name: 'Raider', icon: '💀', color: '#CC3333', bonuses: { 2: '+20% crit chance', 3: '+35% crit, crits deal 2.5x' }, effect: (count) => ({ critChance: count >= 3 ? 0.35 : count >= 2 ? 0.2 : 0, critMult: count >= 3 ? 2.5 : 1.5 }) },
  Ghoul: { name: 'Ghoul', icon: '☣️', color: '#669933', bonuses: { 2: 'Regen 3% HP/4s, poison immune', 3: 'Regen 5% HP/4s, on death radiate 20% max HP' }, effect: (count) => ({ ghoulRegen: count >= 3 ? 0.05 : count >= 2 ? 0.03 : 0, poisonImmune: count >= 2, deathRadiation: count >= 3 }) },
};
