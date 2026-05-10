const STORAGE_KEY = 'pokevoice-easter-eggs-v1';

const DEFAULT_STATE = {
  meowthCoins: 0,
  gimmighoulCoins: 0,
  unownMessage: '',
  palafinPending: false,
};

export function readEasterEggState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_STATE, ...(parsed && typeof parsed === 'object' ? parsed : {}) };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function saveEasterEggState(next) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...DEFAULT_STATE, ...next }));
}

export function resetEasterEggState() {
  localStorage.removeItem(STORAGE_KEY);
  return { ...DEFAULT_STATE };
}
