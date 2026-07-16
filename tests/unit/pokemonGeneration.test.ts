import { describe, expect, it } from 'vitest';
import {
  getPokemonGenerationRegion,
  POKEMON_GENERATION_REGIONS,
} from '../../src/domain/catalog/pokemonGeneration.js';

describe('regiones de la Pokédex por generación', () => {
  it('asocia las nueve generaciones disponibles con su región', () => {
    expect(POKEMON_GENERATION_REGIONS).toEqual({
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
  });

  it('no inventa una región para generaciones aún no publicadas', () => {
    expect(getPokemonGenerationRegion(1)).toBe('Kanto');
    expect(getPokemonGenerationRegion(10)).toBeUndefined();
  });
});
