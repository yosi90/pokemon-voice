import type { LoadedTiledMap } from '../maps/loadAdventureBundle.js';
import { transformTiledObjectPoint } from '../maps/tiledObjectTransform.js';

export interface PokeDiscoverEditorPathReference {
  pathId: string;
  pointCount: number;
  start: { x: number; y: number };
  end: { x: number; y: number };
}

export interface PokeDiscoverEditorOcclusionReference {
  groupId: string;
  occluderIds: string[];
  shapes: Array<'rectangle' | 'polygon'>;
}

export interface PokeDiscoverEditorTiledReferences {
  paths: PokeDiscoverEditorPathReference[];
  occlusionGroups: PokeDiscoverEditorOcclusionReference[];
}

export type PokeDiscoverEditorAnchorClass =
  | 'PlayerSpawn'
  | 'TransitionAnchor'
  | 'ActorAnchor'
  | 'EncounterAnchor'
  | 'InteractionAnchor'
  | 'SecretAnchor';

export interface PokeDiscoverEditorAnchorReference {
  anchorId: string;
  anchorClass: PokeDiscoverEditorAnchorClass;
  x: number;
  y: number;
}

const ANCHOR_CLASSES = new Set<PokeDiscoverEditorAnchorClass>([
  'PlayerSpawn', 'TransitionAnchor', 'ActorAnchor', 'EncounterAnchor', 'InteractionAnchor', 'SecretAnchor',
]);

function layerObjects(tilemap: LoadedTiledMap, layerName: string) {
  const layer = tilemap.layers.find(candidate => candidate.name === layerName && candidate.type === 'objectgroup');
  return Array.isArray(layer?.objects) ? layer.objects as Array<Record<string, unknown>> : [];
}

function objectClass(object: Record<string, unknown>) {
  return String(object.class || object.type || '');
}

function objectProperties(object: Record<string, unknown>) {
  const properties = Array.isArray(object.properties)
    ? object.properties as Array<Record<string, unknown>>
    : [];
  return new Map(properties.map(property => [String(property.name), property.value]));
}

export function readPokeDiscoverEditorTiledReferences(
  tilemap: LoadedTiledMap,
): PokeDiscoverEditorTiledReferences {
  const paths = layerObjects(tilemap, 'Paths').flatMap(object => {
    const pathId = String(object.name ?? '').trim();
    const polyline = Array.isArray(object.polyline)
      ? object.polyline as Array<Record<string, unknown>>
      : [];
    if (!pathId || objectClass(object) !== 'AmbientPath' || polyline.length < 2) return [];
    const points = polyline.map(point => transformTiledObjectPoint(object, {
      x: Number(point.x) || 0,
      y: Number(point.y) || 0,
    }));
    return [{ pathId, pointCount: points.length, start: points[0], end: points.at(-1)! }];
  });

  const groups = new Map<string, PokeDiscoverEditorOcclusionReference>();
  for (const object of layerObjects(tilemap, 'Occlusion')) {
    const occluderId = String(object.name ?? '').trim();
    const groupId = String(objectProperties(object).get('occlusionGroup') ?? '').trim();
    if (!occluderId || !groupId || objectClass(object) !== 'ActorOccluder') continue;
    const reference = groups.get(groupId) ?? { groupId, occluderIds: [], shapes: [] };
    reference.occluderIds.push(occluderId);
    reference.shapes.push(Array.isArray(object.polygon) ? 'polygon' : 'rectangle');
    groups.set(groupId, reference);
  }

  return { paths, occlusionGroups: [...groups.values()] };
}

export function readPokeDiscoverEditorAnchors(tilemap: LoadedTiledMap): PokeDiscoverEditorAnchorReference[] {
  return layerObjects(tilemap, 'Anchors').flatMap(object => {
    const anchorId = String(object.name ?? '').trim();
    const anchorClass = objectClass(object) as PokeDiscoverEditorAnchorClass;
    if (!anchorId || !ANCHOR_CLASSES.has(anchorClass)) return [];
    const width = Math.max(0, Number(object.width) || 0);
    const height = Math.max(0, Number(object.height) || 0);
    const point = transformTiledObjectPoint(object, { x: width / 2, y: height });
    return [{ anchorId, anchorClass, ...point }];
  });
}
