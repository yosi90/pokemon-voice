import { describe, expect, it, vi } from 'vitest';
import { pokemonCatalogFixture } from '../fixtures/pokemonCatalog.js';
import { fetchPokemonCatalog, parsePokemonCatalog } from '../../src/services/pokemonCatalog.js';

describe('catálogo de Pokémon', () => {
  it('valida, ordena, limita y elimina ids duplicados', () => {
    const payload = {
      results: [
        { name: 'chikorita', url: 'https://pokeapi.co/api/v2/pokemon/152/' },
        { name: 'bulbasaur', url: 'https://pokeapi.co/api/v2/pokemon/1/' },
        { name: 'duplicado', url: 'https://pokeapi.co/api/v2/pokemon/1/' },
        { name: 'fuera', url: 'https://pokeapi.co/api/v2/pokemon/9999/' },
        { name: '', url: 'sin-id' },
      ],
    };

    expect(parsePokemonCatalog(payload, 1010)).toEqual([
      { id: 1, name: 'bulbasaur' },
      { id: 152, name: 'chikorita' },
    ]);
  });

  it('rechaza respuestas sin una lista válida', () => {
    expect(() => parsePokemonCatalog({ results: null })).toThrow('lista de Pokémon válida');
  });

  it('encapsula la petición y propaga errores HTTP descriptivos', async () => {
    const successfulFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => pokemonCatalogFixture,
    });
    const failedFetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });

    await expect(fetchPokemonCatalog({ fetchImpl: successfulFetch })).resolves.toHaveLength(10);
    await expect(fetchPokemonCatalog({ fetchImpl: failedFetch })).rejects.toThrow('PokeAPI respondió 503');
  });
});
