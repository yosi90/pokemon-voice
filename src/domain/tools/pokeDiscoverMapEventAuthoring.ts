import type {
  AdventureMapV3,
  MapEventActivationKind,
  MapEventRepeatPolicy,
  MapEventTriggerV3,
  MapSequenceBeatV1,
  MapSequenceV3,
  RequirementExpressionV1,
} from '../../../packages/contracts/src/index.js';
import {
  addPokeDiscoverTiledObject,
  removePokeDiscoverTiledObject,
  type PokeDiscoverEditableTiledMap,
  type PokeDiscoverTiledObject,
} from './pokeDiscoverEditorProject.js';
import {
  isPokeDiscoverEditorComment,
} from './pokeDiscoverEditorComments.js';

export interface PokeDiscoverMapEventDraft {
  activationKind: MapEventActivationKind;
  repeatPolicy: MapEventRepeatPolicy;
  placementId: string;
  startAnimation?: string;
  movementAnimation?: string;
  finalAnimation?: string;
  finalDirection?: 'up' | 'down' | 'left' | 'right';
  finalVisible?: boolean;
  pauseAfterStartMs?: number;
  pauseAfterMoveMs?: number;
  pathPoints?: Array<{ x: number; y: number }>;
  movementStyle?: 'grid' | 'continuous';
  speedPixelsPerSecond?: number;
  prompt?: string;
  rangeTiles?: number;
  targetPlacementId?: string;
  removeComment?: boolean;
  requirement?: RequirementExpressionV1;
}

function nextOrdinal(ids: Iterable<string>, prefix: string) {
  const used = new Set(ids);
  for (let ordinal = 1; ordinal <= 9999; ordinal += 1) {
    const value = `${prefix}${String(ordinal).padStart(2, '0')}`;
    if (!used.has(value)) return { id: value, ordinal };
  }
  throw new Error(`No quedan identificadores disponibles para ${prefix}.`);
}

function findComment(tilemap: PokeDiscoverEditableTiledMap, commentObjectId: number) {
  const comment = tilemap.layers
    .flatMap(layer => Array.isArray(layer.objects) ? layer.objects : [])
    .find(object => object.id === commentObjectId) as PokeDiscoverTiledObject | undefined;
  if (!comment || !isPokeDiscoverEditorComment(comment)) {
    throw new Error(`El objeto Tiled #${commentObjectId} no es un comentario editorial.`);
  }
  return comment;
}

function validPathPoints(points: Array<{ x: number; y: number }> | undefined) {
  return points?.length && points.length >= 2
    && points.every(point => Number.isFinite(point.x) && Number.isFinite(point.y));
}

function asRelativePolyline(points: Array<{ x: number; y: number }>) {
  const origin = points[0];
  return {
    x: origin.x,
    y: origin.y,
    polyline: points.map(point => ({ x: point.x - origin.x, y: point.y - origin.y })),
  };
}

export function createPokeDiscoverMapEventFromComment(
  adventure: AdventureMapV3,
  tilemap: PokeDiscoverEditableTiledMap,
  sectorId: string,
  commentObjectId: number,
  draft: PokeDiscoverMapEventDraft,
) {
  const comment = findComment(tilemap, commentObjectId);
  const placement = [
    ...adventure.actorPlacements,
    ...adventure.characterPlacements,
  ].find(candidate => candidate.placementId === draft.placementId && candidate.sectorId === sectorId);
  if (!placement) throw new Error('El evento necesita un actor existente en este sector.');
  if (!['enterZone', 'contextAction', 'proximity'].includes(draft.activationKind)) {
    throw new Error('La activación del evento no es compatible.');
  }
  if (!['oncePerSectorVisit', 'oncePerVisit', 'repeatable', 'persistent'].includes(draft.repeatPolicy)) {
    throw new Error('La política de repetición no es compatible.');
  }

  const eventOrdinal = nextOrdinal(
    [
      ...(adventure.mapEventTriggers ?? []).map(trigger => trigger.triggerId),
      ...adventure.behaviorTriggers.map(trigger => trigger.triggerId),
      ...adventure.expressionTriggers.map(trigger => trigger.triggerId),
      ...(adventure.mapSequences ?? []).flatMap(sequence => {
        const match = /^sequence:map-event:(\d{2,})$/u.exec(sequence.sequenceId);
        return match ? [`trigger:map:${match[1]}`] : [];
      }),
    ],
    'trigger:map:',
  );
  const triggerId = eventOrdinal.id;
  const sequenceId = `sequence:map-event:${String(eventOrdinal.ordinal).padStart(2, '0')}`;
  const zoneId = `${triggerId}:zone:01`;
  const pathId = `${sequenceId}:beat:02:path:01`;
  let nextTilemap = tilemap;

  const usePlacementTarget = Boolean(
    draft.targetPlacementId
      && (draft.activationKind === 'contextAction' || draft.activationKind === 'proximity'),
  );
  if (!usePlacementTarget) {
    nextTilemap = addPokeDiscoverTiledObject(nextTilemap, 'Triggers', {
      name: zoneId,
      class: 'TriggerZone',
      type: 'TriggerZone',
      x: Number(comment.x),
      y: Number(comment.y),
      width: Number(comment.width),
      height: Number(comment.height),
      rotation: Number(comment.rotation ?? 0),
      ...(comment.polygon ? { polygon: comment.polygon.map(point => ({ ...point })) } : {}),
    }).tilemap;
  }

  const pathPoints = validPathPoints(draft.pathPoints) ? draft.pathPoints! : undefined;
  if (pathPoints) {
    const relative = asRelativePolyline(pathPoints);
    nextTilemap = addPokeDiscoverTiledObject(nextTilemap, 'Paths', {
      name: pathId,
      class: 'AmbientPath',
      type: 'AmbientPath',
      x: relative.x,
      y: relative.y,
      width: 0,
      height: 0,
      polyline: relative.polyline,
    }).tilemap;
  }

  const beats: MapSequenceBeatV1[] = [];
  if (draft.startAnimation) {
    beats.push({
      schemaVersion: 1,
      beatId: `${sequenceId}:beat:01`,
      actions: [{
        kind: 'playAnimation',
        actorRef: draft.placementId,
        animation: draft.startAnimation,
      }],
      pauseAfterMs: Math.max(0, Number(draft.pauseAfterStartMs) || 0),
    });
  }
  if (pathPoints) {
    beats.push({
      schemaVersion: 1,
      beatId: `${sequenceId}:beat:02`,
      actions: [{
        kind: 'movePath',
        actorRef: draft.placementId,
        pathId,
        movementStyle: draft.movementStyle ?? 'continuous',
        speedPixelsPerSecond: Math.max(1, Number(draft.speedPixelsPerSecond) || 64),
        ...(draft.movementAnimation ? { animation: draft.movementAnimation } : {}),
      }],
      pauseAfterMs: Math.max(0, Number(draft.pauseAfterMoveMs) || 0),
    });
  }
  if (draft.finalAnimation) {
    beats.push({
      schemaVersion: 1,
      beatId: `${sequenceId}:beat:03`,
      actions: [{
        kind: 'playAnimation',
        actorRef: draft.placementId,
        animation: draft.finalAnimation,
      }],
      pauseAfterMs: 0,
    });
  }
  if (!beats.length) throw new Error('El evento necesita al menos una animación o una ruta.');

  const target = usePlacementTarget
    ? { kind: 'placement' as const, placementId: draft.targetPlacementId! }
    : { kind: 'zone' as const, zoneId };
  const activation: MapEventTriggerV3['activation'] = draft.activationKind === 'enterZone'
    ? { kind: 'enterZone', zoneId }
    : draft.activationKind === 'contextAction'
      ? {
        kind: 'contextAction',
        target,
        prompt: draft.prompt?.trim() || 'Interactuar',
        rangeTiles: Math.max(1, Number(draft.rangeTiles) || 1),
      }
      : {
        kind: 'proximity',
        target,
        rangeTiles: Math.max(1, Number(draft.rangeTiles) || 1),
      };
  const resultingState = {
    schemaVersion: 1 as const,
    placementId: draft.placementId,
    ...(pathPoints ? { position: { kind: 'pathEnd' as const, pathId } } : {}),
    ...(draft.finalAnimation ? { animation: draft.finalAnimation } : {}),
    ...(draft.finalDirection ? { direction: draft.finalDirection } : {}),
    ...(draft.finalVisible !== undefined ? { visible: draft.finalVisible } : {}),
  };
  const sequence: MapSequenceV3 = {
    schemaVersion: 1,
    sequenceId,
    sectorId,
    beats,
  };
  const trigger: MapEventTriggerV3 = {
    schemaVersion: 1,
    triggerId,
    sectorId,
    activation,
    requirement: draft.requirement ?? { kind: 'trainerLevel', minimum: 1 },
    sequenceId,
    repeatPolicy: draft.repeatPolicy,
    resultingActorStates: [resultingState],
  };
  if (draft.removeComment ?? true) {
    nextTilemap = removePokeDiscoverTiledObject(nextTilemap, commentObjectId);
  }
  return {
    adventure: {
      ...adventure,
      mapSequences: [...(adventure.mapSequences ?? []), sequence],
      mapEventTriggers: [...(adventure.mapEventTriggers ?? []), trigger],
    },
    tilemap: nextTilemap,
    triggerId,
    sequenceId,
    zoneId: usePlacementTarget ? undefined : zoneId,
    pathId: pathPoints ? pathId : undefined,
  };
}
