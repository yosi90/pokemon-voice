import type {
  MissionDefinition,
  MissionFlowEffectV2,
  MissionFlowNodeV2,
  MissionProgressV1,
  PokeVoiceSaveV1,
} from '../../../packages/contracts/src/index.js';
import { claimPokeDiscoverRewards } from '../progress/rewardLedger.js';
import {
  evaluateRequirement,
  type RequirementEvaluationContext,
} from '../requirements/evaluateRequirement.js';
import { advanceMissionFlow, resolveMissionFlowNode } from './missionFlow.js';
import { normalizeMissionDefinition } from './missionV2.js';
import { restoreExpeditionRollbackSnapshot } from './expeditionSession.js';

type FlowRequirementContext = Omit<RequirementEvaluationContext, 'save'>;

function requireProgress(save: PokeVoiceSaveV1, missionId: string) {
  const progress = save.pokeDiscover.missionProgressById?.[missionId];
  if (!progress) throw new Error(`La misión ${missionId} no está activa.`);
  return progress;
}

function persistProgress(
  save: PokeVoiceSaveV1,
  progress: MissionProgressV1,
): PokeVoiceSaveV1 {
  return {
    ...save,
    pokeDiscover: {
      ...save.pokeDiscover,
      missionProgressById: {
        ...(save.pokeDiscover.missionProgressById ?? {}),
        [progress.missionId]: progress,
      },
      activeMissionIds: [...new Set([
        ...save.pokeDiscover.activeMissionIds,
        progress.missionId,
      ])],
    },
  };
}

function applyEffect(
  save: PokeVoiceSaveV1,
  missionId: string,
  mapId: string,
  effect: MissionFlowEffectV2,
  executedAt: string,
) {
  const progress = requireProgress(save, missionId);
  if (progress.executedFlowEffectIds?.includes(effect.effectId)) return save;
  let next = save;
  if (effect.kind === 'setMissionFlag') {
    next = persistProgress(next, {
      ...progress,
      flags: { ...progress.flags, [effect.flagId]: effect.value },
    });
  } else if (effect.kind === 'incrementMissionCounter') {
    next = persistProgress(next, {
      ...progress,
      counters: {
        ...progress.counters,
        [effect.counterId]: (progress.counters[effect.counterId] ?? 0) + effect.amount,
      },
    });
  } else if (effect.kind === 'setWorldFlag') {
    next = {
      ...next,
      pokeDiscover: {
        ...next.pokeDiscover,
        worldFlags: { ...next.pokeDiscover.worldFlags, [effect.flagId]: effect.value },
      },
    };
  } else if (effect.kind === 'incrementGlobalCounter') {
    next = {
      ...next,
      pokeDiscover: {
        ...next.pokeDiscover,
        globalCounters: {
          ...next.pokeDiscover.globalCounters,
          [effect.counterId]: (next.pokeDiscover.globalCounters[effect.counterId] ?? 0) + effect.amount,
        },
      },
    };
  } else if (effect.rewards.length) {
    const reward = claimPokeDiscoverRewards(next.pokeDiscover, {
      originId: `${missionId}:flow-effect:${effect.effectId}`,
      rewards: effect.rewards,
      claimedAt: executedAt,
      runId: next.pokedexRun.runId,
      missionId,
      mapId,
    });
    next = { ...next, pokeDiscover: reward.state };
  }
  const current = requireProgress(next, missionId);
  return persistProgress(next, {
    ...current,
    executedFlowEffectIds: [...new Set([
      ...(current.executedFlowEffectIds ?? []),
      effect.effectId,
    ])],
    updatedAt: executedAt,
  });
}

function checkpointNode(
  save: PokeVoiceSaveV1,
  missionId: string,
  node: MissionFlowNodeV2,
  updatedAt: string,
) {
  const progress = requireProgress(save, missionId);
  return persistProgress(save, {
    ...progress,
    checkpointId: node.nodeId,
    flowNodeId: node.nodeId,
    updatedAt,
    ...(node.kind === 'expedition' ? { lastExpeditionNodeId: node.nodeId } : {}),
  });
}

export function getActiveMissionFlowState(
  save: PokeVoiceSaveV1,
  mission: MissionDefinition,
) {
  const normalized = normalizeMissionDefinition(mission);
  if (!normalized.flow) return undefined;
  const progress = requireProgress(save, mission.missionId);
  const nodeId = progress.flowNodeId ?? normalized.flow.initialNodeId;
  const node = resolveMissionFlowNode(normalized.flow, nodeId) as MissionFlowNodeV2 | undefined;
  if (!node) throw new Error(`Checkpoint de misión inexistente: ${nodeId}.`);
  return { mission: normalized, progress, node };
}

/**
 * Resuelve en una transacción lógica condiciones y efectos consecutivos. Se
 * detiene ante contenido que necesita una decisión del jugador o un terminal.
 */
export function settleMissionFlow(
  save: PokeVoiceSaveV1,
  mission: MissionDefinition,
  options: {
    requirementContext?: FlowRequirementContext;
    updatedAt?: string;
  } = {},
) {
  const normalized = normalizeMissionDefinition(mission);
  const flow = normalized.flow;
  if (!flow) return { save, mission: normalized, node: undefined };
  const updatedAt = new Date(options.updatedAt ?? Date.now()).toISOString();
  let next = save;
  let state = getActiveMissionFlowState(next, normalized);
  const visited = new Set<string>();
  while (state && (state.node.kind === 'condition' || state.node.kind === 'effect')) {
    if (visited.has(state.node.nodeId)) throw new Error('El flujo automático contiene un ciclo.');
    visited.add(state.node.nodeId);
    if (state.node.kind === 'effect') {
      for (const effect of state.node.effects) {
        next = applyEffect(next, normalized.missionId, normalized.mapId, effect, updatedAt);
      }
    }
    const targetId = state.node.kind === 'condition'
      ? advanceMissionFlow(flow, state.node.nodeId, {
        evaluateRequirement: requirement => evaluateRequirement(requirement, {
          save: next,
          ...(options.requirementContext ?? {}),
        }).met,
      })
      : state.node.nextNodeId;
    const target = resolveMissionFlowNode(flow, targetId) as MissionFlowNodeV2 | undefined;
    if (!target) throw new Error(`Destino de misión inexistente: ${targetId}.`);
    next = checkpointNode(next, normalized.missionId, target, updatedAt);
    state = getActiveMissionFlowState(next, normalized);
  }
  return { save: next, mission: normalized, node: state?.node };
}

export function advanceActiveMissionFlow(
  save: PokeVoiceSaveV1,
  mission: MissionDefinition,
  outcomeId?: string,
  options: {
    requirementContext?: FlowRequirementContext;
    updatedAt?: string;
  } = {},
) {
  const normalized = normalizeMissionDefinition(mission);
  const flow = normalized.flow;
  if (!flow) return { save, mission: normalized, node: undefined };
  const current = getActiveMissionFlowState(save, normalized);
  if (!current) return { save, mission: normalized, node: undefined };
  if (current.node.kind === 'condition' || current.node.kind === 'effect') {
    return settleMissionFlow(save, normalized, options);
  }
  const targetId = advanceMissionFlow(flow, current.node.nodeId, { outcomeId });
  const target = resolveMissionFlowNode(flow, targetId) as MissionFlowNodeV2 | undefined;
  if (!target) throw new Error(`Destino de misión inexistente: ${targetId}.`);
  const updatedAt = new Date(options.updatedAt ?? Date.now()).toISOString();
  const checkpointed = checkpointNode(save, normalized.missionId, target, updatedAt);
  return settleMissionFlow(checkpointed, normalized, { ...options, updatedAt });
}

export function abandonActiveMission(save: PokeVoiceSaveV1, mission: MissionDefinition) {
  const normalized = normalizeMissionDefinition(mission);
  if (!normalized.abandonment.allowed) {
    throw new Error(normalized.abandonment.blockedText ?? 'Esta misión no se puede abandonar.');
  }
  const { [mission.missionId]: _removed, ...missionProgressById } = save.pokeDiscover.missionProgressById;
  return {
    ...save,
    pokeDiscover: {
      ...save.pokeDiscover,
      missionProgressById,
      activeMissionIds: save.pokeDiscover.activeMissionIds.filter(id => id !== mission.missionId),
    },
    ...(save.activeExpeditionSession?.missionId === mission.missionId
      ? { activeExpeditionSession: undefined }
      : {}),
  };
}

function removeMissionProgress(save: PokeVoiceSaveV1, missionId: string): PokeVoiceSaveV1 {
  const { [missionId]: _removed, ...missionProgressById } = save.pokeDiscover.missionProgressById;
  return {
    ...save,
    pokeDiscover: {
      ...save.pokeDiscover,
      missionProgressById,
      activeMissionIds: save.pokeDiscover.activeMissionIds.filter(id => id !== missionId),
    },
    ...(save.activeExpeditionSession?.missionId === missionId
      ? { activeExpeditionSession: undefined }
      : {}),
  };
}

/** Aplica la política declarada por un terminal de fracaso sin tocar otras misiones activas. */
export function resolveActiveMissionFailure(
  save: PokeVoiceSaveV1,
  mission: MissionDefinition,
  updatedAt = new Date().toISOString(),
) {
  const state = getActiveMissionFlowState(save, mission);
  if (!state || state.node.kind !== 'terminal' || state.node.result !== 'failure') {
    throw new Error('La misión no se encuentra en un final de fracaso.');
  }
  const session = save.activeExpeditionSession?.missionId === mission.missionId
    ? save.activeExpeditionSession
    : undefined;
  const restored = state.node.rollbackPolicy === 'restoreSnapshot' && session?.entryRollbackSnapshot
    ? restoreExpeditionRollbackSnapshot(save, session.entryRollbackSnapshot)
    : save;
  const action = state.node.failureAction ?? 'retryLastExpedition';
  if (action === 'abandonMission') return removeMissionProgress(restored, mission.missionId);

  const current = requireProgress(restored, mission.missionId);
  const targetNodeId = action === 'restartMission'
    ? state.mission.flow!.initialNodeId
    : current.lastExpeditionNodeId ?? state.mission.flow!.initialNodeId;
  const target = resolveMissionFlowNode(state.mission.flow!, targetNodeId) as MissionFlowNodeV2 | undefined;
  if (!target) throw new Error(`No se puede recuperar el checkpoint ${targetNodeId}.`);
  const reset = persistProgress(
    { ...restored, activeExpeditionSession: undefined },
    action === 'restartMission'
      ? {
        schemaVersion: 1,
        missionId: mission.missionId,
        checkpointId: targetNodeId,
        flowNodeId: targetNodeId,
        flags: {},
        counters: {},
        resolvedActorIds: [],
        executedFlowEffectIds: [],
        startedAt: current.startedAt,
        updatedAt,
        ...(target.kind === 'expedition' ? { lastExpeditionNodeId: targetNodeId } : {}),
      }
      : {
        ...current,
        checkpointId: targetNodeId,
        flowNodeId: targetNodeId,
        updatedAt,
      },
  );
  return settleMissionFlow(reset, state.mission, { updatedAt }).save;
}
