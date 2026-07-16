// achievements-logic.js
// Adaptador compatible entre contexto legacy, evaluación, progreso y persistencia.
// API expuesta: ACV.startRun({durationSec}), ACV.registerGuess(meta), ACV.registerFail()

import {
    createRunContext
} from './achievements-systems.js';
import {
    ACHIEVEMENTS
} from './achievements-list.js';
import {
    findSatisfiedAchievements,
    isAchievementSatisfied
} from '../src/domain/achievements/evaluateAchievements.ts';
import {
    achievementProgress
} from '../src/store/achievementProgressStore.ts';
import {
    achievementUiStore
} from '../src/store/achievementUiStore.ts';
import {
    createBrowserAchievementStorage
} from '../src/services/achievementStorage.ts';
import {
    recordBrowserModeAchievement,
    syncBrowserAchievements
} from '../src/store/browserPokeVoiceSaveStore.ts';

export { achievementProgress } from '../src/store/achievementProgressStore.ts';


// ====== Persistencia ======
let _acvLoadedFromStorage = false;
let _lastDurationSec = null;
let _runToken = 0;
const achievementStorage = createBrowserAchievementStorage(() => localStorage);

function saveUnlockState() {
    try {
        const records = achievementProgress.getSnapshot().permanentRecords;
        achievementStorage.save(records);
        syncBrowserAchievements(records);
    } catch (e) {
        console.warn('No se pudo guardar logros:', e);
    }
}

function loadUnlockStateOnce() {
    if (_acvLoadedFromStorage) return; // evita dobles cargas y recursiones
    _acvLoadedFromStorage = true;
    try {
        achievementProgress.loadPermanent(achievementStorage.load());
    } catch (e) {
        console.warn('No se pudo cargar logros:', e);
    }
}

function toastAch({
    id,
    title,
    tier,
    desc
}) {
    achievementUiStore.enqueueToast({
        achievementId: id,
        title,
        tier,
        description: desc
    });
}

function clearAchievementStorage() {
    try {
        achievementStorage.clear();
    } catch {}
}

function openDrawer() {
    achievementUiStore.openDrawer();
}

function closeDrawer() {
    achievementUiStore.closeDrawer();
}

function toggleDrawer() {
    achievementUiStore.toggleDrawer();
}

function renderDrawer() {
    return achievementProgress.getSnapshot().permanentRecords;
}


// ====== Engine de contexto (usa gens activas de tu app) ======
const getSelectedGens = () => {
    try {
        const raw = localStorage.getItem('pokevoice-gens');
        const arr = raw ? JSON.parse(raw).map(Number) : [1, 2, 3, 4, 5, 6, 7, 8, 9];
        return Array.isArray(arr) && arr.length ? arr : [1, 2, 3, 4, 5, 6, 7, 8, 9];
    } catch {
        return [1, 2, 3, 4, 5, 6, 7, 8, 9];
    }
};

const engine = createRunContext(getSelectedGens);

// ====== Core ======
function resetRunState(clearPersistent = false) {
    // Si se pide borrar persistente, vacía y elimina del storage
    if (clearPersistent) {
        _runToken++;
        achievementProgress.clearAll();
        clearAchievementStorage();
        _acvLoadedFromStorage = true;
    }
}

function restartEngine(durationSec = null, runId, modeId, satisfiedIds = []) {
    _runToken++;
    _lastDurationSec = durationSec;
    engine.startRun({
        durationSec,
        ...(runId ? { runId } : {})
    });
    achievementProgress.startRun({
        runId: engine.ctx.runId,
        startedAt: Date.now(),
        ...(modeId ? { modeId } : {}),
        satisfiedIds
    });
    return engine.ctx.runId;
}

function awardAchievement(a, explicitModeId) {
    const result = achievementProgress.satisfy({
        id: a.id,
        date: Date.now(),
        domain: a.domain || 'pokedex',
        ...(explicitModeId ? { originModeId: explicitModeId } : {})
    });
    if (result.status === 'alreadySatisfiedThisRun') return false;

    const modeId = explicitModeId || achievementProgress.getSnapshot().run.modeId;
    if (!modeId && result.status === 'alreadyPermanent') return false;
    if (modeId) recordBrowserModeAchievement(a.id);

    toastAch({
        id: a.id,
        title: modeId ? 'Logro del reto: ' + a.title : a.title,
        tier: a.tier,
        desc: modeId
            ? (result.status === 'newlyUnlocked'
                ? a.desc + ' También se ha añadido a tu colección permanente.'
                : a.desc + ' Cuenta para esta sesión sin duplicar tu colección permanente.')
            : a.desc
    });
    if (result.status === 'newlyUnlocked') saveUnlockState();
    return true;
}

async function maybeUnlock(a, meta, ctx) {
    if (!await isAchievementSatisfied(a, meta, ctx)) return false;
    return awardAchievement(a);
}

async function evaluate(eventType, meta) {
    const satisfied = await findSatisfiedAchievements(ACHIEVEMENTS, eventType, meta, engine.ctx);
    for (const achievement of satisfied) awardAchievement(achievement);
}

async function unlockById(id) {
    const achievement = ACHIEVEMENTS.find(a => a.id === id);
    if (!achievement) return false;
    return maybeUnlock(achievement, { id }, engine.ctx);
}

async function unlockForMode(id, modeId) {
    const achievement = ACHIEVEMENTS.find(a => a.id === id && a.modeId === modeId);
    if (!achievement) return false;
    if (!await isAchievementSatisfied(achievement, { id }, engine.ctx)) return false;
    return awardAchievement(achievement, modeId);
}

// ====== API pública esperada por tu app ======
export const ACV = {
    // Inicia una nueva run (reinicia contadores/rachas/sets efímeros, carga persistido una vez)
    /**
     * @param {{durationSec?: number | null, runId?: string, modeId?: string, satisfiedIds?: string[]}} [options]
     */
    startRun({
        durationSec = null,
        runId,
        modeId,
        satisfiedIds = []
    } = {}) {
        // Carga persistente una sola vez y pinta lo que haya.
        loadUnlockStateOnce();
        restartEngine(durationSec, runId, modeId, satisfiedIds);
        resetRunState(false); // false = NO borrar logros persistentes
    },

    resetRun({
        durationSec,
        modeId
    } = {}) {
        // si no te pasan duration, reutiliza el último
        const dur = (durationSec !== undefined) ? durationSec : _lastDurationSec;
        // reinicia SOLO el estado de la run, no borra logros persistidos
        return restartEngine(dur || null, undefined, modeId);
        resetRunState(false);
    },

    // Registra un acierto (meta puede traer id/name/types/...; el engine la enriquece si falta)
    async registerGuess(meta) {
        const token = _runToken;
        const enriched = await engine.registerGuess(meta || {});
        if (token !== _runToken) return enriched;
        await evaluate('guess', enriched);
        return enriched;
    },

    // Fallo explícito (si lo usas)
    async registerFail() {
        const token = _runToken;
        engine.registerFail();
        if (token !== _runToken) return;
        await evaluate('fail', {});
    },

    async unlock(id) {
        return unlockById(id);
    },

    async unlockForMode(id, modeId) {
        return unlockForMode(id, modeId);
    },

    // Borra TODO lo persistido (por si quieres un botón "reset global")
    resetAllPersistent({
        restartRun = false,
        durationSec = null
    } = {}) {
        resetRunState(true); // limpia Unlocks + localStorage
        if (restartRun) restartEngine(durationSec);
    },

    // Helpers
    openDrawer,
    closeDrawer,
    toggleDrawer,
    renderDrawer,
    has: (id) => achievementProgress.hasPermanent(id),
    getUnlockedIds: () => achievementProgress.getSnapshot().permanentRecords.map(record => record.id),
    getHistory: () => achievementProgress.getSnapshot().run.newlyUnlockedIds
        .map(id => achievementProgress.getPermanentRecord(id))
        .filter(Boolean),
    getRunUnlocks,
    getRunSatisfiedIds: () => [...achievementProgress.getSnapshot().run.satisfiedIds],
    getAchievementMeta(id) {
        return ACHIEVEMENTS.find(a => a.id === id) || null;
    }
};

function getRunUnlocks() {
  return [...achievementProgress.getSnapshot().run.newlyUnlockedIds];
}
