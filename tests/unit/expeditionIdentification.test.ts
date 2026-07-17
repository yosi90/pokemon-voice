import { describe, expect, it } from 'vitest';
import { beginExpedition } from '../../src/domain/expeditions/expeditionSession.js';
import {
  identifyVisibleExpeditionSpecies,
  isExpeditionSpeciesRevealed,
} from '../../src/domain/expeditions/expeditionIdentification.js';
import { createPokeVoiceSaveV1 } from '../../src/domain/progress/pokeVoiceSave.js';

function activeSave() {
  const save = createPokeVoiceSaveV1({ runId: 'run:identify', now: Date.now() });
  save.pokedexRun.selectedCompanion = { schemaVersion: 1, formId: 'pokemon-form:1:default' };
  return beginExpedition(save, {
    mapId: 'map:tegueste:camphor-forest',
    enteredAt: '2026-07-18T12:00:00.000Z',
  });
}

describe('identificación contextual en expediciones', () => {
  it.each(['voice', 'text'] as const)('revela por %s una especie visible y cuenta como interacción', method => {
    const result = identifyVisibleExpeditionSpecies(activeSave(), {
      resolvedSpeciesId: 19,
      visibleSpeciesIds: [19, 204],
      method,
      interactionId: `identification:rattata:${method}`,
    });
    expect(result.status).toBe('identified');
    expect(isExpeditionSpeciesRevealed(result.save, 19)).toBe(true);
    expect(result.save.activeExpeditionSession?.meaningfulInteractionIds)
      .toContain(`identification:rattata:${method}`);
  });

  it('no registra una respuesta correcta si la especie no está a la vista', () => {
    const save = activeSave();
    const result = identifyVisibleExpeditionSpecies(save, {
      resolvedSpeciesId: 204,
      visibleSpeciesIds: [19],
      method: 'voice',
      interactionId: 'identification:pineco:hidden',
    });
    expect(result).toEqual({ status: 'notVisible', save });
  });
});
