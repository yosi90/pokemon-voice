import type { PokemonSpeciesId } from '../../packages/contracts/src/index.js';

const POKEMON_LIST_URL = 'https://pokeapi.co/api/v2/pokemon?limit=20000';
export const DEFAULT_MAX_POKEDEX_ID = 1010;

export interface PokemonListItem {
  id: PokemonSpeciesId;
  name: string;
}

export interface FetchPokemonCatalogOptions {
  fetchImpl?: typeof fetch;
  maxId?: number;
  signal?: AbortSignal;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function parsePokemonCatalog(payload: unknown, maxId = DEFAULT_MAX_POKEDEX_ID): PokemonListItem[] {
  if (!isRecord(payload) || !Array.isArray(payload.results)) {
    throw new Error('La respuesta de PokeAPI no contiene una lista de Pokémon válida.');
  }

  const entries = new Map<PokemonSpeciesId, PokemonListItem>();

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

export async function fetchPokemonCatalog({
  fetchImpl = globalThis.fetch,
  maxId = DEFAULT_MAX_POKEDEX_ID,
  signal,
}: FetchPokemonCatalogOptions = {}): Promise<PokemonListItem[]> {
  const response = await fetchImpl(POKEMON_LIST_URL, { signal });
  if (!response.ok) throw new Error(`PokeAPI respondió ${response.status}`);
  return parsePokemonCatalog(await response.json(), maxId);
}
