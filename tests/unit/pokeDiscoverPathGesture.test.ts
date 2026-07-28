import { describe, expect, it } from 'vitest';
import {
  connectPokeDiscoverOrthogonalPath,
  extendPokeDiscoverOrthogonalPath,
  simplifyPokeDiscoverOrthogonalPath,
} from '../../src/domain/tools/pokeDiscoverPathGesture.js';

describe('trazado gestual de rutas por tiles', () => {
  it('convierte una diagonal en dos tramos ortogonales sobre la rejilla relativa', () => {
    const origin = { x: 10, y: 14 };
    const points = extendPokeDiscoverOrthogonalPath([origin], { x: 43, y: 31 }, origin);
    expect(points).toEqual([
      origin,
      { x: 42, y: 14 },
      { x: 42, y: 30 },
    ]);
    expect(points.slice(1).every((point, index) => (
      point.x === points[index].x || point.y === points[index].y
    ))).toBe(true);
  });

  it('retrocede sólo cuando vuelve exactamente a la celda anterior', () => {
    const origin = { x: 8, y: 8 };
    const forward = [
      origin,
      { x: 24, y: 8 },
      { x: 40, y: 8 },
    ];
    expect(extendPokeDiscoverOrthogonalPath(forward, { x: 24, y: 8 }, origin))
      .toEqual([origin, { x: 24, y: 8 }]);
    expect(extendPokeDiscoverOrthogonalPath(forward, origin, origin).at(-1))
      .toEqual(origin);
  });

  it('simplifica rectas y crea una conexión ortogonal desde una posición movida', () => {
    expect(simplifyPokeDiscoverOrthogonalPath([
      { x: 8, y: 8 },
      { x: 24, y: 8 },
      { x: 40, y: 8 },
      { x: 40, y: 24 },
    ])).toEqual([
      { x: 8, y: 8 },
      { x: 40, y: 8 },
      { x: 40, y: 24 },
    ]);
    expect(connectPokeDiscoverOrthogonalPath(
      { x: 8, y: 40 },
      [{ x: 40, y: 8 }, { x: 56, y: 8 }],
    )).toEqual([
      { x: 8, y: 40 },
      { x: 40, y: 40 },
      { x: 40, y: 8 },
      { x: 56, y: 8 },
    ]);
  });
});
