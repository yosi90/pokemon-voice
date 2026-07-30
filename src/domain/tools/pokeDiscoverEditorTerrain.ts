import {
  TERRAIN_SURFACE_TYPES,
  type AdventureLocationKind,
  type AdventureLocationV1,
  type TerrainSurfaceType,
} from '../../../packages/contracts/src/index.js';
import {
  addPokeDiscoverTiledObject,
  ensurePokeDiscoverTiledLayer,
  type PokeDiscoverEditableTiledMap,
  type PokeDiscoverTiledObject,
} from './pokeDiscoverEditorProject.js';

export interface PokeDiscoverTerrainCell {
  x: number;
  y: number;
}

export interface PokeDiscoverTerrainRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
  surfaceType: TerrainSurfaceType;
  slowMultiplier?: number;
}

export interface PokeDiscoverTerrainGrid {
  width: number;
  height: number;
  cells: TerrainSurfaceType[];
  slowMultipliers: Array<number | undefined>;
}

export interface PokeDiscoverLocationObject {
  definition: AdventureLocationV1;
  object: PokeDiscoverTiledObject;
}

const SURFACE_TYPES = new Set<string>(TERRAIN_SURFACE_TYPES);

function objectClass(object: Record<string, unknown>) {
  return String(object.class || object.type || '');
}

function propertyMap(object: { properties?: Array<Record<string, unknown>> }) {
  return new Map((object.properties ?? []).map(property => [
    String(property.name ?? ''),
    property.value,
  ]));
}

function tiledProperties(values: Record<string, string | number | boolean | undefined>) {
  return Object.entries(values)
    .filter(([, value]) => value !== undefined)
    .map(([name, value]) => ({
      name,
      type: typeof value === 'number' ? 'float' : typeof value === 'boolean' ? 'bool' : 'string',
      value,
    }));
}

function terrainObjects(tilemap: PokeDiscoverEditableTiledMap) {
  const layer = tilemap.layers.find(candidate => candidate.name === 'Terrain');
  if (!layer || layer.type !== 'objectgroup') return [];
  return (Array.isArray(layer.objects) ? layer.objects : [])
    .filter(object => objectClass(object) === 'TerrainArea') as PokeDiscoverTiledObject[];
}

function assertGrid(grid: PokeDiscoverTerrainGrid) {
  if (grid.width <= 0 || grid.height <= 0
    || grid.cells.length !== grid.width * grid.height
    || grid.slowMultipliers.length !== grid.cells.length) {
    throw new Error('La cuadrícula de terreno no coincide con las dimensiones del sector.');
  }
  for (const surface of grid.cells) {
    if (!SURFACE_TYPES.has(surface)) throw new Error(`Superficie desconocida: ${surface}.`);
  }
}

export function createGroundTerrainGrid(width: number, height: number): PokeDiscoverTerrainGrid {
  const size = width * height;
  return {
    width,
    height,
    cells: Array.from({ length: size }, () => 'ground'),
    slowMultipliers: Array.from({ length: size }, () => undefined),
  };
}

export function readPokeDiscoverTerrainGrid(
  tilemap: PokeDiscoverEditableTiledMap,
): { grid: PokeDiscoverTerrainGrid; errors: string[]; missing: boolean } {
  const grid = createGroundTerrainGrid(tilemap.width, tilemap.height);
  const objects = terrainObjects(tilemap);
  const errors: string[] = [];
  const covered = new Set<number>();
  for (const object of objects) {
    const properties = propertyMap(object);
    const surface = String(properties.get('surfaceType') ?? '');
    if (!SURFACE_TYPES.has(surface)) {
      errors.push(`${object.name}: surfaceType desconocido ${surface || '(vacío)'}`);
      continue;
    }
    const x = Number(object.x) / tilemap.tilewidth;
    const y = Number(object.y) / tilemap.tileheight;
    const width = Number(object.width) / tilemap.tilewidth;
    const height = Number(object.height) / tilemap.tileheight;
    if (![x, y, width, height].every(Number.isInteger) || width <= 0 || height <= 0) {
      errors.push(`${object.name}: TerrainArea debe ajustarse a la cuadrícula de 16×16`);
      continue;
    }
    if (x < 0 || y < 0 || x + width > tilemap.width || y + height > tilemap.height) {
      errors.push(`${object.name}: TerrainArea sale de los límites del sector`);
      continue;
    }
    const slowMultiplier = surface === 'slow'
      ? Math.max(1, Number(properties.get('slowMultiplier')) || 1.5)
      : undefined;
    for (let row = y; row < y + height; row += 1) {
      for (let column = x; column < x + width; column += 1) {
        const index = row * tilemap.width + column;
        if (covered.has(index)) errors.push(`${object.name}: solapa otra TerrainArea en ${column},${row}`);
        covered.add(index);
        grid.cells[index] = surface as TerrainSurfaceType;
        grid.slowMultipliers[index] = slowMultiplier;
      }
    }
  }
  if (objects.length && covered.size !== tilemap.width * tilemap.height) {
    errors.push(`Terrain no cubre ${tilemap.width * tilemap.height - covered.size} celdas`);
  }
  return { grid, errors, missing: objects.length === 0 };
}

export function compactPokeDiscoverTerrainGrid(
  grid: PokeDiscoverTerrainGrid,
): PokeDiscoverTerrainRectangle[] {
  assertGrid(grid);
  const visited = Array.from({ length: grid.cells.length }, () => false);
  const rectangles: PokeDiscoverTerrainRectangle[] = [];
  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) {
      const start = y * grid.width + x;
      if (visited[start]) continue;
      const surfaceType = grid.cells[start];
      const slowMultiplier = grid.slowMultipliers[start];
      let width = 1;
      while (x + width < grid.width) {
        const index = y * grid.width + x + width;
        if (visited[index] || grid.cells[index] !== surfaceType
          || grid.slowMultipliers[index] !== slowMultiplier) break;
        width += 1;
      }
      let height = 1;
      while (y + height < grid.height) {
        const rowStart = (y + height) * grid.width + x;
        const matches = Array.from({ length: width }, (_, offset) => rowStart + offset)
          .every(index => !visited[index] && grid.cells[index] === surfaceType
            && grid.slowMultipliers[index] === slowMultiplier);
        if (!matches) break;
        height += 1;
      }
      for (let row = y; row < y + height; row += 1) {
        for (let column = x; column < x + width; column += 1) {
          visited[row * grid.width + column] = true;
        }
      }
      rectangles.push({ x, y, width, height, surfaceType, slowMultiplier });
    }
  }
  return rectangles;
}

export function writePokeDiscoverTerrainGrid(
  source: PokeDiscoverEditableTiledMap,
  grid: PokeDiscoverTerrainGrid,
) {
  assertGrid(grid);
  if (grid.width !== source.width || grid.height !== source.height) {
    throw new Error('Terrain debe tener las mismas dimensiones que Ground.');
  }
  const ensured = ensurePokeDiscoverTiledLayer(source, 'Terrain');
  let nextObjectId = Math.max(
    Number(ensured.tilemap.nextobjectid) || 1,
    ...ensured.tilemap.layers.flatMap(layer => Array.isArray(layer.objects)
      ? layer.objects.map(object => Number(object.id) + 1)
      : [1]),
  );
  const rectangles = compactPokeDiscoverTerrainGrid(grid);
  const objects = rectangles.map((rectangle, index): PokeDiscoverTiledObject => ({
    id: nextObjectId++,
    name: `terrain:${rectangle.surfaceType}:${String(index + 1).padStart(3, '0')}`,
    class: 'TerrainArea',
    type: 'TerrainArea',
    x: rectangle.x * source.tilewidth,
    y: rectangle.y * source.tileheight,
    width: rectangle.width * source.tilewidth,
    height: rectangle.height * source.tileheight,
    rotation: 0,
    visible: true,
    properties: tiledProperties({
      surfaceType: rectangle.surfaceType,
      slowMultiplier: rectangle.surfaceType === 'slow'
        ? rectangle.slowMultiplier ?? 1.5
        : undefined,
    }),
  }));
  const layers = ensured.tilemap.layers.map(layer => layer.name === 'Terrain'
    ? {
      ...layer,
      objects: [
        ...(Array.isArray(layer.objects)
          ? layer.objects.filter(object => objectClass(object) !== 'TerrainArea')
          : []),
        ...objects,
      ],
    }
    : layer);
  return {
    ...ensured.tilemap,
    layers,
    nextobjectid: nextObjectId,
  };
}

export function ensurePokeDiscoverGroundTerrain(source: PokeDiscoverEditableTiledMap) {
  const current = readPokeDiscoverTerrainGrid(source);
  return current.missing
    ? { tilemap: writePokeDiscoverTerrainGrid(source, current.grid), created: true }
    : { tilemap: source, created: false };
}

export function paintPokeDiscoverTerrain(
  grid: PokeDiscoverTerrainGrid,
  cells: PokeDiscoverTerrainCell[],
  surfaceType: TerrainSurfaceType,
  slowMultiplier = 1.5,
) {
  assertGrid(grid);
  const next = {
    ...grid,
    cells: [...grid.cells],
    slowMultipliers: [...grid.slowMultipliers],
  };
  for (const cell of cells) {
    if (!Number.isInteger(cell.x) || !Number.isInteger(cell.y)
      || cell.x < 0 || cell.y < 0 || cell.x >= grid.width || cell.y >= grid.height) {
      throw new Error(`Celda fuera del sector: ${cell.x},${cell.y}.`);
    }
    const index = cell.y * grid.width + cell.x;
    next.cells[index] = surfaceType;
    next.slowMultipliers[index] = surfaceType === 'slow' ? Math.max(1, slowMultiplier) : undefined;
  }
  return next;
}

export function fillPokeDiscoverTerrain(
  grid: PokeDiscoverTerrainGrid,
  origin: PokeDiscoverTerrainCell,
  surfaceType: TerrainSurfaceType,
  slowMultiplier = 1.5,
) {
  const originIndex = origin.y * grid.width + origin.x;
  if (origin.x < 0 || origin.y < 0 || origin.x >= grid.width || origin.y >= grid.height) {
    throw new Error('El relleno debe comenzar dentro del sector.');
  }
  const replaced = grid.cells[originIndex];
  if (replaced === surfaceType
    && (surfaceType !== 'slow' || grid.slowMultipliers[originIndex] === slowMultiplier)) return grid;
  const pending = [origin];
  const visited = new Set<number>();
  const cells: PokeDiscoverTerrainCell[] = [];
  while (pending.length) {
    const cell = pending.pop()!;
    const index = cell.y * grid.width + cell.x;
    if (visited.has(index) || grid.cells[index] !== replaced) continue;
    visited.add(index);
    cells.push(cell);
    for (const next of [
      { x: cell.x - 1, y: cell.y },
      { x: cell.x + 1, y: cell.y },
      { x: cell.x, y: cell.y - 1 },
      { x: cell.x, y: cell.y + 1 },
    ]) {
      if (next.x >= 0 && next.y >= 0 && next.x < grid.width && next.y < grid.height) pending.push(next);
    }
  }
  return paintPokeDiscoverTerrain(grid, cells, surfaceType, slowMultiplier);
}

export function findNearestSafeTerrainCell(
  grid: PokeDiscoverTerrainGrid,
  origin: PokeDiscoverTerrainCell,
  options: {
    safeSurfaceTypes?: TerrainSurfaceType[];
    blocked?: ReadonlySet<string>;
  } = {},
) {
  const safe = new Set(options.safeSurfaceTypes ?? ['ground', 'slow', 'ice']);
  const key = (cell: PokeDiscoverTerrainCell) => `${cell.x}:${cell.y}`;
  const queue = [origin];
  const visited = new Set<string>();
  while (queue.length) {
    const cell = queue.shift()!;
    const cellKey = key(cell);
    if (visited.has(cellKey)) continue;
    visited.add(cellKey);
    if (cell.x < 0 || cell.y < 0 || cell.x >= grid.width || cell.y >= grid.height) continue;
    const index = cell.y * grid.width + cell.x;
    if (safe.has(grid.cells[index]) && !options.blocked?.has(cellKey)) return cell;
    queue.push(
      { x: cell.x, y: cell.y - 1 },
      { x: cell.x - 1, y: cell.y },
      { x: cell.x + 1, y: cell.y },
      { x: cell.x, y: cell.y + 1 },
    );
  }
  return undefined;
}

export function normalizePokeDiscoverLocationTags(tags: string[]) {
  return [...new Set(tags.map(tag => tag.trim().toLocaleLowerCase())
    .filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

export function listPokeDiscoverLocations(
  tilemap: PokeDiscoverEditableTiledMap,
): PokeDiscoverLocationObject[] {
  const layer = tilemap.layers.find(candidate => candidate.name === 'Locations');
  const objects = (Array.isArray(layer?.objects) ? layer.objects : []) as PokeDiscoverTiledObject[];
  return objects.flatMap(object => {
    const klass = objectClass(object);
    if (klass !== 'LocationPoint' && klass !== 'LocationArea') return [];
    const properties = propertyMap(object);
    const kind = String(properties.get('locationKind') ?? 'area') as AdventureLocationKind;
    return [{
      object,
      definition: {
        schemaVersion: 1,
        locationId: object.name,
        label: String(properties.get('label') ?? object.name),
        kind,
        tags: normalizePokeDiscoverLocationTags(String(properties.get('tags') ?? '').split(',')),
        ...(properties.get('transitionId')
          ? { transitionId: String(properties.get('transitionId')) }
          : {}),
      },
    }];
  });
}

export function addPokeDiscoverLocation(
  tilemap: PokeDiscoverEditableTiledMap,
  request: {
    locationId: string;
    label: string;
    kind: AdventureLocationKind;
    tags?: string[];
    transitionId?: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
  },
) {
  if (!/^[a-z0-9][a-z0-9-]*(?::[a-z0-9][a-z0-9-]*)+$/u.test(request.locationId)) {
    throw new Error('El lugar necesita un ID estable con segmentos separados por dos puntos.');
  }
  if (listPokeDiscoverLocations(tilemap).some(item => item.definition.locationId === request.locationId)) {
    throw new Error(`Ya existe el lugar ${request.locationId}.`);
  }
  const area = Number(request.width) > 0 && Number(request.height) > 0;
  return addPokeDiscoverTiledObject(tilemap, 'Locations', {
    name: request.locationId,
    class: area ? 'LocationArea' : 'LocationPoint',
    type: area ? 'LocationArea' : 'LocationPoint',
    x: request.x,
    y: request.y,
    width: Math.max(0, request.width ?? 0),
    height: Math.max(0, request.height ?? 0),
    ...(area ? {} : { point: true }),
    properties: tiledProperties({
      label: request.label.trim() || request.locationId,
      locationKind: request.kind,
      tags: normalizePokeDiscoverLocationTags(request.tags ?? []).join(','),
      transitionId: request.transitionId?.trim() || undefined,
    }),
  });
}
