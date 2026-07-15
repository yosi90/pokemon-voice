import { useCallback, useEffect, useRef, useState } from 'react';
import { ACV } from '../../scripts/achievements-logic.js';
import { createTimedRun, getTimedRunRemaining, type TimedRunState } from '../domain/modes/timedMode.js';
import { TIMED_COLLECTOR_MODE_ID } from '../domain/progress/pokeVoiceSave.js';
import { TIMER_KEY } from '../lib/constants.js';
import {
  getBrowserPokeVoiceSave,
  setBrowserActiveModeSession,
  startNewPokedexRun,
} from '../store/browserPokeVoiceSaveStore.js';

const resetAchievementRun = ACV.resetRun as (options: {
  durationSec: number | null;
}) => string;

interface TimedResults {
  discovered: number;
  achievements: string[];
}

interface TimedModeOptions {
  resetDiscovery: () => void;
  resetRevealEffects: () => void;
  resetEasterEggProgress: () => void;
  showToast: (message: string, kind?: string) => void;
}

export function useTimedMode({
  resetDiscovery,
  resetRevealEffects,
  resetEasterEggProgress,
  showToast,
}: TimedModeOptions) {
  const [timer, setTimer] = useState<TimedRunState | null>(() => {
    const session = getBrowserPokeVoiceSave().activeModeSession;
    if (!session || session.modeId !== TIMED_COLLECTOR_MODE_ID) return null;
    const startedAt = Date.parse(session.startedAt);
    if (!Number.isFinite(startedAt)) return null;
    return createTimedRun(session.durationSec, startedAt);
  });
  const [timedResults, setTimedResults] = useState<TimedResults | null>(null);
  const timerIntervalRef = useRef<number | undefined>(undefined);
  const runDiscoveredRef = useRef(new Set<number>(
    getBrowserPokeVoiceSave().activeModeSession
      ? getBrowserPokeVoiceSave().pokedexRun.registeredSpeciesIds
      : [],
  ));

  useEffect(() => {
    window.getRemainingSeconds = () => timer ? getTimedRunRemaining(timer) : null;
    return () => {
      delete window.getRemainingSeconds;
    };
  }, [timer]);

  useEffect(() => {
    if (!timer) return undefined;
    timerIntervalRef.current = window.setInterval(() => {
      const left = getTimedRunRemaining(timer);
      if (left <= 0) {
        window.clearInterval(timerIntervalRef.current);
        localStorage.removeItem(TIMER_KEY);
        setBrowserActiveModeSession(undefined);
        const ids = ACV.getRunUnlocks ? ACV.getRunUnlocks() : [];
        const achievements = ids.map((id: string) => ACV.getAchievementMeta?.(id)?.title || id);
        setTimedResults({ discovered: runDiscoveredRef.current.size, achievements });
        setTimer(null);
        showToast('Fin del contrarreloj.', 'info');
      } else {
        setTimer(current => current ? { ...current, left } : null);
      }
    }, 250);
    return () => window.clearInterval(timerIntervalRef.current);
  }, [showToast, timer?.startedAt]);

  const resetSharedRunState = useCallback((durationSec: number | null) => {
    resetDiscovery();
    runDiscoveredRef.current.clear();
    resetRevealEffects();
    resetEasterEggProgress();
    const runId = resetAchievementRun({ durationSec });
    startNewPokedexRun({
      runId,
      ...(durationSec ? { sourceModeId: TIMED_COLLECTOR_MODE_ID } : {}),
    });
    setTimer(null);
    localStorage.removeItem(TIMER_KEY);
    setBrowserActiveModeSession(undefined);
    setTimedResults(null);
  }, [resetDiscovery, resetEasterEggProgress, resetRevealEffects]);

  const resetProgress = useCallback(() => {
    resetSharedRunState(null);
    showToast('Run reiniciada.', 'info');
  }, [resetSharedRunState, showToast]);

  const startTimed = useCallback(() => {
    const confirmed = window.confirm('Vas a iniciar el modo contrarreloj de 2:00. Esto iniciará una nueva run de Pokédex, pero conservará tus logros y PokeDiscover. ¿Continuar?');
    if (!confirmed) return false;

    resetSharedRunState(120);
    const nextTimer = createTimedRun(120);
    setTimer(nextTimer);
    localStorage.setItem(TIMER_KEY, JSON.stringify({
      startedAt: nextTimer.startedAt,
      durationSec: nextTimer.durationSec,
    }));
    setBrowserActiveModeSession({
      schemaVersion: 1,
      modeId: TIMED_COLLECTOR_MODE_ID,
      runId: getBrowserPokeVoiceSave().pokedexRun.runId,
      startedAt: new Date(nextTimer.startedAt).toISOString(),
      durationSec: nextTimer.durationSec,
    });
    showToast('Modo contrarreloj iniciado.', 'info');
    return true;
  }, [resetSharedRunState, showToast]);

  const closeTimedResults = useCallback(() => resetProgress(), [resetProgress]);
  const recordTimedDiscovery = useCallback((pokemonId: number) => {
    runDiscoveredRef.current.add(pokemonId);
  }, []);

  return {
    closeTimedResults,
    recordTimedDiscovery,
    resetProgress,
    startTimed,
    timedResults,
    timer,
    timerLeft: timer ? Math.max(0, timer.left ?? timer.durationSec) : null,
  };
}
