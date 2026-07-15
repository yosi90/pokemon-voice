import type {
  ISODateString,
  JsonValue,
  PokemonFormId,
  PokemonSpeciesId,
  StableId,
  VersionedContractV1,
} from './common.js';
import type { PermanentAchievementRecordV1 } from './achievements.js';
import type { InventoryStateV1, RewardDefinitionV1 } from './economy.js';
import type { SpeciesResearchProgressV1 } from './research.js';

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
}

export interface ModeProgressV1 {
  modeId: StableId;
  completed: boolean;
  completionCount: number;
  bestScore?: number;
}

export interface PokeDiscoverStateV1 extends VersionedContractV1 {
  trainerLevel: number;
  trainerExperience: number;
  discoveryPoints: number;
  sightings: PokemonSpeciesId[];
  discoveredForms: Record<PokemonFormId, FormDiscoveryRecordV1>;
  discoveredAppearances: Record<StableId, AppearanceDiscoveryRecordV1>;
  researchBySpecies: Record<PokemonSpeciesId, SpeciesResearchProgressV1>;
  mapProgress: Record<StableId, AdventureMapProgressV1>;
  worldFlags: Record<StableId, JsonValue>;
  globalCounters: Record<StableId, number>;
  inventory: InventoryStateV1;
  achievements: Record<StableId, PermanentAchievementRecordV1>;
  companionQualifications: CompanionAccessRecordV1[];
  modeProgress: Record<StableId, ModeProgressV1>;
  rewardLedger: Record<StableId, RewardLedgerEntryV1>;
  activeMissionIds: StableId[];
  cosmeticPreferences: Record<StableId, StableId>;
}

export interface PokeVoicePreferencesV1 extends VersionedContractV1 {
  selectedGenerationIds: number[];
  cardSize: number;
}

export interface ActiveModeSessionV1 extends VersionedContractV1 {
  modeId: StableId;
  runId: StableId;
  startedAt: ISODateString;
  durationSec: number;
}

export interface ActiveExpeditionSessionV1 extends VersionedContractV1 {
  mapId: StableId;
  enteredAt: ISODateString;
  missionId?: StableId;
  companionFormId?: PokemonFormId;
  toolId?: StableId;
}

/** Raíz transaccional del guardado local. Las cachés de catálogo y audio no forman parte de ella. */
export interface PokeVoiceSaveV1 extends VersionedContractV1 {
  pokedexRun: PokedexRunStateV1;
  pokeDiscover: PokeDiscoverStateV1;
  preferences: PokeVoicePreferencesV1;
  activeModeSession?: ActiveModeSessionV1;
  activeExpeditionSession?: ActiveExpeditionSessionV1;
}
