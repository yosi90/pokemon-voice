import { LS_CARD_SCALE, LS_KEY } from '../../scripts/utils.js';
import { CARD_SIZE_DEFAULT, CARD_SIZE_MAX, CARD_SIZE_MIN } from './constants.js';

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
  if (!Number.isFinite(saved)) return CARD_SIZE_DEFAULT;
  if (saved > 0 && saved <= 2) return CARD_SIZE_DEFAULT;
  if (saved < 112) return CARD_SIZE_DEFAULT;
  return Math.min(CARD_SIZE_MAX, Math.max(CARD_SIZE_MIN, saved));
}

export function saveGuessed(next) {
  localStorage.setItem(LS_KEY, JSON.stringify([...next]));
}
