import { getPokemonGenerationId } from '../catalog/pokemonGeneration.js';

export const WHOS_THAT_POKEMON_TEXT_HINTS = 5;
export const WHOS_THAT_POKEMON_TYPE_HINTS = 3;

export interface WhosThatPokemonCandidate {
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

export function createWhosThatPokemonDeck(
  catalog: readonly WhosThatPokemonCandidate[],
  seed: string,
  previousPokemonId?: number,
): WhosThatPokemonCandidate[] {
  const unique = [...new Map(
    catalog
      .filter(candidate => Number.isInteger(candidate.id) && candidate.id > 0 && candidate.name.trim())
      .map(candidate => [candidate.id, { id: candidate.id, name: candidate.name }]),
  ).values()];
  if (!unique.length) throw new Error('Se necesita al menos un Pokémon para iniciar el modo.');

  const random = createSeededRandom(seed);
  for (let index = unique.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [unique[index], unique[swapIndex]] = [unique[swapIndex], unique[index]];
  }

  if (unique.length > 1 && unique[0].id === previousPokemonId) {
    [unique[0], unique[1]] = [unique[1], unique[0]];
  }
  return unique;
}

export function getWhosThatPokemonHints(candidate: WhosThatPokemonCandidate): string[] {
  const displayName = candidate.name.replace(/-/g, ' ');
  const generation = getPokemonGenerationId(candidate.id);
  return [
    generation ? `Apareció por primera vez en la generación ${generation}.` : 'Su generación todavía no está clasificada.',
    `Su nombre tiene ${displayName.replace(/\s/g, '').length} letras.`,
    `Su nombre empieza por «${displayName[0]?.toUpperCase() || '?'}».`,
  ];
}
