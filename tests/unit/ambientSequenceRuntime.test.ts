import { describe, expect, it } from 'vitest';
import { sampleMilliseconds } from '../../src/domain/maps/createTechnicalPhaserGame.js';

describe('pausas variables de coreografías ambientales', () => {
  it('conserva pausas fijas y muestrea rangos inclusivos sin alterar su orden', () => {
    expect(sampleMilliseconds(350, () => 0.9)).toBe(350);
    expect(sampleMilliseconds({ min: 200, max: 600 }, () => 0)).toBe(200);
    expect(sampleMilliseconds({ min: 200, max: 600 }, () => 0.5)).toBe(400);
    expect(sampleMilliseconds({ min: 200, max: 600 }, () => 1)).toBe(600);
  });
});
