import type {
  CharacterAppearanceV1,
  CharacterSpriteAssetV1,
  CharacterSpriteManifestV1,
  TrainerAvatarId,
} from '../../../packages/contracts/src/index.js';

export interface ResolvedPlayerAppearance {
  appearance: CharacterAppearanceV1;
  walk: CharacterSpriteAssetV1;
  swim?: CharacterSpriteAssetV1;
}

export function resolvePlayerAppearance(
  manifest: CharacterSpriteManifestV1,
  {
    avatarId,
    appearanceId,
  }: {
    avatarId: TrainerAvatarId;
    appearanceId?: string;
  },
): ResolvedPlayerAppearance | undefined {
  const appearance = appearanceId
    ? manifest.appearances?.find(candidate => candidate.appearanceId === appearanceId)
    : manifest.appearances?.find(candidate => candidate.avatarId === avatarId);
  if (!appearance) return undefined;
  const walk = manifest.assets.find(candidate => candidate.assetId === appearance.modes.walk);
  if (!walk || walk.role !== 'player') return undefined;
  const swim = appearance.modes.swim
    ? manifest.assets.find(candidate => candidate.assetId === appearance.modes.swim)
    : undefined;
  return {
    appearance,
    walk,
    ...(swim?.role === 'player' ? { swim } : {}),
  };
}
