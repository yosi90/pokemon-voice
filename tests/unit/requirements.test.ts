import { describe, expect, it } from 'vitest';
import type {
  AdventureMapProgressV1,
  PokemonFormV1,
  PokemonSpeciesV1,
} from '../../packages/contracts/src/index.js';
import {
  evaluateCompanionEligibility,
  qualifyCompanionAccess,
} from '../../src/domain/companions/companionEligibility.js';
import { createPokeVoiceSaveV1 } from '../../src/domain/progress/pokeVoiceSave.js';
import { evaluateRequirement } from '../../src/domain/requirements/evaluateRequirement.js';

const NOW = Date.parse('2026-07-16T12:00:00.000Z');

function createSave(registeredSpeciesIds = [25]) {
  return createPokeVoiceSaveV1({
    runId: 'run:requirements',
    now: NOW,
    legacy: { registeredSpeciesIds },
  });
}

const pikachuForm: PokemonFormV1 = {
  schemaVersion: 1,
  formId: 'pokemon-form:25:default',
  speciesId: 25,
  slug: 'pikachu',
  displayName: 'Pikachu',
  kind: 'default',
  types: ['electric'],
  evolutionStage: 1,
  companionReferenceLevel: 3,
  sizeClass: 'small',
  narrativeTags: ['friendly'],
  fieldCapabilities: [{ id: 'light', source: 'biology', strength: 2 }],
};

const pikachuSpecies: PokemonSpeciesV1 = {
  schemaVersion: 1,
  speciesId: 25,
  slug: 'pikachu',
  displayName: 'Pikachu',
  generation: 1,
  tags: ['cute'],
  defaultFormId: pikachuForm.formId,
  formIds: [pikachuForm.formId],
};

describe('evaluador declarativo de requisitos', () => {
  it('resuelve all/any y devuelve únicamente la alternativa any más cercana', () => {
    const save = createSave();
    const result = evaluateRequirement({ all: [
      { kind: 'registeredSpecies', speciesId: 25 },
      { any: [
        { all: [
          { kind: 'trainerLevel', minimum: 20 },
          { kind: 'inventoryItem', itemId: 'key-item:old-sea-map' },
        ] },
        { kind: 'worldFlag', flagId: 'mewFirstSeen' },
      ] },
    ] }, { save });

    expect(result.met).toBe(false);
    expect(result.unmetAtoms).toEqual([{ kind: 'worldFlag', flagId: 'mewFirstSeen' }]);
  });

  it('cuenta especies registradas por una etiqueta curada del catálogo', () => {
    const result = evaluateRequirement({
      kind: 'registeredSpeciesByTag',
      tag: 'cute',
      minimum: 1,
    }, { save: createSave(), species: [pikachuSpecies] });

    expect(result.met).toBe(true);
  });

  it('combina progreso permanente, inventario, mapas y capacidades de campo', () => {
    const save = createSave();
    const mapProgress: AdventureMapProgressV1 = {
      schemaVersion: 1,
      mapId: 'map:bay',
      freeExpeditionUnlocked: true,
      completedMissionIds: [],
      unlockedSecretIds: ['secret:sharpedo'],
      knownNpcIds: ['npc:swimmer'],
      conversationIds: ['conversation:pretty-shark'],
      collectibleIds: [],
      knownHintIds: [],
      unlockedRouteIds: [],
      eligibleEncounterVisits: {},
      activeVariantIds: [],
    };
    save.pokeDiscover.mapProgress[mapProgress.mapId] = mapProgress;
    save.pokeDiscover.inventory.keyItemIds.push('key-item:dragon-scale');
    save.pokeDiscover.worldFlags['story:bay-calm'] = true;

    const result = evaluateRequirement({ all: [
      { kind: 'knownNpc', npcId: 'npc:swimmer' },
      { kind: 'conversation', conversationId: 'conversation:pretty-shark' },
      { kind: 'unlockedSecret', secretId: 'secret:sharpedo' },
      { kind: 'inventoryItem', itemId: 'key-item:dragon-scale' },
      { kind: 'storyEvent', eventId: 'story:bay-calm' },
      { kind: 'fieldCapability', capabilityId: 'light', minimumStrength: 2 },
    ] }, { save, companionForm: pikachuForm });

    expect(result).toEqual({ met: true, unmetAtoms: [] });
  });

  it('consulta avistamientos, investigación, logros permanentes y modos completados', () => {
    const save = createSave();
    save.pokeDiscover.sightings.push(151);
    save.pokeDiscover.achievements['achievement:voice-master'] = {
      schemaVersion: 1,
      achievementId: 'achievement:voice-master',
      unlockedAt: '2026-07-16T12:00:00.000Z',
    };
    save.pokeDiscover.modeProgress['mode:trivia'] = {
      modeId: 'mode:trivia',
      completed: true,
      completionCount: 1,
    };
    save.pokeDiscover.researchBySpecies[151] = {
      schemaVersion: 1,
      speciesId: 151,
      status: 'partial',
      fields: {
        biometrics: { field: 'biometrics', discoveredFactIds: ['fact:mew:size'], completed: true },
        behavior: { field: 'behavior', discoveredFactIds: [], completed: false },
        habitat: { field: 'habitat', discoveredFactIds: [], completed: false },
        exceptional: { field: 'exceptional', discoveredFactIds: [], completed: false },
      },
      additionalNoteIds: [],
    };

    expect(evaluateRequirement({ all: [
      { kind: 'sightedSpecies', speciesId: 151 },
      { kind: 'researchStatus', speciesId: 151, status: 'sighted' },
      { kind: 'researchField', speciesId: 151, field: 'biometrics' },
      { kind: 'achievement', achievementId: 'achievement:voice-master' },
      { kind: 'modeCompleted', modeId: 'mode:trivia' },
    ] }, { save }).met).toBe(true);
  });
});

describe('elegibilidad y cualificación de acompañantes', () => {
  const definition = {
    schemaVersion: 1 as const,
    requirementId: 'companion:pikachu',
    speciesId: 25,
    formId: pikachuForm.formId,
    minimumTrainerLevel: 1,
    requirement: { kind: 'worldFlag' as const, flagId: 'pikachuTrustsTrainer' },
    visibility: 'hinted' as const,
    loreHint: 'Pikachu aún no parece confiar del todo en ti.',
    rejectionText: 'Pikachu prefiere quedarse cerca del laboratorio.',
  };

  it('distingue una especie no registrada de una registrada pero inelegible', () => {
    const unregistered = evaluateCompanionEligibility({
      save: createSave([]), definition, form: pikachuForm,
    });
    const ineligible = evaluateCompanionEligibility({
      save: createSave(), definition, form: pikachuForm,
    });

    expect(unregistered.status).toBe('unregistered');
    expect(ineligible).toMatchObject({
      status: 'ineligible',
      rejectionText: definition.loreHint,
    });
  });

  it('reactiva una cadena compleja cualificada al redescubrir la especie tras un reset', () => {
    const qualified = qualifyCompanionAccess(createSave(), definition, '2026-07-16T12:30:00.000Z');
    const reset = {
      ...qualified,
      pokedexRun: { ...qualified.pokedexRun, runId: 'run:new', registeredSpeciesIds: [] },
    };
    const rediscovered = {
      ...reset,
      pokedexRun: { ...reset.pokedexRun, registeredSpeciesIds: [25] },
    };

    expect(evaluateCompanionEligibility({ save: reset, definition, form: pikachuForm }).status)
      .toBe('unregistered');
    expect(evaluateCompanionEligibility({ save: rediscovered, definition, form: pikachuForm }))
      .toMatchObject({ status: 'eligible', qualifiedPreviously: true });
    expect(qualifyCompanionAccess(qualified, definition, '2026-07-16T13:00:00.000Z')).toBe(qualified);
  });

  it('aplica la diferencia general de cinco niveles y permite excepciones narrativas', () => {
    const advancedForm = { ...pikachuForm, speciesId: 26, evolutionStage: 2 as const, companionReferenceLevel: 36 };
    const save = createSave([26]);
    save.pokeDiscover.achievements['first-mission'] = {
      schemaVersion: 1,
      achievementId: 'first-mission',
      unlockedAt: '2026-07-16T12:00:00.000Z',
    };
    const advancedDefinition = {
      ...definition,
      requirementId: 'companion:raichu',
      speciesId: 26,
      formId: advancedForm.formId,
      requirement: undefined,
    };

    const normal = evaluateCompanionEligibility({ save, definition: advancedDefinition, form: advancedForm });
    const exception = evaluateCompanionEligibility({
      save,
      definition: { ...advancedDefinition, ignoreReferenceLevelGap: true },
      form: advancedForm,
    });

    expect(normal.unmetAtoms).toContainEqual({ kind: 'trainerLevel', minimum: 31 });
    expect(exception.status).toBe('eligible');
  });

  it('exige first-mission a especies normales pero no a Pikachu ni iniciales base', () => {
    const pikachu = evaluateCompanionEligibility({
      save: { ...createSave(), pokeDiscover: { ...createSave().pokeDiscover, worldFlags: { pikachuTrustsTrainer: true } } },
      definition,
      form: pikachuForm,
    });
    const normalForm = { ...pikachuForm, speciesId: 10, formId: 'pokemon-form:10:default' };
    const normalDefinition = {
      ...definition,
      requirementId: 'companion:caterpie',
      speciesId: 10,
      formId: normalForm.formId,
      requirement: undefined,
    };
    const caterpie = evaluateCompanionEligibility({
      save: createSave([10]), definition: normalDefinition, form: normalForm,
    });

    expect(pikachu.status).toBe('eligible');
    expect(caterpie.unmetAtoms).toContainEqual({ kind: 'achievement', achievementId: 'first-mission' });
  });
});
