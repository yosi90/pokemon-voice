import { LS_CARD_SCALE, LS_KEY } from '../../scripts/utils.js';
import { normalizeCardSize } from '../domain/progress/pokeVoiceSave.js';

export function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function readCardSize() {
  const saved = Number(localStorage.getItem(LS_CARD_SCALE));
  return normalizeCardSize(saved);
}

export function saveGuessed(next) {
  localStorage.setItem(LS_KEY, JSON.stringify([...next]));
}
