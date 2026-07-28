import { describe, expect, it } from 'vitest';
import type {
  PmdAnimationManifestV1,
  PmdSpriteAssetV1,
} from '../../packages/contracts/src/index.js';
import type { LoadedTiledMap } from '../../src/domain/maps/loadAdventureBundle.js';
import { inferPokemonRosterFromAnchorNames } from '../../src/domain/tools/pokeDiscoverRosterInference.js';

function asset(assetId: string): PmdSpriteAssetV1 {
  return { assetId } as PmdSpriteAssetV1;
}

const manifest = {
  assets: [
    asset('pmd:0019-rattata:default'),
    asset('pmd:0025-pikachu:default'),
    asset('pmd:0025-pikachu:costume'),
    asset('pmd:0001-bulbasaur:default'),
    asset('pmd:0865-sirfetchd:default'),
  ],
} as PmdAnimationManifestV1;

function tilemap(names: string[]): LoadedTiledMap {
  return {
    width: 1,
    height: 1,
    tilewidth: 16,
    tileheight: 16,
    tilesets: [],
    layers: [{
      name: 'Anchors',
      objects: names.map((name, index) => ({ id: index + 1, name })),
    }],
  };
}

describe('inferencia conservadora del reparto desde anclas', () => {
  it('recupera el asset cuando el nombre contiene un slug inequívoco como segmento', () => {
    expect(inferPokemonRosterFromAnchorNames(
      tilemap(['anchor:rattata:right', 'anchor:bulbasaur:hidden']),
      manifest,
    )).toEqual([
      {
        assetId: 'pmd:0019-rattata:default',
        anchorNames: ['anchor:rattata:right'],
      },
      {
        assetId: 'pmd:0001-bulbasaur:default',
        anchorNames: ['anchor:bulbasaur:hidden'],
      },
    ]);
  });

  it('no adivina si varias apariencias comparten slug ni por coincidencias parciales', () => {
    expect(inferPokemonRosterFromAnchorNames(
      tilemap(['anchor:pikachu:hidden', 'anchor:bulbasaurio:false-positive']),
      manifest,
    )).toEqual([]);
  });

  it('reconoce el alias antiguo de Sirfetch’d sin introducir puntuación interna', () => {
    expect(inferPokemonRosterFromAnchorNames(
      tilemap(['anchor:sirfetch:left']),
      manifest,
    )).toEqual([{
      assetId: 'pmd:0865-sirfetchd:default',
      anchorNames: ['anchor:sirfetch:left'],
    }]);
  });
});
