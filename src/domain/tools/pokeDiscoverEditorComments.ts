import {
  addPokeDiscoverTiledObject,
  removePokeDiscoverTiledObject,
  updatePokeDiscoverTiledObject,
  type PokeDiscoverEditableTiledMap,
  type PokeDiscoverTiledObject,
} from './pokeDiscoverEditorProject.js';

export const POKEDISCOVER_EDITOR_COMMENT_CLASS = 'EditorComment';
export const DEFAULT_MIGRATION_COMMENT = 'Ancla eliminada durante la migración';

export function defaultPokeDiscoverMigrationComment({
  layerName,
  className,
  objectName,
}: {
  layerName?: string;
  className?: string;
  objectName?: string;
}) {
  let message: string;
  if (layerName === 'Collision' || className === 'Collision') {
    message = 'Colisión eliminada durante la migración';
  } else if (layerName === 'Paths' || className === 'AmbientPath') {
    message = 'Ruta eliminada durante la migración';
  } else if (layerName === 'Occlusion' || className === 'ActorOccluder') {
    message = 'Oclusión eliminada durante la migración';
  } else if (layerName === 'Triggers' || className === 'TriggerZone') {
    message = 'Zona de evento eliminada durante la migración';
  } else if (layerName === 'Comments' || className === 'EditorComment') {
    message = 'Comentario eliminado durante la migración';
  } else if (layerName === 'Anchors' || className?.endsWith('Anchor')) {
    message = 'Ancla eliminada durante la migración';
  } else {
    message = 'Elemento eliminado durante la migración';
  }
  const normalizedName = objectName?.trim();
  return normalizedName ? `${message}\n${normalizedName}` : message;
}

function objectClass(object: PokeDiscoverTiledObject) {
  return String(object.class || object.type || '');
}

function property(
  name: string,
  value: string | number,
  type: 'string' | 'int' = 'string',
) {
  return { name, type, value };
}

function commentOrdinal(tilemap: PokeDiscoverEditableTiledMap) {
  const objects = (tilemap.layers.find(layer => layer.name === 'Comments')?.objects
    ?? []) as PokeDiscoverTiledObject[];
  const used = new Set(objects
    .map(object => String(object.name ?? '')));
  for (let ordinal = 1; ordinal <= 9999; ordinal += 1) {
    const name = `comment:${String(ordinal).padStart(2, '0')}`;
    if (!used.has(name)) return name;
  }
  throw new Error('No quedan identificadores disponibles para comentarios.');
}

export function isPokeDiscoverEditorComment(object: PokeDiscoverTiledObject) {
  return objectClass(object) === POKEDISCOVER_EDITOR_COMMENT_CLASS;
}

export function readPokeDiscoverEditorCommentText(object: PokeDiscoverTiledObject) {
  const text = object.properties?.find(candidate => candidate.name === 'text')?.value;
  return typeof text === 'string' ? text : '';
}

export function addPokeDiscoverEditorComment(
  tilemap: PokeDiscoverEditableTiledMap,
  request: {
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation?: number;
    polygon?: Array<{ x: number; y: number }>;
    migrationSource?: {
      objectId: number;
      name: string;
      className: string;
    };
  },
) {
  const text = request.text.trim();
  if (!text) throw new Error('El comentario necesita texto.');
  const properties: Array<Record<string, unknown>> = [property('text', text)];
  if (request.migrationSource) {
    properties.push(
      property('migrationSourceObjectId', request.migrationSource.objectId, 'int'),
      property('migrationSourceObjectName', request.migrationSource.name),
      property('migrationSourceObjectClass', request.migrationSource.className),
    );
  }
  return addPokeDiscoverTiledObject(tilemap, 'Comments', {
    name: commentOrdinal(tilemap),
    class: POKEDISCOVER_EDITOR_COMMENT_CLASS,
    type: POKEDISCOVER_EDITOR_COMMENT_CLASS,
    x: request.x,
    y: request.y,
    width: request.width,
    height: request.height,
    rotation: request.rotation ?? 0,
    ...(request.polygon ? { polygon: request.polygon.map(point => ({ ...point })) } : {}),
    properties,
  });
}

export function replacePokeDiscoverTiledObjectWithComment(
  tilemap: PokeDiscoverEditableTiledMap,
  objectId: number,
  text?: string,
) {
  const source = tilemap.layers
    .flatMap(layer => Array.isArray(layer.objects) ? layer.objects : [])
    .find(object => object.id === objectId) as PokeDiscoverTiledObject | undefined;
  if (!source) throw new Error(`No existe el objeto Tiled #${objectId}.`);
  const commentText = text ?? defaultPokeDiscoverMigrationComment({
    className: objectClass(source),
    objectName: String(source.name ?? ''),
  });
  const withoutSource = removePokeDiscoverTiledObject(tilemap, objectId);
  const hasArea = Boolean(source.polygon?.length || (source.width > 0 && source.height > 0));
  return addPokeDiscoverEditorComment(withoutSource, {
    text: commentText,
    x: Number(source.x ?? 0) - (hasArea ? 0 : 8),
    y: Number(source.y ?? 0) - (hasArea ? 0 : 16),
    width: hasArea ? Number(source.width ?? 0) : 16,
    height: hasArea ? Number(source.height ?? 0) : 16,
    rotation: Number(source.rotation ?? 0),
    ...(source.polygon ? { polygon: source.polygon } : {}),
    migrationSource: {
      objectId: source.id,
      name: String(source.name ?? ''),
      className: objectClass(source),
    },
  });
}

export function updatePokeDiscoverEditorCommentText(
  tilemap: PokeDiscoverEditableTiledMap,
  objectId: number,
  text: string,
) {
  const normalized = text.trim();
  if (!normalized) throw new Error('El comentario necesita texto.');
  return updatePokeDiscoverTiledObject(tilemap, objectId, object => {
    if (!isPokeDiscoverEditorComment(object)) {
      throw new Error(`El objeto Tiled #${objectId} no es un comentario editorial.`);
    }
    const properties = (object.properties ?? []).filter(candidate => candidate.name !== 'text');
    return { ...object, properties: [property('text', normalized), ...properties] };
  });
}
