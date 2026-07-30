import { describe, expect, it } from 'vitest';
import {
  advancePausableInterval,
  lockedChargeDestination,
  sweptPointHitsBounds,
} from '../../src/domain/maps/adventureHazardPhysics.js';

describe('hazard physics', () => {
  it('detecta un impacto barrido aunque el proyectil salte sobre el objetivo', () => {
    expect(sweptPointHitsBounds(
      { x: 0, y: 8 },
      { x: 40, y: 8 },
      { x: 16, y: 0, width: 10, height: 16 },
      4,
      4,
    )).toBe(true);
    expect(sweptPointHitsBounds(
      { x: 0, y: 40 },
      { x: 40, y: 40 },
      { x: 16, y: 0, width: 10, height: 16 },
    )).toBe(false);
  });

  it('fija el objetivo de una carga y respeta su distancia máxima', () => {
    expect(lockedChargeDestination({ x: 0, y: 0 }, { x: 30, y: 40 }, 25))
      .toEqual({ x: 15, y: 20 });
  });

  it('no avanza temporizadores durante una pausa', () => {
    const initial = { elapsedMs: 0, nextAtMs: 500 };
    const paused = advancePausableInterval(initial, 600, 500, true);
    expect(paused).toEqual({ state: initial, fired: false });
    const active = advancePausableInterval(paused.state, 600, 500, false);
    expect(active.fired).toBe(true);
    expect(active.state.nextAtMs).toBe(1000);
  });
});
