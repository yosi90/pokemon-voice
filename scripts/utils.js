// -------- Normalización / heurísticas ES --------
export const normalize = (s) => s?.toString().trim().toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9.\- ]/g, '').replace(/\s+/g, ' ') || '';

export function esPhonetic(s) {
  s = normalize(s);
  s = s.replace(/qu/g, 'k').replace(/\bq/g, 'k'); // qu/q -> k
  s = s.replace(/v/g, 'b');                       // v ~ b
  s = s.replace(/h/g, '');                         // h muda
  // c/z -> s ante e/i
  s = s.replace(/ce/g, 'se').replace(/ci/g, 'si').replace(/ze/g, 'se').replace(/zi/g, 'si');
  // c->k ante a/o/u
  s = s.replace(/ca/g, 'ka').replace(/co/g, 'ko').replace(/cu/g, 'ku');
  // g/j ante e/i
  s = s.replace(/ge/g, 'je').replace(/gi/g, 'ji');
  return s;
}

export function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  const dp = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, prev + 1, dp[j - 1] + cost);
      prev = tmp;
    }
  }
  return dp[n];
}

// Correcciones y alias ES -> EN (amplía cuando quieras)
export const esToEnCorrections = new Map([
  ['farfetchd', "farfetch'd"], ['sirfetchd', "sirfetch'd"],
  ['type null', 'type: null'], ['ho oh', 'ho-oh'],
  ['porygon z', 'porygon-z'], ['mime jr', 'mime jr.'],
  ['mr mime', 'mr. mime'], ['mr rime', 'mr. rime'],
  ['jangmo o', 'jangmo-o'], ['hakamo o', 'hakamo-o'], ['kommo o', 'kommo-o'],
  ['tapu koko', 'tapu-koko'], ['tapu lele', 'tapu-lele'], ['tapu bulu', 'tapu-bulu'], ['tapu fini', 'tapu-fini'],
]);

export const esAliases = new Map([
  ['clefa', 'cleffa'], ['clifa', 'cleffa'], ['glifa', 'cleffa'],
  ['clefairi', 'clefairy'], ['cleferi', 'clefairy'],
  ['klefki', 'klefki'], ['qlefki', 'klefki'], ['qlefqi', 'klefki'], ['clefki', 'klefki'],
  ['aegislash','aegislash'], ['egislash','aegislash'], ['eijislash','aegislash'], ['eigislas','aegislash'], ['eislas','aegislash'], ['eghislash','aegislash'],
  ['charizar','charizard'], ['charisard','charizard'],
  ['gyarados','gyarados'], ['llarados','gyarados'],
]);

// -------- Rutas/constantes --------
export const ART_URL = (id) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;

export const GEN_RANGES = {
  1: [1, 151], 2: [152, 251], 3: [252, 386], 4: [387, 493], 5: [494, 649],
  6: [650, 721], 7: [722, 809], 8: [810, 898], 9: [899, 1010]
};

export const GEN_NAME_TO_NUM = {
  'generation-i': 1, 'generation-ii': 2, 'generation-iii': 3, 'generation-iv': 4,
  'generation-v': 5, 'generation-vi': 6, 'generation-vii': 7, 'generation-viii': 8, 'generation-ix': 9
};

// -------- Starters y Fósiles (listas compactas) --------
// starters por gen (nombres en EN normalizados como en PokeAPI)
export const STARTERS_BY_GEN = {
  1: ['bulbasaur','charmander','squirtle'],
  2: ['chikorita','cyndaquil','totodile'],
  3: ['treecko','torchic','mudkip'],
  4: ['turtwig','chimchar','piplup'],
  5: ['snivy','tepig','oshawott'],
  6: ['chespin','fennekin','froakie'],
  7: ['rowlet','litten','popplio'],
  8: ['grookey','scorbunny','sobble'],
  9: ['sprigatito','fuecoco','quaxly'],
};

// set de fósiles (lineas fósiles clásicas + Galar)
// nombres normalizados como species/pokemon name
export const FOSSIL_SET = new Set([
  'omanyte','omastar','kabuto','kabutops','aerodactyl',
  'lileep','cradily','anorith','armaldo',
  'cranidos','rampardos','shieldon','bastiodon',
  'tirtouga','carracosta','archen','archeops',
  'tyrunt','tyrantrum','amaura','aurorus',
  'dracozolt','arctozolt','dracovish','arctovish'
]);

// -------- LocalStorage keys --------
export const LS_KEY = 'pokevoice-guessed-v1';
export const LS_CARD_SCALE = 'pokevoice-card-scale';
export const LS_GENS = 'pokevoice-gens';

// -------- Pequeña espera no bloqueante --------
export const sleep = (ms) => new Promise(r => setTimeout(r, ms));
