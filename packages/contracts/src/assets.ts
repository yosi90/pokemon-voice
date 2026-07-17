import type {
  PokemonFormId,
  PokemonSpeciesId,
  StableId,
  VersionedContractV1,
} from './common.js';

export interface PmdAnimationV1 {
  name: string;
  index: number;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  directionCount: number;
  durationTicks: number[];
  copyOf?: string;
  animationSheetPath: string;
  offsetsSheetPath: string;
  shadowSheetPath: string;
  rushFrame?: number;
  hitFrame?: number;
  returnFrame?: number;
}

export interface PmdSpriteAssetV1 extends VersionedContractV1 {
  assetId: StableId;
  speciesId: PokemonSpeciesId;
  formId: PokemonFormId;
  source: 'PMDCollab';
  basePath: string;
  shadowSize: number;
  animations: PmdAnimationV1[];
  creditIds: StableId[];
}

export interface PmdAnimationManifestV1 extends VersionedContractV1 {
  tickRate: 60;
  assets: PmdSpriteAssetV1[];
}
