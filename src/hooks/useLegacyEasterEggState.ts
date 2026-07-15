import { useCallback, useRef, useState } from 'react';
import type { LegacyEasterEggState } from '../domain/discovery/planPostDiscovery.js';
import { saveEasterEggState } from '../lib/easterEggState.js';
import {
  getBrowserLegacyEasterEggState,
  syncBrowserLegacyEasterEggState,
} from '../store/browserPokeVoiceSaveStore.js';

type EasterEggUpdater = LegacyEasterEggState | ((current: LegacyEasterEggState) => LegacyEasterEggState);

export function useLegacyEasterEggState() {
  const [easterEggState, setEasterEggState] = useState<LegacyEasterEggState>(
    () => getBrowserLegacyEasterEggState() as LegacyEasterEggState,
  );
  const stateRef = useRef(easterEggState);

  const updateEasterEggState = useCallback((updater: EasterEggUpdater) => {
    const next = typeof updater === 'function' ? updater(stateRef.current) : updater;
    stateRef.current = next;
    saveEasterEggState(next);
    syncBrowserLegacyEasterEggState(next);
    setEasterEggState(next);
  }, []);

  const resetEasterEggProgress = useCallback(() => {
    // Los easter eggs ya pertenecen a PokeDiscover y sobreviven a una nueva run.
    const next = getBrowserLegacyEasterEggState() as LegacyEasterEggState;
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
