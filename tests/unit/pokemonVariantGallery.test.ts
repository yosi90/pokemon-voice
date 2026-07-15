import { describe, expect, it } from 'vitest';
import { buildPokemonVariantGallery, formatVariantNote, formatVariantOrigin } from '../../src/domain/catalog/pokemonVariantGallery.js';

describe('buildPokemonVariantGallery', () => {
  it('mantiene formas y apariencias dentro de una única ficha de especie', () => {
    const gallery = buildPokemonVariantGallery({
      speciesId: 25,
      forms: [{
        schemaVersion: 1,
        formId: 'pokemon-form:25:partner',
        speciesId: 25,
        discoveredAt: '2026-07-15T10:00:00.000Z',
        noteIds: [],
        originMapId: 'map:bosque-verde',
      }],
      appearances: [{
        schemaVersion: 1,
        appearanceId: 'pokemon-appearance:25:surfista',
        formId: 'pokemon-form:25:default',
        speciesId: 25,
        discoveredAt: '2026-07-15T11:00:00.000Z',
        noteIds: ['note:tabla'],
        originMissionId: 'mission:bahia-en-calma',
      }],
    });

    expect(gallery.map(item => item.label)).toEqual(['Forma habitual', 'Forma Partner', 'Surfista']);
    expect(formatVariantOrigin(gallery[1])).toBe('Mapa · Bosque verde');
    expect(formatVariantOrigin(gallery[2])).toBe('Misión · Bahia en calma');
    expect(formatVariantNote(gallery[2].noteIds[0])).toBe('Tabla');
  });

  it('rechaza relaciones de otra especie y no duplica la forma habitual', () => {
    const gallery = buildPokemonVariantGallery({
      speciesId: 25,
      forms: [
        { schemaVersion: 1, formId: 'pokemon-form:25:default', speciesId: 25, discoveredAt: '2026-01-01T00:00:00.000Z', noteIds: [] },
        { schemaVersion: 1, formId: 'pokemon-form:26:alola', speciesId: 26, discoveredAt: '2026-01-01T00:00:00.000Z', noteIds: [] },
      ],
      appearances: [],
    });

    expect(gallery).toHaveLength(1);
    expect(gallery[0].isDefault).toBe(true);
  });
});
