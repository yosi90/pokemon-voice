import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateTiledAdventureBundle } from '../src/domain/maps/tiledAdventureValidator.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = join(root, 'public');
const mapsRoot = join(publicRoot, 'assets', 'adventure', 'maps');
const manifestPath = join(publicRoot, 'assets', 'sprites', 'pokemon', 'pmd', 'manifest.v1.json');

function json(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`${path}: JSON inválido (${error.message}).`);
  }
}

function findFiles(directory, suffix) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? findFiles(path, suffix) : entry.name.endsWith(suffix) ? [path] : [];
  });
}

if (!existsSync(manifestPath)) throw new Error('Falta el manifiesto PMD. Ejecuta npm run assets:pmd:manifest.');
const pmdManifest = json(manifestPath);
const sidecarPaths = findFiles(mapsRoot, '.adventure.json');
if (!sidecarPaths.length) throw new Error('No se encontraron sidecars .adventure.json.');
const errors = [];

for (const sidecarPath of sidecarPaths) {
  const adventure = json(sidecarPath);
  const tiledMaps = {};
  for (const asset of adventure.tiledMapAssets ?? []) {
    const tmjPath = join(publicRoot, ...String(asset.path).split('/'));
    if (!existsSync(tmjPath)) {
      errors.push(`${adventure.mapId}: no existe ${asset.path}`);
      continue;
    }
    const tiled = json(tmjPath);
    tiledMaps[asset.assetId] = tiled;
    for (const tileset of tiled.tilesets ?? []) {
      if (!tileset.source) continue;
      const tilesetPath = resolve(dirname(tmjPath), tileset.source);
      if (!existsSync(tilesetPath)) {
        errors.push(`${asset.assetId}: no existe el tileset ${tileset.source}`);
        continue;
      }
      const definition = json(tilesetPath);
      if (definition.image && !existsSync(resolve(dirname(tilesetPath), definition.image))) {
        errors.push(`${asset.assetId}: no existe la imagen ${definition.image}`);
      }
    }
  }
  errors.push(...validateTiledAdventureBundle({ adventure, tiledMaps, pmdManifest }));
}

if (errors.length) {
  console.error(errors.map(error => `- ${error}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Mapas válidos: ${sidecarPaths.length} sidecar, ${pmdManifest.assets.length} assets PMD.`);
}
