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
import {
  ADVENTURE_ACTOR_COLLISIONS,
  ADVENTURE_ENTRY_REPEAT_POLICIES,
  AMBIENT_ACTOR_ACTION_KINDS,
  AMBIENT_MOVEMENT_STYLES,
  AMBIENT_PLAYBACK_MODES,
  COMPANION_SEQUENCE_ACTION_KINDS,
  COMPANION_TRIGGER_MODES,
  COMPANION_TRIGGER_REPEAT_POLICIES,
  EXPRESSION_INPUT_METHODS,
  EXPRESSION_INTENTS,
  EXPRESSION_MATCHER_KINDS,
  MISSION_STATUSES,
  ROOM_TRANSITION_KINDS,
  SECTOR_TRANSITION_KINDS,
  TILE_LAYER_KINDS,
  TILED_ANCHOR_CLASSES,
  TILED_RUNTIME_OBJECT_CLASSES,
} from './adventureVocabulary.js';
export {
  ADVENTURE_ACTOR_COLLISIONS,
  ADVENTURE_ENTRY_REPEAT_POLICIES,
  AMBIENT_ACTOR_ACTION_KINDS,
  AMBIENT_MOVEMENT_STYLES,
  AMBIENT_PLAYBACK_MODES,
  COMPANION_SEQUENCE_ACTION_KINDS,
  COMPANION_TRIGGER_MODES,
  COMPANION_TRIGGER_REPEAT_POLICIES,
  EXPRESSION_INPUT_METHODS,
  EXPRESSION_INTENTS,
  EXPRESSION_MATCHER_KINDS,
  MISSION_STATUSES,
  ROOM_TRANSITION_KINDS,
  SECTOR_TRANSITION_KINDS,
  TILE_LAYER_KINDS,
  TILED_ANCHOR_CLASSES,
  TILED_RUNTIME_OBJECT_CLASSES,
};

export type TileLayerKind = typeof TILE_LAYER_KINDS[number];
export type MissionStatus = typeof MISSION_STATUSES[number];
export type CompanionTriggerMode = typeof COMPANION_TRIGGER_MODES[number];
export type CompanionTriggerRepeatPolicy = typeof COMPANION_TRIGGER_REPEAT_POLICIES[number];
export type ExpressionInputMethod = typeof EXPRESSION_INPUT_METHODS[number];
export type ExpressionIntent = typeof EXPRESSION_INTENTS[number];
export type AdventureActorCollision = typeof ADVENTURE_ACTOR_COLLISIONS[number];
export type AmbientMovementStyle = typeof AMBIENT_MOVEMENT_STYLES[number];
export type AmbientPlaybackMode = typeof AMBIENT_PLAYBACK_MODES[number];
export type AmbientActorActionKind = typeof AMBIENT_ACTOR_ACTION_KINDS[number];
export type CompanionSequenceActionKind = typeof COMPANION_SEQUENCE_ACTION_KINDS[number];
export type ExpressionMatcherKind = typeof EXPRESSION_MATCHER_KINDS[number];
export type TiledAnchorClass = typeof TILED_ANCHOR_CLASSES[number];
export type TiledRuntimeObjectClass = typeof TILED_RUNTIME_OBJECT_CLASSES[number];

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
  companionSequences?: CompanionSequenceV1[];
  expressionTriggers: ExpeditionExpressionTriggerV1[];
  rareEncounters: RareEncounterDefinitionV1[];
  requiredAssetIds: StableId[];
}

export type SectorTransitionKind = typeof SECTOR_TRANSITION_KINDS[number];
/** @deprecated Nombre conservado únicamente para documentos V2. */
export type RoomTransitionKind = SectorTransitionKind;

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
  /** Útil para actores que entran en escena desde madrigueras, puertas o escondites. */
  initiallyHidden?: boolean;
  /** Multiplicador visual relativo al renderScale curado del asset. 1 equivale al 100 %. */
  renderScaleMultiplier?: number;
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
  /** Permite preparar poses alternativas y entradas de cinemática sin sacarlas del sidecar. */
  initiallyHidden?: boolean;
  /** Multiplicador visual relativo al renderScale curado del asset. 1 equivale al 100 %. */
  renderScaleMultiplier?: number;
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

export interface AmbientMoveByTilesActionV1 {
  kind: 'moveByTiles';
  placementId: StableId;
  deltaXTiles: number;
  deltaYTiles: number;
  movementStyle: AmbientMovementStyle;
  speedPixelsPerSecond: number;
  animation?: string;
}

export interface AmbientSetVisibleActionV1 {
  kind: 'setVisible';
  placementId: StableId;
  visible: boolean;
}

export type AmbientActorActionV1 =
  | AmbientPlayAnimationActionV1
  | AmbientFaceActionV1
  | AmbientMovePathActionV1
  | AmbientMoveByTilesActionV1
  | AmbientSetVisibleActionV1;

export interface AmbientBeatV1 extends VersionedContractV1 {
  beatId: StableId;
  actions: AmbientActorActionV1[];
  pauseAfterMs?: number | MillisecondRangeV1;
}

export interface AmbientSequenceV1 extends VersionedContractV1 {
  sequenceId: StableId;
  roomId: StableId;
  loop: boolean;
  /** Modo explícito del editor; `loop` se conserva para sidecars V1 anteriores. */
  playbackMode?: AmbientPlaybackMode;
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
  repeatPolicy?: typeof ADVENTURE_ENTRY_REPEAT_POLICIES[number];
  completionEffects?: {
    npcId?: StableId;
    conversationId?: StableId;
    hintIds?: StableId[];
    collectibleIds?: StableId[];
  };
}

export interface AdventureEntryPointV1 extends VersionedContractV1 {
  entryPointId: StableId;
  label: string;
  roomId: StableId;
  anchorId: StableId;
}

export interface AdventureMissionEntryPointV1 extends VersionedContractV1 {
  missionId: StableId;
  entryPointId: StableId;
}

/** Mapa lógico multihabitación. La geometría jugable vive en los .tmj enlazados. */
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
  /** Entradas reutilizables del mapa. Opcional para conservar sidecars V2 anteriores. */
  entryPoints?: AdventureEntryPointV1[];
  /** Entrada elegida por cada misión asociada a este mapa. */
  missionEntryPoints?: AdventureMissionEntryPointV1[];
  /** Entrada usada al comenzar una expedición libre. */
  freeExpeditionEntryPointId?: StableId;
  behaviorTriggers: CompanionBehaviorTriggerV1[];
  companionSequences?: CompanionSequenceV1[];
  /** Secuencias narrativas del mapa; comparten beats y acciones con las del compañero. */
  mapSequences?: CompanionSequenceV1[];
  expressionTriggers: ExpeditionExpressionTriggerV1[];
  interactions?: ExpeditionInteractionV1[];
  dialogues?: ExpeditionDialogueV1[];
  fieldNotebookHints?: FieldNotebookHintV1[];
  /** Hechos de investigación obtenibles en este mapa; factId actúa como origen único de recompensa. */
  researchFacts?: ResearchFactV1[];
  ambientSequences: AmbientSequenceV1[];
  rareEncounters: RareEncounterDefinitionV1[];
  /** Eventos originados por este sidecar; sus efectos pueden apuntar a cualquier mapa. */
  worldEvents?: WorldEventV1[];
  requiredAssetIds: StableId[];
}

export interface AdventureSectorRosterV1 extends VersionedContractV1 {
  /** Assets PMD previstos en el sector. Formas y apariencias son entradas distintas. */
  pokemonAssetIds: StableId[];
  /** Assets de personajes con role `npc` previstos en el sector. */
  npcAssetIds: StableId[];
}

export interface AdventureSectorV1 extends VersionedContractV1 {
  sectorId: StableId;
  /** IDs V2 aceptados exclusivamente para resolver enlaces históricos. */
  legacyRoomIds?: StableId[];
  tiledMapAssetId: StableId;
  staticCamera: true;
  spawnAnchorIds: StableId[];
  roster: AdventureSectorRosterV1;
}

export type AdventureActorPlacementV3 =
  Omit<AdventureActorPlacementV1, 'roomId'> & { sectorId: StableId };

export type AdventureCharacterPlacementV3 =
  Omit<AdventureCharacterPlacementV1, 'roomId'> & { sectorId: StableId };

export type AmbientSequenceV3 =
  Omit<AmbientSequenceV1, 'roomId'> & { sectorId: StableId };

export interface SectorTransitionV1 extends VersionedContractV1 {
  transitionId: StableId;
  kind: SectorTransitionKind;
  fromSectorId: StableId;
  fromAnchorId: StableId;
  toSectorId: StableId;
  toAnchorId: StableId;
  destinationFacing?: 'up' | 'down' | 'left' | 'right';
  requirement?: RequirementExpressionV1;
}

export type ExpeditionInteractionV3 =
  Omit<ExpeditionInteractionV1, 'roomId'> & { sectorId: StableId };

export type AdventureEntryPointV3 =
  Omit<AdventureEntryPointV1, 'roomId'> & { sectorId: StableId };

export type CompanionBehaviorTriggerV3 =
  Omit<CompanionBehaviorTriggerV1, 'proximity'> & {
    proximity?: Omit<NonNullable<CompanionBehaviorTriggerV1['proximity']>, 'roomId'> & {
      sectorId: StableId;
    };
  };

export type CompanionSequenceV3 =
  Omit<CompanionSequenceV1, 'roomId'> & { sectorId: StableId };

export type ExpeditionExpressionTriggerV3 =
  Omit<ExpeditionExpressionTriggerV1, 'roomId'> & { sectorId?: StableId };

/** Mapa lógico multisector. La geometría jugable vive en los TMJ enlazados. */
export interface AdventureMapV3 {
  schemaVersion: 3;
  mapId: StableId;
  title: string;
  tiledMapAssets: TiledMapAssetReferenceV1[];
  sectors: AdventureSectorV1[];
  actorPlacements: AdventureActorPlacementV3[];
  characterPlacements: AdventureCharacterPlacementV3[];
  transitions: SectorTransitionV1[];
  variants: MapVariantV1[];
  missionIds: StableId[];
  entryPoints?: AdventureEntryPointV3[];
  missionEntryPoints?: AdventureMissionEntryPointV1[];
  freeExpeditionEntryPointId?: StableId;
  behaviorTriggers: CompanionBehaviorTriggerV3[];
  companionSequences?: CompanionSequenceV3[];
  mapSequences?: CompanionSequenceV3[];
  expressionTriggers: ExpeditionExpressionTriggerV3[];
  interactions?: ExpeditionInteractionV3[];
  dialogues?: ExpeditionDialogueV1[];
  fieldNotebookHints?: FieldNotebookHintV1[];
  researchFacts?: ResearchFactV1[];
  ambientSequences: AmbientSequenceV3[];
  rareEncounters: RareEncounterDefinitionV1[];
  worldEvents?: WorldEventV1[];
  requiredAssetIds: StableId[];
}

export type AdventureMapDocument = AdventureMapV2 | AdventureMapV3;

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
  /** Texto de acción visible al hablar con el compañero. */
  actionLabel?: string;
  /** Pista narrativa; nunca revela el resultado oculto. */
  loreHint?: string;
  requirement: RequirementExpressionV1;
  sequenceId: StableId;
  proximity?: {
    roomId: StableId;
    target: ExpeditionInteractionTargetV1;
    rangeTiles?: number;
    /** Secuencia repetible cuando el requisito de compañero no se cumple. */
    failureSequenceId?: StableId;
  };
  /** `oncePerVisit` cuando no se especifica otro comportamiento. */
  repeatPolicy?: CompanionTriggerRepeatPolicy;
  rewardOriginId?: StableId;
  rewardPackageId?: StableId;
  rewards?: RewardDefinitionV1[];
  completionEffects?: {
    unlockSecretIds?: StableId[];
  };
}

export type CompanionSequenceActorRef = StableId | 'dynamic:companion' | 'dynamic:player';

export type CompanionSequenceActionV1 =
  | {
    kind: 'playAnimation';
    actorRef: CompanionSequenceActorRef;
    animation?: string;
    /** Excepciones narrativas sin duplicar toda la secuencia. */
    animationByCompanionSpecies?: Record<number, string>;
    repetitions?: number;
  }
  | { kind: 'face'; actorRef: CompanionSequenceActorRef; direction: 'up' | 'down' | 'left' | 'right' }
  | { kind: 'setVisible'; actorRef: CompanionSequenceActorRef; visible: boolean }
  | { kind: 'moveToAnchor'; actorRef: CompanionSequenceActorRef; anchorId: StableId; speedPixelsPerSecond?: number }
  | { kind: 'moveByTiles'; actorRef: CompanionSequenceActorRef; direction: 'up' | 'down' | 'left' | 'right'; tiles: number; speedPixelsPerSecond?: number }
  | { kind: 'returnToTrainer'; actorRef: 'dynamic:companion'; speedPixelsPerSecond?: number }
  | {
    kind: 'dropPokeBalls';
    actorRef: CompanionSequenceActorRef;
    count: number;
    spreadTiles?: number;
    fallTiles?: number;
  }
  | { kind: 'emitCue'; actorRef: CompanionSequenceActorRef; cueId: StableId };

export interface CompanionSequenceBeatV1 extends VersionedContractV1 {
  beatId: StableId;
  actions: CompanionSequenceActionV1[];
  pauseAfterMs?: number;
}

export interface CompanionSequenceV1 extends VersionedContractV1 {
  sequenceId: StableId;
  roomId: StableId;
  beats: CompanionSequenceBeatV1[];
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
  rewardPackageId?: StableId;
  completionEffects?: {
    unlockSecretIds?: StableId[];
  };
}

export interface WorldEventV1 extends VersionedContractV1 {
  eventId: StableId;
  activation: RequirementExpressionV1;
  setFlags: Record<StableId, JsonValue>;
  encounterInjections: Array<{ mapId: StableId; encounterId: StableId }>;
  mapVariants: Array<{ mapId: StableId; variantId: StableId }>;
}
