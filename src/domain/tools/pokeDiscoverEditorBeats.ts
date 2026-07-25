import type {
  AdventureMapV2,
  AmbientActorActionV1,
  AmbientBeatV1,
  AmbientSequenceV1,
} from '../../../packages/contracts/src/index.js';

export function replaceAmbientSequence(
  adventure: AdventureMapV2,
  sequence: AmbientSequenceV1,
): AdventureMapV2 {
  return {
    ...adventure,
    ambientSequences: adventure.ambientSequences.map(candidate => (
      candidate.sequenceId === sequence.sequenceId ? sequence : candidate
    )),
  };
}

export function replaceAmbientBeat(
  sequence: AmbientSequenceV1,
  beat: AmbientBeatV1,
): AmbientSequenceV1 {
  return {
    ...sequence,
    beats: sequence.beats.map(candidate => candidate.beatId === beat.beatId ? beat : candidate),
  };
}

export function replaceAmbientAction(
  beat: AmbientBeatV1,
  actionIndex: number,
  action: AmbientActorActionV1,
): AmbientBeatV1 {
  return {
    ...beat,
    actions: beat.actions.map((candidate, index) => index === actionIndex ? action : candidate),
  };
}

export function nextStableEditorId(prefix: string, existingIds: readonly string[]) {
  const existing = new Set(existingIds);
  let index = 1;
  while (existing.has(`${prefix}:editor-${index}`)) index += 1;
  return `${prefix}:editor-${index}`;
}

