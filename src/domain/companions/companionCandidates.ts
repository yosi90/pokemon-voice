import type {
  CompanionAppearanceProfileV1,
  CompanionCategoryId,
  CompanionFormProfileV1,
  CompanionRequirementV1,
  PokemonFormV1,
  PokemonSpeciesV1,
  PokeVoiceSaveV1,
} from '../../../packages/contracts/src/index.js';
import type { PokemonCatalogRecord } from '../catalog/pokemonCatalogModel.js';
import {
  createCompanionRequirement,
  getCompanionCategory,
  getCompanionSpeciesProfile,
  toCompanionForm,
  toCompanionSpecies,
} from './companionGameplayCatalog.js';
import {
  evaluateCompanionEligibility,
  type CompanionEligibilityResult,
} from './companionEligibility.js';

export interface CompanionCandidate {
  variantId: string;
  record: PokemonCatalogRecord;
  form: PokemonFormV1;
  formProfile: CompanionFormProfileV1;
  appearance?: CompanionAppearanceProfileV1;
  species: PokemonSpeciesV1;
  requirement: CompanionRequirementV1;
  eligibility: CompanionEligibilityResult;
  category: CompanionCategoryId;
  displayName: string;
  assetId?: string;
  selected: boolean;
}

export function createCompanionCatalogSpecies(record: PokemonCatalogRecord): PokemonSpeciesV1 {
  const profile = getCompanionSpeciesProfile(record.species.speciesId);
  if (!profile) throw new Error(`Falta el perfil de compañero para #${record.species.speciesId}.`);
  return toCompanionSpecies(profile);
}

export function createCompanionCatalogForm(record: PokemonCatalogRecord): PokemonFormV1 {
  const profile = getCompanionSpeciesProfile(record.species.speciesId);
  const form = profile?.forms.find(candidate => candidate.formId === record.form.formId);
  if (!profile || !form) throw new Error(`Falta la forma ${record.form.formId} en el catálogo de compañeros.`);
  return toCompanionForm(form);
}

function isFormUnlocked(form: CompanionFormProfileV1, save: PokeVoiceSaveV1) {
  return form.formId.endsWith(':default') || Boolean(save.pokeDiscover.discoveredForms[form.formId]);
}

function isSelected(save: PokeVoiceSaveV1, formId: string, appearanceId?: string) {
  const selection = save.pokedexRun.selectedCompanion
    ?? (save.pokedexRun.selectedCompanionFormId
      ? { schemaVersion: 1 as const, formId: save.pokedexRun.selectedCompanionFormId }
      : undefined);
  return selection?.formId === formId && selection.appearanceId === appearanceId;
}

const STATUS_ORDER = Object.freeze({ eligible: 0, ineligible: 1, unregistered: 2 });

export function getCompanionCandidates(
  records: readonly PokemonCatalogRecord[],
  save: PokeVoiceSaveV1,
): CompanionCandidate[] {
  const registered = new Set(save.pokedexRun.registeredSpeciesIds);
  const speciesCatalog = records.map(createCompanionCatalogSpecies);
  const candidates: CompanionCandidate[] = [];

  for (const record of records) {
    if (!registered.has(record.species.speciesId)) continue;
    const speciesProfile = getCompanionSpeciesProfile(record.species.speciesId);
    if (!speciesProfile) continue;
    const species = toCompanionSpecies(speciesProfile);
    for (const formProfile of speciesProfile.forms) {
      if (!formProfile.selectableCompanion || !isFormUnlocked(formProfile, save)) continue;
      const form = toCompanionForm(formProfile);
      const requirement = createCompanionRequirement(speciesProfile, formProfile);
      candidates.push({
        variantId: formProfile.formId,
        record,
        form,
        formProfile,
        species,
        requirement,
        eligibility: evaluateCompanionEligibility({ save, definition: requirement, form, species: speciesCatalog }),
        category: getCompanionCategory(speciesProfile, formProfile),
        displayName: formProfile.displayName,
        assetId: formProfile.assetId,
        selected: isSelected(save, formProfile.formId),
      });

      for (const appearance of formProfile.appearances) {
        if (!appearance.selectableCompanion || !save.pokeDiscover.discoveredAppearances[appearance.appearanceId]) continue;
        const appearanceForm = toCompanionForm(formProfile, appearance);
        const appearanceRequirement = createCompanionRequirement(speciesProfile, formProfile, appearance);
        candidates.push({
          variantId: appearance.appearanceId,
          record,
          form: appearanceForm,
          formProfile,
          appearance,
          species,
          requirement: appearanceRequirement,
          eligibility: evaluateCompanionEligibility({ save, definition: appearanceRequirement, form: appearanceForm, species: speciesCatalog }),
          category: getCompanionCategory(speciesProfile, formProfile),
          displayName: appearance.displayName,
          assetId: appearance.assetId,
          selected: isSelected(save, formProfile.formId, appearance.appearanceId),
        });
      }
    }
  }

  return candidates.sort((left, right) => (
    Number(right.selected) - Number(left.selected)
    || STATUS_ORDER[left.eligibility.status] - STATUS_ORDER[right.eligibility.status]
    || left.record.species.speciesId - right.record.species.speciesId
    || left.displayName.localeCompare(right.displayName, 'es')
  ));
}
