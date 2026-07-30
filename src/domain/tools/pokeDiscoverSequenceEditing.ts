import type {
  AdventureMapV3,
  AmbientSequenceV3,
  CompanionSequenceV3,
  MapSequenceV3,
} from '../../../packages/contracts/src/index.js';

export type PokeDiscoverSequenceFamily = 'ambient' | 'companion' | 'map';
export type PokeDiscoverEditableSequence =
  | AmbientSequenceV3
  | CompanionSequenceV3
  | MapSequenceV3;

type EditableBeat = PokeDiscoverEditableSequence['beats'][number];

export function replacePokeDiscoverSequence(
  adventure: AdventureMapV3,
  family: PokeDiscoverSequenceFamily,
  sequence: PokeDiscoverEditableSequence,
): AdventureMapV3 {
  if (family === 'ambient') return {
    ...adventure,
    ambientSequences: adventure.ambientSequences.map(candidate => (
      candidate.sequenceId === sequence.sequenceId
        ? sequence as AmbientSequenceV3
        : candidate
    )),
  };
  if (family === 'companion') return {
    ...adventure,
    companionSequences: (adventure.companionSequences ?? []).map(candidate => (
      candidate.sequenceId === sequence.sequenceId
        ? sequence as CompanionSequenceV3
        : candidate
    )),
  };
  return {
    ...adventure,
    mapSequences: (adventure.mapSequences ?? []).map(candidate => (
      candidate.sequenceId === sequence.sequenceId
        ? sequence as MapSequenceV3
        : candidate
    )),
  };
}

export function replacePokeDiscoverSequenceBeat<
  Sequence extends PokeDiscoverEditableSequence,
>(
  sequence: Sequence,
  beatIndex: number,
  beat: Sequence['beats'][number],
): Sequence {
  return {
    ...sequence,
    beats: sequence.beats.map((candidate, index) => (
      index === beatIndex ? beat : candidate
    )),
  } as Sequence;
}

export function replacePokeDiscoverSequenceAction<
  Beat extends EditableBeat,
>(
  beat: Beat,
  actionIndex: number,
  action: Beat['actions'][number],
): Beat {
  return {
    ...beat,
    actions: beat.actions.map((candidate, index) => (
      index === actionIndex ? action : candidate
    )),
  } as Beat;
}

export function movePokeDiscoverSequenceItem<Item>(
  items: readonly Item[],
  index: number,
  direction: -1 | 1,
): Item[] {
  const target = index + direction;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) {
    return [...items];
  }
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
