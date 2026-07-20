import type { AcousticExpressionFeatures } from './expressionTriggers.js';

export interface AcousticFrameV1 {
  elapsedMs: number;
  rms: number;
  frequencyHz?: number;
}

const ACTIVE_RMS = 0.025;

function median(values: readonly number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function estimateRms(samples: Float32Array) {
  if (!samples.length) return 0;
  let total = 0;
  for (const sample of samples) total += sample * sample;
  return Math.sqrt(total / samples.length);
}

/**
 * Estimación ligera basada en cruces ascendentes por cero. No intenta reconocer
 * melodías: únicamente aporta una frecuencia estable para distinguir voz/nota
 * sostenida de ruido irregular sin enviar audio fuera del navegador.
 */
export function estimateFundamentalFrequency(samples: Float32Array, sampleRate: number) {
  const crossings: number[] = [];
  for (let index = 1; index < samples.length; index += 1) {
    if (samples[index - 1] <= 0 && samples[index] > 0) crossings.push(index);
  }
  if (crossings.length < 3) return undefined;
  const periods = crossings.slice(1).map((crossing, index) => crossing - crossings[index]);
  const period = median(periods.filter(value => value > 0));
  if (!period) return undefined;
  const frequency = sampleRate / period;
  return frequency >= 70 && frequency <= 1200 ? frequency : undefined;
}

export function summarizeAcousticFrames(frames: readonly AcousticFrameV1[]): AcousticExpressionFeatures {
  const active = frames.filter(frame => frame.rms >= ACTIVE_RMS);
  if (!active.length) return { loudness: 0, durationMs: 0, sustainedNote: false, simpleHum: false };
  const loudness = Math.min(1, median(active.map(frame => frame.rms)) / 0.32);
  const durationMs = Math.max(0, active[active.length - 1].elapsedMs - active[0].elapsedMs);
  const frequencies = active
    .map(frame => frame.frequencyHz)
    .filter((value): value is number => Number.isFinite(value));
  const centralFrequency = median(frequencies);
  const stableFrames = centralFrequency > 0
    ? frequencies.filter(value => Math.abs(value - centralFrequency) / centralFrequency <= 0.08)
    : [];
  const stableRatio = frequencies.length ? stableFrames.length / frequencies.length : 0;
  const stableTone = frequencies.length >= 5 && stableRatio >= 0.72;
  return {
    loudness: Math.round(loudness * 1000) / 1000,
    durationMs: Math.round(durationMs),
    sustainedNote: stableTone && durationMs >= 600,
    simpleHum: stableTone && durationMs >= 700 && loudness <= 0.7,
  };
}

