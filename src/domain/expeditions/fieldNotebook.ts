import type {
  ExpeditionExpressionTriggerV1,
  FieldNotebookHintV1,
  PokeDiscoverStateV1,
} from '../../../packages/contracts/src/index.js';
import { recordMapDiscovery } from './adventureMapProgress.js';

export interface RecordNpcHintRequest {
  mapId: string;
  npcId: string;
  conversationId: string;
  hintId: string;
}

export function recordNpcHint(
  state: PokeDiscoverStateV1,
  request: RecordNpcHintRequest,
) {
  const npc = recordMapDiscovery(state, request.mapId, 'npc', request.npcId);
  const conversation = recordMapDiscovery(
    npc.state,
    request.mapId,
    'conversation',
    request.conversationId,
  );
  const hint = recordMapDiscovery(
    conversation.state,
    request.mapId,
    'hint',
    request.hintId,
  );
  return {
    status: hint.state === state ? 'alreadyRecorded' as const : 'recorded' as const,
    state: hint.state,
    mapProgress: hint.mapProgress,
  };
}

export function getKnownFieldNotebookEntries(
  state: PokeDiscoverStateV1,
  mapId: string,
  definitions: readonly FieldNotebookHintV1[],
) {
  const known = new Set(state.mapProgress[mapId]?.knownHintIds ?? []);
  return definitions.filter(definition => (
    definition.mapId === mapId && known.has(definition.hintId)
  ));
}

export function getKnownExpressionHints(
  state: PokeDiscoverStateV1,
  mapId: string,
  trigger: Pick<ExpeditionExpressionTriggerV1, 'triggerId' | 'knownHintIds'>,
  definitions: readonly FieldNotebookHintV1[],
) {
  const triggerHintIds = new Set(trigger.knownHintIds);
  return getKnownFieldNotebookEntries(state, mapId, definitions).filter(definition => (
    triggerHintIds.has(definition.hintId)
    && (!definition.relatedTriggerId || definition.relatedTriggerId === trigger.triggerId)
  ));
}
