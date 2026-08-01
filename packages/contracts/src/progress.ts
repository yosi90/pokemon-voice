import type {
  ISODateString,
  JsonValue,
  PokemonFormId,
  PokemonSpeciesId,
  StableId,
  VersionedContractV1,
} from './common.js';
import type { PermanentAchievementRecordV1 } from './achievements.js';
import type { InventoryStateV1, PurchaseRecordV1, RewardDefinitionV1 } from './economy.js';
import type { SpeciesResearchProgressV1 } from './research.js';
import type { NarrativeProgressV1, PokeDiscoverIntroductionStateV1 } from './narrative.js';
import type { TrainerProfileV1 } from './narrative.js';
import type { ExpressionInputMethod } from './adventure.js';
import { MEANINGFUL_EXPEDITION_INTERACTION_KINDS } from './adventureVocabulary.js';

export interface CompanionSelectionV1 extends VersionedContractV1 {
  formId: PokemonFormId;
  appearanceId?: StableId;
}

export interface PokedexRunStateV1 extends VersionedContractV1 {
  runId: StableId;
  startedAt: ISODateString;
  sourceModeId?: StableId;
  registeredSpeciesIds: PokemonSpeciesId[];
  discoveryOrder: PokemonSpeciesId[];
  attempts: number;
  failures: number;
  currentStreak: number;
  bestStreak: number;
  temporaryCounters: Record<StableId, number>;
  selectedCompanion?: CompanionSelectionV1;
  /** Compatibilidad de lectura con partidas anteriores a las variantes seleccionables. */
  selectedCompanionFormId?: PokemonFormId;
  satisfiedAchievementIds: StableId[];
}

export interface RewardLedgerEntryV1 extends VersionedContractV1 {
  originId: StableId;
  claimedAt: ISODateString;
  rewards: RewardDefinitionV1[];
  runId?: StableId;
  missionId?: StableId;
  mapId?: StableId;
}

export interface CompanionAccessRecordV1 extends VersionedContractV1 {
  speciesId: PokemonSpeciesId;
  formId?: PokemonFormId;
  appearanceId?: StableId;
  qualificationId: StableId;
  qualifiedAt: ISODateString;
  originRunId?: StableId;
}

export interface FormDiscoveryRecordV1 extends VersionedContractV1 {
  formId: PokemonFormId;
  speciesId: PokemonSpeciesId;
  discoveredAt: ISODateString;
  noteIds: StableId[];
  originMapId?: StableId;
  originMissionId?: StableId;
  originEncounterId?: StableId;
}

export interface AppearanceDiscoveryRecordV1 extends VersionedContractV1 {
  appearanceId: StableId;
  formId: PokemonFormId;
  speciesId: PokemonSpeciesId;
  discoveredAt: ISODateString;
  noteIds: StableId[];
  originMapId?: StableId;
  originMissionId?: StableId;
  originEncounterId?: StableId;
}

export interface AdventureMapProgressV1 extends VersionedContractV1 {
  mapId: StableId;
  freeExpeditionUnlocked: boolean;
  completedMissionIds: StableId[];
  unlockedSecretIds: StableId[];
  knownNpcIds: StableId[];
  conversationIds: StableId[];
  collectibleIds: StableId[];
  knownHintIds: StableId[];
  unlockedRouteIds: StableId[];
  eligibleEncounterVisits: Record<StableId, number>;
  activeVariantIds: StableId[];
  /** Encuentros añadidos después de publicar el mapa mediante eventos globales. */
  injectedEncounterIds?: StableId[];
  /** Escenas de acompañante que no deben repetirse en visitas futuras. */
  completedBehaviorTriggerIds?: StableId[];
  /** Eventos del mapa cuya política los conserva entre visitas. */
  completedMapEventTriggerIds?: StableId[];
  /** No almacena audio ni transcripciones, solo el método de la primera resolución. */
  resolvedExpressionTriggers?: Record<StableId, ExpressionResolutionRecordV1>;
}

export interface ExpressionResolutionRecordV1 extends VersionedContractV1 {
  triggerId: StableId;
  method: ExpressionInputMethod;
  resolvedAt: ISODateString;
}

export type AnomalyResearchStatus = 'clueFound' | 'sighted' | 'resolved';

export interface AnomalyResearchProgressV1 extends VersionedContractV1 {
  anomalyId: StableId;
  status: AnomalyResearchStatus;
  discoveredClueIds: StableId[];
  firstClueAt: ISODateString;
  sightedAt?: ISODateString;
  resolvedAt?: ISODateString;
}

export interface ModeProgressV1 {
  modeId: StableId;
  completed: boolean;
  completionCount: number;
  bestScore?: number;
  lastScore?: number;
  lastCompletedAt?: ISODateString;
  /** Subretos permanentes ya superados dentro de un modo compuesto. */
  completedChallengeIds?: StableId[];
  /** Fecha civil local (AAAA-MM-DD) del último desafío diario cobrado. */
  lastDailyCompletedOn?: string;
  lastDailyChallengeId?: StableId;
  dailyStreak?: number;
  bestDailyStreak?: number;
}

export interface PokeDiscoverStateV1 extends VersionedContractV1 {
  introduction: PokeDiscoverIntroductionStateV1;
  narrativeProgress: NarrativeProgressV1;
  trainerProfile?: TrainerProfileV1;
  trainerLevel: number;
  trainerExperience: number;
  discoveryPoints: number;
  sightings: PokemonSpeciesId[];
  discoveredForms: Record<PokemonFormId, FormDiscoveryRecordV1>;
  discoveredAppearances: Record<StableId, AppearanceDiscoveryRecordV1>;
  researchBySpecies: Record<PokemonSpeciesId, SpeciesResearchProgressV1>;
  /** Investigación persistente que nunca crea una entrada de especie en la Pokédex. */
  anomalies?: Record<StableId, AnomalyResearchProgressV1>;
  mapProgress: Record<StableId, AdventureMapProgressV1>;
  /** Opcional únicamente al leer guardados anteriores a los eventos del Hito 8. */
  activatedWorldEventIds?: StableId[];
  worldFlags: Record<StableId, JsonValue>;
  globalCounters: Record<StableId, number>;
  inventory: InventoryStateV1;
  /** Opcional únicamente al leer guardados anteriores a la tienda del Hito 9. */
  purchaseLedger?: Record<StableId, PurchaseRecordV1>;
  achievements: Record<StableId, PermanentAchievementRecordV1>;
  companionQualifications: CompanionAccessRecordV1[];
  modeProgress: Record<StableId, ModeProgressV1>;
  rewardLedger: Record<StableId, RewardLedgerEntryV1>;
  /** Fuente de verdad para cada misión activa y su checkpoint independiente. */
  missionProgressById: Record<StableId, MissionProgressV1>;
  /** @deprecated Proyección compatible derivada de missionProgressById. */
  activeMissionIds: StableId[];
  cosmeticPreferences: Record<StableId, StableId>;
}

export interface PokeVoicePreferencesV1 extends VersionedContractV1 {
  activeGenerationId?: number;
  /** Compatibilidad temporal con el selector múltiple anterior al dashboard. */
  selectedGenerationIds: number[];
  cardSize: number;
}

export interface ActiveModeSessionV1 extends VersionedContractV1 {
  modeId: StableId;
  runId: StableId;
  startedAt: ISODateString;
  durationSec: number;
  /** Presente en sesiones nuevas; opcional para cargar partidas V1 anteriores. */
  satisfiedAchievementIds?: StableId[];
  /** Estadísticas opcionales para recuperar sesiones creadas antes de esta ampliación V1. */
  attempts?: number;
  failures?: number;
  currentStreak?: number;
  bestStreak?: number;
  voiceDiscoveries?: number;
  textDiscoveries?: number;
  /** Run normal suspendida mientras un modo usa una Pokédex temporal aislada. */
  suspendedPokedexRun?: PokedexRunStateV1;
}

export interface ExpeditionLoadoutV1 extends VersionedContractV1 {
  companion: CompanionSelectionV1;
  toolId?: StableId;
}

export { MEANINGFUL_EXPEDITION_INTERACTION_KINDS };

export type MeaningfulExpeditionInteractionKind =
  typeof MEANINGFUL_EXPEDITION_INTERACTION_KINDS[number];

export interface MissionRuntimeStateV1 extends VersionedContractV1 {
  missionId: StableId;
  checkpointId: StableId;
  flags: Record<StableId, JsonValue>;
  counters: Record<StableId, number>;
  resolvedActorIds: StableId[];
  flowNodeId?: StableId;
  conversationCheckpoint?: import('./narrative.js').ActiveNarrativeConversationV1;
  executedFlowEffectIds?: StableId[];
}

export interface MissionProgressV1 extends MissionRuntimeStateV1 {
  startedAt: ISODateString;
  updatedAt: ISODateString;
  lastExpeditionNodeId?: StableId;
}

export type PendingMissionLaunchCheckpoint =
  | 'awaitingCompanion'
  | 'openingCinematic'
  | 'awaitingStarter'
  | 'ready';

export interface PendingMissionLaunchV1 extends VersionedContractV1 {
  missionId: StableId;
  checkpoint: PendingMissionLaunchCheckpoint;
  offeredAt: ISODateString;
}

export interface ExpeditionEntrySnapshotV1 extends VersionedContractV1 {
  secretIds: StableId[];
  npcIds: StableId[];
  conversationIds: StableId[];
  collectibleIds: StableId[];
  hintIds: StableId[];
  routeIds: StableId[];
  researchFactIds: StableId[];
  trainerExperience: number;
  discoveryPoints: number;
}

/**
 * Estado jugable reversible. El perfil del entrenador y las preferencias se
 * excluyen deliberadamente: una consecuencia nunca cambia identidad ni ajustes.
 */
export interface ExpeditionRollbackSnapshotV1 extends VersionedContractV1 {
  pokedexRun: PokedexRunStateV1;
  pokeDiscover: Omit<PokeDiscoverStateV1, 'trainerProfile'>;
}

export interface ActiveExpeditionSectorVisitV1 extends VersionedContractV1 {
  sectorId: StableId;
  /** Eventos que sólo deben repetirse después de abandonar este sector. */
  completedMapEventTriggerIds: StableId[];
  /** Estado estable capturado después de inicializar el sector. */
  rollbackSnapshot?: ExpeditionRollbackSnapshotV1;
}

export interface ActiveExpeditionSessionV1 extends VersionedContractV1 {
  mapId: StableId;
  enteredAt: ISODateString;
  missionId?: StableId;
  /** Presente en todas las expediciones nuevas y bloqueado hasta abandonar el mapa. */
  loadout?: ExpeditionLoadoutV1;
  /** Compatibilidad de lectura con el contrato provisional anterior al Hito 8. */
  companionFormId?: PokemonFormId;
  /** Compatibilidad de lectura con el contrato provisional anterior al Hito 8. */
  toolId?: StableId;
  /** Resultado estable de cada encuentro evaluado durante esta visita. */
  evaluatedEncounterResults?: Record<StableId, boolean>;
  /** Escenas limitadas a una ejecución durante esta visita. */
  completedBehaviorTriggerIds?: StableId[];
  /** Eventos del mapa limitados a esta visita, conservados entre sectores y recargas. */
  completedMapEventTriggerIds?: StableId[];
  /** Estado efímero de la estancia actual, conservado al recargar. */
  activeSectorVisit?: ActiveExpeditionSectorVisitV1;
  /** Interacciones útiles únicas realizadas durante esta visita. */
  meaningfulInteractionIds?: StableId[];
  meaningfulInteractionKinds?: MeaningfulExpeditionInteractionKind[];
  missionRuntime?: MissionRuntimeStateV1;
  /** Base mínima para construir el informe de regreso sin guardar eventos duplicados. */
  entrySnapshot?: ExpeditionEntrySnapshotV1;
  /** Estado jugable completo al comenzar el intento de misión. */
  entryRollbackSnapshot?: ExpeditionRollbackSnapshotV1;
}

/** Raíz transaccional del guardado local. Las cachés de catálogo y audio no forman parte de ella. */
export interface PokeVoiceSaveV1 extends VersionedContractV1 {
  pokedexRun: PokedexRunStateV1;
  pokeDiscover: PokeDiscoverStateV1;
  preferences: PokeVoicePreferencesV1;
  activeModeSession?: ActiveModeSessionV1;
  activeExpeditionSession?: ActiveExpeditionSessionV1;
  pendingMissionLaunch?: PendingMissionLaunchV1;
}
