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
import type { NarrativeSequenceV1 } from './narrative.js';
import {
  ADVENTURE_ACTOR_COLLISIONS,
  ADVENTURE_ENTRY_REPEAT_POLICIES,
  AMBIENT_ACTOR_ACTION_KINDS,
  AMBIENT_MOVEMENT_STYLES,
  AMBIENT_PLAYBACK_MODES,
  COMPANION_SEQUENCE_ACTION_KINDS,
  COMPANION_TRIGGER_MODES,
  COMPANION_TRIGGER_REPEAT_POLICIES,
  MAP_EVENT_ACTIVATION_KINDS,
  MAP_EVENT_REPEAT_POLICIES,
  MAP_SEQUENCE_ACTION_KINDS,
  EXPRESSION_INPUT_METHODS,
  EXPRESSION_INTENTS,
  EXPRESSION_MATCHER_KINDS,
  MISSION_STATUSES,
  ROOM_TRANSITION_KINDS,
  SECTOR_TRANSITION_KINDS,
  TILE_LAYER_KINDS,
  TILED_ANCHOR_CLASSES,
  TILED_RUNTIME_OBJECT_CLASSES,
  TERRAIN_SURFACE_TYPES,
  ADVENTURE_LOCATION_KINDS,
  COMPANION_WATER_TRAVERSAL_KINDS,
  HAZARD_OUTCOMES,
  HAZARD_ROLLBACK_POLICIES,
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
  MAP_EVENT_ACTIVATION_KINDS,
  MAP_EVENT_REPEAT_POLICIES,
  MAP_SEQUENCE_ACTION_KINDS,
  EXPRESSION_INPUT_METHODS,
  EXPRESSION_INTENTS,
  EXPRESSION_MATCHER_KINDS,
  MISSION_STATUSES,
  ROOM_TRANSITION_KINDS,
  SECTOR_TRANSITION_KINDS,
  TILE_LAYER_KINDS,
  TILED_ANCHOR_CLASSES,
  TILED_RUNTIME_OBJECT_CLASSES,
  TERRAIN_SURFACE_TYPES,
  ADVENTURE_LOCATION_KINDS,
  COMPANION_WATER_TRAVERSAL_KINDS,
  HAZARD_OUTCOMES,
  HAZARD_ROLLBACK_POLICIES,
};

export type TileLayerKind = typeof TILE_LAYER_KINDS[number];
export type MissionStatus = typeof MISSION_STATUSES[number];
export type CompanionTriggerMode = typeof COMPANION_TRIGGER_MODES[number];
export type CompanionTriggerRepeatPolicy = typeof COMPANION_TRIGGER_REPEAT_POLICIES[number];
export type MapEventActivationKind = typeof MAP_EVENT_ACTIVATION_KINDS[number];
export type MapEventRepeatPolicy = typeof MAP_EVENT_REPEAT_POLICIES[number];
export type ExpressionInputMethod = typeof EXPRESSION_INPUT_METHODS[number];
export type ExpressionIntent = typeof EXPRESSION_INTENTS[number];
export type AdventureActorCollision = typeof ADVENTURE_ACTOR_COLLISIONS[number];
export type AmbientMovementStyle = typeof AMBIENT_MOVEMENT_STYLES[number];
export type AmbientPlaybackMode = typeof AMBIENT_PLAYBACK_MODES[number];
export type AmbientActorActionKind = typeof AMBIENT_ACTOR_ACTION_KINDS[number];
export type CompanionSequenceActionKind = typeof COMPANION_SEQUENCE_ACTION_KINDS[number];
export type MapSequenceActionKind = typeof MAP_SEQUENCE_ACTION_KINDS[number];
export type ExpressionMatcherKind = typeof EXPRESSION_MATCHER_KINDS[number];
export type TiledAnchorClass = typeof TILED_ANCHOR_CLASSES[number];
export type TiledRuntimeObjectClass = typeof TILED_RUNTIME_OBJECT_CLASSES[number];
export type TerrainSurfaceType = typeof TERRAIN_SURFACE_TYPES[number];
export type AdventureLocationKind = typeof ADVENTURE_LOCATION_KINDS[number];
export type CompanionWaterTraversalKind = typeof COMPANION_WATER_TRAVERSAL_KINDS[number];
export type HazardOutcome = typeof HAZARD_OUTCOMES[number];
export type HazardRollbackPolicy = typeof HAZARD_ROLLBACK_POLICIES[number];

export interface AdventureTerrainRulesV1 {
  allowedSurfaceTypes: TerrainSurfaceType[];
  animationBySurface?: Partial<Record<TerrainSurfaceType, string>>;
}

export interface CompanionWaterTraversalV1 {
  kind: CompanionWaterTraversalKind;
  alternateAssetId?: StableId;
  /** Sprite de montura colocado bajo el protagonista mientras el compañero permite Surf. */
  mountAssetId?: StableId;
}

export interface TerrainAreaV1 extends VersionedContractV1 {
  terrainAreaId: StableId;
  surfaceType: TerrainSurfaceType;
  slowMultiplier?: number;
}

export interface AdventureLocationV1 extends VersionedContractV1 {
  locationId: StableId;
  label: string;
  kind: AdventureLocationKind;
  tags: string[];
  transitionId?: StableId;
}

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
  terrainRules?: AdventureTerrainRulesV1;
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
  terrainRules?: AdventureTerrainRulesV1;
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
  mapSequences?: MapSequenceV1[];
  mapEventTriggers?: MapEventTriggerV1[];
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

export type MapSequenceV3 =
  Omit<MapSequenceV1, 'roomId'> & { sectorId: StableId };

export type MapEventTriggerV3 =
  Omit<MapEventTriggerV1, 'roomId'> & { sectorId: StableId };

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
  mapSequences?: MapSequenceV3[];
  mapEventTriggers?: MapEventTriggerV3[];
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
  /** Apariencia aplicada al jugador durante toda la misión. */
  playerAppearanceId?: StableId;
  narratives?: {
    offerSequenceId?: StableId;
    briefingSequenceId?: StableId;
    successSequenceId?: StableId;
    failureSequenceId?: StableId;
  };
  /** Flujo componible. Ausente en documentos V1 todavía no migrados. */
  flow?: MissionFlowV1;
}

export interface AdventureMissionDocumentV1 extends VersionedContractV1 {
  mapId: StableId;
  missions: MissionDefinitionV1[];
  /** Secuencias inline legadas; las conversaciones nuevas son globales. */
  narrativeSequences: NarrativeSequenceV1[];
  conversationIds?: StableId[];
}

export type MissionFlowNodeV1 =
  | {
    kind: 'conversation';
    nodeId: StableId;
    conversationId: StableId;
    outcomes: Record<StableId, StableId>;
    defaultNextNodeId?: StableId;
  }
  | {
    kind: 'expedition';
    nodeId: StableId;
    mapId: StableId;
    entrySectorId?: StableId;
    entryLocationId?: StableId;
    mapVariantIds: StableId[];
    outcomes: Record<StableId, StableId>;
  }
  | {
    kind: 'condition';
    nodeId: StableId;
    requirement: RequirementExpressionV1;
    whenTrueNodeId: StableId;
    whenFalseNodeId: StableId;
  }
  | {
    kind: 'terminal';
    nodeId: StableId;
    result: 'success' | 'failure';
  };

export interface MissionFlowV1 extends VersionedContractV1 {
  initialNodeId: StableId;
  nodes: MissionFlowNodeV1[];
}

export interface AdventureMissionManifestEntryV1 extends VersionedContractV1 {
  missionId: StableId;
  mapId: StableId;
  documentPath: string;
}

export interface AdventureMissionManifestV1 extends VersionedContractV1 {
  missions: AdventureMissionManifestEntryV1[];
}

export interface AdventureMapManifestEntryV1 extends VersionedContractV1 {
  mapId: StableId;
  title: string;
  documentPath: string;
  sectors: Array<{ sectorId: StableId; label: string }>;
}

export interface AdventureMapManifestV1 extends VersionedContractV1 {
  maps: AdventureMapManifestEntryV1[];
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

export type MapSequenceActionV1 =
  | CompanionSequenceActionV1
  | {
    kind: 'movePath';
    actorRef: StableId;
    pathId: StableId;
    movementStyle: AmbientMovementStyle;
    speedPixelsPerSecond: number;
    animation?: string;
    reverse?: boolean;
  }
  | {
    kind: 'spawnProjectile';
    actorRef: CompanionSequenceActorRef;
    effectAssetId: StableId;
    direction: 'actorFacing' | 'towardsPlayer' | 'up' | 'down' | 'left' | 'right';
    speedPixelsPerSecond: number;
    lifetimeMs: number;
    collisionMask?: Array<'terrain' | 'player' | 'actors'>;
    hitSequenceId?: StableId;
    missSequenceId?: StableId;
    consequence?: HazardConsequenceV1;
  }
  | {
    kind: 'charge';
    actorRef: CompanionSequenceActorRef;
    targetRef: CompanionSequenceActorRef;
    speedPixelsPerSecond: number;
    maximumTiles?: number;
    cooldownMs?: number;
    hitSequenceId?: StableId;
    missSequenceId?: StableId;
    consequence?: HazardConsequenceV1;
  }
  | {
    kind: 'push';
    /** Actor que recibe el empujón. */
    actorRef: CompanionSequenceActorRef;
    /** Origen usado al calcular `sourceToTarget`. */
    sourceRef?: CompanionSequenceActorRef;
    direction: 'sourceToTarget' | 'up' | 'down' | 'left' | 'right';
    tiles: number;
  }
  | {
    kind: 'playAudio';
    audioAssetId: StableId;
    channel?: 'effect' | 'music';
    volume?: number;
    loop?: boolean;
    fadeInMs?: number;
  }
  | {
    kind: 'stopAudio';
    channel?: 'effect' | 'music' | 'all';
    audioAssetId?: StableId;
    fadeOutMs?: number;
  }
  | { kind: 'setPlayerAppearance'; appearanceId: StableId }
  | { kind: 'restorePlayerAppearance' }
  | {
    kind: 'moveToLocation';
    actorRef: CompanionSequenceActorRef;
    locationId: StableId;
    sectorId?: StableId;
    fadeMs?: number;
  }
  | { kind: 'applyHazardConsequence'; consequence: HazardConsequenceV1 }
  | { kind: 'openNarrative'; sequenceId: StableId }
  | { kind: 'emitMissionOutcome'; outcomeId: StableId };

export interface MapSequenceBeatV1 extends VersionedContractV1 {
  beatId: StableId;
  actions: MapSequenceActionV1[];
  pauseAfterMs?: number;
}

export interface MapSequenceV1 extends VersionedContractV1 {
  sequenceId: StableId;
  roomId: StableId;
  beats: MapSequenceBeatV1[];
}

export type MapEventSpatialTargetV1 =
  | { kind: 'zone'; zoneId: StableId }
  | { kind: 'placement'; placementId: StableId };

export type MapEventActivationV1 =
  | { kind: 'enterZone'; zoneId: StableId }
  | {
    kind: 'contextAction';
    target: MapEventSpatialTargetV1;
    prompt: string;
    rangeTiles?: number;
  }
  | {
    kind: 'proximity';
    target: MapEventSpatialTargetV1;
    rangeTiles: number;
  }
  | {
    kind: 'interval';
    initialDelayMs?: number;
    intervalMs: number;
    activeZoneId?: StableId;
  }
  | {
    kind: 'pathCrossing';
    pathId: StableId;
    corridorTiles?: number;
  }
  | {
    kind: 'actorContact';
    placementId: StableId;
  }
  | {
    kind: 'enterSurface';
    surfaceType: TerrainSurfaceType;
    terrainAreaId?: StableId;
  };

export type HazardDestinationV1 =
  | { kind: 'nearestSafeSurface'; surfaceTypes?: TerrainSurfaceType[] }
  | { kind: 'location'; locationId: StableId; sectorId?: StableId }
  | { kind: 'sectorEntry'; sectorId?: StableId };

export interface HazardConsequenceV1 extends VersionedContractV1 {
  outcome: HazardOutcome;
  rollbackPolicy: HazardRollbackPolicy;
  destination: HazardDestinationV1;
  fadeOutMs?: number;
  fadeInMs?: number;
  invulnerabilityMs?: number;
  failureNarrativeSequenceId?: StableId;
}

export interface MapEventResultingActorStateV1 extends VersionedContractV1 {
  placementId: StableId;
  position?:
    | { kind: 'anchor'; anchorId: StableId }
    | { kind: 'pathEnd'; pathId: StableId };
  animation?: string;
  direction?: 'up' | 'down' | 'left' | 'right';
  visible?: boolean;
}

export interface MapEventTriggerV1 extends VersionedContractV1 {
  triggerId: StableId;
  roomId: StableId;
  activation: MapEventActivationV1;
  requirement: RequirementExpressionV1;
  sequenceId: StableId;
  failureSequenceId?: StableId;
  repeatPolicy?: MapEventRepeatPolicy;
  resultingActorStates: MapEventResultingActorStateV1[];
  rewardOriginId?: StableId;
  rewardPackageId?: StableId;
  rewards?: RewardDefinitionV1[];
  completionEffects?: {
    unlockSecretIds?: StableId[];
  };
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
