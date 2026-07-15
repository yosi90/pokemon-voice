export interface TimedRunState {
  startedAt: number;
  durationSec: number;
  left: number;
}

export function createTimedRun(durationSec: number, startedAt = Date.now()): TimedRunState {
  return { startedAt, durationSec, left: durationSec };
}

export function getTimedRunRemaining(timer: Pick<TimedRunState, 'startedAt' | 'durationSec'>, now = Date.now()): number {
  return Math.max(0, timer.durationSec - (now - timer.startedAt) / 1000);
}
