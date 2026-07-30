import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(root, 'public');
const mediaPath = path.join(publicRoot, 'assets', 'adventure', 'media', 'manifest.v1.json');
const imagesRoot = path.join(publicRoot, 'assets', 'images');
const manifest = JSON.parse(fs.readFileSync(mediaPath, 'utf8'));
const retained = manifest.assets.filter(asset => !['narrativeBackground', 'narrativeCharacter'].includes(asset.kind));
const generated = [];
const slug = value => value.normalize('NFD').replace(/\p{Diacritic}/gu, '')
  .toLocaleLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '');
const dimensions = filePath => {
  const png = PNG.sync.read(fs.readFileSync(filePath));
  return { width: png.width, height: png.height };
};
const hasAlpha = filePath => {
  const png = PNG.sync.read(fs.readFileSync(filePath));
  for (let index = 3; index < png.data.length; index += 4) {
    if (png.data[index] < 255) return true;
  }
  return false;
};

const backgroundDir = path.join(imagesRoot, 'fondos');
for (const name of fs.readdirSync(backgroundDir).filter(value => value.toLocaleLowerCase().endsWith('.png'))) {
  const filePath = path.join(backgroundDir, name);
  const id = slug(path.basename(name, path.extname(name)));
  generated.push({
    schemaVersion: 1,
    kind: 'narrativeBackground',
    assetId: `narrative:background:${id}`,
    path: `assets/images/fondos/${name}`,
    label: path.basename(name, path.extname(name)).replaceAll('-', ' '),
    ...dimensions(filePath),
    source: 'Poke-Voice',
  });
}

const cast = [
  ['professor-camphor', 'Profesor Alcanfor', 'profesor-alcanfor'],
  ['achaman', 'Achaman', 'achaman'],
  ['guayota', 'Guayota', 'guayota'],
];
for (const [characterId, characterName, directoryName] of cast) {
  const directory = path.join(imagesRoot, directoryName);
  for (const name of fs.readdirSync(directory).filter(value => value.toLocaleLowerCase().endsWith('.png'))) {
    const filePath = path.join(directory, name);
    if (!hasAlpha(filePath)) continue;
    const stem = slug(path.basename(name, path.extname(name)));
    const pose = stem
      .replace(/^alcanfor-/u, '')
      .replace(/^achaman-/u, '')
      .replace(/^guayota-y-horquilla-/u, '');
    generated.push({
      schemaVersion: 1,
      kind: 'narrativeCharacter',
      assetId: `narrative:character:${characterId}:${pose}`,
      characterId,
      characterName,
      poseId: pose,
      poseLabel: pose.replaceAll('-', ' '),
      path: `assets/images/${directoryName}/${name}`,
      source: 'Poke-Voice',
    });
  }
}

const assets = [...retained, ...generated].sort((left, right) => left.assetId.localeCompare(right.assetId));
fs.writeFileSync(mediaPath, `${JSON.stringify({ schemaVersion: 1, assets }, null, 2)}\n`);
console.log(`Medios narrativos registrados: ${generated.length}.`);
