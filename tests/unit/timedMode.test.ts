import { describe, expect, it } from 'vitest';
import { createTimedRun, getTimedRunRemaining } from '../../src/domain/modes/timedMode.js';

describe('modo contrarreloj', () => {
  it('crea un temporizador reproducible', () => {
    expect(createTimedRun(120, 1_000)).toEqual({ startedAt: 1_000, durationSec: 120, left: 120 });
  });

  it('calcula el tiempo restante sin devolver valores negativos', () => {
    const timer = createTimedRun(120, 1_000);

    expect(getTimedRunRemaining(timer, 31_000)).toBe(90);
    expect(getTimedRunRemaining(timer, 200_000)).toBe(0);
  });
});
