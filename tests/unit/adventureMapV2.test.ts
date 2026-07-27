import { describe, expect, it } from 'vitest';
import type { AdventureMapV2 } from '../../packages/contracts/src/index.js';
import { validateAdventureMapV2 } from '../../src/domain/expeditions/adventureMapV2.js';

function legacyMap(): AdventureMapV2 {
  return {
    schemaVersion: 2,
    mapId: 'map:legacy',
    title: 'Mapa legado',
    tiledMapAssets: [{
      schemaVersion: 1,
      assetId: 'tiled:legacy',
      path: 'maps/legacy.tmj',
    }],
    rooms: [{
      schemaVersion: 1,
      roomId: 'room:legacy:01',
      tiledMapAssetId: 'tiled:legacy',
      staticCamera: true,
      spawnAnchorIds: ['anchor:entry'],
    }],
    actorPlacements: [],
    characterPlacements: [],
    transitions: [],
    variants: [],
    missionIds: [],
    behaviorTriggers: [],
    expressionTriggers: [],
    ambientSequences: [],
    rareEncounters: [],
    requiredAssetIds: [],
  };
}

describe('mapas lógicos V2 legados', () => {
  it('continúa validando el formato de entrada anterior', () => {
    expect(validateAdventureMapV2(legacyMap())).toEqual([]);
  });

  it('detecta relaciones rotas sin depender de IDs numéricos de Tiled', () => {
    const broken: AdventureMapV2 = {
      ...legacyMap(),
      transitions: [{
        schemaVersion: 1,
        transitionId: 'transition:test:stairs',
        kind: 'stairs',
        fromRoomId: 'room:legacy:01',
        fromAnchorId: 'anchor:missing',
        toRoomId: 'room:missing',
        toAnchorId: 'anchor:missing',
      }],
    };
    expect(validateAdventureMapV2(broken)).toEqual([
      'transition:test:stairs: habitación de destino inexistente',
      'transition:test:stairs: ancla de origen inexistente',
    ]);
  });
});
