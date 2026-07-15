import { describe, expect, it } from 'vitest';
import { LS_KEY } from '../../scripts/utils.js';
import { readCardSize, readJson, saveGuessed } from '../../src/lib/storage.js';

describe('persistencia local existente', () => {
  it('recupera el fallback cuando el JSON guardado está corrupto', () => {
    localStorage.setItem('broken', '{');

    expect(readJson('broken', ['fallback'])).toEqual(['fallback']);
  });

  it('guarda los Pokémon descubiertos como una lista de ids', () => {
    saveGuessed(new Set([25, 1]));

    expect(JSON.parse(localStorage.getItem(LS_KEY))).toEqual([25, 1]);
  });

  it('normaliza tamaños de carta fuera del rango permitido', () => {
    localStorage.setItem('pokevoice-card-scale', '9999');

    expect(readCardSize()).toBe(176);
  });
});
