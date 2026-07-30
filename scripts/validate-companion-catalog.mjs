import { loadCatalogs, validateCatalogs } from './companion-catalog-shared.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const catalogs = await loadCatalogs();
const errors = validateCatalogs(catalogs);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const characterManifest = JSON.parse(fs.readFileSync(
  path.join(root, 'public', 'assets', 'sprites', 'characters', 'manifest.v1.json'),
  'utf8',
));
const characterAssets = new Map(characterManifest.assets.map(asset => [asset.assetId, asset]));
for (const form of catalogs.flatMap(catalog => catalog.species).flatMap(species => species.forms)) {
  const mountAssetId = form.waterTraversal?.mountAssetId;
  if (!mountAssetId) continue;
  const asset = characterAssets.get(mountAssetId);
  if (!asset) errors.push(`${form.formId}: montura inexistente ${mountAssetId}`);
  else if (asset.role !== 'mount') errors.push(`${form.formId}: ${mountAssetId} no tiene role mount`);
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  const speciesCount = catalogs.reduce((total, catalog) => total + catalog.species.length, 0);
  const formCount = catalogs.reduce((total, catalog) => total + catalog.species.reduce((subtotal, species) => subtotal + species.forms.length, 0), 0);
  console.log(`Catálogo válido: ${speciesCount} especies y ${formCount} formas.`);
}
