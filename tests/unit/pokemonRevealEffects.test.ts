import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { playPokemonCry, primeAudio } from '../../src/lib/pokemonAudio.js';
import { usePokemonRevealEffects } from '../../src/hooks/usePokemonRevealEffects.js';

vi.mock('../../src/lib/pokemonAudio.js', () => ({
  playGengarScareTone: vi.fn(),
  playPokemonCry: vi.fn().mockResolvedValue(undefined),
  primeAudio: vi.fn().mockResolvedValue(true),
}));

describe('efectos de revelado de Pokémon', () => {
  it('reproduce el cry desde la ficha sin reactivar el revelado de la colección', async () => {
    const { result } = renderHook(() => usePokemonRevealEffects({ isDiscovered: () => true }));

    await act(async () => {
      await result.current.replayPokemonCry(25);
    });

    expect(primeAudio).toHaveBeenCalledOnce();
    expect(playPokemonCry).toHaveBeenCalledWith(25, { delay: 0 });
    expect(result.current.lastRevealedId).toBeNull();
    expect(result.current.specialEffects).toEqual([]);
  });
});
