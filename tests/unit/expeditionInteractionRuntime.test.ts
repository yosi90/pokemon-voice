import { describe, expect, it } from 'vitest';
import type { ExpeditionInteractionV3 } from '../../packages/contracts/src/index.js';
import {
  facingTowardTarget,
  findFacingInteraction,
  findFacingSpatialDefinition,
  interactionPointInFront,
} from '../../src/domain/maps/expeditionInteractionRuntime.js';

const interaction: ExpeditionInteractionV3 = {
  schemaVersion: 1,
  interactionId: 'interaction:tegueste:talk-camphor',
  sectorId: 'room:tegueste',
  target: { kind: 'placement', placementId: 'character:camphor' },
  prompt: 'Hablar con Alcanfor',
  dialogueId: 'dialogue:tegueste:camphor-warning',
  meaningfulKind: 'npcConversation',
};

describe('resolución espacial de interacciones de expedición', () => {
  it('solo ofrece el objetivo situado en el tile al que mira el jugador', () => {
    const found = findFacingInteraction({
      interactions: [interaction],
      sectorId: 'room:tegueste',
      player: { x: 200, y: 160 },
      facing: 'up',
      resolveTarget: () => ({ x: 200, y: 144 }),
    });
    const missed = findFacingInteraction({
      interactions: [interaction],
      sectorId: 'room:tegueste',
      player: { x: 200, y: 160 },
      facing: 'right',
      resolveTarget: () => ({ x: 200, y: 144 }),
    });

    expect(found?.interactionId).toBe(interaction.interactionId);
    expect(missed).toBeUndefined();
  });

  it('calcula rangos cardinales y la dirección hacia el interlocutor', () => {
    expect(interactionPointInFront({ x: 8, y: 32 }, 'right', 2)).toEqual({ x: 40, y: 32 });
    expect(facingTowardTarget({ x: 200, y: 160 }, { x: 200, y: 144 })).toBe('up');
    expect(facingTowardTarget({ x: 200, y: 160 }, { x: 216, y: 160 })).toBe('right');
  });

  it('reutiliza la misma regla espacial para prompts expresivos', () => {
    const trigger = {
      sectorId: 'room:tegueste',
      target: { kind: 'placement' as const, placementId: 'actor:cottonee' },
      rangeTiles: 1,
      triggerId: 'expression:tegueste:compliment-cottonee',
    };
    expect(findFacingSpatialDefinition({
      definitions: [trigger],
      sectorId: 'room:tegueste',
      player: { x: 128, y: 160 },
      facing: 'up',
      resolveTarget: () => ({ x: 128, y: 144 }),
    })?.triggerId).toBe(trigger.triggerId);
  });
});
