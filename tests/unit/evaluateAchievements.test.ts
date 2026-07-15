import { describe, expect, it } from 'vitest';
import {
  findSatisfiedAchievements,
  isAchievementSatisfied,
} from '../../src/domain/achievements/evaluateAchievements.js';

describe('evaluación pura de logros', () => {
  it('filtra por evento y scope conservando el orden de definición', async () => {
    const achievements = [
      { id: 'guess-a', event: 'guess', scope: 'run', check: () => true },
      { id: 'fail-a', event: 'fail', scope: 'run', check: () => true },
      { id: 'persistent-a', event: 'guess', scope: 'persistent', check: () => true },
      { id: 'guess-b', check: async () => true },
    ];

    const satisfied = await findSatisfiedAchievements(achievements, 'guess', {}, {});

    expect(satisfied.map(achievement => achievement.id)).toEqual(['guess-a', 'guess-b']);
  });

  it('admite condiciones síncronas y asíncronas con el mismo contrato', async () => {
    const context = { count: 2 };
    const meta = { id: 25 };

    await expect(isAchievementSatisfied({
      id: 'sync',
      check: (currentMeta, currentContext) => (
        currentMeta.id === 25 && currentContext.count === 2
      ),
    }, meta, context)).resolves.toBe(true);
    await expect(isAchievementSatisfied({
      id: 'async',
      check: async () => false,
    }, meta, context)).resolves.toBe(false);
  });

  it('aísla una condición defectuosa sin impedir evaluar las siguientes', async () => {
    const achievements = [
      { id: 'broken', check: () => { throw new Error('fallo'); } },
      { id: 'valid', check: () => true },
    ];

    const satisfied = await findSatisfiedAchievements(achievements, 'guess', {}, {});

    expect(satisfied.map(achievement => achievement.id)).toEqual(['valid']);
  });
});
