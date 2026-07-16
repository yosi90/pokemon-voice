import { useCallback, useMemo, useState } from 'react';
import { ACV } from '../../scripts/achievements-logic.js';
import { WHOS_THAT_POKEMON_MODE_ID } from '../domain/modes/modeDefinitions.js';
import {
  createWhosThatPokemonDeck,
  getWhosThatPokemonHints,
  WHOS_THAT_POKEMON_TEXT_HINTS,
  WHOS_THAT_POKEMON_TYPE_HINTS,
  type WhosThatPokemonCandidate,
} from '../domain/modes/whosThatPokemon.js';
import { playPokemonCry, primeAudio } from '../lib/pokemonAudio.js';
import { fetchPokemonDetails } from '../services/pokemonDetails.js';
import {
  completeBrowserMode,
  getBrowserPokeVoiceSave,
  recordBrowserModeBestScore,
} from '../store/browserPokeVoiceSaveStore.js';

interface GuessResolution {
  matched: boolean;
  sequence?: number[];
}

interface RoundAnswer {
  correct: boolean;
  submittedName?: string;
}

interface WhosThatPokemonSession {
  catalog: WhosThatPokemonCandidate[];
  rounds: WhosThatPokemonCandidate[];
  seed: string;
  cycle: number;
  roundIndex: number;
  score: number;
  textHintsRemaining: number;
  typeHintsRemaining: number;
  textHintCount: number;
  cryUsed: boolean;
  revealedTypes: string[];
  answer?: RoundAnswer;
  finished: boolean;
  bestScore: number;
  isNewRecord: boolean;
}

interface UseWhosThatPokemonModeOptions {
  resolveGuess: (raw: string, options?: { fromSpeech?: boolean }) => GuessResolution;
  discoverPokemon: (id: number, source: string) => Promise<boolean>;
  registerFailedGuess: () => Promise<void>;
  showToast: (message: string, kind?: string) => void;
}

export function useWhosThatPokemonMode({
  resolveGuess,
  discoverPokemon,
  registerFailedGuess,
  showToast,
}: UseWhosThatPokemonModeOptions) {
  const [session, setSession] = useState<WhosThatPokemonSession | null>(null);
  const [busy, setBusy] = useState(false);

  const start = useCallback((catalog: readonly WhosThatPokemonCandidate[]) => {
    const save = getBrowserPokeVoiceSave();
    const progress = save.pokeDiscover.modeProgress[WHOS_THAT_POKEMON_MODE_ID];
    const seed = `${save.pokedexRun.runId}:${progress?.completionCount ?? 0}:${Date.now()}`;
    try {
      const normalizedCatalog = createWhosThatPokemonDeck(catalog, `${seed}:catalog`);
      setSession({
        catalog: normalizedCatalog,
        rounds: createWhosThatPokemonDeck(normalizedCatalog, `${seed}:0`),
        seed,
        cycle: 0,
        roundIndex: 0,
        score: 0,
        textHintsRemaining: WHOS_THAT_POKEMON_TEXT_HINTS,
        typeHintsRemaining: WHOS_THAT_POKEMON_TYPE_HINTS,
        textHintCount: 0,
        cryUsed: false,
        revealedTypes: [],
        finished: false,
        bestScore: progress?.bestScore ?? 0,
        isNewRecord: false,
      });
      return true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No se pudo iniciar el modo.', 'bad');
      return false;
    }
  }, [showToast]);

  const currentRound = session?.rounds[session.roundIndex] ?? null;
  const visibleHints = useMemo(
    () => currentRound ? getWhosThatPokemonHints(currentRound).slice(0, session?.textHintCount ?? 0) : [],
    [currentRound, session?.textHintCount],
  );

  const requestHint = useCallback(() => {
    setSession(current => {
      if (!current || current.answer || current.finished || current.textHintsRemaining <= 0 || current.textHintCount >= 3) return current;
      return {
        ...current,
        textHintCount: current.textHintCount + 1,
        textHintsRemaining: current.textHintsRemaining - 1,
      };
    });
  }, []);

  const requestTypeHint = useCallback(async () => {
    if (!session || !currentRound || session.answer || session.finished || session.typeHintsRemaining <= 0 || session.revealedTypes.length || busy) return;
    const targetId = currentRound.id;
    setBusy(true);
    try {
      const details = await fetchPokemonDetails(targetId);
      if (!details.types.length) throw new Error('No hay tipos disponibles.');
      setSession(current => current && current.rounds[current.roundIndex]?.id === targetId ? {
        ...current,
        typeHintsRemaining: current.typeHintsRemaining - 1,
        revealedTypes: details.types,
      } : current);
    } catch {
      showToast('No se pudieron consultar los tipos. Conservas el comodín.', 'bad');
    } finally {
      setBusy(false);
    }
  }, [busy, currentRound, session, showToast]);

  const requestCry = useCallback(async () => {
    if (!session || !currentRound || session.answer || session.finished || session.cryUsed || busy) return;
    const targetId = currentRound.id;
    setSession(current => current ? { ...current, cryUsed: true } : current);
    setBusy(true);
    try {
      await primeAudio();
      await playPokemonCry(targetId, { delay: 0, volume: 0.5 });
    } catch {
      setSession(current => current && current.rounds[current.roundIndex]?.id === targetId
        ? { ...current, cryUsed: false }
        : current);
      showToast('No se pudo reproducir el grito. Puedes intentarlo otra vez.', 'bad');
    } finally {
      setBusy(false);
    }
  }, [busy, currentRound, session, showToast]);

  const submitAnswer = useCallback(async (raw: string, { fromSpeech = false } = {}) => {
    const value = raw.trim();
    if (!value || !session || !currentRound || session.answer || session.finished || busy) return false;
    const resolved = resolveGuess(value, { fromSpeech });
    if (!resolved.matched) {
      showToast(`No reconozco «${value}» como nombre Pokémon.`, 'bad');
      return false;
    }

    setBusy(true);
    const correct = resolved.sequence?.includes(currentRound.id) ?? false;
    try {
      if (correct) {
        await discoverPokemon(currentRound.id, fromSpeech ? 'voice' : 'keyboard');
      } else {
        await registerFailedGuess();
      }
      const nextScore = session.score + (correct ? 1 : 0);
      if (correct) {
        recordBrowserModeBestScore(WHOS_THAT_POKEMON_MODE_ID, nextScore);
        if (nextScore === 10) {
          await ACV.unlockForMode?.('whos-that-pokemon-perfect', WHOS_THAT_POKEMON_MODE_ID);
        }
      }
      setSession(current => current ? {
        ...current,
        score: current.score + (correct ? 1 : 0),
        answer: { correct, submittedName: value },
      } : current);
      return correct;
    } finally {
      setBusy(false);
    }
  }, [busy, currentRound, discoverPokemon, registerFailedGuess, resolveGuess, session, showToast]);

  const skipRound = useCallback(async () => {
    if (!session || session.answer || session.finished || busy) return;
    setBusy(true);
    try {
      await registerFailedGuess();
      setSession(current => current ? { ...current, answer: { correct: false } } : current);
    } finally {
      setBusy(false);
    }
  }, [busy, registerFailedGuess, session]);

  const finish = useCallback(async () => {
    if (!session || session.finished || busy) return;
    setBusy(true);
    try {
      const progress = completeBrowserMode(WHOS_THAT_POKEMON_MODE_ID, session.score);
      await ACV.unlockForMode?.('whos-that-pokemon-complete', WHOS_THAT_POKEMON_MODE_ID);
      setSession(current => current ? {
        ...current,
        finished: true,
        bestScore: progress.bestScore ?? current.score,
        isNewRecord: current.score > current.bestScore,
      } : current);
    } finally {
      setBusy(false);
    }
  }, [busy, session]);

  const nextRound = useCallback(async () => {
    if (!session?.answer || session.finished || busy) return;
    if (!session.answer.correct) {
      await finish();
      return;
    }

    setSession(current => {
      if (!current) return current;
      let rounds = current.rounds;
      let cycle = current.cycle;
      if (current.roundIndex === current.rounds.length - 1) {
        cycle += 1;
        const nextDeck = createWhosThatPokemonDeck(
          current.catalog,
          `${current.seed}:${cycle}`,
          current.rounds[current.roundIndex]?.id,
        );
        rounds = [...current.rounds, ...nextDeck];
      }
      return {
        ...current,
        rounds,
        cycle,
        roundIndex: current.roundIndex + 1,
        textHintCount: 0,
        cryUsed: false,
        revealedTypes: [],
        answer: undefined,
      };
    });
  }, [busy, finish, session]);

  const close = useCallback(() => setSession(null), []);

  return {
    active: Boolean(session),
    busy,
    close,
    currentRound,
    nextRound,
    requestCry,
    requestHint,
    requestTypeHint,
    session,
    skipRound,
    start,
    submitAnswer,
    visibleHints,
  };
}
