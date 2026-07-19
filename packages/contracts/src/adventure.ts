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

export type TileLayerKind = 'ground' | 'decoration' | 'overlay' | 'collision';
export type MissionStatus = 'locked' | 'available' | 'active' | 'completed';
export type CompanionTriggerMode = 'prompt' | 'automatic' | 'ambient';
export type CompanionTriggerRepeatPolicy = 'oncePerVisit' | 'persistent' | 'repeatable';
export type ExpressionInputMethod = 'voice' | 'text' | 'contextAction';
export type ExpressionIntent = 'compliment' | 'calm' | 'warn' | 'sing' | 'custom';
export type AdventureActorCollision = 'solid' | 'pass-through';

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
  activationRequirement: RequirementExpressionV1;
  inputMethods: ExpressionInputMethod[];
  matchAny: ExpressionMatcherV1[];
  knownHintIds: StableId[];
  successSequenceId: StableId;
  fallbackActionId: StableId;
  rewardOriginId?: StableId;
}

export interface WorldEventV1 extends VersionedContractV1 {
  eventId: StableId;
  activation: RequirementExpressionV1;
  setFlags: Record<StableId, JsonValue>;
  encounterInjections: Array<{ mapId: StableId; encounterId: StableId }>;
  mapVariants: Array<{ mapId: StableId; variantId: StableId }>;
}
