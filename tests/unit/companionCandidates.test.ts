import { describe, expect, it } from 'vitest';
import type { PokemonCatalogRecord } from '../../src/domain/catalog/pokemonCatalogModel.js';
import { createDefaultCatalogRecord } from '../../src/domain/catalog/pokemonCatalogModel.js';
import { getCompanionCandidates } from '../../src/domain/companions/companionCandidates.js';
import { selectCompanion } from '../../src/domain/companions/companionEligibility.js';
import { getCompanionRequirement } from '../../src/domain/companions/companionRequirementCatalog.js';
import { createPokeVoiceSaveV1 } from '../../src/domain/progress/pokeVoiceSave.js';
import { createCompanionCatalogForm } from '../../src/domain/companions/companionCandidates.js';

const NOW = Date.parse('2026-07-16T20:00:00.000Z');
const catalog: PokemonCatalogRecord[] = [
  createDefaultCatalogRecord({ id: 1, name: 'bulbasaur' }),
  createDefaultCatalogRecord({ id: 4, name: 'charmander' }),
  createDefaultCatalogRecord({ id: 10, name: 'caterpie' }),
  createDefaultCatalogRecord({ id: 25, name: 'pikachu' }),
  createDefaultCatalogRecord({ id: 150, name: 'mewtwo' }),
  createDefaultCatalogRecord({ id: 151, name: 'mew' }),
];

function saveWith(registeredSpeciesIds: number[]) {
  return createPokeVoiceSaveV1({
    runId: 'run:companions',
    now: NOW,
    legacy: { registeredSpeciesIds },
  });
}

describe('candidatos del selector de acompañante', () => {
  it('solo muestra Pokémon registrados en la run actual', () => {
    const candidates = getCompanionCandidates(catalog, saveWith([1, 10]));
    const byId = new Map(candidates.map(candidate => [candidate.record.species.speciesId, candidate]));

    expect([...byId.keys()]).toEqual([1, 10]);
    expect(byId.get(1)?.eligibility.status).toBe('eligible');
    expect(byId.get(10)?.eligibility).toMatchObject({
      status: 'ineligible',
    });
    expect(byId.get(10)?.eligibility.unmetAtoms).toEqual(expect.arrayContaining([
      { kind: 'trainerLevel', minimum: 3 },
      { kind: 'achievement', achievementId: 'first-mission' },
    ]));
    expect(byId.has(4)).toBe(false);
    expect(byId.has(25)).toBe(false);
    expect(byId.has(151)).toBe(false);
  });

  it('un avistamiento permanente no lista a Mew si aún no está registrado en la run', () => {
    const save = saveWith([]);
    save.pokeDiscover.sightings.push(151);
    const mew = getCompanionCandidates(catalog, save)
      .find(candidate => candidate.record.species.speciesId === 151);

    expect(mew).toBeUndefined();
  });

  it('selecciona un candidato válido y bloquea cambios durante una expedición', () => {
    const record = catalog[0];
    const save = saveWith([1]);
    const selected = selectCompanion({
      save,
      definition: getCompanionRequirement(record),
      form: createCompanionCatalogForm(record),
      selectedAt: '2026-07-16T20:05:00.000Z',
    });

    expect(selected.status).toBe('selected');
    if (selected.status !== 'selected') throw new Error('Selección inesperadamente rechazada.');
    expect(selected.save.pokedexRun.selectedCompanionFormId).toBe('pokemon-form:1:default');
    expect(selected.save.pokeDiscover.globalCounters).toMatchObject({
      'companionSelections:total': 1,
      'companionSelections:pokemon-form:1:default': 1,
    });

    const repeated = selectCompanion({
      save: selected.save,
      definition: getCompanionRequirement(record),
      form: createCompanionCatalogForm(record),
      selectedAt: '2026-07-16T20:05:30.000Z',
    });
    expect(repeated.save.pokeDiscover.globalCounters['companionSelections:total']).toBe(1);

    const blocked = selectCompanion({
      save: {
        ...selected.save,
        activeExpeditionSession: {
          schemaVersion: 1,
          mapId: 'map:reserve-zero',
          enteredAt: '2026-07-16T20:06:00.000Z',
        },
      },
      definition: getCompanionRequirement(record),
      form: createCompanionCatalogForm(record),
      selectedAt: '2026-07-16T20:07:00.000Z',
    });
    expect(blocked.status).toBe('expeditionActive');
  });
});
