import { describe, expect, it } from 'vitest';
import type { AdventureMapV2 } from '../../packages/contracts/src/index.js';
import { auditPokeDiscoverEditorLogic } from '../../src/domain/tools/pokeDiscoverEditorDiagnostics.js';

function adventure(): AdventureMapV2 {
  return {
    schemaVersion: 2,
    mapId: 'map:test:audit',
    title: 'Auditoría',
    tiledMapAssets: [], rooms: [], transitions: [], requiredAssetIds: [], ambientSequences: [], companionSequences: [], rareEncounters: [], interactions: [], dialogues: [], fieldNotebookHints: [], researchFacts: [],
    actorPlacements: [{ placementId: 'shared:id' }],
    characterPlacements: [{ placementId: 'shared:id' }],
    variants: [{ variantId: 'variant:impossible', requirement: { kind: 'companionSpecies', speciesId: 9999 } }],
    behaviorTriggers: [],
    expressionTriggers: [{
      triggerId: 'expression:voice-only',
      activationRequirement: { kind: 'trainerLevel', minimum: 1 },
      inputMethods: ['voice'],
      matchAny: [{ kind: 'acoustic', feature: 'loudness' }],
    }],
    worldEvents: [
      { eventId: 'event:a', activation: { kind: 'worldFlag', flagId: 'flag:b', expected: true }, setFlags: { 'flag:a': true }, encounterInjections: [], mapVariants: [] },
      { eventId: 'event:b', activation: { kind: 'worldFlag', flagId: 'flag:a', expected: true }, setFlags: { 'flag:b': true }, encounterInjections: [], mapVariants: [] },
    ],
    missionIds: ['mission:missing'],
  } as unknown as AdventureMapV2;
}

describe('auditoría lógica del editor', () => {
  it('detecta IDs, referencias, ciclos, inaccesibilidad y fallback de voz', () => {
    const candidate = adventure();
    candidate.variants.push({ variantId: 'variant:level-gate', requirement: { kind: 'trainerLevel', minimum: 3 } });
    const diagnostics = auditPokeDiscoverEditorLogic(candidate);
    expect(diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: 'duplicateId', sourceId: 'shared:id' }),
      expect.objectContaining({ category: 'brokenReference', sourceId: 'mission:missing' }),
      expect.objectContaining({ category: 'circularDependency', message: expect.stringContaining('event:a → event:b') }),
      expect.objectContaining({ category: 'inaccessibleObjective', sourceId: 'variant:impossible', message: expect.stringContaining('9999') }),
      expect.objectContaining({ category: 'missingVoiceFallback', sourceId: 'expression:voice-only' }),
      expect.objectContaining({ category: 'insufficientExperience', sourceId: 'variant:level-gate' }),
    ]));
  });

  it('acepta una alternativa alcanzable y un fallback de texto efectivo', () => {
    const candidate = adventure() as any;
    candidate.actorPlacements = [];
    candidate.characterPlacements = [];
    candidate.missionIds = [];
    candidate.worldEvents = [];
    candidate.variants[0].requirement = { any: [{ kind: 'companionSpecies', speciesId: 9999 }, { kind: 'trainerLevel', minimum: 2 }] };
    candidate.expressionTriggers[0].inputMethods = ['voice', 'text'];
    candidate.expressionTriggers[0].matchAny.push({ kind: 'phrase', phrases: ['hola'] });
    expect(auditPokeDiscoverEditorLogic(candidate)).toEqual([]);
  });
});
