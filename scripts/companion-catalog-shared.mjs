import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const MAX_SPECIES_ID = 1025;
export const CAPABILITY_IDS = new Set([
  'cut', 'surf', 'fly', 'dig', 'rock-smash', 'light', 'climb', 'carry',
  'ride-ground', 'ride-water', 'ride-air',
]);
export const GENERATION_RANGES = [[1, 151], [152, 251], [252, 386], [387, 493], [494, 649], [650, 721], [722, 809], [810, 898], [899, 1025]];

export function generationForSpecies(id) {
  const index = GENERATION_RANGES.findIndex(([minimum, maximum]) => id >= minimum && id <= maximum);
  return index < 0 ? null : index + 1;
}

export function primaryCategory(species, form) {
  const traits = species.traits;
  if (traits.mythical) return 'mythical';
  if (traits.legendary) return 'legendary';
  if (traits.special) return 'special';
  if (traits.pseudoLegendary) return 'pseudo-legendary';
  if (form.evolutionStage === 3) return 'third-evolution';
  if (form.evolutionStage === 2) return 'second-evolution';
  if (traits.baby) return 'baby';
  if (traits.starter) return 'starter';
  return 'common';
}

export function validateCatalogs(catalogs) {
  const errors = [];
  const speciesIds = new Set();
  const formIds = new Set();
  const appearanceIds = new Set();
  for (const catalog of catalogs) {
    if (catalog?.schemaVersion !== 1 || catalog.generation < 1 || catalog.generation > 9 || !Array.isArray(catalog.species)) {
      errors.push(`generation-${catalog?.generation ?? 'unknown'}: cabecera inválida`);
      continue;
    }
    for (const species of catalog.species) {
      if (!Number.isInteger(species.speciesId) || species.speciesId < 1 || species.speciesId > MAX_SPECIES_ID) errors.push(`speciesId inválido: ${species.speciesId}`);
      if (species.generation !== catalog.generation || generationForSpecies(species.speciesId) !== catalog.generation) errors.push(`#${species.speciesId}: generación incoherente`);
      if (speciesIds.has(species.speciesId)) errors.push(`#${species.speciesId}: especie duplicada`);
      speciesIds.add(species.speciesId);
      for (const key of ['starter', 'baby', 'pseudoLegendary', 'legendary', 'mythical', 'special']) {
        if (typeof species.traits?.[key] !== 'boolean') errors.push(`#${species.speciesId}: rasgo ${key} ausente`);
      }
      if (!Array.isArray(species.forms) || !species.forms.some(form => form.formId === `pokemon-form:${species.speciesId}:default`)) errors.push(`#${species.speciesId}: falta forma por defecto`);
      for (const form of species.forms ?? []) {
        if (formIds.has(form.formId)) errors.push(`${form.formId}: forma duplicada`);
        formIds.add(form.formId);
        if (![1, 2, 3].includes(form.evolutionStage)) errors.push(`${form.formId}: etapa inválida`);
        const level = form.companion?.minimumTrainerLevel;
        if (!Number.isInteger(level) || level < 1 || level > 100) errors.push(`${form.formId}: nivel inválido`);
        if (!['provisional', 'curated'].includes(form.companion?.balanceStatus)) errors.push(`${form.formId}: balanceStatus inválido`);
        if (!['public', 'hinted', 'secret'].includes(form.companion?.visibility)) errors.push(`${form.formId}: visibilidad inválida`);
        if (!String(form.companion?.rejectionText ?? '').trim()) errors.push(`${form.formId}: falta texto de rechazo`);
        primaryCategory(species, form);
        for (const capability of form.fieldCapabilities ?? []) if (!CAPABILITY_IDS.has(capability.id)) errors.push(`${form.formId}: capacidad desconocida ${capability.id}`);
        for (const appearance of form.appearances ?? []) {
          if (appearanceIds.has(appearance.appearanceId)) errors.push(`${appearance.appearanceId}: apariencia duplicada`);
          appearanceIds.add(appearance.appearanceId);
          for (const capability of appearance.additionalFieldCapabilities ?? []) if (!CAPABILITY_IDS.has(capability.id)) errors.push(`${appearance.appearanceId}: capacidad desconocida ${capability.id}`);
        }
      }
    }
  }
  for (let id = 1; id <= MAX_SPECIES_ID; id += 1) if (!speciesIds.has(id)) errors.push(`#${id}: especie ausente`);
  return errors;
}

export async function loadCatalogs(root = process.cwd()) {
  const directory = path.join(root, 'src', 'data', 'pokemon-adventure');
  return Promise.all(Array.from({ length: 9 }, async (_, index) => JSON.parse(await readFile(path.join(directory, `generation-${String(index + 1).padStart(2, '0')}.json`), 'utf8'))));
}
