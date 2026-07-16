import type { CompanionRequirementV1 } from '../../../packages/contracts/src/index.js';
import type { PokemonCatalogRecord } from '../catalog/pokemonCatalogModel.js';
import {
  createCompanionRequirement,
  getCompanionSpeciesProfile,
} from './companionGameplayCatalog.js';

export const COMPANION_REQUIREMENT_IDS = Object.freeze({
  standard: 'companion-access:standard',
  pikachu: 'companion-access:pokemon-form:25:default',
  mew: 'companion-access:pokemon-form:151:default',
  mewtwo: 'companion-access:pokemon-form:150:default',
});

export function getCompanionRequirement(record: PokemonCatalogRecord): CompanionRequirementV1 {
  const species = getCompanionSpeciesProfile(record.species.speciesId);
  const form = species?.forms.find(candidate => candidate.formId === record.form.formId);
  if (!species || !form) throw new Error(`No existe configuración de compañero para ${record.form.formId}.`);
  return createCompanionRequirement(species, form);
}

export function isSecretCompanionRequirement(record: PokemonCatalogRecord) {
  return getCompanionRequirement(record).visibility === 'secret';
}
