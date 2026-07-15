import type { AchievementDomain } from '../../packages/contracts/src/index.js';
import type { AchievementRecord } from '../domain/achievements/achievementProgress.js';

export const ACHIEVEMENT_STORAGE_KEY = 'pokevoice-achievements-v1';
const ACHIEVEMENT_STORAGE_PREFIX = 'pokevoice-achievements';
const achievementDomains = new Set<AchievementDomain>([
  'pokedex',
  'pokeDiscover',
  'mode',
  'global',
]);

export function parseAchievementRecords(
  raw: string | null,
  fallbackDate: () => number = Date.now,
): AchievementRecord[] {
  if (!raw) return [];

  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];

    return value.flatMap(candidate => {
      if (!candidate || typeof candidate !== 'object') return [];
      const entry = candidate as Record<string, unknown>;
      if (typeof entry.id !== 'string' || !entry.id.trim()) return [];
      const parsedDate = Number(entry.date);
      const domain = achievementDomains.has(entry.domain as AchievementDomain)
        ? entry.domain as AchievementDomain
        : undefined;

      return [{
        id: entry.id,
        date: Number.isFinite(parsedDate) ? parsedDate : fallbackDate(),
        ...(domain ? { domain } : {}),
        ...(typeof entry.originRunId === 'string' && entry.originRunId
          ? { originRunId: entry.originRunId }
          : {}),
      }];
    });
  } catch {
    return [];
  }
}

export function serializeAchievementRecords(records: readonly AchievementRecord[]) {
  return JSON.stringify(records.map(record => ({
    id: record.id,
    date: record.date,
    ...(record.domain ? { domain: record.domain } : {}),
    ...(record.originRunId ? { originRunId: record.originRunId } : {}),
  })));
}

export function createBrowserAchievementStorage(getStorage: () => Storage) {
  return {
    load() {
      return parseAchievementRecords(getStorage().getItem(ACHIEVEMENT_STORAGE_KEY));
    },

    save(records: readonly AchievementRecord[]) {
      getStorage().setItem(ACHIEVEMENT_STORAGE_KEY, serializeAchievementRecords(records));
    },

    clear() {
      const storage = getStorage();
      const keys: string[] = [];
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key === ACHIEVEMENT_STORAGE_KEY || key?.startsWith(ACHIEVEMENT_STORAGE_PREFIX)) {
          keys.push(key);
        }
      }
      for (const key of keys) storage.removeItem(key);
    },
  };
}
