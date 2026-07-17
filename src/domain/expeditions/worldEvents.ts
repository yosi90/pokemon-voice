import type {
  AdventureMapProgressV1,
  PokeVoiceSaveV1,
  WorldEventV1,
} from '../../../packages/contracts/src/index.js';
import { evaluateRequirement } from '../requirements/evaluateRequirement.js';
import { createAdventureMapProgressV1 } from './adventureMapProgress.js';

export interface ActivateWorldEventResult {
  status: 'activated' | 'alreadyActivated' | 'ineligible';
  save: PokeVoiceSaveV1;
}

function appendUnique(values: readonly string[] | undefined, value: string) {
  return values?.includes(value) ? [...values] : [...(values ?? []), value];
}

function updateMapProgress(
  progressByMap: Record<string, AdventureMapProgressV1>,
  mapId: string,
  update: (progress: AdventureMapProgressV1) => AdventureMapProgressV1,
) {
  const current = progressByMap[mapId] ?? createAdventureMapProgressV1(mapId);
  return { ...progressByMap, [mapId]: update(current) };
}

export function activateWorldEvent(
  save: PokeVoiceSaveV1,
  event: WorldEventV1,
): ActivateWorldEventResult {
  if (!event.eventId?.trim()) throw new Error('eventId debe ser estable y no vacío.');
  if (save.pokeDiscover.activatedWorldEventIds?.includes(event.eventId)) {
    return { status: 'alreadyActivated', save };
  }
  if (!evaluateRequirement(event.activation, { save }).met) {
    return { status: 'ineligible', save };
  }

  let mapProgress = save.pokeDiscover.mapProgress;
  for (const injection of event.encounterInjections) {
    mapProgress = updateMapProgress(mapProgress, injection.mapId, current => ({
      ...current,
      injectedEncounterIds: appendUnique(current.injectedEncounterIds, injection.encounterId),
    }));
  }
  for (const variant of event.mapVariants) {
    mapProgress = updateMapProgress(mapProgress, variant.mapId, current => ({
      ...current,
      activeVariantIds: appendUnique(current.activeVariantIds, variant.variantId),
    }));
  }

  return {
    status: 'activated',
    save: {
      ...save,
      pokeDiscover: {
        ...save.pokeDiscover,
        activatedWorldEventIds: appendUnique(
          save.pokeDiscover.activatedWorldEventIds,
          event.eventId,
        ),
        worldFlags: { ...save.pokeDiscover.worldFlags, ...event.setFlags },
        mapProgress,
      },
    },
  };
}

export function setMapVariantActive(
  save: PokeVoiceSaveV1,
  mapId: string,
  variantId: string,
  active: boolean,
): PokeVoiceSaveV1 {
  if (!mapId?.trim() || !variantId?.trim()) {
    throw new Error('mapId y variantId deben ser identificadores estables no vacíos.');
  }
  const current = save.pokeDiscover.mapProgress[mapId]
    ?? createAdventureMapProgressV1(mapId);
  const isActive = current.activeVariantIds.includes(variantId);
  if (isActive === active) return save;
  const activeVariantIds = active
    ? [...current.activeVariantIds, variantId]
    : current.activeVariantIds.filter(id => id !== variantId);
  const mapProgress = { ...current, activeVariantIds };
  return {
    ...save,
    pokeDiscover: {
      ...save.pokeDiscover,
      mapProgress: { ...save.pokeDiscover.mapProgress, [mapId]: mapProgress },
    },
  };
}
