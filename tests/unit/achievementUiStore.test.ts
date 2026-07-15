import { describe, expect, it, vi } from 'vitest';
import { achievementUiStore } from '../../src/store/achievementUiStore.js';

describe('store de presentación de logros', () => {
  it('abre y cierra el cajón notificando solo cambios reales', () => {
    achievementUiStore.reset();
    const listener = vi.fn();
    const unsubscribe = achievementUiStore.subscribe(listener);

    achievementUiStore.openDrawer();
    achievementUiStore.openDrawer();
    achievementUiStore.closeDrawer();
    achievementUiStore.toggleDrawer();
    achievementUiStore.toggleDrawer();
    unsubscribe();

    expect(listener).toHaveBeenCalledTimes(4);
    expect(achievementUiStore.getSnapshot().drawerOpen).toBe(false);
  });

  it('encola avisos independientes y permite descartarlos por id', () => {
    achievementUiStore.reset();
    const firstId = achievementUiStore.enqueueToast({
      achievementId: 'first-blood',
      title: 'Primer paso',
    });
    const secondId = achievementUiStore.enqueueToast({
      achievementId: 'classic-start-pikachu',
      title: 'Un inicio clásico',
      tier: 'Superball',
    });

    expect(achievementUiStore.getSnapshot().toasts.map(toast => toast.id)).toEqual([
      firstId,
      secondId,
    ]);

    achievementUiStore.dismissToast(firstId);

    expect(achievementUiStore.getSnapshot().toasts).toHaveLength(1);
    expect(achievementUiStore.getSnapshot().toasts[0].achievementId).toBe('classic-start-pikachu');
  });
});
