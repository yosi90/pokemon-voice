import type {
  MapEventTriggerV3,
  PokemonFormV1,
  PokemonSpeciesV1,
  PokeVoiceSaveV1,
} from '../../../packages/contracts/src/index.js';
import { evaluateRequirement } from '../requirements/evaluateRequirement.js';
import { createAdventureMapProgressV1 } from './adventureMapProgress.js';

export interface MapEventRequirementContext {
  companionForm?: PokemonFormV1;
  species?: readonly PokemonSpeciesV1[];
  expeditionCapabilities?: ReadonlyArray<{ id: string; strength?: number }>;
}

function unique(values: readonly string[]) {
  return [...new Set(values)];
}

export function isMapEventTriggerCompleted(
  save: PokeVoiceSaveV1,
  mapId: string,
  trigger: MapEventTriggerV3,
) {
  const policy = trigger.repeatPolicy ?? 'oncePerVisit';
  if (policy === 'repeatable') return false;
  if (policy === 'oncePerSectorVisit') {
    const visit = save.activeExpeditionSession?.activeSectorVisit;
    return visit?.sectorId === trigger.sectorId
      && visit.completedMapEventTriggerIds.includes(trigger.triggerId);
  }
  if (policy === 'persistent') {
    return save.pokeDiscover.mapProgress[mapId]
      ?.completedMapEventTriggerIds?.includes(trigger.triggerId) ?? false;
  }
  return save.activeExpeditionSession?.mapId === mapId
    && (save.activeExpeditionSession.completedMapEventTriggerIds ?? []).includes(trigger.triggerId);
}

export function listAvailableMapEventTriggers(
  save: PokeVoiceSaveV1,
  mapId: string,
  triggers: readonly MapEventTriggerV3[],
  context: MapEventRequirementContext = {},
) {
  return triggers.filter(trigger => (
    !isMapEventTriggerCompleted(save, mapId, trigger)
    && mapEventRequirementMet(save, trigger, context)
  ));
}

function mapEventRequirementMet(
  save: PokeVoiceSaveV1,
  trigger: MapEventTriggerV3,
  context: MapEventRequirementContext,
) {
  return evaluateRequirement(trigger.requirement, {
      save,
      ...(context.companionForm ? { companionForm: context.companionForm } : {}),
      ...(context.species ? { species: context.species } : {}),
      ...(context.expeditionCapabilities
        ? { expeditionCapabilities: context.expeditionCapabilities }
        : {}),
    }).met;
}

export function listRequirementEligibleMapEventTriggers(
  save: PokeVoiceSaveV1,
  triggers: readonly MapEventTriggerV3[],
  context: MapEventRequirementContext = {},
) {
  return triggers.filter(trigger => mapEventRequirementMet(save, trigger, context));
}

export function completeMapEventTrigger(
  save: PokeVoiceSaveV1,
  mapId: string,
  trigger: MapEventTriggerV3,
) {
  const session = save.activeExpeditionSession;
  if (!session || session.mapId !== mapId) {
    throw new Error('El evento de mapa sólo puede completarse dentro de su expedición activa.');
  }
  if (isMapEventTriggerCompleted(save, mapId, trigger)) {
    return { status: 'alreadyCompleted' as const, save };
  }
  const policy = trigger.repeatPolicy ?? 'oncePerVisit';
  if (policy === 'repeatable') return { status: 'completed' as const, save };
  if (policy === 'oncePerSectorVisit') {
    const visit = session.activeSectorVisit;
    if (!visit || visit.sectorId !== trigger.sectorId) {
      throw new Error('El evento no pertenece a la estancia activa del sector.');
    }
    return {
      status: 'completed' as const,
      save: {
        ...save,
        activeExpeditionSession: {
          ...session,
          activeSectorVisit: {
            ...visit,
            completedMapEventTriggerIds: unique([
              ...visit.completedMapEventTriggerIds,
              trigger.triggerId,
            ]),
          },
        },
      },
    };
  }
  if (policy === 'persistent') {
    const current = save.pokeDiscover.mapProgress[mapId]
      ?? createAdventureMapProgressV1(mapId);
    return {
      status: 'completed' as const,
      save: {
        ...save,
        pokeDiscover: {
          ...save.pokeDiscover,
          mapProgress: {
            ...save.pokeDiscover.mapProgress,
            [mapId]: {
              ...current,
              completedMapEventTriggerIds: unique([
                ...(current.completedMapEventTriggerIds ?? []),
                trigger.triggerId,
              ]),
            },
          },
        },
      },
    };
  }
  return {
    status: 'completed' as const,
    save: {
      ...save,
      activeExpeditionSession: {
        ...session,
        completedMapEventTriggerIds: unique([
          ...(session.completedMapEventTriggerIds ?? []),
          trigger.triggerId,
        ]),
      },
    },
  };
}

export function enterMapEventSector(
  save: PokeVoiceSaveV1,
  mapId: string,
  sectorId: string,
) {
  const session = save.activeExpeditionSession;
  if (!session || session.mapId !== mapId) return save;
  if (session.activeSectorVisit?.sectorId === sectorId) return save;
  return {
    ...save,
    activeExpeditionSession: {
      ...session,
      activeSectorVisit: {
        schemaVersion: 1 as const,
        sectorId,
        completedMapEventTriggerIds: [],
      },
    },
  };
}
