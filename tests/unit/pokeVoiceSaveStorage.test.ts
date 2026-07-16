import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LS_CARD_SCALE, LS_GENS, LS_KEY } from '../../scripts/utils.js';
import {
  POKE_VOICE_SAVE_KEY,
  TIMED_COLLECTOR_MODE_ID,
} from '../../src/domain/progress/pokeVoiceSave.js';
import { TIMER_KEY } from '../../src/lib/constants.js';
import { ACHIEVEMENT_STORAGE_KEY } from '../../src/services/achievementStorage.js';
import {
  EASTER_EGG_STORAGE_KEY,
  loadOrMigratePokeVoiceSave,
  parsePokeVoiceSave,
} from '../../src/services/pokeVoiceSaveStorage.js';
import {
  completeBrowserDailyChallenge,
  completeBrowserIsolatedMode,
  completeBrowserThemedChallenge,
  completeBrowserMode,
  deleteAllBrowserPokeVoiceData,
  getBrowserPokeVoiceSave,
  recordBrowserModeBestScore,
  setBrowserActiveModeSession,
  startBrowserIsolatedModeSession,
  setBrowserActiveExpeditionSession,
  startNewPokedexRun,
  updateBrowserActiveModeSession,
  updateBrowserPokedexRun,
} from '../../src/store/browserPokeVoiceSaveStore.js';

const NOW = Date.UTC(2026, 6, 15, 12, 0, 0);

describe('guardado raíz y migración legacy', () => {
  beforeEach(() => localStorage.clear());

  it('migra la partida actual sin reset ni pérdida de preferencias y metaprogresión', () => {
    localStorage.setItem(LS_KEY, JSON.stringify([25, 1, 25, '4', -1, 'invalid']));
    localStorage.setItem(LS_GENS, JSON.stringify([9, 1, 3]));
    localStorage.setItem(LS_CARD_SCALE, '144');
    localStorage.setItem(ACHIEVEMENT_STORAGE_KEY, JSON.stringify([
      { id: 'legacy-unknown', date: NOW - 2000 },
      { id: 'first-mission', date: NOW - 1000, domain: 'pokeDiscover', originRunId: 'old-run' },
    ]));
    localStorage.setItem(EASTER_EGG_STORAGE_KEY, JSON.stringify({
      meowthCoins: 8,
      gimmighoulCoins: 21,
      unownMessage: 'HELLO',
      palafinPending: true,
      nestedFutureFlag: { enabled: true },
    }));

    const result = loadOrMigratePokeVoiceSave({
      storage: localStorage,
      now: () => NOW,
      createRunId: () => 'pokedex-run:migrated',
    });

    expect(result.source).toBe('legacy');
    expect(result.save.pokedexRun).toMatchObject({
      runId: 'pokedex-run:migrated',
      registeredSpeciesIds: [25, 1, 4],
      discoveryOrder: [25, 1, 4],
    });
    expect(result.save.preferences).toMatchObject({
      selectedGenerationIds: [1, 3, 9],
      cardSize: 144,
    });
    expect(result.save.pokeDiscover.globalCounters).toEqual({
      meowthCoins: 8,
      gimmighoulCoins: 21,
    });
    expect(result.save.pokeDiscover.worldFlags).toMatchObject({
      unownMessage: 'HELLO',
      palafinPending: true,
      nestedFutureFlag: { enabled: true },
    });
    expect(result.save.pokeDiscover.achievements['legacy-unknown']).toEqual({
      schemaVersion: 1,
      achievementId: 'legacy-unknown',
      unlockedAt: new Date(NOW - 2000).toISOString(),
    });
    expect(result.save.pokeDiscover.achievements['first-mission']).toMatchObject({
      domain: 'pokeDiscover',
      originRunId: 'old-run',
    });

    // La migración mantiene las claves antiguas para permitir una transición gradual y reversible.
    expect(localStorage.getItem(LS_KEY)).toBe(JSON.stringify([25, 1, 25, '4', -1, 'invalid']));
    expect(parsePokeVoiceSave(localStorage.getItem(POKE_VOICE_SAVE_KEY))).toEqual(result.save);
  });

  it('es idempotente y no reimporta claves legacy modificadas tras crear la raíz', () => {
    const createRunId = vi.fn(() => 'pokedex-run:once');
    localStorage.setItem(LS_KEY, '[25]');

    const first = loadOrMigratePokeVoiceSave({
      storage: localStorage,
      now: () => NOW,
      createRunId,
    });
    localStorage.setItem(LS_KEY, '[1,4,7]');
    const second = loadOrMigratePokeVoiceSave({
      storage: localStorage,
      now: () => NOW + 5000,
      createRunId,
    });

    expect(first.source).toBe('legacy');
    expect(second.source).toBe('current');
    expect(second.save).toEqual(first.save);
    expect(second.save.pokedexRun.registeredSpeciesIds).toEqual([25]);
    expect(createRunId).toHaveBeenCalledTimes(1);
  });

  it('migra partidas raíz anteriores derivando el nivel desde su experiencia conservada', () => {
    const legacyRoot = loadOrMigratePokeVoiceSave({
      storage: localStorage,
      now: () => NOW,
      createRunId: () => 'pokedex-run:before-levels',
    }).save;
    const pokeDiscover = { ...legacyRoot.pokeDiscover } as Partial<typeof legacyRoot.pokeDiscover>;
    delete pokeDiscover.trainerLevel;
    pokeDiscover.trainerExperience = 100;
    localStorage.setItem(POKE_VOICE_SAVE_KEY, JSON.stringify({ ...legacyRoot, pokeDiscover }));

    const result = loadOrMigratePokeVoiceSave({ storage: localStorage });

    expect(result.source).toBe('current');
    expect(result.save.pokeDiscover).toMatchObject({ trainerExperience: 100, trainerLevel: 3 });
    expect(JSON.parse(localStorage.getItem(POKE_VOICE_SAVE_KEY) || '{}').pokeDiscover.trainerLevel).toBe(3);
  });

  it('añade la introducción y el progreso narrativo a partidas raíz anteriores', () => {
    const oldSave = loadOrMigratePokeVoiceSave({
      storage: localStorage,
      now: () => NOW,
      createRunId: () => 'pokedex-run:before-professor',
    }).save;
    const pokeDiscover = { ...oldSave.pokeDiscover } as Partial<typeof oldSave.pokeDiscover>;
    delete pokeDiscover.introduction;
    delete pokeDiscover.narrativeProgress;
    localStorage.setItem(POKE_VOICE_SAVE_KEY, JSON.stringify({ ...oldSave, pokeDiscover }));

    const result = loadOrMigratePokeVoiceSave({ storage: localStorage });

    expect(result.source).toBe('current');
    expect(result.save.pokeDiscover.introduction).toMatchObject({ status: 'hidden', invitationCount: 0 });
    expect(result.save.pokeDiscover.narrativeProgress).toEqual({
      schemaVersion: 1,
      pendingSequenceIds: [],
      completedSequenceIds: [],
    });
  });

  it('conserva un contrarreloj activo ligado a la run migrada', () => {
    const startedAt = NOW - 30_000;
    localStorage.setItem(TIMER_KEY, JSON.stringify({ startedAt, durationSec: 120 }));
    localStorage.setItem(LS_KEY, '[25,133]');

    const { save } = loadOrMigratePokeVoiceSave({
      storage: localStorage,
      now: () => NOW,
      createRunId: () => 'pokedex-run:timed',
    });

    expect(save.pokedexRun.sourceModeId).toBe(TIMED_COLLECTOR_MODE_ID);
    expect(save.pokedexRun.startedAt).toBe(new Date(startedAt).toISOString());
    expect(save.activeModeSession).toEqual({
      schemaVersion: 1,
      modeId: TIMED_COLLECTOR_MODE_ID,
      runId: 'pokedex-run:timed',
      startedAt: new Date(startedAt).toISOString(),
      durationSec: 120,
      satisfiedAchievementIds: [],
    });
  });

  it('crea defaults seguros ante claves vacías o corruptas', () => {
    localStorage.setItem(POKE_VOICE_SAVE_KEY, '{broken');
    localStorage.setItem(LS_KEY, '{broken');
    localStorage.setItem(LS_GENS, '[]');
    localStorage.setItem(LS_CARD_SCALE, '9999');
    localStorage.setItem(EASTER_EGG_STORAGE_KEY, JSON.stringify({ invalid: Number.NaN }));

    const { save, source } = loadOrMigratePokeVoiceSave({
      storage: localStorage,
      now: () => NOW,
      createRunId: () => 'pokedex-run:new',
    });

    expect(source).toBe('legacy');
    expect(save.pokedexRun.registeredSpeciesIds).toEqual([]);
    expect(save.preferences.selectedGenerationIds).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(save.preferences.cardSize).toBe(176);
    expect(save.pokeDiscover.worldFlags).toEqual({ invalid: null });
  });

  it('inicia otra run sin alterar PokeDiscover ni las preferencias', () => {
    localStorage.setItem(LS_KEY, '[25]');
    localStorage.setItem(LS_GENS, '[1,2]');
    localStorage.setItem(ACHIEVEMENT_STORAGE_KEY, JSON.stringify([
      { id: 'classic-start-pikachu', date: NOW, domain: 'pokedex' },
    ]));
    const before = getBrowserPokeVoiceSave();

    const runId = startNewPokedexRun({
      runId: 'pokedex-run:second',
      sourceModeId: TIMED_COLLECTOR_MODE_ID,
      startedAt: NOW + 1000,
    });
    const after = getBrowserPokeVoiceSave();

    expect(runId).toBe('pokedex-run:second');
    expect(after.pokedexRun).toMatchObject({
      runId: 'pokedex-run:second',
      sourceModeId: TIMED_COLLECTOR_MODE_ID,
      registeredSpeciesIds: [],
      discoveryOrder: [],
    });
    expect(after.pokeDiscover).toEqual(before.pokeDiscover);
    expect(after.preferences).toEqual(before.preferences);
  });

  it('bloquea el reset mientras existe una expedición activa', () => {
    getBrowserPokeVoiceSave();
    setBrowserActiveExpeditionSession({
      schemaVersion: 1,
      mapId: 'map:zero-reserve',
      missionId: 'mission:first',
      enteredAt: new Date(NOW).toISOString(),
      companionFormId: 'pokemon-form:25:default',
      toolId: 'tool:boat',
    });

    expect(() => startNewPokedexRun({ runId: 'run:blocked' }))
      .toThrow('No se puede iniciar una nueva run durante una expedición activa.');
    expect(getBrowserPokeVoiceSave().pokedexRun.runId).not.toBe('run:blocked');
  });

  it('conserva estadísticas de una sesión y actualiza el récord sin rebajarlo', () => {
    getBrowserPokeVoiceSave();
    setBrowserActiveModeSession({
      schemaVersion: 1,
      modeId: TIMED_COLLECTOR_MODE_ID,
      runId: 'run:timed-stats',
      startedAt: new Date(NOW).toISOString(),
      durationSec: 120,
      attempts: 2,
      failures: 1,
      currentStreak: 0,
      bestStreak: 1,
      voiceDiscoveries: 1,
      textDiscoveries: 0,
    });
    updateBrowserActiveModeSession(current => ({ ...current, attempts: 3, currentStreak: 1 }));

    expect(getBrowserPokeVoiceSave().activeModeSession).toMatchObject({
      attempts: 3,
      failures: 1,
      currentStreak: 1,
      bestStreak: 1,
      voiceDiscoveries: 1,
    });

    completeBrowserMode(TIMED_COLLECTOR_MODE_ID, 6, new Date(NOW).toISOString());
    completeBrowserMode(TIMED_COLLECTOR_MODE_ID, 4, new Date(NOW + 1000).toISOString());

    expect(getBrowserPokeVoiceSave().pokeDiscover.modeProgress[TIMED_COLLECTOR_MODE_ID]).toEqual({
      modeId: TIMED_COLLECTOR_MODE_ID,
      completed: true,
      completionCount: 2,
      bestScore: 6,
      lastScore: 4,
      lastCompletedAt: new Date(NOW + 1000).toISOString(),
    });
  });

  it('guarda una mejor racha activa sin contar la partida como terminada', () => {
    getBrowserPokeVoiceSave();

    recordBrowserModeBestScore('whos-that-pokemon', 4);
    recordBrowserModeBestScore('whos-that-pokemon', 2);

    expect(getBrowserPokeVoiceSave().pokeDiscover.modeProgress['whos-that-pokemon']).toEqual({
      modeId: 'whos-that-pokemon',
      completed: false,
      completionCount: 0,
      bestScore: 4,
    });

    completeBrowserMode('whos-that-pokemon', 3, new Date(NOW).toISOString());
    expect(getBrowserPokeVoiceSave().pokeDiscover.modeProgress['whos-that-pokemon']).toMatchObject({
      completed: true,
      completionCount: 1,
      bestScore: 4,
      lastScore: 3,
    });
  });

  it('conserva una sola vez cada subreto temático aunque se repita la partida', () => {
    getBrowserPokeVoiceSave();
    completeBrowserThemedChallenge('themed-challenges', 'family:bulbasaur', 3, new Date(NOW).toISOString());
    completeBrowserThemedChallenge('themed-challenges', 'family:bulbasaur', 3, new Date(NOW + 1000).toISOString());
    completeBrowserThemedChallenge('themed-challenges', 'type:deep-roots', 3, new Date(NOW + 2000).toISOString());

    expect(getBrowserPokeVoiceSave().pokeDiscover.modeProgress['themed-challenges']).toMatchObject({
      completed: true,
      completionCount: 3,
      completedChallengeIds: ['family:bulbasaur', 'type:deep-roots'],
      bestScore: 3,
    });
  });

  it('mantiene una racha diaria idempotente y rechaza fechas atrasadas', () => {
    getBrowserPokeVoiceSave();
    const first = completeBrowserDailyChallenge(
      'daily-trivia', '2026-07-14', 'type:first', 3, '2026-07-13', new Date(NOW).toISOString(),
    );
    const second = completeBrowserDailyChallenge(
      'daily-trivia', '2026-07-15', 'type:second', 3, '2026-07-14', new Date(NOW + 1000).toISOString(),
    );
    const repeated = completeBrowserDailyChallenge(
      'daily-trivia', '2026-07-15', 'type:second', 3, '2026-07-14', new Date(NOW + 2000).toISOString(),
    );
    const rollback = completeBrowserDailyChallenge(
      'daily-trivia', '2026-07-13', 'type:old', 3, '2026-07-12', new Date(NOW + 3000).toISOString(),
    );

    expect(first).toMatchObject({ awarded: true, progress: { dailyStreak: 1 } });
    expect(second).toMatchObject({ awarded: true, progress: { dailyStreak: 2, bestDailyStreak: 2 } });
    expect(repeated.awarded).toBe(false);
    expect(rollback.awarded).toBe(false);
    expect(getBrowserPokeVoiceSave().pokeDiscover.modeProgress['daily-trivia']).toMatchObject({
      completionCount: 2,
      dailyStreak: 2,
      bestDailyStreak: 2,
      lastDailyCompletedOn: '2026-07-15',
      lastDailyChallengeId: 'type:second',
    });
  });

  it('aísla una run de modo y restaura íntegramente la Pokédex original al completarla', () => {
    const original = getBrowserPokeVoiceSave().pokedexRun;
    const originalWithPokemon = {
      ...original,
      registeredSpeciesIds: [25, 1],
      discoveryOrder: [25, 1],
      currentStreak: 2,
    };
    updateBrowserPokedexRun(() => originalWithPokemon);
    startBrowserIsolatedModeSession({
      schemaVersion: 1,
      modeId: 'timed-collector',
      runId: 'run:temporary',
      startedAt: new Date(NOW).toISOString(),
      durationSec: 120,
    });
    updateBrowserPokedexRun(current => ({
      ...current,
      registeredSpeciesIds: [2],
      discoveryOrder: [2],
    }));

    const during = getBrowserPokeVoiceSave();
    expect(during.pokedexRun).toMatchObject({ runId: 'run:temporary', registeredSpeciesIds: [2] });
    expect(during.activeModeSession?.suspendedPokedexRun).toEqual(originalWithPokemon);

    const result = completeBrowserIsolatedMode('timed-collector', 4, new Date(NOW + 1000).toISOString());
    expect(result.restoredRun).toEqual(originalWithPokemon);
    expect(getBrowserPokeVoiceSave()).toMatchObject({
      pokedexRun: originalWithPokemon,
      pokeDiscover: { modeProgress: { 'timed-collector': { completionCount: 1, bestScore: 4 } } },
    });
    expect(getBrowserPokeVoiceSave().activeModeSession).toBeUndefined();
  });

  it('reinicia la racha diaria tras un hueco pero conserva el récord', () => {
    getBrowserPokeVoiceSave();
    completeBrowserDailyChallenge('daily-trivia', '2026-07-10', 'one', 3, '2026-07-09');
    completeBrowserDailyChallenge('daily-trivia', '2026-07-11', 'two', 3, '2026-07-10');
    const afterGap = completeBrowserDailyChallenge('daily-trivia', '2026-07-14', 'three', 3, '2026-07-13');
    expect(afterGap.progress).toMatchObject({ dailyStreak: 1, bestDailyStreak: 2 });
  });

  it('reserva el borrado total para progreso y preferencias sin eliminar cachés', () => {
    localStorage.setItem(LS_KEY, '[25]');
    localStorage.setItem(LS_GENS, '[1]');
    localStorage.setItem(LS_CARD_SCALE, '150');
    localStorage.setItem(ACHIEVEMENT_STORAGE_KEY, '[{"id":"first","date":1}]');
    localStorage.setItem('pokevoice-achievements-future', '[{"id":"future"}]');
    localStorage.setItem(EASTER_EGG_STORAGE_KEY, '{"meowthCoins":2}');
    localStorage.setItem(TIMER_KEY, '{"startedAt":1,"durationSec":120}');
    localStorage.setItem('pokevoice-pokemon-catalog-v1', '{"schemaVersion":2}');
    getBrowserPokeVoiceSave();

    deleteAllBrowserPokeVoiceData();

    expect(localStorage.getItem(POKE_VOICE_SAVE_KEY)).toBeNull();
    expect(localStorage.getItem(LS_KEY)).toBeNull();
    expect(localStorage.getItem(LS_GENS)).toBeNull();
    expect(localStorage.getItem(LS_CARD_SCALE)).toBeNull();
    expect(localStorage.getItem(ACHIEVEMENT_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem('pokevoice-achievements-future')).toBeNull();
    expect(localStorage.getItem(EASTER_EGG_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(TIMER_KEY)).toBeNull();
    expect(localStorage.getItem('pokevoice-pokemon-catalog-v1')).toBe('{"schemaVersion":2}');
  });
});
