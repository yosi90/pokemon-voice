import { sleep } from './pokemon.js';

const cryCache = new Map();
let audioPrimed = false;

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

export async function playPokemonCry(id, { delay = 700, volume = 0.42 } = {}) {
  if (delay > 0) await sleep(delay);
  const url = await fetchCryUrl(id);
  if (!url) throw new Error(`No hay cry disponible para ${id}`);
  const audio = new Audio(url);
  audio.volume = volume;
  audio.preload = 'auto';
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
