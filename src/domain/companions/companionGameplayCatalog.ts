import type {
  CompanionAppearanceProfileV1,
  CompanionCategoryId,
  CompanionFormProfileV1,
  CompanionGenerationCatalogV1,
  CompanionRequirementV1,
  CompanionSpeciesProfileV1,
  FieldCapabilityV1,
  PokemonAppearanceV1,
  PokemonFormV1,
  PokemonSpeciesV1,
  RequirementExpressionV1,
} from '../../../packages/contracts/src/index.js';
import generation01 from '../../data/pokemon-adventure/generation-01.json';
import generation02 from '../../data/pokemon-adventure/generation-02.json';
import generation03 from '../../data/pokemon-adventure/generation-03.json';
import generation04 from '../../data/pokemon-adventure/generation-04.json';
import generation05 from '../../data/pokemon-adventure/generation-05.json';
import generation06 from '../../data/pokemon-adventure/generation-06.json';
import generation07 from '../../data/pokemon-adventure/generation-07.json';
import generation08 from '../../data/pokemon-adventure/generation-08.json';
import generation09 from '../../data/pokemon-adventure/generation-09.json';

export const COMPANION_CATEGORY_ORDER: readonly CompanionCategoryId[] = Object.freeze([
  'mythical', 'legendary', 'special', 'pseudo-legendary', 'third-evolution',
  'second-evolution', 'baby', 'starter', 'common',
]);

export const COMPANION_CATEGORY_LABELS: Readonly<Record<CompanionCategoryId, string>> = Object.freeze({
  mythical: 'Míticos',
  legendary: 'Legendarios',
  special: 'Especiales',
  'pseudo-legendary': 'Pseudolegendarios',
  'third-evolution': 'Tercera evolución',
  'second-evolution': 'Segunda evolución',
  baby: 'Poké bebés',
  starter: 'Iniciales',
  common: 'Comunes',
});

const catalogs = [generation01, generation02, generation03, generation04, generation05, generation06, generation07, generation08, generation09] as unknown as CompanionGenerationCatalogV1[];
export const COMPANION_GAMEPLAY_SPECIES = Object.freeze(catalogs.flatMap(catalog => catalog.species));
const speciesById = new Map(COMPANION_GAMEPLAY_SPECIES.map(species => [species.speciesId, species]));
const formsById = new Map(COMPANION_GAMEPLAY_SPECIES.flatMap(species => species.forms.map(form => [form.formId, { species, form }] as const)));
const appearancesById = new Map(COMPANION_GAMEPLAY_SPECIES.flatMap(species => species.forms.flatMap(form => form.appearances.map(appearance => [appearance.appearanceId, { species, form, appearance }] as const))));

export function getCompanionCategory(species: CompanionSpeciesProfileV1, form: CompanionFormProfileV1): CompanionCategoryId {
  if (species.traits.mythical) return 'mythical';
  if (species.traits.legendary) return 'legendary';
  if (species.traits.special) return 'special';
  if (species.traits.pseudoLegendary) return 'pseudo-legendary';
  if (form.evolutionStage === 3) return 'third-evolution';
  if (form.evolutionStage === 2) return 'second-evolution';
  if (species.traits.baby) return 'baby';
  if (species.traits.starter) return 'starter';
  return 'common';
}

export function getCompanionSpeciesProfile(speciesId: number) {
  return speciesById.get(speciesId);
}

export function getCompanionFormProfile(formId: string) {
  return formsById.get(formId);
}

export function getCompanionAppearanceProfile(appearanceId: string) {
  return appearancesById.get(appearanceId);
}

function combineRequirements(
  base?: RequirementExpressionV1,
  additional?: RequirementExpressionV1,
): RequirementExpressionV1 | undefined {
  if (base && additional) return { all: [base, additional] };
  return base ?? additional;
}

export function createCompanionRequirement(
  species: CompanionSpeciesProfileV1,
  form: CompanionFormProfileV1,
  appearance?: CompanionAppearanceProfileV1,
): CompanionRequirementV1 {
  const override = appearance?.companionOverride;
  const companion = { ...form.companion, ...override };
  return {
    schemaVersion: 1,
    requirementId: `companion-access:${appearance?.appearanceId ?? form.formId}`,
    speciesId: species.speciesId,
    formId: form.formId,
    ...(appearance ? { appearanceId: appearance.appearanceId } : {}),
    minimumTrainerLevel: companion.minimumTrainerLevel,
    ...(companion.ignoreReferenceLevelGap ? { ignoreReferenceLevelGap: true } : {}),
    ...(combineRequirements(form.companion.extraRequirement, override?.extraRequirement)
      ? { requirement: combineRequirements(form.companion.extraRequirement, override?.extraRequirement) }
      : {}),
    visibility: companion.visibility,
    ...(companion.loreHint ? { loreHint: companion.loreHint } : {}),
    rejectionText: companion.rejectionText,
  };
}

export function toCompanionSpecies(species: CompanionSpeciesProfileV1): PokemonSpeciesV1 {
  return {
    schemaVersion: 1,
    speciesId: species.speciesId,
    slug: species.slug,
    displayName: species.displayName,
    generation: species.generation,
    tags: Object.entries(species.traits).filter(([, enabled]) => enabled).map(([tag]) => tag),
    defaultFormId: `pokemon-form:${species.speciesId}:default`,
    formIds: species.forms.map(form => form.formId),
  };
}

export function toCompanionForm(form: CompanionFormProfileV1, appearance?: CompanionAppearanceProfileV1): PokemonFormV1 {
  const capabilities = new Map<string, FieldCapabilityV1>();
  for (const capability of [...form.fieldCapabilities, ...(appearance?.additionalFieldCapabilities ?? [])]) capabilities.set(capability.id, capability);
  return {
    schemaVersion: 1,
    formId: form.formId,
    speciesId: formsById.get(form.formId)!.species.speciesId,
    slug: form.slug,
    displayName: appearance?.displayName ?? form.displayName,
    kind: form.kind,
    types: form.types,
    evolutionStage: form.evolutionStage,
    companionReferenceLevel: form.companion.minimumTrainerLevel,
    ...(form.heightMeters !== undefined ? { heightMeters: form.heightMeters } : {}),
    ...(form.sizeClass ? { sizeClass: form.sizeClass } : {}),
    narrativeTags: [...new Set([...form.narrativeTags, ...(appearance?.narrativeTags ?? [])])],
    fieldCapabilities: [...capabilities.values()],
  };
}

export function toPokemonAppearance(appearance: CompanionAppearanceProfileV1, speciesId: number, formId: string): PokemonAppearanceV1 {
  return {
    schemaVersion: 1,
    appearanceId: appearance.appearanceId,
    speciesId,
    formId,
    slug: appearance.slug,
    displayName: appearance.displayName,
    kind: appearance.kind,
    narrativeTags: appearance.narrativeTags,
    assetId: appearance.assetId,
  };
}

export function getCompanionArtworkUrl(assetId: string | undefined, speciesId: number) {
  const artworkId = Number(assetId?.match(/^pokeapi-artwork:(\d+)$/)?.[1] ?? speciesId);
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${artworkId}.png`;
}
