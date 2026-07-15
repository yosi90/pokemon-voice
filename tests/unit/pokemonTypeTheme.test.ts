import { describe, expect, it } from 'vitest';
import { getPokemonTypeTheme } from '../../src/domain/catalog/pokemonTypeTheme.js';

describe('getPokemonTypeTheme', () => {
  it('usa el tipo primario como identidad y el secundario como acento', () => {
    const theme = getPokemonTypeTheme(['grass', 'poison']);

    expect(theme).toMatchObject({ primaryType: 'grass', secondaryType: 'poison', motif: 'leaves' });
    expect(theme.primary).toBe('#7ac74c');
    expect(theme.secondary).toBe('#5e205d');
  });

  it('mantiene un tema neutro cuando el tipo aún es desconocido', () => {
    expect(getPokemonTypeTheme([])).toMatchObject({ primaryType: 'unknown', motif: 'classified' });
  });

  it('asigna motivos narrativos distintos a tipos que antes compartían patrones', () => {
    expect(getPokemonTypeTheme(['water']).motif).toBe('sea');
    expect(getPokemonTypeTheme(['psychic']).motif).toBe('waves');
    expect(getPokemonTypeTheme(['bug']).motif).toBe('web');
    expect(getPokemonTypeTheme(['steel']).motif).toBe('plates');
    expect(getPokemonTypeTheme(['rock']).motif).toBe('mountains');
  });
});
