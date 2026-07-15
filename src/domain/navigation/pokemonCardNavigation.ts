export type PokemonNavigationKind = 'guessed' | 'remaining';

export interface NavigationTarget {
  id: number;
  index: number;
}

export function getNavigationCandidates(
  visiblePokemonIds: readonly number[],
  guessedIds: ReadonlySet<number>,
  kind: PokemonNavigationKind,
): number[] {
  const wantsGuessed = kind === 'guessed';
  return visiblePokemonIds.filter(id => guessedIds.has(id) === wantsGuessed);
}

export function getNextNavigationTarget(
  visiblePokemonIds: readonly number[],
  guessedIds: ReadonlySet<number>,
  kind: PokemonNavigationKind,
  currentIndex: number,
): NavigationTarget | null {
  const candidates = getNavigationCandidates(visiblePokemonIds, guessedIds, kind);
  if (!candidates.length) return null;

  const index = (currentIndex + 1) % candidates.length;
  return { id: candidates[index], index };
}
