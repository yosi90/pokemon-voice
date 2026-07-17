import { describe, expect, it } from 'vitest';
import {
  CAMPHOR_FOREST_MAP,
  CAMPHOR_PROLOGUE_RATTATA_COUNTER,
  CAMPHOR_RATTATA_ACTOR_IDS,
  CAMPHOR_SCIENTIST_ROUTE_ID,
} from '../../src/data/adventure/camphorPrologue.js';
import {
  beginCamphorPrologue,
  chooseCamphorStarter,
  completeCamphorPrologue,
  confirmCamphorCompanion,
  discoverCamphorPinecoSecret,
  driveAwayCamphorRattata,
  prepareCamphorPrologue,
  reachCamphorStarterChoice,
} from '../../src/domain/expeditions/camphorPrologue.js';
import { createPokeVoiceSaveV1 } from '../../src/domain/progress/pokeVoiceSave.js';

const NOW = '2026-07-18T12:00:00.000Z';

describe('prólogo del profesor Alcanfor', () => {
  it('modela un mapa lógico de habitaciones estáticas enlazadas a Tiled', () => {
    expect(CAMPHOR_FOREST_MAP).toMatchObject({
      schemaVersion: 2,
      rooms: [{ staticCamera: true, tiledMapAssetId: 'tiled-map:camphor-forest:ambush-clearing' }],
    });
  });

  it('desbloquea el comienzo típico y registra el inicial cuando no hay candidatos', () => {
    const initial = createPokeVoiceSaveV1({ runId: 'run:typical', now: Date.parse(NOW) });
    const prepared = prepareCamphorPrologue(initial, 0, NOW);
    expect(prepared).toMatchObject({
      pendingMissionLaunch: { checkpoint: 'openingCinematic' },
      pokeDiscover: { achievements: { 'typical-start': { achievementId: 'typical-start' } } },
    });
    const chosen = chooseCamphorStarter(reachCamphorStarterChoice(prepared), 1);
    expect(chosen.pokedexRun).toMatchObject({
      registeredSpeciesIds: [1],
      discoveryOrder: [1],
      selectedCompanion: { formId: 'pokemon-form:1:default' },
    });
    const active = beginCamphorPrologue(chosen, NOW);
    expect(active).toMatchObject({
      pendingMissionLaunch: undefined,
      activeExpeditionSession: {
        loadout: { companion: { formId: 'pokemon-form:1:default' } },
        missionRuntime: { counters: { [CAMPHOR_PROLOGUE_RATTATA_COUNTER]: 0 } },
      },
    });
  });

  it('exige confirmar un compañero existente antes de viajar', () => {
    const initial = createPokeVoiceSaveV1({ runId: 'run:companion', now: Date.parse(NOW) });
    const prepared = prepareCamphorPrologue(initial, 1, NOW);
    expect(() => confirmCamphorCompanion(prepared)).toThrow('seleccionar un compañero');
    prepared.pokedexRun.selectedCompanion = { schemaVersion: 1, formId: 'pokemon-form:25:default' };
    expect(confirmCamphorCompanion(prepared).pendingMissionLaunch?.checkpoint).toBe('ready');
  });

  it('resuelve tres actores una sola vez y completa misión, ruta e investigación', () => {
    const initial = createPokeVoiceSaveV1({ runId: 'run:rescue', now: Date.parse(NOW) });
    initial.pokedexRun.selectedCompanion = { schemaVersion: 1, formId: 'pokemon-form:25:default' };
    let active = beginCamphorPrologue(confirmCamphorCompanion(
      prepareCamphorPrologue(initial, 1, NOW),
    ), NOW);
    active = driveAwayCamphorRattata(active, CAMPHOR_RATTATA_ACTOR_IDS[0], 'direct');
    active = driveAwayCamphorRattata(active, CAMPHOR_RATTATA_ACTOR_IDS[0], 'direct');
    active = driveAwayCamphorRattata(active, CAMPHOR_RATTATA_ACTOR_IDS[1], 'companion');
    active = driveAwayCamphorRattata(active, CAMPHOR_RATTATA_ACTOR_IDS[2], 'direct');
    expect(active.activeExpeditionSession?.missionRuntime).toMatchObject({
      checkpointId: 'checkpoint:camphor-prologue:rescued',
      counters: { [CAMPHOR_PROLOGUE_RATTATA_COUNTER]: 3 },
    });

    const completed = completeCamphorPrologue(active, NOW);
    expect(completed).toMatchObject({
      status: 'completed',
      save: {
        activeExpeditionSession: {
          missionRuntime: { checkpointId: 'checkpoint:camphor-prologue:free-roam' },
        },
        pokeDiscover: {
          achievements: { 'first-mission': { achievementId: 'first-mission' } },
          researchBySpecies: { 19: { fields: { behavior: { completed: true } } } },
        },
      },
    });
    expect(completed.save.pokeDiscover.mapProgress[CAMPHOR_FOREST_MAP.mapId].unlockedRouteIds)
      .toContain(CAMPHOR_SCIENTIST_ROUTE_ID);
  });

  it('el secreto de Pineco y su biometría solo se descubren una vez', () => {
    const save = createPokeVoiceSaveV1({ runId: 'run:pineco', now: Date.parse(NOW) });
    const first = discoverCamphorPinecoSecret(save, NOW);
    const repeated = discoverCamphorPinecoSecret(first.save, NOW);
    expect(first.status).toBe('discovered');
    expect(repeated.status).toBe('alreadyDiscovered');
    expect(repeated.save.pokeDiscover.researchBySpecies[204].fields.biometrics.discoveredFactIds)
      .toHaveLength(1);
  });
});
