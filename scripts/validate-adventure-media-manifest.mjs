import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(root, 'public');
const mediaPath = path.join(publicRoot, 'assets', 'adventure', 'media', 'manifest.v1.json');
const charactersPath = path.join(publicRoot, 'assets', 'sprites', 'characters', 'manifest.v1.json');
const readJson = filePath => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const assertPublicFile = (assetPath, label) => {
  const resolved = path.resolve(publicRoot, assetPath);
  if (!resolved.startsWith(`${publicRoot}${path.sep}`) || !fs.existsSync(resolved)) {
    throw new Error(`${label}: no existe ${assetPath} dentro de public/.`);
  }
};

const media = readJson(mediaPath);
if (media.schemaVersion !== 1 || !Array.isArray(media.assets)) {
  throw new Error('El manifiesto global de medios no cumple AdventureMediaManifestV1.');
}
const ids = new Set();
for (const asset of media.assets) {
  if (!asset.assetId || ids.has(asset.assetId)) throw new Error(`Asset de medios duplicado o vacío: ${asset.assetId}.`);
  ids.add(asset.assetId);
  assertPublicFile(asset.path, asset.assetId);
  const extension = path.extname(asset.path).toLowerCase();
  if (asset.kind === 'effect') {
    if (extension !== '.png') throw new Error(`${asset.assetId}: un efecto debe ser PNG.`);
    if (![asset.frameWidth, asset.frameHeight, asset.columns, asset.rows].every(value => Number.isInteger(value) && value > 0)) {
      throw new Error(`${asset.assetId}: dimensiones de spritesheet inválidas.`);
    }
    if (!asset.pivot || !Number.isFinite(asset.pivot.x) || !Number.isFinite(asset.pivot.y)) {
      throw new Error(`${asset.assetId}: falta un pivote válido.`);
    }
  } else if (asset.kind === 'audio') {
    if (!['.wav', '.ogg', '.mp3'].includes(extension)) {
      throw new Error(`${asset.assetId}: audio no admitido (${extension}).`);
    }
    if (!['effect', 'music', 'voice'].includes(asset.audioKind)) {
      throw new Error(`${asset.assetId}: audioKind debe ser effect, music o voice.`);
    }
  } else if (asset.kind === 'narrativeBackground') {
    if (extension !== '.png' && extension !== '.webp' && extension !== '.jpg' && extension !== '.jpeg') {
      throw new Error(`${asset.assetId}: fondo narrativo no admitido.`);
    }
    if (!asset.label || !Number.isInteger(asset.width) || !Number.isInteger(asset.height)) {
      throw new Error(`${asset.assetId}: metadatos de fondo incompletos.`);
    }
  } else if (asset.kind === 'narrativeCharacter') {
    if (extension !== '.png') throw new Error(`${asset.assetId}: una pose narrativa debe ser PNG.`);
    if (!asset.characterId || !asset.characterName || !asset.poseId || !asset.poseLabel) {
      throw new Error(`${asset.assetId}: metadatos de personaje incompletos.`);
    }
    const png = PNG.sync.read(fs.readFileSync(path.resolve(publicRoot, asset.path)));
    if (![...Array(png.width * png.height).keys()].some(index => png.data[index * 4 + 3] < 255)) {
      throw new Error(`${asset.assetId}: la pose narrativa necesita transparencia real.`);
    }
  } else throw new Error(`${asset.assetId}: kind de medios desconocido.`);
}

const characters = readJson(charactersPath);
if (characters.schemaVersion !== 1 || !Array.isArray(characters.assets)) {
  throw new Error('El manifiesto de personajes no es válido.');
}
const characterIds = new Set(characters.assets.map(asset => asset.assetId));
for (const asset of characters.assets) {
  assertPublicFile(asset.path, asset.assetId);
  if (!['player', 'npc', 'mount'].includes(asset.role)) {
    throw new Error(`${asset.assetId}: role de personaje desconocido.`);
  }
  if (asset.locomotionMode && !['walk', 'swim'].includes(asset.locomotionMode)) {
    throw new Error(`${asset.assetId}: locomotionMode desconocido.`);
  }
  const png = PNG.sync.read(fs.readFileSync(path.resolve(publicRoot, asset.path)));
  if (png.width !== asset.frameWidth * asset.columns
    || png.height !== asset.frameHeight * asset.rows) {
    throw new Error(`${asset.assetId}: la cuadrícula declarada no coincide con el PNG.`);
  }
  let transparentPixel = false;
  for (let index = 3; index < png.data.length; index += 4) {
    if (png.data[index] === 0) {
      transparentPixel = true;
      break;
    }
  }
  if (!transparentPixel) {
    throw new Error(`${asset.assetId}: la hoja no contiene transparencia alfa real.`);
  }
}
for (const appearance of characters.appearances ?? []) {
  if (!characterIds.has(appearance.modes.walk)) {
    throw new Error(`${appearance.appearanceId}: el modo walk no existe.`);
  }
  if (appearance.modes.swim && !characterIds.has(appearance.modes.swim)) {
    throw new Error(`${appearance.appearanceId}: el modo swim no existe.`);
  }
}

console.log(`Medios validados: ${media.assets.length}; apariencias: ${(characters.appearances ?? []).length}.`);
