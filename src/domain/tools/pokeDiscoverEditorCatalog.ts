import type {
  CompanionAppearanceProfileV1,
  CompanionFormProfileV1,
  CompanionSpeciesProfileV1,
  FieldCapabilityV1,
} from '../../../packages/contracts/src/index.js';
import {
  COMPANION_GAMEPLAY_SPECIES,
  toCompanionForm,
} from '../companions/companionGameplayCatalog.js';

export const FIELD_CAPABILITY_LABELS: Readonly<Record<string, string>> = Object.freeze({
  cut: 'Corte',
  surf: 'Surf',
  fly: 'Vuelo',
  dig: 'Excavar',
  archaeology: 'Arqueología',
  'rock-smash': 'Golpe Roca',
  'rock-tomb': 'Tumba Rocas',
  light: 'Destello',
  climb: 'Escalada',
  carry: 'Transporte',
  'ride-ground': 'Montura terrestre',
  'ride-water': 'Montura acuática',
  'ride-air': 'Montura aérea',
});

export interface PokeDiscoverEditorCatalogEntry {
  variantId: string;
  displayName: string;
  species: CompanionSpeciesProfileV1;
  form: CompanionFormProfileV1;
  appearance?: CompanionAppearanceProfileV1;
  capabilities: FieldCapabilityV1[];
  narrativeTags: string[];
  searchText: string;
}

export type PokeDiscoverEditorVariantKind = 'baseForm' | 'alternativeForm' | 'appearance';

export function getPokeDiscoverEditorVariantKind(entry: PokeDiscoverEditorCatalogEntry): PokeDiscoverEditorVariantKind {
  if (entry.appearance) return 'appearance';
  return entry.form.kind === 'default' ? 'baseForm' : 'alternativeForm';
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
}

export function createPokeDiscoverEditorCatalog(
  speciesCatalog: readonly CompanionSpeciesProfileV1[] = COMPANION_GAMEPLAY_SPECIES,
): PokeDiscoverEditorCatalogEntry[] {
  return speciesCatalog.flatMap(species => species.forms.flatMap(form => {
    const variants: Array<CompanionAppearanceProfileV1 | undefined> = [undefined, ...form.appearances];
    return variants.map(appearance => {
      const effectiveForm = toCompanionForm(form, appearance);
      const displayName = appearance?.displayName ?? form.displayName;
      const variantId = appearance?.appearanceId ?? form.formId;
      return {
        variantId,
        displayName,
        species,
        form,
        ...(appearance ? { appearance } : {}),
        capabilities: effectiveForm.fieldCapabilities,
        narrativeTags: effectiveForm.narrativeTags,
        searchText: normalize([
          species.speciesId,
          species.displayName,
          species.slug,
          displayName,
          form.formId,
          appearance?.appearanceId ?? '',
          ...effectiveForm.fieldCapabilities.flatMap(capability => [
            capability.id,
            FIELD_CAPABILITY_LABELS[capability.id] ?? '',
            ...(capability.tags ?? []),
          ]),
          ...effectiveForm.narrativeTags,
        ].join(' ')),
      };
    });
  }));
}

export interface PokeDiscoverEditorCatalogFilter {
  query?: string;
  generation?: number | 'all';
  variantKinds?: readonly PokeDiscoverEditorVariantKind[];
}

export function filterPokeDiscoverEditorCatalog(
  entries: readonly PokeDiscoverEditorCatalogEntry[],
  { query = '', generation = 'all', variantKinds = ['baseForm', 'alternativeForm', 'appearance'] }: PokeDiscoverEditorCatalogFilter,
) {
  const normalizedQuery = normalize(query.trim());
  return entries.filter(entry => (
    (generation === 'all' || entry.species.generation === generation)
    && variantKinds.includes(getPokeDiscoverEditorVariantKind(entry))
    && (!normalizedQuery || entry.searchText.includes(normalizedQuery))
  ));
}

export const POKEDISCOVER_EDITOR_CATALOG = Object.freeze(createPokeDiscoverEditorCatalog());
