import { SPECIAL_REVEALS } from '../../lib/pokemonSpecials.js';
import type { SpecialEffectPayload } from './planSpecialReveal.js';

export interface LegacyEasterEggState {
  meowthCoins: number;
  gimmighoulCoins: number;
  unownMessage: string;
  unownLetters?: string;
  palafinPending: boolean;
  xerneasYveltalBalance?: boolean;
  [key: string]: unknown;
}

export interface PostDiscoveryPlan {
  nextEasterEggState: LegacyEasterEggState;
  stateChanged: boolean;
  effects: SpecialEffectPayload[];
}

interface PostDiscoveryPlanInput {
  pokemonId: number;
  discoveredIds: ReadonlySet<number>;
  easterEggState: LegacyEasterEggState;
}

export function planPostDiscovery({
  pokemonId,
  discoveredIds,
  easterEggState,
}: PostDiscoveryPlanInput): PostDiscoveryPlan {
  let nextState = easterEggState;
  const effects: SpecialEffectPayload[] = [];
  const patchState = (patch: Partial<LegacyEasterEggState>) => {
    nextState = { ...nextState, ...patch };
  };

  if (pokemonId === 201) {
    const letters = easterEggState.unownLetters || '';
    patchState({
      unownLetters: `${letters}${String.fromCharCode(65 + (letters.length % 26))}`.slice(-16),
    });
  }

  if (pokemonId === 964) {
    patchState({ palafinPending: true });
  } else if (easterEggState.palafinPending && discoveredIds.has(964)) {
    patchState({ palafinPending: false });
    effects.push({ type: SPECIAL_REVEALS.PALAFIN_HERO, id: 964, durationMs: 2200 });
  }

  const completesAuraPair = (pokemonId === 716 || pokemonId === 717)
    && discoveredIds.has(716)
    && discoveredIds.has(717)
    && !easterEggState.xerneasYveltalBalance;
  if (completesAuraPair) {
    patchState({ xerneasYveltalBalance: true });
    effects.push({ type: SPECIAL_REVEALS.AURA_BALANCE, id: pokemonId, durationMs: 2800 });
  }

  return {
    nextEasterEggState: nextState,
    stateChanged: nextState !== easterEggState,
    effects,
  };
}
