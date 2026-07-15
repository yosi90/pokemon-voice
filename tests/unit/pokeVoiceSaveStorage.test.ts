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
  deleteAllBrowserPokeVoiceData,
  getBrowserPokeVoiceSave,
  setBrowserActiveExpeditionSession,
  startNewPokedexRun,
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
