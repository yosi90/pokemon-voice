import type { AdventureRoamBehaviorV1 } from '../../../packages/contracts/src/index.js';
import { tiledObjectRectanglePoints, transformTiledObjectPoint } from './tiledObjectTransform.js';

export const ROAM_TILE_SIZE = 16;
export const ROAM_RUN_THRESHOLD_PPS = 80;
export const ROAM_PLAYER_CORRIDOR_MS = 4_000;
export const ROAM_YIELD_PROMPT_MS = 2_000;

export interface RoamCell {
  x: number;
  y: number;
}

export interface RoamAreaGeometry {
  areaId: string;
  points: Array<{ x: number; y: number }>;
}

export interface RoamNavigationGrid {
  width: number;
  height: number;
  canOccupy: (cell: RoamCell) => boolean;
}

export interface RoamReservation {
  actorId: string;
  current: RoamCell;
  next?: RoamCell;
  waitingSince: number;
}

const cellKey = (cell: RoamCell) => `${cell.x}:${cell.y}`;
const sameCell = (left: RoamCell, right: RoamCell) => left.x === right.x && left.y === right.y;

function pointInPolygon(point: { x: number; y: number }, polygon: Array<{ x: number; y: number }>) {
  let inside = false;
  for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current++) {
    const a = polygon[current];
    const b = polygon[previous];
    const intersects = (a.y > point.y) !== (b.y > point.y)
      && point.x < ((b.x - a.x) * (point.y - a.y)) / ((b.y - a.y) || Number.EPSILON) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function readRoamArea(object: Record<string, unknown>): RoamAreaGeometry | undefined {
  const areaId = String(object.name ?? '').trim();
  if (!areaId) return undefined;
  const polygon = Array.isArray(object.polygon)
    ? (object.polygon as Array<Record<string, unknown>>).map(point => transformTiledObjectPoint(object, {
      x: Number(point.x) || 0,
      y: Number(point.y) || 0,
    }))
    : tiledObjectRectanglePoints(object);
  if (polygon.length < 3) return undefined;
  return { areaId, points: polygon };
}

export function worldPointToRoamCell(point: { x: number; y: number }): RoamCell {
  return {
    x: Math.floor(point.x / ROAM_TILE_SIZE),
    y: Math.floor((point.y - 1) / ROAM_TILE_SIZE),
  };
}

export function roamCellGroundPoint(cell: RoamCell) {
  return {
    x: cell.x * ROAM_TILE_SIZE + ROAM_TILE_SIZE / 2,
    y: (cell.y + 1) * ROAM_TILE_SIZE,
  };
}

export function rasterizeRoamArea(area: RoamAreaGeometry, grid: RoamNavigationGrid) {
  const cells: RoamCell[] = [];
  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) {
      const cell = { x, y };
      const center = {
        x: cell.x * ROAM_TILE_SIZE + ROAM_TILE_SIZE / 2,
        y: cell.y * ROAM_TILE_SIZE + ROAM_TILE_SIZE / 2,
      };
      if (pointInPolygon(center, area.points) && grid.canOccupy(cell)) cells.push(cell);
    }
  }
  return cells;
}

const cardinalNeighbors = (cell: RoamCell): RoamCell[] => [
  { x: cell.x, y: cell.y - 1 },
  { x: cell.x - 1, y: cell.y },
  { x: cell.x + 1, y: cell.y },
  { x: cell.x, y: cell.y + 1 },
];

function seededNoise(seed: string, cell: RoamCell) {
  let hash = 2166136261;
  for (const character of `${seed}:${cell.x}:${cell.y}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

export function findRoamPath({
  grid,
  from,
  to,
  blocked = new Set<string>(),
  seed = '',
  maxVisited = 2_000,
}: {
  grid: RoamNavigationGrid;
  from: RoamCell;
  to: RoamCell;
  blocked?: ReadonlySet<string>;
  seed?: string;
  maxVisited?: number;
}) {
  if (sameCell(from, to)) return [from];
  type OpenNode = { cell: RoamCell; cost: number; estimate: number; direction?: string };
  const open: OpenNode[] = [{ cell: from, cost: 0, estimate: 0 }];
  const best = new Map<string, number>([[cellKey(from), 0]]);
  const parents = new Map<string, RoamCell>();
  const directions = new Map<string, string>();
  let visited = 0;
  while (open.length && visited < maxVisited) {
    open.sort((left, right) => left.estimate - right.estimate);
    const current = open.shift()!;
    visited += 1;
    if (sameCell(current.cell, to)) {
      const result = [current.cell];
      let cursor = parents.get(cellKey(current.cell));
      while (cursor) {
        result.push(cursor);
        cursor = parents.get(cellKey(cursor));
      }
      return result.reverse();
    }
    for (const next of cardinalNeighbors(current.cell)) {
      const nextKey = cellKey(next);
      if (next.x < 0 || next.y < 0 || next.x >= grid.width || next.y >= grid.height) continue;
      if (!sameCell(next, to) && blocked.has(nextKey)) continue;
      if (!grid.canOccupy(next)) continue;
      const direction = `${next.x - current.cell.x}:${next.y - current.cell.y}`;
      const turnCost = current.direction && current.direction !== direction ? 0.18 : 0;
      const cost = current.cost + 1 + turnCost + seededNoise(seed, next) * 0.04;
      if (cost >= (best.get(nextKey) ?? Number.POSITIVE_INFINITY)) continue;
      best.set(nextKey, cost);
      parents.set(nextKey, current.cell);
      directions.set(nextKey, direction);
      const heuristic = Math.abs(to.x - next.x) + Math.abs(to.y - next.y);
      open.push({ cell: next, cost, estimate: cost + heuristic, direction });
    }
  }
  return [];
}

export function chooseRoamDestination({
  current,
  candidates,
  behavior,
  recent = [],
  random = Math.random,
}: {
  current: RoamCell;
  candidates: readonly RoamCell[];
  behavior: AdventureRoamBehaviorV1;
  recent?: readonly RoamCell[];
  random?: () => number;
}) {
  const recentKeys = new Set(recent.map(cellKey));
  const eligible = candidates.filter(candidate => {
    const distance = Math.abs(candidate.x - current.x) + Math.abs(candidate.y - current.y);
    return distance >= behavior.distanceTiles.min
      && distance <= behavior.distanceTiles.max
      && !recentKeys.has(cellKey(candidate));
  });
  if (!eligible.length) return undefined;
  return eligible[Math.min(eligible.length - 1, Math.floor(random() * eligible.length))];
}

export class RoamReservationTable {
  private reservations = new Map<string, RoamReservation>();
  private protectedCells = new Map<string, number>();

  reserveCorridor(cells: readonly RoamCell[], until: number) {
    for (const cell of cells) this.protectedCells.set(cellKey(cell), until);
  }

  clearExpired(now: number) {
    for (const [key, until] of this.protectedCells) if (until <= now) this.protectedCells.delete(key);
  }

  set(reservation: RoamReservation) {
    this.reservations.set(reservation.actorId, reservation);
  }

  delete(actorId: string) {
    this.reservations.delete(actorId);
  }

  blockedCells(actorId: string, now: number) {
    this.clearExpired(now);
    const blocked = new Set(this.protectedCells.keys());
    for (const reservation of this.reservations.values()) {
      if (reservation.actorId === actorId) continue;
      blocked.add(cellKey(reservation.current));
      if (reservation.next) blocked.add(cellKey(reservation.next));
    }
    return blocked;
  }

  canAdvance(actorId: string, current: RoamCell, next: RoamCell, now: number) {
    this.clearExpired(now);
    if (this.protectedCells.has(cellKey(next))) return false;
    const self = this.reservations.get(actorId);
    return ![...this.reservations.values()].some(other => {
      if (other.actorId === actorId) return false;
      if (sameCell(other.current, next)) return true;
      if (!other.next) return false;
      if (sameCell(other.current, next) && sameCell(other.next, current)) return true;
      if (!sameCell(other.next, next)) return false;
      const selfWaiting = self?.waitingSince ?? now;
      return other.waitingSince < selfWaiting
        || (other.waitingSince === selfWaiting && other.actorId.localeCompare(actorId) < 0);
    });
  }
}

export function resolveRoamLocomotion(speedPixelsPerSecond: number, hasRunAnimation: boolean) {
  const requested = speedPixelsPerSecond >= ROAM_RUN_THRESHOLD_PPS ? 'run' : 'walk';
  return {
    requested,
    animation: requested === 'run' && hasRunAnimation ? 'Run' : 'Walk',
    fallback: requested === 'run' && !hasRunAnimation,
    timeScale: Math.min(1.75, Math.max(.65, speedPixelsPerSecond / 48)),
  } as const;
}

export function findNearestFreeRoamCell({
  origin,
  grid,
  preferred = [],
  blocked = new Set<string>(),
}: {
  origin: RoamCell;
  grid: RoamNavigationGrid;
  preferred?: readonly RoamCell[];
  blocked?: ReadonlySet<string>;
}) {
  const preferredKeys = new Set(preferred.map(cellKey));
  const visited = new Set([cellKey(origin)]);
  const queue = [origin];
  let fallback: RoamCell | undefined;
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const cell = queue[cursor];
    if (grid.canOccupy(cell) && !blocked.has(cellKey(cell))) {
      if (preferredKeys.has(cellKey(cell))) return cell;
      fallback ??= cell;
    }
    for (const next of cardinalNeighbors(cell)) {
      const key = cellKey(next);
      if (next.x < 0 || next.y < 0 || next.x >= grid.width || next.y >= grid.height || visited.has(key)) continue;
      visited.add(key);
      queue.push(next);
    }
  }
  return fallback;
}

export function findRoamChokePoints(grid: RoamNavigationGrid) {
  const walkable: RoamCell[] = [];
  for (let y = 0; y < grid.height; y += 1) for (let x = 0; x < grid.width; x += 1) {
    const cell = { x, y };
    if (grid.canOccupy(cell)) walkable.push(cell);
  }
  const discovery = new Map<string, number>();
  const low = new Map<string, number>();
  const parent = new Map<string, string>();
  const articulations = new Set<string>();
  let time = 0;
  const visit = (cell: RoamCell) => {
    const key = cellKey(cell);
    discovery.set(key, ++time);
    low.set(key, time);
    let children = 0;
    for (const next of cardinalNeighbors(cell).filter(candidate => grid.canOccupy(candidate))) {
      const nextKey = cellKey(next);
      if (!discovery.has(nextKey)) {
        children += 1;
        parent.set(nextKey, key);
        visit(next);
        low.set(key, Math.min(low.get(key)!, low.get(nextKey)!));
        if (!parent.has(key) && children > 1) articulations.add(key);
        if (parent.has(key) && low.get(nextKey)! >= discovery.get(key)!) articulations.add(key);
      } else if (parent.get(key) !== nextKey) low.set(key, Math.min(low.get(key)!, discovery.get(nextKey)!));
    }
  };
  for (const cell of walkable) if (!discovery.has(cellKey(cell))) visit(cell);
  return articulations;
}

export function roamCellKey(cell: RoamCell) {
  return cellKey(cell);
}
