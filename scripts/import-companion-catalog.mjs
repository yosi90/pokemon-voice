import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  generationForSpecies,
  loadCatalogs,
  primaryCategory,
  validateCatalogs,
} from './companion-catalog-shared.mjs';

const root = process.cwd();
const outputDirectory = path.join(root, 'src', 'data', 'pokemon-adventure');
const cacheDirectory = path.join(root, 'node_modules', '.cache', 'pokevoice-companion-catalog');
const localCatalog = JSON.parse(await readFile(path.join(root, 'src', 'data', 'pokemonCatalog.json'), 'utf8'))
  .filter(entry => entry.id >= 1 && entry.id <= 1025);

const STARTERS = new Set([
  1, 4, 7, 25, 133, 152, 155, 158, 252, 255, 258, 387, 390, 393,
  495, 498, 501, 650, 653, 656, 722, 725, 728, 810, 813, 816, 906, 909, 912,
]);
const PSEUDO_LEGENDARIES = new Set([149, 248, 373, 376, 445, 635, 706, 784, 887, 998]);
const SPECIAL_SPECIES = new Set([
  793, 794, 795, 796, 797, 798, 799, 803, 804, 805, 806,
  984, 985, 986, 987, 988, 989, 990, 991, 992, 993, 994, 995,
  1005, 1006, 1007, 1008, 1009, 1010, 1020, 1021, 1022, 1023,
]);
const LEVEL_BY_CATEGORY = Object.freeze({
  mythical: 70,
  legendary: 65,
  special: 60,
  'pseudo-legendary': 50,
  'third-evolution': 36,
  'second-evolution': 24,
  baby: 1,
  starter: 1,
  common: 3,
});
const BATTLE_FORM_PATTERN = /(?:^|-)(?:mega(?:-|$)|gmax|totem|eternamax|busted|school|zen|blade|complete|sunshine|rainy|snowy)(?:-|$)/;
const REGIONAL_FORM_PATTERN = /(?:^|-)(alola|galar|hisui|paldea)(?:-|$)/;

await mkdir(cacheDirectory, { recursive: true });
await mkdir(outputDirectory, { recursive: true });

function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function fetchJson(url) {
  const cachePath = path.join(cacheDirectory, `${createHash('sha1').update(url).digest('hex')}.json`);
  try {
    return JSON.parse(await readFile(cachePath, 'utf8'));
  } catch {}
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { 'user-agent': 'PokeVoice companion catalog importer' } });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const value = await response.json();
      await writeFile(cachePath, `${JSON.stringify(value)}\n`);
      return value;
    } catch (error) {
      lastError = error;
      await delay(attempt * 400);
    }
  }
  throw new Error(`No se pudo descargar ${url}: ${lastError}`);
}

async function mapConcurrent(values, concurrency, mapper) {
  const results = new Array(values.length);
  let cursor = 0;
  async function worker() {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
  return results;
}

function idFromUrl(url) {
  return Number(String(url).match(/\/(\d+)\/?$/)?.[1]);
}

function humanize(slug) {
  return slug.split('-').map(part => part ? `${part[0].toUpperCase()}${part.slice(1)}` : part).join(' ');
}

function sizeClass(heightMeters) {
  if (heightMeters < 0.4) return 'tiny';
  if (heightMeters < 1) return 'small';
  if (heightMeters < 2) return 'medium';
  if (heightMeters < 4) return 'large';
  return 'huge';
}

function formSuffix(speciesSlug, pokemonSlug, isDefault) {
  if (isDefault || pokemonSlug === speciesSlug) return 'default';
  const prefix = `${speciesSlug}-`;
  return pokemonSlug.startsWith(prefix) ? pokemonSlug.slice(prefix.length) : pokemonSlug;
}

function appearanceKind(speciesId, slug) {
  if (speciesId === 25 && /(?:cosplay|rock-star|belle|pop-star|phd|libre|cap)/.test(slug)) return 'costume';
  if ((speciesId === 801 && slug.includes('original-color')) || (speciesId === 893 && slug.includes('dada'))) return 'event';
  return null;
}

function formKind(slug, isDefault) {
  if (isDefault) return 'default';
  if (REGIONAL_FORM_PATTERN.test(slug)) return 'regional';
  if (BATTLE_FORM_PATTERN.test(slug)) return 'battle';
  return 'alternate';
}

function curatedCompanion(speciesId, category) {
  const base = {
    minimumTrainerLevel: LEVEL_BY_CATEGORY[category],
    balanceStatus: 'provisional',
    visibility: 'public',
    rejectionText: 'Este Pokémon todavía no quiere abandonar la seguridad de la Pokédex.',
  };
  if (speciesId === 25) return {
    ...base,
    minimumTrainerLevel: 1,
    balanceStatus: 'curated',
    rejectionText: 'Pikachu necesita conocerte un poco mejor antes de salir de expedición.',
  };
  if (speciesId === 150) return {
    ...base,
    minimumTrainerLevel: 90,
    balanceStatus: 'curated',
    ignoreReferenceLevelGap: true,
    visibility: 'hinted',
    loreHint: 'Mewtwo todavía no considera que tu experiencia esté a su altura.',
    rejectionText: 'Mewtwo rechaza acompañarte.',
  };
  if (speciesId === 151) return {
    ...base,
    minimumTrainerLevel: 20,
    balanceStatus: 'curated',
    ignoreReferenceLevelGap: true,
    extraRequirement: { all: [
      { kind: 'sightedSpecies', speciesId: 151 },
      { kind: 'registeredSpeciesByTag', tag: 'sweet', minimum: 20 },
    ] },
    visibility: 'secret',
    loreHint: 'Mew parece sentir curiosidad por los entrenadores de corazón dulce.',
    rejectionText: 'Una presencia juguetona te observa desde algún lugar, pero aún no se acerca.',
  };
  return base;
}

function mergeAppearances(generated, existing = []) {
  const existingById = new Map(existing.map(item => [item.appearanceId, item]));
  const merged = generated.map(item => ({ ...item, ...(existingById.get(item.appearanceId) ?? {}) }));
  for (const item of existing) if (!generated.some(candidate => candidate.appearanceId === item.appearanceId)) merged.push(item);
  return merged;
}

function mergeForm(generated, existing) {
  if (!existing) return generated;
  return {
    ...generated,
    selectableCompanion: existing.selectableCompanion,
    narrativeTags: existing.narrativeTags,
    fieldCapabilities: existing.fieldCapabilities,
    companion: existing.companion,
    appearances: mergeAppearances(generated.appearances, existing.appearances),
  };
}

let existingCatalogs = [];
try { existingCatalogs = await loadCatalogs(root); } catch {}
const existingSpecies = new Map(existingCatalogs.flatMap(catalog => catalog.species).map(species => [species.speciesId, species]));

console.log('Descargando metadatos de 1.025 especies…');
const speciesPayloads = await mapConcurrent(localCatalog, 24, entry => fetchJson(`https://pokeapi.co/api/v2/pokemon-species/${entry.id}`));
const chainUrls = [...new Set(speciesPayloads.map(species => species.evolution_chain?.url).filter(Boolean))];
console.log(`Descargando ${chainUrls.length} cadenas evolutivas…`);
const chainPayloads = await mapConcurrent(chainUrls, 24, fetchJson);
const evolutionStages = new Map();
function walkEvolution(node, stage) {
  const speciesId = idFromUrl(node.species?.url);
  if (speciesId >= 1 && speciesId <= 1025) evolutionStages.set(speciesId, Math.min(3, stage));
  for (const child of node.evolves_to ?? []) walkEvolution(child, stage + 1);
}
for (const chain of chainPayloads) walkEvolution(chain.chain, 1);

const varieties = speciesPayloads.flatMap((species, index) => species.varieties.map(variety => ({
  speciesId: localCatalog[index].id,
  speciesSlug: localCatalog[index].name,
  isDefault: variety.is_default,
  name: variety.pokemon.name,
  url: variety.pokemon.url,
})));
console.log(`Descargando datos de ${varieties.length} formas y variedades…`);
const pokemonPayloads = await mapConcurrent(varieties, 24, variety => fetchJson(variety.url));
const pokemonByUrl = new Map(varieties.map((variety, index) => [variety.url, pokemonPayloads[index]]));

const generatedSpecies = speciesPayloads.map((payload, index) => {
  const source = localCatalog[index];
  const generation = generationForSpecies(source.id);
  const traits = {
    starter: STARTERS.has(source.id),
    baby: Boolean(payload.is_baby),
    pseudoLegendary: PSEUDO_LEGENDARIES.has(source.id),
    legendary: Boolean(payload.is_legendary),
    mythical: Boolean(payload.is_mythical),
    special: SPECIAL_SPECIES.has(source.id),
  };
  const speciesShell = { traits };
  const appearances = [];
  const forms = [];
  for (const variety of varieties.filter(candidate => candidate.speciesId === source.id)) {
    const pokemon = pokemonByUrl.get(variety.url);
    const visualKind = appearanceKind(source.id, variety.name);
    if (visualKind) {
      appearances.push({
        schemaVersion: 1,
        appearanceId: `pokemon-appearance:${source.id}:${formSuffix(source.name, variety.name, false)}`,
        slug: variety.name,
        displayName: humanize(variety.name),
        kind: visualKind,
        assetId: `pokeapi-artwork:${pokemon.id}`,
        selectableCompanion: true,
        narrativeTags: [visualKind],
        additionalFieldCapabilities: [],
      });
      continue;
    }
    const suffix = formSuffix(source.name, variety.name, variety.isDefault);
    const kind = formKind(variety.name, variety.isDefault);
    const stage = evolutionStages.get(source.id) ?? 1;
    const category = primaryCategory(speciesShell, { evolutionStage: stage });
    const heightMeters = Math.max(0, Number(pokemon.height ?? 0) / 10);
    forms.push({
      schemaVersion: 1,
      formId: `pokemon-form:${source.id}:${suffix}`,
      slug: variety.name,
      displayName: variety.isDefault ? humanize(source.name) : humanize(variety.name),
      kind,
      assetId: `pokeapi-artwork:${pokemon.id}`,
      selectableCompanion: kind !== 'battle',
      types: pokemon.types.map(slot => slot.type.name),
      evolutionStage: stage,
      heightMeters,
      sizeClass: sizeClass(heightMeters),
      narrativeTags: kind === 'regional' ? [variety.name.match(REGIONAL_FORM_PATTERN)?.[1]].filter(Boolean) : [],
      fieldCapabilities: [],
      companion: curatedCompanion(source.id, category),
      appearances: [],
    });
  }
  const defaultForm = forms.find(form => form.formId === `pokemon-form:${source.id}:default`);
  if (!defaultForm) throw new Error(`#${source.id} no tiene forma por defecto.`);
  defaultForm.appearances = appearances;
  if (source.id === 25 && !defaultForm.appearances.some(item => item.appearanceId === 'pokemon-appearance:25:surfista')) {
    defaultForm.appearances.push({
      schemaVersion: 1,
      appearanceId: 'pokemon-appearance:25:surfista',
      slug: 'pikachu-surfista',
      displayName: 'Pikachu surfista',
      kind: 'event',
      assetId: 'pokeapi-artwork:25',
      selectableCompanion: true,
      narrativeTags: ['event', 'surfista'],
      additionalFieldCapabilities: [{ id: 'surf', source: 'story', strength: 1, tags: ['rideable'] }],
    });
  }
  const existing = existingSpecies.get(source.id);
  const generatedById = new Map(forms.map(form => [form.formId, form]));
  const mergedForms = forms.map(form => mergeForm(form, existing?.forms.find(candidate => candidate.formId === form.formId)));
  for (const form of existing?.forms ?? []) if (!generatedById.has(form.formId)) mergedForms.push(form);
  return {
    schemaVersion: 1,
    speciesId: source.id,
    slug: source.name,
    displayName: humanize(source.name),
    generation,
    traits: existing?.traits ?? traits,
    forms: mergedForms,
  };
});

const catalogs = Array.from({ length: 9 }, (_, index) => ({
  schemaVersion: 1,
  generation: index + 1,
  species: generatedSpecies.filter(species => species.generation === index + 1),
}));
const errors = validateCatalogs(catalogs);
if (errors.length) throw new Error(`El catálogo generado no es válido:\n${errors.join('\n')}`);
for (const catalog of catalogs) {
  const outputPath = path.join(outputDirectory, `generation-${String(catalog.generation).padStart(2, '0')}.json`);
  await writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`);
}
console.log(`Catálogo actualizado: ${generatedSpecies.length} especies y ${generatedSpecies.reduce((total, species) => total + species.forms.length, 0)} formas.`);
