import { describe, expect, it } from 'vitest';
import {
  beginExpedition,
  endExpedition,
  ExpeditionStartError,
  isExpeditionLoadoutLocked,
} from '../../src/domain/expeditions/expeditionSession.js';
import { createPokeVoiceSaveV1 } from '../../src/domain/progress/pokeVoiceSave.js';

const ENTERED_AT = '2026-07-17T12:00:00.000Z';

function createPreparedSave() {
  const save = createPokeVoiceSaveV1({ runId: 'run:test', now: Date.parse(ENTERED_AT) });
  return {
    ...save,
    pokedexRun: {
      ...save.pokedexRun,
      selectedCompanion: {
        schemaVersion: 1 as const,
        formId: 'pokemon-form:19:default',
      },
    },
    pokeDiscover: {
      ...save.pokeDiscover,
      inventory: {
        ...save.pokeDiscover.inventory,
        toolIds: ['tool:field-kit', 'tool:boat'],
      },
    },
  };
}

describe('sesión de expedición', () => {
  it('inmoviliza exactamente el compañero seleccionado y una herramienta propia', () => {
    const initial = createPreparedSave();
    const started = beginExpedition(initial, {
      mapId: 'map:kanto:test-meadow',
      missionId: 'mission:first-professor-expedition',
      toolId: 'tool:field-kit',
      enteredAt: ENTERED_AT,
    });

    expect(started.activeExpeditionSession).toEqual(expect.objectContaining({
      schemaVersion: 1,
      mapId: 'map:kanto:test-meadow',
      missionId: 'mission:first-professor-expedition',
      enteredAt: ENTERED_AT,
      loadout: {
        schemaVersion: 1,
        companion: { schemaVersion: 1, formId: 'pokemon-form:19:default' },
        toolId: 'tool:field-kit',
      },
      evaluatedEncounterResults: {},
      completedBehaviorTriggerIds: [],
      completedMapEventTriggerIds: [],
      meaningfulInteractionIds: [],
      meaningfulInteractionKinds: [],
      entrySnapshot: {
        schemaVersion: 1,
        secretIds: [],
        npcIds: [],
        conversationIds: [],
        collectibleIds: [],
        hintIds: [],
        routeIds: [],
        researchFactIds: [],
        trainerExperience: 0,
        discoveryPoints: 0,
      },
      entryRollbackSnapshot: expect.any(Object),
    }));
    expect(initial.activeExpeditionSession).toBeUndefined();
    expect(isExpeditionLoadoutLocked(started)).toBe(true);
  });

  it('obliga a regresar antes de cambiar de compañero o herramienta', () => {
    const started = beginExpedition(createPreparedSave(), {
      mapId: 'map:kanto:test-meadow',
      toolId: 'tool:field-kit',
      enteredAt: ENTERED_AT,
    });

    expect(() => beginExpedition(started, {
      mapId: 'map:kanto:test-meadow',
      toolId: 'tool:boat',
      enteredAt: ENTERED_AT,
    })).toThrowError('Hay que abandonar la expedición actual antes de preparar otra.');

    const returned = endExpedition(started);
    const preparedAgain = {
      ...returned,
      pokedexRun: {
        ...returned.pokedexRun,
        selectedCompanion: { schemaVersion: 1 as const, formId: 'pokemon-form:25:default' },
      },
    };
    const revisited = beginExpedition(preparedAgain, {
      mapId: 'map:kanto:test-meadow',
      toolId: 'tool:boat',
      enteredAt: ENTERED_AT,
    });

    expect(revisited.activeExpeditionSession?.loadout).toMatchObject({
      companion: { formId: 'pokemon-form:25:default' },
      toolId: 'tool:boat',
    });
  });

  it.each([
    {
      expected: 'missingCompanion',
      mutate: (save: ReturnType<typeof createPreparedSave>) => ({
        ...save,
        pokedexRun: { ...save.pokedexRun, selectedCompanion: undefined },
      }),
      toolId: 'tool:field-kit',
    },
    {
      expected: 'toolNotOwned',
      mutate: (save: ReturnType<typeof createPreparedSave>) => save,
      toolId: 'tool:shovel',
    },
  ])('rechaza preparaciones incompletas: $expected', ({ expected, mutate, toolId }) => {
    try {
      beginExpedition(mutate(createPreparedSave()), {
        mapId: 'map:kanto:test-meadow',
        toolId,
        enteredAt: ENTERED_AT,
      });
      expect.unreachable('La expedición debía rechazarse.');
    } catch (error) {
      expect(error).toBeInstanceOf(ExpeditionStartError);
      expect(error).toMatchObject({ code: expected });
    }
  });

  it('no permite entrar durante un modo de juego activo', () => {
    const prepared = createPreparedSave();
    const withMode = {
      ...prepared,
      activeModeSession: {
        schemaVersion: 1 as const,
        modeId: 'mode:trivia',
        runId: prepared.pokedexRun.runId,
        startedAt: ENTERED_AT,
        durationSec: 120,
      },
    };

    expect(() => beginExpedition(withMode, {
      mapId: 'map:kanto:test-meadow',
      toolId: 'tool:field-kit',
      enteredAt: ENTERED_AT,
    })).toThrowError('No se puede iniciar una expedición mientras hay un modo de juego activo.');
  });

  it('una revisita con otro compañero conserva secretos y rutas anteriores', () => {
    const firstVisit = beginExpedition(createPreparedSave(), {
      mapId: 'map:kanto:test-meadow',
      toolId: 'tool:field-kit',
      enteredAt: ENTERED_AT,
    });
    const progressed = {
      ...firstVisit,
      pokeDiscover: {
        ...firstVisit.pokeDiscover,
        mapProgress: {
          'map:kanto:test-meadow': {
            schemaVersion: 1 as const,
            mapId: 'map:kanto:test-meadow',
            freeExpeditionUnlocked: true,
            completedMissionIds: ['mission:first-field-trip'],
            unlockedSecretIds: ['secret:test-meadow:burrow'],
            knownNpcIds: [],
            conversationIds: [],
            collectibleIds: [],
            knownHintIds: [],
            unlockedRouteIds: ['route:test-meadow:fallen-log'],
            eligibleEncounterVisits: {},
            activeVariantIds: [],
          },
        },
      },
    };
    const returned = endExpedition(progressed);
    const changedCompanion = {
      ...returned,
      pokedexRun: {
        ...returned.pokedexRun,
        selectedCompanion: { schemaVersion: 1 as const, formId: 'pokemon-form:25:default' },
      },
    };
    const revisited = beginExpedition(changedCompanion, {
      mapId: 'map:kanto:test-meadow',
      toolId: 'tool:boat',
      enteredAt: ENTERED_AT,
    });

    expect(revisited.activeExpeditionSession?.loadout?.companion.formId)
      .toBe('pokemon-form:25:default');
    expect(revisited.pokeDiscover.mapProgress['map:kanto:test-meadow']).toMatchObject({
      unlockedSecretIds: ['secret:test-meadow:burrow'],
      unlockedRouteIds: ['route:test-meadow:fallen-log'],
    });
  });
});
