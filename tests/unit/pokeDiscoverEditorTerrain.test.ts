import { describe, expect, it } from 'vitest';
import type { PokeDiscoverEditableTiledMap } from '../../src/domain/tools/pokeDiscoverEditorProject.js';
import {
  addPokeDiscoverLocation,
  compactPokeDiscoverTerrainGrid,
  ensurePokeDiscoverGroundTerrain,
  fillPokeDiscoverTerrain,
  findNearestSafeTerrainCell,
  listPokeDiscoverLocations,
  paintPokeDiscoverTerrain,
  readPokeDiscoverTerrainGrid,
  writePokeDiscoverTerrainGrid,
} from '../../src/domain/tools/pokeDiscoverEditorTerrain.js';

function map(width = 4, height = 3): PokeDiscoverEditableTiledMap {
  return {
    type: 'map',
    width,
    height,
    tilewidth: 16,
    tileheight: 16,
    nextlayerid: 2,
    nextobjectid: 1,
    tilesets: [],
    layers: [{
      id: 1,
      name: 'Ground',
      type: 'tilelayer',
      visible: true,
      opacity: 1,
      width,
      height,
      data: Array.from({ length: width * height }, () => 1),
    }],
  };
}

describe('autoría semántica de terreno', () => {
  it('sanea un TMJ antiguo con un único rectángulo ground deshacible', () => {
    const result = ensurePokeDiscoverGroundTerrain(map());
    expect(result.created).toBe(true);
    const layer = result.tilemap.layers.find(candidate => candidate.name === 'Terrain');
    const objects = Array.isArray(layer?.objects) ? layer.objects : [];
    expect(layer?.type).toBe('objectgroup');
    expect(objects).toHaveLength(1);
    expect(objects[0]).toMatchObject({
      class: 'TerrainArea',
      x: 0,
      y: 0,
      width: 64,
      height: 48,
    });
    expect(readPokeDiscoverTerrainGrid(result.tilemap)).toMatchObject({
      missing: false,
      errors: [],
    });
  });

  it('pinta, rellena y compacta la cuadrícula de forma determinista', () => {
    const initial = readPokeDiscoverTerrainGrid(map()).grid;
    const withWater = paintPokeDiscoverTerrain(initial, [
      { x: 1, y: 0 }, { x: 2, y: 0 },
      { x: 1, y: 1 }, { x: 2, y: 1 },
    ], 'water');
    const withSlow = fillPokeDiscoverTerrain(withWater, { x: 0, y: 2 }, 'slow', 2);
    const rectangles = compactPokeDiscoverTerrainGrid(withSlow);
    expect(rectangles).toEqual([
      { x: 0, y: 0, width: 1, height: 3, surfaceType: 'slow', slowMultiplier: 2 },
      { x: 1, y: 0, width: 2, height: 2, surfaceType: 'water', slowMultiplier: undefined },
      { x: 3, y: 0, width: 1, height: 3, surfaceType: 'slow', slowMultiplier: 2 },
      { x: 1, y: 2, width: 2, height: 1, surfaceType: 'slow', slowMultiplier: 2 },
    ]);
    const saved = writePokeDiscoverTerrainGrid(map(), withSlow);
    expect(readPokeDiscoverTerrainGrid(saved)).toMatchObject({
      grid: withSlow,
      errors: [],
      missing: false,
    });
  });

  it('encuentra la tierra segura más cercana evitando celdas ocupadas', () => {
    const initial = readPokeDiscoverTerrainGrid(map(3, 3)).grid;
    const water = paintPokeDiscoverTerrain(initial, [
      { x: 1, y: 1 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 2, y: 1 },
    ], 'water');
    expect(findNearestSafeTerrainCell(water, { x: 1, y: 1 }, {
      blocked: new Set(['1:2']),
    })).toEqual({ x: 0, y: 0 });
  });

  it('rechaza solapamientos y huecos al leer áreas manuales', () => {
    const source = map(2, 1);
    source.layers.push({
      id: 2,
      name: 'Terrain',
      type: 'objectgroup',
      visible: true,
      opacity: 1,
      objects: [
        {
          id: 1, name: 'terrain:ground:1', class: 'TerrainArea',
          x: 0, y: 0, width: 16, height: 16, rotation: 0, visible: true,
          properties: [{ name: 'surfaceType', type: 'string', value: 'ground' }],
        },
        {
          id: 2, name: 'terrain:water:1', class: 'TerrainArea',
          x: 0, y: 0, width: 16, height: 16, rotation: 0, visible: true,
          properties: [{ name: 'surfaceType', type: 'string', value: 'water' }],
        },
      ],
    });
    expect(readPokeDiscoverTerrainGrid(source).errors).toEqual([
      'terrain:water:1: solapa otra TerrainArea en 0,0',
      'Terrain no cubre 1 celdas',
    ]);
  });
});

describe('lugares funcionales', () => {
  it('normaliza etiquetas y conserva el vínculo de puerta', () => {
    const result = addPokeDiscoverLocation(map(), {
      locationId: 'location:tegueste:laboratory-door',
      label: 'Puerta del laboratorio',
      kind: 'entrance',
      tags: ['Laboratory', ' door ', 'laboratory'],
      transitionId: 'transition:tegueste:lab',
      x: 16,
      y: 32,
    });
    expect(listPokeDiscoverLocations(result.tilemap)[0].definition).toEqual({
      schemaVersion: 1,
      locationId: 'location:tegueste:laboratory-door',
      label: 'Puerta del laboratorio',
      kind: 'entrance',
      tags: ['door', 'laboratory'],
      transitionId: 'transition:tegueste:lab',
    });
  });
});
