import type { PokemonSpeciesId } from '../../packages/contracts/src/index.js';
import localPokemonCatalog from '../data/pokemonCatalog.json';
import {
  normalizePokemonCatalog,
  type PokemonCatalogRecord,
  type PokemonCatalogSourceItem,
} from '../domain/catalog/pokemonCatalogModel.js';

const POKEMON_LIST_URL = 'https://pokeapi.co/api/v2/pokemon?limit=20000';
export const DEFAULT_MAX_POKEDEX_ID = 1010;
export const POKEMON_CATALOG_CACHE_KEY = 'pokevoice-pokemon-catalog-v1';

export type PokemonListItem = PokemonCatalogSourceItem;

export interface FetchPokemonCatalogOptions {
  fetchImpl?: typeof fetch;
  maxId?: number;
  signal?: AbortSignal;
}

export interface PokemonCatalogCache {
  load: () => PokemonCatalogRecord[];
  save: (records: readonly PokemonCatalogRecord[]) => void;
}

export type PokemonCatalogSource = 'network' | 'cache' | 'local';

export interface PokemonCatalogLoadResult {
  records: PokemonCatalogRecord[];
  source: PokemonCatalogSource;
}

export interface LoadPokemonCatalogOptions extends FetchPokemonCatalogOptions {
  cache?: PokemonCatalogCache | null;
  fallback?: readonly PokemonCatalogSourceItem[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isAbortError(error: unknown) {
  return isRecord(error) && error.name === 'AbortError';
}

function parsePokemonCatalogSource(
  payload: unknown,
  maxId = DEFAULT_MAX_POKEDEX_ID,
): PokemonCatalogSourceItem[] {
  if (!isRecord(payload) || !Array.isArray(payload.results)) {
    throw new Error('La respuesta de PokeAPI no contiene una lista de Pokémon válida.');
  }

  const entries = new Map<PokemonSpeciesId, PokemonCatalogSourceItem>();

  for (const candidate of payload.results) {
    if (!isRecord(candidate) || typeof candidate.name !== 'string' || typeof candidate.url !== 'string') continue;
    const match = candidate.url.match(/\/pokemon\/(\d+)\/?$/);
    const id = match ? Number(match[1]) : Number.NaN;
    const name = candidate.name.trim();

    if (!Number.isInteger(id) || id < 1 || id > maxId || !name) continue;
    if (!entries.has(id)) entries.set(id, { id, name });
  }

  return [...entries.values()].sort((left, right) => left.id - right.id);
}

export function parsePokemonCatalog(
  payload: unknown,
  maxId = DEFAULT_MAX_POKEDEX_ID,
): PokemonCatalogRecord[] {
  return normalizePokemonCatalog(parsePokemonCatalogSource(payload, maxId));
}

export function parsePokemonCatalogEntries(
  payload: unknown,
  maxId = DEFAULT_MAX_POKEDEX_ID,
): PokemonCatalogSourceItem[] {
  if (!Array.isArray(payload)) throw new Error('El catálogo no contiene entradas válidas.');
  const entries = new Map<PokemonSpeciesId, PokemonCatalogSourceItem>();

  for (const candidate of payload) {
    if (!isRecord(candidate) || typeof candidate.name !== 'string') continue;
    const id = Number(candidate.id);
    const name = candidate.name.trim();
    if (!Number.isInteger(id) || id < 1 || id > maxId || !name || entries.has(id)) continue;
    entries.set(id, { id, name });
  }

  return [...entries.values()].sort((left, right) => left.id - right.id);
}

const LOCAL_POKEMON_SOURCE = Object.freeze(parsePokemonCatalogEntries(localPokemonCatalog));
export const LOCAL_POKEMON_CATALOG = Object.freeze(normalizePokemonCatalog(LOCAL_POKEMON_SOURCE));

export async function fetchPokemonCatalog({
  fetchImpl = globalThis.fetch,
  maxId = DEFAULT_MAX_POKEDEX_ID,
  signal,
}: FetchPokemonCatalogOptions = {}): Promise<PokemonCatalogRecord[]> {
  const response = await fetchImpl(POKEMON_LIST_URL, { signal });
  if (!response.ok) throw new Error(`PokeAPI respondió ${response.status}`);
  return parsePokemonCatalog(await response.json(), maxId);
}

export function parseNormalizedPokemonCatalog(
  payload: unknown,
  maxId = DEFAULT_MAX_POKEDEX_ID,
): PokemonCatalogRecord[] {
  if (!Array.isArray(payload)) return [];
  const source: PokemonCatalogSourceItem[] = [];

  for (const candidate of payload) {
    if (!isRecord(candidate)) continue;
    const species = candidate.species;
    const form = candidate.form;
    const entry = candidate.entry;
    if (!isRecord(species) || !isRecord(form) || !isRecord(entry)) continue;

    const speciesId = Number(species.speciesId);
    const dexNumber = Number(entry.dexNumber);
    const slug = typeof species.slug === 'string' ? species.slug.trim() : '';
    const relationshipsAreValid = (
      Number(form.speciesId) === speciesId
      && Number(entry.speciesId) === speciesId
      && dexNumber === speciesId
      && form.isDefault === true
      && form.formId === `pokemon-form:${speciesId}:default`
      && form.slug === slug
      && entry.entryId === `national:${dexNumber}`
      && entry.regionalDex === 'national'
    );
    if (
      !Number.isInteger(speciesId)
      || speciesId < 1
      || speciesId > maxId
      || !slug
      || !relationshipsAreValid
    ) continue;
    source.push({ id: speciesId, name: slug });
  }

  return normalizePokemonCatalog(parsePokemonCatalogEntries(source, maxId));
}

export function createBrowserPokemonCatalogCache(getStorage: () => Storage): PokemonCatalogCache {
  return {
    load() {
      try {
        const raw = getStorage().getItem(POKEMON_CATALOG_CACHE_KEY);
        if (!raw) return [];
        const value: unknown = JSON.parse(raw);
        if (!isRecord(value)) return [];
        if (value.schemaVersion === 2) return parseNormalizedPokemonCatalog(value.records);
        if (value.schemaVersion === 1) {
          return normalizePokemonCatalog(parsePokemonCatalogEntries(value.entries));
        }
        return [];
      } catch {
        return [];
      }
    },

    save(records) {
      try {
        getStorage().setItem(POKEMON_CATALOG_CACHE_KEY, JSON.stringify({
          schemaVersion: 2,
          savedAt: new Date().toISOString(),
          records: parseNormalizedPokemonCatalog(records),
        }));
      } catch {
        // La caché es una optimización; nunca debe impedir jugar.
      }
    },
  };
}

export async function loadPokemonCatalog({
  cache = typeof localStorage === 'undefined'
    ? null
    : createBrowserPokemonCatalogCache(() => localStorage),
  fallback = LOCAL_POKEMON_SOURCE,
  ...fetchOptions
}: LoadPokemonCatalogOptions = {}): Promise<PokemonCatalogLoadResult> {
  try {
    const records = await fetchPokemonCatalog(fetchOptions);
    if (!records.length) throw new Error('PokeAPI devolvió un catálogo vacío.');
    cache?.save(records);
    return { records, source: 'network' };
  } catch (error) {
    if (isAbortError(error)) throw error;
    const cachedRecords = cache?.load() || [];
    if (cachedRecords.length) return { records: cachedRecords, source: 'cache' };
    const fallbackRecords = normalizePokemonCatalog(
      parsePokemonCatalogEntries(fallback, fetchOptions.maxId),
    );
    if (fallbackRecords.length) return { records: fallbackRecords, source: 'local' };
    throw error;
  }
}
