import { describe, expect, it } from 'vitest';
import type { AdventureMapV2 } from '../../packages/contracts/src/index.js';
import { CAMPHOR_FOREST_MAP } from '../../src/data/adventure/camphorPrologue.js';
import { validateAdventureMapV2 } from '../../src/domain/expeditions/adventureMapV2.js';

describe('mapas lógicos multihabitación', () => {
  it('valida el sidecar inicial del Bosque de Tegueste', () => {
    expect(validateAdventureMapV2(CAMPHOR_FOREST_MAP)).toEqual([]);
  });

  it('detecta relaciones rotas sin depender de IDs numéricos de Tiled', () => {
    const broken: AdventureMapV2 = {
      ...CAMPHOR_FOREST_MAP,
      rooms: [...CAMPHOR_FOREST_MAP.rooms],
      transitions: [{
        schemaVersion: 1,
        transitionId: 'transition:test:stairs',
        kind: 'stairs',
        fromRoomId: CAMPHOR_FOREST_MAP.rooms[0].roomId,
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
