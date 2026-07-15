import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LS_CARD_SCALE, LS_GENS } from '../../scripts/utils.js';
import { useLegacyEasterEggState } from '../../src/hooks/useLegacyEasterEggState.js';
import { usePokedexPreferences } from '../../src/hooks/usePokedexPreferences.js';

describe('adaptadores de persistencia legacy', () => {
  it('recupera y persiste preferencias sin mezclarlas con el hook principal', async () => {
    localStorage.setItem(LS_GENS, JSON.stringify([1, 2]));
    localStorage.setItem(LS_CARD_SCALE, '150');
    const { result } = renderHook(() => usePokedexPreferences());

    expect(result.current.activeGeneration).toBe(1);
    expect(result.current.cardSize).toBe(150);

    act(() => {
      result.current.setActiveGeneration(2);
      result.current.setCardSize(160);
    });

    await waitFor(() => expect(JSON.parse(localStorage.getItem(LS_GENS)!)).toEqual([2]));
    expect(localStorage.getItem(LS_CARD_SCALE)).toBe('160');
  });

  it('encadena cambios de easter eggs y los conserva al reiniciar la run', () => {
    const { result } = renderHook(() => useLegacyEasterEggState());

    act(() => {
      result.current.updateEasterEggState(current => ({ ...current, meowthCoins: current.meowthCoins + 1 }));
      result.current.updateEasterEggState(current => ({ ...current, meowthCoins: current.meowthCoins + 1 }));
    });

    expect(result.current.easterEggState.meowthCoins).toBe(2);
    expect(result.current.getEasterEggState().meowthCoins).toBe(2);

    act(() => result.current.resetEasterEggProgress());
    expect(result.current.easterEggState.meowthCoins).toBe(2);
    expect(JSON.parse(localStorage.getItem('pokevoice-easter-eggs-v1') || '{}').meowthCoins).toBe(2);
  });
});
