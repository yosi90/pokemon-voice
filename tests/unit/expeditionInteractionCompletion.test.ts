import { beforeEach, describe, expect, it } from 'vitest';
import type { ExpeditionInteractionV1 } from '../../packages/contracts/src/index.js';
import { beginExpedition } from '../../src/domain/expeditions/expeditionSession.js';
import { completeExpeditionInteraction } from '../../src/domain/expeditions/expeditionInteractionCompletion.js';
import { createPokeVoiceSaveV1 } from '../../src/domain/progress/pokeVoiceSave.js';
import {
  completeBrowserExpeditionInteraction,
  getBrowserPokeVoiceSave,
  setBrowserActiveExpeditionSession,
} from '../../src/store/browserPokeVoiceSaveStore.js';

const MAP_ID = 'map:tegueste:camphor-forest';
const interaction: ExpeditionInteractionV1 = {
  schemaVersion: 1,
  interactionId: 'interaction:tegueste:talk-professor-camphor',
  roomId: 'room:tegueste-forest:02-04',
  target: { kind: 'placement', placementId: 'character:professor-alcanfor' },
  prompt: 'Hablar con Alcanfor',
  dialogueId: 'dialogue:tegueste:professor-warning',
  meaningfulKind: 'npcConversation',
  repeatPolicy: 'repeatable',
  completionEffects: {
    npcId: 'npc:tegueste:professor-alcanfor',
    conversationId: 'conversation:tegueste:professor-warning',
    hintIds: ['hint:tegueste:rattata-follow-food'],
    collectibleIds: ['collectible:tegueste:field-note'],
  },
};

function activeSave() {
  const save = createPokeVoiceSaveV1({ runId: 'run:interaction', now: Date.parse('2026-07-22T12:00:00.000Z') });
  save.pokedexRun.selectedCompanion = { schemaVersion: 1, formId: 'pokemon-form:25:default' };
  return beginExpedition(save, { mapId: MAP_ID, enteredAt: '2026-07-22T12:00:00.000Z' });
}

describe('efectos persistentes de interacciones de expedición', () => {
  beforeEach(() => localStorage.clear());

  it('registra NPC, conversación, pista y coleccionable una sola vez', () => {
    const first = completeExpeditionInteraction(activeSave(), { mapId: MAP_ID, interaction });
    const repeated = completeExpeditionInteraction(first.save, { mapId: MAP_ID, interaction });

    expect(first.status).toBe('recorded');
    expect(first.save.pokeDiscover.mapProgress[MAP_ID]).toMatchObject({
      knownNpcIds: ['npc:tegueste:professor-alcanfor'],
      conversationIds: ['conversation:tegueste:professor-warning'],
      knownHintIds: ['hint:tegueste:rattata-follow-food'],
      collectibleIds: ['collectible:tegueste:field-note'],
    });
    expect(first.save.activeExpeditionSession?.meaningfulInteractionIds)
      .toEqual([interaction.interactionId]);
    expect(repeated.status).toBe('alreadyRecorded');
    expect(repeated.save).toBe(first.save);
  });

  it('persiste inmediatamente la transacción completa en navegador', () => {
    getBrowserPokeVoiceSave();
    setBrowserActiveExpeditionSession({
      schemaVersion: 1,
      mapId: MAP_ID,
      enteredAt: '2026-07-22T12:00:00.000Z',
      companionFormId: 'pokemon-form:25:default',
    });

    completeBrowserExpeditionInteraction({ mapId: MAP_ID, interaction });

    expect(getBrowserPokeVoiceSave().pokeDiscover.mapProgress[MAP_ID]).toMatchObject({
      conversationIds: ['conversation:tegueste:professor-warning'],
      knownHintIds: ['hint:tegueste:rattata-follow-food'],
      collectibleIds: ['collectible:tegueste:field-note'],
    });
  });
});
