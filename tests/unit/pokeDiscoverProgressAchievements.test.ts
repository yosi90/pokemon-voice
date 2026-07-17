import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SpeciesResearchProgressV1 } from '../../packages/contracts/src/index.js';
import {
  POKE_DISCOVER_ACHIEVEMENT_EVENT,
  POKE_DISCOVER_PROGRESS_ACHIEVEMENTS,
  unlockSatisfiedPokeDiscoverAchievements,
} from '../../src/domain/achievements/pokeDiscoverAchievements.js';
import { createAdventureMapProgressV1 } from '../../src/domain/expeditions/adventureMapProgress.js';
import { createPokeVoiceSaveV1 } from '../../src/domain/progress/pokeVoiceSave.js';
import {
  claimBrowserPokeDiscoverRewards,
  getBrowserPokeVoiceSave,
} from '../../src/store/browserPokeVoiceSaveStore.js';

const NOW = '2026-07-18T10:00:00.000Z';

function completeResearch(speciesId: number): SpeciesResearchProgressV1 {
  const field = (name: 'biometrics' | 'behavior' | 'habitat' | 'exceptional') => ({
    field: name,
    discoveredFactIds: [`fact:${speciesId}:${name}`],
    completed: true,
  });
  return {
    schemaVersion: 1,
    speciesId,
    status: 'complete',
    fields: {
      biometrics: field('biometrics'),
      behavior: field('behavior'),
      habitat: field('habitat'),
      exceptional: field('exceptional'),
    },
    additionalNoteIds: [],
  };
}

describe('logros de progreso de PokeDiscover', () => {
  beforeEach(() => localStorage.clear());

  it('declara logros permanentes para nivel, secretos, mapas e investigación', () => {
    expect(POKE_DISCOVER_PROGRESS_ACHIEVEMENTS.map(item => item.requirement)).toEqual(expect.arrayContaining([
      { kind: 'trainerLevel', minimum: 5 },
      { kind: 'unlockedSecrets', minimum: 1 },
      { kind: 'completedMaps', minimum: 1 },
      { kind: 'completedResearchEntries', minimum: 1 },
    ]));
    expect(POKE_DISCOVER_PROGRESS_ACHIEVEMENTS.every(item => (
      item.domain === 'pokeDiscover' && item.evaluationCycle === 'persistent'
    ))).toBe(true);
  });

  it('evalúa conteos derivados sin mantener contadores duplicados', () => {
    const initial = createPokeVoiceSaveV1({ runId: 'run:test', now: Date.parse(NOW) });
    const map = {
      ...createAdventureMapProgressV1('map:test'),
      freeExpeditionUnlocked: true,
      unlockedSecretIds: ['secret:test:first'],
    };
    const save = {
      ...initial,
      pokeDiscover: {
        ...initial.pokeDiscover,
        trainerLevel: 5,
        mapProgress: { 'map:test': map },
        researchBySpecies: { 25: completeResearch(25) },
      },
    };

    const first = unlockSatisfiedPokeDiscoverAchievements(save, NOW);
    expect(first.unlocked.map(item => item.achievementId)).toEqual([
      'trainer-level-5',
      'first-map-secret',
      'first-expedition-map',
      'first-research-entry',
    ]);
    expect(Object.values(first.save.pokeDiscover.achievements)).toEqual(expect.arrayContaining([
      expect.objectContaining({ domain: 'pokeDiscover', originRunId: 'run:test' }),
    ]));
    const repeated = unlockSatisfiedPokeDiscoverAchievements(first.save, NOW);
    expect(repeated.unlocked).toEqual([]);
    expect(repeated.save).toBe(first.save);
  });

  it('el guardado del navegador concede el logro de nivel y emite feedback una sola vez', () => {
    getBrowserPokeVoiceSave();
    const listener = vi.fn();
    window.addEventListener(POKE_DISCOVER_ACHIEVEMENT_EVENT, listener);

    claimBrowserPokeDiscoverRewards({
      originId: 'reward:test:level-five',
      claimedAt: NOW,
      rewards: [{ kind: 'trainerExperience', amount: 400 }],
    });
    claimBrowserPokeDiscoverRewards({
      originId: 'reward:test:level-five',
      claimedAt: NOW,
      rewards: [{ kind: 'trainerExperience', amount: 400 }],
    });

    expect(getBrowserPokeVoiceSave().pokeDiscover.achievements['trainer-level-5'])
      .toMatchObject({ domain: 'pokeDiscover' });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].detail.achievementIds).toContain('trainer-level-5');
  });
});
