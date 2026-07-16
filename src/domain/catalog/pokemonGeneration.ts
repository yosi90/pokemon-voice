export const POKEMON_GENERATION_RANGES = Object.freeze({
  1: [1, 151],
  2: [152, 251],
  3: [252, 386],
  4: [387, 493],
  5: [494, 649],
  6: [650, 721],
  7: [722, 809],
  8: [810, 898],
  9: [899, 1025],
} as const);

export type PokemonGenerationId = keyof typeof POKEMON_GENERATION_RANGES;

export const POKEMON_GENERATION_REGIONS: Readonly<Record<PokemonGenerationId, string>> = Object.freeze({
  1: 'Kanto',
  2: 'Johto',
  3: 'Hoenn',
  4: 'Sinnoh',
  5: 'Teselia',
  6: 'Kalos',
  7: 'Alola',
  8: 'Galar',
  9: 'Paldea',
});

export function getPokemonGenerationRegion(generation: number) {
  return isPokemonGenerationId(generation)
    ? POKEMON_GENERATION_REGIONS[generation]
    : undefined;
}

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
