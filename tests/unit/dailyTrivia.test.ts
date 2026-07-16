import { describe, expect, it } from 'vitest';
import { formatLocalDateKey, getPreviousLocalDateKey, selectDailyTriviaChallenge } from '../../src/domain/modes/dailyTrivia.js';
import { THEMED_CHALLENGES } from '../../src/domain/modes/themedChallenges.js';

describe('desafío diario local', () => {
  it('usa la fecha civil local y calcula correctamente el día anterior', () => {
    expect(formatLocalDateKey(new Date(2026, 0, 2, 23, 59))).toBe('2026-01-02');
    expect(getPreviousLocalDateKey('2026-01-01')).toBe('2025-12-31');
  });

  it('elige el mismo examen para una fecha y recorre los 30 antes de repetir', () => {
    const ids = Array.from({ length: 30 }, (_, offset) => {
      const date = new Date(2026, 0, 1 + offset, 12);
      return selectDailyTriviaChallenge(THEMED_CHALLENGES, formatLocalDateKey(date))?.challengeId;
    });
    expect(ids[0]).toBe(selectDailyTriviaChallenge(THEMED_CHALLENGES, '2026-01-01')?.challengeId);
    expect(new Set(ids)).toHaveLength(30);
  });

  it('degrada con seguridad cuando no hay exámenes disponibles', () => {
    expect(selectDailyTriviaChallenge([], '2026-01-01')).toBeUndefined();
  });
});
