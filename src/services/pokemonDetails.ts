const POKEMON_DETAILS_URL = 'https://pokeapi.co/api/v2/pokemon';

export interface PokemonDetails {
  id: number;
  name: string;
  types: string[];
}

const detailsCache = new Map<number, PokemonDetails>();

export async function fetchPokemonDetails(id: number, fetchImpl: typeof fetch = globalThis.fetch): Promise<PokemonDetails> {
  const cached = detailsCache.get(id);
  if (cached) return cached;

  const response = await fetchImpl(`${POKEMON_DETAILS_URL}/${id}`);
  if (!response.ok) throw new Error(`PokeAPI respondió ${response.status}`);
  const payload = await response.json();
  const types = Array.isArray(payload?.types)
    ? payload.types
      .slice()
      .sort((left: { slot?: number }, right: { slot?: number }) => Number(left?.slot || 0) - Number(right?.slot || 0))
      .map((entry: { type?: { name?: unknown } }) => entry?.type?.name)
      .filter((type: unknown): type is string => typeof type === 'string' && type.length > 0)
    : [];
  const details = {
    id,
    name: typeof payload?.name === 'string' ? payload.name : '',
    types,
  };
  detailsCache.set(id, details);
  return details;
}

export function clearPokemonDetailsCache() {
  detailsCache.clear();
}
