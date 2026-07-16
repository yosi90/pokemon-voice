import { describe, expect, it } from 'vitest';
import {
  createPokemonNameIndex,
  resolveGuessTranscript,
  resolvePokemonName,
} from '../../src/domain/discovery/resolvePokemonGuess.js';

const index = createPokemonNameIndex([
  { id: 25, name: 'pikachu' },
  { id: 133, name: 'eevee' },
  { id: 6, name: 'charizard' },
  { id: 386, name: 'deoxys-normal' },
  { id: 10001, name: 'deoxys-attack' },
  { id: 984, name: 'great-tusk' },
  { id: 1020, name: 'gouging-fire' },
]);

describe('resolución de nombres Pokémon', () => {
  it('resuelve nombres exactos y alias históricos', () => {
    expect(resolvePokemonName('Pikáchu', index, { fromSpeech: false })).toEqual([25]);
    expect(resolvePokemonName('charizar', index, { fromSpeech: false })).toEqual([6]);
  });

  it('mantiene una tolerancia distinta para voz y teclado', () => {
    expect(resolvePokemonName('aevee', index, { fromSpeech: false })).toEqual([]);
    expect(resolvePokemonName('aevee', index, { fromSpeech: true })).toEqual([133]);
  });

  it('resuelve los nombres españoles de Pokémon Paradoja', () => {
    expect(resolvePokemonName('Colmilargo', index, { fromSpeech: false })).toEqual([984]);
    expect(resolvePokemonName('Flamariete', index, { fromSpeech: false })).toEqual([1020]);
  });

  it('prioriza las formas visibles sin perder las coincidencias globales', () => {
    const result = resolveGuessTranscript('deoxys', index, new Set([10001]), { fromSpeech: true });

    expect(result.ids).toEqual([386, 10001]);
    expect(result.visibleIds).toEqual([10001]);
    expect(result.sequence).toEqual([10001]);
  });
});
