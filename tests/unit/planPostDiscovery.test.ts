import { describe, expect, it } from 'vitest';
import { planPostDiscovery, type LegacyEasterEggState } from '../../src/domain/discovery/planPostDiscovery.js';
import { SPECIAL_REVEALS } from '../../src/lib/pokemonSpecials.js';

const baseState = (): LegacyEasterEggState => ({
  meowthCoins: 0,
  gimmighoulCoins: 0,
  unownMessage: '',
  palafinPending: false,
});

describe('plan posterior al descubrimiento', () => {
  it('acumula letras de Unown de forma determinista y limitada', () => {
    const plan = planPostDiscovery({
      pokemonId: 201,
      discoveredIds: new Set([201]),
      easterEggState: { ...baseState(), unownLetters: 'AB' },
    });

    expect(plan.nextEasterEggState.unownLetters).toBe('ABC');
    expect(plan.effects).toEqual([]);
  });

  it('arma la transformación de Palafin y la ejecuta en el siguiente descubrimiento', () => {
    const pending = planPostDiscovery({
      pokemonId: 964,
      discoveredIds: new Set([964]),
      easterEggState: baseState(),
    });
    expect(pending.nextEasterEggState.palafinPending).toBe(true);
    expect(pending.effects).toEqual([]);

    const transformed = planPostDiscovery({
      pokemonId: 25,
      discoveredIds: new Set([964, 25]),
      easterEggState: pending.nextEasterEggState,
    });
    expect(transformed.nextEasterEggState.palafinPending).toBe(false);
    expect(transformed.effects).toEqual([{
      type: SPECIAL_REVEALS.PALAFIN_HERO,
      id: 964,
      durationMs: 2200,
    }]);
  });

  it('activa una sola vez el equilibrio entre Xerneas e Yveltal', () => {
    const first = planPostDiscovery({
      pokemonId: 717,
      discoveredIds: new Set([716, 717]),
      easterEggState: baseState(),
    });
    expect(first.nextEasterEggState.xerneasYveltalBalance).toBe(true);
    expect(first.effects[0]).toMatchObject({ type: SPECIAL_REVEALS.AURA_BALANCE, id: 717 });

    const repeated = planPostDiscovery({
      pokemonId: 716,
      discoveredIds: new Set([716, 717]),
      easterEggState: first.nextEasterEggState,
    });
    expect(repeated.stateChanged).toBe(false);
    expect(repeated.effects).toEqual([]);
  });
});
