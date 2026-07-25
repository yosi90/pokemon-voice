import { describe, expect, it } from 'vitest';
import teguesteAdventure from '../../public/assets/adventure/maps/tegueste-forest/tegueste-forest.adventure.json';
import type { AdventureMapV2, RareEncounterDefinitionV1 } from '../../packages/contracts/src/index.js';
import {
  rareEncounterProbabilityForVisit,
  updateEditorDeterministicEncounter,
  upsertEditorMapVariant,
  upsertEditorRareEncounter,
  upsertEditorWorldEvent,
} from '../../src/domain/tools/pokeDiscoverEditorEncounters.js';

describe('encuentros y estado del mundo del editor', () => {
  it('previsualiza la misma progresión y garantía que el runtime', () => {
    const definition = { baseProbability: .2, guaranteedEligibleVisit: 3 } as RareEncounterDefinitionV1;
    expect([1, 2, 3].map(visit => rareEncounterProbabilityForVisit(definition, visit))).toEqual([.2, .4, 1]);
  });

  it('actualiza encuentros fijos y añade su asset sin mutar el sidecar', () => {
    const adventure = structuredClone(teguesteAdventure) as AdventureMapV2;
    const placement = { ...adventure.actorPlacements[0], assetId: 'pmd:test', direction: 'left' as const };
    const updated = updateEditorDeterministicEncounter(adventure, placement);
    expect(updated.actorPlacements[0]).toEqual(placement);
    expect(updated.requiredAssetIds).toContain('pmd:test');
    expect(adventure.actorPlacements[0].assetId).not.toBe('pmd:test');
  });

  it('inserta y reemplaza raros, variantes y eventos por ID estable', () => {
    const adventure = structuredClone(teguesteAdventure) as AdventureMapV2;
    const rare: RareEncounterDefinitionV1 = { encounterId: 'encounter:test', speciesId: 151, requirement: { kind: 'trainerLevel', minimum: 1 }, baseProbability: .1 };
    const withRare = upsertEditorRareEncounter(adventure, rare);
    const withVariant = upsertEditorMapVariant(withRare, { variantId: 'variant:test', requirement: { kind: 'worldFlag', flagId: 'flag:test', expected: true } });
    const event = { schemaVersion: 1 as const, eventId: 'event:test', activation: { kind: 'trainerLevel' as const, minimum: 2 }, setFlags: { 'flag:test': true }, encounterInjections: [{ mapId: adventure.mapId, encounterId: rare.encounterId }], mapVariants: [{ mapId: adventure.mapId, variantId: 'variant:test' }] };
    const updated = upsertEditorWorldEvent(withVariant, event);
    expect(updated.rareEncounters).toContainEqual(rare);
    expect(updated.variants).toContainEqual(expect.objectContaining({ variantId: 'variant:test' }));
    expect(updated.worldEvents).toEqual([event]);
    expect(adventure.rareEncounters).toEqual([]);
    expect(adventure.variants).toEqual([]);
    expect(adventure.worldEvents).toBeUndefined();
  });
});
