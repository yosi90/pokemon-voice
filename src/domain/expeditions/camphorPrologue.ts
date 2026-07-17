import type { PokeVoiceSaveV1 } from '../../../packages/contracts/src/index.js';
import {
  CAMPHOR_FOREST_MAP_ID,
  CAMPHOR_PROLOGUE_MISSION,
  CAMPHOR_PROLOGUE_MISSION_ID,
  CAMPHOR_PROLOGUE_RATTATA_COUNTER,
  CAMPHOR_RATTATA_ACTOR_IDS,
  CAMPHOR_RATTATA_RESEARCH,
  CAMPHOR_SCIENTIST_ROUTE_ID,
  CAMPHOR_PINECO_RESEARCH,
  CAMPHOR_PINECO_SECRET_ID,
} from '../../data/adventure/camphorPrologue.js';
import { discoverResearchFact } from '../research/researchProgress.js';
import { recordMapDiscovery } from './adventureMapProgress.js';
import { beginExpedition, recordMeaningfulExpeditionInteraction } from './expeditionSession.js';
import { completeMissionDefinition, startAdventureMission } from './missionLifecycle.js';

export const TYPICAL_START_ACHIEVEMENT_ID = 'typical-start';
export const CAMPHOR_STARTER_SPECIES_IDS = Object.freeze([1, 4, 7] as const);

function requireIsoDate(value: string) {
  if (Number.isNaN(Date.parse(value))) throw new Error('La fecha debe ser ISO válida.');
}

function unlockTypicalStart(save: PokeVoiceSaveV1, unlockedAt: string) {
  if (save.pokeDiscover.achievements[TYPICAL_START_ACHIEVEMENT_ID]) return save;
  return {
    ...save,
    pokeDiscover: {
      ...save.pokeDiscover,
      achievements: {
        ...save.pokeDiscover.achievements,
        [TYPICAL_START_ACHIEVEMENT_ID]: {
          schemaVersion: 1 as const,
          achievementId: TYPICAL_START_ACHIEVEMENT_ID,
          unlockedAt: new Date(unlockedAt).toISOString(),
          domain: 'pokeDiscover' as const,
          originRunId: save.pokedexRun.runId,
        },
      },
    },
  };
}

export function prepareCamphorPrologue(
  save: PokeVoiceSaveV1,
  availableCompanionCount: number,
  offeredAt: string,
) {
  requireIsoDate(offeredAt);
  if (save.activeExpeditionSession || save.activeModeSession) {
    throw new Error('El prólogo solo puede prepararse en un momento seguro.');
  }
  if (!Number.isSafeInteger(availableCompanionCount) || availableCompanionCount < 0) {
    throw new Error('availableCompanionCount debe ser un entero no negativo.');
  }
  let next: PokeVoiceSaveV1 = {
    ...save,
    pokeDiscover: {
      ...save.pokeDiscover,
      worldFlags: { ...save.pokeDiscover.worldFlags, 'story:camphor-prologue-offered': true },
    },
  };
  if (availableCompanionCount === 0) next = unlockTypicalStart(next, offeredAt);
  return {
    ...next,
    pendingMissionLaunch: {
      schemaVersion: 1 as const,
      missionId: CAMPHOR_PROLOGUE_MISSION_ID,
      checkpoint: availableCompanionCount > 0 ? 'awaitingCompanion' as const : 'openingCinematic' as const,
      offeredAt: new Date(offeredAt).toISOString(),
    },
  };
}

export function reachCamphorStarterChoice(save: PokeVoiceSaveV1) {
  if (save.pendingMissionLaunch?.missionId !== CAMPHOR_PROLOGUE_MISSION_ID
    || save.pendingMissionLaunch.checkpoint !== 'openingCinematic') {
    throw new Error('La cinemática del asalto no está esperando la caída de las Poké Balls.');
  }
  return {
    ...save,
    pendingMissionLaunch: { ...save.pendingMissionLaunch, checkpoint: 'awaitingStarter' as const },
  };
}

export function chooseCamphorStarter(
  save: PokeVoiceSaveV1,
  speciesId: typeof CAMPHOR_STARTER_SPECIES_IDS[number],
) {
  if (save.pendingMissionLaunch?.checkpoint !== 'awaitingStarter') {
    throw new Error('No hay una elección de inicial pendiente.');
  }
  if (!(CAMPHOR_STARTER_SPECIES_IDS as readonly number[]).includes(speciesId)) {
    throw new Error('El inicial debe ser Bulbasaur, Charmander o Squirtle.');
  }
  const registeredSpeciesIds = save.pokedexRun.registeredSpeciesIds.includes(speciesId)
    ? save.pokedexRun.registeredSpeciesIds
    : [...save.pokedexRun.registeredSpeciesIds, speciesId];
  const discoveryOrder = save.pokedexRun.discoveryOrder.includes(speciesId)
    ? save.pokedexRun.discoveryOrder
    : [...save.pokedexRun.discoveryOrder, speciesId];
  return {
    ...save,
    pokedexRun: {
      ...save.pokedexRun,
      registeredSpeciesIds,
      discoveryOrder,
      selectedCompanion: { schemaVersion: 1 as const, formId: `pokemon-form:${speciesId}:default` },
      selectedCompanionFormId: `pokemon-form:${speciesId}:default`,
    },
    pendingMissionLaunch: { ...save.pendingMissionLaunch, checkpoint: 'ready' as const },
  };
}

export function confirmCamphorCompanion(save: PokeVoiceSaveV1) {
  if (save.pendingMissionLaunch?.missionId !== CAMPHOR_PROLOGUE_MISSION_ID
    || save.pendingMissionLaunch.checkpoint !== 'awaitingCompanion') {
    throw new Error('El prólogo no está esperando la confirmación del compañero.');
  }
  if (!save.pokedexRun.selectedCompanion?.formId && !save.pokedexRun.selectedCompanionFormId) {
    throw new Error('Debes seleccionar un compañero antes de confirmar.');
  }
  return {
    ...save,
    pendingMissionLaunch: { ...save.pendingMissionLaunch, checkpoint: 'ready' as const },
  };
}

export function beginCamphorPrologue(save: PokeVoiceSaveV1, enteredAt: string): PokeVoiceSaveV1 {
  if (save.pendingMissionLaunch?.missionId !== CAMPHOR_PROLOGUE_MISSION_ID
    || save.pendingMissionLaunch.checkpoint !== 'ready') {
    throw new Error('El prólogo todavía no está listo para comenzar.');
  }
  const started = startAdventureMission(save, CAMPHOR_PROLOGUE_MISSION);
  if (started.status !== 'active') throw new Error(`No se pudo activar el prólogo: ${started.status}.`);
  const expedition = beginExpedition(started.save, {
    mapId: CAMPHOR_FOREST_MAP_ID,
    missionId: CAMPHOR_PROLOGUE_MISSION_ID,
    enteredAt,
  });
  return {
    ...expedition,
    pendingMissionLaunch: undefined,
    activeExpeditionSession: {
      ...expedition.activeExpeditionSession!,
      missionRuntime: {
        schemaVersion: 1 as const,
        missionId: CAMPHOR_PROLOGUE_MISSION_ID,
        checkpointId: 'checkpoint:camphor-prologue:rescue',
        flags: {},
        counters: { [CAMPHOR_PROLOGUE_RATTATA_COUNTER]: 0 },
        resolvedActorIds: [],
      },
    },
  };
}

export function driveAwayCamphorRattata(
  save: PokeVoiceSaveV1,
  actorId: string,
  method: 'direct' | 'companion',
) {
  const runtime = save.activeExpeditionSession?.missionRuntime;
  if (runtime?.missionId !== CAMPHOR_PROLOGUE_MISSION_ID) throw new Error('El prólogo no está activo.');
  if (!CAMPHOR_RATTATA_ACTOR_IDS.includes(actorId)) throw new Error('actorId no pertenece a los Rattata del prólogo.');
  if (runtime.resolvedActorIds.includes(actorId)) return save;
  const resolvedActorIds = [...runtime.resolvedActorIds, actorId];
  let next: PokeVoiceSaveV1 = {
    ...save,
    activeExpeditionSession: {
      ...save.activeExpeditionSession!,
      missionRuntime: {
        ...runtime,
        checkpointId: resolvedActorIds.length === CAMPHOR_RATTATA_ACTOR_IDS.length
          ? 'checkpoint:camphor-prologue:rescued'
          : runtime.checkpointId,
        counters: { ...runtime.counters, [CAMPHOR_PROLOGUE_RATTATA_COUNTER]: resolvedActorIds.length },
        resolvedActorIds,
      },
    },
  };
  next = recordMeaningfulExpeditionInteraction(next, {
    interactionId: `pokemon-interaction:${actorId}`,
    kind: method === 'companion' ? 'companionBehavior' : 'pokemonInteraction',
  });
  return next;
}

export function completeCamphorPrologue(save: PokeVoiceSaveV1, completedAt: string) {
  const completion = completeMissionDefinition(save, CAMPHOR_PROLOGUE_MISSION, completedAt);
  if (completion.status !== 'completed') return completion;
  const route = recordMapDiscovery(
    completion.save.pokeDiscover,
    CAMPHOR_FOREST_MAP_ID,
    'route',
    CAMPHOR_SCIENTIST_ROUTE_ID,
  );
  const research = discoverResearchFact(route.state, CAMPHOR_RATTATA_RESEARCH, {
    discoveredAt: completedAt,
    runId: save.pokedexRun.runId,
    missionId: CAMPHOR_PROLOGUE_MISSION_ID,
  });
  const activeSession = completion.save.activeExpeditionSession;
  return {
    ...completion,
    save: {
      ...completion.save,
      pokeDiscover: research.state,
      ...(activeSession?.missionRuntime ? {
        activeExpeditionSession: {
          ...activeSession,
          missionRuntime: {
            ...activeSession.missionRuntime,
            checkpointId: 'checkpoint:camphor-prologue:free-roam',
            flags: {
              ...activeSession.missionRuntime.flags,
              'mission-flag:camphor:scientists-departed': true,
            },
          },
        },
      } : {}),
    },
  };
}

export function discoverCamphorPinecoSecret(save: PokeVoiceSaveV1, discoveredAt: string) {
  const secret = recordMapDiscovery(
    save.pokeDiscover,
    CAMPHOR_FOREST_MAP_ID,
    'secret',
    CAMPHOR_PINECO_SECRET_ID,
  );
  const research = discoverResearchFact(secret.state, CAMPHOR_PINECO_RESEARCH, {
    discoveredAt,
    runId: save.pokedexRun.runId,
    ...(save.activeExpeditionSession?.missionId
      ? { missionId: save.activeExpeditionSession.missionId }
      : {}),
  });
  let next = { ...save, pokeDiscover: research.state };
  if (next.activeExpeditionSession) next = recordMeaningfulExpeditionInteraction(next, {
    interactionId: `secret:${CAMPHOR_PINECO_SECRET_ID}`,
    kind: 'secret',
  });
  return {
    status: secret.status === 'recorded' ? 'discovered' as const : 'alreadyDiscovered' as const,
    save: next,
  };
}
