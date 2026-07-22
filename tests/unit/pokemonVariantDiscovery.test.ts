import { describe, expect, it } from 'vitest';
import { recordPokemonVariantDiscovery } from '../../src/domain/expeditions/pokemonVariantDiscovery.js';
import { createPokeDiscoverStateV1 } from '../../src/domain/progress/pokeVoiceSave.js';

const FIRST_SEEN = '2026-07-22T10:00:00.000Z';

describe('descubrimiento persistente de formas y apariencias', () => {
  it('guarda forma, apariencia, avistamiento y primera procedencia', () => {
    const first = recordPokemonVariantDiscovery(createPokeDiscoverStateV1(), {
      speciesId: 25,
      formId: 'pokemon-form:25:default',
      appearanceId: 'pokemon-appearance:25:surfista',
      discoveredAt: FIRST_SEEN,
      originMapId: 'map:alola:beach',
      originMissionId: 'mission:alola:surfing-pikachu',
      originEncounterId: 'encounter:alola:surfing-pikachu',
      noteIds: ['note:pikachu:surfboard'],
    });

    expect(first.status).toBe('discovered');
    expect(first.state.sightings).toEqual([25]);
    expect(first.form).toMatchObject({
      formId: 'pokemon-form:25:default',
      originMapId: 'map:alola:beach',
      originMissionId: 'mission:alola:surfing-pikachu',
      originEncounterId: 'encounter:alola:surfing-pikachu',
    });
    expect(first.appearance).toMatchObject({
      appearanceId: 'pokemon-appearance:25:surfista',
      formId: 'pokemon-form:25:default',
      discoveredAt: FIRST_SEEN,
      noteIds: ['note:pikachu:surfboard'],
    });
  });

  it('no sustituye la primera procedencia al repetir el hallazgo', () => {
    const first = recordPokemonVariantDiscovery(createPokeDiscoverStateV1(), {
      speciesId: 26,
      formId: 'pokemon-form:26:alola',
      discoveredAt: FIRST_SEEN,
      originMapId: 'map:alola:coast',
      originEncounterId: 'encounter:alola:raichu',
    });
    const repeated = recordPokemonVariantDiscovery(first.state, {
      speciesId: 26,
      formId: 'pokemon-form:26:alola',
      discoveredAt: '2026-07-23T10:00:00.000Z',
      originMapId: 'map:alola:resort',
      originEncounterId: 'encounter:alola:raichu-repeat',
    });

    expect(repeated.status).toBe('alreadyDiscovered');
    expect(repeated.state).toBe(first.state);
    expect(repeated.form).toMatchObject({
      discoveredAt: FIRST_SEEN,
      originMapId: 'map:alola:coast',
      originEncounterId: 'encounter:alola:raichu',
    });
  });

  it('rechaza reutilizar IDs para otra especie o forma', () => {
    const first = recordPokemonVariantDiscovery(createPokeDiscoverStateV1(), {
      speciesId: 25,
      appearanceId: 'pokemon-appearance:event:surfista',
      discoveredAt: FIRST_SEEN,
      originMapId: 'map:event:beach',
      originEncounterId: 'encounter:event:surfista',
    });

    expect(() => recordPokemonVariantDiscovery(first.state, {
      speciesId: 26,
      appearanceId: 'pokemon-appearance:event:surfista',
      discoveredAt: FIRST_SEEN,
      originMapId: 'map:event:beach',
      originEncounterId: 'encounter:event:surfista',
    })).toThrow('ya pertenece a otra especie o forma');
  });

  it('repara el avistamiento ausente sin reescribir la procedencia existente', () => {
    const state = createPokeDiscoverStateV1();
    state.discoveredForms['pokemon-form:26:alola'] = {
      schemaVersion: 1,
      formId: 'pokemon-form:26:alola',
      speciesId: 26,
      discoveredAt: FIRST_SEEN,
      noteIds: [],
      originMapId: 'map:alola:coast',
      originEncounterId: 'encounter:alola:raichu',
    };

    const repaired = recordPokemonVariantDiscovery(state, {
      speciesId: 26,
      formId: 'pokemon-form:26:alola',
      discoveredAt: '2026-07-23T10:00:00.000Z',
      originMapId: 'map:alola:resort',
      originEncounterId: 'encounter:alola:raichu-repeat',
    });

    expect(repaired.status).toBe('alreadyDiscovered');
    expect(repaired.state.sightings).toEqual([26]);
    expect(repaired.form.originMapId).toBe('map:alola:coast');
  });
});
