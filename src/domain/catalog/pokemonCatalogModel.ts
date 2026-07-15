import type {
  PokemonFormId,
  PokemonSpeciesId,
  StableId,
} from '../../../packages/contracts/src/index.js';

export interface PokemonCatalogSourceItem {
  id: PokemonSpeciesId;
  name: string;
}

export interface PokemonCatalogSpeciesIdentity {
  speciesId: PokemonSpeciesId;
  slug: string;
}

export interface PokemonCatalogFormIdentity {
  formId: PokemonFormId;
  speciesId: PokemonSpeciesId;
  slug: string;
  isDefault: boolean;
}

export interface PokemonCatalogEntryIdentity {
  entryId: StableId;
  speciesId: PokemonSpeciesId;
  dexNumber: number;
  regionalDex: 'national';
}

export interface PokemonCatalogRecord {
  species: PokemonCatalogSpeciesIdentity;
  form: PokemonCatalogFormIdentity;
  entry: PokemonCatalogEntryIdentity;
}

const createDefaultFormId = (speciesId: PokemonSpeciesId): PokemonFormId => (
  `pokemon-form:${speciesId}:default`
);

const createNationalEntryId = (dexNumber: number): StableId => `national:${dexNumber}`;

export function createDefaultCatalogRecord({
  id,
  name,
}: PokemonCatalogSourceItem): PokemonCatalogRecord {
  return {
    species: { speciesId: id, slug: name },
    form: {
      formId: createDefaultFormId(id),
      speciesId: id,
      slug: name,
      isDefault: true,
    },
    entry: {
      entryId: createNationalEntryId(id),
      speciesId: id,
      dexNumber: id,
      regionalDex: 'national',
    },
  };
}

export function normalizePokemonCatalog(
  source: readonly PokemonCatalogSourceItem[],
): PokemonCatalogRecord[] {
  return source.map(createDefaultCatalogRecord);
}

export function toLegacyPokemonList(
  catalog: readonly PokemonCatalogRecord[],
): PokemonCatalogSourceItem[] {
  return catalog.map(record => ({
    id: record.entry.dexNumber,
    name: record.species.slug,
  }));
}
