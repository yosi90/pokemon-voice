import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearPokemonDetailsCache, fetchPokemonDetails } from '../../src/services/pokemonDetails.js';

describe('fetchPokemonDetails', () => {
  beforeEach(() => clearPokemonDetailsCache());

  it('normaliza los tipos por slot y reutiliza la caché', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        id: 1,
        name: 'bulbasaur',
        types: [
          { slot: 2, type: { name: 'poison' } },
          { slot: 1, type: { name: 'grass' } },
        ],
      }),
    })) as unknown as typeof fetch;

    await expect(fetchPokemonDetails(1, fetchImpl)).resolves.toEqual({
      id: 1,
      name: 'bulbasaur',
      types: ['grass', 'poison'],
    });
    await fetchPokemonDetails(1, fetchImpl);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('rechaza respuestas fallidas sin contaminar la caché', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 503 })) as unknown as typeof fetch;

    await expect(fetchPokemonDetails(25, fetchImpl)).rejects.toThrow('PokeAPI respondió 503');
  });
});
