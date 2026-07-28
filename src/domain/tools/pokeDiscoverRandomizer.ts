import type { PokemonSizeClass, PokemonTypeId } from '../../../packages/contracts/src/index.js';
import { COMPANION_GAMEPLAY_SPECIES } from '../companions/companionGameplayCatalog.js';

export const POKEMON_TYPE_LABELS: Readonly<Record<PokemonTypeId, string>> = Object.freeze({
  normal: 'Normal', fire: 'Fuego', water: 'Agua', electric: 'Eléctrico', grass: 'Planta',
  ice: 'Hielo', fighting: 'Lucha', poison: 'Veneno', ground: 'Tierra', flying: 'Volador',
  psychic: 'Psíquico', bug: 'Bicho', rock: 'Roca', ghost: 'Fantasma', dragon: 'Dragón',
  dark: 'Siniestro', steel: 'Acero', fairy: 'Hada',
});

export const POKEMON_SIZE_LABELS: Readonly<Record<PokemonSizeClass, string>> = Object.freeze({
  tiny: 'Diminuto', small: 'Pequeño', medium: 'Mediano', large: 'Grande', huge: 'Enorme',
});

export const POKEMON_TYPE_OPTIONS = Object.freeze(Object.keys(POKEMON_TYPE_LABELS) as PokemonTypeId[]);
export const POKEMON_SIZE_OPTIONS = Object.freeze(Object.keys(POKEMON_SIZE_LABELS) as PokemonSizeClass[]);

export interface PokeDiscoverRandomCandidate {
  candidateId: string;
  speciesId: number;
  displayName: string;
  speciesName: string;
  generation: number;
  primaryType: PokemonTypeId;
  secondaryType: PokemonTypeId | null;
  sizeClass: PokemonSizeClass;
  heightMeters: number;
  assetId: string;
  variantKind: 'form' | 'appearance';
}

export interface PokeDiscoverRandomFilters {
  query: string;
  primaryType: PokemonTypeId | 'all';
  secondaryType: PokemonTypeId | 'all' | 'none';
  generation: number | 'all';
  sizeClass: PokemonSizeClass | 'all';
}

export const DEFAULT_POKEDISCOVER_RANDOM_FILTERS: Readonly<PokeDiscoverRandomFilters> = Object.freeze({
  query: '',
  primaryType: 'all',
  secondaryType: 'all',
  generation: 'all',
  sizeClass: 'all',
});

export const POKEDISCOVER_RANDOM_CANDIDATES: readonly PokeDiscoverRandomCandidate[] = Object.freeze(
  COMPANION_GAMEPLAY_SPECIES.flatMap(species => species.forms.flatMap(form => {
    if (!form.selectableCompanion || !form.sizeClass || form.heightMeters === undefined) return [];
    const shared = {
      speciesId: species.speciesId,
      speciesName: species.displayName,
      generation: species.generation,
      primaryType: form.types[0],
      secondaryType: form.types[1] ?? null,
      sizeClass: form.sizeClass,
      heightMeters: form.heightMeters,
    };
    const formCandidate: PokeDiscoverRandomCandidate = {
      ...shared,
      candidateId: form.formId,
      displayName: form.displayName,
      assetId: form.assetId,
      variantKind: 'form',
    };
    const appearances: PokeDiscoverRandomCandidate[] = form.appearances
      .filter(appearance => appearance.selectableCompanion)
      .map(appearance => ({
        ...shared,
        candidateId: appearance.appearanceId,
        displayName: appearance.displayName,
        assetId: appearance.assetId,
        variantKind: 'appearance',
      }));
    return [formCandidate, ...appearances];
  })),
);

export function filterPokeDiscoverCandidates(
  filters: PokeDiscoverRandomFilters,
  candidates: readonly PokeDiscoverRandomCandidate[] = POKEDISCOVER_RANDOM_CANDIDATES,
) {
  const query = filters.query.trim().toLocaleLowerCase('es');
  return candidates.filter(candidate => {
    if (query && ![
      candidate.displayName,
      candidate.speciesName,
      candidate.assetId,
      String(candidate.speciesId),
      `#${String(candidate.speciesId).padStart(4, '0')}`,
    ].some(value => value.toLocaleLowerCase('es').includes(query))) return false;
    if (filters.primaryType !== 'all' && candidate.primaryType !== filters.primaryType) return false;
    if (filters.secondaryType === 'none' && candidate.secondaryType !== null) return false;
    if (filters.secondaryType !== 'all' && filters.secondaryType !== 'none'
      && candidate.secondaryType !== filters.secondaryType) return false;
    if (filters.generation !== 'all' && candidate.generation !== filters.generation) return false;
    if (filters.sizeClass !== 'all' && candidate.sizeClass !== filters.sizeClass) return false;
    return true;
  });
}

export function pickRandomPokeDiscoverCandidate(
  candidates: readonly PokeDiscoverRandomCandidate[],
  previousCandidateId?: string,
  random: () => number = Math.random,
) {
  if (candidates.length === 0) return null;
  const pool = candidates.length > 1 && previousCandidateId
    ? candidates.filter(candidate => candidate.candidateId !== previousCandidateId)
    : candidates;
  const index = Math.min(pool.length - 1, Math.floor(Math.max(0, random()) * pool.length));
  return pool[index] ?? null;
}
