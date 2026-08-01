import { describe, expect, it } from 'vitest';
import type { MissionDefinitionV1, MissionDefinitionV2 } from '../../packages/contracts/src/index.js';
import { createPokeVoiceSaveV1 } from '../../src/domain/progress/pokeVoiceSave.js';
import {
  advanceActiveMissionFlow,
  resolveActiveMissionFailure,
  settleMissionFlow,
} from '../../src/domain/expeditions/missionFlowRuntime.js';
import { startAdventureMission } from '../../src/domain/expeditions/missionLifecycle.js';
import {
  normalizeAdventureMissionDocument,
  normalizeMissionDefinition,
} from '../../src/domain/expeditions/missionV2.js';

const NOW = '2026-07-31T12:00:00.000Z';

function mission(missionId = 'mission:test'): MissionDefinitionV2 {
  return {
    schemaVersion: 2,
    missionId,
    mapId: 'map:test',
    title: 'Prueba',
    loadingText: 'Cargando',
    briefing: 'Briefing',
    category: 'side',
    publicationStatus: 'published',
    lockedPresentation: { kind: 'hidden' },
    objectives: [],
    rewards: [],
    unlocksFreeExpedition: false,
    abandonment: { allowed: true },
    flow: {
      schemaVersion: 2,
      initialNodeId: 'effect',
      nodes: [
        {
          kind: 'effect',
          nodeId: 'effect',
          effects: [
            { effectId: 'effect:flag', kind: 'setMissionFlag', flagId: 'ready', value: true },
            { effectId: 'effect:counter', kind: 'incrementGlobalCounter', counterId: 'rescues', amount: 1 },
          ],
          nextNodeId: 'travel',
        },
        {
          kind: 'travel',
          nodeId: 'travel',
          expeditionNodeId: 'expedition',
          prompt: '¿Viajar?',
          acceptLabel: 'Ahora',
          postponeLabel: 'Más tarde',
        },
        {
          kind: 'expedition',
          nodeId: 'expedition',
          mapId: 'map:other',
          mapVariantIds: [],
          outcomes: { fail: 'failure', ok: 'success' },
        },
        { kind: 'terminal', nodeId: 'success', result: 'success' },
        {
          kind: 'terminal',
          nodeId: 'failure',
          result: 'failure',
          failureAction: 'retryLastExpedition',
          rollbackPolicy: 'preserveGains',
        },
      ],
    },
  };
}

describe('runtime MissionFlow V2', () => {
  it('aplica efectos una sola vez y conserva el viaje cuando se aplaza', () => {
    const base = createPokeVoiceSaveV1({ runId: 'run:v2', now: Date.parse(NOW) });
    const started = startAdventureMission(base, mission(), {}, NOW).save;
    const settled = settleMissionFlow(started, mission(), { updatedAt: NOW });
    expect(settled.node?.kind).toBe('travel');
    expect(settled.save.pokeDiscover.globalCounters.rescues).toBe(1);
    expect(settled.save.pokeDiscover.missionProgressById['mission:test'].flowNodeId).toBe('travel');

    const repeated = settleMissionFlow(settled.save, mission(), { updatedAt: NOW });
    expect(repeated.save.pokeDiscover.globalCounters.rescues).toBe(1);
    const accepted = advanceActiveMissionFlow(repeated.save, mission(), 'accept', { updatedAt: NOW });
    expect(accepted.node).toMatchObject({ kind: 'expedition', mapId: 'map:other' });
  });

  it('mantiene checkpoints independientes para misiones concurrentes y reintenta el último tramo', () => {
    const one = mission('mission:one');
    const two = mission('mission:two');
    const base = createPokeVoiceSaveV1({ runId: 'run:parallel', now: Date.parse(NOW) });
    const first = startAdventureMission(base, one, {}, NOW).save;
    const both = startAdventureMission(first, two, {}, NOW).save;
    const oneAtTravel = settleMissionFlow(both, one, { updatedAt: NOW }).save;
    expect(oneAtTravel.pokeDiscover.missionProgressById['mission:two'].flowNodeId).toBe('effect');

    const atExpedition = advanceActiveMissionFlow(oneAtTravel, one, 'accept', { updatedAt: NOW }).save;
    const failed = advanceActiveMissionFlow(atExpedition, one, 'fail', { updatedAt: NOW });
    const retried = resolveActiveMissionFailure(failed.save, one, NOW);
    expect(retried.pokeDiscover.missionProgressById['mission:one'].flowNodeId).toBe('expedition');
    expect(retried.pokeDiscover.missionProgressById['mission:two'].flowNodeId).toBe('effect');
  });

  it('normaliza documentos V1 sin alterar identidad ni conversaciones', () => {
    const legacy: MissionDefinitionV1 = {
      schemaVersion: 1,
      missionId: 'mission:legacy-v2',
      mapId: 'map:legacy',
      title: 'Legada',
      loadingText: 'Cargando',
      briefing: 'Briefing',
      objectives: [],
      rewards: [],
      mapVariantIds: [],
      unlocksFreeExpedition: false,
      narratives: { offerSequenceId: 'conversation:offer' },
    };
    const normalized = normalizeMissionDefinition(legacy);
    expect(normalized).toMatchObject({
      schemaVersion: 2,
      missionId: legacy.missionId,
      publicationStatus: 'published',
    });
    expect(normalized.flow?.nodes).toContainEqual(expect.objectContaining({
      kind: 'conversation',
      conversationId: 'conversation:offer',
    }));
    expect(normalizeAdventureMissionDocument({
      schemaVersion: 1,
      mapId: 'map:legacy',
      missions: [legacy],
      narrativeSequences: [],
    }).missions[0].missionId).toBe(legacy.missionId);
  });
});
