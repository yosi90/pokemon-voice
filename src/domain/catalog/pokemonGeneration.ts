export const POKEMON_GENERATION_RANGES = Object.freeze({
  1: [1, 151],
  2: [152, 251],
  3: [252, 386],
  4: [387, 493],
  5: [494, 649],
  6: [650, 721],
  7: [722, 809],
  8: [810, 898],
  9: [899, 1010],
} as const);

export type PokemonGenerationId = keyof typeof POKEMON_GENERATION_RANGES;

export function isPokemonGenerationId(value: number): value is PokemonGenerationId {
  return Number.isInteger(value) && value >= 1 && value <= 9;
}

export function getPokemonGenerationId(pokemonId: number): PokemonGenerationId | null {
  for (const [generation, [minimum, maximum]] of Object.entries(POKEMON_GENERATION_RANGES)) {
    if (pokemonId >= minimum && pokemonId <= maximum) {
      return Number(generation) as PokemonGenerationId;
    }
  }
  return null;
}
