import type {
  CompanionAppearanceProfileV1,
  CompanionFormProfileV1,
  CompanionWaterTraversalV1,
  CharacterSpriteManifestV1,
} from '../../../packages/contracts/src/index.js';

const DEFAULT_WATER_TRAVERSAL: CompanionWaterTraversalV1 = Object.freeze({
  kind: 'recall',
});

export function resolveCompanionWaterTraversal(
  form: Pick<CompanionFormProfileV1, 'waterTraversal'>,
  appearance?: Pick<CompanionAppearanceProfileV1, 'waterTraversal'>,
) {
  return appearance?.waterTraversal ?? form.waterTraversal ?? DEFAULT_WATER_TRAVERSAL;
}

export function resolveCompanionWaterMount(
  manifest: Pick<CharacterSpriteManifestV1, 'assets'>,
  traversal: CompanionWaterTraversalV1,
) {
  if (!traversal.mountAssetId) return undefined;
  return manifest.assets.find(asset => (
    asset.assetId === traversal.mountAssetId && asset.role === 'mount'
  ));
}
