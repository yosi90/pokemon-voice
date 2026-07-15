import type { AchievementDomain } from '../../../packages/contracts/src/index.js';

export interface AchievementRecord {
  id: string;
  date: number;
  domain?: AchievementDomain;
  originRunId?: string;
}

export interface AchievementRunSnapshot {
  runId: string;
  startedAt: number;
  satisfiedIds: readonly string[];
  newlyUnlockedIds: readonly string[];
}

export interface AchievementProgressSnapshot {
  permanentRecords: readonly AchievementRecord[];
  run: AchievementRunSnapshot;
}

export type AchievementSatisfactionStatus =
  | 'newlyUnlocked'
  | 'alreadyPermanent'
  | 'alreadySatisfiedThisRun';

export interface AchievementSatisfactionResult {
  status: AchievementSatisfactionStatus;
  record: AchievementRecord;
}

interface CreateAchievementProgressOptions {
  initialRecords?: readonly AchievementRecord[];
  now?: () => number;
}

interface StartAchievementRunOptions {
  runId: string;
  startedAt?: number;
}

interface SatisfyAchievementOptions {
  id: string;
  domain?: AchievementDomain;
  date?: number;
}

const emptyRun = (startedAt: number): AchievementRunSnapshot => ({
  runId: 'unstarted',
  startedAt,
  satisfiedIds: [],
  newlyUnlockedIds: [],
});

function normalizeRecord(record: AchievementRecord, fallbackDate: number): AchievementRecord | null {
  if (!record || typeof record.id !== 'string' || !record.id.trim()) return null;
  return {
    id: record.id,
    date: Number.isFinite(Number(record.date)) ? Number(record.date) : fallbackDate,
    ...(record.domain ? { domain: record.domain } : {}),
    ...(record.originRunId ? { originRunId: record.originRunId } : {}),
  };
}

export function createAchievementProgress({
  initialRecords = [],
  now = Date.now,
}: CreateAchievementProgressOptions = {}) {
  const permanent = new Map<string, AchievementRecord>();
  const listeners = new Set<() => void>();
  let run = emptyRun(now());
  let snapshot: AchievementProgressSnapshot;

  const rebuildSnapshot = () => {
    snapshot = Object.freeze({
      permanentRecords: Object.freeze([...permanent.values()].map(record => Object.freeze({ ...record }))),
      run: Object.freeze({
        ...run,
        satisfiedIds: Object.freeze([...run.satisfiedIds]),
        newlyUnlockedIds: Object.freeze([...run.newlyUnlockedIds]),
      }),
    });
  };

  const notify = () => {
    rebuildSnapshot();
    for (const listener of [...listeners]) listener();
  };

  const loadPermanent = (records: readonly AchievementRecord[]) => {
    for (const candidate of records) {
      const record = normalizeRecord(candidate, now());
      if (!record) continue;
      const current = permanent.get(record.id);
      if (!current || record.date < current.date) permanent.set(record.id, record);
    }
    notify();
  };

  const startRun = ({ runId, startedAt = now() }: StartAchievementRunOptions) => {
    run = { runId, startedAt, satisfiedIds: [], newlyUnlockedIds: [] };
    notify();
  };

  const satisfy = ({
    id,
    domain = 'pokedex',
    date = now(),
  }: SatisfyAchievementOptions): AchievementSatisfactionResult => {
    if (run.satisfiedIds.includes(id)) {
      const record = permanent.get(id);
      if (!record) throw new Error(`El logro satisfecho ${id} no tiene registro permanente.`);
      return { status: 'alreadySatisfiedThisRun', record };
    }

    const previous = permanent.get(id);
    run = { ...run, satisfiedIds: [...run.satisfiedIds, id] };
    if (previous) {
      notify();
      return { status: 'alreadyPermanent', record: previous };
    }

    const record: AchievementRecord = {
      id,
      date,
      domain,
      originRunId: run.runId,
    };
    permanent.set(id, record);
    run = { ...run, newlyUnlockedIds: [...run.newlyUnlockedIds, id] };
    notify();
    return { status: 'newlyUnlocked', record };
  };

  const clearAll = () => {
    permanent.clear();
    run = emptyRun(now());
    notify();
  };

  const getSnapshot = () => snapshot;
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  const hasPermanent = (id: string) => permanent.has(id);
  const getPermanentRecord = (id: string) => permanent.get(id) || null;

  loadPermanent(initialRecords);

  return {
    clearAll,
    getPermanentRecord,
    getSnapshot,
    hasPermanent,
    loadPermanent,
    satisfy,
    startRun,
    subscribe,
  };
}
