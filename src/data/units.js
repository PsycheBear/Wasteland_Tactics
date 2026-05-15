// Animation classification: melee = full lunge, ranged = lean + projectile (Sturges is melee despite range 3)
export const MELEE_UNITS = ['dogmeat', 'cait', 'sturges', 'hancock', 'strong', 'deathclaw', 'fahrenheit', 'wiseman'];
export const isMeleeUnit = (unitId) => MELEE_UNITS.includes(unitId);
export const UNIT_DATABASE = {
  // === COST 1 (early game filler, fall off late) ===
  preston: { name: 'Preston Garvey', cost: 1, traits: ['Minutemen', 'Support'], hp: 480, atk: 50, def: 20, range: 2, attackSpeed: 0.95, apMax: 80, apGain: 10, apOnHit: 10, ability: 'Rally Minutemen', abilityDesc: '+20% ATK to all allies for 4s', passiveDesc: "General's Inspiration: allies start with 20% AP" },
  sturges: { name: 'Sturges', cost: 1, traits: ['Minutemen', 'Tech'], hp: 400, atk: 40, def: 25, range: 3, attackSpeed: 0.9, apMax: 60, apGain: 12, apOnHit: 12, ability: 'Repair Bot', abilityDesc: 'Heals lowest HP ally for 100 HP', passiveDesc: 'Scrap Armor: healed allies gain +10 DEF for 4s' },
  dogmeat: { name: 'Dogmeat', cost: 1, traits: ['Wasteland', 'Scout'], hp: 350, atk: 55, def: 15, range: 1, attackSpeed: 0.65, apMax: 50, apGain: 14, apOnHit: 12, ability: 'Attack Dog', abilityDesc: 'Pounces on highest ATK enemy, stunning them', passiveDesc: 'Good Boy: +1 bonus caps on victory' },
  moira: { name: 'Moira Brown', cost: 1, traits: ['Wasteland', 'Tech'], hp: 380, atk: 42, def: 22, range: 3, attackSpeed: 1.0, apMax: 55, apGain: 12, apOnHit: 10, ability: 'Experimental Serum', abilityDesc: 'Poisons 2 enemies, dealing 80 damage over 4s', passiveDesc: 'Wasteland Survival: team +15% damage resist' },
  // === COST 2 (mid-early backbone) ===
  piper: { name: 'Piper Wright', cost: 2, traits: ['Minutemen', 'Support'], hp: 520, atk: 52, def: 24, range: 3, attackSpeed: 0.95, apMax: 60, apGain: 12, apOnHit: 10, ability: 'Exposé', abilityDesc: 'Shreds highest DEF enemy, -50% DEF for 5s', passiveDesc: 'Public Occurrences: team +15% crit chance' },
  cait: { name: 'Cait', cost: 2, traits: ['Wasteland', 'Scout'], hp: 540, atk: 58, def: 18, range: 1, attackSpeed: 0.7, apMax: 55, apGain: 16, apOnHit: 14, ability: 'Psycho', abilityDesc: '+30% ATK, -10% DEF for 5s', passiveDesc: 'Trigger Rush: below 30% HP, attack speed doubles' },
  hancock: { name: 'Hancock', cost: 2, traits: ['Wasteland', 'Support'], hp: 500, atk: 55, def: 20, range: 2, attackSpeed: 0.95, apMax: 60, apGain: 14, apOnHit: 12, ability: 'Ghoulish Fury', abilityDesc: 'AoE radiation burst deals 100 damage to all enemies', passiveDesc: 'Of the People: heals allies 10% HP on kill' },
  codsworth: { name: 'Codsworth', cost: 2, traits: ['Tech', 'Support'], hp: 480, atk: 50, def: 22, range: 3, attackSpeed: 0.85, apMax: 55, apGain: 14, apOnHit: 12, ability: 'Flamer Burst', abilityDesc: 'Scorches 2 random enemies for 120 damage each', passiveDesc: 'Mister Handy: repairs lowest ally 3% max HP every 4s' },
  // === COST 3 (mid-game power spike) ===
  nick: { name: 'Nick Valentine', cost: 3, traits: ['Tech', 'Support'], hp: 680, atk: 62, def: 30, range: 3, attackSpeed: 0.85, apMax: 65, apGain: 14, apOnHit: 14, ability: 'Suppression', abilityDesc: 'Silences the highest ATK enemy for 6s', passiveDesc: 'Synth Detective: marks lowest HP enemy, they take +20% damage' },
  maccready: { name: 'MacCready', cost: 3, traits: ['Minutemen', 'Scout'], hp: 600, atk: 65, def: 20, range: 4, attackSpeed: 1.0, apMax: 60, apGain: 12, apOnHit: 10, ability: 'Headshot', abilityDesc: 'Executes lowest HP enemy for 4x ATK damage', passiveDesc: 'Killshot: 20% chance for 2x crit on attacks' },
  // === COST 4 (late-game carry) ===
  strong: { name: 'Strong', cost: 4, traits: ['Wasteland', 'Scout'], hp: 800, atk: 78, def: 28, range: 1, attackSpeed: 0.75, apMax: 70, apGain: 12, apOnHit: 15, ability: 'Berserker Rage', abilityDesc: '+50% ATK and gains 200 HP shield for 6s', passiveDesc: 'Unstoppable: immune to stun/silence, +5% max HP per kill' },
  danse: { name: 'Paladin Danse', cost: 4, traits: ['Minutemen', 'Tech'], hp: 780, atk: 72, def: 35, range: 2, attackSpeed: 0.9, apMax: 75, apGain: 12, apOnHit: 12, ability: 'Ad Victoriam', abilityDesc: 'Laser blast hits all enemies for 150 damage', passiveDesc: 'Brotherhood Shield: on death, 400 AoE + allies gain +25% DEF' },
  // === COST 5 (legendary) ===
  dima: { name: 'DIMA', cost: 5, traits: ['Wasteland', 'Tech'], hp: 850, atk: 75, def: 35, range: 3, attackSpeed: 0.85, apMax: 90, apGain: 12, apOnHit: 12, ability: 'Memory Lane', abilityDesc: 'Recalls an ally from death with 40% HP', passiveDesc: 'Perfect Recall: revives 2 allies, both with full AP' },
  deathclaw: { name: 'Deathclaw', cost: 5, traits: ['Wasteland', 'Scout'], hp: 900, atk: 90, def: 25, range: 1, attackSpeed: 0.55, apMax: 80, apGain: 15, apOnHit: 15, ability: 'Savage Strike', abilityDesc: 'Strikes hardest enemy for 3x ATK, ignoring DEF', passiveDesc: 'Apex Predator: each kill permanently +25% ATK' },
  // === NEW UNITS ===
  // === COST 1 ===
  marcy: { name: 'Marcy Long', cost: 1, traits: ['Minutemen', 'Ghoul'], hp: 370, atk: 44, def: 20, range: 2, attackSpeed: 0.95, apMax: 55, apGain: 12, apOnHit: 10, ability: 'Bitter Complaints', abilityDesc: '-25% ATK to target enemy for 4s', passiveDesc: "Survivor's Tenacity: team +5% max HP" },
  // === COST 2 ===
  fahrenheit: { name: 'Fahrenheit', cost: 2, traits: ['Raider', 'Scout'], hp: 530, atk: 60, def: 18, range: 1, attackSpeed: 0.7, apMax: 55, apGain: 14, apOnHit: 12, ability: 'Incendiary Strike', abilityDesc: 'Melee AoE dealing 100 damage + burn DoT', passiveDesc: 'Arsonist: attacks have 15% chance to burn for 50 DoT over 3s' },
  // === COST 3 ===
  curie: { name: 'Curie', cost: 3, traits: ['Tech', 'Support'], hp: 650, atk: 55, def: 28, range: 3, attackSpeed: 0.85, apMax: 60, apGain: 12, apOnHit: 12, ability: 'Emergency Protocol', abilityDesc: 'Heals all allies for 80 HP', passiveDesc: 'Medical Marvels: healed allies gain +15% attack speed for 3s' },
  deacon: { name: 'Deacon', cost: 3, traits: ['Scout', 'Raider'], hp: 620, atk: 68, def: 22, range: 3, attackSpeed: 0.85, apMax: 65, apGain: 14, apOnHit: 12, ability: 'Recall Code', abilityDesc: 'Becomes untargetable for 3s, then strikes random enemy for 2x ATK', passiveDesc: 'Master of Disguise: first ability costs 50% less AP' },
  wiseman: { name: 'Wiseman', cost: 3, traits: ['Ghoul', 'Support'], hp: 700, atk: 50, def: 25, range: 2, attackSpeed: 0.9, apMax: 60, apGain: 12, apOnHit: 12, ability: "Ghoul's Wisdom", abilityDesc: 'Reduces all enemy ATK by 20% for 4s', passiveDesc: 'Ancient Knowledge: team gains +10 DEF' },
  // === COST 4 ===
  maxson: { name: 'Elder Maxson', cost: 4, traits: ['Brotherhood', 'Minutemen'], hp: 820, atk: 75, def: 32, range: 2, attackSpeed: 0.9, apMax: 75, apGain: 12, apOnHit: 12, ability: 'Final Judgment', abilityDesc: 'Gatling laser hits 3 random enemies for 200 damage each', passiveDesc: 'Steel Commander: Brotherhood units gain +20% ATK' },
  kellogg: { name: 'Kellogg', cost: 4, traits: ['Raider', 'Tech'], hp: 750, atk: 80, def: 26, range: 3, attackSpeed: 0.85, apMax: 70, apGain: 12, apOnHit: 12, ability: 'Cybernetic Override', abilityDesc: 'Stuns 2 enemies for 3s and deals 150 damage', passiveDesc: 'Immortal Synth: on death, revive with 30% HP once per combat' },
  // === COST 5 ===
  liberty: { name: 'Liberty Prime', cost: 5, traits: ['Brotherhood', 'Tech'], hp: 1000, atk: 85, def: 40, range: 2, attackSpeed: 0.85, apMax: 90, apGain: 12, apOnHit: 12, ability: 'Nuclear Football', abilityDesc: '250 AoE damage to all enemies', passiveDesc: 'Democracy is Non-Negotiable: immune to all debuffs, +5% ATK to all allies' },
};
