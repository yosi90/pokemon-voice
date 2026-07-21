import { describe, expect, it } from 'vitest';
import type { CompanionBehaviorTriggerV1, PokemonFormV1 } from '../../packages/contracts/src/index.js';
import {
  executeCompanionBehavior,
  listAvailableCompanionBehaviors,
} from '../../src/domain/expeditions/companionBehavior.js';
import { beginExpedition, endExpedition } from '../../src/domain/expeditions/expeditionSession.js';
import { createPokeVoiceSaveV1 } from '../../src/domain/progress/pokeVoiceSave.js';
import {
  executeBrowserCompanionBehavior,
  getBrowserPokeVoiceSave,
  setBrowserActiveExpeditionSession,
} from '../../src/store/browserPokeVoiceSaveStore.js';

const MAP_ID = 'map:kanto:test-meadow';
const EXECUTED_AT = '2026-07-17T18:00:00.000Z';

const pikachu: PokemonFormV1 = {
  schemaVersion: 1,
  formId: 'pokemon-form:25:default',
  speciesId: 25,
  slug: 'pikachu',
  displayName: 'Pikachu',
  kind: 'default',
  types: ['electric'],
  evolutionStage: 1,
  sizeClass: 'small',
  narrativeTags: ['electric-cheeks'],
  fieldCapabilities: [{ id: 'light', source: 'biology' }],
};

const rattataTrigger: CompanionBehaviorTriggerV1 = {
  schemaVersion: 1,
  triggerId: 'trigger:test-meadow:rattata-pikachu-tail',
  mode: 'automatic',
  requirement: { kind: 'companionSpecies', speciesId: 25 },
  sequenceId: 'sequence:test-meadow:rattata-pikachu-shock',
  repeatPolicy: 'persistent',
  rewardOriginId: 'behavior:test-meadow:rattata-pikachu-tail',
};

function createActiveSave(companion = pikachu) {
  const save = createPokeVoiceSaveV1({ runId: 'run:behavior', now: Date.parse(EXECUTED_AT) });
  const prepared = {
    ...save,
    pokedexRun: {
      ...save.pokedexRun,
      selectedCompanion: { schemaVersion: 1 as const, formId: companion.formId },
    },
    pokeDiscover: {
      ...save.pokeDiscover,
      inventory: { ...save.pokeDiscover.inventory, toolIds: ['tool:field-kit'] },
    },
  };
  return beginExpedition(prepared, {
    mapId: MAP_ID,
    missionId: 'mission:first-field-trip',
    toolId: 'tool:field-kit',
    enteredAt: EXECUTED_AT,
  });
}

describe('comportamientos declarativos del acompañante', () => {
  it('ofrece únicamente triggers cuyos requisitos se cumplen', () => {
    const prompt = { ...rattataTrigger, triggerId: 'trigger:prompt', mode: 'prompt' as const };
    const impossible = {
      ...rattataTrigger,
      triggerId: 'trigger:wrong-species',
      requirement: { kind: 'companionSpecies' as const, speciesId: 1 },
    };

    expect(listAvailableCompanionBehaviors(
      createActiveSave(), MAP_ID, [prompt, impossible], { companionForm: pikachu },
    ).map(trigger => trigger.triggerId)).toEqual(['trigger:prompt']);
  });

  it('Rattata inicia la escena automática con Pikachu y cobra una sola vez', () => {
    const first = executeCompanionBehavior(createActiveSave(), {
      mapId: MAP_ID,
      trigger: rattataTrigger,
      companionForm: pikachu,
      executedAt: EXECUTED_AT,
      rewards: [
        { kind: 'trainerExperience', amount: 10 },
        { kind: 'discoveryPoints', amount: 10 },
      ],
    });
    const repeated = executeCompanionBehavior(first.save, {
      mapId: MAP_ID,
      trigger: rattataTrigger,
      companionForm: pikachu,
      executedAt: EXECUTED_AT,
      rewards: [{ kind: 'discoveryPoints', amount: 999 }],
    });

    expect(first).toMatchObject({
      status: 'executed',
      sequenceId: rattataTrigger.sequenceId,
      rewardStatus: 'claimed',
      save: { pokeDiscover: { trainerExperience: 10, discoveryPoints: 10 } },
    });
    expect(first.save.pokeDiscover.mapProgress[MAP_ID].completedBehaviorTriggerIds)
      .toEqual([rattataTrigger.triggerId]);
    expect(repeated).toMatchObject({ status: 'alreadyCompleted', rewardStatus: 'notApplicable' });
    expect(repeated.save).toBe(first.save);
  });

  it('un trigger persistente continúa completado tras abandonar y revisitar', () => {
    const first = executeCompanionBehavior(createActiveSave(), {
      mapId: MAP_ID,
      trigger: rattataTrigger,
      companionForm: pikachu,
      executedAt: EXECUTED_AT,
    });
    const revisited = beginExpedition(endExpedition(first.save), {
      mapId: MAP_ID,
      toolId: 'tool:field-kit',
      enteredAt: EXECUTED_AT,
    });

    expect(listAvailableCompanionBehaviors(
      revisited, MAP_ID, [rattataTrigger], { companionForm: pikachu },
    )).toEqual([]);
  });

  it('oncePerVisit vuelve a estar disponible al iniciar otra expedición', () => {
    const ambient = {
      ...rattataTrigger,
      triggerId: 'trigger:test-meadow:pikachu-sniffs-air',
      mode: 'ambient' as const,
      repeatPolicy: 'oncePerVisit' as const,
      rewardOriginId: undefined,
    };
    const first = executeCompanionBehavior(createActiveSave(), {
      mapId: MAP_ID,
      trigger: ambient,
      companionForm: pikachu,
      executedAt: EXECUTED_AT,
    });
    const revisited = beginExpedition(endExpedition(first.save), {
      mapId: MAP_ID,
      toolId: 'tool:field-kit',
      enteredAt: EXECUTED_AT,
    });

    expect(listAvailableCompanionBehaviors(
      revisited, MAP_ID, [ambient], { companionForm: pikachu },
    )).toHaveLength(1);
  });

  it('persiste inmediatamente la secuencia y su recompensa en el navegador', () => {
    localStorage.clear();
    getBrowserPokeVoiceSave();
    setBrowserActiveExpeditionSession({
      schemaVersion: 1,
      mapId: MAP_ID,
      enteredAt: EXECUTED_AT,
      loadout: {
        schemaVersion: 1,
        companion: { schemaVersion: 1, formId: pikachu.formId },
        toolId: 'tool:field-kit',
      },
      completedBehaviorTriggerIds: [],
    });

    executeBrowserCompanionBehavior({
      mapId: MAP_ID,
      trigger: rattataTrigger,
      companionForm: pikachu,
      executedAt: EXECUTED_AT,
      rewards: [{ kind: 'discoveryPoints', amount: 10 }],
    });

    const persisted = getBrowserPokeVoiceSave();
    expect(persisted.pokeDiscover.discoveryPoints).toBe(10);
    expect(persisted.pokeDiscover.mapProgress[MAP_ID].completedBehaviorTriggerIds)
      .toEqual([rattataTrigger.triggerId]);
  });

  it('desbloquea secreto, recompensa y logro de serpiente una sola vez', () => {
    localStorage.clear();
    const ekans: PokemonFormV1 = {
      ...pikachu,
      speciesId: 23,
      formId: 'pokemon-form:23:default',
      slug: 'ekans',
      displayName: 'Ekans',
      types: ['poison'],
      narrativeTags: ['snake'],
      fieldCapabilities: [],
    };
    setBrowserActiveExpeditionSession(createActiveSave(ekans).activeExpeditionSession!);
    const trigger: CompanionBehaviorTriggerV1 = {
      ...rattataTrigger,
      triggerId: 'behavior:tegueste:burrow-middle:snake-intimidation',
      requirement: { kind: 'companionSpecies', speciesId: 23 },
      rewardOriginId: 'reward:tegueste:burrow-intimidation',
      completionEffects: { unlockSecretIds: ['secret:tegueste-forest:burrow-intimidation'] },
    };
    const first = executeBrowserCompanionBehavior({
      mapId: MAP_ID,
      trigger,
      companionForm: ekans,
      executedAt: EXECUTED_AT,
      rewards: [
        { kind: 'trainerExperience', amount: 10 },
        { kind: 'discoveryPoints', amount: 10 },
      ],
    });
    const repeated = executeBrowserCompanionBehavior({
      mapId: MAP_ID,
      trigger,
      companionForm: ekans,
      executedAt: EXECUTED_AT,
      rewards: [{ kind: 'discoveryPoints', amount: 999 }],
    });

    expect(first.save.pokeDiscover.mapProgress[MAP_ID].unlockedSecretIds)
      .toContain('secret:tegueste-forest:burrow-intimidation');
    expect(first.save.pokeDiscover.achievements['cold-blooded']?.achievementId).toBe('cold-blooded');
    expect(first.save.pokeDiscover.discoveryPoints).toBe(10);
    expect(repeated).toMatchObject({ status: 'alreadyCompleted' });
    expect(repeated.save.pokeDiscover.discoveryPoints).toBe(10);
  });
});
