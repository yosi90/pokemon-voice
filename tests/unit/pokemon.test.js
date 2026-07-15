import { describe, expect, it } from 'vitest';
import { formatDex } from '../../src/lib/pokemon.js';

describe('formato de Pokédex', () => {
  it('mantiene cuatro cifras en los identificadores visibles', () => {
    expect(formatDex(25)).toBe('#0025');
    expect(formatDex(1000)).toBe('#1000');
  });
});
