import type {
  JsonValue,
  PokemonFormId,
  PokemonSpeciesId,
  StableId,
  Vector2V1,
  VersionedContractV1,
} from './common.js';
import type { RewardDefinitionV1 } from './economy.js';
import type { RequirementExpressionV1 } from './requirements.js';
import type { ResearchFieldKey } from './research.js';
import type { MeaningfulExpeditionInteractionKind } from './progress.js';

export type TileLayerKind = 'ground' | 'decoration' | 'overlay' | 'collision';
export type MissionStatus = 'locked' | 'available' | 'active' | 'completed';
export type CompanionTriggerMode = 'prompt' | 'automatic' | 'ambient';
export type CompanionTriggerRepeatPolicy = 'oncePerVisit' | 'persistent' | 'repeatable';
export type ExpressionInputMethod = 'voice' | 'text' | 'contextAction';
export type ExpressionIntent = 'compliment' | 'calm' | 'warn' | 'sing' | 'custom';
export type AdventureActorCollision = 'solid' | 'pass-through';
export type AmbientMovementStyle = 'grid' | 'continuous';

export interface MillisecondRangeV1 {
  min: number;
  max: number;
}

export interface AdventureTileLayerV1 {
  layerId: StableId;
  kind: TileLayerKind;
  width: number;
  height: number;
  tiles: number[];
  visible: boolean;
}

export interface AdventureMapObjectV1 {
  objectId: StableId;
  kind: 'playerSpawn' | 'npc' | 'portal' | 'trigger' | 'secret' | 'encounterZone';
  position: Vector2V1;
  properties: Record<string, JsonValue>;
}

export interface MapVariantV1 {
  variantId: StableId;
  requirement: RequirementExpressionV1;
  tileOverrides?: Record<StableId, number[]>;
  enabledObjectIds?: StableId[];
  disabledObjectIds?: StableId[];
  audioTrackId?: StableId;
  visualEffectIds?: StableId[];
}

export interface RareEncounterDefinitionV1 {
  encounterId: StableId;
  speciesId: PokemonSpeciesId;
  formId?: PokemonFormId;
  appearanceId?: StableId;
  requirement: RequirementExpressionV1;
  baseProbability: number;
  /** Por defecto 3 cuando no se declara otro límite curado. */
  guaranteedEligibleVisit?: number;
}

export interface AdventureMapV1 extends VersionedContractV1 {
  mapId: StableId;
  title: string;
  width: number;
  height: number;
  tileSize: 16;
  tilesetIds: StableId[];
  layers: AdventureTileLayerV1[];
  objects: AdventureMapObjectV1[];
  variants: MapVariantV1[];
  missionIds: StableId[];
  behaviorTriggers: CompanionBehaviorTriggerV1[];
  expressionTriggers: ExpeditionExpressionTriggerV1[];
  rareEncounters: RareEncounterDefinitionV1[];
  requiredAssetIds: StableId[];
}

export type RoomTransitionKind = 'edge' | 'stairs' | 'door' | 'teleport';

export interface AdventureRoomV1 extends VersionedContractV1 {
  roomId: StableId;
  tiledMapAssetId: StableId;
  staticCamera: true;
  spawnAnchorIds: StableId[];
}

export interface TiledMapAssetReferenceV1 extends VersionedContractV1 {
  assetId: StableId;
  /** Ruta relativa a `public/`, portable entre Vite y la futura sideweb. */
  path: string;
}

export interface AdventureActorPlacementV1 extends VersionedContractV1 {
  placementId: StableId;
  roomId: StableId;
  anchorId: StableId;
  assetId: StableId;
  animation: string;
  direction?: 'up' | 'down' | 'left' | 'right';
  /** Los actores terrestres son sólidos por defecto; declarar pass-through para vuelo o levitación. */
  collision?: AdventureActorCollision;
  /** Grupos de máscaras dibujadas en Tiled que pueden ocultar partes del sprite. */
  occlusionGroupIds?: StableId[];
}

export interface AdventureCharacterPlacementV1 extends VersionedContractV1 {
  placementId: StableId;
  roomId: StableId;
  anchorId: StableId;
  assetId: StableId;
  direction?: 'up' | 'down' | 'left' | 'right';
  controllable?: true;
  /** Los NPC son sólidos por defecto. */
  collision?: AdventureActorCollision;
  occlusionGroupIds?: StableId[];
}

export interface AmbientPlayAnimationActionV1 {
  kind: 'playAnimation';
  placementId: StableId;
  animation: string;
  direction?: 'up' | 'down' | 'left' | 'right';
  repetitions?: number;
}

export interface AmbientFaceActionV1 {
  kind: 'face';
  placementId: StableId;
  direction: 'up' | 'down' | 'left' | 'right';
}

export interface AmbientMovePathActionV1 {
  kind: 'movePath';
  placementId: StableId;
  pathId: StableId;
  movementStyle: AmbientMovementStyle;
  speedPixelsPerSecond: number;
  animation?: string;
  reverse?: boolean;
}

export type AmbientActorActionV1 =
  | AmbientPlayAnimationActionV1
  | AmbientFaceActionV1
  | AmbientMovePathActionV1;

export interface AmbientBeatV1 extends VersionedContractV1 {
  beatId: StableId;
  actions: AmbientActorActionV1[];
  pauseAfterMs?: number | MillisecondRangeV1;
}

export interface AmbientSequenceV1 extends VersionedContractV1 {
  sequenceId: StableId;
  roomId: StableId;
  loop: boolean;
  /** Todas las acciones se pausan juntas cuando una ruta queda bloqueada. */
  blockedPolicy: 'pauseSequence';
  loopPauseMs?: number | MillisecondRangeV1;
  beats: AmbientBeatV1[];
}

export interface RoomTransitionV1 extends VersionedContractV1 {
  transitionId: StableId;
  kind: RoomTransitionKind;
  fromRoomId: StableId;
  fromAnchorId: StableId;
  toRoomId: StableId;
  toAnchorId: StableId;
  destinationFacing?: 'up' | 'down' | 'left' | 'right';
  requirement?: RequirementExpressionV1;
}

export interface ExpeditionDialoguePageV1 extends VersionedContractV1 {
  pageId: StableId;
  speakerName: string;
  text: string;
  nextPageId?: StableId;
}

export interface ExpeditionDialogueV1 extends VersionedContractV1 {
  dialogueId: StableId;
  initialPageId: StableId;
  pages: ExpeditionDialoguePageV1[];
}

export type ExpeditionInteractionTargetV1 =
  | { kind: 'placement'; placementId: StableId }
  | { kind: 'anchor'; anchorId: StableId };

export interface ExpeditionInteractionV1 extends VersionedContractV1 {
  interactionId: StableId;
  roomId: StableId;
  target: ExpeditionInteractionTargetV1;
  prompt: string;
  dialogueId: StableId;
  meaningfulKind: MeaningfulExpeditionInteractionKind;
  /** Distancia cardinal máxima; un tile cuando se omite. */
  rangeTiles?: number;
  repeatPolicy?: 'oncePerVisit' | 'repeatable';
}

/** Mapa lógico multihabitación. La geometría vive exclusivamente en los .tmj enlazados. */
export interface AdventureMapV2 {
  schemaVersion: 2;
  mapId: StableId;
  title: string;
  tiledMapAssets: TiledMapAssetReferenceV1[];
  rooms: AdventureRoomV1[];
  actorPlacements: AdventureActorPlacementV1[];
  characterPlacements: AdventureCharacterPlacementV1[];
  transitions: RoomTransitionV1[];
  variants: MapVariantV1[];
  missionIds: StableId[];
  behaviorTriggers: CompanionBehaviorTriggerV1[];
  expressionTriggers: ExpeditionExpressionTriggerV1[];
  interactions?: ExpeditionInteractionV1[];
  dialogues?: ExpeditionDialogueV1[];
  ambientSequences: AmbientSequenceV1[];
  rareEncounters: RareEncounterDefinitionV1[];
  requiredAssetIds: StableId[];
}

export interface MissionObjectiveV1 {
  objectiveId: StableId;
  description: string;
  requirement: RequirementExpressionV1;
  optional?: boolean;
}

export interface FieldNotebookHintV1 extends VersionedContractV1 {
  hintId: StableId;
  mapId: StableId;
  title: string;
  text: string;
  sourceNpcId?: StableId;
  relatedTriggerId?: StableId;
}

export interface MissionDefinitionV1 extends VersionedContractV1 {
  missionId: StableId;
  mapId: StableId;
  title: string;
  /** Frase temática mostrada mientras se prepara el runtime de la misión. */
  loadingText: string;
  briefing: string;
  availability?: RequirementExpressionV1;
  objectives: MissionObjectiveV1[];
  mapVariantIds: StableId[];
  rewards: RewardDefinitionV1[];
  unlocksFreeExpedition: boolean;
  /** Reservado al primer encargo real de campo presentado por Alcanfor. */
  grantsFirstMissionAchievement?: true;
}

export type ResearchContributionKind = 'observation' | 'fieldCompletion' | 'additionalNote';

export interface ResearchFactV1 extends VersionedContractV1 {
  factId: StableId;
  speciesId: PokemonSpeciesId;
  formId?: PokemonFormId;
  appearanceId?: StableId;
  field: ResearchFieldKey;
  contribution: ResearchContributionKind;
  mapId: StableId;
  interactionId: StableId;
  text: string;
  requirement?: RequirementExpressionV1;
  rewards: RewardDefinitionV1[];
}

export type CompanionRequirementVisibility = 'public' | 'hinted' | 'secret';

export interface CompanionRequirementV1 extends VersionedContractV1 {
  requirementId: StableId;
  formId?: PokemonFormId;
  appearanceId?: StableId;
  speciesId: PokemonSpeciesId;
  minimumTrainerLevel: number;
  /** Permite una excepción de lore a la diferencia general de cinco niveles. */
  ignoreReferenceLevelGap?: boolean;
  requirement?: RequirementExpressionV1;
  visibility: CompanionRequirementVisibility;
  loreHint?: string;
  rejectionText: string;
}

export interface CompanionBehaviorTriggerV1 extends VersionedContractV1 {
  triggerId: StableId;
  mode: CompanionTriggerMode;
  requirement: RequirementExpressionV1;
  sequenceId: StableId;
  /** `oncePerVisit` cuando no se especifica otro comportamiento. */
  repeatPolicy?: CompanionTriggerRepeatPolicy;
  rewardOriginId?: StableId;
}

export type ExpressionMatcherV1 =
  | { kind: 'phrase'; phrases: string[]; aliases?: string[] }
  | { kind: 'intent'; intent: ExpressionIntent; examples: string[] }
  | {
    kind: 'acoustic';
    feature: 'loudness' | 'sustainedNote' | 'simpleHum';
    minimumDurationMs?: number;
    minimumLevel?: number;
  };

export interface ExpeditionExpressionTriggerV1 extends VersionedContractV1 {
  triggerId: StableId;
  /** Contexto espacial; obligatorio para prompts ejecutados dentro de Phaser. */
  roomId?: StableId;
  target?: ExpeditionInteractionTargetV1;
  prompt?: string;
  rangeTiles?: number;
  activationRequirement: RequirementExpressionV1;
  inputMethods: ExpressionInputMethod[];
  matchAny: ExpressionMatcherV1[];
  knownHintIds: StableId[];
  successSequenceId: StableId;
  fallbackActionId: StableId;
  fallbackLabel?: string;
  successText?: string;
  retryText?: string;
  rewardOriginId?: StableId;
}

export interface WorldEventV1 extends VersionedContractV1 {
  eventId: StableId;
  activation: RequirementExpressionV1;
  setFlags: Record<StableId, JsonValue>;
  encounterInjections: Array<{ mapId: StableId; encounterId: StableId }>;
  mapVariants: Array<{ mapId: StableId; variantId: StableId }>;
}
