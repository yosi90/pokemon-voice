import { describe, expect, it, vi } from 'vitest';
import { processPostDiscovery } from '../../src/services/postDiscovery.js';
import { SPECIAL_REVEALS } from '../../src/lib/pokemonSpecials.js';

describe('servicio posterior al descubrimiento', () => {
  it('mantiene eventos persistentes aunque falle el motor legacy de logros', async () => {
    const error = new Error('motor no disponible');
    const persistEasterEggState = vi.fn();
    const enqueueEffect = vi.fn();
    const onAchievementError = vi.fn();

    const plan = await processPostDiscovery({
      id: 717,
      name: 'yveltal',
      remainingSec: null,
      source: 'voice',
      discoveredIds: new Set([716, 717]),
      easterEggState: {
        meowthCoins: 0,
        gimmighoulCoins: 0,
        unownMessage: '',
        palafinPending: false,
      },
    }, {
      registerAchievementGuess: vi.fn().mockRejectedValue(error),
      persistEasterEggState,
      enqueueEffect,
      onAchievementError,
    });

    expect(onAchievementError).toHaveBeenCalledWith(error);
    expect(persistEasterEggState).toHaveBeenCalledWith(plan.nextEasterEggState);
    expect(enqueueEffect).toHaveBeenCalledWith(expect.objectContaining({
      type: SPECIAL_REVEALS.AURA_BALANCE,
    }));
  });
});
