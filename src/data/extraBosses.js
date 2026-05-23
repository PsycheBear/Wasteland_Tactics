// === EXTRA BOSSES (Wave 1) ===
// Same schema as BOSS_DATABASE entries in bosses.js:
//   {
//     round: <key the integrator will spread under>,
//     name, hp, atk, def,
//     mechanic, mechanicInterval?, mechanicDmg?, enrageThreshold?,
//     icon, iconImg,
//   }
//
// The exported `extraBosses` array lets the integration wave spread these
// into BOSS_DATABASE using the `round` field as the key, e.g.
//   for (const b of extraBosses) BOSS_DATABASE[b.round] = b;
//
// Boss intro frame paths intentionally omitted / set to null — Wave 2 may add
// art (chibi/toon-shaded Fallout Shelter style to match the rest of the game).

export const extraBosses = [
  {
    round: 35,
    name: 'The Mothman',
    hp: 13000,
    atk: 130,
    def: 50,
    // === MECHANIC: 'darkness_shroud' ===
    // Alternating-round mechanic. On every odd Mothman-active round the
    // shroud is "thick" (AoE damage against him is halved); on every even
    // round the shroud thins and single-target damage against him is doubled.
    // Combat.js wiring lands in a later wave — this object only declares the
    // mechanic so the engine and tooltip layer know what to render.
    mechanic: 'darkness_shroud',
    mechanicInterval: 1,         // re-evaluate phase every round
    shroudPhases: ['thick', 'thin'], // cycles in order; phase index = roundsElapsed % 2
    shroudEffects: {
      thick: { aoeIncomingMult: 0.5, singleTargetIncomingMult: 1.0 },
      thin:  { aoeIncomingMult: 1.0, singleTargetIncomingMult: 2.0 },
    },
    // Flavor flag used by combat for the harbinger-of-doom intro VO/SFX.
    harbinger: true,
    icon: '\u{1F987}', // bat emoji as closest stand-in until art lands
    iconImg: null,     // Wave 2 art: /images/icons/boss-mothman.svg
    introFrames: null, // Wave 2 art: array of intro-cutscene frame paths
  },
];
