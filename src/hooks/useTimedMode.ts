import { useCallback, useEffect, useRef, useState } from 'react';
import { ACV } from '../../scripts/achievements-logic.js';
import { createTimedRun, getTimedRunRemaining, type TimedRunState } from '../domain/modes/timedMode.js';
import { TIMER_KEY } from '../lib/constants.js';

const resetLegacyAchievements = ACV.resetAllPersistent as (options: {
  restartRun: boolean;
  durationSec: number | null;
}) => void;

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
  const [timer, setTimer] = useState<TimedRunState | null>(null);
  const [timedResults, setTimedResults] = useState<TimedResults | null>(null);
  const timerIntervalRef = useRef<number | undefined>(undefined);
  const runDiscoveredRef = useRef(new Set<number>());

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
    resetLegacyAchievements({ restartRun: true, durationSec });
    setTimer(null);
    localStorage.removeItem(TIMER_KEY);
    setTimedResults(null);
  }, [resetDiscovery, resetEasterEggProgress, resetRevealEffects]);

  const resetProgress = useCallback(() => {
    resetSharedRunState(null);
    showToast('Run reiniciada.', 'info');
  }, [resetSharedRunState, showToast]);

  const startTimed = useCallback(() => {
    const confirmed = window.confirm('Vas a iniciar el modo contrarreloj de 2:00. Esto reiniciará cartas y logros. ¿Continuar?');
    if (!confirmed) return false;

    resetSharedRunState(120);
    const nextTimer = createTimedRun(120);
    setTimer(nextTimer);
    localStorage.setItem(TIMER_KEY, JSON.stringify({
      startedAt: nextTimer.startedAt,
      durationSec: nextTimer.durationSec,
    }));
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
