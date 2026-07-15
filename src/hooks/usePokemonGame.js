import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ACV } from '../../scripts/achievements-logic.js';
import { createPokemonNameIndex, resolveGuessTranscript } from '../domain/discovery/resolvePokemonGuess.ts';
import { toLegacyPokemonList } from '../domain/catalog/pokemonCatalogModel.ts';
import { getPokemonGenerationId, POKEMON_GENERATION_RANGES } from '../domain/catalog/pokemonGeneration.ts';
import { formatDex, playSuccessTone, sleep } from '../lib/pokemon.js';
import { getPokemonSpecial, matchSecretCommand, SPECIAL_REVEALS, SPECIAL_TIMING } from '../lib/pokemonSpecials.js';
import { LOCAL_POKEMON_CATALOG, loadPokemonCatalog } from '../services/pokemonCatalog.ts';
import { processPostDiscovery } from '../services/postDiscovery.ts';
import { browserDiscoveryStore } from '../store/browserDiscoveryStore.ts';
import { getBrowserPokeVoiceSave } from '../store/browserPokeVoiceSaveStore.ts';
import { useLegacyEasterEggState } from './useLegacyEasterEggState.ts';
import { usePokedexPreferences } from './usePokedexPreferences.ts';
import { usePokemonCardNavigation } from './usePokemonCardNavigation.ts';
import { usePokemonRevealEffects } from './usePokemonRevealEffects.ts';
import { useTimedMode } from './useTimedMode.ts';

const GIMMIGHOUL_EVOLUTION_COINS = 999;
const GHOLDENGO_ID = 1000;

export function usePokemonGame() {
  const [pokemonCatalog, setPokemonCatalog] = useState(() => [...LOCAL_POKEMON_CATALOG]);
  const allPokemon = useMemo(() => toLegacyPokemonList(pokemonCatalog), [pokemonCatalog]);
  const [loadingError, setLoadingError] = useState('');
  const discoverySnapshot = useSyncExternalStore(
    browserDiscoveryStore.subscribe,
    browserDiscoveryStore.getSnapshot,
  );
  const guessed = discoverySnapshot.guessedIds;
  const { activeGeneration, cardSize, setActiveGeneration, setCardSize } = usePokedexPreferences();
  const activeGenerationRef = useRef(activeGeneration);
  const [guessText, setGuessText] = useState('');
  const [toast, setToast] = useState(null);

  const guessedRef = useRef(guessed);
  const hasDiscovered = useCallback(id => guessedRef.current.has(id), []);
  const {
    audioBlocked,
    delibirdMode,
    dismissSpecialEffect,
    enableAudio,
    enqueueSpecialEffect,
    lastRevealedId,
    markRevealed,
    playRevealAudio,
    psyduckMode,
    replayPokemonCry,
    resetRevealEffects,
    runSpecialReveal,
    setDelibirdMode,
    setPsyduckMode,
    setSleepMode,
    sleepMode,
    specialEffects,
  } = usePokemonRevealEffects({ isDiscovered: hasDiscovered });
  const {
    easterEggState,
    getEasterEggState,
    resetEasterEggProgress,
    updateEasterEggState,
  } = useLegacyEasterEggState();

  const showToast = useCallback((message, kind = 'info') => {
    setToast({ message, kind });
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => setToast(null), 2200);
  }, []);

  const resetDiscovery = useCallback(() => {
    browserDiscoveryStore.reset();
    guessedRef.current = browserDiscoveryStore.getSnapshot().guessedIds;
  }, []);

  const {
    closeTimedResults,
    recordTimedDiscovery,
    resetProgress,
    startTimed,
    timedResults,
    timer,
    timerLeft,
  } = useTimedMode({
    resetDiscovery,
    resetRevealEffects,
    resetEasterEggProgress,
    showToast,
  });

  useEffect(() => {
    guessedRef.current = guessed;
  }, [guessed]);

  useEffect(() => {
    activeGenerationRef.current = activeGeneration;
  }, [activeGeneration]);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    async function loadPokemonList() {
      try {
        const result = await loadPokemonCatalog({ signal: controller.signal });
        if (alive) setPokemonCatalog(result.records);
      } catch (error) {
        if (error?.name === 'AbortError') return;
        console.error(error);
        if (alive) setLoadingError('No se pudo cargar la Pokédex. Revisa la conexión y recarga la página.');
      }
    }
    loadPokemonList();
    const persistedSave = getBrowserPokeVoiceSave();
    ACV.startRun({
      durationSec: persistedSave.activeModeSession?.durationSec ?? null,
      runId: persistedSave.pokedexRun.runId,
    });
    return () => {
      alive = false;
      controller.abort();
    };
  }, []);


  const nameIndex = useMemo(() => createPokemonNameIndex(allPokemon), [allPokemon]);

  const filteredList = useMemo(() => {
    const [minimum, maximum] = POKEMON_GENERATION_RANGES[activeGeneration];
    return allPokemon.filter(pokemon => pokemon.id >= minimum && pokemon.id <= maximum);
  }, [activeGeneration, allPokemon]);

  const catalogPokemonIds = useMemo(
    () => new Set(allPokemon.map(pokemon => pokemon.id)),
    [allPokemon],
  );
  const visiblePokemonIdList = useMemo(
    () => filteredList.map(pokemon => pokemon.id),
    [filteredList],
  );
  const { cardRefs, focusedCardId, navigateCards, scrollToPokemon } = usePokemonCardNavigation({
    visiblePokemonIds: visiblePokemonIdList,
    guessedIds: guessed,
    showToast,
  });

  const tryGuessTranscript = useCallback((raw, options = {}) => {
    return resolveGuessTranscript(raw, nameIndex, catalogPokemonIds, options);
  }, [catalogPokemonIds, nameIndex]);

  const revealPokemon = useCallback(async (id, source) => {
    const targetGeneration = getPokemonGenerationId(id);
    if (targetGeneration && targetGeneration !== activeGenerationRef.current) {
      activeGenerationRef.current = targetGeneration;
      setActiveGeneration(targetGeneration);
      await new Promise(resolve => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
    }
    const firstTime = !guessedRef.current.has(id);
    await scrollToPokemon(id);
    if (!firstTime) return false;
    const special = getPokemonSpecial(id);

    await runSpecialReveal(special, id, SPECIAL_TIMING.BEFORE_REVEAL);

    const discovered = browserDiscoveryStore.discover(id);
    if (!discovered) return false;
    guessedRef.current = browserDiscoveryStore.getSnapshot().guessedIds;
    markRevealed(id);
    recordTimedDiscovery(id);
    playSuccessTone();
    playRevealAudio(id);
    await runSpecialReveal(special, id, SPECIAL_TIMING.AFTER_REVEAL);

    const remainingSec = typeof window.getRemainingSeconds === 'function' ? Number(window.getRemainingSeconds()) : null;
    const name = allPokemon.find(p => p.id === id)?.name || '';
    await processPostDiscovery({
      id,
      name,
      remainingSec,
      source,
      discoveredIds: guessedRef.current,
      easterEggState: getEasterEggState(),
    }, {
      registerAchievementGuess: metadata => ACV.registerGuess(metadata),
      persistEasterEggState: updateEasterEggState,
      enqueueEffect: enqueueSpecialEffect,
      onAchievementError: error => console.warn('No se pudieron evaluar los logros:', error),
    });
    return true;
  }, [allPokemon, enqueueSpecialEffect, getEasterEggState, markRevealed, playRevealAudio, recordTimedDiscovery, runSpecialReveal, scrollToPokemon, setActiveGeneration, updateEasterEggState]);

  const collectGimmighoulCoin = useCallback(async () => {
    const nextCoins = (easterEggState.gimmighoulCoins || 0) + 1;
    updateEasterEggState(current => ({
      ...current,
      gimmighoulCoins: (current.gimmighoulCoins || 0) + 1,
    }));

    if (nextCoins < GIMMIGHOUL_EVOLUTION_COINS || guessedRef.current.has(GHOLDENGO_ID)) {
      return;
    }

    showToast('¡Gimmighoul reunió 999 monedas!', 'ok');
    await revealPokemon(GHOLDENGO_ID, 'easter-egg');
  }, [easterEggState.gimmighoulCoins, revealPokemon, showToast, updateEasterEggState]);

  const guess = useCallback(async (raw, { fromSpeech = false } = {}) => {
    const secret = matchSecretCommand(raw);
    if (secret) {
      if (secret.secretCommand === 'agua' && !hasDiscovered(185)) {
        showToast('Sudowoodo aún no está mirando.', 'info');
        setGuessText('');
        return true;
      }
      if (secret.secretCommand === 'agua') {
        playRevealAudio(185);
      }
      enqueueSpecialEffect({
        type: secret.revealEffect,
        id: secret.id,
        durationMs: secret.durationMs,
      });
      setGuessText('');
      return true;
    }

    const result = tryGuessTranscript(raw, { fromSpeech });
    if (!result.matched) {
      showToast(`No encontré "${raw}"`, 'bad');
      try {
        await ACV.registerFail();
      } catch {}
      return false;
    }

    let revealed = 0;
    for (const id of result.sequence) {
      const didReveal = await revealPokemon(id, fromSpeech ? 'voice' : 'keyboard');
      if (didReveal) revealed += 1;
      if (result.sequence.length > 1) await sleep(180);
    }
    if (fromSpeech && hasDiscovered(448)) {
      enqueueSpecialEffect({ type: SPECIAL_REVEALS.LUCARIO_AURA, id: 448, durationMs: 1900 });
    }

    setGuessText('');
    if (result.sequence.length === 1) {
      const id = result.sequence[0];
      showToast(revealed ? `${raw} descubierto (${formatDex(id)})` : `Ya estaba descubierto: ${raw}`, revealed ? 'ok' : 'info');
    } else {
      showToast(revealed ? `${raw}: ${revealed} forma(s) revelada(s)` : `Ya estaban descubiertas: ${raw}`, revealed ? 'ok' : 'info');
    }
    return true;
  }, [enqueueSpecialEffect, hasDiscovered, revealPokemon, showToast, tryGuessTranscript]);

  const handleGuessSubmit = useCallback(event => {
    event.preventDefault();
    enableAudio();
    const value = guessText.trim();
    if (value) guess(value, { fromSpeech: false });
  }, [enableAudio, guess, guessText]);

  const score = filteredList.filter(p => guessed.has(p.id)).length;
  const remaining = filteredList.length - score;
  const globalScore = allPokemon.filter(p => guessed.has(p.id)).length;

  return {
    allPokemon,
    activeGeneration,
    pokemonCatalog,
    audioBlocked,
    cardRefs,
    cardSize,
    collectGimmighoulCoin,
    closeTimedResults,
    delibirdMode,
    dismissSpecialEffect,
    enableAudio,
    easterEggState,
    filteredList,
    focusedCardId,
    guess,
    guessed,
    guessText,
    globalScore,
    globalTotal: allPokemon.length,
    handleGuessSubmit,
    lastRevealedId,
    loadingError,
    navigateCards,
    psyduckMode,
    remaining,
    replayPokemonCry,
    resetProgress,
    score,
    sleepMode,
    setCardSize,
    setActiveGeneration,
    setDelibirdMode,
    setGuessText,
    setSleepMode,
    showToast,
    specialEffects,
    startTimed,
    timedResults,
    timer,
    timerLeft,
    toast,
    tryGuessTranscript,
    updateEasterEggState,
    setPsyduckMode,
  };
}
