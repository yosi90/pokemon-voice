export const SPECIAL_REVEALS = {
  BULBASAUR_LEAF: 'bulbasaur-leaf-burst',
  CHARMANDER_EMBER: 'charmander-ember-burst',
  SQUIRTLE_SPLASH: 'squirtle-water-splash',
  JIGGLYPUFF_SLEEP: 'jigglypuff-sleep-wave',
  GENGAR: 'gengar-scare',
  MISSINGNO_GLITCH: 'missingno-glitch',
  MEOWTH_COIN: 'meowth-coin',
  PETAL_BURST: 'petal-burst',
  PSYDUCK_THINK: 'psyduck-think',
  STARTER_BUBBLES: 'starter-bubbles',
  STARTER_FEATHER: 'starter-feather',
  STARTER_FIRE: 'starter-fire-burst',
  STARTER_SPRINT: 'starter-sprint',
  STARTER_WATER: 'starter-water-burst',
  SNORLAX_NAP: 'snorlax-nap',
};

export const SPECIAL_TIMING = {
  BEFORE_REVEAL: 'before-reveal',
  AFTER_REVEAL: 'after-reveal',
};

const MASTER_BALL_IDS = new Set([
  144, 145, 146, 150, 151,
  243, 244, 245, 249, 250, 251,
  377, 378, 379, 380, 381, 382, 383, 384, 385, 386,
  480, 481, 482, 483, 484, 485, 486, 487, 488, 489, 490, 491, 492, 493,
  494, 638, 639, 640, 641, 642, 643, 644, 645, 646, 647, 648, 649,
  716, 717, 718, 719, 720, 721,
  785, 786, 787, 788, 789, 790, 791, 792, 793, 794, 795, 796, 797, 798, 799,
  800, 801, 802, 807, 808, 809,
  888, 889, 890, 891, 892, 893, 894, 895, 896, 897, 898, 905,
  1001, 1002, 1003, 1004, 1007, 1008, 1009, 1010,
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
  let ballVariant = MASTER_BALL_IDS.has(id) ? 'master' : 'poke';
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
