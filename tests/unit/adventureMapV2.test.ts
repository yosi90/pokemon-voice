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
      tiledMapAssets: [...CAMPHOR_FOREST_MAP.tiledMapAssets],
      rooms: [...CAMPHOR_FOREST_MAP.rooms],
      actorPlacements: [...CAMPHOR_FOREST_MAP.actorPlacements],
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

  it('valida escala visual y entradas opcionales sin romper sidecars anteriores', () => {
    const room = CAMPHOR_FOREST_MAP.rooms[0];
    const anchorId = room.spawnAnchorIds[0];
    const compatible: AdventureMapV2 = {
      ...CAMPHOR_FOREST_MAP,
      actorPlacements: [{
        schemaVersion: 1,
        placementId: 'actor:test:scaled',
        roomId: room.roomId,
        anchorId,
        assetId: 'pmd:test',
        animation: 'Idle',
        renderScaleMultiplier: 1.5,
      }],
      entryPoints: [{
        schemaVersion: 1,
        entryPointId: 'entry-point:test:mission',
        label: 'Entrada de misión',
        roomId: room.roomId,
        anchorId,
      }],
      missionEntryPoints: [{
        schemaVersion: 1,
        missionId: CAMPHOR_FOREST_MAP.missionIds[0],
        entryPointId: 'entry-point:test:mission',
      }],
      freeExpeditionEntryPointId: 'entry-point:test:mission',
      requiredAssetIds: [...CAMPHOR_FOREST_MAP.requiredAssetIds, 'pmd:test'],
    };
    expect(validateAdventureMapV2(compatible)).toEqual([]);

    const broken: AdventureMapV2 = {
      ...compatible,
      actorPlacements: compatible.actorPlacements.map((placement, index) => index
        ? placement
        : { ...placement, renderScaleMultiplier: 5.1 }),
      missionEntryPoints: [{
        schemaVersion: 1,
        missionId: CAMPHOR_FOREST_MAP.missionIds[0],
        entryPointId: 'entry-point:missing',
      }],
    };
    expect(validateAdventureMapV2(broken)).toContain(
      `${broken.actorPlacements[0].placementId}: el tamaño relativo debe estar entre 10 % y 500 %`,
    );
    expect(validateAdventureMapV2(broken)).toContain(
      `${CAMPHOR_FOREST_MAP.missionIds[0]}: punto de entrada inexistente entry-point:missing`,
    );
  });
});
