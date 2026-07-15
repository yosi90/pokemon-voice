import { describe, expect, it } from 'vitest';
import { createPokeVoiceSaveV1 } from '../../src/domain/progress/pokeVoiceSave.js';
import { getPokemonEntryState } from '../../src/domain/research/pokemonEntryState.js';

describe('getPokemonEntryState', () => {
  it('oculta investigación permanente mientras la especie no esté registrada en la run', () => {
    const save = createPokeVoiceSaveV1({ runId: 'run:1', now: 1 });
    save.pokeDiscover.sightings = [151];
    save.pokeDiscover.researchBySpecies[151] = {
      schemaVersion: 1,
      speciesId: 151,
      status: 'complete',
      fields: {
        biometrics: { field: 'biometrics', discoveredFactIds: ['fact:1'], completed: true },
        behavior: { field: 'behavior', discoveredFactIds: ['fact:2'], completed: true },
        habitat: { field: 'habitat', discoveredFactIds: ['fact:3'], completed: true },
        exceptional: { field: 'exceptional', discoveredFactIds: ['fact:4'], completed: true },
      },
      additionalNoteIds: [],
    };

    expect(getPokemonEntryState(save, 151)).toEqual({
      registration: 'unknown',
      researchVisible: false,
      sighted: false,
      researchStatus: 'notSeen',
      discoveredForms: [],
      discoveredAppearances: [],
    });
  });

  it('expone solo las formas y apariencias permanentes de la especie registrada', () => {
    const save = createPokeVoiceSaveV1({
      runId: 'run:variants',
      now: 1,
      legacy: { registeredSpeciesIds: [25] },
    });
    save.pokeDiscover.discoveredForms['pokemon-form:25:partner'] = {
      schemaVersion: 1,
      formId: 'pokemon-form:25:partner',
      speciesId: 25,
      discoveredAt: '2026-07-15T10:00:00.000Z',
      noteIds: [],
      originMapId: 'map:bosque-verde',
    };
    save.pokeDiscover.discoveredAppearances['pokemon-appearance:25:surfista'] = {
      schemaVersion: 1,
      appearanceId: 'pokemon-appearance:25:surfista',
      formId: 'pokemon-form:25:default',
      speciesId: 25,
      discoveredAt: '2026-07-15T11:00:00.000Z',
      noteIds: ['note:tabla'],
      originMissionId: 'mission:bahia-en-calma',
    };

    expect(getPokemonEntryState(save, 25)).toMatchObject({
      discoveredForms: [{ formId: 'pokemon-form:25:partner' }],
      discoveredAppearances: [{ appearanceId: 'pokemon-appearance:25:surfista' }],
    });
  });

  it('restaura la investigación conservada al registrar otra vez la especie', () => {
    const save = createPokeVoiceSaveV1({
      runId: 'run:2',
      now: 1,
      legacy: { registeredSpeciesIds: [25] },
    });
    save.pokeDiscover.sightings = [25];
    save.pokeDiscover.researchBySpecies[25] = {
      schemaVersion: 1,
      speciesId: 25,
      status: 'partial',
      fields: {
        biometrics: { field: 'biometrics', discoveredFactIds: ['fact:size'], completed: true },
        behavior: { field: 'behavior', discoveredFactIds: [], completed: false },
        habitat: { field: 'habitat', discoveredFactIds: [], completed: false },
        exceptional: { field: 'exceptional', discoveredFactIds: [], completed: false },
      },
      additionalNoteIds: [],
    };

    expect(getPokemonEntryState(save, 25)).toMatchObject({
      registration: 'registered',
      researchVisible: true,
      sighted: true,
      researchStatus: 'partial',
    });
  });
});
