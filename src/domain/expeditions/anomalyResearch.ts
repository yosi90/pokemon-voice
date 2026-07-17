import type {
  AnomalyResearchProgressV1,
  PokeDiscoverStateV1,
} from '../../../packages/contracts/src/index.js';

export const MISSINGNO_ANOMALY_ID = 'anomaly:missingno';
export const MISSINGNO_COMMAND_CLUE_ID = 'clue:missingno:secret-command';
export const MISSINGNO_COMMAND_FLAG = 'missingnoCommandFound';

export interface RecordAnomalyClueRequest {
  anomalyId: string;
  clueId: string;
  discoveredAt: string;
  setFlagId?: string;
}

export function recordAnomalyClue(
  state: PokeDiscoverStateV1,
  request: RecordAnomalyClueRequest,
) {
  if (!request.anomalyId?.trim() || !request.clueId?.trim()) {
    throw new Error('anomalyId y clueId deben ser identificadores estables no vacíos.');
  }
  if (Number.isNaN(Date.parse(request.discoveredAt))) {
    throw new Error('discoveredAt debe ser una fecha ISO válida.');
  }
  const current = state.anomalies?.[request.anomalyId];
  if (current?.discoveredClueIds.includes(request.clueId)) {
    return { status: 'alreadyRecorded' as const, state, progress: current };
  }

  const progress: AnomalyResearchProgressV1 = current
    ? {
      ...current,
      discoveredClueIds: [...current.discoveredClueIds, request.clueId],
    }
    : {
      schemaVersion: 1,
      anomalyId: request.anomalyId,
      status: 'clueFound',
      discoveredClueIds: [request.clueId],
      firstClueAt: new Date(request.discoveredAt).toISOString(),
    };
  return {
    status: 'recorded' as const,
    progress,
    state: {
      ...state,
      anomalies: { ...(state.anomalies ?? {}), [request.anomalyId]: progress },
      worldFlags: request.setFlagId
        ? { ...state.worldFlags, [request.setFlagId]: true }
        : state.worldFlags,
    },
  };
}

export function recordMissingNoCommand(state: PokeDiscoverStateV1, discoveredAt: string) {
  return recordAnomalyClue(state, {
    anomalyId: MISSINGNO_ANOMALY_ID,
    clueId: MISSINGNO_COMMAND_CLUE_ID,
    discoveredAt,
    setFlagId: MISSINGNO_COMMAND_FLAG,
  });
}
