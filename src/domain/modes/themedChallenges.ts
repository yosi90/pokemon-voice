import type {
  ThemedChallengeDefinitionV1,
  ThemedChallengeKind,
} from '../../../packages/contracts/src/index.js';
import importedTriviaChallenges from '../../data/pokemonTriviaChallenges.json';

export interface ThemedChallengeCandidate {
  id: number;
  name: string;
}

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (const character of seed) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed: string) {
  let state = hashSeed(seed) || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function shuffleWithRandom<T>(values: readonly T[], random: () => number) {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function defineChallenge(
  challenge: Omit<ThemedChallengeDefinitionV1, 'schemaVersion'>,
): ThemedChallengeDefinitionV1 {
  if (!challenge.challengeId.trim()) throw new Error('El reto necesita un ID estable.');
  if (challenge.targetCount < 1 || challenge.targetCount > challenge.targetSpeciesIds.length) {
    throw new Error(`El objetivo de ${challenge.challengeId} no cabe en su lista de especies.`);
  }
  if (new Set(challenge.targetSpeciesIds).size !== challenge.targetSpeciesIds.length) {
    throw new Error(`El reto ${challenge.challengeId} contiene especies duplicadas.`);
  }
  return Object.freeze({ schemaVersion: 1, ...challenge });
}

function isThemedChallengeKind(value: string): value is ThemedChallengeKind {
  return value === 'generation' || value === 'type' || value === 'family';
}

const IMPORTED_THEMED_CHALLENGES = importedTriviaChallenges.challenges.map(challenge => {
  if (!isThemedChallengeKind(challenge.kind)) {
    throw new Error(`El reto ${challenge.challengeId} usa una categoría desconocida.`);
  }
  return defineChallenge({ ...challenge, kind: challenge.kind });
});

export const THEMED_CHALLENGES: readonly ThemedChallengeDefinitionV1[] = Object.freeze([
  defineChallenge({
    challengeId: 'generation:kanto-icons',
    kind: 'generation',
    title: 'Iconos de Kanto',
    description: 'Nombra tres Pokémon entre los compañeros más reconocibles de la primera generación.',
    targetSpeciesIds: [1, 4, 6, 7, 25, 130, 133, 150, 151],
    targetCount: 3,
  }),
  defineChallenge({
    challengeId: 'type:deep-roots',
    kind: 'type',
    title: 'Raíces profundas',
    description: 'Encuentra tres Pokémon de tipo Planta repartidos entre distintas generaciones.',
    targetSpeciesIds: [1, 2, 3, 152, 906],
    targetCount: 3,
  }),
  defineChallenge({
    challengeId: 'family:bulbasaur',
    kind: 'family',
    title: 'Mmm, suculento',
    description: 'Nombra tres Pokémon con aspecto de comida.',
    targetSpeciesIds: [102, 420, 582, 583, 584, 684, 685, 710, 761, 840, 841, 842, 854, 855, 868, 869, 926, 927, 928, 951, 952, 978, 1011, 1012, 1013, 1019],
    targetCount: 3,
  }),
  ...IMPORTED_THEMED_CHALLENGES,
]);

export const THEMED_CHALLENGE_KIND_LABELS: Record<ThemedChallengeKind, string> = {
  generation: 'Generación',
  type: 'Tipo',
  family: 'Familia',
};

export function getAvailableThemedChallenges(
  catalog: readonly ThemedChallengeCandidate[],
  definitions: readonly ThemedChallengeDefinitionV1[] = THEMED_CHALLENGES,
) {
  const availableIds = new Set(catalog.map(candidate => candidate.id));
  return definitions.filter(definition => (
    definition.targetSpeciesIds.filter(id => availableIds.has(id)).length >= definition.targetCount
  ));
}

/** Mezcla cada categoría y las intercala para que una página de seis no sea monótona. */
export function mixThemedChallenges(
  definitions: readonly ThemedChallengeDefinitionV1[],
  seed: string,
) {
  const random = createSeededRandom(seed);
  const kindOrder = shuffleWithRandom<ThemedChallengeKind>(['generation', 'type', 'family'], random);
  const groups = new Map(kindOrder.map(kind => [
    kind,
    shuffleWithRandom(definitions.filter(challenge => challenge.kind === kind), random),
  ]));
  const mixed: ThemedChallengeDefinitionV1[] = [];

  while ([...groups.values()].some(group => group.length)) {
    for (const kind of kindOrder) {
      const next = groups.get(kind)?.shift();
      if (next) mixed.push(next);
    }
  }
  return mixed;
}

export function getThemedChallengeById(challengeId: string) {
  return THEMED_CHALLENGES.find(challenge => challenge.challengeId === challengeId);
}

export function getChallengeKindsCompleted(challengeIds: readonly string[]) {
  return new Set(
    challengeIds
      .map(getThemedChallengeById)
      .filter((challenge): challenge is ThemedChallengeDefinitionV1 => Boolean(challenge))
      .map(challenge => challenge.kind),
  );
}
