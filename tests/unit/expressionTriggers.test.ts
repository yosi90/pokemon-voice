import { beforeEach, describe, expect, it } from 'vitest';
import type { ExpeditionExpressionTriggerV3 } from '../../packages/contracts/src/index.js';
import { beginExpedition } from '../../src/domain/expeditions/expeditionSession.js';
import {
  normalizeExpressionText,
  resolveExpressionTrigger,
} from '../../src/domain/expeditions/expressionTriggers.js';
import { createPokeVoiceSaveV1 } from '../../src/domain/progress/pokeVoiceSave.js';
import {
  getBrowserPokeVoiceSave,
  resolveBrowserExpressionTrigger,
  setBrowserActiveExpeditionSession,
} from '../../src/store/browserPokeVoiceSaveStore.js';

const MAP_ID = 'map:hoenn:sharpedo-bay';
const RESOLVED_AT = '2026-07-17T20:00:00.000Z';

const sharpedoTrigger: ExpeditionExpressionTriggerV3 = {
  schemaVersion: 1,
  triggerId: 'expression:sharpedo-bay:calm-sharpedo',
  activationRequirement: { kind: 'trainerLevel', minimum: 1 },
  inputMethods: ['voice', 'text', 'contextAction'],
  matchAny: [
    { kind: 'phrase', phrases: ['tiburón bonito'], aliases: ['qué tiburón tan bonito'] },
    { kind: 'intent', intent: 'compliment', examples: ['eres un tiburón precioso'] },
  ],
  knownHintIds: ['hint:sharpedo-bay:swimmer-compliment'],
  successSequenceId: 'sequence:sharpedo-bay:sharpedo-calms-down',
  fallbackActionId: 'action:sharpedo-bay:offer-compliment',
  rewardOriginId: 'expression:sharpedo-bay:calm-sharpedo',
  rewardPackageId: 'reward-package:map-secret',
  completionEffects: { unlockSecretIds: ['secret:sharpedo-bay:calmed-sharpedo'] },
};

const shoutTrigger: ExpeditionExpressionTriggerV3 = {
  ...sharpedoTrigger,
  triggerId: 'expression:sharpedo-bay:scare-wingull',
  matchAny: [{ kind: 'acoustic', feature: 'loudness', minimumLevel: 0.7, minimumDurationMs: 400 }],
  successSequenceId: 'sequence:sharpedo-bay:wingull-flees',
  fallbackActionId: 'action:sharpedo-bay:wave-arms',
  rewardOriginId: undefined,
};

function activeSave() {
  const save = createPokeVoiceSaveV1({ runId: 'run:expressions', now: Date.parse(RESOLVED_AT) });
  const prepared = {
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
  return beginExpedition(prepared, {
    mapId: MAP_ID,
    toolId: 'tool:field-kit',
    enteredAt: RESOLVED_AT,
  });
}

describe('interacciones expresivas de expedición', () => {
  beforeEach(() => localStorage.clear());

  it('normaliza mayúsculas, tildes y puntuación sin aceptar contenido adicional', () => {
    expect(normalizeExpressionText('  ¡TIBURÓN, bonito! ')).toBe('tiburon bonito');
    expect(resolveExpressionTrigger(activeSave(), {
      mapId: MAP_ID,
      trigger: sharpedoTrigger,
      attempt: { method: 'voice', transcript: '¡TIBURÓN, bonito!' },
      resolvedAt: RESOLVED_AT,
    }).status).toBe('resolved');
    expect(resolveExpressionTrigger(activeSave(), {
      mapId: MAP_ID,
      trigger: sharpedoTrigger,
      attempt: { method: 'voice', transcript: 'tiburón bonito ven aquí' },
      resolvedAt: RESOLVED_AT,
    })).toMatchObject({ status: 'notMatched', understoodText: 'tiburon bonito ven aqui' });
  });

  it('acepta alias e intenciones curadas pero rechaza intenciones ajenas', () => {
    expect(resolveExpressionTrigger(activeSave(), {
      mapId: MAP_ID,
      trigger: sharpedoTrigger,
      attempt: { method: 'text', transcript: 'Qué tiburón tan bonito' },
      resolvedAt: RESOLVED_AT,
    }).status).toBe('resolved');
    expect(resolveExpressionTrigger(activeSave(), {
      mapId: MAP_ID,
      trigger: sharpedoTrigger,
      attempt: { method: 'voice', intent: 'warn', transcript: 'cuidado' },
      resolvedAt: RESOLVED_AT,
    }).status).toBe('notMatched');
  });

  it('voz, texto y fallback contextual resuelven el mismo secreto una sola vez', () => {
    const first = resolveExpressionTrigger(activeSave(), {
      mapId: MAP_ID,
      trigger: sharpedoTrigger,
      attempt: { method: 'contextAction', contextActionId: sharpedoTrigger.fallbackActionId },
      resolvedAt: RESOLVED_AT,
      rewards: [{ kind: 'discoveryPoints', amount: 10 }],
    });
    const repeated = resolveExpressionTrigger(first.save, {
      mapId: MAP_ID,
      trigger: sharpedoTrigger,
      attempt: { method: 'voice', transcript: 'tiburón bonito' },
      resolvedAt: RESOLVED_AT,
      rewards: [{ kind: 'discoveryPoints', amount: 999 }],
    });

    expect(first).toMatchObject({ status: 'resolved', rewardStatus: 'claimed' });
    expect(first.save.pokeDiscover.mapProgress[MAP_ID]
      .resolvedExpressionTriggers?.[sharpedoTrigger.triggerId]).toEqual({
      schemaVersion: 1,
      triggerId: sharpedoTrigger.triggerId,
      method: 'contextAction',
      resolvedAt: RESOLVED_AT,
    });
    expect(first.save.pokeDiscover.mapProgress[MAP_ID].unlockedSecretIds)
      .toContain('secret:sharpedo-bay:calmed-sharpedo');
    expect(repeated.status).toBe('alreadyResolved');
    expect(repeated.save.pokeDiscover.discoveryPoints).toBe(10);
    expect(repeated.save.pokeDiscover.mapProgress[MAP_ID]
      .resolvedExpressionTriggers?.[sharpedoTrigger.triggerId]?.method).toBe('contextAction');
  });

  it('procesa un grito mediante métricas locales y no conserva audio ni transcripción', () => {
    const result = resolveExpressionTrigger(activeSave(), {
      mapId: MAP_ID,
      trigger: shoutTrigger,
      attempt: {
        method: 'voice',
        acoustic: { loudness: 0.8, durationMs: 500 },
      },
      resolvedAt: RESOLVED_AT,
    });
    const stored = result.save.pokeDiscover.mapProgress[MAP_ID]
      .resolvedExpressionTriggers?.[shoutTrigger.triggerId];

    expect(result.status).toBe('resolved');
    expect(stored).toEqual({
      schemaVersion: 1,
      triggerId: shoutTrigger.triggerId,
      method: 'voice',
      resolvedAt: RESOLVED_AT,
    });
    expect(JSON.stringify(stored)).not.toContain('loudness');
    expect(JSON.stringify(stored)).not.toContain('transcript');
  });

  it('persiste la primera resolución mediante el guardado del navegador', () => {
    getBrowserPokeVoiceSave();
    setBrowserActiveExpeditionSession({
      schemaVersion: 1,
      mapId: MAP_ID,
      enteredAt: RESOLVED_AT,
      companionFormId: 'pokemon-form:25:default',
      toolId: 'tool:field-kit',
    });
    resolveBrowserExpressionTrigger({
      mapId: MAP_ID,
      trigger: sharpedoTrigger,
      attempt: { method: 'text', transcript: 'eres un tiburón precioso' },
      resolvedAt: RESOLVED_AT,
      rewards: [{ kind: 'discoveryPoints', amount: 10 }],
    });

    const persisted = getBrowserPokeVoiceSave().pokeDiscover;
    expect(persisted.mapProgress[MAP_ID]
      .resolvedExpressionTriggers?.[sharpedoTrigger.triggerId]?.method).toBe('text');
    expect(persisted.mapProgress[MAP_ID].unlockedSecretIds)
      .toContain('secret:sharpedo-bay:calmed-sharpedo');
    expect(persisted.discoveryPoints).toBe(10);
    expect(persisted.achievements['first-map-secret']).toBeDefined();
  });
});
