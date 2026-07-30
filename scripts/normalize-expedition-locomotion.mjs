import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(
  root,
  'asset-library',
  'unassigned-sprites',
  'hero-packs',
  'Playable Characters',
  'Characters',
);
const characterRoot = path.join(root, 'public', 'assets', 'sprites', 'characters');

function readPng(filePath) {
  return PNG.sync.read(fs.readFileSync(filePath));
}

function writePng(filePath, png) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, PNG.sync.write(png, {
    colorType: 6,
    inputColorType: 6,
  }));
}

function nearestHalf(source, label) {
  if (source.width % 2 || source.height % 2) {
    throw new Error(`${label}: no se puede reducir a la mitad sin fracciones.`);
  }
  const target = new PNG({ width: source.width / 2, height: source.height / 2 });
  for (let y = 0; y < target.height; y += 1) {
    for (let x = 0; x < target.width; x += 1) {
      const sourceOffset = ((y * 2) * source.width + x * 2) * 4;
      const targetOffset = (y * target.width + x) * 4;
      source.data.copy(target.data, targetOffset, sourceOffset, sourceOffset + 4);
    }
  }
  return target;
}

function normalizeTrainerMode(sourceName, targetPath) {
  const source = readPng(path.join(sourceRoot, sourceName));
  if (source.width !== 128 || source.height !== 192) {
    throw new Error(`${sourceName}: se esperaba una hoja 4×4 de frames 32×48.`);
  }
  const normalized = nearestHalf(source, sourceName);
  if (normalized.width !== 64 || normalized.height !== 96) {
    throw new Error(`${sourceName}: la salida no cumple 4×4 frames 16×24.`);
  }
  writePng(path.join(characterRoot, targetPath), normalized);
}

function copyCell({
  source,
  target,
  sourceColumn,
  sourceRow,
  targetColumn,
  targetRow,
  background,
}) {
  const frame = 32;
  for (let y = 0; y < frame; y += 1) {
    for (let x = 0; x < frame; x += 1) {
      const sourceOffset = (
        ((sourceRow * frame + y) * source.width)
        + sourceColumn * frame
        + x
      ) * 4;
      const targetOffset = (
        ((targetRow * frame + y) * target.width)
        + targetColumn * frame
        + x
      ) * 4;
      const matchesBackground = [0, 1, 2].every(index => (
        source.data[sourceOffset + index] === background[index]
      ));
      if (matchesBackground) {
        target.data[targetOffset] = 0;
        target.data[targetOffset + 1] = 0;
        target.data[targetOffset + 2] = 0;
        target.data[targetOffset + 3] = 0;
      } else {
        source.data.copy(target.data, targetOffset, sourceOffset, sourceOffset + 4);
      }
    }
  }
}

function normalizeLaprasMount() {
  const sourcePath = path.join(
    root,
    'asset-library',
    'unassigned-sprites',
    'lapras surf.png',
  );
  const source = readPng(sourcePath);
  if (source.width !== 192 || source.height !== 64) {
    throw new Error('lapras surf.png: se esperaba una cuadrícula 6×2 de 32 px.');
  }
  const background = [source.data[0], source.data[1], source.data[2]];
  const target = new PNG({ width: 64, height: 128 });
  const rows = [
    [[2, 0], [3, 0]], // abajo
    [[4, 0], [4, 0]], // izquierda
    [[5, 0], [5, 0]], // derecha
    [[0, 0], [1, 0]], // arriba
  ];
  rows.forEach((frames, targetRow) => frames.forEach(
    ([sourceColumn, sourceRow], targetColumn) => copyCell({
      source,
      target,
      sourceColumn,
      sourceRow,
      targetColumn,
      targetRow,
      background,
    }),
  ));
  writePng(path.join(characterRoot, 'mounts', 'lapras-surf.png'), target);
}

normalizeTrainerMode('brendan_surf.png', path.join('achaman', 'achaman-swim.png'));
normalizeTrainerMode('may_surf.png', path.join('guayota', 'guayota-swim.png'));
normalizeLaprasMount();

console.log('Locomoción normalizada: Achamán swim, Guayota swim y montura Lapras.');
