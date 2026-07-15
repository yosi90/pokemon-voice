import { useCallback, useRef, useState } from 'react';
import type { LegacyEasterEggState } from '../domain/discovery/planPostDiscovery.js';
import { readEasterEggState, resetEasterEggState, saveEasterEggState } from '../lib/easterEggState.js';

type EasterEggUpdater = LegacyEasterEggState | ((current: LegacyEasterEggState) => LegacyEasterEggState);

export function useLegacyEasterEggState() {
  const [easterEggState, setEasterEggState] = useState<LegacyEasterEggState>(
    () => readEasterEggState() as LegacyEasterEggState,
  );
  const stateRef = useRef(easterEggState);

  const updateEasterEggState = useCallback((updater: EasterEggUpdater) => {
    const next = typeof updater === 'function' ? updater(stateRef.current) : updater;
    stateRef.current = next;
    saveEasterEggState(next);
    setEasterEggState(next);
  }, []);

  const resetEasterEggProgress = useCallback(() => {
    const next = resetEasterEggState() as LegacyEasterEggState;
    stateRef.current = next;
    setEasterEggState(next);
  }, []);

  const getEasterEggState = useCallback(() => stateRef.current, []);

  return {
    easterEggState,
    getEasterEggState,
    resetEasterEggProgress,
    updateEasterEggState,
  };
}
