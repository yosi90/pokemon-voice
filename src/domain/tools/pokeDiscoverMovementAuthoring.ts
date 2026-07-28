import type {
  AdventureMapV3,
  AmbientBeatV1,
  AmbientPlaybackMode,
  AmbientSequenceV3,
  MapEventActivationKind,
  MapEventRepeatPolicy,
  MapEventTriggerV3,
  MapSequenceBeatV1,
  MapSequenceV3,
} from '../../../packages/contracts/src/index.js';
import {
  addPokeDiscoverTiledObject,
  type PokeDiscoverEditableTiledMap,
} from './pokeDiscoverEditorProject.js';
import { nextStableEditorId } from './pokeDiscoverEditorBeats.js';
import {
  readTiledCollisionShape,
  rectangleOverlapsCollision,
} from '../maps/tiledCollisionGeometry.js';

export interface PokeDiscoverMovementRouteDraft {
  placementId: string;
  points: Array<{ x: number; y: number }>;
  usage: 'ambient' | 'event';
  speedPixelsPerSecond: number;
  movementAnimation?: string;
  finalAnimation?: string;
  finalDirection?: 'up' | 'down' | 'left' | 'right';
  pauseAfterMoveMs?: number;
  playbackMode?: AmbientPlaybackMode;
  activationKind?: MapEventActivationKind;
  repeatPolicy?: MapEventRepeatPolicy;
  prompt?: string;
  rangeTiles?: number;
  targetPlacementId?: string;
  sequenceId?: string;
  triggerZone?: { x: number; y: number; width: number; height: number };
}

function nextOrdinal(ids: Iterable<string>, prefix: string) {
  return nextStableEditorId(prefix, [...ids]);
}

function relativePolyline(points: Array<{ x: number; y: number }>) {
  const origin = points[0];
  return {
    x: origin.x,
    y: origin.y,
    polyline: points.map(point => ({ x: point.x - origin.x, y: point.y - origin.y })),
  };
}

function ensureDraft(
  adventure: AdventureMapV3,
  tilemap: PokeDiscoverEditableTiledMap,
  sectorId: string,
  draft: PokeDiscoverMovementRouteDraft,
) {
  const placement = [
    ...adventure.actorPlacements,
    ...adventure.characterPlacements,
  ].find(candidate => candidate.placementId === draft.placementId && candidate.sectorId === sectorId);
  if (!placement) throw new Error('La ruta necesita una entidad existente en este sector.');
  if (draft.points.length < 2) throw new Error('La ruta necesita al menos dos puntos.');
  if (draft.points.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
    throw new Error('La ruta contiene una posición inválida.');
  }
  if (draft.points.slice(1).some((point, index) => (
    point.x !== draft.points[index].x && point.y !== draft.points[index].y
  ))) {
    throw new Error('La ruta sólo puede contener giros de 90 grados.');
  }
  if ((placement.collision ?? 'solid') === 'solid') {
    const collisionLayer = tilemap.layers.find(layer => layer.name === 'Collision');
    const collisionObjects = Array.isArray(collisionLayer?.objects) ? collisionLayer.objects : [];
    const collisions = collisionObjects.flatMap(object => {
        const shape = readTiledCollisionShape(object);
        return shape ? [shape] : [];
      });
    const samples = draft.points.slice(1).flatMap((point, index) => {
      const previous = draft.points[index];
      const distance = Math.hypot(point.x - previous.x, point.y - previous.y);
      const steps = Math.max(1, Math.ceil(distance / 4));
      return Array.from({ length: steps }, (_, step) => ({
        x: previous.x + (point.x - previous.x) * ((step + 1) / steps),
        y: previous.y + (point.y - previous.y) * ((step + 1) / steps),
      }));
    });
    if (samples.some(point => collisions.some(collision => rectangleOverlapsCollision({
      x: point.x - 8,
      y: point.y - 16,
      width: 16,
      height: 16,
    }, collision)))) {
      throw new Error('La ruta atraviesa una colisión. Corrige el trazado o usa una entidad atravesable.');
    }
  }
  return placement;
}

function addPath(
  tilemap: PokeDiscoverEditableTiledMap,
  pathId: string,
  points: Array<{ x: number; y: number }>,
) {
  const relative = relativePolyline(points);
  return addPokeDiscoverTiledObject(tilemap, 'Paths', {
    name: pathId,
    class: 'AmbientPath',
    type: 'AmbientPath',
    x: relative.x,
    y: relative.y,
    width: 0,
    height: 0,
    polyline: relative.polyline,
  });
}

function nextBeatId(sequenceId: string, beatIds: readonly string[]) {
  return nextOrdinal(beatIds, `${sequenceId}:beat`);
}

function nextPathId(sequenceId: string, tilemap: PokeDiscoverEditableTiledMap) {
  const ids = tilemap.layers.flatMap(layer => Array.isArray(layer.objects)
    ? layer.objects.map(object => String(object.name ?? ''))
    : []);
  return nextOrdinal(ids, `${sequenceId}:path`);
}

function mapEventIds(adventure: AdventureMapV3) {
  const triggerId = nextOrdinal([
    ...(adventure.mapEventTriggers ?? []).map(trigger => trigger.triggerId),
    ...adventure.behaviorTriggers.map(trigger => trigger.triggerId),
    ...adventure.expressionTriggers.map(trigger => trigger.triggerId),
  ], 'trigger:map');
  const ordinal = triggerId.split(':').at(-1)!;
  return { triggerId, sequenceId: `sequence:map-event:${ordinal}` };
}

export function createPokeDiscoverMovementRoute(
  adventure: AdventureMapV3,
  tilemap: PokeDiscoverEditableTiledMap,
  sectorId: string,
  draft: PokeDiscoverMovementRouteDraft,
) {
  const placement = ensureDraft(adventure, tilemap, sectorId, draft);
  if (draft.sequenceId) {
    return appendPokeDiscoverMovementRoute(adventure, tilemap, sectorId, draft);
  }
  if (draft.usage === 'ambient') {
    const sequenceId = nextOrdinal(
      adventure.ambientSequences.map(sequence => sequence.sequenceId),
      `ambient:${sectorId.split(':').at(-1)}`,
    );
    const beatId = `${sequenceId}:beat:01`;
    const pathId = `${sequenceId}:path:01`;
    const path = addPath(tilemap, pathId, draft.points);
    const playbackMode = draft.playbackMode ?? 'pingPong';
    if (playbackMode === 'loop') {
      const first = draft.points[0];
      const last = draft.points.at(-1)!;
      if (first.x !== last.x || first.y !== last.y) {
        throw new Error('Un circuito continuo debe terminar donde empezó.');
      }
    }
    const beats: AmbientBeatV1[] = [{
      schemaVersion: 1 as const,
      beatId,
      actions: [{
        kind: 'movePath' as const,
        placementId: draft.placementId,
        pathId,
        movementStyle: 'grid' as const,
        speedPixelsPerSecond: Math.max(1, draft.speedPixelsPerSecond),
        ...(draft.movementAnimation ? { animation: draft.movementAnimation } : {}),
      }],
      pauseAfterMs: Math.max(0, draft.pauseAfterMoveMs ?? 0),
    }];
    if (draft.finalAnimation) {
      beats.push({
        schemaVersion: 1,
        beatId: `${sequenceId}:beat:02`,
        actions: [{
          kind: 'playAnimation',
          placementId: draft.placementId,
          animation: draft.finalAnimation,
          ...(draft.finalDirection ? { direction: draft.finalDirection } : {}),
        }],
        pauseAfterMs: 0,
      });
    } else if (draft.finalDirection) {
      beats.push({
        schemaVersion: 1,
        beatId: `${sequenceId}:beat:02`,
        actions: [{
          kind: 'face',
          placementId: draft.placementId,
          direction: draft.finalDirection,
        }],
        pauseAfterMs: 0,
      });
    }
    const sequence: AmbientSequenceV3 = {
      schemaVersion: 1,
      sequenceId,
      sectorId,
      loop: playbackMode !== 'once',
      playbackMode,
      blockedPolicy: 'pauseSequence',
      beats,
    };
    return {
      adventure: {
        ...adventure,
        ambientSequences: [...adventure.ambientSequences, sequence],
      },
      tilemap: path.tilemap,
      sequenceId,
      pathId,
      objectId: path.object.id,
    };
  }

  const { triggerId, sequenceId } = mapEventIds(adventure);
  const beatId = `${sequenceId}:beat:01`;
  const pathId = `${sequenceId}:path:01`;
  let nextTilemap = addPath(tilemap, pathId, draft.points).tilemap;
  const usePlacementTarget = Boolean(
    draft.targetPlacementId
      && (draft.activationKind === 'contextAction' || draft.activationKind === 'proximity'),
  );
  const zoneId = `${triggerId}:zone:01`;
  if (!usePlacementTarget) {
    const start = draft.points[0];
    const zone = draft.triggerZone;
    nextTilemap = addPokeDiscoverTiledObject(nextTilemap, 'Triggers', {
      name: zoneId,
      class: 'TriggerZone',
      type: 'TriggerZone',
      x: zone?.x ?? start.x - 8,
      y: zone?.y ?? start.y - 8,
      width: Math.max(1, zone?.width ?? 16),
      height: Math.max(1, zone?.height ?? 16),
    }).tilemap;
  }
  const target = usePlacementTarget
    ? { kind: 'placement' as const, placementId: draft.targetPlacementId! }
    : { kind: 'zone' as const, zoneId };
  const activationKind = draft.activationKind ?? 'enterZone';
  const activation: MapEventTriggerV3['activation'] = activationKind === 'enterZone'
    ? { kind: 'enterZone', zoneId }
    : activationKind === 'contextAction'
      ? {
        kind: 'contextAction',
        target,
        prompt: draft.prompt?.trim() || 'Interactuar',
        rangeTiles: Math.max(1, draft.rangeTiles ?? 1),
      }
      : {
        kind: 'proximity',
        target,
        rangeTiles: Math.max(1, draft.rangeTiles ?? 1),
      };
  const beats: MapSequenceBeatV1[] = [{
    schemaVersion: 1,
    beatId,
    actions: [{
      kind: 'movePath',
      actorRef: draft.placementId,
      pathId,
      movementStyle: 'grid',
      speedPixelsPerSecond: Math.max(1, draft.speedPixelsPerSecond),
      ...(draft.movementAnimation ? { animation: draft.movementAnimation } : {}),
    }],
    pauseAfterMs: Math.max(0, draft.pauseAfterMoveMs ?? 0),
  }];
  if (draft.finalAnimation) {
    beats.push({
      schemaVersion: 1,
      beatId: `${sequenceId}:beat:02`,
      actions: [{
        kind: 'playAnimation',
        actorRef: draft.placementId,
        animation: draft.finalAnimation,
      }],
      pauseAfterMs: 0,
    });
  } else if (draft.finalDirection) {
    beats.push({
      schemaVersion: 1,
      beatId: `${sequenceId}:beat:02`,
      actions: [{
        kind: 'face',
        actorRef: draft.placementId,
        direction: draft.finalDirection,
      }],
      pauseAfterMs: 0,
    });
  }
  const repeatable = draft.repeatPolicy === 'repeatable';
  if (repeatable) {
    beats.push({
      schemaVersion: 1,
      beatId: `${sequenceId}:beat:${String(beats.length + 1).padStart(2, '0')}`,
      actions: [{
        kind: 'movePath',
        actorRef: draft.placementId,
        pathId,
        movementStyle: 'grid',
        speedPixelsPerSecond: Math.max(1, draft.speedPixelsPerSecond),
        reverse: true,
        ...(draft.movementAnimation ? { animation: draft.movementAnimation } : {}),
      }],
      pauseAfterMs: 0,
    });
    if ('animation' in placement) {
      beats.push({
        schemaVersion: 1,
        beatId: `${sequenceId}:beat:${String(beats.length + 1).padStart(2, '0')}`,
        actions: [{
          kind: 'playAnimation',
          actorRef: draft.placementId,
          animation: placement.animation,
        }],
        pauseAfterMs: 0,
      });
    } else {
      beats.push({
        schemaVersion: 1,
        beatId: `${sequenceId}:beat:${String(beats.length + 1).padStart(2, '0')}`,
        actions: [{
          kind: 'face',
          actorRef: draft.placementId,
          direction: placement.direction ?? 'down',
        }],
        pauseAfterMs: 0,
      });
    }
  }
  const mapSequenceDefinition: MapSequenceV3 = {
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
    requirement: { kind: 'trainerLevel', minimum: 1 },
    sequenceId,
    repeatPolicy: draft.repeatPolicy ?? 'oncePerVisit',
    resultingActorStates: repeatable ? [] : [{
      schemaVersion: 1,
      placementId: draft.placementId,
      position: { kind: 'pathEnd', pathId },
      ...(draft.finalAnimation ? { animation: draft.finalAnimation } : {}),
      ...(draft.finalDirection ? { direction: draft.finalDirection } : {}),
    }],
  };
  const nextAdventure: AdventureMapV3 = {
    ...adventure,
    mapSequences: [...(adventure.mapSequences ?? []), mapSequenceDefinition],
    mapEventTriggers: [...(adventure.mapEventTriggers ?? []), trigger],
  };
  return {
    adventure: nextAdventure,
    tilemap: nextTilemap,
    sequenceId,
    triggerId,
    pathId,
  };
}

export function appendPokeDiscoverMovementRoute(
  adventure: AdventureMapV3,
  tilemap: PokeDiscoverEditableTiledMap,
  sectorId: string,
  draft: PokeDiscoverMovementRouteDraft,
) {
  ensureDraft(adventure, tilemap, sectorId, draft);
  const sequenceId = draft.sequenceId!;
  const ambient = adventure.ambientSequences.find(sequence => (
    sequence.sequenceId === sequenceId && sequence.sectorId === sectorId
  ));
  const mapSequence = (adventure.mapSequences ?? []).find(sequence => (
    sequence.sequenceId === sequenceId && sequence.sectorId === sectorId
  ));
  if (!ambient && !mapSequence) throw new Error('La secuencia elegida ya no existe.');
  const beats = (ambient ?? mapSequence)!.beats;
  const beatId = nextBeatId(sequenceId, beats.map(beat => beat.beatId));
  const pathId = nextPathId(sequenceId, tilemap);
  const path = addPath(tilemap, pathId, draft.points);
  if (ambient) {
    const nextBeat: AmbientBeatV1 = {
      schemaVersion: 1,
      beatId,
      actions: [{
        kind: 'movePath',
        placementId: draft.placementId,
        pathId,
        movementStyle: 'grid',
        speedPixelsPerSecond: Math.max(1, draft.speedPixelsPerSecond),
        ...(draft.movementAnimation ? { animation: draft.movementAnimation } : {}),
      }],
      pauseAfterMs: Math.max(0, draft.pauseAfterMoveMs ?? 0),
    };
    const finalBeat: AmbientBeatV1 | undefined = draft.finalAnimation
      ? {
        schemaVersion: 1,
        beatId: nextBeatId(sequenceId, [...beats.map(beat => beat.beatId), beatId]),
        actions: [{
          kind: 'playAnimation',
          placementId: draft.placementId,
          animation: draft.finalAnimation,
          ...(draft.finalDirection ? { direction: draft.finalDirection } : {}),
        }],
        pauseAfterMs: 0,
      }
      : draft.finalDirection
        ? {
          schemaVersion: 1,
          beatId: nextBeatId(sequenceId, [...beats.map(beat => beat.beatId), beatId]),
          actions: [{
            kind: 'face',
            placementId: draft.placementId,
            direction: draft.finalDirection,
          }],
          pauseAfterMs: 0,
        }
        : undefined;
    const nextSequence: AmbientSequenceV3 = {
      ...ambient,
      beats: [...ambient.beats, nextBeat, ...(finalBeat ? [finalBeat] : [])],
    };
    const nextAdventure: AdventureMapV3 = {
      ...adventure,
      ambientSequences: adventure.ambientSequences.map(sequence => (
        sequence.sequenceId === sequenceId ? nextSequence : sequence
      )),
    };
    return {
      adventure: nextAdventure,
      tilemap: path.tilemap,
      sequenceId,
      pathId,
      objectId: path.object.id,
    };
  }
  const eventTrigger = (adventure.mapEventTriggers ?? [])
    .find(trigger => trigger.sequenceId === sequenceId);
  const routeBeat: MapSequenceBeatV1 = {
    schemaVersion: 1,
    beatId,
    actions: [{
      kind: 'movePath',
      actorRef: draft.placementId,
      pathId,
      movementStyle: 'grid',
      speedPixelsPerSecond: Math.max(1, draft.speedPixelsPerSecond),
      ...(draft.movementAnimation ? { animation: draft.movementAnimation } : {}),
    }],
    pauseAfterMs: Math.max(0, draft.pauseAfterMoveMs ?? 0),
  };
  const finalBeat: MapSequenceBeatV1 | undefined = draft.finalAnimation
    ? {
      schemaVersion: 1,
      beatId: nextBeatId(sequenceId, [...beats.map(beat => beat.beatId), beatId]),
      actions: [{
        kind: 'playAnimation',
        actorRef: draft.placementId,
        animation: draft.finalAnimation,
      }],
      pauseAfterMs: 0,
    }
    : draft.finalDirection
      ? {
        schemaVersion: 1,
        beatId: nextBeatId(sequenceId, [...beats.map(beat => beat.beatId), beatId]),
        actions: [{
          kind: 'face',
          actorRef: draft.placementId,
          direction: draft.finalDirection,
        }],
        pauseAfterMs: 0,
      }
      : undefined;
  let nextMapBeats = [...mapSequence!.beats, routeBeat, ...(finalBeat ? [finalBeat] : [])];
  if (eventTrigger?.repeatPolicy === 'repeatable') {
    const firstReverse = mapSequence!.beats.findIndex(beat => beat.actions.some(action => (
      action.kind === 'movePath' && action.reverse
    )));
    let outboundEnd = firstReverse < 0 ? mapSequence!.beats.length : firstReverse;
    while (outboundEnd > 0 && !mapSequence!.beats[outboundEnd - 1].actions.some(
      action => action.kind === 'movePath',
    )) {
      outboundEnd -= 1;
    }
    const reverseBeatId = nextBeatId(sequenceId, [
      ...beats.map(beat => beat.beatId),
      beatId,
      ...(finalBeat ? [finalBeat.beatId] : []),
    ]);
    const reverseBeat: MapSequenceBeatV1 = {
      schemaVersion: 1,
      beatId: reverseBeatId,
      actions: [{
        kind: 'movePath',
        actorRef: draft.placementId,
        pathId,
        movementStyle: 'grid',
        speedPixelsPerSecond: Math.max(1, draft.speedPixelsPerSecond),
        reverse: true,
        ...(draft.movementAnimation ? { animation: draft.movementAnimation } : {}),
      }],
      pauseAfterMs: 0,
    };
    nextMapBeats = [
      ...mapSequence!.beats.slice(0, outboundEnd),
      routeBeat,
      ...(finalBeat ? [finalBeat] : []),
      reverseBeat,
      ...mapSequence!.beats.slice(outboundEnd),
    ];
  }
  const nextAdventure: AdventureMapV3 = {
    ...adventure,
    mapSequences: (adventure.mapSequences ?? []).map(sequence => sequence.sequenceId === sequenceId
      ? {
        ...sequence,
        beats: nextMapBeats,
      }
      : sequence),
    mapEventTriggers: (adventure.mapEventTriggers ?? []).map(trigger => trigger.sequenceId === sequenceId
      ? trigger.repeatPolicy === 'repeatable'
        ? trigger
        : {
        ...trigger,
        resultingActorStates: trigger.resultingActorStates.some(state => state.placementId === draft.placementId)
          ? trigger.resultingActorStates.map(state => state.placementId === draft.placementId
            ? {
              ...state,
              position: { kind: 'pathEnd', pathId },
              ...(draft.finalAnimation ? { animation: draft.finalAnimation } : {}),
              ...(draft.finalDirection ? { direction: draft.finalDirection } : {}),
            }
            : state)
          : [...trigger.resultingActorStates, {
            schemaVersion: 1,
            placementId: draft.placementId,
            position: { kind: 'pathEnd', pathId },
            ...(draft.finalAnimation ? { animation: draft.finalAnimation } : {}),
            ...(draft.finalDirection ? { direction: draft.finalDirection } : {}),
          }],
        }
      : trigger),
  };
  return {
    adventure: nextAdventure,
    tilemap: path.tilemap,
    sequenceId,
    pathId,
    objectId: path.object.id,
  };
}

export function linkedPokeDiscoverMovementSequences(
  adventure: AdventureMapV3,
  sectorId: string,
  placementId: string,
) {
  const ambient = adventure.ambientSequences.filter(sequence => (
    sequence.sectorId === sectorId
    && sequence.beats.some(beat => beat.actions.some(action => action.placementId === placementId))
  )).map(sequence => ({ sequenceId: sequence.sequenceId, kind: 'ambient' as const }));
  const events = (adventure.mapSequences ?? []).filter(sequence => (
    sequence.sectorId === sectorId
    && sequence.beats.some(beat => beat.actions.some(action => action.actorRef === placementId))
  )).map(sequence => ({ sequenceId: sequence.sequenceId, kind: 'event' as const }));
  return [...ambient, ...events];
}

export function lastPokeDiscoverMovementPoint(
  adventure: AdventureMapV3,
  tilemap: PokeDiscoverEditableTiledMap,
  sequenceId: string,
  placementId: string,
) {
  const ambient = adventure.ambientSequences.find(sequence => sequence.sequenceId === sequenceId);
  const mapSequence = (adventure.mapSequences ?? []).find(sequence => sequence.sequenceId === sequenceId);
  const pathIds = ambient
    ? ambient.beats.flatMap(beat => beat.actions.flatMap(action => (
      action.kind === 'movePath' && action.placementId === placementId
        ? [action.pathId]
        : []
    )))
    : mapSequence?.beats.flatMap(beat => beat.actions.flatMap(action => (
      action.kind === 'movePath' && action.actorRef === placementId && !action.reverse
        ? [action.pathId]
        : []
    ))) ?? [];
  const pathId = pathIds.at(-1);
  if (!pathId) return undefined;
  const object = tilemap.layers.flatMap(layer => Array.isArray(layer.objects) ? layer.objects : [])
    .find(candidate => candidate.name === pathId);
  const point = object?.polyline?.at(-1);
  if (!object || !point) return undefined;
  return { x: Number(object.x) + Number(point.x), y: Number(object.y) + Number(point.y) };
}

export function listPokeDiscoverMovementPaths(
  adventure: AdventureMapV3,
  sequenceId: string,
  placementId: string,
) {
  const ambient = adventure.ambientSequences.find(sequence => sequence.sequenceId === sequenceId);
  if (ambient) return ambient.beats.flatMap(beat => beat.actions.flatMap(action => (
    action.kind === 'movePath' && action.placementId === placementId
      ? [{ beatId: beat.beatId, pathId: action.pathId }]
      : []
  )));
  const sequence = (adventure.mapSequences ?? []).find(candidate => candidate.sequenceId === sequenceId);
  return sequence?.beats.flatMap(beat => beat.actions.flatMap(action => (
    action.kind === 'movePath' && action.actorRef === placementId && !action.reverse
      ? [{ beatId: beat.beatId, pathId: action.pathId }]
      : []
  ))) ?? [];
}

export function movePokeDiscoverMovementPath(
  adventure: AdventureMapV3,
  sequenceId: string,
  pathId: string,
  delta: -1 | 1,
) {
  const reorder = <Beat extends { actions: Array<{ kind: string; pathId?: string }> }>(
    beats: Beat[],
  ) => {
    const routeIndexes = beats.flatMap((beat, index) => (
      beat.actions.some(action => action.kind === 'movePath' && action.pathId === pathId)
        ? [index]
        : []
    ));
    const source = routeIndexes[0];
    if (source === undefined) return beats;
    const allRoutes = beats.flatMap((beat, index) => (
      beat.actions.some(action => action.kind === 'movePath') ? [index] : []
    ));
    const routePosition = allRoutes.indexOf(source);
    const target = allRoutes[routePosition + delta];
    if (target === undefined) return beats;
    const next = [...beats];
    [next[source], next[target]] = [next[target], next[source]];
    return next;
  };
  if (adventure.ambientSequences.some(sequence => sequence.sequenceId === sequenceId)) {
    return {
      ...adventure,
      ambientSequences: adventure.ambientSequences.map(sequence => sequence.sequenceId === sequenceId
        ? { ...sequence, beats: reorder(sequence.beats) }
        : sequence),
    };
  }
  return {
    ...adventure,
    mapSequences: (adventure.mapSequences ?? []).map(sequence => sequence.sequenceId === sequenceId
      ? { ...sequence, beats: reorder(sequence.beats) }
      : sequence),
  };
}
