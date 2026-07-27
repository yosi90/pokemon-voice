import { describe, expect, it } from 'vitest';
import teguesteAdventure from '../../public/assets/adventure/maps/tegueste-forest/tegueste-forest.adventure.json';
import type { AdventureMapV3, RequirementExpressionV1 } from '../../packages/contracts/src/index.js';
import { normalizeAdventureMapV3 } from '../../src/domain/expeditions/adventureMapV3.js';
import {
  createRequirementAtom,
  listAdventureRequirementTargets,
  removeRequirementNode,
  replaceRequirementNode,
  updateAdventureRequirement,
} from '../../src/domain/tools/pokeDiscoverEditorRequirements.js';

describe('editor visual de requisitos', () => {
  it('indexa y actualiza cada definición sin mutar el sidecar original', () => {
    const adventure = normalizeAdventureMapV3(structuredClone(teguesteAdventure) as never);
    const target = listAdventureRequirementTargets(adventure)
      .find(candidate => candidate.definitionId === 'behavior:tegueste:burrow-left:snake-intimidation');
    expect(target?.expression).toHaveProperty('any');

    const expression: RequirementExpressionV1 = { all: [
      { kind: 'trainerLevel', minimum: 3 },
      { any: [{ kind: 'companionType', typeId: 'rock' }] },
    ] };
    const updated = updateAdventureRequirement(adventure, target!, expression);
    expect(updated.behaviorTriggers.find(item => item.triggerId === target!.definitionId)?.requirement).toEqual(expression);
    expect(adventure.behaviorTriggers.find(item => item.triggerId === target!.definitionId)?.requirement).not.toEqual(expression);
  });

  it('reemplaza y elimina nodos anidados preservando el resto del árbol', () => {
    const original: RequirementExpressionV1 = { all: [
      createRequirementAtom('trainerLevel'),
      { any: [createRequirementAtom('registeredSpecies'), createRequirementAtom('achievement')] },
    ] };
    const replaced = replaceRequirementNode(original, [1, 0], { kind: 'companionSpecies', speciesId: 25 });
    expect(replaced).toMatchObject({ all: [
      { kind: 'trainerLevel' },
      { any: [{ kind: 'companionSpecies', speciesId: 25 }, { kind: 'achievement' }] },
    ] });
    expect(removeRequirementNode(replaced, [1, 1])).toMatchObject({ all: [
      { kind: 'trainerLevel' },
      { any: [{ kind: 'companionSpecies', speciesId: 25 }] },
    ] });
  });
});
