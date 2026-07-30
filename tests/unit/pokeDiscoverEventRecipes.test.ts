import { describe, expect, it } from 'vitest';
import { createPokeDiscoverAdventure } from '../../src/domain/tools/pokeDiscoverEditorProject.js';
import {
  createPokeDiscoverEventRecipe,
  POKEDISCOVER_EVENT_RECIPES,
} from '../../src/domain/tools/pokeDiscoverEventRecipes.js';

function adventure() {
  const base = createPokeDiscoverAdventure({ title: 'Test', mapId: 'map:test' });
  return {
    ...base,
    actorPlacements: [
      {
        schemaVersion: 1 as const,
        placementId: 'actor:one',
        sectorId: 'sector:test',
        anchorId: 'anchor:one',
        assetId: 'pmd:one',
        animation: 'Idle',
      },
      {
        schemaVersion: 1 as const,
        placementId: 'actor:two',
        sectorId: 'sector:test',
        anchorId: 'anchor:two',
        assetId: 'pmd:two',
        animation: 'Idle',
      },
    ],
  };
}

describe('guided event recipes', () => {
  it('crea las nueve recetas sin mutar el documento original', () => {
    const source = adventure();
    for (const recipe of POKEDISCOVER_EVENT_RECIPES) {
      const result = createPokeDiscoverEventRecipe(source, {
        kind: recipe.kind,
        sectorId: 'sector:test',
        primaryActorId: 'actor:one',
        secondaryActorId: 'actor:two',
        pathId: 'path:test',
        effectAssetId: 'effect:bubble',
        phrase: 'canta',
      });
      expect(result.createdId).toMatch(/^trigger:map:\d{2,}$/);
      expect(result.adventure).not.toBe(source);
    }
    expect(source.mapSequences).toEqual([]);
    expect(source.mapEventTriggers).toBeUndefined();
  });

  it('la receta de proyectil usa temporizador, efecto y consecuencia compartida', () => {
    const consequence = {
      schemaVersion: 1 as const,
      outcome: 'resetSector' as const,
      rollbackPolicy: 'restoreSnapshot' as const,
      destination: { kind: 'sectorEntry' as const },
    };
    const result = createPokeDiscoverEventRecipe(adventure(), {
      kind: 'periodicProjectile',
      sectorId: 'sector:test',
      primaryActorId: 'actor:one',
      effectAssetId: 'effect:bubble',
      intervalMs: 1_500,
      consequence,
    });
    expect(result.adventure.mapEventTriggers?.[0].activation).toEqual({
      kind: 'interval',
      intervalMs: 1_500,
    });
    expect(result.adventure.mapSequences?.[0].beats[0].actions[0]).toEqual(
      expect.objectContaining({
        kind: 'spawnProjectile',
        effectAssetId: 'effect:bubble',
        consequence,
      }),
    );
  });

  it('genera IDs únicos al repetir una receta', () => {
    const first = createPokeDiscoverEventRecipe(adventure(), {
      kind: 'proximityAmbush',
      sectorId: 'sector:test',
      primaryActorId: 'actor:one',
    });
    const second = createPokeDiscoverEventRecipe(first.adventure, {
      kind: 'proximityAmbush',
      sectorId: 'sector:test',
      primaryActorId: 'actor:one',
    });
    expect(second.createdId).not.toBe(first.createdId);
  });
});
