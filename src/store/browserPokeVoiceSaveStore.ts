import type {
  ActiveModeSessionV1,
  ActiveExpeditionSessionV1,
  PermanentAchievementRecordV1,
  PokedexRunStateV1,
  PokeDiscoverStateV1,
  PokeVoicePreferencesV1,
  PokeVoiceSaveV1,
} from '../../packages/contracts/src/index.js';
import { LS_CARD_SCALE, LS_GENS, LS_KEY } from '../../scripts/utils.js';
import type { AchievementRecord } from '../domain/achievements/achievementProgress.js';
import {
  claimPokeDiscoverRewards,
  type RewardClaimRequest,
  type RewardClaimResult,
} from '../domain/progress/rewardLedger.js';
import {
  POKE_VOICE_SAVE_KEY,
  createPokedexRunStateV1,
  splitLegacyEasterEggState,
} from '../domain/progress/pokeVoiceSave.js';
import { TIMER_KEY } from '../lib/constants.js';
import {
  EASTER_EGG_STORAGE_KEY,
  LEGACY_ACHIEVEMENT_STORAGE_KEY,
  loadOrMigratePokeVoiceSave,
  parsePokeVoiceSave,
} from '../services/pokeVoiceSaveStorage.js';

let save: PokeVoiceSaveV1 | null = null;
let serializedSave: string | null = null;

function readCurrentSave() {
  const raw = localStorage.getItem(POKE_VOICE_SAVE_KEY);
  if (save && raw === serializedSave) return save;
  save = parsePokeVoiceSave(raw)
    ?? loadOrMigratePokeVoiceSave({ storage: localStorage }).save;
  serializedSave = JSON.stringify(save);
  return save;
}

function persist(next: PokeVoiceSaveV1) {
  save = next;
  serializedSave = JSON.stringify(next);
  localStorage.setItem(POKE_VOICE_SAVE_KEY, serializedSave);
}

export function getBrowserPokeVoiceSave() {
  return readCurrentSave();
}

export function getBrowserLegacyEasterEggState() {
  const current = readCurrentSave();
  return {
    meowthCoins: current.pokeDiscover.globalCounters.meowthCoins ?? 0,
    gimmighoulCoins: current.pokeDiscover.globalCounters.gimmighoulCoins ?? 0,
    unownMessage: '',
    palafinPending: false,
    ...current.pokeDiscover.worldFlags,
  };
}

export function updateBrowserPokedexRun(
  updater: (current: PokedexRunStateV1) => PokedexRunStateV1,
) {
  const current = readCurrentSave();
  persist({ ...current, pokedexRun: updater(current.pokedexRun) });
}

export function updateBrowserPokeDiscover(
  updater: (current: PokeDiscoverStateV1) => PokeDiscoverStateV1,
) {
  const current = readCurrentSave();
  persist({ ...current, pokeDiscover: updater(current.pokeDiscover) });
}

export function updateBrowserPreferences(
  updater: (current: PokeVoicePreferencesV1) => PokeVoicePreferencesV1,
) {
  const current = readCurrentSave();
  persist({ ...current, preferences: updater(current.preferences) });
}

export function startNewPokedexRun({
  runId = typeof globalThis.crypto?.randomUUID === 'function'
    ? `pokedex-run:${globalThis.crypto.randomUUID()}`
    : `pokedex-run:${Date.now()}:${Math.random().toString(36).slice(2)}`,
  sourceModeId,
  startedAt = Date.now(),
}: {
  runId?: string;
  sourceModeId?: string;
  startedAt?: number;
}) {
  const current = readCurrentSave();
  if (current.activeExpeditionSession) {
    throw new Error('No se puede iniciar una nueva run durante una expedición activa.');
  }
  persist({
    ...current,
    pokedexRun: createPokedexRunStateV1({
      runId,
      startedAt: new Date(startedAt).toISOString(),
      ...(sourceModeId ? { sourceModeId } : {}),
    }),
    activeModeSession: undefined,
  });
  return runId;
}

export function setBrowserActiveModeSession(session: ActiveModeSessionV1 | undefined) {
  const current = readCurrentSave();
  persist({ ...current, activeModeSession: session });
}

export function setBrowserActiveExpeditionSession(session: ActiveExpeditionSessionV1 | undefined) {
  const current = readCurrentSave();
  persist({ ...current, activeExpeditionSession: session });
}

export function syncBrowserLegacyEasterEggState(legacyState: unknown) {
  const migrated = splitLegacyEasterEggState(legacyState);
  updateBrowserPokeDiscover(current => ({
    ...current,
    worldFlags: { ...current.worldFlags, ...migrated.worldFlags },
    globalCounters: { ...current.globalCounters, ...migrated.globalCounters },
  }));
}

export function syncBrowserAchievements(records: readonly AchievementRecord[]) {
  const achievements: Record<string, PermanentAchievementRecordV1> = {};
  for (const record of records) {
    achievements[record.id] = {
      schemaVersion: 1,
      achievementId: record.id,
      unlockedAt: new Date(record.date).toISOString(),
      ...(record.domain ? { domain: record.domain } : {}),
      ...(record.originRunId ? { originRunId: record.originRunId } : {}),
    };
  }
  updateBrowserPokeDiscover(current => ({ ...current, achievements }));
}

export function claimBrowserPokeDiscoverRewards(request: RewardClaimRequest): RewardClaimResult {
  const current = readCurrentSave();
  const result = claimPokeDiscoverRewards(current.pokeDiscover, request);
  if (result.status === 'claimed') {
    persist({ ...current, pokeDiscover: result.state });
  }
  return result;
}

export function deleteAllBrowserPokeVoiceData() {
  const keys = [
    POKE_VOICE_SAVE_KEY,
    LS_KEY,
    LS_GENS,
    LS_CARD_SCALE,
    EASTER_EGG_STORAGE_KEY,
    TIMER_KEY,
  ];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key === LEGACY_ACHIEVEMENT_STORAGE_KEY || key?.startsWith('pokevoice-achievements')) {
      keys.push(key);
    }
  }
  for (const key of new Set(keys)) localStorage.removeItem(key);
  save = null;
  serializedSave = null;
}
