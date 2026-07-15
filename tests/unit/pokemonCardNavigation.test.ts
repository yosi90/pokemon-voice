import { describe, expect, it } from 'vitest';
import {
  getNavigationCandidates,
  getNextNavigationTarget,
} from '../../src/domain/navigation/pokemonCardNavigation.js';

describe('navegación de tarjetas', () => {
  const visible = [1, 4, 7, 25];
  const guessed = new Set([1, 25]);

  it('separa descubiertos y restantes conservando el orden visible', () => {
    expect(getNavigationCandidates(visible, guessed, 'guessed')).toEqual([1, 25]);
    expect(getNavigationCandidates(visible, guessed, 'remaining')).toEqual([4, 7]);
  });

  it('avanza de forma circular dentro de cada grupo', () => {
    expect(getNextNavigationTarget(visible, guessed, 'guessed', -1)).toEqual({ id: 1, index: 0 });
    expect(getNextNavigationTarget(visible, guessed, 'guessed', 0)).toEqual({ id: 25, index: 1 });
    expect(getNextNavigationTarget(visible, guessed, 'guessed', 1)).toEqual({ id: 1, index: 0 });
  });

  it('no inventa un destino cuando el grupo está vacío', () => {
    expect(getNextNavigationTarget(visible, new Set(), 'guessed', -1)).toBeNull();
    expect(getNextNavigationTarget(visible, new Set(visible), 'remaining', -1)).toBeNull();
  });
});
