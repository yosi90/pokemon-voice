import { describe, expect, it } from 'vitest';
import type { AdventureMapV2, AmbientSequenceV1 } from '../../packages/contracts/src/index.js';
import {
  nextStableEditorId,
  replaceAmbientAction,
  replaceAmbientBeat,
  replaceAmbientSequence,
} from '../../src/domain/tools/pokeDiscoverEditorBeats.js';

const sequence: AmbientSequenceV1 = {
  schemaVersion: 1,
  sequenceId: 'ambient:test',
  roomId: 'room:test',
  loop: true,
  blockedPolicy: 'pauseSequence',
  beats: [{
    schemaVersion: 1,
    beatId: 'beat:test',
    actions: [{ kind: 'playAnimation', placementId: 'actor:test', animation: 'Idle' }],
  }],
};

describe('edición inmutable de beats ambientales', () => {
  it('reemplaza acción, beat y secuencia sin modificar el documento original', () => {
    const adventure = { ambientSequences: [sequence] } as AdventureMapV2;
    const action = { kind: 'movePath', placementId: 'actor:test', pathId: 'path:test', movementStyle: 'continuous', speedPixelsPerSecond: 48 } as const;
    const beat = replaceAmbientAction(sequence.beats[0], 0, action);
    const nextSequence = replaceAmbientBeat(sequence, { ...beat, pauseAfterMs: 250 });
    const nextAdventure = replaceAmbientSequence(adventure, nextSequence);

    expect(nextAdventure.ambientSequences[0].beats[0]).toMatchObject({ pauseAfterMs: 250, actions: [action] });
    expect(adventure.ambientSequences[0].beats[0].actions[0]).toMatchObject({ kind: 'playAnimation', animation: 'Idle' });
  });

  it('genera el siguiente ID de autoría sin colisiones', () => {
    expect(nextStableEditorId('beat:test', ['beat:test:editor-1', 'beat:test:editor-2']))
      .toBe('beat:test:editor-3');
  });
});

