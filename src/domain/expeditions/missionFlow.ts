import type {
  MissionDefinitionV1,
  MissionFlowNode,
  MissionFlowNodeV1,
  MissionFlow,
  MissionFlowV1,
  RequirementExpressionV1,
} from '../../../packages/contracts/src/index.js';

export function missionFlowNodeTargets(node: MissionFlowNode) {
  if (node.kind === 'conversation') {
    return [...Object.values(node.outcomes), ...(node.defaultNextNodeId ? [node.defaultNextNodeId] : [])];
  }
  if (node.kind === 'expedition') return Object.values(node.outcomes);
  if (node.kind === 'condition') return [node.whenTrueNodeId, node.whenFalseNodeId];
  if (node.kind === 'effect') return [node.nextNodeId];
  if (node.kind === 'travel') return [node.expeditionNodeId];
  return [];
}

export function validateMissionFlow(flow: MissionFlow) {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const node of flow.nodes) {
    if (!node.nodeId || ids.has(node.nodeId)) errors.push(`Nodo duplicado o vacío: ${node.nodeId}.`);
    ids.add(node.nodeId);
  }
  if (!ids.has(flow.initialNodeId)) errors.push(`El nodo inicial ${flow.initialNodeId} no existe.`);
  for (const node of flow.nodes) {
    for (const target of missionFlowNodeTargets(node)) {
      if (!ids.has(target)) errors.push(`${node.nodeId}: destino inexistente ${target}.`);
    }
    if (node.kind === 'travel') {
      const target = flow.nodes.find(candidate => candidate.nodeId === node.expeditionNodeId);
      if (target && target.kind !== 'expedition') {
        errors.push(`${node.nodeId}: el viaje debe conducir a una expedición.`);
      }
    }
    if (node.kind === 'effect') {
      const effectIds = new Set<string>();
      for (const effect of node.effects) {
        if (!effect.effectId || effectIds.has(effect.effectId)) {
          errors.push(`${node.nodeId}: effectId duplicado o vacío ${effect.effectId}.`);
        }
        effectIds.add(effect.effectId);
      }
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const byId = new Map(flow.nodes.map(node => [node.nodeId, node]));
  const visit = (nodeId: string): boolean => {
    if (visiting.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;
    visiting.add(nodeId);
    const node = byId.get(nodeId);
    const cycle = node && node.kind !== 'terminal'
      ? missionFlowNodeTargets(node).some(visit)
      : false;
    visiting.delete(nodeId);
    visited.add(nodeId);
    return cycle;
  };
  if (ids.has(flow.initialNodeId) && visit(flow.initialNodeId)) {
    errors.push('El flujo contiene un ciclo automático.');
  }
  if (ids.has(flow.initialNodeId)) {
    const reachable = new Set<string>();
    const markReachable = (nodeId: string) => {
      if (reachable.has(nodeId)) return;
      reachable.add(nodeId);
      const node = byId.get(nodeId);
      if (node) missionFlowNodeTargets(node).forEach(markReachable);
    };
    markReachable(flow.initialNodeId);
    for (const node of flow.nodes) {
      if (!reachable.has(node.nodeId)) errors.push(`${node.nodeId}: nodo inalcanzable.`);
    }
    const hasReachableSuccess = flow.nodes.some(node => (
      reachable.has(node.nodeId) && node.kind === 'terminal' && node.result === 'success'
    ));
    if (!hasReachableSuccess) errors.push('El flujo no contiene una ruta alcanzable de éxito.');
  }
  return errors;
}

export function resolveMissionFlowNode(
  flow: MissionFlow,
  nodeId: string,
) {
  return flow.nodes.find(node => node.nodeId === nodeId);
}

export function advanceMissionFlow(
  flow: MissionFlow,
  nodeId: string,
  request: {
    outcomeId?: string;
    evaluateRequirement?: (requirement: RequirementExpressionV1) => boolean;
  },
) {
  const node = resolveMissionFlowNode(flow, nodeId);
  if (!node) throw new Error(`Nodo de misión inexistente: ${nodeId}.`);
  if (node.kind === 'terminal') return node.nodeId;
  if (node.kind === 'condition') {
    if (!request.evaluateRequirement) throw new Error('Falta el evaluador de requisitos.');
    return request.evaluateRequirement(node.requirement)
      ? node.whenTrueNodeId
      : node.whenFalseNodeId;
  }
  if (node.kind === 'effect') return node.nextNodeId;
  if (node.kind === 'travel') {
    if (request.outcomeId !== 'accept') {
      throw new Error(`${node.nodeId}: el viaje sigue aplazado.`);
    }
    return node.expeditionNodeId;
  }
  if (!request.outcomeId && node.kind === 'conversation' && node.defaultNextNodeId) {
    return node.defaultNextNodeId;
  }
  const target = request.outcomeId ? node.outcomes[request.outcomeId] : undefined;
  if (!target) throw new Error(`${node.nodeId}: resultado sin enlazar ${request.outcomeId ?? '(vacío)'}.`);
  return target;
}

export function createLegacyMissionFlow(mission: MissionDefinitionV1): MissionFlowV1 {
  const prefix = `${mission.missionId}:flow`;
  const nodes: MissionFlowNodeV1[] = [];
  const successId = `${prefix}:success`;
  const failureId = `${prefix}:failure`;
  const expeditionId = `${prefix}:expedition`;
  let initialNodeId = expeditionId;
  let previousConversationId: string | undefined;
  const addConversation = (slot: string, conversationId?: string) => {
    if (!conversationId) return undefined;
    const nodeId = `${prefix}:${slot}`;
    nodes.push({
      kind: 'conversation',
      nodeId,
      conversationId,
      outcomes: {},
    });
    if (previousConversationId) {
      const previous = nodes.find(node => node.nodeId === previousConversationId);
      if (previous?.kind === 'conversation') previous.defaultNextNodeId = nodeId;
    } else initialNodeId = nodeId;
    previousConversationId = nodeId;
    return nodeId;
  };
  addConversation('offer', mission.narratives?.offerSequenceId);
  addConversation('briefing', mission.narratives?.briefingSequenceId);
  if (previousConversationId) {
    const previous = nodes.find(node => node.nodeId === previousConversationId);
    if (previous?.kind === 'conversation') previous.defaultNextNodeId = expeditionId;
  }
  const successConversationId = mission.narratives?.successSequenceId
    ? `${prefix}:success-conversation`
    : successId;
  const failureConversationId = mission.narratives?.failureSequenceId
    ? `${prefix}:failure-conversation`
    : failureId;
  nodes.push({
    kind: 'expedition',
    nodeId: expeditionId,
    mapId: mission.mapId,
    mapVariantIds: mission.mapVariantIds,
    outcomes: {
      success: successConversationId,
      failure: failureConversationId,
    },
  });
  if (mission.narratives?.successSequenceId) {
    nodes.push({
      kind: 'conversation',
      nodeId: successConversationId,
      conversationId: mission.narratives.successSequenceId,
      outcomes: {},
      defaultNextNodeId: successId,
    });
  }
  if (mission.narratives?.failureSequenceId) {
    nodes.push({
      kind: 'conversation',
      nodeId: failureConversationId,
      conversationId: mission.narratives.failureSequenceId,
      outcomes: {},
      defaultNextNodeId: failureId,
    });
  }
  nodes.push(
    { kind: 'terminal', nodeId: successId, result: 'success' },
    { kind: 'terminal', nodeId: failureId, result: 'failure' },
  );
  return { schemaVersion: 1, initialNodeId, nodes };
}
