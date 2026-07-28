import { describe, expect, it } from 'vitest';
import type { AdventureMapV2 } from '../../packages/contracts/src/index.js';
import {
  migrateAdventureMapV2ToV3,
  resolveAdventureSectorId,
  synchronizeAdventureRequiredAssetIds,
  validateAdventureSectorRoster,
} from '../../src/domain/expeditions/adventureMapV3.js';

function legacyMap(): AdventureMapV2 {
  return {
    schemaVersion: 2,
    mapId: 'map:test',
    title: 'Mapa de prueba',
    tiledMapAssets: [{
      schemaVersion: 1,
      assetId: 'tiled:test:01',
      path: 'maps/test-01.tmj',
    }],
    rooms: [{
      schemaVersion: 1,
      roomId: 'room:test:historic-id',
      tiledMapAssetId: 'tiled:test:01',
      staticCamera: true,
      spawnAnchorIds: ['anchor:entry'],
    }],
    actorPlacements: [{
      schemaVersion: 1,
      placementId: 'actor:test',
      roomId: 'room:test:historic-id',
      anchorId: 'anchor:actor',
      assetId: 'pmd:0001-test:default',
      animation: 'Idle',
    }],
    characterPlacements: [{
      schemaVersion: 1,
      placementId: 'character:test',
      roomId: 'room:test:historic-id',
      anchorId: 'anchor:npc',
      assetId: 'character:npc:test',
    }],
    transitions: [{
      schemaVersion: 1,
      transitionId: 'transition:test',
      kind: 'door',
      fromRoomId: 'room:test:historic-id',
      fromAnchorId: 'anchor:entry',
      toRoomId: 'room:test:historic-id',
      toAnchorId: 'anchor:entry',
    }],
    variants: [],
    missionIds: [],
    entryPoints: [{
      schemaVersion: 1,
      entryPointId: 'entry:test',
      label: 'Entrada',
      roomId: 'room:test:historic-id',
      anchorId: 'anchor:entry',
    }],
    behaviorTriggers: [],
    companionSequences: [{
      schemaVersion: 1,
      sequenceId: 'sequence:test',
      roomId: 'room:test:historic-id',
      beats: [],
    }],
    mapSequences: [{
      schemaVersion: 1,
      sequenceId: 'sequence:map-event:01',
      roomId: 'room:test:historic-id',
      beats: [],
    }],
    mapEventTriggers: [{
      schemaVersion: 1,
      triggerId: 'trigger:map:01',
      roomId: 'room:test:historic-id',
      activation: { kind: 'enterZone', zoneId: 'trigger:map:01:zone:01' },
      requirement: { kind: 'trainerLevel', minimum: 1 },
      sequenceId: 'sequence:map-event:01',
      repeatPolicy: 'oncePerVisit',
      resultingActorStates: [],
    }],
    expressionTriggers: [],
    interactions: [{
      schemaVersion: 1,
      interactionId: 'interaction:test',
      roomId: 'room:test:historic-id',
      target: { kind: 'anchor', anchorId: 'anchor:interaction' },
      prompt: 'Interactuar',
      dialogueId: 'dialogue:test',
      meaningfulKind: 'inspection',
    }],
    dialogues: [],
    ambientSequences: [{
      schemaVersion: 1,
      sequenceId: 'ambient:test',
      roomId: 'room:test:historic-id',
      loop: true,
      blockedPolicy: 'pauseSequence',
      beats: [],
    }],
    rareEncounters: [],
    requiredAssetIds: ['pmd:0001-test:default', 'character:npc:test'],
  };
}

describe('AdventureMapV3', () => {
  it('migra todas las referencias espaciales y conserva el alias histórico', () => {
    const migrated = migrateAdventureMapV2ToV3(legacyMap());

    expect(migrated.schemaVersion).toBe(3);
    expect(migrated.sectors[0]).toMatchObject({
      sectorId: 'sector:test:historic-id',
      legacyRoomIds: ['room:test:historic-id'],
    });
    expect(migrated.actorPlacements[0].sectorId).toBe('sector:test:historic-id');
    expect(migrated.characterPlacements[0].sectorId).toBe('sector:test:historic-id');
    expect(migrated.transitions[0]).toMatchObject({
      fromSectorId: 'sector:test:historic-id',
      toSectorId: 'sector:test:historic-id',
    });
    expect(migrated.entryPoints?.[0].sectorId).toBe('sector:test:historic-id');
    expect(migrated.companionSequences?.[0].sectorId).toBe('sector:test:historic-id');
    expect(migrated.mapSequences?.[0].sectorId).toBe('sector:test:historic-id');
    expect(migrated.mapEventTriggers?.[0].sectorId).toBe('sector:test:historic-id');
    expect(migrated.interactions?.[0].sectorId).toBe('sector:test:historic-id');
    expect(migrated.ambientSequences[0].sectorId).toBe('sector:test:historic-id');
    expect(resolveAdventureSectorId(migrated, 'room:test:historic-id'))
      .toBe('sector:test:historic-id');
  });

  it('infiere el reparto legado y exige cinco Pokémon distintos', () => {
    const migrated = migrateAdventureMapV2ToV3(legacyMap());
    expect(migrated.sectors[0].roster).toEqual({
      schemaVersion: 1,
      pokemonAssetIds: ['pmd:0001-test:default'],
      npcAssetIds: ['character:npc:test'],
    });
    expect(validateAdventureSectorRoster(migrated.sectors[0])).toEqual([
      'sector:test:historic-id: el reparto necesita al menos 5 assets Pokémon',
    ]);
  });

  it('sincroniza requiredAssetIds desde todos los repartos', () => {
    const migrated = migrateAdventureMapV2ToV3(legacyMap(), {
      rosterByRoomId: {
        'room:test:historic-id': {
          schemaVersion: 1,
          pokemonAssetIds: ['pmd:1', 'pmd:2', 'pmd:3', 'pmd:4', 'pmd:5'],
          npcAssetIds: ['character:npc:planned'],
        },
      },
    });
    const synchronized = synchronizeAdventureRequiredAssetIds(migrated);
    expect(synchronized.requiredAssetIds).toEqual([
      'pmd:1', 'pmd:2', 'pmd:3', 'pmd:4', 'pmd:5',
      'character:npc:planned',
      'pmd:0001-test:default',
      'character:npc:test',
    ]);
    expect(validateAdventureSectorRoster(synchronized.sectors[0])).toEqual([]);
  });
});
