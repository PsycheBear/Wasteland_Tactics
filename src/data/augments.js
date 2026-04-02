// === AUGMENT SYSTEM ===
export const AUGMENT_POOL = [
  { id: 'vault_training', name: 'Vault-Tec Training', icon: '🏋️', desc: '+5 ATK to all units', effect: { atkAdd: 5 } },
  { id: 'rad_resist', name: 'Rad Resistance', icon: '☢️', desc: 'All units take 15% less ability damage', effect: { abilityResist: 0.15 } },
  { id: 'scavenger', name: 'Scavenger', icon: '🔍', desc: '+1 gold per round', effect: { bonusGold: 1 } },
  { id: 'overclocked', name: 'Overclocked', icon: '⚡', desc: 'Units gain AP 20% faster', effect: { apGainMult: 0.2 } },
  { id: 'wasteland_hard', name: 'Wasteland Hardened', icon: '💪', desc: '+100 HP to all units', effect: { hpAdd: 100 } },
  { id: 'trigger_disc', name: 'Trigger Discipline', icon: '🎯', desc: '+10% crit chance', effect: { critAdd: 0.1 } },
  { id: 'pack_rat', name: 'Pack Rat', icon: '🎒', desc: '+2 bench slots', effect: { benchAdd: 2 } },
  { id: 'arms_dealer', name: 'Arms Dealer', icon: '🔫', desc: 'Item stat bonuses +50%', effect: { itemMult: 1.5 } },
  { id: 'fast_learner', name: 'Fast Learner', icon: '📚', desc: '+1 XP per round', effect: { bonusXp: 1 } },
  { id: 'field_medic', name: 'Field Medic', icon: '🏥', desc: 'Support synergy heal doubled', effect: { healMult: 2 } },
  { id: 'guerrilla', name: 'Guerrilla Tactics', icon: '🗡️', desc: 'First strike deals 2x damage', effect: { firstStrikeMult: 2 } },
  { id: 'fortified', name: 'Fortified Position', icon: '🏰', desc: '+20 DEF to all units', effect: { defAdd: 20 } },
  { id: 'nuka_addict', name: 'Nuka Addict', icon: '🥤', desc: 'Abilities deal 15% more damage', effect: { abilityDmgMult: 0.15 } },
  { id: 'econ_scale', name: 'Economy of Scale', icon: '💰', desc: 'Interest cap raised to 7', effect: { interestCap: 7 } },
  { id: 'lucky_find', name: 'Lucky Find', icon: '🍀', desc: '20% chance of free shop reroll', effect: { freeReroll: 0.2 } },
];
