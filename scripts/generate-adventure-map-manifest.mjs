import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mapsRoot = path.join(root, 'public', 'assets', 'adventure', 'maps');

function collect(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return collect(absolute);
    return entry.name.endsWith('.adventure.json') ? [absolute] : [];
  });
}

const usedIds = new Set();
const maps = collect(mapsRoot).map(absolute => {
  const document = JSON.parse(fs.readFileSync(absolute, 'utf8'));
  if (![2, 3].includes(document.schemaVersion) || !document.mapId) {
    throw new Error(`${path.relative(root, absolute)} no es una aventura compatible.`);
  }
  if (usedIds.has(document.mapId)) throw new Error(`Mapa duplicado: ${document.mapId}.`);
  usedIds.add(document.mapId);
  return {
    schemaVersion: 1,
    mapId: document.mapId,
    title: document.title,
    documentPath: path.relative(path.join(root, 'public'), absolute).replaceAll('\\', '/'),
    sectors: (document.schemaVersion === 3 ? document.sectors : document.rooms).map(sector => {
      const sourceId = document.schemaVersion === 3 ? sector.sectorId : sector.roomId;
      const sectorId = sourceId.startsWith('room:')
        ? `sector:${sourceId.slice('room:'.length)}`
        : sourceId;
      return {
        sectorId,
        label: sectorId.split(':').at(-1) ?? sectorId,
      };
    }),
  };
}).sort((left, right) => left.mapId.localeCompare(right.mapId));

fs.writeFileSync(
  path.join(mapsRoot, 'manifest.v1.json'),
  `${JSON.stringify({ schemaVersion: 1, maps }, null, 2)}\n`,
);
console.log(`Manifiesto de mapas: ${maps.length} entradas.`);
