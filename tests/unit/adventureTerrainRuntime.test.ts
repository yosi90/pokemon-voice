import { describe, expect, it } from 'vitest';
import {
  canPlayerEnterTerrain,
  createAdventureTerrainRuntime,
  terrainCellAtGroundPoint,
  terrainMovementSpeed,
} from '../../src/domain/maps/adventureTerrainRuntime.js';
import type { LoadedTiledMap } from '../../src/domain/maps/loadAdventureBundle.js';

function mapWithTerrain(): LoadedTiledMap {
  return {
    width: 3,
    height: 2,
    tilewidth: 16,
    tileheight: 16,
    tilesets: [],
    layers: [{
      name: 'Terrain',
      type: 'objectgroup',
      objects: [
        {
          name: 'terrain:ground',
          class: 'TerrainArea',
          x: 0,
          y: 0,
          width: 16,
          height: 32,
          properties: [{ name: 'surfaceType', value: 'ground' }],
        },
        {
          name: 'terrain:water',
          class: 'TerrainArea',
          x: 16,
          y: 0,
          width: 16,
          height: 32,
          properties: [{ name: 'surfaceType', value: 'water' }],
        },
        {
          name: 'terrain:slow',
          class: 'TerrainArea',
          x: 32,
          y: 0,
          width: 16,
          height: 32,
          properties: [
            { name: 'surfaceType', value: 'slow' },
            { name: 'slowMultiplier', value: 2 },
          ],
        },
      ],
    }],
  };
}

describe('adventure terrain runtime', () => {
  it('resuelve la superficie desde el punto de suelo del actor', () => {
    const terrain = createAdventureTerrainRuntime(mapWithTerrain());
    expect(terrainCellAtGroundPoint(terrain, 8, 16)?.surfaceType).toBe('ground');
    expect(terrainCellAtGroundPoint(terrain, 24, 32)?.surfaceType).toBe('water');
    expect(terrainCellAtGroundPoint(terrain, 40, 16)?.slowMultiplier).toBe(2);
    expect(terrain.diagnostics).toEqual([]);
  });

  it('mantiene ground heredado para un TMJ antiguo', () => {
    const map = mapWithTerrain();
    map.layers = [];
    const terrain = createAdventureTerrainRuntime(map);
    expect(terrain.cells.every(cell => cell.surfaceType === 'ground')).toBe(true);
    expect(terrain.diagnostics[0]).toContain('Terrain ausente');
  });

  it('bloquea agua sin Surf o sin sprite swim y bloquea void', () => {
    expect(canPlayerEnterTerrain({
      surfaceType: 'water',
      hasSurf: false,
      hasSwimAsset: true,
    })).toEqual({ allowed: false, reason: 'requires-surf' });
    expect(canPlayerEnterTerrain({
      surfaceType: 'water',
      hasSurf: true,
      hasSwimAsset: false,
    })).toEqual({ allowed: false, reason: 'missing-swim-asset' });
    expect(canPlayerEnterTerrain({
      surfaceType: 'void',
      hasSurf: true,
      hasSwimAsset: true,
    })).toEqual({ allowed: false, reason: 'void' });
  });

  it('aplica el multiplicador de terreno lento', () => {
    expect(terrainMovementSpeed(96, { surfaceType: 'slow', slowMultiplier: 2 })).toBe(48);
    expect(terrainMovementSpeed(96, { surfaceType: 'ground' })).toBe(96);
  });
});
