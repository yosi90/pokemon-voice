import { describe, expect, it } from 'vitest';
import type {
  MissionDefinitionV1,
  MissionFlowV1,
} from '../../packages/contracts/src/index.js';
import {
  advanceMissionFlow,
  createLegacyMissionFlow,
  validateMissionFlow,
} from '../../src/domain/expeditions/missionFlow.js';

function flow(): MissionFlowV1 {
  return {
    schemaVersion: 1,
    initialNodeId: 'node:intro',
    nodes: [
      {
        kind: 'conversation',
        nodeId: 'node:intro',
        conversationId: 'conversation:intro',
        outcomes: { accepted: 'node:expedition' },
      },
      {
        kind: 'expedition',
        nodeId: 'node:expedition',
        mapId: 'map:tegueste',
        mapVariantIds: [],
        outcomes: { rescued: 'node:condition' },
      },
      {
        kind: 'condition',
        nodeId: 'node:condition',
        requirement: { kind: 'missionFlag', flagId: 'flag:secret' },
        whenTrueNodeId: 'node:success',
        whenFalseNodeId: 'node:failure',
      },
      { kind: 'terminal', nodeId: 'node:success', result: 'success' },
      { kind: 'terminal', nodeId: 'node:failure', result: 'failure' },
    ],
  };
}

describe('flujo componible de misión', () => {
  it('avanza por resultados jugables, condiciones y convergencias', () => {
    const document = flow();
    expect(validateMissionFlow(document)).toEqual([]);
    expect(advanceMissionFlow(document, 'node:intro', { outcomeId: 'accepted' }))
      .toBe('node:expedition');
    expect(advanceMissionFlow(document, 'node:expedition', { outcomeId: 'rescued' }))
      .toBe('node:condition');
    expect(advanceMissionFlow(document, 'node:condition', {
      evaluateRequirement: () => false,
    })).toBe('node:failure');
  });

  it('rechaza destinos ausentes y cualquier ciclo automático', () => {
    const missing = flow();
    (missing.nodes[0] as Extract<typeof missing.nodes[number], { kind: 'conversation' }>)
      .outcomes.accepted = 'node:missing';
    expect(validateMissionFlow(missing).some(error => error.includes('inexistente'))).toBe(true);

    const cyclic = flow();
    const success = cyclic.nodes.find(node => node.nodeId === 'node:success')!;
    cyclic.nodes[cyclic.nodes.indexOf(success)] = {
      kind: 'conversation',
      nodeId: 'node:success',
      conversationId: 'conversation:again',
      outcomes: {},
      defaultNextNodeId: 'node:intro',
    };
    expect(validateMissionFlow(cyclic)).toContain('El flujo contiene un ciclo automático.');
  });

  it('migra una misión antigua conservando sus IDs de conversaciones', () => {
    const mission: MissionDefinitionV1 = {
      schemaVersion: 1,
      missionId: 'mission:legacy',
      mapId: 'map:owner',
      title: 'Legada',
      loadingText: 'Cargando',
      briefing: 'Ayuda.',
      objectives: [],
      mapVariantIds: ['variant:night'],
      rewards: [],
      unlocksFreeExpedition: false,
      narratives: {
        offerSequenceId: 'conversation:offer',
        successSequenceId: 'conversation:success',
        failureSequenceId: 'conversation:failure',
      },
    };
    const migrated = createLegacyMissionFlow(mission);
    expect(migrated.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'conversation', conversationId: 'conversation:offer' }),
      expect.objectContaining({ kind: 'conversation', conversationId: 'conversation:success' }),
      expect.objectContaining({ kind: 'conversation', conversationId: 'conversation:failure' }),
      expect.objectContaining({ kind: 'expedition', mapId: 'map:owner' }),
    ]));
    expect(validateMissionFlow(migrated)).toEqual([]);
  });
});
