import { beforeEach, describe, expect, it } from 'vitest';
import type { WorldEventV1 } from '../../packages/contracts/src/index.js';
import { recordMapDiscovery } from '../../src/domain/expeditions/adventureMapProgress.js';
import { activateWorldEvent, setMapVariantActive } from '../../src/domain/expeditions/worldEvents.js';
import { createPokeVoiceSaveV1 } from '../../src/domain/progress/pokeVoiceSave.js';
import {
  activateBrowserWorldEvent,
  getBrowserPokeVoiceSave,
  updateBrowserPokeDiscover,
} from '../../src/store/browserPokeVoiceSaveStore.js';

const MAP_ID = 'map:kanto:vermilion-harbor';

const mewEvent: WorldEventV1 = {
  schemaVersion: 1,
  eventId: 'world-event:mew-first-seen',
  activation: { kind: 'worldFlag', flagId: 'story:mew-truck-investigated' },
  setFlags: { mewFirstSeen: true },
  encounterInjections: [
    { mapId: MAP_ID, encounterId: 'encounter:vermilion:mew-return' },
    { mapId: 'map:kanto:test-meadow', encounterId: 'encounter:test-meadow:mew' },
  ],
  mapVariants: [{ mapId: MAP_ID, variantId: 'variant:vermilion:mew-ripples' }],
};

function eligibleSave() {
  const save = createPokeVoiceSaveV1({ runId: 'run:world-event', now: Date.now() });
  save.pokeDiscover.worldFlags['story:mew-truck-investigated'] = true;
  return save;
}

describe('eventos globales y variantes de mapa', () => {
  beforeEach(() => localStorage.clear());

  it('no muta el mundo mientras no se cumpla su requisito', () => {
    const save = createPokeVoiceSaveV1({ runId: 'run:locked', now: Date.now() });
    const result = activateWorldEvent(save, mewEvent);

    expect(result).toEqual({ status: 'ineligible', save });
  });

  it('inyecta encuentros y variantes sin borrar secretos del mapa visitado', () => {
    const save = eligibleSave();
    const withSecret = {
      ...save,
      pokeDiscover: recordMapDiscovery(
        save.pokeDiscover,
        MAP_ID,
        'secret',
        'secret:vermilion:truck-key',
      ).state,
    };
    const result = activateWorldEvent(withSecret, mewEvent);
    const progress = result.save.pokeDiscover.mapProgress[MAP_ID];

    expect(result.status).toBe('activated');
    expect(result.save.pokeDiscover.worldFlags.mewFirstSeen).toBe(true);
    expect(result.save.pokeDiscover.activatedWorldEventIds).toEqual([mewEvent.eventId]);
    expect(progress).toMatchObject({
      unlockedSecretIds: ['secret:vermilion:truck-key'],
      injectedEncounterIds: ['encounter:vermilion:mew-return'],
      activeVariantIds: ['variant:vermilion:mew-ripples'],
    });
  });

  it('activar dos veces el mismo evento es completamente idempotente', () => {
    const first = activateWorldEvent(eligibleSave(), mewEvent);
    const repeated = activateWorldEvent(first.save, mewEvent);

    expect(repeated.status).toBe('alreadyActivated');
    expect(repeated.save).toBe(first.save);
  });

  it('puede retirar una presentación temporal sin borrar encuentros ni progreso', () => {
    const activated = activateWorldEvent(eligibleSave(), mewEvent).save;
    const restored = setMapVariantActive(
      activated,
      MAP_ID,
      'variant:vermilion:mew-ripples',
      false,
    );

    expect(restored.pokeDiscover.mapProgress[MAP_ID]).toMatchObject({
      activeVariantIds: [],
      injectedEncounterIds: ['encounter:vermilion:mew-return'],
    });
    expect(restored.pokeDiscover.activatedWorldEventIds).toEqual([mewEvent.eventId]);
  });

  it('persiste el evento completo mediante el guardado del navegador', () => {
    getBrowserPokeVoiceSave();
    updateBrowserPokeDiscover(state => ({
      ...state,
      worldFlags: { ...state.worldFlags, 'story:mew-truck-investigated': true },
    }));
    const result = activateBrowserWorldEvent(mewEvent);

    expect(result.status).toBe('activated');
    expect(getBrowserPokeVoiceSave().pokeDiscover).toMatchObject({
      activatedWorldEventIds: [mewEvent.eventId],
      worldFlags: { mewFirstSeen: true },
      mapProgress: {
        [MAP_ID]: {
          activeVariantIds: ['variant:vermilion:mew-ripples'],
          injectedEncounterIds: ['encounter:vermilion:mew-return'],
        },
      },
    });
  });
});
