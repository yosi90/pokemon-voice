import { describe, expect, it } from 'vitest';
import {
  filterPokeDiscoverEditorCatalog,
  POKEDISCOVER_EDITOR_CATALOG,
} from '../../src/domain/tools/pokeDiscoverEditorCatalog.js';

describe('catálogo local del configurador PokeDiscover', () => {
  it('indexa especies, formas y apariencias sin inventar variantes', () => {
    expect(new Set(POKEDISCOVER_EDITOR_CATALOG.map(entry => entry.species.speciesId))).toHaveLength(1025);
    expect(new Set(POKEDISCOVER_EDITOR_CATALOG.map(entry => entry.form.formId))).toHaveLength(1336);
    expect(POKEDISCOVER_EDITOR_CATALOG.find(entry => entry.variantId === 'pokemon-appearance:25:surfista'))
      .toMatchObject({
        displayName: 'Pikachu surfista',
        capabilities: [expect.objectContaining({ id: 'surf', source: 'story' })],
      });
  });

  it('busca por nombre, número, capacidad y generación', () => {
    expect(filterPokeDiscoverEditorCatalog(POKEDISCOVER_EDITOR_CATALOG, { query: 'tumba rocas' })
      .map(entry => entry.variantId)).toContain('pokemon-form:74:default');
    expect(filterPokeDiscoverEditorCatalog(POKEDISCOVER_EDITOR_CATALOG, { query: '74', generation: 1 })
      .map(entry => entry.displayName)).toContain('Geodude');
    expect(filterPokeDiscoverEditorCatalog(POKEDISCOVER_EDITOR_CATALOG, { query: 'Geodude', generation: 2 }))
      .toEqual([]);
  });

  it('separa formas base, alternativas y apariencias para los filtros visibles', () => {
    expect(filterPokeDiscoverEditorCatalog(POKEDISCOVER_EDITOR_CATALOG, { variantKinds: ['appearance'] })
      .every(entry => Boolean(entry.appearance))).toBe(true);
    expect(filterPokeDiscoverEditorCatalog(POKEDISCOVER_EDITOR_CATALOG, { variantKinds: ['baseForm'] })
      .every(entry => !entry.appearance && entry.form.kind === 'default')).toBe(true);
    expect(filterPokeDiscoverEditorCatalog(POKEDISCOVER_EDITOR_CATALOG, { variantKinds: [] })).toEqual([]);
  });
});
