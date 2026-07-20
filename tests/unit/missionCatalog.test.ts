import { describe, expect, it } from 'vitest';
import { CAMPHOR_PROLOGUE_MISSION_ID } from '../../src/data/adventure/camphorPrologue.js';
import {
  getKnownPokeDiscoverMissionIds,
  getPokeDiscoverMission,
} from '../../src/data/adventure/missionCatalog.js';
import { createPokeVoiceSaveV1 } from '../../src/domain/progress/pokeVoiceSave.js';

describe('catálogo de encargos de PokeDiscover', () => {
  const createSave = () => createPokeVoiceSaveV1({ runId: 'run:mission-catalog', now: 1 });

  it('mantiene oculto el prólogo hasta que Alcanfor lo ofrece', () => {
    expect(getKnownPokeDiscoverMissionIds(createSave())).not.toContain(CAMPHOR_PROLOGUE_MISSION_ID);
  });

  it('publica la misión disponible con sus textos narrativos', () => {
    const save = createSave();
    save.pokeDiscover.worldFlags['story:camphor-prologue-offered'] = true;

    expect(getKnownPokeDiscoverMissionIds(save)).toContain(CAMPHOR_PROLOGUE_MISSION_ID);
    expect(getPokeDiscoverMission(CAMPHOR_PROLOGUE_MISSION_ID)).toMatchObject({
      title: '¡Ayuda al profesor Alcanfor!',
      loadingText: '¡Corriendo a ayudar al profesor!',
    });
  });

  it('no pierde una referencia persistente aunque la condición ya no esté visible', () => {
    const save = createSave();
    save.pokeDiscover.activeMissionIds.push(CAMPHOR_PROLOGUE_MISSION_ID);

    expect(getKnownPokeDiscoverMissionIds(save)).toContain(CAMPHOR_PROLOGUE_MISSION_ID);
  });
});
