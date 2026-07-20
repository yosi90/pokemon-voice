import { describe, expect, it } from 'vitest';
import {
  estimateFundamentalFrequency,
  estimateRms,
  summarizeAcousticFrames,
} from '../../src/domain/expeditions/localAcousticAnalysis.js';

function sineWave(frequency: number, amplitude = 0.2, sampleRate = 48_000, length = 2_048) {
  return Float32Array.from({ length }, (_, index) => (
    Math.sin(2 * Math.PI * frequency * index / sampleRate) * amplitude
  ));
}

describe('análisis acústico local', () => {
  it('estima volumen y frecuencia sin conservar el audio', () => {
    const samples = sineWave(240, 0.2);
    expect(estimateRms(samples)).toBeCloseTo(0.141, 2);
    expect(estimateFundamentalFrequency(samples, 48_000)).toBeCloseTo(240, 0);
  });

  it('distingue una nota estable y un tarareo suave', () => {
    const result = summarizeAcousticFrames(Array.from({ length: 12 }, (_, index) => ({
      elapsedMs: index * 100,
      rms: 0.12,
      frequencyHz: 220 + (index % 2 ? 2 : -2),
    })));
    expect(result).toMatchObject({ durationMs: 1100, sustainedNote: true, simpleHum: true });
    expect(result.loudness).toBeGreaterThan(0.3);
  });

  it('reconoce un sonido fuerte aunque el tono sea irregular', () => {
    const result = summarizeAcousticFrames(Array.from({ length: 9 }, (_, index) => ({
      elapsedMs: index * 100,
      rms: 0.28,
      frequencyHz: index % 2 ? 120 : 560,
    })));
    expect(result).toMatchObject({ durationMs: 800, sustainedNote: false, simpleHum: false });
    expect(result.loudness).toBeGreaterThan(0.8);
  });

  it('devuelve métricas neutras cuando no hay sonido útil', () => {
    expect(summarizeAcousticFrames([{ elapsedMs: 0, rms: 0.005 }])).toEqual({
      loudness: 0,
      durationMs: 0,
      sustainedNote: false,
      simpleHum: false,
    });
  });
});

