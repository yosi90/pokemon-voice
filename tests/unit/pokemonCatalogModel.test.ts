import { describe, expect, it } from 'vitest';
import {
  createDefaultCatalogRecord,
  normalizePokemonCatalog,
  toLegacyPokemonList,
} from '../../src/domain/catalog/pokemonCatalogModel.js';
import {
  createBrowserPokemonCatalogCache,
  parseNormalizedPokemonCatalog,
  POKEMON_CATALOG_CACHE_KEY,
} from '../../src/services/pokemonCatalog.js';

describe('modelo normalizado del catálogo', () => {
  it('asigna identidades distintas a especie, forma y entrada nacional', () => {
    expect(createDefaultCatalogRecord({ id: 25, name: 'pikachu' })).toEqual({
      species: { speciesId: 25, slug: 'pikachu' },
      form: {
        formId: 'pokemon-form:25:default',
        speciesId: 25,
        slug: 'pikachu',
        isDefault: true,
      },
      entry: {
        entryId: 'national:25',
        speciesId: 25,
        dexNumber: 25,
        regionalDex: 'national',
      },
    });
  });

  it('mantiene la proyección plana únicamente como adaptador compatible', () => {
    const catalog = normalizePokemonCatalog([
      { id: 25, name: 'pikachu' },
      { id: 133, name: 'eevee' },
    ]);

    expect(toLegacyPokemonList(catalog)).toEqual([
      { id: 25, name: 'pikachu' },
      { id: 133, name: 'eevee' },
    ]);
  });

  it('rechaza relaciones incoherentes entre las tres identidades', () => {
    const valid = createDefaultCatalogRecord({ id: 25, name: 'pikachu' });
    const invalid = {
      ...valid,
      form: { ...valid.form, speciesId: 133 },
    };

    expect(parseNormalizedPokemonCatalog([invalid])).toEqual([]);
  });

  it('migra la caché plana v1 y escribe en formato normalizado v2', () => {
    const cache = createBrowserPokemonCatalogCache(() => localStorage);
    localStorage.setItem(POKEMON_CATALOG_CACHE_KEY, JSON.stringify({
      schemaVersion: 1,
      entries: [{ id: 25, name: 'pikachu' }],
    }));

    const migrated = cache.load();
    expect(migrated).toEqual([createDefaultCatalogRecord({ id: 25, name: 'pikachu' })]);

    cache.save(migrated);
    const persisted = JSON.parse(localStorage.getItem(POKEMON_CATALOG_CACHE_KEY) || '{}');
    expect(persisted.schemaVersion).toBe(2);
    expect(persisted.records).toEqual(migrated);
    expect(cache.load()).toEqual(migrated);
  });
});
