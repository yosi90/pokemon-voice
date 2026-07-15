import { describe, expect, it, vi } from 'vitest';
import { pokemonCatalogFixture } from '../fixtures/pokemonCatalog.js';
import {
  createBrowserPokemonCatalogCache,
  fetchPokemonCatalog,
  loadPokemonCatalog,
  LOCAL_POKEMON_CATALOG,
  parsePokemonCatalog,
  POKEMON_CATALOG_CACHE_KEY,
} from '../../src/services/pokemonCatalog.js';
import {
  createDefaultCatalogRecord,
  toLegacyPokemonList,
} from '../../src/domain/catalog/pokemonCatalogModel.js';

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

    expect(toLegacyPokemonList(parsePokemonCatalog(payload, 1010))).toEqual([
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

  it('incluye localmente las 1010 entradas soportadas por la Pokédex', () => {
    expect(LOCAL_POKEMON_CATALOG).toHaveLength(1010);
    expect(LOCAL_POKEMON_CATALOG[0]).toEqual(createDefaultCatalogRecord({ id: 1, name: 'bulbasaur' }));
    expect(LOCAL_POKEMON_CATALOG.at(-1)).toEqual(
      createDefaultCatalogRecord({ id: 1010, name: 'iron-leaves' }),
    );
  });

  it('prioriza red, actualiza la caché y devuelve el origen', async () => {
    const cache = { load: vi.fn(() => []), save: vi.fn() };
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => pokemonCatalogFixture,
    });

    const result = await loadPokemonCatalog({ fetchImpl, cache });

    expect(result.source).toBe('network');
    expect(result.records).toHaveLength(10);
    expect(cache.save).toHaveBeenCalledWith(result.records);
    expect(cache.load).not.toHaveBeenCalled();
  });

  it('usa una caché validada cuando falla la red', async () => {
    const cached = [createDefaultCatalogRecord({ id: 25, name: 'pikachu' })];
    const result = await loadPokemonCatalog({
      fetchImpl: vi.fn().mockRejectedValue(new TypeError('offline')),
      cache: { load: () => cached, save: vi.fn() },
    });

    expect(result).toEqual({ records: cached, source: 'cache' });
  });

  it('recurre al catálogo local si red y caché no están disponibles', async () => {
    const result = await loadPokemonCatalog({
      fetchImpl: vi.fn().mockResolvedValue({ ok: false, status: 503 }),
      cache: { load: () => [], save: vi.fn() },
    });

    expect(result.source).toBe('local');
    expect(result.records).toHaveLength(1010);
  });

  it('ignora una caché corrupta sin afectar otras claves locales', () => {
    const cache = createBrowserPokemonCatalogCache(() => localStorage);
    localStorage.setItem(POKEMON_CATALOG_CACHE_KEY, JSON.stringify({
      schemaVersion: 1,
      entries: [{ id: 'nope', name: '' }],
    }));
    localStorage.setItem('pokevoice-guessed-v1', '[25]');

    expect(cache.load()).toEqual([]);
    expect(localStorage.getItem('pokevoice-guessed-v1')).toBe('[25]');
  });
});
