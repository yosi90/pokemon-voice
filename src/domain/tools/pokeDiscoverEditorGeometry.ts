import type {
  AdventureEntryPointV3,
  AdventureMapV3,
  AdventureMissionEntryPointV1,
  TiledAnchorClass,
} from '../../../packages/contracts/src/index.js';
import {
  addPokeDiscoverTiledObject,
  type PokeDiscoverEditableTiledMap,
  type PokeDiscoverWorldFile,
} from './pokeDiscoverEditorProject.js';

export type PokeDiscoverAnchorKind = TiledAnchorClass;

export type PokeDiscoverWorldEdge = 'left' | 'right' | 'top' | 'bottom';

export interface PokeDiscoverGeometryPoint {
  x: number;
  y: number;
}

export interface PokeDiscoverEditorRoomDocument {
  fileName: string;
  sectorId: string;
  tilemap: PokeDiscoverEditableTiledMap;
}

function objectNames(tilemap: PokeDiscoverEditableTiledMap) {
  return new Set(tilemap.layers.flatMap(layer => Array.isArray(layer.objects)
    ? (layer.objects as Array<Record<string, unknown>>)
      .map(object => String(object.name ?? '').trim()).filter(Boolean)
    : []));
}

function nextOrdinalObjectName(prefix: string, used: Set<string>) {
  for (let ordinal = 1; ordinal <= 9999; ordinal += 1) {
    const candidate = `${prefix}:${String(ordinal).padStart(2, '0')}`;
    if (!used.has(candidate)) return candidate;
  }
  throw new Error(`No quedan ordinales disponibles para ${prefix}.`);
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

/**
 * Primitiva interna para recetas funcionales. El nombre ya debe proceder de
 * una definición sidecar; esta función no inventa nombres ni resuelve
 * duplicados silenciosamente.
 */
export function addPokeDiscoverFunctionalAnchor(
  tilemap: PokeDiscoverEditableTiledMap,
  request: {
    kind: PokeDiscoverAnchorKind;
    name: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
  },
) {
  const name = request.name.trim();
  if (!/^[a-z0-9][a-z0-9-]*(?::[a-z0-9][a-z0-9-]*)+$/u.test(name)) {
    throw new Error(`El ID técnico no cumple la convención: ${name || '(vacío)'}.`);
  }
  if (objectNames(tilemap).has(name)) {
    throw new Error(`Ya existe un objeto TMJ con el ID ${name}.`);
  }
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
) {
  const geometry = normalizedRectangle(start, end);
  if (geometry.width <= 0 || geometry.height <= 0) {
    throw new Error('La colisión necesita anchura y altura.');
  }
  const name = nextOrdinalObjectName('collision', objectNames(tilemap));
  return addPokeDiscoverTiledObject(tilemap, 'Collision', {
    name,
    class: 'Collision',
    ...geometry,
  });
}

export function addPokeDiscoverCollisionPolygon(
  tilemap: PokeDiscoverEditableTiledMap,
  points: PokeDiscoverGeometryPoint[],
) {
  const name = nextOrdinalObjectName('collision', objectNames(tilemap));
  return addPokeDiscoverTiledObject(tilemap, 'Collision', {
    name,
    class: 'Collision',
    ...polygonGeometry(points),
  });
}

export function addPokeDiscoverRoamAreaRectangle(
  tilemap: PokeDiscoverEditableTiledMap,
  sectorId: string,
  start: PokeDiscoverGeometryPoint,
  end: PokeDiscoverGeometryPoint,
) {
  const geometry = normalizedRectangle(start, end);
  if (geometry.width < tilemap.tilewidth || geometry.height < tilemap.tileheight) {
    throw new Error('El área de roaming debe cubrir al menos un tile completo.');
  }
  const name = nextOrdinalObjectName(`roam-area:${sectorId.replace(/^sector:/u, '').replaceAll(':', '-')}`, objectNames(tilemap));
  return addPokeDiscoverTiledObject(tilemap, 'Roaming', {
    name,
    class: 'RoamArea',
    ...geometry,
  });
}

export function addPokeDiscoverRoamAreaPolygon(
  tilemap: PokeDiscoverEditableTiledMap,
  sectorId: string,
  points: PokeDiscoverGeometryPoint[],
) {
  const name = nextOrdinalObjectName(`roam-area:${sectorId.replace(/^sector:/u, '').replaceAll(':', '-')}`, objectNames(tilemap));
  return addPokeDiscoverTiledObject(tilemap, 'Roaming', {
    name,
    class: 'RoamArea',
    ...polygonGeometry(points),
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
  adventure: AdventureMapV3,
  sectorId: string,
  anchorId: string,
) {
  return {
    ...adventure,
    sectors: adventure.sectors.map(sector => sector.sectorId === sectorId
      ? { ...sector, spawnAnchorIds: [...new Set([...sector.spawnAnchorIds, anchorId])] }
      : sector),
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
  adventure: AdventureMapV3;
  source: PokeDiscoverEditorRoomDocument;
  target: PokeDiscoverEditorRoomDocument;
  sourceEdge: PokeDiscoverWorldEdge;
  sourceStart: number;
  targetStart?: number;
  length: number;
}) {
  const sourceBounds = edgeRectangle(source.tilemap, sourceEdge, sourceStart, length);
  const targetEdge = oppositeEdge(sourceEdge);
  const targetBounds = edgeRectangle(target.tilemap, targetEdge, targetStart, length);
  const transitionIds = new Set(adventure.transitions.map(transition => transition.transitionId));
  const forwardId = nextOrdinalObjectName('transition', transitionIds);
  transitionIds.add(forwardId);
  const backwardId = nextOrdinalObjectName('transition', transitionIds);
  const sourceOutbound = addPokeDiscoverTiledObject(source.tilemap, 'Anchors', {
    name: `${forwardId}:from`,
    class: 'TransitionAnchor',
    ...sourceBounds,
  });
  const sourceInbound = addPokeDiscoverTiledObject(sourceOutbound.tilemap, 'Anchors', {
    name: `${backwardId}:to`,
    class: 'TransitionAnchor',
    ...sourceBounds,
  });
  const targetInbound = addPokeDiscoverTiledObject(target.tilemap, 'Anchors', {
    name: `${forwardId}:to`,
    class: 'TransitionAnchor',
    ...targetBounds,
  });
  const targetOutbound = addPokeDiscoverTiledObject(targetInbound.tilemap, 'Anchors', {
    name: `${backwardId}:from`,
    class: 'TransitionAnchor',
    ...targetBounds,
  });
  let nextAdventure = updateRoomSpawn(adventure, source.sectorId, sourceOutbound.object.name);
  nextAdventure = updateRoomSpawn(nextAdventure, source.sectorId, sourceInbound.object.name);
  nextAdventure = updateRoomSpawn(nextAdventure, target.sectorId, targetInbound.object.name);
  nextAdventure = updateRoomSpawn(nextAdventure, target.sectorId, targetOutbound.object.name);
  nextAdventure = {
    ...nextAdventure,
    transitions: [
      ...nextAdventure.transitions,
      {
        schemaVersion: 1,
        transitionId: forwardId,
        kind: 'edge',
        fromSectorId: source.sectorId,
        fromAnchorId: sourceOutbound.object.name,
        toSectorId: target.sectorId,
        toAnchorId: targetInbound.object.name,
        destinationFacing: facingForEdge(sourceEdge),
      },
      {
        schemaVersion: 1,
        transitionId: backwardId,
        kind: 'edge',
        fromSectorId: target.sectorId,
        fromAnchorId: targetOutbound.object.name,
        toSectorId: source.sectorId,
        toAnchorId: sourceInbound.object.name,
        destinationFacing: facingForEdge(targetEdge),
      },
    ],
  };
  return {
    adventure: nextAdventure,
    sourceTilemap: sourceInbound.tilemap,
    targetTilemap: targetOutbound.tilemap,
    sourceAnchorId: sourceOutbound.object.name,
    targetAnchorId: targetInbound.object.name,
  };
}

export function upsertPokeDiscoverEntryPoint(
  adventure: AdventureMapV3,
  entryPoint: AdventureEntryPointV3,
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
  adventure: AdventureMapV3,
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
  adventure: AdventureMapV3,
  request: { missionId?: string; freeExpedition?: boolean },
) {
  const entryPointId = request.missionId
    ? adventure.missionEntryPoints?.find(item => item.missionId === request.missionId)?.entryPointId
    : request.freeExpedition ? adventure.freeExpeditionEntryPointId : undefined;
  return adventure.entryPoints?.find(entry => entry.entryPointId === entryPointId);
}

export function findPokeDiscoverGeometryReferences(
  adventure: AdventureMapV3,
  objectName: string,
) {
  const references: string[] = [];
  for (const room of adventure.sectors) {
    if (room.spawnAnchorIds.includes(objectName)) references.push(`Sector ${room.sectorId}`);
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
  for (const placement of [...adventure.actorPlacements, ...adventure.characterPlacements]) {
    if (placement.roaming?.areaId === objectName) references.push(`Roaming ${placement.placementId}`);
  }
  for (const sequence of adventure.mapSequences ?? []) {
    for (const beat of sequence.beats) {
      for (const action of beat.actions) {
        if (action.kind === 'movePath' && action.pathId === objectName) {
          references.push(`Evento ${sequence.sequenceId}`);
        }
        if (action.kind === 'moveToAnchor' && action.anchorId === objectName) {
          references.push(`Evento ${sequence.sequenceId}`);
        }
      }
    }
  }
  for (const trigger of adventure.mapEventTriggers ?? []) {
    const target = trigger.activation.kind === 'enterZone'
      ? { kind: 'zone' as const, zoneId: trigger.activation.zoneId }
      : trigger.activation.kind === 'contextAction' || trigger.activation.kind === 'proximity'
        ? trigger.activation.target
        : undefined;
    if (!target) continue;
    if (target.kind === 'zone' && target.zoneId === objectName) {
      references.push(`Evento ${trigger.triggerId}`);
    }
    for (const state of trigger.resultingActorStates) {
      if (state.position?.kind === 'anchor' && state.position.anchorId === objectName) {
        references.push(`Estado final ${trigger.triggerId}`);
      }
      if (state.position?.kind === 'pathEnd' && state.position.pathId === objectName) {
        references.push(`Estado final ${trigger.triggerId}`);
      }
    }
  }
  return [...new Set(references)];
}
