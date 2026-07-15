import { beforeEach, describe, expect, it } from 'vitest';
import type { ResearchContributionKind, ResearchFactV1, ResearchFieldKey } from '../../packages/contracts/src/index.js';
import { createPokeDiscoverStateV1 } from '../../src/domain/progress/pokeVoiceSave.js';
import { discoverResearchFact } from '../../src/domain/research/researchProgress.js';
import {
  discoverBrowserResearchFact,
  getBrowserPokeVoiceSave,
  startNewPokedexRun,
} from '../../src/store/browserPokeVoiceSaveStore.js';

const DISCOVERED_AT = '2026-07-15T22:00:00.000Z';

function fact({
  id,
  field,
  mapId,
  contribution = 'fieldCompletion',
}: {
  id: string;
  field: ResearchFieldKey;
  mapId: string;
  contribution?: ResearchContributionKind;
}): ResearchFactV1 {
  return {
    schemaVersion: 1,
    factId: id,
    speciesId: 25,
    field,
    contribution,
    mapId,
    interactionId: `interaction:${id}`,
    text: id,
    rewards: [
      { kind: 'trainerExperience', amount: 5 },
      { kind: 'discoveryPoints', amount: 3 },
    ],
  };
}

describe('progreso de investigación distribuido', () => {
  beforeEach(() => localStorage.clear());

  it('reúne los cuatro campos entre mapas y solo entonces completa la ficha', () => {
    const facts = [
      fact({ id: 'fact:pikachu:height', field: 'biometrics', mapId: 'map:power-plant' }),
      fact({ id: 'fact:pikachu:play', field: 'behavior', mapId: 'map:viridian-forest' }),
      fact({ id: 'fact:pikachu:berries', field: 'habitat', mapId: 'map:route-1' }),
      fact({ id: 'fact:pikachu:storm', field: 'exceptional', mapId: 'map:power-plant' }),
    ];
    let state = createPokeDiscoverStateV1();

    for (const [index, researchFact] of facts.entries()) {
      const result = discoverResearchFact(state, researchFact, { discoveredAt: DISCOVERED_AT });
      state = result.state;
      expect(result.progress.status).toBe(index === facts.length - 1 ? 'complete' : 'partial');
    }

    expect(state.researchBySpecies[25].status).toBe('complete');
    expect(state.sightings).toEqual([25]);
    expect(state.trainerExperience).toBe(20);
    expect(state.discoveryPoints).toBe(12);
  });

  it('una observación parcial no completa su campo', () => {
    const result = discoverResearchFact(createPokeDiscoverStateV1(), fact({
      id: 'fact:pikachu:tracks',
      field: 'behavior',
      mapId: 'map:route-1',
      contribution: 'observation',
    }), { discoveredAt: DISCOVERED_AT });

    expect(result.progress.status).toBe('partial');
    expect(result.progress.fields.behavior).toMatchObject({
      completed: false,
      discoveredFactIds: ['fact:pikachu:tracks'],
    });
  });

  it('añade notas posteriores sin invalidar una ficha completa', () => {
    let state = createPokeDiscoverStateV1();
    for (const [field, mapId] of [
      ['biometrics', 'map:a'],
      ['behavior', 'map:b'],
      ['habitat', 'map:c'],
      ['exceptional', 'map:d'],
    ] as const) {
      state = discoverResearchFact(state, fact({ id: `fact:${field}`, field, mapId }), {
        discoveredAt: DISCOVERED_AT,
      }).state;
    }
    const expanded = discoverResearchFact(state, fact({
      id: 'note:pikachu:surfer',
      field: 'behavior',
      mapId: 'map:beach',
      contribution: 'additionalNote',
    }), { discoveredAt: DISCOVERED_AT });

    expect(expanded.progress.status).toBe('complete');
    expect(expanded.progress.additionalNoteIds).toEqual(['note:pikachu:surfer']);
    expect(expanded.progress.fields.behavior.discoveredFactIds).toEqual(['fact:behavior']);
  });

  it('no repite ni investigación ni recompensas al redescubrir el mismo factId', () => {
    const researchFact = fact({ id: 'fact:pikachu:size', field: 'biometrics', mapId: 'map:lab' });
    const first = discoverResearchFact(createPokeDiscoverStateV1(), researchFact, { discoveredAt: DISCOVERED_AT });
    const repeated = discoverResearchFact(first.state, researchFact, { discoveredAt: '2026-07-16T22:00:00.000Z' });

    expect(repeated.status).toBe('alreadyDiscovered');
    expect(repeated.state).toBe(first.state);
    expect(repeated.state.discoveryPoints).toBe(3);
    expect(repeated.progress.fields.biometrics.discoveredFactIds).toEqual(['fact:pikachu:size']);
  });

  it('rechaza reutilizar un factId para otra especie o campo', () => {
    const original = fact({ id: 'fact:shared', field: 'biometrics', mapId: 'map:lab' });
    const first = discoverResearchFact(createPokeDiscoverStateV1(), original, { discoveredAt: DISCOVERED_AT });
    expect(() => discoverResearchFact(first.state, {
      ...original,
      field: 'behavior',
    }, { discoveredAt: DISCOVERED_AT })).toThrow(/otra especie, campo o contribución/);
  });

  it('persiste la investigación en PokeDiscover y la conserva entre runs', () => {
    const researchFact = fact({ id: 'fact:pikachu:persistent', field: 'behavior', mapId: 'map:forest' });
    discoverBrowserResearchFact(researchFact, {
      discoveredAt: DISCOVERED_AT,
      runId: 'run:before-reset',
      missionId: 'mission:first-field-trip',
    });
    startNewPokedexRun({ runId: 'run:after-reset' });

    const save = getBrowserPokeVoiceSave();
    expect(save.pokedexRun.registeredSpeciesIds).toEqual([]);
    expect(save.pokeDiscover.researchBySpecies[25].fields.behavior.completed).toBe(true);
    expect(save.pokeDiscover.rewardLedger[researchFact.factId]).toMatchObject({
      runId: 'run:before-reset',
      missionId: 'mission:first-field-trip',
      mapId: 'map:forest',
    });
  });
});
