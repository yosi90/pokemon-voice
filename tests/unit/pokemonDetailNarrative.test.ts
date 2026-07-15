import { describe, expect, it } from 'vitest';
import { getClassifiedNarrative, getUnresearchedFieldNarrative } from '../../src/domain/catalog/pokemonDetailNarrative.js';

describe('mensajes narrativos de la ficha', () => {
  it('mantiene cada mensaje estable y reparte las incidencias entre especies', () => {
    expect(getClassifiedNarrative(1)).toBe('Nombra a este Pokémon para desbloquear su registro.');
    expect(getClassifiedNarrative(2)).toContain('Team Rocket');
    expect(getClassifiedNarrative(3)).toContain('SERVIDOR SIN RESPUESTA');
    expect(getClassifiedNarrative(4)).toContain('leyenda');
    expect(getClassifiedNarrative(2)).toBe(getClassifiedNarrative(2));
  });

  it('ofrece incidencias diferentes para los campos aún no investigados', () => {
    const messages = [
      getUnresearchedFieldNarrative(2, 'biometrics'),
      getUnresearchedFieldNarrative(2, 'behavior'),
      getUnresearchedFieldNarrative(2, 'habitat'),
      getUnresearchedFieldNarrative(2, 'exceptional'),
    ];

    expect(new Set(messages)).toHaveLength(4);
    expect(messages.join(' ')).toContain('Team Rocket');
    expect(messages.join(' ')).toContain('SERVIDOR SIN RESPUESTA');
    expect(messages.join(' ')).toContain('leyenda');
  });
});
