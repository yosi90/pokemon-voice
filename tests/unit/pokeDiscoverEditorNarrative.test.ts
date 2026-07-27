import { describe, expect, it } from 'vitest';
import teguesteAdventure from '../../public/assets/adventure/maps/tegueste-forest/tegueste-forest.adventure.json';
import type { AdventureMapV3, ResearchFactV1 } from '../../packages/contracts/src/index.js';
import { normalizeAdventureMapV3 } from '../../src/domain/expeditions/adventureMapV3.js';
import { getBalancedPokeDiscoverRewards } from '../../src/data/adventure/rewardBalance.js';
import {
  updateEditorBehaviorTrigger,
  updateEditorExpressionTrigger,
  upsertEditorResearchFact,
} from '../../src/domain/tools/pokeDiscoverEditorNarrative.js';

describe('configuración narrativa del editor', () => {
  it('añade investigación con recompensa idempotente basada en factId', () => {
    const adventure = normalizeAdventureMapV3(structuredClone(teguesteAdventure) as never);
    const fact: ResearchFactV1 = {
      schemaVersion: 1,
      factId: 'research:test:rattata',
      speciesId: 19,
      field: 'behavior',
      contribution: 'fieldCompletion',
      mapId: adventure.mapId,
      interactionId: adventure.interactions![0].interactionId,
      text: 'Rattata coopera para conseguir alimento.',
      rewards: getBalancedPokeDiscoverRewards('uniqueObservation'),
    };
    const updated = upsertEditorResearchFact(adventure, fact);
    expect(updated.researchFacts).toEqual([fact]);
    expect(adventure.researchFacts).toBeUndefined();
  });

  it('actualiza comportamientos y expresiones por su ID estable', () => {
    const adventure = normalizeAdventureMapV3(structuredClone(teguesteAdventure) as never);
    const behavior = { ...adventure.behaviorTriggers[0], actionLabel: 'Nueva acción' };
    const expression = { ...adventure.expressionTriggers[0], prompt: 'Nuevo prompt' };
    const withBehavior = updateEditorBehaviorTrigger(adventure, behavior);
    const updated = updateEditorExpressionTrigger(withBehavior, expression);
    expect(updated.behaviorTriggers[0].actionLabel).toBe('Nueva acción');
    expect(updated.expressionTriggers[0].prompt).toBe('Nuevo prompt');
    expect(adventure.behaviorTriggers[0].actionLabel).not.toBe('Nueva acción');
  });
});
