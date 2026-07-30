import type {
  AdventureMapV3,
  HazardConsequenceV1,
  MapEventActivationV1,
  MapSequenceActionV1,
  RequirementExpressionV1,
} from '../../../packages/contracts/src/index.js';
import { nextStableEditorId } from './pokeDiscoverEditorBeats.js';

export type PokeDiscoverEventRecipeKind =
  | 'proximityAmbush'
  | 'periodicProjectile'
  | 'patrolCharge'
  | 'capabilityObstacle'
  | 'companionReaction'
  | 'inspectAndFlee'
  | 'actorInterception'
  | 'multiActorChoreography'
  | 'expressiveInteraction'
  | 'fallRecovery';

export interface PokeDiscoverEventRecipeRequest {
  kind: PokeDiscoverEventRecipeKind;
  sectorId: string;
  primaryActorId: string;
  secondaryActorId?: string;
  rangeTiles?: number;
  intervalMs?: number;
  pathId?: string;
  effectAssetId?: string;
  requirement?: RequirementExpressionV1;
  prompt?: string;
  phrase?: string;
  animation?: string;
  consequence?: HazardConsequenceV1;
  terrainAreaId?: string;
}

export const POKEDISCOVER_EVENT_RECIPES: ReadonlyArray<{
  kind: PokeDiscoverEventRecipeKind;
  label: string;
  description: string;
}> = Object.freeze([
  { kind: 'proximityAmbush', label: 'Emboscada por proximidad', description: 'Un actor oculto aparece y empuja al jugador al acercarse.' },
  { kind: 'periodicProjectile', label: 'Ataque periódico con proyectil', description: 'Dispara un efecto hacia el jugador mediante un temporizador pausable.' },
  { kind: 'patrolCharge', label: 'Patrulla, detección y carga', description: 'Detecta el cruce de una ruta y carga contra el jugador.' },
  { kind: 'capabilityObstacle', label: 'Obstáculo con objeto o capacidad', description: 'Una acción contextual elimina el obstáculo si se cumple el requisito.' },
  { kind: 'companionReaction', label: 'Reacción acompañante/actor', description: 'El acompañante reacciona automáticamente cerca de un actor.' },
  { kind: 'inspectAndFlee', label: 'Inspección y huida', description: 'Al inspeccionar, el actor reacciona y desaparece.' },
  { kind: 'actorInterception', label: 'Intercepción entre actores', description: 'Un actor carga hacia otro actor y lo intercepta.' },
  { kind: 'multiActorChoreography', label: 'Coreografía multiactor', description: 'Crea un paso paralelo con dos actores.' },
  { kind: 'expressiveInteraction', label: 'Interacción expresiva', description: 'Acepta voz, texto y fallback contextual.' },
  { kind: 'fallRecovery', label: 'Caída y recuperación', description: 'Enlaza una superficie fall con una consecuencia y un destino seguro.' },
]);

function allRequirements(): RequirementExpressionV1 {
  return { all: [] };
}

function allKnownIds(adventure: AdventureMapV3) {
  return [
    ...(adventure.mapSequences ?? []).map(item => item.sequenceId),
    ...(adventure.companionSequences ?? []).map(item => item.sequenceId),
    ...(adventure.mapEventTriggers ?? []).map(item => item.triggerId),
    ...adventure.behaviorTriggers.map(item => item.triggerId),
    ...adventure.expressionTriggers.map(item => item.triggerId),
  ];
}

function idsForRecipe(adventure: AdventureMapV3, kind: PokeDiscoverEventRecipeKind) {
  const triggerId = nextStableEditorId('trigger:map', allKnownIds(adventure));
  const ordinal = triggerId.split(':').at(-1);
  const rootId = `map-event:${ordinal}`;
  return {
    rootId,
    triggerId,
    sequenceId: `sequence:${rootId}`,
    beatId: `beat:${rootId}:01`,
  };
}

function eventActivation(
  request: PokeDiscoverEventRecipeRequest,
): MapEventActivationV1 {
  if (request.kind === 'periodicProjectile') {
    return {
      kind: 'interval',
      intervalMs: Math.max(100, request.intervalMs ?? 2_000),
    };
  }
  if (request.kind === 'fallRecovery') {
    return {
      kind: 'enterSurface',
      surfaceType: 'fall',
      ...(request.terrainAreaId ? { terrainAreaId: request.terrainAreaId } : {}),
    };
  }
  if (request.kind === 'patrolCharge' && request.pathId) {
    return { kind: 'pathCrossing', pathId: request.pathId, corridorTiles: 1 };
  }
  if (request.kind === 'capabilityObstacle' || request.kind === 'inspectAndFlee') {
    return {
      kind: 'contextAction',
      target: { kind: 'placement', placementId: request.primaryActorId },
      prompt: request.prompt?.trim() || 'Interactuar',
      rangeTiles: Math.max(1, request.rangeTiles ?? 1),
    };
  }
  return {
    kind: 'proximity',
    target: { kind: 'placement', placementId: request.primaryActorId },
    rangeTiles: Math.max(1, request.rangeTiles ?? 2),
  };
}

function defaultAction(request: PokeDiscoverEventRecipeRequest): MapSequenceActionV1[] {
  switch (request.kind) {
    case 'proximityAmbush':
      return [
        { kind: 'setVisible', actorRef: request.primaryActorId, visible: true },
        ...(request.animation ? [{
          kind: 'playAnimation' as const,
          actorRef: request.primaryActorId,
          animation: request.animation,
          repetitions: 1,
        }] : []),
        {
          kind: 'push',
          actorRef: 'dynamic:player',
          sourceRef: request.primaryActorId,
          direction: 'sourceToTarget',
          tiles: 1,
        },
      ];
    case 'periodicProjectile':
      return [{
        kind: 'spawnProjectile',
        actorRef: request.primaryActorId,
        effectAssetId: request.effectAssetId ?? 'effect:missing',
        direction: 'towardsPlayer',
        speedPixelsPerSecond: 96,
        lifetimeMs: 3_000,
        collisionMask: ['terrain', 'player'],
        ...(request.consequence ? { consequence: request.consequence } : {}),
      }];
    case 'patrolCharge':
      return [{
        kind: 'charge',
        actorRef: request.primaryActorId,
        targetRef: 'dynamic:player',
        speedPixelsPerSecond: 192,
        maximumTiles: 12,
        cooldownMs: 1_000,
        ...(request.consequence ? { consequence: request.consequence } : {}),
      }];
    case 'capabilityObstacle':
      return [{ kind: 'setVisible', actorRef: request.primaryActorId, visible: false }];
    case 'inspectAndFlee':
      return [
        ...(request.animation ? [{
          kind: 'playAnimation' as const,
          actorRef: request.primaryActorId,
          animation: request.animation,
          repetitions: 1,
        }] : []),
        { kind: 'setVisible', actorRef: request.primaryActorId, visible: false },
      ];
    case 'actorInterception':
      return [{
        kind: 'charge',
        actorRef: request.primaryActorId,
        targetRef: request.secondaryActorId ?? 'dynamic:player',
        speedPixelsPerSecond: 160,
        maximumTiles: 20,
        cooldownMs: 1_000,
      }];
    case 'multiActorChoreography':
      return [
        ...(request.animation ? [{
          kind: 'playAnimation' as const,
          actorRef: request.primaryActorId,
          animation: request.animation,
          repetitions: 1,
        }] : [{
          kind: 'face' as const,
          actorRef: request.primaryActorId,
          direction: 'right' as const,
        }]),
        {
          kind: 'face',
          actorRef: request.secondaryActorId ?? 'dynamic:companion',
          direction: 'left',
        },
      ];
    case 'expressiveInteraction':
      return request.animation ? [{
        kind: 'playAnimation',
        actorRef: request.primaryActorId,
        animation: request.animation,
        repetitions: 1,
      }] : [{
        kind: 'face',
        actorRef: request.primaryActorId,
        direction: 'down',
      }];
    case 'fallRecovery':
      return [{
        kind: 'applyHazardConsequence',
        consequence: request.consequence ?? defaultFallConsequence(),
      }];
    case 'companionReaction':
      return [];
  }
}

function defaultFallConsequence(): HazardConsequenceV1 {
  return {
    schemaVersion: 1,
    outcome: 'recover',
    rollbackPolicy: 'preserveGains',
    destination: { kind: 'sectorEntry' },
  };
}

export function createPokeDiscoverEventRecipe(
  adventure: AdventureMapV3,
  request: PokeDiscoverEventRecipeRequest,
): { adventure: AdventureMapV3; createdId: string; sequenceId: string } {
  const placementIds = new Set([
    ...adventure.actorPlacements,
    ...adventure.characterPlacements,
  ].filter(item => item.sectorId === request.sectorId).map(item => item.placementId));
  if (request.kind !== 'fallRecovery' && !placementIds.has(request.primaryActorId)) {
    throw new Error('La receta necesita un actor principal del sector.');
  }
  if (request.secondaryActorId && !placementIds.has(request.secondaryActorId)) {
    throw new Error('El actor secundario no pertenece al sector.');
  }
  const ids = idsForRecipe(adventure, request.kind);
  const requirement = request.requirement ?? allRequirements();

  if (request.kind === 'companionReaction') {
    const sequence = {
      schemaVersion: 1 as const,
      sequenceId: ids.sequenceId,
      sectorId: request.sectorId,
      beats: [{
        schemaVersion: 1 as const,
        beatId: ids.beatId,
        actions: [
          {
            kind: 'face' as const,
            actorRef: 'dynamic:companion' as const,
            direction: 'up' as const,
          },
          {
            kind: 'face' as const,
            actorRef: request.primaryActorId,
            direction: 'down' as const,
          },
        ],
        pauseAfterMs: 250,
      }],
    };
    return {
      adventure: {
        ...adventure,
        companionSequences: [...(adventure.companionSequences ?? []), sequence],
        behaviorTriggers: [...adventure.behaviorTriggers, {
          schemaVersion: 1,
          triggerId: ids.triggerId,
          mode: 'automatic',
          requirement,
          sequenceId: ids.sequenceId,
          proximity: {
            sectorId: request.sectorId,
            target: { kind: 'placement', placementId: request.primaryActorId },
            rangeTiles: Math.max(1, request.rangeTiles ?? 2),
          },
          repeatPolicy: 'oncePerVisit',
        }],
      },
      createdId: ids.triggerId,
      sequenceId: ids.sequenceId,
    };
  }

  const actions = defaultAction(request);
  const sequence = {
    schemaVersion: 1 as const,
    sequenceId: ids.sequenceId,
    sectorId: request.sectorId,
    beats: [{
      schemaVersion: 1 as const,
      beatId: ids.beatId,
      actions,
      pauseAfterMs: 0,
    }],
  };
  if (request.kind === 'expressiveInteraction') {
    return {
      adventure: {
        ...adventure,
        mapSequences: [...(adventure.mapSequences ?? []), sequence],
        expressionTriggers: [...adventure.expressionTriggers, {
          schemaVersion: 1,
          triggerId: ids.triggerId,
          sectorId: request.sectorId,
          target: { kind: 'placement', placementId: request.primaryActorId },
          prompt: request.prompt?.trim() || 'Expresarte',
          rangeTiles: Math.max(1, request.rangeTiles ?? 1),
          activationRequirement: requirement,
          inputMethods: ['voice', 'text', 'contextAction'],
          matchAny: [{
            kind: 'phrase',
            phrases: [request.phrase?.trim() || 'hola'],
          }],
          knownHintIds: [],
          successSequenceId: ids.sequenceId,
          fallbackActionId: `${ids.triggerId}:fallback`,
          fallbackLabel: 'Usar acción contextual',
        }],
      },
      createdId: ids.triggerId,
      sequenceId: ids.sequenceId,
    };
  }
  return {
    adventure: {
      ...adventure,
      mapSequences: [...(adventure.mapSequences ?? []), sequence],
      mapEventTriggers: [...(adventure.mapEventTriggers ?? []), {
        schemaVersion: 1,
        triggerId: ids.triggerId,
        sectorId: request.sectorId,
        activation: eventActivation(request),
        requirement,
        sequenceId: ids.sequenceId,
        repeatPolicy: ['periodicProjectile', 'fallRecovery'].includes(request.kind)
          ? 'repeatable'
          : 'oncePerVisit',
        resultingActorStates: [],
      }],
    },
    createdId: ids.triggerId,
    sequenceId: ids.sequenceId,
  };
}
