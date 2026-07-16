import { useCallback, useEffect, useRef, useState } from 'react';
import { ACV } from '../../scripts/achievements-logic.js';
import { createTimedRun, getTimedRunRemaining, type TimedRunState } from '../domain/modes/timedMode.js';
import { TIMED_COLLECTOR_MODE_ID } from '../domain/modes/modeDefinitions.js';
import { TIMER_KEY } from '../lib/constants.js';
import {
  completeBrowserIsolatedMode,
  getBrowserPokeVoiceSave,
  startBrowserIsolatedModeSession,
  startNewPokedexRun,
  updateBrowserActiveModeSession,
} from '../store/browserPokeVoiceSaveStore.js';

const resetAchievementRun = ACV.resetRun as (options: {
  durationSec: number | null;
  modeId?: string;
}) => string;

interface TimedResults {
  discovered: number;
  achievements: string[];
  attempts: number;
  failures: number;
  accuracy: number;
  bestStreak: number;
  voiceDiscoveries: number;
  textDiscoveries: number;
  bestScore: number;
  isNewRecord: boolean;
}

interface TimedModeOptions {
  resetDiscovery: () => void;
  restoreDiscovery: (ids: readonly number[]) => void;
  resetRevealEffects: () => void;
  resetEasterEggProgress: () => void;
  showToast: (message: string, kind?: string) => void;
}

export function useTimedMode({
  resetDiscovery,
  restoreDiscovery,
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
  const [timedCountdown, setTimedCountdown] = useState<string | null>(null);
  const timerIntervalRef = useRef<number | undefined>(undefined);
  const countdownTimeoutsRef = useRef<number[]>([]);
  const finishingRef = useRef(false);
  const runDiscoveredRef = useRef(new Set<number>(
    getBrowserPokeVoiceSave().activeModeSession?.modeId === TIMED_COLLECTOR_MODE_ID
      ? getBrowserPokeVoiceSave().pokedexRun.registeredSpeciesIds
      : [],
  ));

  const finishTimedMode = useCallback(async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    try {
      await ACV.unlock?.('timed-collector-complete');
      const currentSave = getBrowserPokeVoiceSave();
      const session = currentSave.activeModeSession;
      const ids = ACV.getRunSatisfiedIds ? ACV.getRunSatisfiedIds() : [];
      const achievements = ids.map((id: string) => ACV.getAchievementMeta?.(id)?.title || id);
      const discovered = currentSave.pokedexRun.registeredSpeciesIds.length;
      const attempts = session?.attempts ?? discovered;
      const failures = session?.failures ?? Math.max(0, attempts - discovered);
      const previousBest = currentSave.pokeDiscover.modeProgress[TIMED_COLLECTOR_MODE_ID]?.bestScore ?? 0;
      const { progress, restoredRun } = completeBrowserIsolatedMode(
        TIMED_COLLECTOR_MODE_ID,
        achievements.length,
      );
      localStorage.removeItem(TIMER_KEY);
      restoreDiscovery(restoredRun.discoveryOrder);
      ACV.startRun?.({
        durationSec: null,
        runId: restoredRun.runId,
        satisfiedIds: restoredRun.satisfiedAchievementIds,
      });
      setTimedResults({
        discovered,
        achievements,
        attempts,
        failures,
        accuracy: attempts ? Math.round((discovered / attempts) * 100) : 0,
        bestStreak: session?.bestStreak ?? discovered,
        voiceDiscoveries: session?.voiceDiscoveries ?? 0,
        textDiscoveries: session?.textDiscoveries ?? discovered,
        bestScore: progress.bestScore ?? achievements.length,
        isNewRecord: achievements.length > previousBest,
      });
      setTimer(null);
      showToast('Fin del contrarreloj.', 'info');
    } finally {
      finishingRef.current = false;
    }
  }, [restoreDiscovery, showToast]);

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
        void finishTimedMode();
      } else {
        setTimer(current => current ? { ...current, left } : null);
      }
    }, 250);
    return () => window.clearInterval(timerIntervalRef.current);
  }, [finishTimedMode, timer?.startedAt]);

  useEffect(() => () => {
    countdownTimeoutsRef.current.forEach(timeout => window.clearTimeout(timeout));
  }, []);

  const resetProgress = useCallback(() => {
    resetDiscovery();
    runDiscoveredRef.current.clear();
    resetRevealEffects();
    resetEasterEggProgress();
    const runId = resetAchievementRun({ durationSec: null });
    startNewPokedexRun({ runId });
    setTimer(null);
    setTimedCountdown(null);
    countdownTimeoutsRef.current.forEach(timeout => window.clearTimeout(timeout));
    countdownTimeoutsRef.current = [];
    localStorage.removeItem(TIMER_KEY);
    setTimedResults(null);
    showToast('Run reiniciada.', 'info');
  }, [resetDiscovery, resetEasterEggProgress, resetRevealEffects, showToast]);

  const beginTimedSession = useCallback(() => {
    const nextTimer = createTimedRun(120);
    const runId = resetAchievementRun({
      durationSec: nextTimer.durationSec,
      modeId: TIMED_COLLECTOR_MODE_ID,
    });
    runDiscoveredRef.current.clear();
    resetRevealEffects();
    resetEasterEggProgress();
    setTimedResults(null);
    startBrowserIsolatedModeSession({
      schemaVersion: 1,
      modeId: TIMED_COLLECTOR_MODE_ID,
      runId,
      startedAt: new Date(nextTimer.startedAt).toISOString(),
      durationSec: nextTimer.durationSec,
      satisfiedAchievementIds: [],
      attempts: 0,
      failures: 0,
      currentStreak: 0,
      bestStreak: 0,
      voiceDiscoveries: 0,
      textDiscoveries: 0,
    });
    resetDiscovery();
    setTimer(nextTimer);
    localStorage.setItem(TIMER_KEY, JSON.stringify({
      startedAt: nextTimer.startedAt,
      durationSec: nextTimer.durationSec,
      satisfiedAchievementIds: [],
    }));
    showToast('Modo contrarreloj iniciado.', 'info');
  }, [resetDiscovery, resetEasterEggProgress, resetRevealEffects, showToast]);

  const startTimed = useCallback(() => {
    if (timer || timedCountdown) return false;
    setTimedResults(null);
    setTimedCountdown('3');
    countdownTimeoutsRef.current = [
      window.setTimeout(() => setTimedCountdown('2'), 800),
      window.setTimeout(() => setTimedCountdown('1'), 1600),
      window.setTimeout(() => setTimedCountdown('¡Ahora!'), 2400),
      window.setTimeout(() => {
        setTimedCountdown(null);
        countdownTimeoutsRef.current = [];
        beginTimedSession();
      }, 3100),
    ];
    return true;
  }, [beginTimedSession, timedCountdown, timer]);

  const closeTimedResults = useCallback(() => setTimedResults(null), []);
  const recordTimedDiscovery = useCallback((pokemonId: number, source: string) => {
    runDiscoveredRef.current.add(pokemonId);
    updateBrowserActiveModeSession(current => {
      if (current.modeId !== TIMED_COLLECTOR_MODE_ID) return current;
      const currentStreak = (current.currentStreak ?? 0) + 1;
      return {
        ...current,
        attempts: (current.attempts ?? 0) + 1,
        currentStreak,
        bestStreak: Math.max(current.bestStreak ?? 0, currentStreak),
        voiceDiscoveries: (current.voiceDiscoveries ?? 0) + (source === 'voice' ? 1 : 0),
        textDiscoveries: (current.textDiscoveries ?? 0) + (source === 'voice' ? 0 : 1),
      };
    });
  }, []);
  const recordTimedFailure = useCallback(() => {
    updateBrowserActiveModeSession(current => current.modeId === TIMED_COLLECTOR_MODE_ID ? {
      ...current,
      attempts: (current.attempts ?? 0) + 1,
      failures: (current.failures ?? 0) + 1,
      currentStreak: 0,
    } : current);
  }, []);

  return {
    closeTimedResults,
    recordTimedDiscovery,
    recordTimedFailure,
    resetProgress,
    finishTimedEarly: finishTimedMode,
    startTimed,
    timedCountdown,
    timedResults,
    timer,
    timerLeft: timer ? Math.max(0, timer.left ?? timer.durationSec) : null,
  };
}
