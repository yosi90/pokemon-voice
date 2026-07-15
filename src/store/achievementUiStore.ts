import { createExternalStore } from './createExternalStore.js';

export interface AchievementToastNotice {
  id: string;
  achievementId: string;
  title: string;
  description: string;
  tier: string;
  durationMs: number;
}

export interface AchievementUiSnapshot {
  drawerOpen: boolean;
  toasts: readonly AchievementToastNotice[];
}

interface EnqueueAchievementToastOptions {
  achievementId: string;
  title: string;
  description?: string;
  tier?: string;
  durationMs?: number;
}

const initialState: AchievementUiSnapshot = Object.freeze({
  drawerOpen: false,
  toasts: Object.freeze([]),
});

const store = createExternalStore<AchievementUiSnapshot>(initialState);
let nextToastId = 0;

const update = (updater: (current: AchievementUiSnapshot) => AchievementUiSnapshot) => (
  store.setState(current => Object.freeze(updater(current)))
);

export const achievementUiStore = {
  getSnapshot: store.getSnapshot,
  subscribe: store.subscribe,

  openDrawer() {
    update(current => current.drawerOpen ? current : { ...current, drawerOpen: true });
  },

  closeDrawer() {
    update(current => current.drawerOpen ? { ...current, drawerOpen: false } : current);
  },

  toggleDrawer() {
    update(current => ({ ...current, drawerOpen: !current.drawerOpen }));
  },

  enqueueToast({
    achievementId,
    title,
    description = '',
    tier = 'Pokeball',
    durationMs = 5200,
  }: EnqueueAchievementToastOptions) {
    const toast: AchievementToastNotice = Object.freeze({
      id: `achievement-toast-${++nextToastId}`,
      achievementId,
      title,
      description,
      tier,
      durationMs,
    });
    update(current => ({ ...current, toasts: Object.freeze([...current.toasts, toast]) }));
    return toast.id;
  },

  dismissToast(id: string) {
    update(current => {
      const toasts = current.toasts.filter(toast => toast.id !== id);
      return toasts.length === current.toasts.length
        ? current
        : { ...current, toasts: Object.freeze(toasts) };
    });
  },

  reset() {
    nextToastId = 0;
    store.setState(initialState);
  },
};
