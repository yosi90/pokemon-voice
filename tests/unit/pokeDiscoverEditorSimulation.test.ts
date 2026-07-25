import { describe, expect, it } from 'vitest';
import type { AdventureMapV2 } from '../../packages/contracts/src/index.js';
import { simulatePokeDiscoverEditorRequirements } from '../../src/domain/tools/pokeDiscoverEditorSimulation.js';

function adventure(): AdventureMapV2 {
  return {
    schemaVersion: 2,
    mapId: 'map:test:simulation',
    title: 'Simulación',
    tiledMapAssets: [], rooms: [], actorPlacements: [], characterPlacements: [], requiredAssetIds: [], missionIds: [], ambientSequences: [], companionSequences: [],
    rareEncounters: [{ encounterId: 'rare:registered', speciesId: 151, requirement: { kind: 'registeredSpecies', speciesId: 25 }, baseProbability: .1 }],
    variants: [{ variantId: 'variant:night', requirement: { kind: 'worldFlag', flagId: 'night', expected: true } }],
    behaviorTriggers: [{ triggerId: 'behavior:surf', requirement: { all: [{ kind: 'companionSpecies', speciesId: 1 }, { kind: 'fieldCapability', capabilityId: 'surf' }] } }],
    expressionTriggers: [{ triggerId: 'expression:voice', activationRequirement: { kind: 'trainerLevel', minimum: 2 }, inputMethods: ['voice'] }],
    transitions: [{ transitionId: 'transition:sighted', requirement: { kind: 'sightedSpecies', speciesId: 151 } }],
    worldEvents: [{ eventId: 'event:item', activation: { kind: 'inventoryItem', itemId: 'key-item:dragon-scale' }, setFlags: {}, encounterInjections: [], mapVariants: [] }],
  } as unknown as AdventureMapV2;
}

describe('simulador de progreso del editor', () => {
  it('reutiliza requisitos y capacidades del loadout sin persistir estado', () => {
    const source = adventure();
    const results = simulatePokeDiscoverEditorRequirements(source, {
      trainerLevel: 3,
      registeredSpeciesIds: [25],
      sightedSpeciesIds: [151],
      companionVariantId: 'pokemon-form:1:default',
      toolId: 'tool:boat',
      inventoryItemIds: ['key-item:dragon-scale'],
      worldFlags: { night: true },
      inputMethod: 'text',
    });
    expect(results.filter(result => result.requirementMet)).toHaveLength(6);
    expect(results.find(result => result.targetKey === 'behaviorTrigger:behavior:surf')).toMatchObject({ available: true });
    expect(results.find(result => result.targetKey === 'expressionTrigger:expression:voice')).toMatchObject({ requirementMet: true, methodAvailable: false, available: false });
    expect(source).toEqual(adventure());
  });

  it('explica los átomos pendientes cuando faltan progreso y loadout', () => {
    const results = simulatePokeDiscoverEditorRequirements(adventure(), {
      trainerLevel: 1,
      registeredSpeciesIds: [],
      sightedSpeciesIds: [],
      inventoryItemIds: [],
      worldFlags: {},
      inputMethod: 'voice',
    });
    expect(results.find(result => result.targetKey === 'rareEncounter:rare:registered')?.unmetAtoms).toEqual([{ kind: 'registeredSpecies', speciesId: 25 }]);
    expect(results.find(result => result.targetKey === 'behaviorTrigger:behavior:surf')?.unmetAtoms).toHaveLength(2);
  });
});
