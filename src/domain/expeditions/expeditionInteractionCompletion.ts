import type {
  ExpeditionInteractionV1,
  PokeVoiceSaveV1,
} from '../../../packages/contracts/src/index.js';
import { recordMapDiscovery, type MapDiscoveryKind } from './adventureMapProgress.js';
import { recordMeaningfulExpeditionInteraction } from './expeditionSession.js';

export interface CompleteExpeditionInteractionRequest {
  mapId: string;
  interaction: ExpeditionInteractionV1;
}

export interface CompleteExpeditionInteractionResult {
  status: 'recorded' | 'alreadyRecorded';
  save: PokeVoiceSaveV1;
}

export function completeExpeditionInteraction(
  save: PokeVoiceSaveV1,
  request: CompleteExpeditionInteractionRequest,
): CompleteExpeditionInteractionResult {
  const session = save.activeExpeditionSession;
  if (!session || session.mapId !== request.mapId) {
    throw new Error('La interacción solo puede completarse dentro de su mapa activo.');
  }
  if (request.interaction.roomId === undefined || !request.interaction.interactionId?.trim()) {
    throw new Error('La interacción necesita IDs estables.');
  }

  const effects = request.interaction.completionEffects;
  const discoveries: ReadonlyArray<readonly [MapDiscoveryKind, string]> = [
    ...(effects?.npcId ? [['npc', effects.npcId] as const] : []),
    ...(effects?.conversationId ? [['conversation', effects.conversationId] as const] : []),
    ...(effects?.hintIds ?? []).map(id => ['hint', id] as const),
    ...(effects?.collectibleIds ?? []).map(id => ['collectible', id] as const),
  ];
  let next = save;
  let persistentChange = false;
  for (const [kind, stableId] of discoveries) {
    const result = recordMapDiscovery(next.pokeDiscover, request.mapId, kind, stableId);
    if (result.state !== next.pokeDiscover) {
      persistentChange = true;
      next = { ...next, pokeDiscover: result.state };
    }
  }
  next = recordMeaningfulExpeditionInteraction(next, {
    interactionId: request.interaction.interactionId,
    kind: request.interaction.meaningfulKind,
  });
  return {
    status: persistentChange ? 'recorded' : 'alreadyRecorded',
    save: next,
  };
}
