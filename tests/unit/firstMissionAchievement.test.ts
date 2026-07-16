import { beforeEach, describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from '../../scripts/achievements-list.js';
import {
  FIRST_MISSION_ACHIEVEMENT,
  FIRST_MISSION_STORY_FLAG,
} from '../../src/domain/achievements/pokeDiscoverAchievements.js';
import {
  getBrowserPokeVoiceSave,
  syncBrowserAchievements,
  updateBrowserPokeDiscover,
} from '../../src/store/browserPokeVoiceSaveStore.js';

describe('definición permanente de ¡Primera misión!', () => {
  beforeEach(() => localStorage.clear());

  it('queda ligada a completar una misión real y no a aceptar PokeDiscover', () => {
    expect(FIRST_MISSION_ACHIEVEMENT).toMatchObject({
      schemaVersion: 2,
      achievementId: 'first-mission',
      domain: 'pokeDiscover',
      evaluationCycle: 'persistent',
      event: 'missionCompleted',
      requirement: { kind: 'storyEvent', eventId: FIRST_MISSION_STORY_FLAG },
    });
    expect(ACHIEVEMENTS.find(achievement => achievement.id === 'first-mission')).toMatchObject({
      title: '¡Primera misión!',
      domain: 'pokeDiscover',
      event: 'manual',
    });
  });

  it('la sincronización legacy nunca borra logros propios de PokeDiscover', () => {
    getBrowserPokeVoiceSave();
    updateBrowserPokeDiscover(state => ({
      ...state,
      achievements: {
        ...state.achievements,
        'first-mission': {
          schemaVersion: 1,
          achievementId: 'first-mission',
          unlockedAt: '2026-07-16T20:40:00.000Z',
          domain: 'pokeDiscover',
        },
      },
    }));

    syncBrowserAchievements([{
      id: 'first-blood',
      date: Date.parse('2026-07-16T20:41:00.000Z'),
      domain: 'pokedex',
    }]);

    expect(Object.keys(getBrowserPokeVoiceSave().pokeDiscover.achievements).sort()).toEqual([
      'first-blood',
      'first-mission',
    ]);
  });
});
