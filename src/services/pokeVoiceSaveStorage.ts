import { LS_CARD_SCALE, LS_GENS, LS_KEY } from '../../scripts/utils.js';
import type { PokeVoiceSaveV1 } from '../../packages/contracts/src/index.js';
import {
  POKE_VOICE_SAVE_KEY,
  createPokeVoiceSaveV1,
  type LegacyTimedModeSnapshot,
} from '../domain/progress/pokeVoiceSave.js';
import { TIMER_KEY } from '../lib/constants.js';
import type { LegacyAchievementSnapshot } from '../domain/progress/pokeVoiceSave.js';
import { normalizeTrainerProgress } from '../domain/trainer/trainerLevel.js';
import {
  normalizeNarrativeProgress,
  normalizeProfessorIntroduction,
  normalizeTrainerProfile,
} from '../domain/narrative/professorIntroduction.js';

export const EASTER_EGG_STORAGE_KEY = 'pokevoice-easter-eggs-v1';
export const LEGACY_ACHIEVEMENT_STORAGE_KEY = 'pokevoice-achievements-v1';

export interface PokeVoiceSaveStorageResult {
  save: PokeVoiceSaveV1;
  source: 'current' | 'legacy';
}

interface StorageDependencies {
  storage: Pick<Storage, 'getItem' | 'setItem'>;
  now?: () => number;
  createRunId?: () => string;
}

function parseJson(raw: string | null): unknown {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function parsePokeVoiceSave(raw: string | null): PokeVoiceSaveV1 | null {
  const value = parseJson(raw);
  if (!isRecord(value)
    || value.schemaVersion !== 1
    || !isRecord(value.pokedexRun)
    || value.pokedexRun.schemaVersion !== 1
    || typeof value.pokedexRun.runId !== 'string'
    || !Array.isArray(value.pokedexRun.registeredSpeciesIds)
    || !isRecord(value.pokeDiscover)
    || value.pokeDiscover.schemaVersion !== 1
    || !isRecord(value.pokeDiscover.achievements)
    || !isRecord(value.preferences)
    || value.preferences.schemaVersion !== 1
    || !Array.isArray(value.preferences.selectedGenerationIds)) {
    return null;
  }
  const save = value as unknown as PokeVoiceSaveV1;
  const trainerProfile = normalizeTrainerProfile(save.pokeDiscover.trainerProfile);
  const { trainerProfile: _storedTrainerProfile, ...pokeDiscoverWithoutTrainerProfile } = save.pokeDiscover;
  return {
    ...save,
    pokeDiscover: {
      ...pokeDiscoverWithoutTrainerProfile,
      introduction: normalizeProfessorIntroduction(save.pokeDiscover.introduction),
      narrativeProgress: normalizeNarrativeProgress(save.pokeDiscover.narrativeProgress),
      ...(trainerProfile ? { trainerProfile } : {}),
      ...normalizeTrainerProgress(save.pokeDiscover.trainerExperience),
    },
  };
}

function parseTimedMode(raw: string | null): LegacyTimedModeSnapshot | null {
  const value = parseJson(raw);
  if (!isRecord(value)) return null;
  const startedAt = Number(value.startedAt);
  const durationSec = Number(value.durationSec);
  if (!Number.isFinite(startedAt) || !Number.isFinite(durationSec) || durationSec <= 0) return null;
  return { startedAt, durationSec };
}

function parseLegacyAchievements(raw: string | null, fallbackDate: number): LegacyAchievementSnapshot[] {
  const value = parseJson(raw);
  if (!Array.isArray(value)) return [];
  return value.flatMap(candidate => {
    if (!isRecord(candidate) || typeof candidate.id !== 'string' || !candidate.id.trim()) return [];
    const date = Number(candidate.date);
    return [{
      id: candidate.id,
      date: Number.isFinite(date) ? date : fallbackDate,
      ...(typeof candidate.domain === 'string' ? { domain: candidate.domain as LegacyAchievementSnapshot['domain'] } : {}),
      ...(typeof candidate.originRunId === 'string' && candidate.originRunId
        ? { originRunId: candidate.originRunId }
        : {}),
    }];
  });
}

function defaultRunId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `pokedex-run:${globalThis.crypto.randomUUID()}`;
  }
  return `pokedex-run:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

/**
 * Crea una única raíz versionada sin borrar ni modificar las claves legacy.
 * Si ya existe una raíz válida, no vuelve a importar datos antiguos.
 */
export function loadOrMigratePokeVoiceSave({
  storage,
  now = Date.now,
  createRunId = defaultRunId,
}: StorageDependencies): PokeVoiceSaveStorageResult {
  const currentRaw = storage.getItem(POKE_VOICE_SAVE_KEY);
  const current = parsePokeVoiceSave(currentRaw);
  if (current) {
    const normalized = JSON.stringify(current);
    if (normalized !== currentRaw) storage.setItem(POKE_VOICE_SAVE_KEY, normalized);
    return { save: current, source: 'current' };
  }

  const timestamp = now();
  const save = createPokeVoiceSaveV1({
    runId: createRunId(),
    now: timestamp,
    legacy: {
      registeredSpeciesIds: parseJson(storage.getItem(LS_KEY)),
      selectedGenerationIds: parseJson(storage.getItem(LS_GENS)),
      cardSize: storage.getItem(LS_CARD_SCALE),
      achievements: parseLegacyAchievements(
        storage.getItem(LEGACY_ACHIEVEMENT_STORAGE_KEY),
        timestamp,
      ),
      easterEggState: parseJson(storage.getItem(EASTER_EGG_STORAGE_KEY)),
      timedMode: parseTimedMode(storage.getItem(TIMER_KEY)),
    },
  });
  storage.setItem(POKE_VOICE_SAVE_KEY, JSON.stringify(save));
  return { save, source: 'legacy' };
}

export function createBrowserPokeVoiceSaveStorage() {
  return {
    loadOrMigrate() {
      return loadOrMigratePokeVoiceSave({ storage: localStorage });
    },
  };
}
