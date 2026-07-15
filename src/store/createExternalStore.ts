export type StoreListener = () => void;
export type StoreUpdater<State> = State | ((current: State) => State);

export interface ExternalStore<State> {
  getSnapshot: () => State;
  setState: (updater: StoreUpdater<State>) => State;
  subscribe: (listener: StoreListener) => () => void;
}

export function createExternalStore<State>(initialState: State): ExternalStore<State> {
  let state = initialState;
  const listeners = new Set<StoreListener>();

  const getSnapshot = () => state;

  const setState = (updater: StoreUpdater<State>) => {
    const next = typeof updater === 'function'
      ? (updater as (current: State) => State)(state)
      : updater;
    if (Object.is(next, state)) return state;

    state = next;
    for (const listener of [...listeners]) listener();
    return state;
  };

  const subscribe = (listener: StoreListener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  return { getSnapshot, setState, subscribe };
}
