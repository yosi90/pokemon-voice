import {
  estimateFundamentalFrequency,
  estimateRms,
  summarizeAcousticFrames,
  type AcousticFrameV1,
} from '../domain/expeditions/localAcousticAnalysis.js';
import type { AcousticExpressionFeatures } from '../domain/expeditions/expressionTriggers.js';

export interface CaptureLocalAcousticExpressionOptions {
  durationMs?: number;
  signal?: AbortSignal;
  onProgress?: (elapsedMs: number) => void;
}

export async function captureLocalAcousticExpression({
  durationMs = 1800,
  signal,
  onProgress,
}: CaptureLocalAcousticExpressionOptions = {}): Promise<AcousticExpressionFeatures> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Este navegador no permite analizar el micrófono localmente.');
  }
  if (signal?.aborted) throw new DOMException('Análisis cancelado.', 'AbortError');
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  if (signal?.aborted) {
    stream.getTracks().forEach(track => track.stop());
    throw new DOMException('Análisis cancelado.', 'AbortError');
  }
  const AudioContextCtor = window.AudioContext
    ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) {
    stream.getTracks().forEach(track => track.stop());
    throw new Error('Este navegador no dispone de análisis de audio local.');
  }
  let context: AudioContext;
  try {
    context = new AudioContextCtor();
  } catch (error) {
    stream.getTracks().forEach(track => track.stop());
    throw error;
  }
  let analyser: AnalyserNode;
  let source: MediaStreamAudioSourceNode;
  try {
    analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.2;
    source = context.createMediaStreamSource(stream);
    source.connect(analyser);
  } catch (error) {
    stream.getTracks().forEach(track => track.stop());
    await context.close().catch(() => undefined);
    throw error;
  }
  const samples = new Float32Array(analyser.fftSize);
  const frames: AcousticFrameV1[] = [];
  const startedAt = performance.now();

  try {
    await new Promise<void>((resolve, reject) => {
      let animationFrame = 0;
      const cancel = () => {
        cancelAnimationFrame(animationFrame);
        reject(new DOMException('Análisis cancelado.', 'AbortError'));
      };
      signal?.addEventListener('abort', cancel, { once: true });
      const sample = () => {
        const elapsedMs = performance.now() - startedAt;
        analyser.getFloatTimeDomainData(samples);
        const rms = estimateRms(samples);
        frames.push({
          elapsedMs,
          rms,
          ...(rms >= 0.025
            ? { frequencyHz: estimateFundamentalFrequency(samples, context.sampleRate) }
            : {}),
        });
        onProgress?.(Math.min(durationMs, elapsedMs));
        if (elapsedMs >= durationMs) {
          signal?.removeEventListener('abort', cancel);
          resolve();
          return;
        }
        animationFrame = requestAnimationFrame(sample);
      };
      animationFrame = requestAnimationFrame(sample);
    });
    return summarizeAcousticFrames(frames);
  } finally {
    source.disconnect();
    analyser.disconnect();
    stream.getTracks().forEach(track => track.stop());
    await context.close().catch(() => undefined);
  }
}
