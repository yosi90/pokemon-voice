import { SPECIAL_REVEALS } from '../../lib/pokemonSpecials.js';

export interface SpecialRevealDefinition {
  revealEffect?: string | null;
  timing?: string;
  durationMs?: number;
}

export interface SpecialEffectPayload {
  type: string;
  id: number;
  durationMs?: number;
  message?: string;
  [key: string]: unknown;
}

export type SpecialRevealAction =
  | { type: 'enablePsyduckMode' }
  | { type: 'enableSleepMode' }
  | { type: 'clearEffects' }
  | { type: 'restartDelibirdMode' }
  | { type: 'enqueueEffect'; effect: SpecialEffectPayload }
  | { type: 'playGengarTone' }
  | { type: 'wait'; durationMs: number };

export function planSpecialReveal(
  special: SpecialRevealDefinition,
  pokemonId: number,
  timing: string,
  effectOptions: Record<string, unknown> = {},
): SpecialRevealAction[] {
  if (!special.revealEffect || special.timing !== timing) return [];

  const actions: SpecialRevealAction[] = [];
  if (special.revealEffect === SPECIAL_REVEALS.PSYDUCK_THINK) actions.push({ type: 'enablePsyduckMode' });
  if (special.revealEffect === SPECIAL_REVEALS.JIGGLYPUFF_SLEEP) actions.push({ type: 'enableSleepMode' });
  if (special.revealEffect === SPECIAL_REVEALS.AUDINO_HEAL) actions.push({ type: 'clearEffects' });
  if (special.revealEffect === SPECIAL_REVEALS.DELIBIRD_GIFT) {
    actions.push({ type: 'restartDelibirdMode' });
    return actions;
  }

  actions.push({
    type: 'enqueueEffect',
    effect: {
      type: special.revealEffect,
      id: pokemonId,
      durationMs: special.durationMs,
      ...effectOptions,
      message: special.revealEffect === SPECIAL_REVEALS.UNOWN_MESSAGE
        ? 'SECRETO DESCUBIERTO'
        : undefined,
    },
  });

  if (special.revealEffect === SPECIAL_REVEALS.GENGAR) {
    actions.push({ type: 'playGengarTone' }, { type: 'wait', durationMs: 780 });
  }
  return actions;
}
