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
  /** Pivote de suelo normalizado del primer frame de cada dirección, calculado al generar el manifiesto. */
  groundOrigins: Array<{ x: number; y: number }>;
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
  /** Escala visual común, curable por especie sin alterar el mapa. */
  renderScale?: number;
  animations: PmdAnimationV1[];
  creditIds: StableId[];
}

export interface PmdAnimationManifestV1 extends VersionedContractV1 {
  tickRate: 60;
  assets: PmdSpriteAssetV1[];
}

export interface CharacterSpriteAssetV1 extends VersionedContractV1 {
  assetId: StableId;
  role: 'player' | 'npc';
  path: string;
  frameWidth: number;
  frameHeight: number;
  columns: number;
  rows: 4;
  directionRows: Record<'down' | 'left' | 'right' | 'up', number>;
  idleFrame: number;
  walkFrames: number[];
  frameDurationMs: number;
  /** Escala visual curada; no altera el tamaño lógico de una celda. */
  renderScale?: number;
  source: string;
}

export interface CharacterSpriteManifestV1 extends VersionedContractV1 {
  assets: CharacterSpriteAssetV1[];
}
