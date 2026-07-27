import type { LoadedAdventureMapBundle } from '../maps/loadAdventureBundle.js';

export const POKEDISCOVER_ENTITY_SCALE_MIN_PERCENT = 50;
export const POKEDISCOVER_ENTITY_SCALE_MAX_PERCENT = 150;
export const POKEDISCOVER_ENTITY_SCALE_STEP_PERCENT = 5;

export function getPokeDiscoverEntityBaseScale(
  bundle: Pick<LoadedAdventureMapBundle, 'pmdManifest' | 'characterManifest'>,
  assetId: string,
) {
  return bundle.pmdManifest.assets.find(asset => asset.assetId === assetId)?.renderScale
    ?? bundle.characterManifest.assets.find(asset => asset.assetId === assetId)?.renderScale
    ?? 1;
}

export function getPokeDiscoverEntityScalePercent(
  bundle: Pick<LoadedAdventureMapBundle, 'pmdManifest' | 'characterManifest'>,
  placement: { assetId: string; renderScaleMultiplier?: number },
) {
  return Math.round(
    getPokeDiscoverEntityBaseScale(bundle, placement.assetId)
      * (placement.renderScaleMultiplier ?? 1)
      * 100,
  );
}

export function getPokeDiscoverEntityScaleMultiplier(
  bundle: Pick<LoadedAdventureMapBundle, 'pmdManifest' | 'characterManifest'>,
  assetId: string,
  scalePercent: number,
) {
  const baseScale = getPokeDiscoverEntityBaseScale(bundle, assetId);
  const multiplier = scalePercent / 100 / baseScale;
  return Math.abs(multiplier - 1) < 0.000_001 ? undefined : multiplier;
}

export function clampPokeDiscoverEntityScalePercent(scalePercent: number) {
  return Math.min(
    POKEDISCOVER_ENTITY_SCALE_MAX_PERCENT,
    Math.max(POKEDISCOVER_ENTITY_SCALE_MIN_PERCENT, scalePercent),
  );
}
