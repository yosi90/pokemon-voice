export const SPECIAL_REVEALS = {
  BULBASAUR_LEAF: 'bulbasaur-leaf-burst',
  CHARMANDER_EMBER: 'charmander-ember-burst',
  SQUIRTLE_SPLASH: 'squirtle-water-splash',
  JIGGLYPUFF_SLEEP: 'jigglypuff-sleep-wave',
  GENGAR: 'gengar-scare',
  MEOWTH_COIN: 'meowth-coin',
  PSYDUCK_THINK: 'psyduck-think',
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
    localEffects: ['ditto-face'],
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
];

const SECRET_COMMANDS = [];

export function getSpecialRules() {
  return SPECIAL_RULES.map(rule => ({ ...rule }));
}

export function matchSecretCommand(raw) {
  const q = String(raw || '').trim().toLowerCase();
  if (!q) return null;
  return SECRET_COMMANDS.find(command => command.secretCommand === q) || null;
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
