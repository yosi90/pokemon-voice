import { sleep } from './pokemon.js';

const cryCache = new Map();
const cryBlobCache = new Map();
const DB_NAME = 'pokevoice-audio-cache';
const DB_VERSION = 1;
const STORE_NAME = 'cries';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
let audioPrimed = false;
let cleanupStarted = false;

function canUseIndexedDb() {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

function openAudioDb() {
  if (!canUseIndexedDb()) return Promise.resolve(null);
  return new Promise(resolve => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

async function withAudioStore(mode, fn) {
  const db = await openAudioDb();
  if (!db) return null;
  return new Promise(resolve => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    let settled = false;
    const done = value => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    try {
      fn(store, done);
    } catch {
      done(null);
    }
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      db.close();
      done(null);
    };
    tx.onabort = () => {
      db.close();
      done(null);
    };
  });
}

function isFresh(entry) {
  return entry?.blob && Date.now() - Number(entry.createdAt || 0) < ONE_DAY_MS;
}

function getAudioContext() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  return AudioCtx ? new AudioCtx() : null;
}

export async function primeAudio() {
  audioPrimed = true;
  try {
    const ctx = getAudioContext();
    if (!ctx) return true;
    if (ctx.state === 'suspended') await ctx.resume();
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.connect(ctx.destination);
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(40, ctx.currentTime);
    osc.connect(gain);
    osc.start();
    osc.stop(ctx.currentTime + 0.02);
    window.setTimeout(() => ctx.close?.(), 80);
    return true;
  } catch {
    return false;
  }
}

async function fetchCryUrl(id) {
  if (cryCache.has(id)) return cryCache.get(id);
  const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
  if (!res.ok) throw new Error(`PokeAPI respondió ${res.status}`);
  const data = await res.json();
  const url = data?.cries?.latest || data?.cries?.legacy || '';
  cryCache.set(id, url);
  return url;
}

async function getCachedCryBlob(id) {
  const memoryEntry = cryBlobCache.get(id);
  if (isFresh(memoryEntry)) return memoryEntry.blob;
  if (memoryEntry) cryBlobCache.delete(id);

  const entry = await withAudioStore('readonly', (store, done) => {
    const request = store.get(id);
    request.onsuccess = () => done(request.result || null);
    request.onerror = () => done(null);
  });
  if (!isFresh(entry)) return null;
  cryBlobCache.set(id, { blob: entry.blob, createdAt: entry.createdAt });
  return entry.blob;
}

async function saveCryBlob(id, blob, sourceUrl) {
  const entry = { id, blob, sourceUrl, createdAt: Date.now() };
  cryBlobCache.set(id, entry);
  await withAudioStore('readwrite', (store, done) => {
    const request = store.put(entry);
    request.onsuccess = () => done(true);
    request.onerror = () => done(false);
  });
}

async function fetchCryBlob(id) {
  const cached = await getCachedCryBlob(id);
  if (cached) return cached;

  const url = await fetchCryUrl(id);
  if (!url) throw new Error(`No hay cry disponible para ${id}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo descargar el cry ${id}: ${res.status}`);
  const blob = await res.blob();
  await saveCryBlob(id, blob, url);
  return blob;
}

async function cleanupOldCryBlobs() {
  if (cleanupStarted) return;
  cleanupStarted = true;
  const cutoff = Date.now() - ONE_DAY_MS;
  await withAudioStore('readwrite', (store, done) => {
    const request = store.openCursor();
    request.onsuccess = event => {
      const cursor = event.target.result;
      if (!cursor) {
        done(true);
        return;
      }
      if (Number(cursor.value?.createdAt || 0) < cutoff) {
        cursor.delete();
      }
      cursor.continue();
    };
    request.onerror = () => done(false);
  });
}

export async function playPokemonCry(id, { delay = 700, volume = 0.42 } = {}) {
  if (delay > 0) await sleep(delay);
  let objectUrl = '';
  let src = '';
  try {
    const blob = await fetchCryBlob(id);
    objectUrl = URL.createObjectURL(blob);
    src = objectUrl;
  } catch (error) {
    console.warn('No se pudo usar la caché de audio, reproduciendo desde la URL remota:', error);
    src = await fetchCryUrl(id);
  }
  if (!src) throw new Error(`No hay cry disponible para ${id}`);
  const audio = new Audio(src);
  audio.volume = volume;
  audio.preload = 'auto';
  if (objectUrl) {
    const revoke = () => URL.revokeObjectURL(objectUrl);
    audio.addEventListener('ended', revoke, { once: true });
    audio.addEventListener('error', revoke, { once: true });
  }
  await audio.play();
}

export function playGengarScareTone() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = 'sawtooth';
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(760, now);
    filter.frequency.exponentialRampToValueAtTime(180, now + 0.34);
    osc.frequency.setValueAtTime(210, now);
    osc.frequency.exponentialRampToValueAtTime(74, now + 0.38);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.16, now + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
    osc.connect(filter).connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.45);
    window.setTimeout(() => ctx.close?.(), 700);
  } catch {}
}

export function wasAudioPrimed() {
  return audioPrimed;
}

cleanupOldCryBlobs();
