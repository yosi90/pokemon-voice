import { describe, expect, it } from 'vitest';
import {
  createWhosThatPokemonDeck,
  getWhosThatPokemonHints,
} from '../../src/domain/modes/whosThatPokemon.js';

const catalog = Array.from({ length: 20 }, (_, index) => ({
  id: index + 1,
  name: index === 11 ? 'mr-mime' : `pokemon-${index + 1}`,
}));

describe('¿Quién es ese Pokémon?', () => {
  it('baraja todo el catálogo sin repeticiones y de forma determinista', () => {
    const first = createWhosThatPokemonDeck(catalog, 'run:test');
    const repeated = createWhosThatPokemonDeck(catalog, 'run:test');
    const another = createWhosThatPokemonDeck(catalog, 'run:other');

    expect(first).toHaveLength(catalog.length);
    expect(new Set(first.map(candidate => candidate.id)).size).toBe(catalog.length);
    expect(repeated).toEqual(first);
    expect(another).not.toEqual(first);
  });

  it('ofrece pistas graduales sin revelar directamente la respuesta', () => {
    expect(getWhosThatPokemonHints({ id: 122, name: 'mr-mime' })).toEqual([
      'Apareció por primera vez en la generación 1.',
      'Su nombre tiene 6 letras.',
      'Su nombre empieza por «M».',
    ]);
  });

  it('evita repetir el último Pokémon al comenzar un nuevo ciclo', () => {
    const first = createWhosThatPokemonDeck(catalog, 'cycle:one');
    const next = createWhosThatPokemonDeck(catalog, 'cycle:two', first.at(-1)?.id);

    expect(next[0].id).not.toBe(first.at(-1)?.id);
  });

  it('rechaza catálogos vacíos', () => {
    expect(() => createWhosThatPokemonDeck([], 'empty'))
      .toThrow('Se necesita al menos un Pokémon');
  });
});
