import type {
  AdventureMapV3,
  AmbientActorActionV1,
  AmbientBeatV1,
  AmbientSequenceV3,
} from '../../../packages/contracts/src/index.js';

export function replaceAmbientSequence(
  adventure: AdventureMapV3,
  sequence: AmbientSequenceV3,
): AdventureMapV3 {
  return {
    ...adventure,
    ambientSequences: adventure.ambientSequences.map(candidate => (
      candidate.sequenceId === sequence.sequenceId ? sequence : candidate
    )),
  };
}

export function replaceAmbientBeat(
  sequence: AmbientSequenceV3,
  beat: AmbientBeatV1,
): AmbientSequenceV3 {
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
  const canonicalPrefix = prefix
    .toLocaleLowerCase()
    .replace(/:editor$/u, '')
    .replace(/[^a-z0-9:-]+/gu, '-')
    .replace(/-+/gu, '-')
    .replace(/^-+|-+$/gu, '');
  if (!/^[a-z0-9]+(?::[a-z0-9][a-z0-9-]*)+$/u.test(canonicalPrefix)) {
    throw new Error(`Prefijo de ID técnico inválido: ${prefix}.`);
  }
  const existing = new Set(existingIds);
  let index = 1;
  while (existing.has(`${canonicalPrefix}:${String(index).padStart(2, '0')}`)) index += 1;
  return `${canonicalPrefix}:${String(index).padStart(2, '0')}`;
}
