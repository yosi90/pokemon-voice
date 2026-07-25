import type {
  PmdAnimationManifestV1,
  PmdAnimationV1,
  PmdSpriteAssetV1,
} from '../../../packages/contracts/src/index.js';
import type { PokeDiscoverEditorCatalogEntry } from './pokeDiscoverEditorCatalog.js';

export interface PokeDiscoverEditorPmdAnimation extends PmdAnimationV1 {
  durationMs: number;
}

export function findPmdAssetForCatalogEntry(
  entry: PokeDiscoverEditorCatalogEntry,
  manifest: PmdAnimationManifestV1,
): PmdSpriteAssetV1 | undefined {
  return manifest.assets.find(asset => asset.formId === entry.form.formId);
}

export function getPmdAnimations(
  asset: PmdSpriteAssetV1,
  tickRate: number,
): PokeDiscoverEditorPmdAnimation[] {
  return asset.animations.map(animation => ({
    ...animation,
    durationMs: animation.durationTicks.reduce((total, ticks) => total + ticks, 0) / tickRate * 1000,
  }));
}

