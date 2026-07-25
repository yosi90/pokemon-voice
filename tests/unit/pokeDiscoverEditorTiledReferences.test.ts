import { describe, expect, it } from 'vitest';
import type { LoadedTiledMap } from '../../src/domain/maps/loadAdventureBundle.js';
import {
  readPokeDiscoverEditorAnchors,
  readPokeDiscoverEditorTiledReferences,
} from '../../src/domain/tools/pokeDiscoverEditorTiledReferences.js';

function tiledMap(layers: LoadedTiledMap['layers']): LoadedTiledMap {
  return { width: 10, height: 10, tilewidth: 16, tileheight: 16, layers, tilesets: [] };
}

describe('referencias Tiled del configurador PokeDiscover', () => {
  it('extrae los IDs estables y la geometría resumida de Paths y Occlusion', () => {
    const references = readPokeDiscoverEditorTiledReferences(tiledMap([
      {
        name: 'Paths',
        type: 'objectgroup',
        objects: [{ name: 'path:test:walk', type: 'AmbientPath', x: 16, y: 32, polyline: [{ x: 0, y: 0 }, { x: 16, y: -16 }] }],
      },
      {
        name: 'Occlusion',
        type: 'objectgroup',
        objects: [
          { name: 'occluder:test:water', type: 'ActorOccluder', polygon: [{ x: 0, y: 0 }], properties: [{ name: 'occlusionGroup', value: 'occlusion-group:water' }] },
          { name: 'occluder:test:bank', type: 'ActorOccluder', width: 16, height: 8, properties: [{ name: 'occlusionGroup', value: 'occlusion-group:water' }] },
        ],
      },
    ]));

    expect(references.paths).toEqual([{
      pathId: 'path:test:walk',
      pointCount: 2,
      start: { x: 16, y: 32 },
      end: { x: 32, y: 16 },
    }]);
    expect(references.occlusionGroups).toEqual([{
      groupId: 'occlusion-group:water',
      occluderIds: ['occluder:test:water', 'occluder:test:bank'],
      shapes: ['polygon', 'rectangle'],
    }]);
  });

  it('no expone IDs numéricos ni objetos que no cumplen la convención compartida', () => {
    const references = readPokeDiscoverEditorTiledReferences(tiledMap([
      { name: 'Paths', type: 'objectgroup', objects: [{ id: 41, name: '', type: 'AmbientPath', polyline: [{}, {}] }] },
      { name: 'Occlusion', type: 'objectgroup', objects: [{ id: 42, name: 'occluder:bad', type: 'Rectangle', properties: [] }] },
    ]));

    expect(references).toEqual({ paths: [], occlusionGroups: [] });
  });

  it('extrae clases y puntos de suelo de anclajes estables', () => {
    expect(readPokeDiscoverEditorAnchors(tiledMap([{
      name: 'Anchors',
      type: 'objectgroup',
      objects: [
        { id: 10, name: 'anchor:test:encounter', type: 'EncounterAnchor', x: 16, y: 16, width: 16, height: 16 },
        { id: 11, name: 'anchor:test:secret', class: 'SecretAnchor', x: 40, y: 30, width: 0, height: 0 },
        { id: 12, name: '', type: 'ActorAnchor', x: 0, y: 0 },
      ],
    }]))).toEqual([
      { anchorId: 'anchor:test:encounter', anchorClass: 'EncounterAnchor', x: 24, y: 32 },
      { anchorId: 'anchor:test:secret', anchorClass: 'SecretAnchor', x: 40, y: 30 },
    ]);
  });
});
