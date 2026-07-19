import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateTiledAdventureBundle } from '../src/domain/maps/tiledAdventureValidator.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = join(root, 'public');
const mapsRoot = join(publicRoot, 'assets', 'adventure', 'maps');
const manifestPath = join(publicRoot, 'assets', 'sprites', 'pokemon', 'pmd', 'manifest.v1.json');
const characterManifestPath = join(publicRoot, 'assets', 'sprites', 'characters', 'manifest.v1.json');

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

function pngDimensions(path) {
  const buffer = readFileSync(path);
  if (buffer.length < 24 || buffer.toString('ascii', 1, 4) !== 'PNG') return undefined;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

if (!existsSync(manifestPath)) throw new Error('Falta el manifiesto PMD. Ejecuta npm run assets:pmd:manifest.');
const pmdManifest = json(manifestPath);
if (!existsSync(characterManifestPath)) throw new Error('Falta el manifiesto de personajes.');
const characterManifest = json(characterManifestPath);
const errors = [];
for (const asset of characterManifest.assets ?? []) {
  const path = join(publicRoot, ...String(asset.path).split('/'));
  if (!existsSync(path)) {
    errors.push(`${asset.assetId}: no existe ${asset.path}`);
    continue;
  }
  const dimensions = pngDimensions(path);
  if (!dimensions) {
    errors.push(`${asset.assetId}: ${asset.path} no es un PNG válido`);
    continue;
  }
  const expectedWidth = Number(asset.frameWidth) * Number(asset.columns);
  const expectedHeight = Number(asset.frameHeight) * Number(asset.rows);
  if (dimensions.width !== expectedWidth || dimensions.height !== expectedHeight) {
    errors.push(`${asset.assetId}: la hoja mide ${dimensions.width}x${dimensions.height}, esperaba ${expectedWidth}x${expectedHeight}`);
  }
  for (const [direction, row] of Object.entries(asset.directionRows ?? {})) {
    if (!Number.isInteger(row) || row < 0 || row >= Number(asset.rows)) {
      errors.push(`${asset.assetId}: fila inválida para ${direction}`);
    }
  }
  for (const frame of [asset.idleFrame, ...(asset.walkFrames ?? [])]) {
    if (!Number.isInteger(frame) || frame < 0 || frame >= Number(asset.columns)) {
      errors.push(`${asset.assetId}: frame ${frame} fuera de la hoja`);
    }
  }
  if (asset.renderScale !== undefined
    && (!Number.isFinite(asset.renderScale) || asset.renderScale < 0.25 || asset.renderScale > 2)) {
    errors.push(`${asset.assetId}: renderScale debe estar entre 0.25 y 2`);
  }
}
const sidecarPaths = findFiles(mapsRoot, '.adventure.json');
if (!sidecarPaths.length) throw new Error('No se encontraron sidecars .adventure.json.');

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
  errors.push(...validateTiledAdventureBundle({ adventure, tiledMaps, pmdManifest, characterManifest }));
}

if (errors.length) {
  console.error(errors.map(error => `- ${error}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Mapas válidos: ${sidecarPaths.length} sidecar, ${pmdManifest.assets.length} assets PMD.`);
}
