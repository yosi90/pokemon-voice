import { describe, expect, it } from 'vitest';
import { createDefaultCatalogRecord } from '../../src/domain/catalog/pokemonCatalogModel.js';
import { getCompanionCandidates } from '../../src/domain/companions/companionCandidates.js';
import {
  COMPANION_GAMEPLAY_SPECIES,
  createCompanionRequirement,
  getCompanionCategory,
  getCompanionSpeciesProfile,
  toCompanionForm,
} from '../../src/domain/companions/companionGameplayCatalog.js';
import { createPokeVoiceSaveV1 } from '../../src/domain/progress/pokeVoiceSave.js';
import { selectCompanion } from '../../src/domain/companions/companionEligibility.js';

const NOW = Date.parse('2026-07-16T22:00:00.000Z');

function defaultForm(speciesId: number) {
  const species = getCompanionSpeciesProfile(speciesId)!;
  return { species, form: species.forms.find(candidate => candidate.formId === `pokemon-form:${speciesId}:default`)! };
}

describe('catálogo de gameplay de compañeros', () => {
  it('cubre las 1.025 especies con forma, nivel y tipos explícitos', () => {
    expect(COMPANION_GAMEPLAY_SPECIES).toHaveLength(1025);
    for (const species of COMPANION_GAMEPLAY_SPECIES) {
      const form = species.forms.find(candidate => candidate.formId === `pokemon-form:${species.speciesId}:default`);
      expect(form, `forma por defecto #${species.speciesId}`).toBeDefined();
      expect(form?.types.length).toBeGreaterThan(0);
      expect(form?.companion.minimumTrainerLevel).toBeGreaterThanOrEqual(1);
      expect(form?.companion.minimumTrainerLevel).toBeLessThanOrEqual(100);
      expect(getCompanionCategory(species, form!)).toBeTruthy();
    }
  });

  it('aplica la prioridad y los niveles provisionales acordados', () => {
    const cases = [
      [151, 'mythical', 20],
      [150, 'legendary', 90],
      [1006, 'special', 60],
      [149, 'pseudo-legendary', 50],
      [3, 'third-evolution', 36],
      [2, 'second-evolution', 24],
      [172, 'baby', 1],
      [1, 'starter', 1],
      [10, 'common', 3],
    ] as const;
    for (const [speciesId, category, level] of cases) {
      const entry = defaultForm(speciesId);
      expect(getCompanionCategory(entry.species, entry.form)).toBe(category);
      expect(entry.form.companion.minimumTrainerLevel).toBe(level);
    }
  });

  it('cataloga formas persistentes y deja fuera transformaciones de combate', () => {
    const raichu = getCompanionSpeciesProfile(26)!;
    expect(raichu.forms.find(form => form.formId === 'pokemon-form:26:alola'))
      .toMatchObject({ kind: 'regional', selectableCompanion: true });
    for (const species of COMPANION_GAMEPLAY_SPECIES) {
      for (const form of species.forms.filter(candidate => candidate.kind === 'battle')) {
        expect(form.selectableCompanion, form.formId).toBe(false);
      }
    }
  });

  it('desbloquea Raichu de Alola y Pikachu surfista como candidatos independientes', () => {
    const catalog = [
      createDefaultCatalogRecord({ id: 25, name: 'pikachu' }),
      createDefaultCatalogRecord({ id: 26, name: 'raichu' }),
    ];
    const save = createPokeVoiceSaveV1({ runId: 'run:variants', now: NOW, legacy: { registeredSpeciesIds: [25, 26] } });
    save.pokeDiscover.discoveredForms['pokemon-form:26:alola'] = {
      schemaVersion: 1,
      formId: 'pokemon-form:26:alola',
      speciesId: 26,
      discoveredAt: new Date(NOW).toISOString(),
      noteIds: [],
    };
    save.pokeDiscover.discoveredAppearances['pokemon-appearance:25:surfista'] = {
      schemaVersion: 1,
      appearanceId: 'pokemon-appearance:25:surfista',
      formId: 'pokemon-form:25:default',
      speciesId: 25,
      discoveredAt: new Date(NOW).toISOString(),
      noteIds: [],
    };

    const candidates = getCompanionCandidates(catalog, save);
    expect(candidates.map(candidate => candidate.variantId)).toEqual(expect.arrayContaining([
      'pokemon-form:25:default',
      'pokemon-appearance:25:surfista',
      'pokemon-form:26:default',
      'pokemon-form:26:alola',
    ]));
    const surfista = candidates.find(candidate => candidate.variantId === 'pokemon-appearance:25:surfista')!;
    expect(surfista.form.fieldCapabilities).toContainEqual({ id: 'surf', source: 'story', strength: 1, tags: ['rideable'] });
    const result = selectCompanion({
      save,
      definition: surfista.requirement,
      form: surfista.form,
      selectedAt: new Date(NOW + 1000).toISOString(),
    });
    expect(result.status).toBe('selected');
    if (result.status === 'selected') {
      expect(result.save.pokedexRun.selectedCompanion).toEqual({
        schemaVersion: 1,
        formId: 'pokemon-form:25:default',
        appearanceId: 'pokemon-appearance:25:surfista',
      });
    }
  });

  it('conserva los requisitos curados al componer una forma', () => {
    const mew = defaultForm(151);
    expect(createCompanionRequirement(mew.species, mew.form)).toMatchObject({
      minimumTrainerLevel: 20,
      visibility: 'secret',
      requirement: { all: [{ kind: 'sightedSpecies', speciesId: 151 }, { kind: 'registeredSpeciesByTag', tag: 'sweet', minimum: 20 }] },
    });
    expect(toCompanionForm(mew.form).companionReferenceLevel).toBe(20);
  });
});
