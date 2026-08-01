import type {
  MissionDefinition,
  MissionStatus,
  PokemonFormV1,
  PokemonSpeciesV1,
  PokeVoiceSaveV1,
} from '../../../packages/contracts/src/index.js';
import { claimPokeDiscoverRewards } from '../progress/rewardLedger.js';
import { evaluateRequirement } from '../requirements/evaluateRequirement.js';
import { completeAdventureMission } from './adventureMapProgress.js';
import { normalizeMissionDefinition } from './missionV2.js';

export interface MissionEvaluationContext {
  companionForm?: PokemonFormV1;
  species?: readonly PokemonSpeciesV1[];
  expeditionCapabilities?: ReadonlyArray<{ id: string; strength?: number }>;
}

export interface MissionReadiness {
  ready: boolean;
  completedObjectiveIds: string[];
  unmetRequiredObjectiveIds: string[];
  unmetOptionalObjectiveIds: string[];
}

function evaluationContext(save: PokeVoiceSaveV1, context: MissionEvaluationContext) {
  return {
    save,
    ...(context.companionForm ? { companionForm: context.companionForm } : {}),
    ...(context.species ? { species: context.species } : {}),
    ...(context.expeditionCapabilities
      ? { expeditionCapabilities: context.expeditionCapabilities }
      : {}),
  };
}

export function getMissionStatus(
  save: PokeVoiceSaveV1,
  mission: MissionDefinition,
  context: MissionEvaluationContext = {},
): MissionStatus {
  const progress = save.pokeDiscover.mapProgress[mission.mapId];
  if (progress?.completedMissionIds.includes(mission.missionId)) return 'completed';
  if (save.pokeDiscover.missionProgressById?.[mission.missionId]
    || save.pokeDiscover.activeMissionIds.includes(mission.missionId)) return 'active';
  if (mission.schemaVersion === 2 && mission.publicationStatus !== 'published') return 'locked';
  if (!mission.availability) return 'available';
  return evaluateRequirement(mission.availability, evaluationContext(save, context)).met
    ? 'available'
    : 'locked';
}

export function startAdventureMission(
  save: PokeVoiceSaveV1,
  mission: MissionDefinition,
  context: MissionEvaluationContext = {},
  startedAt = new Date().toISOString(),
) {
  const status = getMissionStatus(save, mission, context);
  if (status !== 'available') return { status, save };
  const normalized = normalizeMissionDefinition(mission);
  const flowNodeId = normalized.flow?.initialNodeId ?? `${mission.missionId}:start`;
  return {
    status: 'active' as const,
    save: {
      ...save,
      pokeDiscover: {
        ...save.pokeDiscover,
        activeMissionIds: [...save.pokeDiscover.activeMissionIds, mission.missionId],
        missionProgressById: {
          ...(save.pokeDiscover.missionProgressById ?? {}),
          [mission.missionId]: {
            schemaVersion: 1 as const,
            missionId: mission.missionId,
            checkpointId: flowNodeId,
            flowNodeId,
            flags: {},
            counters: {},
            resolvedActorIds: [],
            executedFlowEffectIds: [],
            startedAt: new Date(startedAt).toISOString(),
            updatedAt: new Date(startedAt).toISOString(),
          },
        },
      },
    },
  };
}

export function evaluateMissionReadiness(
  save: PokeVoiceSaveV1,
  mission: MissionDefinition,
  context: MissionEvaluationContext = {},
): MissionReadiness {
  const completedObjectiveIds: string[] = [];
  const unmetRequiredObjectiveIds: string[] = [];
  const unmetOptionalObjectiveIds: string[] = [];
  for (const objective of mission.objectives) {
    if (evaluateRequirement(objective.requirement, evaluationContext(save, context)).met) {
      completedObjectiveIds.push(objective.objectiveId);
    } else if (objective.optional) {
      unmetOptionalObjectiveIds.push(objective.objectiveId);
    } else {
      unmetRequiredObjectiveIds.push(objective.objectiveId);
    }
  }
  return {
    ready: unmetRequiredObjectiveIds.length === 0,
    completedObjectiveIds,
    unmetRequiredObjectiveIds,
    unmetOptionalObjectiveIds,
  };
}

export function completeMissionDefinition(
  save: PokeVoiceSaveV1,
  mission: MissionDefinition,
  completedAt: string,
  context: MissionEvaluationContext = {},
) {
  const status = getMissionStatus(save, mission, context);
  if (status === 'completed') {
    return {
      status: 'alreadyCompleted' as const,
      save,
      readiness: evaluateMissionReadiness(save, mission, context),
      rewardStatus: 'notApplicable' as const,
      firstMissionAchievementUnlocked: false,
    };
  }
  if (status !== 'active') {
    return {
      status: 'notActive' as const,
      save,
      readiness: evaluateMissionReadiness(save, mission, context),
      rewardStatus: 'notApplicable' as const,
      firstMissionAchievementUnlocked: false,
    };
  }
  const readiness = evaluateMissionReadiness(save, mission, context);
  if (!readiness.ready) {
    return {
      status: 'notReady' as const,
      save,
      readiness,
      rewardStatus: 'notApplicable' as const,
      firstMissionAchievementUnlocked: false,
    };
  }

  const completion = completeAdventureMission(save.pokeDiscover, {
    mapId: mission.mapId,
    missionId: mission.missionId,
    completedAt,
    originRunId: save.pokedexRun.runId,
    unlocksFreeExpedition: mission.unlocksFreeExpedition,
    grantsFirstMissionAchievement: mission.grantsFirstMissionAchievement,
  });
  const { [mission.missionId]: _completedProgress, ...missionProgressById } = completion.state.missionProgressById ?? {};
  let nextSave = {
    ...save,
    pokeDiscover: { ...completion.state, missionProgressById },
  };
  let rewardStatus: 'claimed' | 'alreadyClaimed' | 'notApplicable' = 'notApplicable';
  if (mission.rewards.length) {
    const reward = claimPokeDiscoverRewards(nextSave.pokeDiscover, {
      originId: mission.missionId,
      rewards: mission.rewards,
      claimedAt: completedAt,
      runId: nextSave.pokedexRun.runId,
      missionId: mission.missionId,
      mapId: mission.mapId,
    });
    rewardStatus = reward.status;
    nextSave = { ...nextSave, pokeDiscover: reward.state };
  }

  return {
    status: 'completed' as const,
    save: nextSave,
    readiness,
    rewardStatus,
    firstMissionAchievementUnlocked: completion.firstMissionAchievementUnlocked,
  };
}
