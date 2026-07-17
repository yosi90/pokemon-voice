import { beforeEach, describe, expect, it } from 'vitest';
import type { RareEncounterDefinitionV1 } from '../../packages/contracts/src/index.js';
import { beginExpedition, endExpedition } from '../../src/domain/expeditions/expeditionSession.js';
import {
  DEFAULT_GUARANTEED_ELIGIBLE_VISIT,
  evaluateRareEncounterVisit,
} from '../../src/domain/expeditions/rareEncounter.js';
import { createPokeVoiceSaveV1 } from '../../src/domain/progress/pokeVoiceSave.js';
import {
  evaluateBrowserRareEncounterVisit,
  getBrowserPokeVoiceSave,
  setBrowserActiveExpeditionSession,
  updateBrowserPokeDiscover,
} from '../../src/store/browserPokeVoiceSaveStore.js';

const MAP_ID = 'map:kanto:test-meadow';
const ENTERED_AT = '2026-07-17T16:00:00.000Z';

const encounter: RareEncounterDefinitionV1 = {
  encounterId: 'encounter:test-meadow:pikachu-rare',
  speciesId: 25,
  requirement: { kind: 'trainerLevel', minimum: 1 },
  baseProbability: 0.2,
};

function prepareVisit(save = createPokeVoiceSaveV1({ runId: 'run:rare', now: Date.parse(ENTERED_AT) })) {
  const prepared = {
    ...save,
    pokedexRun: {
      ...save.pokedexRun,
      selectedCompanion: { schemaVersion: 1 as const, formId: 'pokemon-form:19:default' },
    },
    pokeDiscover: {
      ...save.pokeDiscover,
      inventory: { ...save.pokeDiscover.inventory, toolIds: ['tool:field-kit'] },
    },
  };
  return beginExpedition(prepared, {
    mapId: MAP_ID,
    toolId: 'tool:field-kit',
    enteredAt: ENTERED_AT,
  });
}

describe('encuentros raros con garantía', () => {
  beforeEach(() => localStorage.clear());

  it('usa por defecto la tercera visita elegible y aumenta la probabilidad', () => {
    expect(DEFAULT_GUARANTEED_ELIGIBLE_VISIT).toBe(3);
    const first = evaluateRareEncounterVisit(prepareVisit(), {
      mapId: MAP_ID,
      definition: encounter,
      randomRoll: 0.9,
    });
    const second = evaluateRareEncounterVisit(prepareVisit(endExpedition(first.save)), {
      mapId: MAP_ID,
      definition: encounter,
      randomRoll: 0.9,
    });
    const third = evaluateRareEncounterVisit(prepareVisit(endExpedition(second.save)), {
      mapId: MAP_ID,
      definition: encounter,
      randomRoll: 0.999,
    });

    expect(first).toMatchObject({ status: 'missed', eligibleVisit: 1, probability: 0.2 });
    expect(second).toMatchObject({ status: 'missed', eligibleVisit: 2, probability: 0.4 });
    expect(third).toMatchObject({
      status: 'appeared',
      eligibleVisit: 3,
      probability: 1,
      guaranteed: true,
    });
  });

  it('evalúa cada encuentro una sola vez durante la misma expedición', () => {
    const first = evaluateRareEncounterVisit(prepareVisit(), {
      mapId: MAP_ID,
      definition: encounter,
      randomRoll: 0.9,
    });
    const repeated = evaluateRareEncounterVisit(first.save, {
      mapId: MAP_ID,
      definition: encounter,
      randomRoll: 0,
    });

    expect(repeated).toMatchObject({
      status: 'alreadyEvaluated',
      eligibleVisit: 1,
      appeared: false,
    });
    expect(repeated.save).toBe(first.save);
  });

  it('una visita no elegible no avanza el contador y tampoco se reevalúa al recargar', () => {
    const locked = { ...encounter, requirement: { kind: 'trainerLevel' as const, minimum: 20 } };
    const first = evaluateRareEncounterVisit(prepareVisit(), {
      mapId: MAP_ID,
      definition: locked,
      randomRoll: 0,
    });
    const repeated = evaluateRareEncounterVisit(first.save, {
      mapId: MAP_ID,
      definition: locked,
      randomRoll: 0,
    });

    expect(first).toMatchObject({ status: 'ineligible', eligibleVisit: 0, probability: 0 });
    expect(repeated).toMatchObject({ status: 'alreadyEvaluated', eligibleVisit: 0 });
    expect(first.save.pokeDiscover.mapProgress[MAP_ID]).toBeUndefined();
  });

  it('permite ajustar la visita garantizada por especie', () => {
    const configured = { ...encounter, guaranteedEligibleVisit: 1 };
    const result = evaluateRareEncounterVisit(prepareVisit(), {
      mapId: MAP_ID,
      definition: configured,
      randomRoll: 0.999,
    });

    expect(result).toMatchObject({ status: 'appeared', eligibleVisit: 1, guaranteed: true });
  });

  it('persiste el resultado de la visita para que una recarga no repita la tirada', () => {
    const browserSave = getBrowserPokeVoiceSave();
    updateBrowserPokeDiscover(state => ({
      ...state,
      inventory: { ...state.inventory, toolIds: ['tool:field-kit'] },
    }));
    setBrowserActiveExpeditionSession({
      schemaVersion: 1,
      mapId: MAP_ID,
      enteredAt: ENTERED_AT,
      loadout: {
        schemaVersion: 1,
        companion: { schemaVersion: 1, formId: 'pokemon-form:19:default' },
        toolId: 'tool:field-kit',
      },
      evaluatedEncounterResults: {},
    });

    const first = evaluateBrowserRareEncounterVisit({
      mapId: MAP_ID,
      definition: encounter,
      randomRoll: 0.9,
    });
    const repeated = evaluateBrowserRareEncounterVisit({
      mapId: MAP_ID,
      definition: encounter,
      randomRoll: 0,
    });

    expect(browserSave.activeExpeditionSession).toBeUndefined();
    expect(first.status).toBe('missed');
    expect(repeated).toMatchObject({ status: 'alreadyEvaluated', appeared: false });
    expect(getBrowserPokeVoiceSave().pokeDiscover.mapProgress[MAP_ID]
      .eligibleEncounterVisits[encounter.encounterId]).toBe(1);
  });
});
