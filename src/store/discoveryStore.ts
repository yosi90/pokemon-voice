import type { PokemonSpeciesId } from '../../packages/contracts/src/index.js';
import { createExternalStore } from './createExternalStore.js';

export interface DiscoverySnapshot {
  guessedIds: ReadonlySet<PokemonSpeciesId>;
  discoveryOrder: readonly PokemonSpeciesId[];
}

export interface DiscoveryStore {
  getSnapshot: () => DiscoverySnapshot;
  subscribe: (listener: () => void) => () => void;
  discover: (speciesId: PokemonSpeciesId) => boolean;
  reset: () => void;
}

export interface CreateDiscoveryStoreOptions {
  initialIds?: Iterable<number>;
  persist?: (ids: readonly PokemonSpeciesId[]) => void;
}

function normalizeIds(ids: Iterable<number>): PokemonSpeciesId[] {
  return [...new Set([...ids]
    .map(Number)
    .filter(id => Number.isInteger(id) && id > 0))];
}

function createSnapshot(ids: readonly PokemonSpeciesId[]): DiscoverySnapshot {
  const discoveryOrder = Object.freeze([...ids]);
  return Object.freeze({
    guessedIds: new Set(discoveryOrder),
    discoveryOrder,
  });
}

export function createDiscoveryStore({
  initialIds = [],
  persist = () => undefined,
}: CreateDiscoveryStoreOptions = {}): DiscoveryStore {
  const initialOrder = normalizeIds(initialIds);
  const store = createExternalStore(createSnapshot(initialOrder));

  const discover = (speciesId: PokemonSpeciesId) => {
    const id = Number(speciesId);
    const current = store.getSnapshot();
    if (!Number.isInteger(id) || id < 1 || current.guessedIds.has(id)) return false;

    const nextOrder = [...current.discoveryOrder, id];
    store.setState(createSnapshot(nextOrder));
    persist(nextOrder);
    return true;
  };

  const reset = () => {
    if (store.getSnapshot().discoveryOrder.length) {
      store.setState(createSnapshot([]));
    }
    persist([]);
  };

  return {
    getSnapshot: store.getSnapshot,
    subscribe: store.subscribe,
    discover,
    reset,
  };
}
