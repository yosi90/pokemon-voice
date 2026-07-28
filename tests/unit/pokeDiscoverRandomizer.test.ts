import { describe, expect, it } from 'vitest';
import {
  DEFAULT_POKEDISCOVER_RANDOM_FILTERS,
  POKEDISCOVER_RANDOM_CANDIDATES,
  filterPokeDiscoverCandidates,
  pickRandomPokeDiscoverCandidate,
} from '../../src/domain/tools/pokeDiscoverRandomizer.js';

describe('selector aleatorio de PokeDiscover', () => {
  it('incluye formas persistentes y apariencias, pero no transformaciones de combate', () => {
    expect(POKEDISCOVER_RANDOM_CANDIDATES).toHaveLength(1211);
    expect(POKEDISCOVER_RANDOM_CANDIDATES.some(candidate => candidate.displayName === 'Raichu Alola')).toBe(true);
    expect(POKEDISCOVER_RANDOM_CANDIDATES.some(candidate => candidate.displayName === 'Pikachu surfista')).toBe(true);
    expect(POKEDISCOVER_RANDOM_CANDIDATES.some(candidate => candidate.candidateId === 'pokemon-form:3:mega')).toBe(false);
  });

  it('combina tipo principal, secundario, generación y tamaño mediante AND', () => {
    const matches = filterPokeDiscoverCandidates({
      query: '',
      primaryType: 'grass',
      secondaryType: 'poison',
      generation: 1,
      sizeClass: 'small',
    });

    expect(matches).toEqual(expect.arrayContaining([
      expect.objectContaining({ speciesId: 1, displayName: 'Bulbasaur' }),
    ]));
    expect(matches.every(candidate => candidate.primaryType === 'grass'
      && candidate.secondaryType === 'poison'
      && candidate.generation === 1
      && candidate.sizeClass === 'small')).toBe(true);
  });

  it('permite filtrar Pokémon sin tipo secundario', () => {
    const matches = filterPokeDiscoverCandidates({
      ...DEFAULT_POKEDISCOVER_RANDOM_FILTERS,
      secondaryType: 'none',
    });

    expect(matches.length).toBeGreaterThan(0);
    expect(matches.every(candidate => candidate.secondaryType === null)).toBe(true);
  });

  it('evita repetir inmediatamente cuando existe otra opción', () => {
    const candidates = POKEDISCOVER_RANDOM_CANDIDATES.slice(0, 2);
    const result = pickRandomPokeDiscoverCandidate(candidates, candidates[0].candidateId, () => 0);
    expect(result?.candidateId).toBe(candidates[1].candidateId);
    expect(pickRandomPokeDiscoverCandidate([], undefined, () => 0)).toBeNull();
  });
});
