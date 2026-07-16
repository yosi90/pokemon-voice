import { describe, expect, it } from 'vitest';
import { createDefaultCatalogRecord } from '../../src/domain/catalog/pokemonCatalogModel.js';
import {
  COMPANION_REQUIREMENT_IDS,
  getCompanionRequirement,
  isSecretCompanionRequirement,
} from '../../src/domain/companions/companionRequirementCatalog.js';

describe('catálogo curado de requisitos de acompañante', () => {
  it('da una regla narrativa estable a una especie normal sin consultar estadísticas', () => {
    const caterpie = getCompanionRequirement(createDefaultCatalogRecord({ id: 10, name: 'caterpie' }));

    expect(caterpie).toMatchObject({
      requirementId: 'companion-access:pokemon-form:10:default',
      speciesId: 10,
      formId: 'pokemon-form:10:default',
      minimumTrainerLevel: 3,
      visibility: 'public',
    });
    expect(caterpie.requirement).toBeUndefined();
  });

  it('mantiene a Pikachu como acompañante inicial explícito', () => {
    expect(getCompanionRequirement(createDefaultCatalogRecord({ id: 25, name: 'pikachu' })))
      .toMatchObject({
        requirementId: COMPANION_REQUIREMENT_IDS.pikachu,
        minimumTrainerLevel: 1,
        visibility: 'public',
      });
  });

  it('declara los ejemplos de lore de Mew y Mewtwo sin revelar la condición secreta', () => {
    const mew = getCompanionRequirement(createDefaultCatalogRecord({ id: 151, name: 'mew' }));
    const mewtwo = getCompanionRequirement(createDefaultCatalogRecord({ id: 150, name: 'mewtwo' }));

    expect(mew).toMatchObject({
      minimumTrainerLevel: 20,
      visibility: 'secret',
      requirement: { all: [
        { kind: 'sightedSpecies', speciesId: 151 },
        { kind: 'registeredSpeciesByTag', tag: 'sweet', minimum: 20 },
      ] },
    });
    expect(mew.loreHint).not.toContain('20');
    expect(isSecretCompanionRequirement(createDefaultCatalogRecord({ id: 151, name: 'mew' }))).toBe(true);
    expect(mewtwo).toMatchObject({ minimumTrainerLevel: 90, visibility: 'hinted' });
  });
});
