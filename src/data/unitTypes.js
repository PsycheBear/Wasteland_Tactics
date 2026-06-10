/**
 * Weapon type classification for all units — drives animation selection.
 * Categories: ballistic, energy, melee, explosive, healer, stealth
 */
export const WEAPON_TYPES = {
  // Cost 1
  preston:     'ballistic',   // Minuteman with laser musket — ballistic style
  sturges:     'melee',       // Mechanic, melee classified
  dogmeat:     'melee',       // Dog, physical attacks
  moira:       'energy',      // Experimental weapons, tech trait
  marcy:       'ballistic',   // Pipe pistol vibes

  // Cost 2
  piper:       'ballistic',   // Reporter with a pistol
  cait:        'melee',       // Brawler, fists/bat
  hancock:     'melee',       // Knife-wielding ghoul
  codsworth:   'energy',      // Flamer/laser — energy classification
  fahrenheit:  'melee',       // Raider melee with fire

  // Cost 3
  nick:        'ballistic',   // Detective with a revolver
  maccready:   'ballistic',   // Sniper rifle — long range ballistic
  curie:       'healer',      // Primary healer, stimpaks
  deacon:      'stealth',     // Railroad spy, stealth operative
  wiseman:     'melee',       // Ghoul elder, melee range

  // Cost 4
  strong:      'melee',       // Super mutant, pure melee brute
  danse:       'energy',      // Power armor + laser rifle
  maxson:      'energy',      // Final Judgment gatling laser
  kellogg:     'ballistic',   // Cybernetic assassin with pistol

  // Cost 5
  dima:        'energy',      // Synth leader, tech abilities
  deathclaw:   'melee',       // Giant claws, pure melee
  liberty:     'explosive',   // Liberty Prime throws nukes
};

/** Get weapon type for a unit, defaults to 'ballistic' */
export const getWeaponType = (unitId) => WEAPON_TYPES[unitId] || 'ballistic';

/** Animation color palette per weapon type */
export const WEAPON_COLORS = {
  ballistic:  { primary: '#ffcc44', secondary: '#ff9900', flash: '#ffffff', trail: '#ffaa00' },
  energy:     { primary: '#ff3333', secondary: '#ff6644', flash: '#ff8888', trail: '#ff4444' },
  melee:      { primary: '#ffffff', secondary: '#cccccc', flash: '#ffffff', trail: '#aaaaaa' },
  explosive:  { primary: '#ff6600', secondary: '#ff3300', flash: '#ffff00', trail: '#ff8800' },
  healer:     { primary: '#44ff88', secondary: '#22cc66', flash: '#88ffaa', trail: '#44ff44' },
  stealth:    { primary: '#aa66ff', secondary: '#8844dd', flash: '#cc88ff', trail: '#aa66ff' },
};

/** Idle animation class suffix per weapon type */
export const IDLE_CLASSES = {
  ballistic:  'wt-idle-aim',
  energy:     'wt-idle-energy',
  melee:      'wt-idle-ready',
  explosive:  'wt-idle-fidget',
  healer:     'wt-idle-heal',
  stealth:    'wt-idle-shimmer',
};
