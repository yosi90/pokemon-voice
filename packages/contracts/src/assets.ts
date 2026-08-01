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
  role: 'player' | 'npc' | 'mount';
  path: string;
  frameWidth: number;
  frameHeight: number;
  columns: number;
  rows: 4;
  directionRows: Record<'down' | 'left' | 'right' | 'up', number>;
  idleFrame: number;
  walkFrames: number[];
  frameDurationMs: number;
  /** Frames opcionales para velocidades de carrera; se reutiliza walkFrames cuando faltan. */
  runFrames?: number[];
  runFrameDurationMs?: number;
  /** Escala visual curada; no altera el tamaño lógico de una celda. */
  renderScale?: number;
  source: string;
  /** Identidad editorial compartida por sus modos caminar/nadar. */
  appearanceId?: StableId;
  avatarId?: 'achaman' | 'guayota';
  locomotionMode?: 'walk' | 'swim';
}

export interface CharacterAppearanceV1 extends VersionedContractV1 {
  appearanceId: StableId;
  avatarId?: 'achaman' | 'guayota';
  label: string;
  modes: {
    walk: StableId;
    swim?: StableId;
  };
}

export interface CharacterSpriteManifestV1 extends VersionedContractV1 {
  assets: CharacterSpriteAssetV1[];
  appearances?: CharacterAppearanceV1[];
}

export interface AdventureEffectAnimationV1 {
  name: string;
  frames: number[];
  frameDurationMs: number;
  loop: boolean;
}

export interface AdventureEffectAssetV1 extends VersionedContractV1 {
  kind: 'effect';
  assetId: StableId;
  path: string;
  frameWidth: number;
  frameHeight: number;
  columns: number;
  rows: number;
  pivot: { x: number; y: number };
  collision?: { width: number; height: number; offsetX?: number; offsetY?: number };
  animations: AdventureEffectAnimationV1[];
  source: string;
}

export interface AdventureAudioAssetV1 extends VersionedContractV1 {
  kind: 'audio';
  assetId: StableId;
  path: string;
  audioKind: 'effect' | 'music' | 'voice';
  defaultVolume?: number;
  defaultLoop?: boolean;
  source: string;
}

export interface NarrativeBackgroundAssetV1 extends VersionedContractV1 {
  kind: 'narrativeBackground';
  assetId: StableId;
  path: string;
  label: string;
  width: number;
  height: number;
  source: string;
}

export interface NarrativeCharacterPoseAssetV1 extends VersionedContractV1 {
  kind: 'narrativeCharacter';
  assetId: StableId;
  characterId: StableId;
  characterName: string;
  poseId: StableId;
  poseLabel: string;
  path: string;
  source: string;
}

export interface AdventureMediaManifestV1 extends VersionedContractV1 {
  assets: Array<
    | AdventureEffectAssetV1
    | AdventureAudioAssetV1
    | NarrativeBackgroundAssetV1
    | NarrativeCharacterPoseAssetV1
  >;
}
