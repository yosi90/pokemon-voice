import {
  TERRAIN_SURFACE_TYPES,
  type TerrainSurfaceType,
} from '../../../packages/contracts/src/index.js';
import type { LoadedTiledMap } from './loadAdventureBundle.js';

export interface AdventureTerrainCell {
  surfaceType: TerrainSurfaceType;
  slowMultiplier?: number;
  terrainAreaId?: string;
}

export interface AdventureTerrainRuntime {
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
  cells: AdventureTerrainCell[];
  diagnostics: string[];
}

const SURFACES = new Set<string>(TERRAIN_SURFACE_TYPES);

function objectClass(object: Record<string, unknown>) {
  return String(object.class || object.type || '');
}

function propertyMap(object: Record<string, unknown>) {
  const properties = Array.isArray(object.properties)
    ? object.properties as Array<Record<string, unknown>>
    : [];
  return new Map(properties.map(property => [String(property.name ?? ''), property.value]));
}

export function createAdventureTerrainRuntime(tilemap: LoadedTiledMap): AdventureTerrainRuntime {
  const size = tilemap.width * tilemap.height;
  const cells = Array.from<unknown, AdventureTerrainCell>({ length: size }, () => ({
    surfaceType: 'ground',
  }));
  const diagnostics: string[] = [];
  const terrainLayer = tilemap.layers.find(layer => layer.name === 'Terrain');
  const terrainObjects = Array.isArray(terrainLayer?.objects)
    ? (terrainLayer.objects as Array<Record<string, unknown>>)
      .filter(object => objectClass(object) === 'TerrainArea')
    : [];
  if (!terrainObjects.length) {
    diagnostics.push('Terrain ausente: se aplica ground heredado a todo el sector.');
    return {
      width: tilemap.width,
      height: tilemap.height,
      tileWidth: tilemap.tilewidth,
      tileHeight: tilemap.tileheight,
      cells,
      diagnostics,
    };
  }

  const covered = new Set<number>();
  for (const object of terrainObjects) {
    const properties = propertyMap(object);
    const surfaceType = String(properties.get('surfaceType') ?? '');
    const label = String(object.name ?? 'TerrainArea');
    if (!SURFACES.has(surfaceType)) {
      diagnostics.push(`${label}: superficie desconocida ${surfaceType || '(vacía)'}.`);
      continue;
    }
    const x = Number(object.x) / tilemap.tilewidth;
    const y = Number(object.y) / tilemap.tileheight;
    const width = Number(object.width) / tilemap.tilewidth;
    const height = Number(object.height) / tilemap.tileheight;
    if (![x, y, width, height].every(Number.isInteger) || width <= 0 || height <= 0) {
      diagnostics.push(`${label}: el área no está ajustada a la cuadrícula.`);
      continue;
    }
    const terrainAreaId = String(properties.get('terrainAreaId') ?? object.name ?? '');
    const slowMultiplier = surfaceType === 'slow'
      ? Math.max(1, Number(properties.get('slowMultiplier')) || 1.5)
      : undefined;
    for (let row = y; row < y + height; row += 1) {
      for (let column = x; column < x + width; column += 1) {
        if (column < 0 || row < 0 || column >= tilemap.width || row >= tilemap.height) {
          diagnostics.push(`${label}: el área sale de los límites del sector.`);
          continue;
        }
        const index = row * tilemap.width + column;
        if (covered.has(index)) diagnostics.push(`${label}: solapamiento en ${column},${row}.`);
        covered.add(index);
        cells[index] = {
          surfaceType: surfaceType as TerrainSurfaceType,
          ...(slowMultiplier ? { slowMultiplier } : {}),
          ...(terrainAreaId ? { terrainAreaId } : {}),
        };
      }
    }
  }
  if (covered.size !== size) {
    diagnostics.push(`Terrain deja ${size - covered.size} celdas sin cubrir; usan ground heredado.`);
  }
  return {
    width: tilemap.width,
    height: tilemap.height,
    tileWidth: tilemap.tilewidth,
    tileHeight: tilemap.tileheight,
    cells,
    diagnostics,
  };
}

export function terrainCellAtGroundPoint(
  terrain: AdventureTerrainRuntime,
  x: number,
  y: number,
) {
  const column = Math.floor(x / terrain.tileWidth);
  const row = Math.floor((y - 1) / terrain.tileHeight);
  if (column < 0 || row < 0 || column >= terrain.width || row >= terrain.height) {
    return undefined;
  }
  return terrain.cells[row * terrain.width + column];
}

export function canPlayerEnterTerrain({
  surfaceType,
  hasSurf,
  hasSwimAsset,
}: {
  surfaceType: TerrainSurfaceType;
  hasSurf: boolean;
  hasSwimAsset: boolean;
}) {
  if (surfaceType === 'void') return { allowed: false as const, reason: 'void' as const };
  if (surfaceType === 'water' && !hasSurf) {
    return { allowed: false as const, reason: 'requires-surf' as const };
  }
  if (surfaceType === 'water' && !hasSwimAsset) {
    return { allowed: false as const, reason: 'missing-swim-asset' as const };
  }
  return { allowed: true as const };
}

export function terrainMovementSpeed(
  basePixelsPerSecond: number,
  cell: AdventureTerrainCell | undefined,
) {
  return cell?.surfaceType === 'slow'
    ? basePixelsPerSecond / Math.max(1, cell.slowMultiplier ?? 1.5)
    : basePixelsPerSecond;
}
