import { describe, expect, it } from 'vitest';
import type { AdventureMapV2, CompanionSpeciesProfileV1 } from '../../packages/contracts/src/index.js';
import { createPokeDiscoverResearchMatrix } from '../../src/domain/tools/pokeDiscoverEditorResearchMatrix.js';

const species = [
  { speciesId: 19, displayName: 'Rattata', generation: 1, companionResearch: { factId: 'fact:rattata:companion:habitat', speciesId: 19, field: 'habitat', contentStatus: 'curated' } },
  { speciesId: 204, displayName: 'Pineco', generation: 2 },
] as CompanionSpeciesProfileV1[];

function map(mapId: string, title: string, facts: Array<Record<string, unknown>>): AdventureMapV2 {
  return { mapId, title, researchFacts: facts } as unknown as AdventureMapV2;
}

describe('matriz de investigación del editor', () => {
  it('cruza especie, campo y mapa conservando cada contribución', () => {
    const forest = map('map:forest', 'Bosque', [
      { factId: 'fact:rattata:behavior', speciesId: 19, field: 'behavior', contribution: 'fieldCompletion' },
      { factId: 'fact:pineco:size', speciesId: 204, field: 'biometrics', contribution: 'observation' },
    ]);
    const cave = map('map:cave', 'Cueva', [
      { factId: 'fact:rattata:rare', speciesId: 19, field: 'exceptional', contribution: 'additionalNote' },
    ]);
    const matrix = createPokeDiscoverResearchMatrix([forest, cave], species);
    const rattata = matrix.rows.find(row => row.speciesId === 19)!;
    expect(matrix.maps).toEqual([{ mapId: 'map:forest', title: 'Bosque' }, { mapId: 'map:cave', title: 'Cueva' }]);
    expect(rattata.factsByMap['map:forest'].behavior[0].factId).toBe('fact:rattata:behavior');
    expect(rattata.factsByMap['map:cave'].exceptional[0].contribution).toBe('additionalNote');
    expect(matrix).toMatchObject({ factCount: 3, coveredSpeciesCount: 2, unknownSpeciesFacts: [] });
  });

  it('sustituye mapas repetidos y señala especies ajenas al catálogo', () => {
    const first = map('map:forest', 'Antiguo', [{ factId: 'old', speciesId: 19, field: 'behavior' }]);
    const current = map('map:forest', 'Actual', [{ factId: 'unknown', speciesId: 9999, field: 'habitat' }]);
    const matrix = createPokeDiscoverResearchMatrix([first, current], species);
    expect(matrix.maps).toEqual([{ mapId: 'map:forest', title: 'Actual' }]);
    expect(matrix.factCount).toBe(1);
    expect(matrix.unknownSpeciesFacts.map(fact => fact.factId)).toEqual(['unknown']);
  });

  it('expone convivencia y alerta cuatro cierres colocados o cierres duplicados', () => {
    const overloaded = map('map:all-fields', 'Todos los campos', [
      { factId: 'fact:bio', speciesId: 19, field: 'biometrics', contribution: 'fieldCompletion' },
      { factId: 'fact:behavior', speciesId: 19, field: 'behavior', contribution: 'fieldCompletion' },
      { factId: 'fact:habitat', speciesId: 19, field: 'habitat', contribution: 'fieldCompletion' },
      { factId: 'fact:exceptional', speciesId: 19, field: 'exceptional', contribution: 'fieldCompletion' },
    ]);
    const matrix = createPokeDiscoverResearchMatrix([overloaded], species);
    const rattata = matrix.rows.find(row => row.speciesId === 19)!;
    expect(rattata.companionResearch).toMatchObject({ field: 'habitat', contentStatus: 'curated' });
    expect(rattata.warnings).toEqual([
      { kind: 'fourRequiredPlacements', speciesId: 19, factIds: ['fact:bio', 'fact:behavior', 'fact:habitat', 'fact:exceptional'] },
      { kind: 'duplicateFieldCompletion', speciesId: 19, field: 'habitat', sourceIds: ['fact:habitat', 'fact:rattata:companion:habitat'] },
    ]);
    expect(matrix).toMatchObject({ companionReservationCount: 1, warningCount: 2 });
  });
});
