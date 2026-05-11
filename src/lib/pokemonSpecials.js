export const SPECIAL_REVEALS = {
  BULBASAUR_LEAF: 'bulbasaur-leaf-burst',
  CHARMANDER_EMBER: 'charmander-ember-burst',
  SQUIRTLE_SPLASH: 'squirtle-water-splash',
  JIGGLYPUFF_SLEEP: 'jigglypuff-sleep-wave',
  GENGAR: 'gengar-scare',
  AUDINO_HEAL: 'audino-heal',
  ARCEUS_DIVINE: 'arceus-divine',
  AURA_BALANCE: 'aura-balance',
  ALCREMIE_FROSTING: 'alcremie-frosting',
  CASTFORM_WEATHER: 'castform-weather',
  CHANDELURE_SHADOWS: 'chandelure-shadows',
  CELEBI_REWIND: 'celebi-rewind',
  CRAMORANT_SPIT: 'cramorant-spit',
  DARKRAI_NIGHTMARE: 'darkrai-nightmare',
  DELIBIRD_GIFT: 'delibird-gift',
  DRAGAPULT_DREEPY: 'dragapult-dreepy',
  ETERNATUS_DYNAMAX: 'eternatus-dynamax',
  FIDOUGH_BAKE: 'fidough-bake',
  GARCHOMP_DASH: 'garchomp-dash',
  GENESECT_SCAN: 'genesect-scan',
  GIMMIGHOUL_COIN: 'gimmighoul-coin',
  KINGAMBIT_BOSS: 'kingambit-boss',
  KLEFKI_KEYS: 'klefki-keys',
  LUCARIO_AURA: 'lucario-aura',
  MILOTIC_TIDE: 'milotic-tide',
  MIMIKYU_BLACKOUT: 'mimikyu-blackout',
  MISSINGNO_GLITCH: 'missingno-glitch',
  MEOWTH_COIN: 'meowth-coin',
  NECROZMA_PRISM: 'necrozma-prism',
  PETAL_BURST: 'petal-burst',
  PSYDUCK_THINK: 'psyduck-think',
  PALAFIN_HERO: 'palafin-hero',
  ROTOM_POSSESS: 'rotom-possess',
  SHUCKLE_JUICE: 'shuckle-juice',
  SPIRITOMB_SOULS: 'spiritomb-souls',
  STARTER_BUBBLES: 'starter-bubbles',
  STARTER_FEATHER: 'starter-feather',
  STARTER_FIRE: 'starter-fire-burst',
  STARTER_SPRINT: 'starter-sprint',
  STARTER_WATER: 'starter-water-burst',
  SNORLAX_NAP: 'snorlax-nap',
  SUDOWOODO_DODGE: 'sudowoodo-dodge',
  TANDEMAUS_MULTIPLY: 'tandemaus-multiply',
  TEA_TIME: 'tea-time',
  TINKATON_HAMMER: 'tinkaton-hammer',
  UNOWN_MESSAGE: 'unown-message',
  WOBBUFFET_REPLY: 'wobbuffet-reply',
  WOOLOO_ROLL: 'wooloo-roll',
  XERNEAS_BLOOM: 'xerneas-bloom',
  YVELTAL_DRAIN: 'yveltal-drain',
  ZOROARK_ILLUSION: 'zoroark-illusion',
};

export const SPECIAL_TIMING = {
  BEFORE_REVEAL: 'before-reveal',
  AFTER_REVEAL: 'after-reveal',
};

const MYTHICAL_BALL_IDS = new Set([
  151, 251, 385, 386, 489, 490, 491, 492, 493, 494,
  647, 648, 649, 719, 720, 721, 801, 802, 807, 808,
  809, 893,
]);

const LEGENDARY_BALL_IDS = new Set([
  144, 145, 146, 150,
  243, 244, 245, 249, 250,
  377, 378, 379, 380, 381, 382, 383, 384,
  480, 481, 482, 483, 484, 485, 486, 487, 488,
  638, 639, 640, 641, 642, 643, 644, 645, 646,
  716, 717, 718, 772, 773,
  785, 786, 787, 788, 789, 790, 791, 792, 793, 794,
  795, 796, 797, 798, 799, 800, 803, 804, 805, 806,
  888, 889, 890, 891, 892, 894, 895, 896, 897, 898,
  905, 1001, 1002, 1003, 1004, 1007, 1008, 1009, 1010,
]);

const PSEUDO_LEGENDARY_BALL_IDS = new Set([
  147, 148, 149,
  246, 247, 248,
  371, 372, 373,
  374, 375, 376,
  443, 444, 445,
  633, 634, 635,
  704, 705, 706,
  782, 783, 784,
  885, 886, 887,
  996, 997, 998,
]);

const PHASE_TWO_STARTERS = [
  { key: 'chikorita-petals', ids: [152], className: 'special-chikorita', revealEffect: SPECIAL_REVEALS.PETAL_BURST, localEffects: ['petals'], durationMs: 2200 },
  { key: 'cyndaquil-ignition', ids: [155], className: 'special-cyndaquil', revealEffect: SPECIAL_REVEALS.STARTER_FIRE, localEffects: ['back-flame'], durationMs: 1900 },
  { key: 'totodile-bite', ids: [158], className: 'special-totodile', localEffects: ['bite'] },
  { key: 'treecko-climb', ids: [252], className: 'special-treecko', revealEffect: SPECIAL_REVEALS.PETAL_BURST, localEffects: ['climb'], durationMs: 1800 },
  { key: 'torchic-feather', ids: [255], className: 'special-torchic', revealEffect: SPECIAL_REVEALS.STARTER_FIRE, localEffects: ['feather'], durationMs: 1900 },
  { key: 'mudkip-mud', ids: [258], className: 'special-mudkip', revealEffect: SPECIAL_REVEALS.STARTER_WATER, localEffects: ['mud'], durationMs: 2100 },
  { key: 'turtwig-sapling', ids: [387], className: 'special-turtwig', revealEffect: SPECIAL_REVEALS.PETAL_BURST, localEffects: ['sapling'], durationMs: 2200 },
  { key: 'chimchar-flip', ids: [390], className: 'special-chimchar', revealEffect: SPECIAL_REVEALS.STARTER_FIRE, localEffects: ['fire-trail'], durationMs: 1900 },
  { key: 'piplup-slide', ids: [393], className: 'special-piplup', revealEffect: SPECIAL_REVEALS.STARTER_WATER, localEffects: ['ice'], durationMs: 1800 },
  { key: 'snivy-pose', ids: [495], className: 'special-snivy', revealEffect: SPECIAL_REVEALS.PETAL_BURST, localEffects: ['pose-leaf'], durationMs: 1900 },
  { key: 'tepig-smoke', ids: [498], className: 'special-tepig', revealEffect: SPECIAL_REVEALS.STARTER_FIRE, localEffects: ['smoke'], durationMs: 1800 },
  { key: 'oshawott-slash', ids: [501], className: 'special-oshawott', revealEffect: SPECIAL_REVEALS.STARTER_WATER, localEffects: ['shell-slash'], durationMs: 1800 },
  { key: 'chespin-spikes', ids: [650], className: 'special-chespin', revealEffect: SPECIAL_REVEALS.PETAL_BURST, localEffects: ['spikes'], durationMs: 1900 },
  { key: 'fennekin-magic', ids: [653], className: 'special-fennekin', revealEffect: SPECIAL_REVEALS.STARTER_FIRE, localEffects: ['magic-flame'], durationMs: 1900 },
  { key: 'froakie-ninja', ids: [656], className: 'special-froakie', revealEffect: SPECIAL_REVEALS.STARTER_BUBBLES, localEffects: ['ninja'], durationMs: 1800 },
  { key: 'rowlet-feather', ids: [722], className: 'special-rowlet', revealEffect: SPECIAL_REVEALS.STARTER_FEATHER, localEffects: ['owl'], durationMs: 1900 },
  { key: 'litten-furball', ids: [725], className: 'special-litten', revealEffect: SPECIAL_REVEALS.STARTER_FIRE, localEffects: ['furball'], durationMs: 1800 },
  { key: 'popplio-circus', ids: [728], className: 'special-popplio', revealEffect: SPECIAL_REVEALS.STARTER_BUBBLES, localEffects: ['circus'], durationMs: 2100 },
  { key: 'grookey-drum', ids: [810], className: 'special-grookey', revealEffect: SPECIAL_REVEALS.PETAL_BURST, localEffects: ['drum'], durationMs: 1700 },
  { key: 'scorbunny-sprint', ids: [813], className: 'special-scorbunny', revealEffect: SPECIAL_REVEALS.STARTER_SPRINT, localEffects: ['sprint'], durationMs: 1800 },
  { key: 'sobble-fade', ids: [816], className: 'special-sobble', revealEffect: SPECIAL_REVEALS.STARTER_WATER, localEffects: ['invisible'], durationMs: 1900 },
  { key: 'sprigatito-pollen', ids: [906], className: 'special-sprigatito', revealEffect: SPECIAL_REVEALS.PETAL_BURST, localEffects: ['pollen'], durationMs: 2100 },
  { key: 'fuecoco-chomp', ids: [909], className: 'special-fuecoco', revealEffect: SPECIAL_REVEALS.STARTER_FIRE, localEffects: ['chomp'], durationMs: 1800 },
  { key: 'quaxly-groom', ids: [912], className: 'special-quaxly', revealEffect: SPECIAL_REVEALS.STARTER_WATER, localEffects: ['groom'], durationMs: 1800 },
];

const SPECIAL_RULES = [
  {
    key: 'bulbasaur-vines',
    ids: [1],
    className: 'special-bulbasaur',
    revealEffect: SPECIAL_REVEALS.BULBASAUR_LEAF,
    localEffects: ['vines', 'bloom'],
    durationMs: 2400,
  },
  {
    key: 'charmander-heat',
    ids: [4],
    className: 'special-charmander',
    revealEffect: SPECIAL_REVEALS.CHARMANDER_EMBER,
    localEffects: ['flame', 'heat'],
    durationMs: 2200,
  },
  {
    key: 'squirtle-splash',
    ids: [7],
    className: 'special-squirtle',
    revealEffect: SPECIAL_REVEALS.SQUIRTLE_SPLASH,
    localEffects: ['water-drop'],
    durationMs: 2200,
  },
  {
    key: 'jigglypuff-sleep',
    ids: [39],
    className: 'special-jigglypuff',
    revealEffect: SPECIAL_REVEALS.JIGGLYPUFF_SLEEP,
    localEffects: ['zzz'],
    durationMs: 2200,
  },
  {
    key: 'diglett-burrow',
    ids: [50],
    className: 'special-diglett',
    localEffects: ['dirt'],
  },
  {
    key: 'meowth-coin',
    ids: [52],
    className: 'special-meowth',
    revealEffect: SPECIAL_REVEALS.MEOWTH_COIN,
    persistentKey: 'meowthCoins',
    durationMs: 4800,
  },
  {
    key: 'psyduck-thinking',
    ids: [54],
    className: 'special-psyduck',
    revealEffect: SPECIAL_REVEALS.PSYDUCK_THINK,
    localEffects: ['spinner'],
    durationMs: 1300,
  },
  {
    key: 'snorlax-nap',
    ids: [143],
    className: 'special-snorlax',
    revealEffect: SPECIAL_REVEALS.SNORLAX_NAP,
    durationMs: 3000,
  },
  {
    key: 'ditto-melt-hover',
    ids: [132],
    className: 'special-ditto',
    hoverEffect: 'melt',
  },
  {
    key: 'pikachu-restless',
    ids: [25],
    className: 'special-pikachu',
    idleEffect: 'restless-ball',
  },
  {
    key: 'voltorb-electric-hover',
    ids: [100, 101],
    className: 'special-voltorb',
    hoverEffect: 'electric-burst',
  },
  {
    key: 'gengar-soft-scare',
    ids: [94],
    className: 'special-gengar',
    revealEffect: SPECIAL_REVEALS.GENGAR,
    timing: SPECIAL_TIMING.BEFORE_REVEAL,
    durationMs: 1150,
  },
  {
    key: 'sudowoodo-water-reaction',
    ids: [185],
    className: 'special-sudowoodo',
    revealEffect: SPECIAL_REVEALS.SUDOWOODO_DODGE,
    durationMs: 1800,
  },
  {
    key: 'unown-secret-letters',
    ids: [201],
    className: 'special-unown',
    revealEffect: SPECIAL_REVEALS.UNOWN_MESSAGE,
    persistentKey: 'unownLetters',
    durationMs: 2600,
  },
  {
    key: 'wobbuffet-reply',
    ids: [202],
    className: 'special-wobbuffet',
  },
  {
    key: 'shuckle-ferment',
    ids: [213],
    className: 'special-shuckle',
  },
  {
    key: 'delibird-present',
    ids: [225],
    className: 'special-delibird',
    revealEffect: SPECIAL_REVEALS.DELIBIRD_GIFT,
    durationMs: 4200,
  },
  {
    key: 'celebi-time-rewind',
    ids: [251],
    className: 'special-celebi',
    revealEffect: SPECIAL_REVEALS.CELEBI_REWIND,
    durationMs: 2200,
  },
  {
    key: 'castform-weather',
    ids: [351],
    className: 'special-castform',
    revealEffect: SPECIAL_REVEALS.CASTFORM_WEATHER,
    durationMs: 2600,
  },
  {
    key: 'rotom-possess-ui',
    ids: [479],
    className: 'special-rotom',
    revealEffect: SPECIAL_REVEALS.ROTOM_POSSESS,
    durationMs: 2400,
  },
  {
    key: 'lucario-aura',
    ids: [448],
    className: 'special-lucario',
    revealEffect: SPECIAL_REVEALS.LUCARIO_AURA,
    durationMs: 1900,
  },
  {
    key: 'audino-heal',
    ids: [531],
    className: 'special-audino',
    revealEffect: SPECIAL_REVEALS.AUDINO_HEAL,
    durationMs: 1900,
  },
  {
    key: 'zoroark-illusion',
    ids: [570, 571],
    className: 'special-zoroark',
    revealEffect: SPECIAL_REVEALS.ZOROARK_ILLUSION,
    timing: SPECIAL_TIMING.BEFORE_REVEAL,
    durationMs: 1300,
  },
  {
    key: 'klefki-keys',
    ids: [707],
    className: 'special-klefki',
    revealEffect: SPECIAL_REVEALS.KLEFKI_KEYS,
    durationMs: 2600,
  },
  {
    key: 'gimmighoul-hidden-coin',
    ids: [999],
    className: 'special-gimmighoul',
    revealEffect: SPECIAL_REVEALS.GIMMIGHOUL_COIN,
    persistentKey: 'gimmighoulCoins',
    durationMs: 5200,
  },
  {
    key: 'palafin-hero-return',
    ids: [964],
    className: 'special-palafin',
    revealEffect: SPECIAL_REVEALS.PALAFIN_HERO,
    persistentKey: 'palafinPending',
    durationMs: 2200,
  },
  {
    key: 'shedinja-empty-shell',
    ids: [292],
    className: 'special-shedinja',
    localEffects: ['hollow-halo'],
    durationMs: 1800,
  },
  {
    key: 'sableye-gem-stash',
    ids: [302],
    className: 'special-sableye',
    localEffects: ['gems'],
    durationMs: 1800,
  },
  {
    key: 'mawile-back-mouth',
    ids: [303],
    className: 'special-mawile',
    localEffects: ['jaw'],
    durationMs: 1700,
  },
  {
    key: 'drifloon-tether',
    ids: [425],
    className: 'special-drifloon',
    localEffects: ['string-shadow'],
    durationMs: 1900,
  },
  {
    key: 'spiritomb-108-souls',
    ids: [442],
    className: 'special-spiritomb',
    revealEffect: SPECIAL_REVEALS.SPIRITOMB_SOULS,
    localEffects: ['soul-ring'],
    durationMs: 2600,
  },
  {
    key: 'darkrai-nightmare',
    ids: [491],
    className: 'special-darkrai',
    revealEffect: SPECIAL_REVEALS.DARKRAI_NIGHTMARE,
    timing: SPECIAL_TIMING.BEFORE_REVEAL,
    durationMs: 1900,
  },
  {
    key: 'mimikyu-false-pikachu',
    ids: [778],
    className: 'special-mimikyu',
    revealEffect: SPECIAL_REVEALS.MIMIKYU_BLACKOUT,
    localEffects: ['false-pika'],
    durationMs: 1500,
  },
  {
    key: 'litwick-wisp',
    ids: [607],
    className: 'special-litwick',
    localEffects: ['blue-flame'],
    durationMs: 1700,
  },
  {
    key: 'chandelure-lights',
    ids: [609],
    className: 'special-chandelure',
    revealEffect: SPECIAL_REVEALS.CHANDELURE_SHADOWS,
    localEffects: ['chandelier-flames'],
    durationMs: 2400,
  },
  {
    key: 'milotic-elegance',
    ids: [350],
    className: 'special-milotic',
    revealEffect: SPECIAL_REVEALS.MILOTIC_TIDE,
    localEffects: ['scales'],
    durationMs: 2400,
  },
  {
    key: 'garchomp-mach-pass',
    ids: [445],
    className: 'special-garchomp',
    revealEffect: SPECIAL_REVEALS.GARCHOMP_DASH,
    localEffects: ['speed-cut'],
    durationMs: 1500,
  },
  {
    key: 'arceus-divine-ring',
    ids: [493],
    className: 'special-arceus',
    revealEffect: SPECIAL_REVEALS.ARCEUS_DIVINE,
    localEffects: ['creation-ring'],
    durationMs: 3000,
  },
  {
    key: 'xerneas-bloom',
    ids: [716],
    className: 'special-xerneas',
    revealEffect: SPECIAL_REVEALS.XERNEAS_BLOOM,
    durationMs: 2600,
  },
  {
    key: 'yveltal-drain',
    ids: [717],
    className: 'special-yveltal',
    revealEffect: SPECIAL_REVEALS.YVELTAL_DRAIN,
    durationMs: 2400,
  },
  {
    key: 'necrozma-prism-break',
    ids: [800],
    className: 'special-necrozma',
    revealEffect: SPECIAL_REVEALS.NECROZMA_PRISM,
    localEffects: ['prism'],
    durationMs: 2400,
  },
  {
    key: 'eternatus-dynamax',
    ids: [890],
    className: 'special-eternatus',
    revealEffect: SPECIAL_REVEALS.ETERNATUS_DYNAMAX,
    localEffects: ['dynamax-core'],
    durationMs: 2600,
  },
  {
    key: 'genesect-scanner',
    ids: [649],
    className: 'special-genesect',
    revealEffect: SPECIAL_REVEALS.GENESECT_SCAN,
    localEffects: ['scanner'],
    durationMs: 2200,
  },
  {
    key: 'wooloo-roll',
    ids: [831],
    className: 'special-wooloo',
    revealEffect: SPECIAL_REVEALS.WOOLOO_ROLL,
    localEffects: ['wool'],
    durationMs: 2100,
  },
  {
    key: 'cramorant-spit',
    ids: [845],
    className: 'special-cramorant',
    revealEffect: SPECIAL_REVEALS.CRAMORANT_SPIT,
    localEffects: ['gulp'],
    durationMs: 2200,
  },
  {
    key: 'tea-time',
    ids: [854, 855],
    className: 'special-tea',
    revealEffect: SPECIAL_REVEALS.TEA_TIME,
    localEffects: ['steam'],
    durationMs: 2300,
  },
  {
    key: 'alcremie-frosting',
    ids: [869],
    className: 'special-alcremie',
    revealEffect: SPECIAL_REVEALS.ALCREMIE_FROSTING,
    localEffects: ['frosting'],
    durationMs: 2200,
  },
  {
    key: 'dragapult-dreepy',
    ids: [887],
    className: 'special-dragapult',
    revealEffect: SPECIAL_REVEALS.DRAGAPULT_DREEPY,
    localEffects: ['missiles'],
    durationMs: 2100,
  },
  {
    key: 'tandemaus-family',
    ids: [924, 925],
    className: 'special-tandemaus',
    revealEffect: SPECIAL_REVEALS.TANDEMAUS_MULTIPLY,
    durationMs: 2200,
  },
  {
    key: 'fidough-bake',
    ids: [926],
    className: 'special-fidough',
    revealEffect: SPECIAL_REVEALS.FIDOUGH_BAKE,
    localEffects: ['bread-puff'],
    durationMs: 2200,
  },
  {
    key: 'tinkaton-hammer',
    ids: [959],
    className: 'special-tinkaton',
    revealEffect: SPECIAL_REVEALS.TINKATON_HAMMER,
    localEffects: ['hammer'],
    durationMs: 2300,
  },
  {
    key: 'kingambit-boss',
    ids: [983],
    className: 'special-kingambit',
    revealEffect: SPECIAL_REVEALS.KINGAMBIT_BOSS,
    durationMs: 2600,
  },
  ...PHASE_TWO_STARTERS,
];

const SECRET_COMMANDS = [
  {
    key: 'missingno-secret',
    secretCommand: 'missingno',
    aliases: ['missingno', 'missing no', 'missing-no', 'missing.no'],
    revealEffect: SPECIAL_REVEALS.MISSINGNO_GLITCH,
    durationMs: 1800,
  },
  {
    key: 'water-command',
    secretCommand: 'agua',
    aliases: ['agua', 'water'],
    revealEffect: SPECIAL_REVEALS.SUDOWOODO_DODGE,
    durationMs: 1800,
  },
  {
    key: 'tea-command',
    secretCommand: 'te',
    aliases: ['te', 'té', 'tea'],
    revealEffect: SPECIAL_REVEALS.TEA_TIME,
    durationMs: 2300,
  },
];

export function getSpecialRules() {
  return SPECIAL_RULES.map(rule => ({ ...rule }));
}

export function matchSecretCommand(raw) {
  const q = String(raw || '').trim().toLowerCase();
  if (!q) return null;
  const compact = q.replace(/[\s.\-_]/g, '');
  return SECRET_COMMANDS.find(command => command.secretCommand === compact || command.aliases?.includes(q) || command.aliases?.includes(compact)) || null;
}

export function getPokemonSpecial(id) {
  const classes = [];
  let ballVariant = MYTHICAL_BALL_IDS.has(id)
    ? 'master'
    : LEGENDARY_BALL_IDS.has(id)
      ? 'ultra'
      : PSEUDO_LEGENDARY_BALL_IDS.has(id)
        ? 'super'
        : 'poke';
  let revealEffect = null;
  let timing = SPECIAL_TIMING.AFTER_REVEAL;
  let durationMs = 1400;
  let hoverEffect = null;
  let idleEffect = null;
  let localEffects = [];
  let persistentKey = null;

  for (const rule of SPECIAL_RULES) {
    if (!rule.ids.includes(id)) continue;
    if (rule.className) classes.push(rule.className);
    if (rule.ballVariant) ballVariant = rule.ballVariant;
    if (rule.revealEffect) revealEffect = rule.revealEffect;
    if (rule.timing) timing = rule.timing;
    if (rule.durationMs) durationMs = rule.durationMs;
    if (rule.hoverEffect) hoverEffect = rule.hoverEffect;
    if (rule.idleEffect) idleEffect = rule.idleEffect;
    if (rule.localEffects) localEffects = [...localEffects, ...rule.localEffects];
    if (rule.persistentKey) persistentKey = rule.persistentKey;
  }

  if (ballVariant !== 'poke') classes.push(`ball-${ballVariant}`);

  return {
    ballVariant,
    className: classes.join(' '),
    durationMs,
    hoverEffect,
    idleEffect,
    localEffects,
    persistentKey,
    revealEffect,
    timing,
  };
}
