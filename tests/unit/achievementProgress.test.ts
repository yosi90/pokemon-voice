import { describe, expect, it, vi } from 'vitest';
import { createAchievementProgress } from '../../src/domain/achievements/achievementProgress.js';

describe('progreso puro de logros', () => {
  it('migra registros legacy conservando su primera fecha', () => {
    const progress = createAchievementProgress({ now: () => 999 });

    progress.loadPermanent([
      { id: 'first-blood', date: 200 },
      { id: 'first-blood', date: 100 },
    ]);

    expect(progress.getPermanentRecord('first-blood')).toEqual({ id: 'first-blood', date: 100 });
  });

  it('guarda la primera obtención con dominio y run de origen', () => {
    const progress = createAchievementProgress({ now: () => 500 });
    progress.startRun({ runId: 'run-a', startedAt: 400 });

    const result = progress.satisfy({ id: 'classic-start-pikachu', domain: 'pokedex' });

    expect(result).toEqual({
      status: 'newlyUnlocked',
      record: {
        id: 'classic-start-pikachu',
        date: 500,
        domain: 'pokedex',
        originRunId: 'run-a',
      },
    });
    expect(progress.getSnapshot().run.newlyUnlockedIds).toEqual(['classic-start-pikachu']);
  });

  it('evalúa cada run desde cero pero silencia un logro ya permanente', () => {
    const progress = createAchievementProgress({
      initialRecords: [{ id: 'classic-start-pikachu', date: 100 }],
      now: () => 500,
    });
    progress.startRun({ runId: 'run-b' });

    expect(progress.satisfy({ id: 'classic-start-pikachu' }).status).toBe('alreadyPermanent');
    expect(progress.satisfy({ id: 'classic-start-pikachu' }).status).toBe('alreadySatisfiedThisRun');
    expect(progress.getSnapshot().run.satisfiedIds).toEqual(['classic-start-pikachu']);
    expect(progress.getSnapshot().run.newlyUnlockedIds).toEqual([]);
  });

  it('permite reunir logros incompatibles en runs diferentes', () => {
    const progress = createAchievementProgress({ now: () => 500 });
    progress.startRun({ runId: 'run-pikachu' });
    progress.satisfy({ id: 'classic-start-pikachu' });
    progress.startRun({ runId: 'run-starter' });
    progress.satisfy({ id: 'faster-than-ash' });

    expect(progress.getSnapshot().permanentRecords.map(record => record.id)).toEqual([
      'classic-start-pikachu',
      'faster-than-ash',
    ]);
  });

  it('restaura los logros satisfechos de una sesión sin volver a concederlos', () => {
    const progress = createAchievementProgress({
      initialRecords: [
        { id: 'first-blood', date: 100 },
        { id: 'classic-start-pikachu', date: 200 },
      ],
    });
    progress.startRun({
      runId: 'run:timed',
      modeId: 'timed-collector',
      satisfiedIds: ['first-blood', 'first-blood', 'missing'],
    });

    expect(progress.getSnapshot().run).toMatchObject({
      modeId: 'timed-collector',
      satisfiedIds: ['first-blood'],
      newlyUnlockedIds: [],
    });
    expect(progress.satisfy({ id: 'first-blood' }).status).toBe('alreadySatisfiedThisRun');
    expect(progress.satisfy({ id: 'classic-start-pikachu' }).status).toBe('alreadyPermanent');
    expect(progress.getSnapshot().run.satisfiedIds).toEqual(['first-blood', 'classic-start-pikachu']);
  });

  it('guarda el modo de origen cuando el logro sí es nuevo para la cuenta', () => {
    const progress = createAchievementProgress({ now: () => 500 });
    progress.startRun({ runId: 'run:timed', modeId: 'timed-collector' });

    progress.satisfy({ id: 'first-blood' });

    expect(progress.getPermanentRecord('first-blood')).toMatchObject({
      originRunId: 'run:timed',
      originModeId: 'timed-collector',
    });
  });

  it('notifica a consumidores que no dependen de React', () => {
    const progress = createAchievementProgress();
    const listener = vi.fn();
    const unsubscribe = progress.subscribe(listener);

    progress.startRun({ runId: 'run-a' });
    progress.satisfy({ id: 'first-blood' });
    unsubscribe();
    progress.clearAll();

    expect(listener).toHaveBeenCalledTimes(2);
  });
});
