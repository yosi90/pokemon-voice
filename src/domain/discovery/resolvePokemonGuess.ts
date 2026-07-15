import {
  esAliases,
  esPhonetic,
  esToEnCorrections,
  levenshtein,
  normalize,
} from '../../../scripts/utils.js';
import type { PokemonListItem } from '../../services/pokemonCatalog.js';

export type PokemonNameIndex = ReadonlyMap<string, number>;

export interface ResolvePokemonNameOptions {
  fromSpeech?: boolean;
}

export interface GuessResolution {
  matched: boolean;
  ids: number[];
  visibleIds: number[];
  sequence: number[];
  raw: string;
  normalized: string;
}

export function createPokemonNameIndex(pokemon: readonly PokemonListItem[]): PokemonNameIndex {
  const index = new Map<string, number>();
  for (const entry of pokemon) {
    const normalizedName = normalize(entry.name);
    index.set(normalizedName, entry.id);
    index.set(normalizedName.replace(/-/g, ' '), entry.id);
  }
  return index;
}

export function resolvePokemonName(
  raw: string,
  index: PokemonNameIndex,
  { fromSpeech = true }: ResolvePokemonNameOptions = {},
): number[] {
  if (!raw) return [];
  let query = normalize(raw);
  if (esToEnCorrections.has(query)) query = normalize(esToEnCorrections.get(query));
  if (esAliases.has(query)) query = normalize(esAliases.get(query));

  const matches = new Set<number>();
  if (index.has(query)) matches.add(index.get(query)!);

  for (const [name, id] of index.entries()) {
    if (name.startsWith(`${query}-`)) matches.add(id);
  }

  const compactQuery = query.replace(/[.\- ]/g, '');
  for (const [name, id] of index.entries()) {
    if (name.replace(/[.\- ]/g, '') === compactQuery) matches.add(id);
  }

  const phoneticQuery = esPhonetic(query);
  for (const [name, id] of index.entries()) {
    if (esPhonetic(name) === phoneticQuery) matches.add(id);
  }

  if (!matches.size) {
    let bestId: number | null = null;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const [name, id] of index.entries()) {
      const score = Math.min(
        levenshtein(name, query),
        levenshtein(esPhonetic(name), phoneticQuery),
      );
      if (score < bestScore) {
        bestScore = score;
        bestId = id;
      }
    }

    const threshold = fromSpeech ? 2 : query.length <= 6 ? 1 : 2;
    if (bestId !== null && bestScore <= threshold) matches.add(bestId);
  }

  return [...matches];
}

export function resolveGuessTranscript(
  raw: string,
  index: PokemonNameIndex,
  visiblePokemonIds: ReadonlySet<number>,
  options: ResolvePokemonNameOptions = {},
): GuessResolution {
  const ids = resolvePokemonName(raw, index, options);
  const visibleIds = ids.filter(id => visiblePokemonIds.has(id));
  return {
    matched: ids.length > 0,
    ids,
    visibleIds,
    sequence: visibleIds.length ? visibleIds : ids,
    raw,
    normalized: normalize(raw),
  };
}
