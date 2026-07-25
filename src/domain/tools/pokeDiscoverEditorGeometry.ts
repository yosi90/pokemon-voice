import type {
  AdventureEntryPointV1,
  AdventureMapV2,
  AdventureMissionEntryPointV1,
} from '../../../packages/contracts/src/index.js';
import {
  addPokeDiscoverTiledObject,
  fileStem,
  slugifyEditorLabel,
  type PokeDiscoverEditableTiledMap,
  type PokeDiscoverWorldFile,
} from './pokeDiscoverEditorProject.js';

export type PokeDiscoverAnchorKind =
  | 'PlayerSpawn'
  | 'TransitionAnchor'
  | 'ActorAnchor'
  | 'EncounterAnchor'
  | 'InteractionAnchor'
  | 'SecretAnchor';

export type PokeDiscoverWorldEdge = 'left' | 'right' | 'top' | 'bottom';

export interface PokeDiscoverGeometryPoint {
  x: number;
  y: number;
}

export interface PokeDiscoverEditorRoomDocument {
  fileName: string;
  roomId: string;
  tilemap: PokeDiscoverEditableTiledMap;
}

function objectNames(tilemap: PokeDiscoverEditableTiledMap) {
  return new Set(tilemap.layers.flatMap(layer => Array.isArray(layer.objects)
    ? (layer.objects as Array<Record<string, unknown>>)
      .map(object => String(object.name ?? '').trim()).filter(Boolean)
    : []));
}

function uniqueName(preferred: string, used: Set<string>) {
  if (!used.has(preferred)) return preferred;
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${preferred}-${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
}

function normalizedRectangle(start: PokeDiscoverGeometryPoint, end: PokeDiscoverGeometryPoint) {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

function polygonGeometry(points: PokeDiscoverGeometryPoint[]) {
  if (points.length < 3) throw new Error('Un polígono necesita al menos tres puntos.');
  const origin = points[0];
  return {
    x: origin.x,
    y: origin.y,
    width: 0,
    height: 0,
    polygon: points.map(point => ({ x: point.x - origin.x, y: point.y - origin.y })),
  };
}

function polylineGeometry(points: PokeDiscoverGeometryPoint[]) {
  if (points.length < 2) throw new Error('Una ruta necesita al menos dos puntos.');
  const origin = points[0];
  return {
    x: origin.x,
    y: origin.y,
    width: 0,
    height: 0,
    polyline: points.map(point => ({ x: point.x - origin.x, y: point.y - origin.y })),
  };
}

export function addPokeDiscoverAnchor(
  tilemap: PokeDiscoverEditableTiledMap,
  request: {
    kind: PokeDiscoverAnchorKind;
    label: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
  },
) {
  const preferred = `anchor:${slugifyEditorLabel(request.label)}`;
  const name = uniqueName(preferred, objectNames(tilemap));
  const rectangle = (request.width ?? 0) > 0 && (request.height ?? 0) > 0;
  return addPokeDiscoverTiledObject(tilemap, 'Anchors', {
    name,
    class: request.kind,
    x: request.x,
    y: request.y,
    width: Math.max(0, request.width ?? 0),
    height: Math.max(0, request.height ?? 0),
    ...(rectangle ? {} : { point: true }),
  });
}

export function addPokeDiscoverCollisionRectangle(
  tilemap: PokeDiscoverEditableTiledMap,
  start: PokeDiscoverGeometryPoint,
  end: PokeDiscoverGeometryPoint,
  label = '',
) {
  const geometry = normalizedRectangle(start, end);
  if (geometry.width <= 0 || geometry.height <= 0) {
    throw new Error('La colisión necesita anchura y altura.');
  }
  const preferred = label.trim() ? `collision:${slugifyEditorLabel(label)}` : '';
  const name = preferred ? uniqueName(preferred, objectNames(tilemap)) : '';
  return addPokeDiscoverTiledObject(tilemap, 'Collision', {
    name,
    class: 'Collision',
    ...geometry,
  });
}

export function addPokeDiscoverCollisionPolygon(
  tilemap: PokeDiscoverEditableTiledMap,
  points: PokeDiscoverGeometryPoint[],
  label = '',
) {
  const preferred = label.trim() ? `collision:${slugifyEditorLabel(label)}` : '';
  const name = preferred ? uniqueName(preferred, objectNames(tilemap)) : '';
  return addPokeDiscoverTiledObject(tilemap, 'Collision', {
    name,
    class: 'Collision',
    ...polygonGeometry(points),
  });
}

export function addPokeDiscoverPath(
  tilemap: PokeDiscoverEditableTiledMap,
  points: PokeDiscoverGeometryPoint[],
  label: string,
) {
  const name = uniqueName(`path:${slugifyEditorLabel(label)}`, objectNames(tilemap));
  return addPokeDiscoverTiledObject(tilemap, 'Paths', {
    name,
    class: 'AmbientPath',
    ...polylineGeometry(points),
  });
}

export function addPokeDiscoverOccluder(
  tilemap: PokeDiscoverEditableTiledMap,
  request: {
    label: string;
    groupId: string;
    start?: PokeDiscoverGeometryPoint;
    end?: PokeDiscoverGeometryPoint;
    points?: PokeDiscoverGeometryPoint[];
    includePlacementIds?: string[];
    excludePlacementIds?: string[];
  },
) {
  const name = uniqueName(`occluder:${slugifyEditorLabel(request.label)}`, objectNames(tilemap));
  const geometry = request.points
    ? polygonGeometry(request.points)
    : normalizedRectangle(request.start ?? { x: 0, y: 0 }, request.end ?? { x: 0, y: 0 });
  if (!request.points && (geometry.width <= 0 || geometry.height <= 0)) {
    throw new Error('La oclusión necesita anchura y altura.');
  }
  const properties: Array<Record<string, unknown>> = [{
    name: 'occlusionGroup',
    type: 'string',
    value: request.groupId,
  }];
  if (request.includePlacementIds?.length) properties.push({
    name: 'includePlacementIds',
    type: 'string',
    value: request.includePlacementIds.join(','),
  });
  if (request.excludePlacementIds?.length) properties.push({
    name: 'excludePlacementIds',
    type: 'string',
    value: request.excludePlacementIds.join(','),
  });
  return addPokeDiscoverTiledObject(tilemap, 'Occlusion', {
    name,
    class: 'ActorOccluder',
    ...geometry,
    properties,
  });
}

export function movePokeDiscoverWorldMap(
  world: PokeDiscoverWorldFile,
  fileName: string,
  position: { x: number; y: number },
) {
  let found = false;
  const maps = world.maps.map(entry => {
    if (entry.fileName !== fileName) return entry;
    found = true;
    return { ...entry, x: position.x, y: position.y };
  });
  if (!found) throw new Error(`El mundo no contiene ${fileName}.`);
  return { ...world, maps };
}

function edgeRectangle(
  tilemap: PokeDiscoverEditableTiledMap,
  edge: PokeDiscoverWorldEdge,
  start: number,
  length: number,
) {
  const mapWidth = tilemap.width * tilemap.tilewidth;
  const mapHeight = tilemap.height * tilemap.tileheight;
  const thickness = tilemap.tilewidth;
  if (edge === 'left') return { x: 0, y: start, width: thickness, height: length };
  if (edge === 'right') return { x: mapWidth - thickness, y: start, width: thickness, height: length };
  if (edge === 'top') return { x: start, y: 0, width: length, height: thickness };
  return { x: start, y: mapHeight - thickness, width: length, height: thickness };
}

function oppositeEdge(edge: PokeDiscoverWorldEdge): PokeDiscoverWorldEdge {
  if (edge === 'left') return 'right';
  if (edge === 'right') return 'left';
  if (edge === 'top') return 'bottom';
  return 'top';
}

function facingForEdge(edge: PokeDiscoverWorldEdge) {
  if (edge === 'left') return 'left' as const;
  if (edge === 'right') return 'right' as const;
  if (edge === 'top') return 'up' as const;
  return 'down' as const;
}

function updateRoomSpawn(
  adventure: AdventureMapV2,
  roomId: string,
  anchorId: string,
) {
  return {
    ...adventure,
    rooms: adventure.rooms.map(room => room.roomId === roomId
      ? { ...room, spawnAnchorIds: [...new Set([...room.spawnAnchorIds, anchorId])] }
      : room),
  };
}

export function connectPokeDiscoverRoomsBidirectionally({
  adventure,
  source,
  target,
  sourceEdge,
  sourceStart,
  targetStart = sourceStart,
  length,
}: {
  adventure: AdventureMapV2;
  source: PokeDiscoverEditorRoomDocument;
  target: PokeDiscoverEditorRoomDocument;
  sourceEdge: PokeDiscoverWorldEdge;
  sourceStart: number;
  targetStart?: number;
  length: number;
}) {
  const sourceSuffix = slugifyEditorLabel(fileStem(source.fileName));
  const targetSuffix = slugifyEditorLabel(fileStem(target.fileName));
  const sourceBounds = edgeRectangle(source.tilemap, sourceEdge, sourceStart, length);
  const targetEdge = oppositeEdge(sourceEdge);
  const targetBounds = edgeRectangle(target.tilemap, targetEdge, targetStart, length);
  const sourceAnchor = addPokeDiscoverTiledObject(source.tilemap, 'Anchors', {
    name: uniqueName(`anchor:transition:${sourceSuffix}:to:${targetSuffix}`, objectNames(source.tilemap)),
    class: 'TransitionAnchor',
    ...sourceBounds,
  });
  const targetAnchor = addPokeDiscoverTiledObject(target.tilemap, 'Anchors', {
    name: uniqueName(`anchor:transition:${targetSuffix}:to:${sourceSuffix}`, objectNames(target.tilemap)),
    class: 'TransitionAnchor',
    ...targetBounds,
  });
  let nextAdventure = updateRoomSpawn(adventure, source.roomId, sourceAnchor.object.name);
  nextAdventure = updateRoomSpawn(nextAdventure, target.roomId, targetAnchor.object.name);
  const transitionIds = new Set(nextAdventure.transitions.map(transition => transition.transitionId));
  const forwardId = uniqueName(`transition:${sourceSuffix}:to:${targetSuffix}`, transitionIds);
  transitionIds.add(forwardId);
  const backwardId = uniqueName(`transition:${targetSuffix}:to:${sourceSuffix}`, transitionIds);
  nextAdventure = {
    ...nextAdventure,
    transitions: [
      ...nextAdventure.transitions,
      {
        schemaVersion: 1,
        transitionId: forwardId,
        kind: 'edge',
        fromRoomId: source.roomId,
        fromAnchorId: sourceAnchor.object.name,
        toRoomId: target.roomId,
        toAnchorId: targetAnchor.object.name,
        destinationFacing: facingForEdge(sourceEdge),
      },
      {
        schemaVersion: 1,
        transitionId: backwardId,
        kind: 'edge',
        fromRoomId: target.roomId,
        fromAnchorId: targetAnchor.object.name,
        toRoomId: source.roomId,
        toAnchorId: sourceAnchor.object.name,
        destinationFacing: facingForEdge(targetEdge),
      },
    ],
  };
  return {
    adventure: nextAdventure,
    sourceTilemap: sourceAnchor.tilemap,
    targetTilemap: targetAnchor.tilemap,
    sourceAnchorId: sourceAnchor.object.name,
    targetAnchorId: targetAnchor.object.name,
  };
}

export function upsertPokeDiscoverEntryPoint(
  adventure: AdventureMapV2,
  entryPoint: AdventureEntryPointV1,
) {
  const entries = adventure.entryPoints ?? [];
  return {
    ...adventure,
    entryPoints: entries.some(entry => entry.entryPointId === entryPoint.entryPointId)
      ? entries.map(entry => entry.entryPointId === entryPoint.entryPointId ? entryPoint : entry)
      : [...entries, entryPoint],
  };
}

export function assignPokeDiscoverMissionEntry(
  adventure: AdventureMapV2,
  assignment: AdventureMissionEntryPointV1,
) {
  const assignments = adventure.missionEntryPoints ?? [];
  return {
    ...adventure,
    missionEntryPoints: assignments.some(item => item.missionId === assignment.missionId)
      ? assignments.map(item => item.missionId === assignment.missionId ? assignment : item)
      : [...assignments, assignment],
  };
}

export function resolvePokeDiscoverEntryPoint(
  adventure: AdventureMapV2,
  request: { missionId?: string; freeExpedition?: boolean },
) {
  const entryPointId = request.missionId
    ? adventure.missionEntryPoints?.find(item => item.missionId === request.missionId)?.entryPointId
    : request.freeExpedition ? adventure.freeExpeditionEntryPointId : undefined;
  return adventure.entryPoints?.find(entry => entry.entryPointId === entryPointId);
}

export function findPokeDiscoverGeometryReferences(
  adventure: AdventureMapV2,
  objectName: string,
) {
  const references: string[] = [];
  for (const room of adventure.rooms) {
    if (room.spawnAnchorIds.includes(objectName)) references.push(`Habitación ${room.roomId}`);
  }
  for (const placement of [...adventure.actorPlacements, ...adventure.characterPlacements]) {
    if (placement.anchorId === objectName) references.push(`Colocación ${placement.placementId}`);
  }
  for (const transition of adventure.transitions) {
    if (transition.fromAnchorId === objectName || transition.toAnchorId === objectName) {
      references.push(`Conexión ${transition.transitionId}`);
    }
  }
  for (const interaction of adventure.interactions ?? []) {
    if (interaction.target.kind === 'anchor' && interaction.target.anchorId === objectName) {
      references.push(`Interacción ${interaction.interactionId}`);
    }
  }
  for (const entry of adventure.entryPoints ?? []) {
    if (entry.anchorId === objectName) references.push(`Entrada ${entry.label}`);
  }
  for (const sequence of adventure.ambientSequences) {
    for (const beat of sequence.beats) {
      for (const action of beat.actions) {
        if (action.kind === 'movePath' && action.pathId === objectName) {
          references.push(`Escena ${sequence.sequenceId}`);
        }
      }
    }
  }
  return [...new Set(references)];
}
