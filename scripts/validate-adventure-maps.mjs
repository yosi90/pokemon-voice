import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateTiledAdventureBundle } from '../src/domain/maps/tiledAdventureValidator.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = join(root, 'public');
const mapsRoot = join(publicRoot, 'assets', 'adventure', 'maps');
const manifestPath = join(publicRoot, 'assets', 'sprites', 'pokemon', 'pmd', 'manifest.v1.json');
const characterManifestPath = join(publicRoot, 'assets', 'sprites', 'characters', 'manifest.v1.json');
const mediaManifestPath = join(publicRoot, 'assets', 'adventure', 'media', 'manifest.v1.json');

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

function externalTilesetImages(path) {
  if (extname(path).toLowerCase() !== '.tsx') {
    const definition = json(path);
    return definition.image ? [definition.image] : [];
  }
  const source = readFileSync(path, 'utf8');
  return [...source.matchAll(/<image\b[^>]*\bsource="([^"]+)"/gu)]
    .map(match => match[1]);
}

if (!existsSync(manifestPath)) throw new Error('Falta el manifiesto PMD. Ejecuta npm run assets:pmd:manifest.');
const pmdManifest = json(manifestPath);
if (!existsSync(characterManifestPath)) throw new Error('Falta el manifiesto de personajes.');
const characterManifest = json(characterManifestPath);
const mediaManifest = json(mediaManifestPath);
const errors = [];
for (const asset of pmdManifest.assets ?? []) {
  for (const animation of asset.animations ?? []) {
    if (!Array.isArray(animation.groundOrigins)
      || animation.groundOrigins.length !== Number(animation.directionCount)) {
      errors.push(`${asset.assetId}/${animation.name}: groundOrigins no cubre todas las direcciones`);
      continue;
    }
    animation.groundOrigins.forEach((origin, directionIndex) => {
      if (!Number.isFinite(origin?.x) || !Number.isFinite(origin?.y)
        || origin.x < 0 || origin.x > 1 || origin.y < 0 || origin.y > 1) {
        errors.push(`${asset.assetId}/${animation.name}: pivote inválido en dirección ${directionIndex}`);
      }
    });
  }
}
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
  for (const frame of [asset.idleFrame, ...(asset.walkFrames ?? []), ...(asset.runFrames ?? [])]) {
    if (!Number.isInteger(frame) || frame < 0 || frame >= Number(asset.columns)) {
      errors.push(`${asset.assetId}: frame ${frame} fuera de la hoja`);
    }
  }
  if (asset.runFrameDurationMs !== undefined
    && (!Number.isFinite(asset.runFrameDurationMs) || asset.runFrameDurationMs <= 0)) {
    errors.push(`${asset.assetId}: runFrameDurationMs debe ser positivo`);
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
  const missionPath = sidecarPath.replace(/\.adventure\.json$/iu, '.missions.json');
  const missionDocument = existsSync(missionPath) ? json(missionPath) : undefined;
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
      for (const image of externalTilesetImages(tilesetPath)) {
        if (!existsSync(resolve(dirname(tilesetPath), image))) {
          errors.push(`${asset.assetId}: no existe la imagen ${image}`);
        }
      }
    }
  }
  errors.push(...validateTiledAdventureBundle({
    adventure,
    tiledMaps,
    pmdManifest,
    characterManifest,
    mediaManifest,
    missionDocument,
  }));
}

if (errors.length) {
  console.error(errors.map(error => `- ${error}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Mapas válidos: ${sidecarPaths.length} sidecar, ${pmdManifest.assets.length} assets PMD.`);
}
