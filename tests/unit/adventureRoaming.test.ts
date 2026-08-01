import { describe, expect, it } from 'vitest';
import type { AdventureRoamBehaviorV1 } from '../../packages/contracts/src/index.js';
import {
  RoamReservationTable,
  chooseRoamDestination,
  findNearestFreeRoamCell,
  findRoamChokePoints,
  findRoamPath,
  rasterizeRoamArea,
  readRoamArea,
  resolveRoamLocomotion,
  roamCellKey,
  type RoamNavigationGrid,
} from '../../src/domain/maps/adventureRoaming.js';

const behavior: AdventureRoamBehaviorV1 = {
  schemaVersion: 1,
  areaId: 'roam-area:test:01',
  distanceTiles: { min: 2, max: 4 },
  speedPixelsPerSecond: 40,
  waitAfterArrivalMs: { min: 1_000, max: 4_000 },
};

function grid(width: number, height: number, blocked: string[] = []): RoamNavigationGrid {
  const walls = new Set(blocked);
  return { width, height, canOccupy: cell => cell.x >= 0 && cell.y >= 0
    && cell.x < width && cell.y < height && !walls.has(roamCellKey(cell)) };
}

describe('adventure roaming', () => {
  it('rasteriza rectángulos y polígonos sobre la cuadrícula compartida', () => {
    const rectangle = readRoamArea({ name: 'roam-area:test:01', x: 0, y: 0, width: 48, height: 32 });
    expect(rectangle).toBeDefined();
    expect(rasterizeRoamArea(rectangle!, grid(4, 3)).map(roamCellKey)).toEqual([
      '0:0', '1:0', '2:0', '0:1', '1:1', '2:1',
    ]);

    const polygon = readRoamArea({
      name: 'roam-area:test:02', x: 0, y: 0,
      polygon: [{ x: 0, y: 0 }, { x: 48, y: 0 }, { x: 0, y: 48 }],
    });
    expect(rasterizeRoamArea(polygon!, grid(3, 3)).length).toBeGreaterThan(1);
  });

  it('encuentra caminos cardinales evitando obstáculos y reservas', () => {
    const result = findRoamPath({
      grid: grid(5, 3, ['2:0', '2:1']),
      from: { x: 0, y: 0 },
      to: { x: 4, y: 0 },
      blocked: new Set(['1:1']),
      seed: 'actor:test',
    });
    expect(result[0]).toEqual({ x: 0, y: 0 });
    expect(result.at(-1)).toEqual({ x: 4, y: 0 });
    expect(result).not.toContainEqual({ x: 2, y: 0 });
  });

  it('elige destinos dentro del rango sin repetir los recientes', () => {
    const selected = chooseRoamDestination({
      current: { x: 0, y: 0 },
      candidates: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 5, y: 0 }],
      behavior,
      recent: [{ x: 2, y: 0 }],
      random: () => 0,
    });
    expect(selected).toEqual({ x: 3, y: 0 });
  });

  it('impide compartir destino, intercambiar casillas y entrar en el corredor del jugador', () => {
    const table = new RoamReservationTable();
    table.set({ actorId: 'a', current: { x: 0, y: 0 }, next: { x: 1, y: 0 }, waitingSince: 0 });
    table.set({ actorId: 'b', current: { x: 1, y: 0 }, next: { x: 0, y: 0 }, waitingSince: 0 });
    expect(table.canAdvance('a', { x: 0, y: 0 }, { x: 1, y: 0 }, 0)).toBe(false);
    table.reserveCorridor([{ x: 2, y: 0 }], 4_000);
    expect(table.blockedCells('a', 1_000)).toContain('2:0');
    expect(table.blockedCells('a', 4_001)).not.toContain('2:0');
  });

  it('desempata reservas compartidas por antigüedad y adapta Walk/Run', () => {
    const table = new RoamReservationTable();
    table.set({ actorId: 'late', current: { x: 0, y: 0 }, next: { x: 1, y: 1 }, waitingSince: 20 });
    table.set({ actorId: 'old', current: { x: 2, y: 0 }, next: { x: 1, y: 1 }, waitingSince: 10 });
    expect(table.canAdvance('late', { x: 0, y: 0 }, { x: 1, y: 1 }, 30)).toBe(false);
    expect(table.canAdvance('old', { x: 2, y: 0 }, { x: 1, y: 1 }, 30)).toBe(true);
    expect(resolveRoamLocomotion(40, false)).toMatchObject({ animation: 'Walk', fallback: false });
    expect(resolveRoamLocomotion(96, true)).toMatchObject({ animation: 'Run', fallback: false });
    expect(resolveRoamLocomotion(96, false)).toMatchObject({ animation: 'Walk', fallback: true });
  });

  it('detecta cuellos de botella y encuentra una reubicación fuera del área preferida', () => {
    const corridor = grid(5, 1);
    expect(findRoamChokePoints(corridor)).toEqual(new Set(['1:0', '2:0', '3:0']));
    expect(findNearestFreeRoamCell({
      origin: { x: 2, y: 0 },
      grid: corridor,
      preferred: [{ x: 2, y: 0 }],
      blocked: new Set(['2:0', '1:0']),
    })).toEqual({ x: 3, y: 0 });
  });

  it('mantiene reservas independientes para 25 actores sin destinos duplicados', () => {
    const table = new RoamReservationTable();
    for (let index = 0; index < 25; index += 1) table.set({
      actorId: `actor:${String(index).padStart(2, '0')}`,
      current: { x: index % 5, y: Math.floor(index / 5) * 2 },
      next: { x: index % 5, y: Math.floor(index / 5) * 2 + 1 },
      waitingSince: index,
    });
    for (let index = 0; index < 25; index += 1) expect(table.canAdvance(
      `actor:${String(index).padStart(2, '0')}`,
      { x: index % 5, y: Math.floor(index / 5) * 2 },
      { x: index % 5, y: Math.floor(index / 5) * 2 + 1 },
      30,
    )).toBe(true);
  });
});
