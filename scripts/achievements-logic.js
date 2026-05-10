// achievements-logic.js
// Motor de evaluación + UI de logros con persistencia en localStorage.
// API expuesta: ACV.startRun({durationSec}), ACV.registerGuess(meta), ACV.registerFail()

import {
    createRunContext
} from './achievements-systems.js';
import {
    ACHIEVEMENTS
} from './achievements-list.js';

// ====== UI config ======
const TIER_ICON = {
    Pokeball: '⚪',
    Superball: '🔵',
    Ultraball: '🟡',
    MasterBall: '🟣'
};

const TIER_CLASS = {
    Pokeball: 'pokeball',
    Superball: 'superball',
    Ultraball: 'ultraball',
    MasterBall: 'masterball'
};

const PUBLIC_BASE = import.meta.env?.BASE_URL || './';

function publicAsset(path) {
    return `${PUBLIC_BASE}${path.replace(/^\/+/, '')}`;
}


// ====== Persistencia ======
const STORAGE_KEY = 'pokevoice-achievements-v1';
let _acvLoadedFromStorage = false;
let _lastDurationSec = null;
let _runToken = 0;

function saveUnlockState() {
    try {
        const arr = [...unlockState.unlocked.values()];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    } catch (e) {
        console.warn('No se pudo guardar logros:', e);
    }
}

function loadUnlockStateOnce() {
    if (_acvLoadedFromStorage) return; // evita dobles cargas y recursiones
    _acvLoadedFromStorage = true;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
            for (const entry of arr) {
                if (entry && entry.id) {
                    const date = entry.date || Date.now();
                    unlockState.unlocked.set(entry.id, {
                        id: entry.id,
                        date
                    });
                    unlockState.history.push({
                        id: entry.id,
                        date
                    });
                }
            }
        }
    } catch (e) {
        console.warn('No se pudo cargar logros:', e);
    }
}

// ====== Estado de la run (vive en memoria) ======
const unlockState = {
    unlocked: new Map(), // id -> { id, date }
    history: [], // [{id, date}] (histórico visible solo en sesión)
};
let _runStartMs = 0;

// ====== DOM refs (lazy) ======
const ui = {
    toastRoot: null,
    drawerEl: null,
    drawerList: null,
    btnOpen: null,
    btnClose: null,
};

function ensureUI() {
    if (!ui.toastRoot) ui.toastRoot = document.getElementById('acv-toast-container');
    if (!ui.drawerEl) ui.drawerEl = document.getElementById('acv-drawer');
    if (!ui.drawerList) ui.drawerList = document.getElementById('acv-ach-list');
    if (!ui.btnOpen) ui.btnOpen = document.getElementById('acv-ach-btn');
    if (!ui.btnClose) ui.btnClose = document.getElementById('acv-drawer-close');

    // Toggle por botón 🏆
    if (ui.btnOpen && !ui.btnOpen.__wired) {
        ui.btnOpen.__wired = true;
        ui.btnOpen.addEventListener('click', () => {
            const isOpen = ui.drawerEl?.getAttribute('aria-hidden') === 'false';
            isOpen ? closeDrawer() : openDrawer();
        });
    }
    // Cerrar por X
    if (ui.btnClose && !ui.btnClose.__wired) {
        ui.btnClose.__wired = true;
        ui.btnClose.addEventListener('click', closeDrawer);
    }
    // Cerrar al clicar fuera
    if (!document.__acvOutsideCloseWired) {
        document.__acvOutsideCloseWired = true;
        document.addEventListener('click', (ev) => {
            const isOpen = ui.drawerEl?.getAttribute('aria-hidden') === 'false';
            if (!isOpen) return;
            if (ui.drawerEl.contains(ev.target)) return;
            if (ui.btnOpen?.contains(ev.target)) return;
            closeDrawer();
        });
    }
}

function toastAch({
    title,
    tier,
    desc
}) {
    ensureUI();
    const root = ui.toastRoot || document.body;
    const el = document.createElement('div');
    const tierClass = TIER_CLASS[tier] || 'pokeball';
    const durationMs = 5200;
    el.className = `acv-toast acv-toast--${tierClass}`;
    el.style.setProperty('--toast-duration', `${durationMs}ms`);
    el.innerHTML = `
    <span class="ball">${TIER_ICON[tier] || '⚪'}</span>
    <div class="acv-toast__body">
      <div class="acv-toast__eyebrow">Logro desbloqueado</div>
      <b>${title}</b>
      <div>${desc || ''}</div>
    </div>
    <button class="acv-toast__close" type="button" aria-label="Descartar logro">×</button>
    <span class="acv-toast__timer"></span>`;
    root.appendChild(el);
    const remove = () => el.remove();
    el.querySelector('.acv-toast__close')?.addEventListener('click', remove, { once: true });
    setTimeout(remove, durationMs);
}

function clearAchievementStorage() {
    try {
        const keys = [];
        for (let i = 0; i < localStorage.length; i += 1) {
            const key = localStorage.key(i);
            if (key === STORAGE_KEY || key?.startsWith('pokevoice-achievements')) keys.push(key);
        }
        for (const key of keys) localStorage.removeItem(key);
    } catch {}
}

function openDrawer() {
    ensureUI();
    ui.drawerEl?.setAttribute('aria-hidden', 'false');
    renderDrawer();
}

function closeDrawer() {
    ensureUI();
    ui.drawerEl?.setAttribute('aria-hidden', 'true');
}

function renderDrawer() {
    ensureUI();
    if (!ui.drawerList) return;

    const entries = [...unlockState.unlocked.values()]
        .sort((a, b) => a.date - b.date); // opcional: orden cronológico

    if (!entries.length) {
        ui.drawerList.innerHTML = `
      <div class="acv-ach" style="opacity:.8">
        <div class="ball">🏆</div>
        <div>
          <div class="title">Aún no hay logros</div>
          <div class="desc">¡Empieza una run y desbloquea alguno!</div>
        </div>
        <div>—</div>
      </div>`;
        return;
    }

    // Mapeamos a datos completos (para título/tier/desc)
    const byId = new Map(ACHIEVEMENTS.map(a => [a.id, a]));
    ui.drawerList.innerHTML = entries.map(e => {
        const a = byId.get(e.id);
        const when = new Date(e.date);
        return `
      <div class="acv-ach" data-id="${e.id}">
        <div class="ball">${(a && a.tier && ({Pokeball:'⚪',Superball:'🔵',Ultraball:'🟡',MasterBall:'🟣'})[a.tier]) || '⚪'}</div>
        <div>
          <div class="title">${a?.title || e.id}</div>
          <div class="desc">${a?.desc || ''}</div>
        <div class="date">${when.toLocaleString()}</div>
        </div>
        <div class="acv-ach__stamp" aria-label="Logro obtenido">
          <img src="${publicAsset('assets/images/ash-thumbs-up.png')}" alt="" loading="lazy">
        </div>
      </div>`;
    }).join('');
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
    // Limpia SOLO estado efímero de la run
    unlockState.history.length = 0;

    // Si se pide borrar persistente, vacía y elimina del storage
    if (clearPersistent) {
        _runToken++;
        unlockState.unlocked.clear();
        clearAchievementStorage();
        _acvLoadedFromStorage = true;
    }
    renderDrawer();
}

function restartEngine(durationSec = null) {
    _runToken++;
    _lastDurationSec = durationSec;
    engine.startRun({
        durationSec
    });
    _runStartMs = Date.now();
}

async function maybeUnlock(a, meta, ctx) {
    if (unlockState.unlocked.has(a.id)) return false;

    let ok;
    try {
        ok = a.check(meta, ctx);
        if (ok && typeof ok.then === 'function') ok = await ok; // soporta checks async
    } catch {
        ok = false;
    }

    if (!ok) return false;

    const entry = {
        id: a.id,
        date: Date.now()
    };
    unlockState.unlocked.set(a.id, entry);
    unlockState.history.push(entry);
    toastAch({
        title: a.title,
        tier: a.tier,
        desc: a.desc
    });
    renderDrawer();
    saveUnlockState(); // <— persistimos aquí
    return true;
}

async function evaluate(eventType, meta) {
    // Filtra por evento y ámbito run
    const list = ACHIEVEMENTS.filter(a => (a.event || 'guess') === eventType && (a.scope || 'run') === 'run');
    for (const a of list) {
        await maybeUnlock(a, meta, engine.ctx);
    }
}

async function unlockById(id) {
    ensureUI();
    const achievement = ACHIEVEMENTS.find(a => a.id === id);
    if (!achievement) return false;
    return maybeUnlock(achievement, { id }, engine.ctx);
}

// ====== API pública esperada por tu app ======
export const ACV = {
    // Inicia una nueva run (reinicia contadores/rachas/sets efímeros, carga persistido una vez)
    startRun({
        durationSec = null
    } = {}) {
        ensureUI();
        // Carga persistente una sola vez y pinta lo que haya.
        loadUnlockStateOnce();
        _lastDurationSec = durationSec;
        engine.startRun({
            durationSec
        });
        _runStartMs = Date.now();
        resetRunState(false); // false = NO borrar logros persistentes
        renderDrawer();
    },

    resetRun({
        durationSec
    } = {}) {
        // si no te pasan duration, reutiliza el último
        const dur = (durationSec !== undefined) ? durationSec : _lastDurationSec;
        // reinicia SOLO el estado de la run, no borra logros persistidos
        ensureUI();
        restartEngine(dur || null);
        resetRunState(false);
        renderDrawer();
    },

    // Registra un acierto (meta puede traer id/name/types/...; el engine la enriquece si falta)
    async registerGuess(meta) {
        ensureUI();
        const token = _runToken;
        const enriched = await engine.registerGuess(meta || {});
        if (token !== _runToken) return enriched;
        await evaluate('guess', enriched);
        return enriched;
    },

    // Fallo explícito (si lo usas)
    async registerFail() {
        ensureUI();
        const token = _runToken;
        engine.registerFail();
        if (token !== _runToken) return;
        await evaluate('fail', {});
    },

    async unlock(id) {
        return unlockById(id);
    },

    // Borra TODO lo persistido (por si quieres un botón "reset global")
    resetAllPersistent({
        restartRun = false,
        durationSec = null
    } = {}) {
        ensureUI();
        resetRunState(true); // limpia Unlocks + localStorage
        if (restartRun) restartEngine(durationSec);
        renderDrawer();
    },

    // Helpers
    openDrawer,
    closeDrawer,
    renderDrawer,
    has: (id) => unlockState.unlocked.has(id),
    getUnlockedIds: () => [...unlockState.unlocked.keys()],
    getHistory: () => [...unlockState.history],
    getRunUnlocks,
    getAchievementMeta(id) {
        return ACHIEVEMENTS.find(a => a.id === id) || null;
    }
};

function getRunUnlocks() {
  return unlockState.history
    .filter(e => e.date >= _runStartMs)
    .map(e => e.id);
}

// Si quieres mostrar títulos/tiers en el modal
function getAchievementMeta(id) {
  return ACHIEVEMENTS.find(a => a.id === id) || null;
}
