import type {
  AchievementDomain,
  JsonValue,
  PermanentAchievementRecordV1,
  PokedexRunStateV1,
  PokeDiscoverStateV1,
  PokeVoicePreferencesV1,
  PokeVoiceSaveV1,
} from '../../../packages/contracts/src/index.js';
import { TIMED_COLLECTOR_MODE_ID } from '../modes/modeDefinitions.js';

export { TIMED_COLLECTOR_MODE_ID } from '../modes/modeDefinitions.js';

export const POKE_VOICE_SAVE_KEY = 'pokevoice-save-v1';
export const DEFAULT_GENERATION_IDS = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9]);
export const DEFAULT_CARD_SIZE = 128;

const achievementDomains = new Set<AchievementDomain>([
  'pokedex',
  'pokeDiscover',
  'mode',
  'global',
]);

export interface LegacyAchievementSnapshot {
  id: string;
  date: number;
  domain?: AchievementDomain;
  originRunId?: string;
}

export interface LegacyTimedModeSnapshot {
  startedAt: number;
  durationSec: number;
}

export interface LegacyPokeVoiceSnapshot {
  registeredSpeciesIds?: unknown;
  selectedGenerationIds?: unknown;
  cardSize?: unknown;
  achievements?: readonly LegacyAchievementSnapshot[];
  easterEggState?: unknown;
  timedMode?: LegacyTimedModeSnapshot | null;
}

interface CreateSaveOptions {
  runId: string;
  now: number;
  legacy?: LegacyPokeVoiceSnapshot;
}

function toIsoDate(value: number, fallback: number) {
  const date = new Date(Number.isFinite(value) ? value : fallback);
  return Number.isNaN(date.getTime()) ? new Date(fallback).toISOString() : date.toISOString();
}

function uniquePositiveIntegers(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(Number).filter(item => Number.isInteger(item) && item > 0))];
}

function normalizeGenerationIds(value: unknown) {
  const ids = uniquePositiveIntegers(value).filter(id => id <= 9).sort((a, b) => a - b);
  return ids.length ? ids : [...DEFAULT_GENERATION_IDS];
}

function normalizeCardSize(value: unknown) {
  const size = Number(value);
  if (!Number.isFinite(size) || size < 112) return DEFAULT_CARD_SIZE;
  return Math.min(176, Math.max(96, size));
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
    return typeof value !== 'number' || Number.isFinite(value);
  }
  if (Array.isArray(value)) return value.every(isJsonValue);
  return typeof value === 'object'
    && Object.values(value as Record<string, unknown>).every(isJsonValue);
}

export function splitLegacyEasterEggState(value: unknown) {
  const worldFlags: Record<string, JsonValue> = {};
  const globalCounters: Record<string, number> = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { worldFlags, globalCounters };
  }

  for (const [key, candidate] of Object.entries(value as Record<string, unknown>)) {
    if ((key === 'meowthCoins' || key === 'gimmighoulCoins')
      && typeof candidate === 'number' && Number.isFinite(candidate)) {
      globalCounters[key] = candidate;
    } else if (isJsonValue(candidate)) {
      worldFlags[key] = candidate;
    }
  }
  return { worldFlags, globalCounters };
}

function migrateAchievements(
  records: readonly LegacyAchievementSnapshot[],
  fallbackDate: number,
) {
  const migrated: Record<string, PermanentAchievementRecordV1> = {};
  for (const record of records) {
    if (!record || typeof record.id !== 'string' || !record.id.trim()) continue;
    const unlockedAt = toIsoDate(Number(record.date), fallbackDate);
    const current = migrated[record.id];
    if (current && current.unlockedAt <= unlockedAt) continue;
    const domain = achievementDomains.has(record.domain as AchievementDomain)
      ? record.domain
      : undefined;
    migrated[record.id] = {
      schemaVersion: 1,
      achievementId: record.id,
      unlockedAt,
      ...(domain ? { domain } : {}),
      ...(record.originRunId ? { originRunId: record.originRunId } : {}),
    };
  }
  return migrated;
}

export function createPokedexRunStateV1({
  runId,
  startedAt,
  registeredSpeciesIds = [],
  sourceModeId,
}: {
  runId: string;
  startedAt: string;
  registeredSpeciesIds?: number[];
  sourceModeId?: string;
}): PokedexRunStateV1 {
  return {
    schemaVersion: 1,
    runId,
    startedAt,
    ...(sourceModeId ? { sourceModeId } : {}),
    registeredSpeciesIds: [...registeredSpeciesIds],
    discoveryOrder: [...registeredSpeciesIds],
    attempts: 0,
    failures: 0,
    currentStreak: 0,
    bestStreak: 0,
    temporaryCounters: {},
    satisfiedAchievementIds: [],
  };
}

export function createPokeDiscoverStateV1({
  achievements = {},
  worldFlags = {},
  globalCounters = {},
}: Partial<Pick<PokeDiscoverStateV1, 'achievements' | 'worldFlags' | 'globalCounters'>> = {}): PokeDiscoverStateV1 {
  return {
    schemaVersion: 1,
    trainerLevel: 1,
    trainerExperience: 0,
    discoveryPoints: 0,
    sightings: [],
    discoveredForms: {},
    discoveredAppearances: {},
    researchBySpecies: {},
    mapProgress: {},
    worldFlags: { ...worldFlags },
    globalCounters: { ...globalCounters },
    inventory: {
      toolIds: [],
      keyItemIds: [],
      permissionIds: [],
      cosmeticIds: [],
      equippedCosmeticIds: [],
    },
    achievements: { ...achievements },
    companionQualifications: [],
    modeProgress: {},
    rewardLedger: {},
    activeMissionIds: [],
    cosmeticPreferences: {},
  };
}

export function createPokeVoiceSaveV1({ runId, now, legacy = {} }: CreateSaveOptions): PokeVoiceSaveV1 {
  const registeredSpeciesIds = uniquePositiveIntegers(legacy.registeredSpeciesIds);
  const startedAt = toIsoDate(legacy.timedMode?.startedAt ?? now, now);
  const easterEggState = splitLegacyEasterEggState(legacy.easterEggState);
  const preferences: PokeVoicePreferencesV1 = {
    schemaVersion: 1,
    activeGenerationId: normalizeGenerationIds(legacy.selectedGenerationIds)[0] ?? 1,
    selectedGenerationIds: normalizeGenerationIds(legacy.selectedGenerationIds),
    cardSize: normalizeCardSize(legacy.cardSize),
  };
  const timedMode = legacy.timedMode;

  return {
    schemaVersion: 1,
    pokedexRun: createPokedexRunStateV1({
      runId,
      startedAt,
      registeredSpeciesIds,
      ...(timedMode ? { sourceModeId: TIMED_COLLECTOR_MODE_ID } : {}),
    }),
    pokeDiscover: createPokeDiscoverStateV1({
      achievements: migrateAchievements(legacy.achievements ?? [], now),
      ...easterEggState,
    }),
    preferences,
    ...(timedMode ? {
      activeModeSession: {
        schemaVersion: 1,
        modeId: TIMED_COLLECTOR_MODE_ID,
        runId,
        startedAt,
        durationSec: timedMode.durationSec,
        satisfiedAchievementIds: [],
      },
    } : {}),
  };
}
