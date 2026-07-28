import type {
  AdventureMapProgressV1,
  PokeDiscoverStateV1,
} from '../../../packages/contracts/src/index.js';
import {
  FIRST_MISSION_ACHIEVEMENT,
  FIRST_MISSION_STORY_FLAG,
} from '../achievements/pokeDiscoverAchievements.js';

export type MapDiscoveryKind =
  | 'secret'
  | 'npc'
  | 'conversation'
  | 'collectible'
  | 'hint'
  | 'route';

export interface MapProgressUpdateResult {
  status: 'recorded' | 'alreadyRecorded';
  state: PokeDiscoverStateV1;
  mapProgress: AdventureMapProgressV1;
}

export interface CompleteMissionRequest {
  mapId: string;
  missionId: string;
  completedAt: string;
  originRunId?: string;
  unlocksFreeExpedition: boolean;
  /** Solo lo declara el primer encargo de campo real de Alcanfor. */
  grantsFirstMissionAchievement?: boolean;
}

export interface CompleteMissionResult {
  status: 'completed' | 'alreadyCompleted';
  state: PokeDiscoverStateV1;
  mapProgress: AdventureMapProgressV1;
  firstMissionAchievementUnlocked: boolean;
}

const discoveryFields: Record<MapDiscoveryKind, keyof AdventureMapProgressV1> = {
  secret: 'unlockedSecretIds',
  npc: 'knownNpcIds',
  conversation: 'conversationIds',
  collectible: 'collectibleIds',
  hint: 'knownHintIds',
  route: 'unlockedRouteIds',
};

function requireStableId(value: string, label: string) {
  if (!value?.trim()) throw new Error(`${label} debe ser un identificador estable no vacío.`);
}

export function createAdventureMapProgressV1(mapId: string): AdventureMapProgressV1 {
  requireStableId(mapId, 'mapId');
  return {
    schemaVersion: 1,
    mapId,
    freeExpeditionUnlocked: false,
    completedMissionIds: [],
    unlockedSecretIds: [],
    knownNpcIds: [],
    conversationIds: [],
    collectibleIds: [],
    knownHintIds: [],
    unlockedRouteIds: [],
    eligibleEncounterVisits: {},
    activeVariantIds: [],
    injectedEncounterIds: [],
    completedBehaviorTriggerIds: [],
    completedMapEventTriggerIds: [],
    resolvedExpressionTriggers: {},
  };
}

export function getAdventureMapProgress(
  state: PokeDiscoverStateV1,
  mapId: string,
): AdventureMapProgressV1 {
  requireStableId(mapId, 'mapId');
  return state.mapProgress[mapId] ?? createAdventureMapProgressV1(mapId);
}

export function recordMapDiscovery(
  state: PokeDiscoverStateV1,
  mapId: string,
  kind: MapDiscoveryKind,
  stableId: string,
): MapProgressUpdateResult {
  requireStableId(stableId, `${kind}Id`);
  const current = getAdventureMapProgress(state, mapId);
  const field = discoveryFields[kind];
  const ids = current[field] as string[];
  if (ids.includes(stableId)) {
    return { status: 'alreadyRecorded', state, mapProgress: current };
  }

  const mapProgress = { ...current, [field]: [...ids, stableId] };
  return {
    status: 'recorded',
    mapProgress,
    state: {
      ...state,
      mapProgress: { ...state.mapProgress, [mapId]: mapProgress },
    },
  };
}

export function completeAdventureMission(
  state: PokeDiscoverStateV1,
  request: CompleteMissionRequest,
): CompleteMissionResult {
  requireStableId(request.mapId, 'mapId');
  requireStableId(request.missionId, 'missionId');
  if (Number.isNaN(Date.parse(request.completedAt))) {
    throw new Error('completedAt debe ser una fecha ISO válida.');
  }

  const current = getAdventureMapProgress(state, request.mapId);
  const alreadyCompleted = current.completedMissionIds.includes(request.missionId);
  const completedMissionIds = alreadyCompleted
    ? current.completedMissionIds
    : [...current.completedMissionIds, request.missionId];
  const freeExpeditionUnlocked = current.freeExpeditionUnlocked || request.unlocksFreeExpedition;
  const mapChanged = !alreadyCompleted || freeExpeditionUnlocked !== current.freeExpeditionUnlocked;
  const mapProgress = mapChanged
    ? { ...current, completedMissionIds, freeExpeditionUnlocked }
    : current;

  const achievementId = FIRST_MISSION_ACHIEVEMENT.achievementId;
  const firstMissionAchievementUnlocked = Boolean(
    request.grantsFirstMissionAchievement && !state.achievements[achievementId],
  );
  const achievements = firstMissionAchievementUnlocked
    ? {
      ...state.achievements,
      [achievementId]: {
        schemaVersion: 1 as const,
        achievementId,
        unlockedAt: new Date(request.completedAt).toISOString(),
        domain: FIRST_MISSION_ACHIEVEMENT.domain,
        ...(request.originRunId ? { originRunId: request.originRunId } : {}),
      },
    }
    : state.achievements;
  const storyFlagChanged = Boolean(
    request.grantsFirstMissionAchievement && state.worldFlags[FIRST_MISSION_STORY_FLAG] !== true,
  );
  const worldFlags = storyFlagChanged
    ? { ...state.worldFlags, [FIRST_MISSION_STORY_FLAG]: true }
    : state.worldFlags;
  const activeMissionIds = state.activeMissionIds.includes(request.missionId)
    ? state.activeMissionIds.filter(id => id !== request.missionId)
    : state.activeMissionIds;

  const stateChanged = mapChanged
    || firstMissionAchievementUnlocked
    || storyFlagChanged
    || activeMissionIds !== state.activeMissionIds;
  if (!stateChanged) {
    return {
      status: 'alreadyCompleted',
      state,
      mapProgress,
      firstMissionAchievementUnlocked: false,
    };
  }

  return {
    status: alreadyCompleted ? 'alreadyCompleted' : 'completed',
    mapProgress,
    firstMissionAchievementUnlocked,
    state: {
      ...state,
      mapProgress: { ...state.mapProgress, [request.mapId]: mapProgress },
      achievements,
      worldFlags,
      activeMissionIds,
    },
  };
}
