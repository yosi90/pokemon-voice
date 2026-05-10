import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GEN_RANGES,
  LS_CARD_SCALE,
  LS_GENS,
  LS_KEY,
  esAliases,
  esPhonetic,
  esToEnCorrections,
  levenshtein,
  normalize,
} from '../../scripts/utils.js';
import { ACV } from '../../scripts/achievements-logic.js';
import { TIMER_KEY } from '../lib/constants.js';
import { readEasterEggState, resetEasterEggState, saveEasterEggState } from '../lib/easterEggState.js';
import { formatDex, playSuccessTone, sleep } from '../lib/pokemon.js';
import { playGengarScareTone, playPokemonCry, primeAudio } from '../lib/pokemonAudio.js';
import { getPokemonSpecial, matchSecretCommand, SPECIAL_REVEALS, SPECIAL_TIMING } from '../lib/pokemonSpecials.js';
import { readCardSize, readJson, saveGuessed } from '../lib/storage.js';

export function usePokemonGame() {
  const [allPokemon, setAllPokemon] = useState([]);
  const [loadingError, setLoadingError] = useState('');
  const [guessed, setGuessed] = useState(() => new Set(readJson(LS_KEY, []).map(Number)));
  const [selectedGens, setSelectedGens] = useState(() => {
    const saved = readJson(LS_GENS, null);
    return Array.isArray(saved) && saved.length ? saved.map(Number) : Object.keys(GEN_RANGES).map(Number);
  });
  const [cardSize, setCardSize] = useState(readCardSize);
  const [guessText, setGuessText] = useState('');
  const [toast, setToast] = useState(null);
  const [lastRevealedId, setLastRevealedId] = useState(null);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [specialEffects, setSpecialEffects] = useState([]);
  const [easterEggState, setEasterEggState] = useState(readEasterEggState);
  const [psyduckMode, setPsyduckMode] = useState(false);
  const [sleepMode, setSleepMode] = useState(false);
  const [delibirdMode, setDelibirdMode] = useState(false);
  const [navIndex, setNavIndex] = useState({ guessed: -1, remaining: -1 });
  const [timer, setTimer] = useState(null);
  const [timedResults, setTimedResults] = useState(null);

  const cardRefs = useRef(new Map());
  const guessedRef = useRef(guessed);
  const timerIntervalRef = useRef(null);
  const runDiscoveredRef = useRef(new Set());

  const showToast = useCallback((message, kind = 'info') => {
    setToast({ message, kind });
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => setToast(null), 2200);
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty('--card-size', `${cardSize}px`);
    localStorage.setItem(LS_CARD_SCALE, String(cardSize));
  }, [cardSize]);

  useEffect(() => {
    guessedRef.current = guessed;
  }, [guessed]);

  useEffect(() => {
    localStorage.setItem(LS_GENS, JSON.stringify(selectedGens));
  }, [selectedGens]);

  useEffect(() => {
    let alive = true;
    async function loadPokemonList() {
      try {
        const res = await fetch('https://pokeapi.co/api/v2/pokemon?limit=20000');
        if (!res.ok) throw new Error(`PokeAPI respondió ${res.status}`);
        const data = await res.json();
        const all = data.results
          .map(p => {
            const match = p.url.match(/\/pokemon\/(\d+)\//);
            const id = match ? Number(match[1]) : null;
            return id ? { id, name: p.name } : null;
          })
          .filter(Boolean)
          .filter(p => p.id <= 1010)
          .sort((a, b) => a.id - b.id);
        if (alive) setAllPokemon(all);
      } catch (error) {
        console.error(error);
        if (alive) setLoadingError('No se pudo cargar la Pokédex. Revisa la conexión y recarga la página.');
      }
    }
    loadPokemonList();
    ACV.startRun({ durationSec: null });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    window.getRemainingSeconds = () => {
      if (!timer) return null;
      const left = timer.durationSec - (Date.now() - timer.startedAt) / 1000;
      return Math.max(0, left);
    };
    return () => {
      delete window.getRemainingSeconds;
    };
  }, [timer]);

  useEffect(() => {
    if (!timer) return undefined;
    timerIntervalRef.current = window.setInterval(() => {
      const left = timer.durationSec - (Date.now() - timer.startedAt) / 1000;
      if (left <= 0) {
        window.clearInterval(timerIntervalRef.current);
        localStorage.removeItem(TIMER_KEY);
        const ids = ACV.getRunUnlocks ? ACV.getRunUnlocks() : [];
        const achievements = ids.map(id => ACV.getAchievementMeta?.(id)?.title || id);
        setTimedResults({ discovered: runDiscoveredRef.current.size, achievements });
        setTimer(null);
        showToast('Fin del contrarreloj.', 'info');
      } else {
        setTimer(current => current ? { ...current, left } : null);
      }
    }, 250);
    return () => window.clearInterval(timerIntervalRef.current);
  }, [timer?.startedAt, showToast]);

  const byName = useMemo(() => {
    const map = new Map();
    for (const pokemon of allPokemon) {
      const n = normalize(pokemon.name);
      map.set(n, pokemon.id);
      map.set(n.replace(/-/g, ' '), pokemon.id);
    }
    return map;
  }, [allPokemon]);

  const filteredList = useMemo(() => allPokemon.filter(p => selectedGens.some(gen => {
    const [min, max] = GEN_RANGES[gen];
    return p.id >= min && p.id <= max;
  })), [allPokemon, selectedGens]);

  const resolveNameToIds = useCallback((raw, { fromSpeech = true } = {}) => {
    if (!raw) return [];
    let q = normalize(raw);
    if (esToEnCorrections.has(q)) q = normalize(esToEnCorrections.get(q));
    if (esAliases.has(q)) q = normalize(esAliases.get(q));

    const out = new Set();
    if (byName.has(q)) out.add(byName.get(q));

    for (const [name, id] of byName.entries()) {
      if (name.startsWith(`${q}-`)) out.add(id);
    }

    const q2 = q.replace(/[.\- ]/g, '');
    for (const [name, id] of byName.entries()) {
      if (name.replace(/[.\- ]/g, '') === q2) out.add(id);
    }

    const qPh = esPhonetic(q);
    for (const [name, id] of byName.entries()) {
      if (esPhonetic(name) === qPh) out.add(id);
    }

    if (!out.size) {
      let best = null;
      let bestScore = Infinity;
      for (const [name, id] of byName.entries()) {
        const d = Math.min(levenshtein(name, q), levenshtein(esPhonetic(name), qPh));
        if (d < bestScore) {
          bestScore = d;
          best = id;
        }
      }
      let thresh = 2;
      if (!fromSpeech) thresh = q.length <= 6 ? 1 : 2;
      if (fromSpeech && q.length <= 6) thresh = 2;
      if (best != null && bestScore <= thresh) out.add(best);
    }

    return [...out];
  }, [byName]);

  const tryGuessTranscript = useCallback((raw, options = {}) => {
    const ids = resolveNameToIds(raw, options);
    const visible = ids.filter(id => filteredList.some(p => p.id === id));
    return {
      matched: ids.length > 0,
      ids,
      visibleIds: visible,
      sequence: visible.length ? visible : ids,
      raw,
      normalized: normalize(raw),
    };
  }, [filteredList, resolveNameToIds]);

  const scrollToPokemon = useCallback(async id => {
    const node = cardRefs.current.get(id);
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    await sleep(450);
  }, []);

  const enableAudio = useCallback(async () => {
    const ok = await primeAudio();
    if (ok) setAudioBlocked(false);
    return ok;
  }, []);

  const playRevealAudio = useCallback((id) => {
    playPokemonCry(id).catch(error => {
      if (error?.name === 'NotAllowedError') {
        setAudioBlocked(true);
        return;
      }
      console.warn('No se pudo reproducir el cry:', error);
    });
  }, []);

  const enqueueSpecialEffect = useCallback(effect => {
    const key = `${effect.type}-${effect.id || 'global'}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setSpecialEffects(current => [...current, { ...effect, key }].slice(-2));
    return key;
  }, []);

  const dismissSpecialEffect = useCallback(key => {
    setSpecialEffects(current => current.filter(effect => effect.key !== key));
  }, []);

  const clearSpecialEffects = useCallback(() => {
    setSpecialEffects([]);
  }, []);

  const updateEasterEggState = useCallback(updater => {
    setEasterEggState(current => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      saveEasterEggState(next);
      return next;
    });
  }, []);

  const hasDiscovered = useCallback(id => guessedRef.current.has(id), []);

  const runSpecialReveal = useCallback(async (special, id, timing) => {
    if (!special.revealEffect || special.timing !== timing) return;
    if (special.revealEffect === SPECIAL_REVEALS.PSYDUCK_THINK) {
      setPsyduckMode(true);
    }
    if (special.revealEffect === SPECIAL_REVEALS.JIGGLYPUFF_SLEEP) {
      setSleepMode(true);
    }
    if (special.revealEffect === SPECIAL_REVEALS.AUDINO_HEAL) {
      clearSpecialEffects();
    }
    if (special.revealEffect === SPECIAL_REVEALS.DELIBIRD_GIFT) {
      setDelibirdMode(true);
      return;
    }
    enqueueSpecialEffect({
      type: special.revealEffect,
      id,
      durationMs: special.durationMs,
      message: special.revealEffect === SPECIAL_REVEALS.UNOWN_MESSAGE
        ? 'SECRETO DESCUBIERTO'
        : undefined,
    });
    if (special.revealEffect === SPECIAL_REVEALS.GENGAR) {
      playGengarScareTone();
      await sleep(780);
    }
  }, [clearSpecialEffects, easterEggState.unownLetters, enqueueSpecialEffect]);

  const replayPokemonCry = useCallback(async id => {
    if (!guessedRef.current.has(id)) return;
    await primeAudio();
    const special = getPokemonSpecial(id);
    await runSpecialReveal(special, id, SPECIAL_TIMING.BEFORE_REVEAL);
    setLastRevealedId(id);
    playRevealAudio(id);
    await runSpecialReveal(special, id, SPECIAL_TIMING.AFTER_REVEAL);
    window.setTimeout(() => setLastRevealedId(current => current === id ? null : current), 1400);
  }, [playRevealAudio, runSpecialReveal]);

  const revealPokemon = useCallback(async (id, source) => {
    const firstTime = !guessedRef.current.has(id);
    await scrollToPokemon(id);
    if (!firstTime) return false;
    const special = getPokemonSpecial(id);

    await runSpecialReveal(special, id, SPECIAL_TIMING.BEFORE_REVEAL);

    const next = new Set(guessedRef.current);
    next.add(id);
    guessedRef.current = next;
    setGuessed(next);
    saveGuessed(next);
    setLastRevealedId(id);
    runDiscoveredRef.current.add(id);
    playSuccessTone();
    playRevealAudio(id);
    await runSpecialReveal(special, id, SPECIAL_TIMING.AFTER_REVEAL);
    window.setTimeout(() => setLastRevealedId(current => current === id ? null : current), 1400);

    const remainingSec = typeof window.getRemainingSeconds === 'function' ? Number(window.getRemainingSeconds()) : null;
    const name = allPokemon.find(p => p.id === id)?.name || '';
    try {
      await ACV.registerGuess({ id, name, remainingSec, source });
    } catch (error) {
      console.warn('No se pudieron evaluar los logros:', error);
    }
    if (id === 201) {
      updateEasterEggState(current => ({
        ...current,
        unownLetters: `${current.unownLetters || ''}${String.fromCharCode(65 + ((current.unownLetters || '').length % 26))}`.slice(-16),
      }));
    }
    if (id === 964) {
      updateEasterEggState(current => ({ ...current, palafinPending: true }));
    } else if (easterEggState.palafinPending && guessedRef.current.has(964)) {
      updateEasterEggState(current => ({ ...current, palafinPending: false }));
      enqueueSpecialEffect({ type: SPECIAL_REVEALS.PALAFIN_HERO, id: 964, durationMs: 2200 });
    }
    return true;
  }, [allPokemon, easterEggState.palafinPending, enqueueSpecialEffect, playRevealAudio, runSpecialReveal, scrollToPokemon, updateEasterEggState]);

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

  const toggleGen = useCallback(gen => {
    setSelectedGens(current => {
      if (current.includes(gen)) {
        const next = current.filter(item => item !== gen);
        return next.length ? next : current;
      }
      return [...current, gen].sort((a, b) => a - b);
    });
  }, []);

  const navigateCards = useCallback(kind => {
    const isGuessed = kind === 'guessed';
    const ids = filteredList.map(p => p.id).filter(id => isGuessed ? guessed.has(id) : !guessed.has(id));
    if (!ids.length) {
      showToast(isGuessed ? 'Aún no hay descubiertos en este filtro.' : 'No queda nada en este filtro.', 'info');
      return;
    }
    const nextIndex = (navIndex[kind] + 1) % ids.length;
    setNavIndex(current => ({ ...current, [kind]: nextIndex }));
    scrollToPokemon(ids[nextIndex]);
  }, [filteredList, guessed, navIndex, scrollToPokemon, showToast]);

  const resetProgress = useCallback(() => {
    const next = new Set();
    setGuessed(next);
    saveGuessed(next);
    runDiscoveredRef.current.clear();
    clearSpecialEffects();
    setPsyduckMode(false);
    setSleepMode(false);
    setDelibirdMode(false);
    setEasterEggState(resetEasterEggState());
    ACV.resetAllPersistent({ restartRun: true, durationSec: null });
    setTimer(null);
    localStorage.removeItem(TIMER_KEY);
    setTimedResults(null);
    showToast('Run reiniciada.', 'info');
  }, [clearSpecialEffects, showToast]);

  const startTimed = useCallback(() => {
    const ok = window.confirm('Vas a iniciar el modo contrarreloj de 2:00. Esto reiniciará cartas y logros. ¿Continuar?');
    if (!ok) return false;
    const next = new Set();
    setGuessed(next);
    saveGuessed(next);
    runDiscoveredRef.current.clear();
    clearSpecialEffects();
    setPsyduckMode(false);
    setSleepMode(false);
    setDelibirdMode(false);
    setEasterEggState(resetEasterEggState());
    ACV.resetAllPersistent({ restartRun: true, durationSec: 120 });
    const startedAt = Date.now();
    setTimer({ startedAt, durationSec: 120, left: 120 });
    localStorage.setItem(TIMER_KEY, JSON.stringify({ startedAt, durationSec: 120 }));
    showToast('Modo contrarreloj iniciado.', 'info');
    return true;
  }, [clearSpecialEffects, showToast]);

  const closeTimedResults = useCallback(() => {
    resetProgress();
    setTimedResults(null);
  }, [resetProgress]);

  const score = filteredList.filter(p => guessed.has(p.id)).length;
  const remaining = filteredList.length - score;
  const timerLeft = timer ? Math.max(0, timer.left ?? timer.durationSec) : null;

  return {
    allPokemon,
    audioBlocked,
    cardRefs,
    cardSize,
    closeTimedResults,
    delibirdMode,
    dismissSpecialEffect,
    enableAudio,
    easterEggState,
    filteredList,
    guess,
    guessed,
    guessText,
    handleGuessSubmit,
    lastRevealedId,
    loadingError,
    navigateCards,
    psyduckMode,
    remaining,
    replayPokemonCry,
    resetProgress,
    score,
    selectedGens,
    sleepMode,
    setCardSize,
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
    toggleGen,
    tryGuessTranscript,
    updateEasterEggState,
    setPsyduckMode,
  };
}
