import { describe, expect, it } from 'vitest';
import {
  activeGridDirection,
  canStartClassicStep,
  findGridPath,
  gridStep,
  pressGridDirection,
  releaseGridDirection,
} from '../../src/domain/maps/gridCompanionRuntime.js';

describe('movimiento clásico y rutas de compañero', () => {
  it('gira con una pulsación corta y camina al mantener o mirar ya en esa dirección', () => {
    expect(canStartClassicStep({ facing: 'up', requestedFacing: 'right', heldForMs: 139 })).toBe(false);
    expect(canStartClassicStep({ facing: 'up', requestedFacing: 'right', heldForMs: 140 })).toBe(true);
    expect(canStartClassicStep({ facing: 'right', requestedFacing: 'right', heldForMs: 0 })).toBe(true);
    expect(canStartClassicStep({
      facing: 'up', requestedFacing: 'right', heldForMs: 0, chainingStep: true,
    })).toBe(true);
  });

  it('mantiene cada paso ajustado a la cuadrícula de 16 px', () => {
    expect(gridStep({ x: 24, y: 48 }, 'right')).toEqual({ x: 40, y: 48 });
    expect(gridStep({ x: 24, y: 48 }, 'up', 2)).toEqual({ x: 24, y: 16 });
  });

  it('recupera la dirección anterior cuando se suelta la dirección más reciente', () => {
    let pressed = pressGridDirection([], {
      code: 'ArrowLeft', facing: 'left', startedAt: 10, facingAtPress: 'left',
    });
    pressed = pressGridDirection(pressed, {
      code: 'ArrowUp', facing: 'up', startedAt: 30, facingAtPress: 'left',
    });
    expect(activeGridDirection(pressed)?.facing).toBe('up');
    pressed = releaseGridDirection(pressed, 'ArrowUp');
    expect(activeGridDirection(pressed)?.facing).toBe('left');
    expect(activeGridDirection(pressed)?.startedAt).toBe(10);
  });

  it('encuentra una ruta ortogonal evitando casillas bloqueadas', () => {
    const path = findGridPath({
      from: { x: 8, y: 16 },
      to: { x: 40, y: 16 },
      canOccupy: (x, y) => x >= 8 && y >= 16 && x <= 40 && y <= 48 && !(x === 24 && y === 16),
    });
    expect(path[0]).toEqual({ x: 8, y: 16 });
    expect(path.at(-1)).toEqual({ x: 40, y: 16 });
    expect(path).not.toContainEqual({ x: 24, y: 16 });
  });
});
