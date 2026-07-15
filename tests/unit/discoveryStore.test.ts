import { describe, expect, it, vi } from 'vitest';
import { createDiscoveryStore } from '../../src/store/discoveryStore.js';

describe('store de descubrimientos', () => {
  it('normaliza el estado inicial conservando el orden válido', () => {
    const store = createDiscoveryStore({ initialIds: [25, '1' as unknown as number, 25, -4, Number.NaN] });

    expect(store.getSnapshot().discoveryOrder).toEqual([25, 1]);
    expect([...store.getSnapshot().guessedIds]).toEqual([25, 1]);
  });

  it('notifica y persiste únicamente descubrimientos nuevos', () => {
    const persist = vi.fn();
    const listener = vi.fn();
    const store = createDiscoveryStore({ initialIds: [1], persist });
    const unsubscribe = store.subscribe(listener);

    expect(store.discover(25)).toBe(true);
    expect(store.discover(25)).toBe(false);
    unsubscribe();
    store.discover(133);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenNthCalledWith(1, [1, 25]);
    expect(persist).toHaveBeenNthCalledWith(2, [1, 25, 133]);
  });

  it('reinicia el snapshot y la persistencia sin depender de React', () => {
    const persist = vi.fn();
    const store = createDiscoveryStore({ initialIds: [1, 25], persist });

    store.reset();

    expect(store.getSnapshot().discoveryOrder).toEqual([]);
    expect(store.getSnapshot().guessedIds.size).toBe(0);
    expect(persist).toHaveBeenLastCalledWith([]);
  });
});
