import { beforeEach, describe, expect, it } from 'vitest';
import {
  MISSINGNO_ANOMALY_ID,
  MISSINGNO_COMMAND_CLUE_ID,
  MISSINGNO_COMMAND_FLAG,
  recordMissingNoCommand,
} from '../../src/domain/expeditions/anomalyResearch.js';
import { createPokeDiscoverStateV1 } from '../../src/domain/progress/pokeVoiceSave.js';
import {
  getBrowserPokeVoiceSave,
  recordBrowserMissingNoCommand,
  startNewPokedexRun,
} from '../../src/store/browserPokeVoiceSaveStore.js';

const FOUND_AT = '2026-07-17T23:00:00.000Z';

describe('investigación persistente de anomalías', () => {
  beforeEach(() => localStorage.clear());

  it('convierte el comando de MissingNo en una pista sin registrar una especie', () => {
    const initial = createPokeDiscoverStateV1();
    const result = recordMissingNoCommand(initial, FOUND_AT);

    expect(result.status).toBe('recorded');
    expect(result.progress).toEqual({
      schemaVersion: 1,
      anomalyId: MISSINGNO_ANOMALY_ID,
      status: 'clueFound',
      discoveredClueIds: [MISSINGNO_COMMAND_CLUE_ID],
      firstClueAt: FOUND_AT,
    });
    expect(result.state.worldFlags[MISSINGNO_COMMAND_FLAG]).toBe(true);
    expect(result.state.sightings).toEqual([]);
    expect(result.state.researchBySpecies).toEqual({});
    expect(result.state.rewardLedger).toEqual({});
  });

  it('repetir el comando no duplica pistas ni concede recompensas', () => {
    const first = recordMissingNoCommand(createPokeDiscoverStateV1(), FOUND_AT);
    const repeated = recordMissingNoCommand(first.state, '2026-07-18T00:00:00.000Z');

    expect(repeated.status).toBe('alreadyRecorded');
    expect(repeated.state).toBe(first.state);
    expect(repeated.progress.discoveredClueIds).toEqual([MISSINGNO_COMMAND_CLUE_ID]);
  });

  it('sobrevive a un reset de Pokédex sin contaminar la nueva run', () => {
    getBrowserPokeVoiceSave();
    recordBrowserMissingNoCommand(FOUND_AT);
    startNewPokedexRun({ runId: 'run:after-missingno' });

    const persisted = getBrowserPokeVoiceSave();
    expect(persisted.pokedexRun).toMatchObject({
      runId: 'run:after-missingno',
      registeredSpeciesIds: [],
    });
    expect(persisted.pokeDiscover.anomalies?.[MISSINGNO_ANOMALY_ID])
      .toMatchObject({ discoveredClueIds: [MISSINGNO_COMMAND_CLUE_ID] });
    expect(persisted.pokeDiscover.rewardLedger).toEqual({});
  });
});
