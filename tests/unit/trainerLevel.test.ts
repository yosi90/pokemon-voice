import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TRAINER_LEVEL_THRESHOLDS,
  MAX_TRAINER_LEVEL,
  getTrainerLevelForExperience,
  normalizeTrainerProgress,
} from '../../src/domain/trainer/trainerLevel.js';

describe('nivel de entrenador', () => {
  it('ofrece cien niveles con umbrales acumulados estrictamente crecientes', () => {
    expect(DEFAULT_TRAINER_LEVEL_THRESHOLDS).toHaveLength(MAX_TRAINER_LEVEL);
    expect(DEFAULT_TRAINER_LEVEL_THRESHOLDS[0]).toBe(0);
    expect(DEFAULT_TRAINER_LEVEL_THRESHOLDS.every((threshold, index, all) => (
      index === 0 || threshold > all[index - 1]
    ))).toBe(true);
  });

  it('sube justo al alcanzar un umbral y queda limitado por el final de la tabla', () => {
    const levelTwoExperience = DEFAULT_TRAINER_LEVEL_THRESHOLDS[1];
    const maximumExperience = DEFAULT_TRAINER_LEVEL_THRESHOLDS.at(-1) ?? 0;

    expect(getTrainerLevelForExperience(levelTwoExperience - 1)).toBe(1);
    expect(getTrainerLevelForExperience(levelTwoExperience)).toBe(2);
    expect(getTrainerLevelForExperience(maximumExperience)).toBe(MAX_TRAINER_LEVEL);
    expect(getTrainerLevelForExperience(Number.MAX_SAFE_INTEGER)).toBe(MAX_TRAINER_LEVEL);
  });

  it('permite sustituir la tabla para balancear la curva sin cambiar el guardado', () => {
    const customThresholds = [0, 10, 30, 60];
    expect(getTrainerLevelForExperience(29, customThresholds)).toBe(2);
    expect(getTrainerLevelForExperience(30, customThresholds)).toBe(3);
  });

  it('normaliza experiencia corrupta y vuelve a derivar el nivel', () => {
    expect(normalizeTrainerProgress(-20)).toEqual({ trainerExperience: 0, trainerLevel: 1 });
    expect(normalizeTrainerProgress('100')).toEqual({ trainerExperience: 0, trainerLevel: 1 });
    expect(normalizeTrainerProgress(100)).toEqual({ trainerExperience: 100, trainerLevel: 3 });
  });

  it.each([
    { thresholds: [] },
    { thresholds: [1, 10] },
    { thresholds: [0, 10, 10] },
    { thresholds: [0, 12.5] },
  ])('rechaza una tabla incoherente: $thresholds', ({ thresholds }) => {
    expect(() => getTrainerLevelForExperience(0, thresholds)).toThrow();
  });
});
