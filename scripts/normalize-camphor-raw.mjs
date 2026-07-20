import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const root = process.cwd();
const rawDir = path.join(root, 'asset-library/character-sources/alcanfor/raw');
const outputDir = path.join(root, 'asset-library/character-sources/alcanfor/draft');

function readPng(file) {
  return PNG.sync.read(fs.readFileSync(file));
}

function writePng(file, png) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, PNG.sync.write(png));
}

function pixelIndex(png, x, y) {
  return (y * png.width + x) * 4;
}

function isPaintedBackground(png, x, y) {
  const index = pixelIndex(png, x, y);
  const r = png.data[index];
  const g = png.data[index + 1];
  const b = png.data[index + 2];
  return Math.min(r, g, b) >= 220 && Math.max(r, g, b) - Math.min(r, g, b) <= 18;
}

/** Elimina solamente blancos/grises conectados con el borde de cada celda. */
function removeConnectedBackground(source, columns, rows) {
  const result = PNG.sync.read(PNG.sync.write(source));
  const cellWidth = source.width / columns;
  const cellHeight = source.height / rows;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x0 = Math.round(column * cellWidth);
      const y0 = Math.round(row * cellHeight);
      const x1 = Math.round((column + 1) * cellWidth) - 1;
      const y1 = Math.round((row + 1) * cellHeight) - 1;
      const visited = new Uint8Array((x1 - x0 + 1) * (y1 - y0 + 1));
      const queue = [];
      const enqueue = (x, y) => {
        const local = (y - y0) * (x1 - x0 + 1) + x - x0;
        if (visited[local] || !isPaintedBackground(source, x, y)) return;
        visited[local] = 1;
        queue.push([x, y]);
      };
      for (let x = x0; x <= x1; x += 1) {
        enqueue(x, y0);
        enqueue(x, y1);
      }
      for (let y = y0; y <= y1; y += 1) {
        enqueue(x0, y);
        enqueue(x1, y);
      }
      for (let cursor = 0; cursor < queue.length; cursor += 1) {
        const [x, y] = queue[cursor];
        result.data[pixelIndex(result, x, y) + 3] = 0;
        if (x > x0) enqueue(x - 1, y);
        if (x < x1) enqueue(x + 1, y);
        if (y > y0) enqueue(x, y - 1);
        if (y < y1) enqueue(x, y + 1);
      }
    }
  }
  return result;
}

function cellBounds(png, column, row, columns, rows) {
  return {
    x0: Math.round(column * png.width / columns),
    y0: Math.round(row * png.height / rows),
    x1: Math.round((column + 1) * png.width / columns),
    y1: Math.round((row + 1) * png.height / rows),
  };
}

function visibleBounds(png, cell) {
  let left = cell.x1;
  let top = cell.y1;
  let right = cell.x0 - 1;
  let bottom = cell.y0 - 1;
  for (let y = cell.y0; y < cell.y1; y += 1) {
    for (let x = cell.x0; x < cell.x1; x += 1) {
      if (png.data[pixelIndex(png, x, y) + 3] < 32) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) throw new Error('Una celda no contiene ningún personaje visible.');
  return { left, top, right, bottom, width: right - left + 1, height: bottom - top + 1 };
}

function quantize(value) {
  return Math.max(0, Math.min(255, Math.round(value / 12) * 12));
}

function drawReducedCell(source, bounds, target, targetColumn, targetRow, frameWidth, frameHeight) {
  const scale = Math.min((frameWidth - 2) / bounds.width, (frameHeight - 2) / bounds.height);
  const width = Math.max(1, Math.round(bounds.width * scale));
  const height = Math.max(1, Math.round(bounds.height * scale));
  const offsetX = targetColumn * frameWidth + Math.floor((frameWidth - width) / 2);
  const offsetY = targetRow * frameHeight + frameHeight - 1 - height;

  for (let dy = 0; dy < height; dy += 1) {
    for (let dx = 0; dx < width; dx += 1) {
      const sx0 = Math.floor(bounds.left + dx * bounds.width / width);
      const sx1 = Math.max(sx0 + 1, Math.ceil(bounds.left + (dx + 1) * bounds.width / width));
      const sy0 = Math.floor(bounds.top + dy * bounds.height / height);
      const sy1 = Math.max(sy0 + 1, Math.ceil(bounds.top + (dy + 1) * bounds.height / height));
      let samples = 0;
      let visible = 0;
      let red = 0;
      let green = 0;
      let blue = 0;
      for (let sy = sy0; sy < sy1; sy += 1) {
        for (let sx = sx0; sx < sx1; sx += 1) {
          samples += 1;
          const index = pixelIndex(source, sx, sy);
          const alpha = source.data[index + 3] / 255;
          if (alpha < .1) continue;
          visible += alpha;
          red += source.data[index] * alpha;
          green += source.data[index + 1] * alpha;
          blue += source.data[index + 2] * alpha;
        }
      }
      if (!visible || visible / samples < .16) continue;
      const targetIndex = pixelIndex(target, offsetX + dx, offsetY + dy);
      target.data[targetIndex] = quantize(red / visible);
      target.data[targetIndex + 1] = quantize(green / visible);
      target.data[targetIndex + 2] = quantize(blue / visible);
      target.data[targetIndex + 3] = 255;
    }
  }
}

function normalizeSheet({ input, output, columns, rows, outputRowOrder = [...Array(rows).keys()] }) {
  const source = readPng(path.join(rawDir, input));
  if (source.width % columns || source.height % rows) throw new Error(`${input} no se divide en ${columns}×${rows}.`);
  const transparent = removeConnectedBackground(source, columns, rows);
  writePng(path.join(outputDir, `clean-${input}`), transparent);
  const frameWidth = 16;
  const frameHeight = 24;
  const result = new PNG({ width: columns * frameWidth, height: rows * frameHeight });
  for (let targetRow = 0; targetRow < outputRowOrder.length; targetRow += 1) {
    const sourceRow = outputRowOrder[targetRow];
    for (let column = 0; column < columns; column += 1) {
      const cell = cellBounds(transparent, column, sourceRow, columns, rows);
      drawReducedCell(
        transparent,
        visibleBounds(transparent, cell),
        result,
        column,
        targetRow,
        frameWidth,
        frameHeight,
      );
    }
  }
  writePng(path.join(outputDir, output), result);
}

normalizeSheet({
  input: 'professor-alcanfor-walk.png',
  output: 'professor-alcanfor-walk.png',
  columns: 4,
  rows: 4,
  // La fuente viene abajo, izquierda, arriba y derecha; runtime usa abajo, izquierda, derecha y arriba.
  outputRowOrder: [0, 1, 3, 2],
});

normalizeSheet({
  input: 'professor-alcanfor-down.png',
  output: 'professor-alcanfor-fall.png',
  columns: 4,
  rows: 1,
});

console.log(`Borradores de Alcanfor generados en ${path.relative(root, outputDir)}.`);
