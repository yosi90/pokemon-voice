import { describe, expect, it } from 'vitest';
import type { CompanionResearchFactV1 } from '../../packages/contracts/src/index.js';
import {
  beginExpedition,
  endExpeditionWithReport,
  recordMeaningfulExpeditionInteraction,
} from '../../src/domain/expeditions/expeditionSession.js';
import { createPokeVoiceSaveV1 } from '../../src/domain/progress/pokeVoiceSave.js';
import { discoverResearchFact } from '../../src/domain/research/researchProgress.js';

const EXITED_AT = '2026-07-18T12:00:00.000Z';
const fact: CompanionResearchFactV1 = {
  schemaVersion: 1,
  factId: 'research:pikachu:companion:behavior',
  speciesId: 25,
  field: 'behavior',
  contentStatus: 'curated',
  text: 'Pikachu comunica su estado de ánimo mediante pequeños cambios en sus mejillas.',
  rewards: [
    { kind: 'trainerExperience', amount: 5 },
    { kind: 'discoveryPoints', amount: 5 },
  ],
};

function prepared(toolIds: string[] = []) {
  const save = createPokeVoiceSaveV1({ runId: 'run:companion-research', now: Date.parse(EXITED_AT) });
  save.pokedexRun.registeredSpeciesIds = [25];
  save.pokedexRun.selectedCompanion = { schemaVersion: 1, formId: 'pokemon-form:25:default' };
  save.pokeDiscover.inventory.toolIds = toolIds;
  return save;
}

describe('investigación mediante convivencia', () => {
  it('permite entrar sin herramienta y no recompensa una salida vacía', () => {
    const active = beginExpedition(prepared(), {
      mapId: 'map:test:forest',
      enteredAt: '2026-07-18T11:00:00.000Z',
    });
    expect(active.activeExpeditionSession?.loadout).toEqual({
      schemaVersion: 1,
      companion: { schemaVersion: 1, formId: 'pokemon-form:25:default' },
    });

    const result = endExpeditionWithReport(active, { exitedAt: EXITED_AT, companionResearchFact: fact });
    expect(result.report).toMatchObject({ meaningfulInteractionCount: 0 });
    expect(result.report?.companionResearchFactId).toBeUndefined();
    expect(result.save.pokeDiscover.researchBySpecies[25]).toBeUndefined();
  });

  it('completa el campo tras una interacción útil y nunca vuelve a pagarlo', () => {
    const active = beginExpedition(prepared(), {
      mapId: 'map:test:forest',
      enteredAt: '2026-07-18T11:00:00.000Z',
    });
    const interacted = recordMeaningfulExpeditionInteraction(active, {
      interactionId: 'pokemon-interaction:wild-caterpie',
      kind: 'pokemonInteraction',
    });
    const duplicate = recordMeaningfulExpeditionInteraction(interacted, {
      interactionId: 'pokemon-interaction:wild-caterpie',
      kind: 'pokemonInteraction',
    });
    const first = endExpeditionWithReport(duplicate, { exitedAt: EXITED_AT, companionResearchFact: fact });

    expect(first.report).toMatchObject({
      meaningfulInteractionCount: 1,
      companionResearchFactId: fact.factId,
      trainerExperienceGained: 5,
      discoveryPointsGained: 5,
    });
    expect(first.save.pokeDiscover.researchBySpecies[25].fields.behavior.completed).toBe(true);

    const revisited = beginExpedition(first.save, {
      mapId: 'map:test:river',
      enteredAt: '2026-07-19T11:00:00.000Z',
    });
    const repeated = endExpeditionWithReport(recordMeaningfulExpeditionInteraction(revisited, {
      interactionId: 'inspection:river-sign', kind: 'inspection',
    }), { exitedAt: '2026-07-19T12:00:00.000Z', companionResearchFact: fact });
    expect(repeated.report?.companionResearchFactId).toBeUndefined();
    expect(repeated.save.pokeDiscover).toMatchObject({ trainerExperience: 5, discoveryPoints: 5 });
  });

  it('recuerda la primera herramienta equipada y la reutiliza', () => {
    const active = beginExpedition(prepared(['tool:shovel']), {
      mapId: 'map:test:cave', toolId: 'tool:shovel', enteredAt: EXITED_AT,
    });
    expect(active.pokeDiscover.inventory.selectedToolId).toBe('tool:shovel');
    const revisited = beginExpedition(endExpeditionWithReport(active).save, {
      mapId: 'map:test:ruins', enteredAt: EXITED_AT,
    });
    expect(revisited.activeExpeditionSession?.loadout?.toolId).toBe('tool:shovel');
  });

  it('convierte la convivencia en nota adicional si un contenido antiguo ya completó el campo', () => {
    const save = prepared();
    const legacy = discoverResearchFact(save.pokeDiscover, {
      schemaVersion: 1,
      factId: 'research:pikachu:legacy-behavior',
      speciesId: 25,
      field: 'behavior',
      contribution: 'fieldCompletion',
      mapId: 'map:legacy:power-plant',
      interactionId: 'interaction:legacy:pikachu',
      text: 'Una observación anterior.',
      rewards: [],
    }, { discoveredAt: EXITED_AT }).state;
    const active = beginExpedition({ ...save, pokeDiscover: legacy }, {
      mapId: 'map:test:forest', enteredAt: EXITED_AT,
    });
    const result = endExpeditionWithReport(recordMeaningfulExpeditionInteraction(active, {
      interactionId: 'inspection:old-tree', kind: 'inspection',
    }), { exitedAt: EXITED_AT, companionResearchFact: fact });
    expect(result.save.pokeDiscover.researchBySpecies[25].fields.behavior.discoveredFactIds)
      .toEqual(['research:pikachu:legacy-behavior']);
    expect(result.save.pokeDiscover.researchBySpecies[25].additionalNoteIds).toContain(fact.factId);
  });
});
