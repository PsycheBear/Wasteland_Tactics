// === UNIT + BOSS LORE ===
// Flavor text drawn from Nukapedia / Wikipedia summaries of the canonical
// Fallout characters and creatures. Keyed by unit ID (matches UNIT_DATABASE)
// and by boss ID (matches BOSS_DATABASE round-trigger keys).
//
// Sources: Wikipedia "Fallout 4", "Fallout 4: Far Harbor", "Fallout (franchise)",
// "Mothman", and general Fallout series canon. WebFetch against fallout.fandom.com
// returns 403 Forbidden from this environment, so Wikipedia summaries were used
// in place of direct Nukapedia article scrapes.

export const UNIT_LORE = {
  // === COST 1 ===
  preston: "A resilient member of the Commonwealth Minutemen militia who befriends the Sole Survivor in Concord after the death of his squad. He later promotes them to General of the Minutemen, dedicating himself to rebuilding the broken faction one settlement at a time.",
  sturges: "A laid-back mechanic and tinkerer from Quincy who escapes the city's fall alongside the Longs and Preston Garvey. He serves as the Minutemen's go-to engineer at Sanctuary Hills, building turrets, terminals, and the teleporter that breaches the Institute.",
  dogmeat: "A loyal German Shepherd and the only mandatory companion in Fallout 4, found guarding the Red Rocket truck stop outside Sanctuary. He cannot be permanently killed in combat, and his bloodline is unofficially traced back to the original Dogmeat of Junktown.",
  moira: "The eternally curious shopkeeper of Craterside Supply in Megaton, Moira recruits the Lone Wanderer to help her write the Wasteland Survival Guide. Her experiments range from drinking irradiated water to provoking mole rats, and she is one of the few wastelanders cheerful enough to survive becoming a ghoul without losing her sunny disposition.",

  // === COST 2 ===
  piper: "An intrepid reporter for Publick Occurrences in Diamond City, Piper Wright is one of the Sole Survivor's possible companions and romance options. She is fiercely anti-synth-conspiracy, willing to print the truth even when Mayor McDonough bans her paper from the stands.",
  cait: "An Irish-descended cage fighter from the Combat Zone in downtown Boston, Cait fled an abusive past before being sold into the pits. Once idolized by the Sole Survivor, she opens up about her chem addiction and can be cured at Vault 95.",
  hancock: "John Hancock is the ghoul mayor of Goodneighbor, a free city for the Commonwealth's outcasts, and a chem-fueled revolutionary in a tricorn hat. Born John McDonough, he ghoulified himself with experimental radiation drugs and now governs by the creed 'of the people, for the people'.",
  codsworth: "The Sole Survivor's Mister Handy butler, Codsworth maintained the family home in Sanctuary Hills for over two hundred years while waiting for his masters to return. He is unfailingly polite, prone to existential breakdown, and equipped with a flamer, buzz saw, and circular saw for less polite occasions.",
  marcy: "Marcy Long is a survivor of the Quincy massacre who follows Preston Garvey to Sanctuary Hills. Hardened by the loss of her son, she greets newcomers with bitter sarcasm but works tirelessly to keep the new settlement standing.",
  fahrenheit: "Hancock's personal bodyguard and the de facto enforcer of Goodneighbor, Fahrenheit is a feared mercenary said to be the daughter of the Combat Zone's Tommy Lonegan. She is rarely seen without her shotgun and tolerates no threats to the mayor.",

  // === COST 3 ===
  nick: "Nick Valentine is a prototype Generation 2 synth who escaped the Institute carrying the memories of a pre-war Boston police detective. He runs Valentine's Detective Agency out of Diamond City and is mandatory for tracking Kellogg through the Sole Survivor's missing son case.",
  maccready: "Robert Joseph MacCready is a sharpshooting mercenary first encountered as the foul-mouthed mayor of Little Lamplight as a child, and later found drinking in the Third Rail of Goodneighbor as an adult. He hires out his rifle to fund a cure for his ailing son Duncan.",
  curie: "Originally a Miss Nanny robot stationed in Vault 81, Curie is a synthesized intelligence dedicated to medical research and the development of a universal cure. With the Sole Survivor's help she transfers her consciousness into a synth body, becoming both companion and romance option.",
  deacon: "A master of disguise and one of the Railroad's top field agents, Deacon spends his life infiltrating factions and feeding misinformation to anyone who will listen. He follows the Sole Survivor in secret long before formally joining their party.",
  wiseman: "The leader of the Harbormen's old Ghoul community at the Nucleus on the Island, Wiseman shepherds his fellow Children of Atom and feral-adjacent ghouls in the Far Harbor region. He preaches a gentler form of Atom's gospel, urging coexistence with both Far Harbor and Acadia.",

  // === COST 4 ===
  strong: "A Super Mutant born from the Institute's FEV experiments who serves as one of the Sole Survivor's thirteen possible companions. Obsessed with finding the legendary 'milk of human kindness' that he believes will turn him into the ultimate Super Mutant, Strong sympathizes with humans in ways most of his kind do not.",
  danse: "Paladin Danse is a high-ranking member of the Brotherhood of Steel's Recon Squad Gladius and one of the Sole Survivor's romance options. Devout, regimented, and rarely seen out of his power armor, Danse's loyalty to the Brotherhood is tested by a secret about his own nature.",
  maxson: "Arthur Maxson is the young, ironfisted Elder of the East Coast Brotherhood of Steel, having taken command at sixteen and unified the fractured chapter aboard the airship Prydwen. A direct descendant of Roger Maxson, the Brotherhood's founder, he leads the campaign against the Institute with absolute conviction.",
  kellogg: "Conrad Kellogg is the cybernetically augmented mercenary responsible for murdering the Sole Survivor's spouse and kidnapping their son Shaun. A long-lived enforcer-for-hire whose body has been heavily modified by the Institute, he is the target of the early-game revenge that drives the Commonwealth storyline.",

  // === COST 5 ===
  dima: "DiMA is a mysterious prototype synth, brother to Nick Valentine, who leads the synth refuge of Acadia hidden on Mount Desert Island. He has voluntarily archived parts of his own memory to external storage and quietly manipulates the Island's three factions toward an uneasy peace.",
  deathclaw: "Deathclaws were deliberately engineered by the pre-war U.S. military as biological weapons based on Jackson's chameleon stock and FEV. Released into the post-war ecosystem, they thrived to become the wasteland's apex predator: towering, intelligent, and armed with the talons that give them their name.",
  liberty: "Liberty Prime is a colossal pre-war combat robot built by General Atomics and the U.S. Army to liberate Anchorage from the Chinese invasion. Reactivated by the Brotherhood of Steel, the patriotic giant marches on the Institute hurling mini-nukes and broadcasting anti-communist propaganda at deafening volume.",
};

export const BOSS_LORE = {
  // Keys mirror BOSS_DATABASE round numbers (7, 14, 21, 28).
  7: "Radscorpions are mutated descendants of the imported emperor scorpion, growing to the size of small cars in the radioactive wastes. Legendary specimens have hardened plating and venom potent enough to drop a Brotherhood paladin in full power armor.",
  14: "Mirelurk Queens are the apex of the mirelurk hive, towering crustaceans that nest in flooded ruins and spit corrosive bile across the battlefield. A queen will flood the field with her brood and chase intruders until the swamp itself runs red.",
  21: "Super Mutant Behemoths are the largest and oldest of their kind, calcified into hulking giants over decades of FEV mutation. They drag wrecked cars and fire hydrants as clubs and view smaller mutants as little more than insects.",
  28: "Mythic Deathclaws are the rarest and most lethal variant of an already-apex species, scarred white veterans of countless wasteland kills. To meet one in the open is widely considered a death sentence, even for a heavily armed survivor.",
  // NOTE: stale since the boss overhaul — round 35 is Atom Theil in
  // BOSS_DATABASE now (and 14/21 are Swan / Synth Courser, not the bosses
  // described above). Kept for reference until new lore is written.
  35: "The Mothman is a cryptid drawn from West Virginia folklore, sighted around Point Pleasant between 1966 and 1967 as a winged humanoid with glowing red eyes. In post-war Appalachia it stalks the woods as a half-divine harbinger of doom, worshipped by its own cult and feared by every settlement on the I-64 corridor.",
};

// Convenience flat export so callers can pull either map under a single name.
export const LORE = { units: UNIT_LORE, bosses: BOSS_LORE };
