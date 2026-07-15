import { describe, expect, it } from 'vitest';
import { planSpecialReveal } from '../../src/domain/discovery/planSpecialReveal.js';
import { SPECIAL_REVEALS, SPECIAL_TIMING } from '../../src/lib/pokemonSpecials.js';

describe('plan de efectos especiales', () => {
  it('ignora efectos que no corresponden al momento actual', () => {
    expect(planSpecialReveal({
      revealEffect: SPECIAL_REVEALS.GENGAR,
      timing: SPECIAL_TIMING.BEFORE_REVEAL,
    }, 94, SPECIAL_TIMING.AFTER_REVEAL)).toEqual([]);
  });

  it('declara la secuencia completa de Gengar en orden', () => {
    const actions = planSpecialReveal({
      revealEffect: SPECIAL_REVEALS.GENGAR,
      timing: SPECIAL_TIMING.BEFORE_REVEAL,
      durationMs: 2500,
    }, 94, SPECIAL_TIMING.BEFORE_REVEAL);

    expect(actions.map(action => action.type)).toEqual(['enqueueEffect', 'playGengarTone', 'wait']);
    expect(actions.at(-1)).toEqual({ type: 'wait', durationMs: 780 });
  });

  it('reinicia Delibird sin encolar un efecto genérico', () => {
    expect(planSpecialReveal({
      revealEffect: SPECIAL_REVEALS.DELIBIRD_GIFT,
      timing: SPECIAL_TIMING.AFTER_REVEAL,
    }, 225, SPECIAL_TIMING.AFTER_REVEAL)).toEqual([{ type: 'restartDelibirdMode' }]);
  });

  it('añade el mensaje reservado de Unown y conserva opciones de escena', () => {
    const actions = planSpecialReveal({
      revealEffect: SPECIAL_REVEALS.UNOWN_MESSAGE,
      timing: SPECIAL_TIMING.AFTER_REVEAL,
    }, 201, SPECIAL_TIMING.AFTER_REVEAL, { weather: 2 });

    expect(actions).toEqual([{
      type: 'enqueueEffect',
      effect: {
        type: SPECIAL_REVEALS.UNOWN_MESSAGE,
        id: 201,
        durationMs: undefined,
        weather: 2,
        message: 'SECRETO DESCUBIERTO',
      },
    }]);
  });
});
