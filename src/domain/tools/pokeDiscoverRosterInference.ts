import type {
  PmdAnimationManifestV1,
  PmdSpriteAssetV1,
} from '../../../packages/contracts/src/index.js';
import type { LoadedTiledMap } from '../maps/loadAdventureBundle.js';
import {
  normalizePokeDiscoverAnchorSegment,
  parsePokeDiscoverPokemonAssetIdentity,
} from './pokeDiscoverPokemonTechnicalIds.js';

export interface InferredPokemonRosterAsset {
  assetId: string;
  anchorNames: string[];
}

function anchorNamesFromLayers(layers: LoadedTiledMap['layers']): string[] {
  return layers.flatMap(layer => {
    const ownNames = layer.name === 'Anchors' && Array.isArray(layer.objects)
      ? layer.objects.flatMap(object => {
        if (!object || typeof object !== 'object') return [];
        const name = String((object as { name?: unknown }).name ?? '').trim();
        return name ? [name] : [];
      })
      : [];
    const nestedNames = Array.isArray(layer.layers)
      ? anchorNamesFromLayers(layer.layers as LoadedTiledMap['layers'])
      : [];
    return [...ownNames, ...nestedNames];
  });
}

function slugAppearsAsAnchorSegment(anchorName: string, slug: string) {
  if (!slug) return false;
  const segments = anchorName.toLocaleLowerCase('es')
    .split(/[:/_\s]+/u)
    .map(normalizePokeDiscoverAnchorSegment);
  return segments.includes(slug);
}

export function inferPokemonAssetsFromAnchorName(
  anchorName: string,
  manifest: Pick<PmdAnimationManifestV1, 'assets'>,
) {
  const assetsBySlug = new Map<string, PmdSpriteAssetV1[]>();
  for (const asset of manifest.assets) {
    let aliases: string[];
    try {
      aliases = parsePokeDiscoverPokemonAssetIdentity(asset.assetId).anchorAliases;
    } catch {
      continue;
    }
    for (const slug of aliases) {
      assetsBySlug.set(slug, [...(assetsBySlug.get(slug) ?? []), asset]);
    }
  }
  return [...assetsBySlug.entries()].flatMap(([slug, assets]) => (
    assets.length === 1 && slugAppearsAsAnchorSegment(anchorName, slug)
      ? assets
      : []
  ));
}

/**
 * Recupera únicamente coincidencias inequívocas: el slug del asset debe aparecer
 * como un segmento completo del nombre de un ancla y no puede identificar más de
 * un asset del manifiesto.
 */
export function inferPokemonRosterFromAnchorNames(
  tilemap: LoadedTiledMap | undefined,
  manifest: Pick<PmdAnimationManifestV1, 'assets'>,
): InferredPokemonRosterAsset[] {
  if (!tilemap) return [];
  const anchorNames = anchorNamesFromLayers(tilemap.layers);
  const matches = new Map<string, string[]>();
  for (const anchorName of anchorNames) {
    for (const asset of inferPokemonAssetsFromAnchorName(anchorName, manifest)) {
      matches.set(asset.assetId, [...(matches.get(asset.assetId) ?? []), anchorName]);
    }
  }
  return [...matches].map(([assetId, matchingAnchors]) => ({
    assetId,
    anchorNames: matchingAnchors,
  }));
}
