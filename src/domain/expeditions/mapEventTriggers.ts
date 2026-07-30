import type {
  MapEventTriggerV3,
  PokemonFormV1,
  PokemonSpeciesV1,
  PokeVoiceSaveV1,
  RewardDefinitionV1,
} from '../../../packages/contracts/src/index.js';
import { claimPokeDiscoverRewards } from '../progress/rewardLedger.js';
import { createExpeditionRollbackSnapshot } from './expeditionSession.js';
import { evaluateRequirement } from '../requirements/evaluateRequirement.js';
import { createAdventureMapProgressV1 } from './adventureMapProgress.js';
import { recordMapDiscovery } from './adventureMapProgress.js';

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
  options: {
    completedAt?: string;
    rewards?: readonly RewardDefinitionV1[];
  } = {},
) {
  const session = save.activeExpeditionSession;
  if (!session || session.mapId !== mapId) {
    throw new Error('El evento de mapa sólo puede completarse dentro de su expedición activa.');
  }
  if (isMapEventTriggerCompleted(save, mapId, trigger)) {
    return { status: 'alreadyCompleted' as const, save };
  }
  const policy = trigger.repeatPolicy ?? 'oncePerVisit';
  const applyCompletion = (candidate: PokeVoiceSaveV1) => {
    let next = candidate;
    for (const secretId of trigger.completionEffects?.unlockSecretIds ?? []) {
      const discovery = recordMapDiscovery(next.pokeDiscover, mapId, 'secret', secretId);
      next = { ...next, pokeDiscover: discovery.state };
    }
    const rewards = options.rewards ?? trigger.rewards;
    if (!rewards?.length) return next;
    if (!trigger.rewardOriginId) {
      throw new Error('Un evento de mapa con recompensas debe declarar rewardOriginId.');
    }
    if (!options.completedAt || Number.isNaN(Date.parse(options.completedAt))) {
      throw new Error('completedAt debe ser una fecha ISO válida al conceder recompensas.');
    }
    const reward = claimPokeDiscoverRewards(next.pokeDiscover, {
      originId: trigger.rewardOriginId,
      rewards: [...rewards],
      claimedAt: options.completedAt,
      runId: next.pokedexRun.runId,
      mapId,
      ...(session.missionId ? { missionId: session.missionId } : {}),
    });
    return { ...next, pokeDiscover: reward.state };
  };
  if (policy === 'repeatable') {
    return { status: 'completed' as const, save: applyCompletion(save) };
  }
  if (policy === 'oncePerSectorVisit') {
    const visit = session.activeSectorVisit;
    if (!visit || visit.sectorId !== trigger.sectorId) {
      throw new Error('El evento no pertenece a la estancia activa del sector.');
    }
    return {
      status: 'completed' as const,
      save: applyCompletion({
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
      }),
    };
  }
  if (policy === 'persistent') {
    const current = save.pokeDiscover.mapProgress[mapId]
      ?? createAdventureMapProgressV1(mapId);
    return {
      status: 'completed' as const,
      save: applyCompletion({
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
      }),
    };
  }
  return {
    status: 'completed' as const,
    save: applyCompletion({
      ...save,
      activeExpeditionSession: {
        ...session,
        completedMapEventTriggerIds: unique([
          ...(session.completedMapEventTriggerIds ?? []),
          trigger.triggerId,
        ]),
      },
    }),
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
        rollbackSnapshot: createExpeditionRollbackSnapshot(save),
      },
    },
  };
}
