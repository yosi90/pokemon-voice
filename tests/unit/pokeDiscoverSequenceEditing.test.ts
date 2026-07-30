import { describe, expect, it } from 'vitest';
import type {
  AdventureMapV3,
  AmbientSequenceV3,
  CompanionSequenceV3,
  MapSequenceV3,
} from '../../packages/contracts/src/index.js';
import {
  movePokeDiscoverSequenceItem,
  replacePokeDiscoverSequence,
  replacePokeDiscoverSequenceAction,
  replacePokeDiscoverSequenceBeat,
} from '../../src/domain/tools/pokeDiscoverSequenceEditing.js';

const ambient: AmbientSequenceV3 = {
  schemaVersion: 1,
  sequenceId: 'ambient:test:01',
  sectorId: 'sector:test:01',
  loop: true,
  blockedPolicy: 'pauseSequence',
  beats: [{
    schemaVersion: 1,
    beatId: 'beat:ambient:test:01',
    actions: [{ kind: 'setVisible', placementId: 'actor:test', visible: true }],
  }],
};
const companion: CompanionSequenceV3 = {
  schemaVersion: 1,
  sequenceId: 'companion:test:01',
  sectorId: 'sector:test:01',
  beats: [{
    schemaVersion: 1,
    beatId: 'beat:companion:test:01',
    actions: [{ kind: 'face', actorRef: 'dynamic:companion', direction: 'down' }],
  }],
};
const map: MapSequenceV3 = {
  schemaVersion: 1,
  sequenceId: 'sequence:map-event:01',
  sectorId: 'sector:test:01',
  beats: [{
    schemaVersion: 1,
    beatId: 'beat:map:test:01',
    actions: [{ kind: 'restorePlayerAppearance' }],
  }],
};
const adventure = {
  schemaVersion: 3,
  mapId: 'map:test',
  title: 'Test',
  tiledMapAssets: [],
  sectors: [],
  actorPlacements: [],
  characterPlacements: [],
  transitions: [],
  variants: [],
  missionIds: [],
  behaviorTriggers: [],
  expressionTriggers: [],
  ambientSequences: [ambient],
  companionSequences: [companion],
  mapSequences: [map],
  rareEncounters: [],
  requiredAssetIds: [],
} satisfies AdventureMapV3;

describe('edición común de secuencias', () => {
  it.each([
    ['ambient', ambient],
    ['companion', companion],
    ['map', map],
  ] as const)('reemplaza %s sin mutar ni perder campos', (family, sequence) => {
    const changed = { ...sequence, customEditorialField: 'conservado' };
    const next = replacePokeDiscoverSequence(adventure, family, changed);

    expect(next).not.toBe(adventure);
    expect(adventure.ambientSequences[0]).toBe(ambient);
    const stored = family === 'ambient'
      ? next.ambientSequences[0]
      : family === 'companion'
        ? next.companionSequences?.[0]
        : next.mapSequences?.[0];
    expect(stored).toMatchObject({
      sequenceId: sequence.sequenceId,
      customEditorialField: 'conservado',
    });
  });

  it('edita pasos y acciones de forma inmutable', () => {
    const sourceBeat = companion.beats[0];
    const nextBeat = replacePokeDiscoverSequenceAction(sourceBeat, 0, {
      kind: 'face',
      actorRef: 'dynamic:companion',
      direction: 'up',
    });
    const nextSequence = replacePokeDiscoverSequenceBeat(companion, 0, nextBeat);

    expect(nextSequence.beats[0].actions[0]).toMatchObject({ direction: 'up' });
    expect(companion.beats[0].actions[0]).toMatchObject({ direction: 'down' });
    expect(movePokeDiscoverSequenceItem(['a', 'b', 'c'], 1, -1))
      .toEqual(['b', 'a', 'c']);
  });
});
