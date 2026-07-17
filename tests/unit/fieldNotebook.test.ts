import { describe, expect, it } from 'vitest';
import type { FieldNotebookHintV1, ResearchFactV1 } from '../../packages/contracts/src/index.js';
import { recordMapDiscovery } from '../../src/domain/expeditions/adventureMapProgress.js';
import {
  beginExpedition,
  endExpeditionWithReport,
} from '../../src/domain/expeditions/expeditionSession.js';
import {
  getBrowserPokeVoiceSave,
  recordBrowserNpcHint,
} from '../../src/store/browserPokeVoiceSaveStore.js';
import {
  getKnownFieldNotebookEntries,
  recordNpcHint,
} from '../../src/domain/expeditions/fieldNotebook.js';
import { createPokeVoiceSaveV1 } from '../../src/domain/progress/pokeVoiceSave.js';
import { claimPokeDiscoverRewards } from '../../src/domain/progress/rewardLedger.js';
import { discoverResearchFact } from '../../src/domain/research/researchProgress.js';

const MAP_ID = 'map:hoenn:sharpedo-bay';
const NOW = '2026-07-17T22:00:00.000Z';

const hints: FieldNotebookHintV1[] = [
  {
    schemaVersion: 1,
    hintId: 'hint:sharpedo-bay:pretty-shark',
    mapId: MAP_ID,
    title: 'El consejo del bañista',
    text: 'El bañista siempre halaga al Sharpedo antes de entrar al agua.',
    sourceNpcId: 'npc:sharpedo-bay:swimmer',
    relatedTriggerId: 'expression:sharpedo-bay:calm-sharpedo',
  },
  {
    schemaVersion: 1,
    hintId: 'hint:sharpedo-bay:hidden-cave',
    mapId: MAP_ID,
    title: 'Una corriente extraña',
    text: 'El agua parece entrar bajo las rocas.',
  },
];

function preparedSave() {
  const save = createPokeVoiceSaveV1({ runId: 'run:notebook', now: Date.parse(NOW) });
  return {
    ...save,
    pokedexRun: {
      ...save.pokedexRun,
      selectedCompanion: { schemaVersion: 1 as const, formId: 'pokemon-form:25:default' },
    },
    pokeDiscover: {
      ...save.pokeDiscover,
      inventory: { ...save.pokeDiscover.inventory, toolIds: ['tool:field-kit'] },
    },
  };
}

describe('cuaderno e informe de expedición', () => {
  it('una conversación registra NPC, conversación y pista como una sola operación', () => {
    const initial = preparedSave().pokeDiscover;
    const first = recordNpcHint(initial, {
      mapId: MAP_ID,
      npcId: 'npc:sharpedo-bay:swimmer',
      conversationId: 'conversation:sharpedo-bay:pretty-shark',
      hintId: hints[0].hintId,
    });
    const repeated = recordNpcHint(first.state, {
      mapId: MAP_ID,
      npcId: 'npc:sharpedo-bay:swimmer',
      conversationId: 'conversation:sharpedo-bay:pretty-shark',
      hintId: hints[0].hintId,
    });

    expect(first.mapProgress).toMatchObject({
      knownNpcIds: ['npc:sharpedo-bay:swimmer'],
      conversationIds: ['conversation:sharpedo-bay:pretty-shark'],
      knownHintIds: [hints[0].hintId],
    });
    expect(repeated.status).toBe('alreadyRecorded');
    expect(repeated.state).toBe(first.state);
  });

  it('el cuaderno devuelve solo pistas conocidas y nunca expone el total oculto', () => {
    const discovered = recordNpcHint(preparedSave().pokeDiscover, {
      mapId: MAP_ID,
      npcId: 'npc:sharpedo-bay:swimmer',
      conversationId: 'conversation:sharpedo-bay:pretty-shark',
      hintId: hints[0].hintId,
    }).state;
    const entries = getKnownFieldNotebookEntries(discovered, MAP_ID, hints);

    expect(entries).toEqual([hints[0]]);
    expect(entries).not.toHaveProperty('total');
    expect(JSON.stringify(entries)).not.toContain(hints[1].hintId);
  });

  it('resume únicamente lo obtenido desde que comenzó la expedición', () => {
    const initialWithOldSecret = {
      ...preparedSave(),
      pokeDiscover: recordMapDiscovery(
        preparedSave().pokeDiscover,
        MAP_ID,
        'secret',
        'secret:sharpedo-bay:old-shortcut',
      ).state,
    };
    const active = beginExpedition(initialWithOldSecret, {
      mapId: MAP_ID,
      missionId: 'mission:sharpedo-bay:first-visit',
      toolId: 'tool:field-kit',
      enteredAt: NOW,
    });
    const withHint = {
      ...active,
      pokeDiscover: recordNpcHint(active.pokeDiscover, {
        mapId: MAP_ID,
        npcId: 'npc:sharpedo-bay:swimmer',
        conversationId: 'conversation:sharpedo-bay:pretty-shark',
        hintId: hints[0].hintId,
      }).state,
    };
    const withSecret = {
      ...withHint,
      pokeDiscover: recordMapDiscovery(
        withHint.pokeDiscover,
        MAP_ID,
        'secret',
        'secret:sharpedo-bay:calmed-sharpedo',
      ).state,
    };
    const fact: ResearchFactV1 = {
      schemaVersion: 1,
      factId: 'research-fact:sharpedo:behavior:territorial',
      speciesId: 319,
      field: 'behavior',
      contribution: 'observation',
      mapId: MAP_ID,
      interactionId: 'expression:sharpedo-bay:calm-sharpedo',
      text: 'Sharpedo responde de forma inesperada a un cumplido amable.',
      rewards: [],
    };
    const researched = discoverResearchFact(withSecret.pokeDiscover, fact, {
      discoveredAt: NOW,
      runId: withSecret.pokedexRun.runId,
      missionId: withSecret.activeExpeditionSession?.missionId,
    }).state;
    const rewarded = claimPokeDiscoverRewards(researched, {
      originId: 'secret:sharpedo-bay:calmed-sharpedo',
      claimedAt: NOW,
      mapId: MAP_ID,
      rewards: [
        { kind: 'trainerExperience', amount: 10 },
        { kind: 'discoveryPoints', amount: 15 },
      ],
    }).state;
    const result = endExpeditionWithReport({ ...withSecret, pokeDiscover: rewarded });

    expect(result.save.activeExpeditionSession).toBeUndefined();
    expect(result.report).toEqual({
      mapId: MAP_ID,
      missionId: 'mission:sharpedo-bay:first-visit',
      newSecretIds: ['secret:sharpedo-bay:calmed-sharpedo'],
      newNpcIds: ['npc:sharpedo-bay:swimmer'],
      newConversationIds: ['conversation:sharpedo-bay:pretty-shark'],
      newCollectibleIds: [],
      newHintIds: [hints[0].hintId],
      newRouteIds: [],
      newResearchFactIds: [fact.factId],
      trainerExperienceGained: 10,
      discoveryPointsGained: 15,
      meaningfulInteractionCount: 0,
    });
    expect(result.report?.newSecretIds).not.toContain('secret:sharpedo-bay:old-shortcut');
  });

  it('persiste inmediatamente las pistas enseñadas por NPC', () => {
    localStorage.clear();
    getBrowserPokeVoiceSave();
    recordBrowserNpcHint({
      mapId: MAP_ID,
      npcId: 'npc:sharpedo-bay:swimmer',
      conversationId: 'conversation:sharpedo-bay:pretty-shark',
      hintId: hints[0].hintId,
    });

    expect(getBrowserPokeVoiceSave().pokeDiscover.mapProgress[MAP_ID]).toMatchObject({
      knownNpcIds: ['npc:sharpedo-bay:swimmer'],
      conversationIds: ['conversation:sharpedo-bay:pretty-shark'],
      knownHintIds: [hints[0].hintId],
    });
  });
});
