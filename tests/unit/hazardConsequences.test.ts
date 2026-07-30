import { describe, expect, it } from 'vitest';
import type {
  HazardConsequenceV1,
  PokeVoiceSaveV1,
} from '../../packages/contracts/src/index.js';
import { applyHazardConsequenceToSave } from '../../src/domain/expeditions/hazardConsequences.js';
import {
  beginExpedition,
  createExpeditionRollbackSnapshot,
} from '../../src/domain/expeditions/expeditionSession.js';
import { createPokeVoiceSaveV1 } from '../../src/domain/progress/pokeVoiceSave.js';

function consequence(
  outcome: HazardConsequenceV1['outcome'],
  rollbackPolicy: HazardConsequenceV1['rollbackPolicy'],
): HazardConsequenceV1 {
  return {
    schemaVersion: 1,
    outcome,
    rollbackPolicy,
    destination: { kind: 'sectorEntry' },
  };
}

function activeSave() {
  let save = createPokeVoiceSaveV1({
    runId: 'run:hazard',
    now: Date.parse('2026-01-01T00:00:00.000Z'),
  });
  save = {
    ...save,
    pokedexRun: {
      ...save.pokedexRun,
      selectedCompanion: {
        schemaVersion: 1,
        formId: 'pokemon-form:1:default',
      },
    },
    pokeDiscover: {
      ...save.pokeDiscover,
      activeMissionIds: ['mission:test'],
    },
  };
  save = beginExpedition(save, {
    mapId: 'map:test',
    missionId: 'mission:test',
    enteredAt: '2026-01-01T00:00:00.000Z',
  });
  save = {
    ...save,
    activeExpeditionSession: {
      ...save.activeExpeditionSession!,
      activeSectorVisit: {
        schemaVersion: 1,
        sectorId: 'sector:test',
        completedMapEventTriggerIds: [],
        rollbackSnapshot: createExpeditionRollbackSnapshot(save),
      },
    },
  };
  return {
    original: save,
    gained: {
      ...save,
      pokeDiscover: {
        ...save.pokeDiscover,
        discoveryPoints: save.pokeDiscover.discoveryPoints + 50,
      },
    } satisfies PokeVoiceSaveV1,
  };
}

describe('hazard consequences', () => {
  it.each(['preserveGains', 'restoreSnapshot'] as const)(
    'recover conserva progreso con %s',
    policy => {
      const { gained } = activeSave();
      const result = applyHazardConsequenceToSave(gained, consequence('recover', policy));
      expect(result.save.pokeDiscover.discoveryPoints).toBe(gained.pokeDiscover.discoveryPoints);
      expect(result.save.activeExpeditionSession).toBeDefined();
    },
  );

  it('resetSector preserveGains reconstruye sin revertir progreso', () => {
    const { gained } = activeSave();
    const result = applyHazardConsequenceToSave(
      gained,
      consequence('resetSector', 'preserveGains'),
    );
    expect(result.rebuildSector).toBe(true);
    expect(result.save.pokeDiscover.discoveryPoints).toBe(gained.pokeDiscover.discoveryPoints);
  });

  it('resetSector restoreSnapshot recupera la entrada estable del sector', () => {
    const { original, gained } = activeSave();
    const result = applyHazardConsequenceToSave(
      gained,
      consequence('resetSector', 'restoreSnapshot'),
    );
    expect(result.save.pokeDiscover.discoveryPoints).toBe(original.pokeDiscover.discoveryPoints);
    expect(result.save.activeExpeditionSession).toBeDefined();
  });

  it('failMission preserveGains termina el intento conservando ganancias', () => {
    const { gained } = activeSave();
    const result = applyHazardConsequenceToSave(
      gained,
      consequence('failMission', 'preserveGains'),
    );
    expect(result.returnToMissionBoard).toBe(true);
    expect(result.save.pokeDiscover.discoveryPoints).toBe(gained.pokeDiscover.discoveryPoints);
    expect(result.save.activeExpeditionSession).toBeUndefined();
    expect(result.save.pokeDiscover.activeMissionIds).not.toContain('mission:test');
  });

  it('failMission restoreSnapshot revierte el intento y conserva el perfil', () => {
    const { original, gained } = activeSave();
    const result = applyHazardConsequenceToSave(
      gained,
      consequence('failMission', 'restoreSnapshot'),
    );
    expect(result.save.pokeDiscover.discoveryPoints).toBe(original.pokeDiscover.discoveryPoints);
    expect(result.save.pokeDiscover.trainerProfile).toEqual(gained.pokeDiscover.trainerProfile);
    expect(result.save.activeExpeditionSession).toBeUndefined();
    expect(result.save.pokeDiscover.activeMissionIds).not.toContain('mission:test');
  });
});
