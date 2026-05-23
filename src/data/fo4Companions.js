// === FO4 COMPANION IDs ===
//
// SoleSurvivor's Survivor's Bond passive grants +8% ATK and +8% AP per
// adjacent FO4 companion. This list is the source-of-truth for which unit
// IDs count toward that synergy.
//
// 12 companions total — stacking all of them maxes the bond at +96%.

export const FO4_COMPANIONS = [
  'cait',
  'curie',
  'danse',
  'deacon',
  'dogmeat',
  'hancock',
  'maccready',
  'nick',          // Nick Valentine
  'piper',
  'preston',       // Preston Garvey
  'strong',
  'x6-88',
];

export const isFo4Companion = (unitId) => FO4_COMPANIONS.includes(unitId);
