import { useCallback, useMemo, useState } from 'react';
import { ACV } from '../../scripts/achievements-logic.js';
import {
  getAvailableThemedChallenges,
  getChallengeKindsCompleted,
  mixThemedChallenges,
  type ThemedChallengeCandidate,
} from '../domain/modes/themedChallenges.js';
import { THEMED_CHALLENGES_MODE_ID } from '../domain/modes/modeDefinitions.js';
import {
  completeBrowserThemedChallenge,
  getBrowserPokeVoiceSave,
} from '../store/browserPokeVoiceSaveStore.js';
import type { ThemedChallengeDefinitionV1 } from '../../packages/contracts/src/index.js';

interface GuessResolution {
  matched: boolean;
  sequence?: number[];
}

interface ThemedChallengeSession {
  catalog: ThemedChallengeCandidate[];
  challenges: ThemedChallengeDefinitionV1[];
  completedChallengeIds: string[];
  activeChallenge?: ThemedChallengeDefinitionV1;
  foundIds: number[];
  finished: boolean;
}

interface UseThemedChallengesModeOptions {
  resolveGuess: (raw: string, options?: { fromSpeech?: boolean }) => GuessResolution;
  discoverPokemon: (id: number, source: string) => Promise<boolean>;
  showToast: (message: string, kind?: string) => void;
}

export function useThemedChallengesMode({
  resolveGuess,
  discoverPokemon,
  showToast,
}: UseThemedChallengesModeOptions) {
  const [session, setSession] = useState<ThemedChallengeSession | null>(null);
  const [busy, setBusy] = useState(false);

  const start = useCallback((catalog: readonly ThemedChallengeCandidate[]) => {
    const challenges = getAvailableThemedChallenges(catalog);
    if (!challenges.length) {
      showToast('El catálogo actual no contiene suficientes Pokémon para estos retos.', 'bad');
      return false;
    }
    const save = getBrowserPokeVoiceSave();
    const progress = save.pokeDiscover.modeProgress[THEMED_CHALLENGES_MODE_ID];
    setSession({
      catalog: [...catalog],
      challenges: mixThemedChallenges(
        challenges,
        `${save.pokedexRun.runId}:${progress?.completionCount ?? 0}:${Date.now()}`,
      ),
      completedChallengeIds: [...(progress?.completedChallengeIds ?? [])],
      foundIds: [],
      finished: false,
    });
    return true;
  }, [showToast]);

  const selectChallenge = useCallback((challengeId: string) => {
    setSession(current => {
      const activeChallenge = current?.challenges.find(challenge => challenge.challengeId === challengeId);
      if (!current || !activeChallenge) return current;
      return { ...current, activeChallenge, foundIds: [], finished: false };
    });
  }, []);

  const submitAnswer = useCallback(async (raw: string, { fromSpeech = false } = {}) => {
    const value = raw.trim();
    const challenge = session?.activeChallenge;
    if (!value || !session || !challenge || session.finished || busy) return false;
    const resolved = resolveGuess(value, { fromSpeech });
    if (!resolved.matched) {
      showToast(`No reconozco «${value}» como nombre Pokémon.`, 'bad');
      return false;
    }

    const targetIds = new Set(challenge.targetSpeciesIds);
    const newIds = [...new Set(resolved.sequence ?? [])]
      .filter(id => targetIds.has(id) && !session.foundIds.includes(id))
      .slice(0, challenge.targetCount - session.foundIds.length);

    if (!newIds.length) {
      const repeated = (resolved.sequence ?? []).some(id => session.foundIds.includes(id));
      showToast(
        repeated ? 'Ese Pokémon ya cuenta en este reto.' : 'Ese Pokémon no pertenece a este reto.',
        'info',
      );
      return false;
    }

    setBusy(true);
    try {
      for (const id of newIds) {
        await discoverPokemon(id, fromSpeech ? 'voice' : 'keyboard');
      }
      const foundIds = [...session.foundIds, ...newIds];
      const finished = foundIds.length >= challenge.targetCount;
      let completedChallengeIds = session.completedChallengeIds;

      if (finished) {
        const progress = completeBrowserThemedChallenge(
          THEMED_CHALLENGES_MODE_ID,
          challenge.challengeId,
          foundIds.length,
        );
        completedChallengeIds = progress.completedChallengeIds ?? completedChallengeIds;
        await ACV.unlockForMode?.('themed-challenge-complete', THEMED_CHALLENGES_MODE_ID);
        if (getChallengeKindsCompleted(completedChallengeIds).size === 3) {
          await ACV.unlockForMode?.('themed-challenge-triad', THEMED_CHALLENGES_MODE_ID);
        }
      }

      setSession(current => current ? {
        ...current,
        foundIds,
        finished,
        completedChallengeIds,
      } : current);
      showToast(
        finished ? `¡Reto «${challenge.title}» completado!` : `${foundIds.length}/${challenge.targetCount} respuestas encontradas.`,
        'ok',
      );
      return true;
    } finally {
      setBusy(false);
    }
  }, [busy, discoverPokemon, resolveGuess, session, showToast]);

  const foundPokemon = useMemo(() => {
    if (!session) return [];
    const catalogById = new Map(session.catalog.map(candidate => [candidate.id, candidate]));
    return session.foundIds.flatMap(id => {
      const candidate = catalogById.get(id);
      return candidate ? [candidate] : [];
    });
  }, [session]);

  const returnToSelection = useCallback(() => {
    setSession(current => current ? {
      ...current,
      activeChallenge: undefined,
      foundIds: [],
      finished: false,
    } : current);
  }, []);

  const close = useCallback(() => setSession(null), []);

  return {
    active: Boolean(session),
    busy,
    close,
    foundPokemon,
    returnToSelection,
    selectChallenge,
    session,
    start,
    submitAnswer,
  };
}
