import { describe, expect, it, vi } from 'vitest';
import {
  TIMED_COLLECTOR_MODE,
  TIMED_COLLECTOR_MODE_ID,
  WHOS_THAT_POKEMON_MODE,
  WHOS_THAT_POKEMON_MODE_ID,
  THEMED_CHALLENGES_MODE,
  THEMED_CHALLENGES_MODE_ID,
  confirmModeStart,
  defineModeDefinition,
  getModeDefinition,
  getModeStartConfirmation,
} from '../../src/domain/modes/modeDefinitions.js';

describe('definiciones declarativas de modos', () => {
  it('conserva la run por defecto y permite declararla explícitamente', () => {
    const preserveMode = defineModeDefinition({
      modeId: 'mode:test-preserve',
      title: 'Modo de prueba',
      description: 'No altera la Pokédex.',
    });

    expect(preserveMode.runPolicy).toBe('preserve');
    expect(getModeStartConfirmation(preserveMode)).toBeNull();
  });

  it('registra el contrarreloj como modo con Pokédex temporal aislada', () => {
    expect(getModeDefinition(TIMED_COLLECTOR_MODE_ID)).toBe(TIMED_COLLECTOR_MODE);
    expect(TIMED_COLLECTOR_MODE.runPolicy).toBe('isolatedPokedex');
    expect(TIMED_COLLECTOR_MODE.title).toBe('Coleccionista de logros');
    expect(TIMED_COLLECTOR_MODE.description).toBe('Tienes 2:00 minutos para obtener el máximo número de logros descubriendo Pokémon.');
    expect(getModeStartConfirmation(TIMED_COLLECTOR_MODE)).toBeNull();
  });

  it('mantiene la run al iniciar ¿Quién es ese Pokémon?', () => {
    expect(getModeDefinition(WHOS_THAT_POKEMON_MODE_ID)).toBe(WHOS_THAT_POKEMON_MODE);
    expect(WHOS_THAT_POKEMON_MODE.runPolicy).toBe('preserve');
    expect(getModeStartConfirmation(WHOS_THAT_POKEMON_MODE)).toBeNull();
  });

  it('registra los retos temáticos sin reiniciar la Pokédex', () => {
    expect(getModeDefinition(THEMED_CHALLENGES_MODE_ID)).toBe(THEMED_CHALLENGES_MODE);
    expect(THEMED_CHALLENGES_MODE.runPolicy).toBe('preserve');
    expect(THEMED_CHALLENGES_MODE.title).toBe('Trivia Pokémon');
    expect(THEMED_CHALLENGES_MODE.description).toBe('¿Cuántos exámenes de colegio Pokémon serás capaz de aprobar?');
    expect(getModeStartConfirmation(THEMED_CHALLENGES_MODE)).toBeNull();
  });

  it('solo pide confirmación a los modos que crean una nueva run', () => {
    const confirm = vi.fn((_message: string) => false);
    const resetMode = defineModeDefinition({
      modeId: 'mode:test-reset',
      title: 'Modo destructivo',
      description: 'Crea una run nueva.',
      runPolicy: 'resetPokedex',
    });
    expect(confirmModeStart(resetMode, confirm)).toBe(false);
    expect(confirm).toHaveBeenCalledOnce();
    expect(confirm.mock.calls[0][0]).toContain('vaciará los Pokémon registrados');
    expect(confirm.mock.calls[0][0]).toContain('Conservarás tus logros permanentes y todo PokeDiscover');

    const preserveMode = defineModeDefinition({
      modeId: 'mode:test-preserve',
      title: 'Modo de prueba',
      description: 'No altera la Pokédex.',
    });
    confirm.mockClear();
    expect(confirmModeStart(preserveMode, confirm)).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });
});
