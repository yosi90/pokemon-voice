export interface PokeDiscoverPokemonAssetIdentity {
  speciesOrForm: string;
  appearance: string;
  anchorAliases: string[];
}

const LEGACY_ANCHOR_ALIASES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  sirfetchd: Object.freeze(['sirfetch']),
});

function technicalToken(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('es')
    .replace(/['’]/gu, '')
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
}

export function parsePokeDiscoverPokemonAssetIdentity(
  assetId: string,
): PokeDiscoverPokemonAssetIdentity {
  const match = /^pmd:\d+-([^:]+):([^:]+)$/u.exec(assetId);
  if (!match) throw new Error(`El asset Pokémon no cumple la convención PMD: ${assetId || '(vacío)'}.`);
  const speciesOrForm = technicalToken(match[1]);
  const appearance = technicalToken(match[2]);
  if (!speciesOrForm || !appearance) {
    throw new Error(`El asset Pokémon no permite derivar un ID técnico: ${assetId}.`);
  }
  const apostropheBase = /['’]/u.test(match[1])
    ? technicalToken(match[1].split(/['’]/u)[0])
    : '';
  return {
    speciesOrForm,
    appearance,
    anchorAliases: [...new Set([
      speciesOrForm,
      apostropheBase,
      ...(LEGACY_ANCHOR_ALIASES[speciesOrForm] ?? []),
    ].filter(Boolean))],
  };
}

export function normalizePokeDiscoverAnchorSegment(value: string) {
  return technicalToken(value);
}
