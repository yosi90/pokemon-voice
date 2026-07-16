import { describe, expect, it } from 'vitest';
import {
  ACHIEVEMENT_STORAGE_KEY,
  createBrowserAchievementStorage,
  parseAchievementRecords,
  serializeAchievementRecords,
} from '../../src/services/achievementStorage.js';

describe('persistencia de logros', () => {
  it('migra el formato legacy sin inventar dominio ni run de origen', () => {
    const records = parseAchievementRecords(JSON.stringify([
      { id: 'first-blood', date: 123 },
    ]));

    expect(records).toEqual([{ id: 'first-blood', date: 123 }]);
  });

  it('conserva fecha, dominio y run de origen en un round-trip enriquecido', () => {
    const serialized = serializeAchievementRecords([{
      id: 'classic-start-pikachu',
      date: 456,
      domain: 'pokedex',
      originRunId: 'run-456',
      originModeId: 'timed-collector',
    }]);

    expect(parseAchievementRecords(serialized)).toEqual([{
      id: 'classic-start-pikachu',
      date: 456,
      domain: 'pokedex',
      originRunId: 'run-456',
      originModeId: 'timed-collector',
    }]);
  });

  it('tolera datos corruptos y fechas legacy inválidas', () => {
    expect(parseAchievementRecords('{')).toEqual([]);
    expect(parseAchievementRecords(JSON.stringify([
      null,
      { id: '' },
      { id: 'legacy', date: 'invalid' },
    ]), () => 999)).toEqual([{ id: 'legacy', date: 999 }]);
  });

  it('limpia solo claves pertenecientes al sistema de logros', () => {
    const storage = createBrowserAchievementStorage(() => localStorage);
    localStorage.setItem(ACHIEVEMENT_STORAGE_KEY, '[]');
    localStorage.setItem('pokevoice-achievements-future', '[]');
    localStorage.setItem('pokevoice-guessed-v1', '[25]');

    storage.clear();

    expect(localStorage.getItem(ACHIEVEMENT_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem('pokevoice-achievements-future')).toBeNull();
    expect(localStorage.getItem('pokevoice-guessed-v1')).toBe('[25]');
  });
});
