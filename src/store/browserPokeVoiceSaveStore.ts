import type {
  ActiveModeSessionV1,
  ActiveExpeditionSessionV1,
  PermanentAchievementRecordV1,
  PokedexRunStateV1,
  PokeDiscoverStateV1,
  PokeVoicePreferencesV1,
  PokeVoiceSaveV1,
  ResearchFactV1,
} from '../../packages/contracts/src/index.js';
import { LS_CARD_SCALE, LS_GENS, LS_KEY } from '../../scripts/utils.js';
import type { AchievementRecord } from '../domain/achievements/achievementProgress.js';
import type { PokemonCatalogRecord } from '../domain/catalog/pokemonCatalogModel.js';
import {
  createCompanionCatalogSpecies,
  type CompanionCandidate,
} from '../domain/companions/companionCandidates.js';
import { selectCompanion } from '../domain/companions/companionEligibility.js';
import {
  claimPokeDiscoverRewards,
  type RewardClaimRequest,
  type RewardClaimResult,
} from '../domain/progress/rewardLedger.js';
import {
  discoverResearchFact,
  type DiscoverResearchFactContext,
} from '../domain/research/researchProgress.js';
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

export function selectBrowserCompanion(
  candidate: CompanionCandidate,
  catalog: readonly PokemonCatalogRecord[],
  selectedAt = new Date().toISOString(),
) {
  const current = readCurrentSave();
  const result = selectCompanion({
    save: current,
    definition: candidate.requirement,
    form: candidate.form,
    species: catalog.map(createCompanionCatalogSpecies),
    selectedAt,
  });
  if (result.status === 'selected') persist(result.save);
  return result;
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

export function startBrowserIsolatedModeSession(
  session: Omit<ActiveModeSessionV1, 'suspendedPokedexRun'>,
) {
  const current = readCurrentSave();
  if (current.activeExpeditionSession) {
    throw new Error('No se puede iniciar un modo aislado durante una expedición activa.');
  }
  const temporaryRun = createPokedexRunStateV1({
    runId: session.runId,
    startedAt: session.startedAt,
    sourceModeId: session.modeId,
  });
  persist({
    ...current,
    pokedexRun: temporaryRun,
    activeModeSession: {
      ...session,
      suspendedPokedexRun: current.pokedexRun,
    },
  });
  return temporaryRun;
}

export function setBrowserActiveModeSession(session: ActiveModeSessionV1 | undefined) {
  const current = readCurrentSave();
  persist({ ...current, activeModeSession: session });
}

export function updateBrowserActiveModeSession(
  updater: (current: ActiveModeSessionV1) => ActiveModeSessionV1,
) {
  const current = readCurrentSave();
  if (!current.activeModeSession) return;
  persist({ ...current, activeModeSession: updater(current.activeModeSession) });
}

export function completeBrowserMode(modeId: string, score: number, completedAt = new Date().toISOString()) {
  const current = readCurrentSave();
  const previous = current.pokeDiscover.modeProgress[modeId];
  const progress = {
    modeId,
    completed: true,
    completionCount: (previous?.completionCount ?? 0) + 1,
    bestScore: Math.max(previous?.bestScore ?? 0, score),
    lastScore: score,
    lastCompletedAt: completedAt,
  };
  persist({
    ...current,
    pokeDiscover: {
      ...current.pokeDiscover,
      modeProgress: { ...current.pokeDiscover.modeProgress, [modeId]: progress },
    },
  });
  return progress;
}

export function completeBrowserIsolatedMode(
  modeId: string,
  score: number,
  completedAt = new Date().toISOString(),
) {
  const current = readCurrentSave();
  const session = current.activeModeSession;
  if (!session || session.modeId !== modeId) {
    throw new Error(`No hay una sesión aislada activa para ${modeId}.`);
  }
  const previous = current.pokeDiscover.modeProgress[modeId];
  const progress = {
    ...previous,
    modeId,
    completed: true,
    completionCount: (previous?.completionCount ?? 0) + 1,
    bestScore: Math.max(previous?.bestScore ?? 0, score),
    lastScore: score,
    lastCompletedAt: completedAt,
  };
  const restoredRun = session.suspendedPokedexRun ?? current.pokedexRun;
  persist({
    ...current,
    pokedexRun: restoredRun,
    pokeDiscover: {
      ...current.pokeDiscover,
      modeProgress: { ...current.pokeDiscover.modeProgress, [modeId]: progress },
    },
    activeModeSession: undefined,
  });
  return { progress, restoredRun };
}

export function completeBrowserThemedChallenge(
  modeId: string,
  challengeId: string,
  score: number,
  completedAt = new Date().toISOString(),
) {
  const current = readCurrentSave();
  const previous = current.pokeDiscover.modeProgress[modeId];
  const completedChallengeIds = [...new Set([
    ...(previous?.completedChallengeIds ?? []),
    challengeId,
  ])];
  const progress = {
    ...previous,
    modeId,
    completed: true,
    completionCount: (previous?.completionCount ?? 0) + 1,
    bestScore: Math.max(previous?.bestScore ?? 0, score),
    lastScore: score,
    lastCompletedAt: completedAt,
    completedChallengeIds,
  };
  persist({
    ...current,
    pokeDiscover: {
      ...current.pokeDiscover,
      modeProgress: { ...current.pokeDiscover.modeProgress, [modeId]: progress },
    },
  });
  return progress;
}

export function completeBrowserDailyChallenge(
  modeId: string,
  dateKey: string,
  challengeId: string,
  score: number,
  previousDateKey: string,
  completedAt = new Date().toISOString(),
) {
  const current = readCurrentSave();
  const previous = current.pokeDiscover.modeProgress[modeId];
  if (previous?.lastDailyCompletedOn && previous.lastDailyCompletedOn >= dateKey) {
    return { progress: previous, awarded: false };
  }
  const dailyStreak = previous?.lastDailyCompletedOn === previousDateKey
    ? (previous.dailyStreak ?? 0) + 1
    : 1;
  const progress = {
    ...previous,
    modeId,
    completed: true,
    completionCount: (previous?.completionCount ?? 0) + 1,
    bestScore: Math.max(previous?.bestScore ?? 0, score),
    lastScore: score,
    lastCompletedAt: completedAt,
    lastDailyCompletedOn: dateKey,
    lastDailyChallengeId: challengeId,
    dailyStreak,
    bestDailyStreak: Math.max(previous?.bestDailyStreak ?? 0, dailyStreak),
  };
  persist({
    ...current,
    pokeDiscover: {
      ...current.pokeDiscover,
      modeProgress: { ...current.pokeDiscover.modeProgress, [modeId]: progress },
    },
  });
  return { progress, awarded: true };
}

export function recordBrowserModeBestScore(modeId: string, score: number) {
  const current = readCurrentSave();
  const previous = current.pokeDiscover.modeProgress[modeId];
  if ((previous?.bestScore ?? 0) >= score) return previous;
  const progress = {
    ...previous,
    modeId,
    completed: previous?.completed ?? false,
    completionCount: previous?.completionCount ?? 0,
    bestScore: score,
  };
  persist({
    ...current,
    pokeDiscover: {
      ...current.pokeDiscover,
      modeProgress: { ...current.pokeDiscover.modeProgress, [modeId]: progress },
    },
  });
  return progress;
}

export function recordBrowserModeAchievement(achievementId: string) {
  const current = readCurrentSave();
  const session = current.activeModeSession;
  if (!session || session.satisfiedAchievementIds?.includes(achievementId)) return;
  persist({
    ...current,
    activeModeSession: {
      ...session,
      satisfiedAchievementIds: [...(session.satisfiedAchievementIds ?? []), achievementId],
    },
  });
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
  const current = readCurrentSave();
  const achievements: Record<string, PermanentAchievementRecordV1> = {
    ...current.pokeDiscover.achievements,
  };
  for (const record of records) {
    achievements[record.id] = {
      schemaVersion: 1,
      achievementId: record.id,
      unlockedAt: new Date(record.date).toISOString(),
      ...(record.domain ? { domain: record.domain } : {}),
      ...(record.originRunId ? { originRunId: record.originRunId } : {}),
      ...(record.originModeId ? { originModeId: record.originModeId } : {}),
    };
  }
  persist({
    ...current,
    pokeDiscover: { ...current.pokeDiscover, achievements },
  });
}

export function claimBrowserPokeDiscoverRewards(request: RewardClaimRequest): RewardClaimResult {
  const current = readCurrentSave();
  const result = claimPokeDiscoverRewards(current.pokeDiscover, request);
  if (result.status === 'claimed') {
    persist({ ...current, pokeDiscover: result.state });
  }
  return result;
}

export function discoverBrowserResearchFact(
  fact: ResearchFactV1,
  context: DiscoverResearchFactContext,
) {
  const current = readCurrentSave();
  const result = discoverResearchFact(current.pokeDiscover, fact, context);
  if (result.status === 'discovered') {
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
