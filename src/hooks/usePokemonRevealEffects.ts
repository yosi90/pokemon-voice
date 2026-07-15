import { useCallback, useState } from 'react';
import {
  planSpecialReveal,
  type SpecialEffectPayload,
  type SpecialRevealDefinition,
} from '../domain/discovery/planSpecialReveal.js';
import { sleep } from '../lib/pokemon.js';
import { playGengarScareTone, playPokemonCry, primeAudio } from '../lib/pokemonAudio.js';
import { getPokemonSpecial, SPECIAL_TIMING } from '../lib/pokemonSpecials.js';

interface SpecialEffectView extends SpecialEffectPayload {
  key: string;
}

interface PokemonRevealEffectsOptions {
  isDiscovered: (pokemonId: number) => boolean;
}

export function usePokemonRevealEffects({ isDiscovered }: PokemonRevealEffectsOptions) {
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [lastRevealedId, setLastRevealedId] = useState<number | null>(null);
  const [specialEffects, setSpecialEffects] = useState<SpecialEffectView[]>([]);
  const [psyduckMode, setPsyduckMode] = useState(false);
  const [sleepMode, setSleepMode] = useState(false);
  const [delibirdMode, setDelibirdMode] = useState(false);

  const enableAudio = useCallback(async () => {
    const enabled = await primeAudio();
    if (enabled) setAudioBlocked(false);
    return enabled;
  }, []);

  const playRevealAudio = useCallback((pokemonId: number) => {
    void playPokemonCry(pokemonId).catch(error => {
      if (error?.name === 'NotAllowedError') {
        setAudioBlocked(true);
        return;
      }
      console.warn('No se pudo reproducir el cry:', error);
    });
  }, []);

  const enqueueSpecialEffect = useCallback((effect: SpecialEffectPayload) => {
    const key = `${effect.type}-${effect.id || 'global'}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setSpecialEffects(current => [...current, { ...effect, key }].slice(-2));
    return key;
  }, []);

  const dismissSpecialEffect = useCallback((key: string) => {
    setSpecialEffects(current => current.filter(effect => effect.key !== key));
  }, []);

  const clearSpecialEffects = useCallback(() => setSpecialEffects([]), []);

  const runSpecialReveal = useCallback(async (
    special: SpecialRevealDefinition,
    pokemonId: number,
    timing: string,
    effectOptions: Record<string, unknown> = {},
  ) => {
    const actions = planSpecialReveal(special, pokemonId, timing, effectOptions);
    for (const action of actions) {
      if (action.type === 'enablePsyduckMode') setPsyduckMode(true);
      if (action.type === 'enableSleepMode') setSleepMode(true);
      if (action.type === 'clearEffects') clearSpecialEffects();
      if (action.type === 'restartDelibirdMode') {
        setDelibirdMode(false);
        window.setTimeout(() => setDelibirdMode(true), 0);
      }
      if (action.type === 'enqueueEffect') enqueueSpecialEffect(action.effect);
      if (action.type === 'playGengarTone') playGengarScareTone();
      if (action.type === 'wait') await sleep(action.durationMs);
    }
  }, [clearSpecialEffects, enqueueSpecialEffect]);

  const markRevealed = useCallback((pokemonId: number) => {
    setLastRevealedId(pokemonId);
    window.setTimeout(() => {
      setLastRevealedId(current => current === pokemonId ? null : current);
    }, 1400);
  }, []);

  const replayPokemonCry = useCallback(async (
    pokemonId: number,
    effectOptions: Record<string, unknown> = {},
  ) => {
    if (!isDiscovered(pokemonId)) return;
    await primeAudio();
    const special = getPokemonSpecial(pokemonId);
    await runSpecialReveal(special, pokemonId, SPECIAL_TIMING.BEFORE_REVEAL, effectOptions);
    markRevealed(pokemonId);
    playRevealAudio(pokemonId);
    await runSpecialReveal(special, pokemonId, SPECIAL_TIMING.AFTER_REVEAL, effectOptions);
  }, [isDiscovered, markRevealed, playRevealAudio, runSpecialReveal]);

  const resetRevealEffects = useCallback(() => {
    clearSpecialEffects();
    setPsyduckMode(false);
    setSleepMode(false);
    setDelibirdMode(false);
  }, [clearSpecialEffects]);

  return {
    audioBlocked,
    clearSpecialEffects,
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
  };
}
