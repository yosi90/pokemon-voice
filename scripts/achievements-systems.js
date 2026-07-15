// achievements-systems.js
// Infra compartida para que TODOS los checks funcionen:
// - Meta enriquecida por acierto (types, gen, isLegendary/isMythical, isFossil, isStarter, etc.)
// - Contexto de run: streaks, contadores por tipo, sets por gen, "solo voz/solo teclado", tiempo
// - Conjuntos y listas: Eeveelutions, Fósiles, Tríos legendarios
// - Compleción por tipo / gen / regiones (con caché y carga perezosa desde PokeAPI)

///////////////////////
// Config / Constantes
///////////////////////
const ART_URL = (id) =>
    `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;

export const GEN_RANGES = {
    1: [1, 151],
    2: [152, 251],
    3: [252, 386],
    4: [387, 493],
    5: [494, 649],
    6: [650, 721],
    7: [722, 809],
    8: [810, 898],
    9: [899, 1010]
};

export const STARTERS_BY_GEN = {
    1: ['bulbasaur', 'charmander', 'squirtle'],
    2: ['chikorita', 'cyndaquil', 'totodile'],
    3: ['treecko', 'torchic', 'mudkip'],
    4: ['turtwig', 'chimchar', 'piplup'],
    5: ['snivy', 'tepig', 'oshawott'],
    6: ['chespin', 'fennekin', 'froakie'],
    7: ['rowlet', 'litten', 'popplio'],
    8: ['grookey', 'scorbunny', 'sobble'],
    9: ['sprigatito', 'fuecoco', 'quaxly'],
};

export const EEVEELUTIONS = new Set([
    'vaporeon', 'jolteon', 'flareon', 'espeon', 'umbreon', 'leafeon', 'glaceon', 'sylveon'
]);

export const FOSSIL_SET = new Set([
    'omanyte', 'omastar', 'kabuto', 'kabutops', 'aerodactyl',
    'lileep', 'cradily', 'anorith', 'armaldo',
    'cranidos', 'rampardos', 'shieldon', 'bastiodon',
    'tirtouga', 'carracosta', 'archen', 'archeops',
    'tyrunt', 'tyrantrum', 'amaura', 'aurorus',
    'dracozolt', 'arctozolt', 'dracovish', 'arctovish'
]);

// Tríos (y cuarteto Tapu) representados como arrays de nombres normalizados
export const TRIOS = [
    ['articuno', 'zapdos', 'moltres'], // Aves de Kanto
    ['raikou', 'entei', 'suicune'], // Bestias de Johto
    ['regirock', 'regice', 'registeel'], // Regis clásicos
    ['cobalion', 'terrakion', 'virizion'], // Espadas de la Justicia (BW)
    ['tornadus', 'thundurus', 'landorus'], // Fuerzas de la Naturaleza
    ['xerneas', 'yveltal', 'zygarde'], // Trío de Kalos
    ['solgaleo', 'lunala', 'necrozma'], // Alola "cositas"
    ['zamazenta', 'zacian', 'eternatus'], // Galar
];
export const TETRAS = [
    ['tapu-koko', 'tapu-lele', 'tapu-bulu', 'tapu-fini'], // Guardianes de Alola
];

///////////////////////
// Utilidades comunes
///////////////////////
const normalize = (s) => s?.toString().trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9.\- ]/g, '').replace(/\s+/g, ' ') || '';

const idFromUrl = (url) => {
    const m = url.match(/\/(\d+)\/?$/);
    return m ? Number(m[1]) : null;
};

const createRunId = () => {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
        return globalThis.crypto.randomUUID();
    }
    const randomPart = Math.random().toString(36).slice(2, 10);
    const timePart = Date.now().toString(36);
    return `run-${timePart}-${randomPart}`;
};

///////////////////////
// Caché PokeAPI
///////////////////////
const cache = {
    pokemon: new Map(), // id -> { id, name, types:[string], speciesId }
    species: new Map(), // speciesId -> { isLegendary, isMythical, generation:1..9, name }
    typeMembers: new Map(), // type -> Set<id> (toda la dex)
    mythicalIds: null, // Set<id> (toda la dex)
    legendaryIds: null, // Set<id> (toda la dex)
};

async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
    return res.json();
}

async function getPokemon(id) {
    if (cache.pokemon.has(id)) return cache.pokemon.get(id);
    const data = await fetchJSON(`https://pokeapi.co/api/v2/pokemon/${id}`);
    const types = data.types.map(t => t.type.name); // ['ghost','poison'...]
    const speciesId = idFromUrl(data.species.url);
    const obj = {
        id,
        name: data.name,
        types,
        speciesId
    };
    cache.pokemon.set(id, obj);
    return obj;
}

async function getSpecies(speciesId) {
    if (cache.species.has(speciesId)) return cache.species.get(speciesId);
    const data = await fetchJSON(`https://pokeapi.co/api/v2/pokemon-species/${speciesId}`);
    const genNum = (() => {
        const map = {
            'generation-i': 1,
            'generation-ii': 2,
            'generation-iii': 3,
            'generation-iv': 4,
            'generation-v': 5,
            'generation-vi': 6,
            'generation-vii': 7,
            'generation-viii': 8,
            'generation-ix': 9
        };
        return map[data.generation.name] || null;
    })();
    const obj = {
        isLegendary: data.is_legendary,
        isMythical: data.is_mythical,
        generation: genNum,
        name: data.name
    };
    cache.species.set(speciesId, obj);
    return obj;
}

async function getTypeMembers(typeName) {
    if (cache.typeMembers.has(typeName)) return cache.typeMembers.get(typeName);
    const data = await fetchJSON(`https://pokeapi.co/api/v2/type/${typeName}`);
    const set = new Set(
        data.pokemon
        .map(p => idFromUrl(p.pokemon.url))
        .filter(Boolean)
    );
    cache.typeMembers.set(typeName, set);
    return set;
}

async function getAllSpeciesFlags() {
    if (cache.mythicalIds && cache.legendaryIds) return {
        mythical: cache.mythicalIds,
        legendary: cache.legendaryIds
    };
    // Cargamos todas las species de golpe (1 petición grande) y filtramos
    const data = await fetchJSON('https://pokeapi.co/api/v2/pokemon-species?limit=20000');
    const mythical = new Set();
    const legendary = new Set();
    // Para no hacer 1000+ peticiones extra, PokeAPI list no trae flags; hacemos lote de fetch en paralelo con límite.
    // Para rendimiento en cliente, hacemos chunks:
    const urls = data.results.map(r => r.url);
    const CHUNK = 40;
    for (let i = 0; i < urls.length; i += CHUNK) {
        const slice = urls.slice(i, i + CHUNK);
        const jsons = await Promise.all(slice.map(u => fetchJSON(u).catch(() => null)));
        for (const sp of jsons) {
            if (!sp) continue;
            const sid = idFromUrl(sp.url);
            if (sp.is_mythical) mythical.add(sid);
            if (sp.is_legendary) legendary.add(sid);
            // guarda en caché base
            cache.species.set(sid, {
                isLegendary: sp.is_legendary,
                isMythical: sp.is_mythical,
                generation: (() => {
                    const g = sp.generation?.name;
                    const map = {
                        'generation-i': 1,
                        'generation-ii': 2,
                        'generation-iii': 3,
                        'generation-iv': 4,
                        'generation-v': 5,
                        'generation-vi': 6,
                        'generation-vii': 7,
                        'generation-viii': 8,
                        'generation-ix': 9
                    };
                    return map[g] || null;
                })(),
                name: sp.name
            });
        }
    }
    cache.mythicalIds = mythical;
    cache.legendaryIds = legendary;
    return {
        mythical,
        legendary
    };
}

///////////////////////
// Contexto de RUN
///////////////////////
export function createRunContext(getSelectedGens) {
    // Estado vivo por run
    const state = {
        runId: createRunId(),
        startAt: performance.now(),
        durationSec: null,

        // progreso
        guessedIds: new Set(),
        guessedNames: new Set(), // normalizados
        correctTotal: 0,
        fails: 0,
        streak: 0,
        maxStreak: 0,

        // fuentes de entrada
        usedVoice: false,
        usedKeyboard: false,
        voiceStreak: 0,
        keyboardStreak: 0,

        // contadores por tipo
        typeCounts: Object.create(null), // {fire: N, water: N...}
        // cadenas específicas
        lastGhostChain: 0,

        // sets especiales
        startersHitByGen: new Map(), // gen -> Set(name)
        fossilCount: 0,

        // cachés por run
        // (para “completar todos los de tipo X” dentro de gens activas)
        typeTargetsByActiveGens: new Map(), // type -> Set<id>
    };

    function msFromStart() {
        return performance.now() - state.startAt;
    }

    function remainingSec() {
        if (!Number.isFinite(state.durationSec)) return undefined;
        const rem = state.durationSec - msFromStart() / 1000;
        return Math.max(0, rem);
    }

    // API contexto que usarán los checks
    const ctx = {
        get runId() {
            return state.runId;
        },
        get streak() {
            return state.streak;
        },
        get fails() {
            return state.fails;
        },
        get correctTotal() {
            return state.correctTotal;
        },
        get lastGhostChain() {
            return state.lastGhostChain;
        },
        get fossilCount() {
            return state.fossilCount;
        },
        get startersHitByGen() {
            return state.startersHitByGen;
        },
        get usedVoice() {
            return state.usedVoice;
        },
        get usedKeyboard() {
            return state.usedKeyboard;
        },
        get voiceStreak() {
            return state.voiceStreak;
        },
        get keyboardStreak() {
            return state.keyboardStreak;
        },

        msFromStart,
        remainingSec,

        typeCount: (t) => state.typeCounts[t] || 0,
        hasGuessedName: (name) => state.guessedNames.has(normalize(name)),
        hasGuessedId: (id) => state.guessedIds.has(id),

        // ¿está completo el conjunto de este tipo dentro de las gens activas?
        isTypeComplete: async (type) => {
            const actives = getSelectedGens(); // array de gen numbers
            let target = state.typeTargetsByActiveGens.get(type);
            if (!target) {
                // construimos el set: intersección (Type members) ∩ (IDs de gens activas)
                const typeAll = await getTypeMembers(type); // Set<id> (toda la dex)
                const idsInActiveGens = new Set();
                for (const g of actives) {
                    const [a, b] = GEN_RANGES[g] || [];
                    if (!a) continue;
                    for (let id = a; id <= b; id++) idsInActiveGens.add(id);
                }
                target = new Set([...typeAll].filter(id => idsInActiveGens.has(id)));
                state.typeTargetsByActiveGens.set(type, target);
            }
            for (const id of target)
                if (!state.guessedIds.has(id)) return false;
            return target.size > 0; // true si había algo y todo está adivinado
        },

        // ¿completaste una gen/región concreta? (Kanto=1, Johto=2, ...)
        isGenComplete: (gen) => {
            const [a, b] = GEN_RANGES[gen] || [];
            if (!a) return false;
            for (let id = a; id <= b; id++)
                if (!state.guessedIds.has(id)) return false;
            return true;
        },

        // Estadísticas para legendarios/singulares dentro de gens activas
        countLegendaryInActives: async () => {
            const {
                legendary
            } = await getAllSpeciesFlags();
            const actives = getSelectedGens();
            let total = 0,
                got = 0;
            for (const g of actives) {
                const [a, b] = GEN_RANGES[g] || [];
                for (let id = a; id <= b; id++) {
                    const sp = await getPokemon(id).then(p => getSpecies(p.speciesId));
                    if (sp.isLegendary) {
                        total++;
                        if (state.guessedIds.has(id)) got++;
                    }
                }
            }
            return {
                got,
                total
            };
        },
        countMythicalInActives: async () => {
            const {
                mythical
            } = await getAllSpeciesFlags();
            const actives = getSelectedGens();
            let total = 0,
                got = 0;
            for (const g of actives) {
                const [a, b] = GEN_RANGES[g] || [];
                for (let id = a; id <= b; id++) {
                    const sp = await getPokemon(id).then(p => getSpecies(p.speciesId));
                    if (sp.isMythical) {
                        total++;
                        if (state.guessedIds.has(id)) got++;
                    }
                }
            }
            return {
                got,
                total
            };
        },

        // Tríos/cuartetos completados en esta run (por nombres)
        hasCompletedAnyTrio: () => {
            const names = state.guessedNames;
            return TRIOS.some(group => group.every(n => names.has(n)));
        },
        hasTapuQuartet: () => {
            const names = state.guessedNames;
            return TETRAS.some(group => group.every(n => names.has(n)));
        },

        // Sets especiales completados
        hasAllEeveelutions: () => [...EEVEELUTIONS].every(n => state.guessedNames.has(n)),
    };

    // API de ciclo de vida de la run
    function startRun({
        durationSec = null,
        runId = createRunId()
    } = {}) {
        Object.assign(state, {
            runId,
            startAt: performance.now(),
            durationSec,
            guessedIds: new Set(),
            guessedNames: new Set(),
            correctTotal: 0,
            fails: 0,
            streak: 0,
            maxStreak: 0,
            usedVoice: false,
            usedKeyboard: false,
            voiceStreak: 0,
            keyboardStreak: 0,
            typeCounts: Object.create(null),
            lastGhostChain: 0,
            startersHitByGen: new Map(),
            fossilCount: 0,
            typeTargetsByActiveGens: new Map(),
        });
    }

    function registerFail() {
        state.fails++;
        state.streak = 0;
        state.voiceStreak = 0;
        state.keyboardStreak = 0;
        state.lastGhostChain = 0;
    }

    // Enriquecemos meta a partir del id (cuando haga falta)
    async function enrichMeta(meta) {
        // meta puede venir ya con flags, pero aseguramos con PokeAPI
        const id = meta?.id;
        const nameNorm = normalize(meta?.name);
        let p = null,
            sp = null;
        if (id) {
            p = await getPokemon(id);
            sp = await getSpecies(p.speciesId);
        }
        const types = meta?.types || p?.types || [];
        const gen = Number.isInteger(meta?.gen) ? meta.gen : (sp?.generation?? null);
        const isLegendary = (typeof meta?.isLegendary === 'boolean') ? meta.isLegendary : (sp?.isLegendary?? false);
        const isMythical = (typeof meta?.isMythical === 'boolean') ? meta.isMythical : (sp?.isMythical?? false);
        const isFossil = (typeof meta?.isFossil === 'boolean') ? meta.isFossil : (FOSSIL_SET.has(nameNorm));
        const isStarter = (typeof meta?.isStarter === 'boolean') ? meta.isStarter :
            (Number.isInteger(gen) && STARTERS_BY_GEN[gen]?.includes(nameNorm)) || false;

        return {
            ...meta,
            id: id || null,
            name: meta?.name || p?.name || null,
            types,
            gen,
            isLegendary,
            isMythical,
            isFossil,
            isStarter,
            remainingSec: meta?.remainingSec?? remainingSec(),
        };
    }

    async function registerGuess(metaIn) {
        const meta = await enrichMeta(metaIn);

        // Actualiza estado base
        state.correctTotal++;
        state.streak++;
        state.maxStreak = Math.max(state.maxStreak, state.streak);

        const byVoice = meta.source === 'voice';
        const byKey = meta.source === 'keyboard';
        if (byVoice) {
            state.usedVoice = true;
            state.voiceStreak++;
            state.keyboardStreak = 0;
        }
        if (byKey) {
            state.usedKeyboard = true;
            state.keyboardStreak++;
            state.voiceStreak = 0;
        }

        if (meta.id) state.guessedIds.add(meta.id);
        if (meta.name) state.guessedNames.add(normalize(meta.name));

        // contadores por tipo
        for (const t of (meta.types || [])) {
            state.typeCounts[t] = (state.typeCounts[t] || 0) + 1;
            if (t === 'ghost') state.lastGhostChain++; // cadena fantasma
        }
        if (!meta.types?.includes('ghost')) state.lastGhostChain = 0;

        // fósiles
        if (meta.isFossil) state.fossilCount++;

        // starters por gen
        if (meta.isStarter && Number.isInteger(meta.gen)) {
            const set = state.startersHitByGen.get(meta.gen) || new Set();
            set.add(normalize(meta.name));
            state.startersHitByGen.set(meta.gen, set);
        }

        return meta; // devolvemos meta enriquecida por si el motor de logros quiere usarla
    }

    return {
        // ciclo
        startRun,
        registerGuess,
        registerFail,

        // para el motor
        ctx,
        // exporto helpers que a veces interesan
        ART_URL,
    };
}
