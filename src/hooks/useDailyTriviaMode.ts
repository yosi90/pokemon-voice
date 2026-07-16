import { useCallback, useMemo, useState } from 'react';
import type { ThemedChallengeDefinitionV1 } from '../../packages/contracts/src/index.js';
import { ACV } from '../../scripts/achievements-logic.js';
import { formatLocalDateKey, getPreviousLocalDateKey, selectDailyTriviaChallenge } from '../domain/modes/dailyTrivia.js';
import { DAILY_TRIVIA_MODE_ID } from '../domain/modes/modeDefinitions.js';
import { getAvailableThemedChallenges, type ThemedChallengeCandidate } from '../domain/modes/themedChallenges.js';
import { completeBrowserDailyChallenge, getBrowserPokeVoiceSave } from '../store/browserPokeVoiceSaveStore.js';

interface GuessResolution {
  matched: boolean;
  sequence?: number[];
}

interface DailyTriviaSession {
  catalog: ThemedChallengeCandidate[];
  challenges: ThemedChallengeDefinitionV1[];
  completedChallengeIds: string[];
  activeChallenge: ThemedChallengeDefinitionV1;
  foundIds: number[];
  finished: boolean;
  dateKey: string;
  dailyStreak: number;
}

interface UseDailyTriviaModeOptions {
  resolveGuess: (raw: string, options?: { fromSpeech?: boolean }) => GuessResolution;
  discoverPokemon: (id: number, source: string) => Promise<boolean>;
  showToast: (message: string, kind?: string) => void;
  now?: () => Date;
}

export function useDailyTriviaMode({
  resolveGuess,
  discoverPokemon,
  showToast,
  now = () => new Date(),
}: UseDailyTriviaModeOptions) {
  const [session, setSession] = useState<DailyTriviaSession | null>(null);
  const [busy, setBusy] = useState(false);

  const start = useCallback((catalog: readonly ThemedChallengeCandidate[]) => {
    const dateKey = formatLocalDateKey(now());
    const progress = getBrowserPokeVoiceSave().pokeDiscover.modeProgress[DAILY_TRIVIA_MODE_ID];
    if (progress?.lastDailyCompletedOn === dateKey) {
      showToast('Ya has aprobado el examen de hoy. Mañana habrá uno nuevo.', 'info');
      return false;
    }
    const challenge = selectDailyTriviaChallenge(getAvailableThemedChallenges(catalog), dateKey);
    if (!challenge) {
      showToast('El catálogo actual no contiene un examen diario disponible.', 'bad');
      return false;
    }
    setSession({
      catalog: [...catalog],
      challenges: [challenge],
      completedChallengeIds: [],
      activeChallenge: challenge,
      foundIds: [],
      finished: false,
      dateKey,
      dailyStreak: progress?.dailyStreak ?? 0,
    });
    return true;
  }, [now, showToast]);

  const submitAnswer = useCallback(async (raw: string, { fromSpeech = false } = {}) => {
    const value = raw.trim();
    if (!value || !session || session.finished || busy) return false;
    const resolved = resolveGuess(value, { fromSpeech });
    if (!resolved.matched) {
      showToast(`No reconozco «${value}» como nombre Pokémon.`, 'bad');
      return false;
    }
    const targetIds = new Set(session.activeChallenge.targetSpeciesIds);
    const newIds = [...new Set(resolved.sequence ?? [])]
      .filter(id => targetIds.has(id) && !session.foundIds.includes(id))
      .slice(0, session.activeChallenge.targetCount - session.foundIds.length);
    if (!newIds.length) {
      const repeated = (resolved.sequence ?? []).some(id => session.foundIds.includes(id));
      showToast(repeated ? 'Ese Pokémon ya cuenta en este examen.' : 'Ese Pokémon no pertenece al examen de hoy.', 'info');
      return false;
    }

    setBusy(true);
    try {
      for (const id of newIds) await discoverPokemon(id, fromSpeech ? 'voice' : 'keyboard');
      const foundIds = [...session.foundIds, ...newIds];
      const finished = foundIds.length >= session.activeChallenge.targetCount;
      let dailyStreak = session.dailyStreak;
      if (finished) {
        const result = completeBrowserDailyChallenge(
          DAILY_TRIVIA_MODE_ID,
          session.dateKey,
          session.activeChallenge.challengeId,
          foundIds.length,
          getPreviousLocalDateKey(session.dateKey),
        );
        dailyStreak = result.progress.dailyStreak ?? dailyStreak;
        if (result.awarded) {
          await ACV.unlockForMode?.('daily-trivia-complete', DAILY_TRIVIA_MODE_ID);
          if (dailyStreak >= 7) await ACV.unlockForMode?.('daily-trivia-streak-7', DAILY_TRIVIA_MODE_ID);
        }
      }
      setSession(current => current ? { ...current, foundIds, finished, dailyStreak } : current);
      showToast(finished ? `¡Examen diario aprobado! Racha: ${dailyStreak}` : `${foundIds.length}/${session.activeChallenge.targetCount} respuestas encontradas.`, 'ok');
      return true;
    } finally {
      setBusy(false);
    }
  }, [busy, discoverPokemon, resolveGuess, session, showToast]);

  const foundPokemon = useMemo(() => {
    if (!session) return [];
    const byId = new Map(session.catalog.map(candidate => [candidate.id, candidate]));
    return session.foundIds.flatMap(id => {
      const candidate = byId.get(id);
      return candidate ? [candidate] : [];
    });
  }, [session]);

  return {
    active: Boolean(session),
    busy,
    close: useCallback(() => setSession(null), []),
    foundPokemon,
    session,
    start,
    submitAnswer,
  };
}
