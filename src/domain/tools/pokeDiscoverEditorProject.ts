import type { AdventureMapV3 } from '../../../packages/contracts/src/index.js';
import type { LoadedTiledMap } from '../maps/loadAdventureBundle.js';

export type PokeDiscoverObjectLayerName =
  | 'Collision'
  | 'Anchors'
  | 'Triggers'
  | 'Paths'
  | 'Occlusion'
  | 'Comments';
export type PokeDiscoverEditableLayerName = 'Above' | PokeDiscoverObjectLayerName;

export interface PokeDiscoverTiledObject extends Record<string, unknown> {
  id: number;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  visible: boolean;
  class?: string;
  type?: string;
  point?: boolean;
  polygon?: Array<{ x: number; y: number }>;
  polyline?: Array<{ x: number; y: number }>;
  properties?: Array<Record<string, unknown>>;
}

export interface PokeDiscoverNewTiledObject extends Record<string, unknown> {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  visible?: boolean;
  class?: string;
  type?: string;
  point?: boolean;
  polygon?: Array<{ x: number; y: number }>;
  polyline?: Array<{ x: number; y: number }>;
  properties?: Array<Record<string, unknown>>;
}

export interface PokeDiscoverTiledLayer extends Record<string, unknown> {
  id: number;
  name: string;
  type: 'tilelayer' | 'objectgroup';
  visible: boolean;
  opacity: number;
  objects?: PokeDiscoverTiledObject[];
  data?: number[];
}

export type PokeDiscoverEditableTiledMap = LoadedTiledMap & {
  nextlayerid?: number;
  nextobjectid?: number;
};

export interface PokeDiscoverWorldMapEntry extends Record<string, unknown> {
  fileName: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export interface PokeDiscoverWorldFile extends Record<string, unknown> {
  type: 'world';
  maps: PokeDiscoverWorldMapEntry[];
}

export interface PokeDiscoverTiledSource {
  fileName: string;
  tilemap: PokeDiscoverEditableTiledMap;
}

export interface PokeDiscoverRoomRegistration {
  fileName: string;
  assetId: string;
  sectorId: string;
  created: boolean;
  archived?: boolean;
}

export interface PokeDiscoverPreparedMap {
  tilemap: PokeDiscoverEditableTiledMap;
  createdLayers: PokeDiscoverEditableLayerName[];
}

export interface PokeDiscoverEditorHistory<T> {
  past: T[];
  present: T;
  future: T[];
}

const REQUIRED_OBJECT_LAYERS = ['Collision', 'Anchors'] as const;

function objectClass(object: Record<string, unknown>) {
  return String(object.class || object.type || '');
}

export function fileBaseName(path: string) {
  return path.replaceAll('\\', '/').split('/').at(-1) ?? path;
}

export function fileStem(fileName: string) {
  return fileName.replace(/\.[^.]+$/u, '');
}

export function slugifyEditorLabel(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'mapa';
}

export function serializePokeDiscoverProjectJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function parsePokeDiscoverWorld(value: unknown): PokeDiscoverWorldFile {
  if (!value || typeof value !== 'object') throw new Error('El archivo .world debe contener un objeto JSON.');
  const candidate = value as Partial<PokeDiscoverWorldFile>;
  if (candidate.type !== 'world' || !Array.isArray(candidate.maps)) {
    throw new Error('El archivo seleccionado no cumple el formato world de Tiled.');
  }
  const maps = candidate.maps.map((entry, index) => {
    if (!entry || typeof entry.fileName !== 'string'
      || !Number.isFinite(entry.x) || !Number.isFinite(entry.y)) {
      throw new Error(`La posición ${index + 1} del archivo .world no es válida.`);
    }
    return { ...entry, x: Number(entry.x), y: Number(entry.y) };
  });
  return { ...candidate, type: 'world', maps } as PokeDiscoverWorldFile;
}

function nextLayerId(tilemap: PokeDiscoverEditableTiledMap) {
  const maximum = tilemap.layers.reduce((result, layer) => Math.max(result, Number(layer.id) || 0), 0);
  return Math.max(maximum + 1, Number(tilemap.nextlayerid) || 1);
}

function nextObjectId(tilemap: PokeDiscoverEditableTiledMap) {
  const maximum = tilemap.layers.flatMap(layer => Array.isArray(layer.objects)
    ? layer.objects as Array<Record<string, unknown>>
    : []).reduce((result, object) => Math.max(result, Number(object.id) || 0), 0);
  return Math.max(maximum + 1, Number(tilemap.nextobjectid) || 1);
}

function createLayer(
  tilemap: PokeDiscoverEditableTiledMap,
  name: PokeDiscoverEditableLayerName,
): PokeDiscoverTiledLayer {
  const common = {
    id: nextLayerId(tilemap),
    name,
    opacity: 1,
    visible: true,
    x: 0,
    y: 0,
  };
  if (name === 'Above') {
    return {
      ...common,
      type: 'tilelayer',
      width: tilemap.width,
      height: tilemap.height,
      data: Array.from({ length: tilemap.width * tilemap.height }, () => 0),
    };
  }
  return {
    ...common,
    type: 'objectgroup',
    draworder: 'topdown',
    objects: [],
  };
}

function canonicalLayerInsertionIndex(
  layers: Array<Record<string, unknown>>,
  name: PokeDiscoverEditableLayerName,
) {
  const order = [
    'Ground',
    'Collision',
    'Above',
    'Anchors',
    'Triggers',
    'Paths',
    'Occlusion',
    'Comments',
  ];
  const desired = order.indexOf(name);
  for (let index = 0; index < layers.length; index += 1) {
    const current = order.indexOf(String(layers[index].name));
    if (current > desired) return index;
  }
  return layers.length;
}

export function ensurePokeDiscoverTiledLayer(
  tilemap: PokeDiscoverEditableTiledMap,
  name: PokeDiscoverEditableLayerName,
) {
  const existing = tilemap.layers.find(layer => layer.name === name);
  if (existing) return { tilemap, layer: existing as PokeDiscoverTiledLayer, created: false };
  const layer = createLayer(tilemap, name);
  const layers = [...tilemap.layers];
  layers.splice(canonicalLayerInsertionIndex(layers, name), 0, layer);
  return {
    tilemap: {
      ...tilemap,
      layers,
      nextlayerid: layer.id + 1,
    },
    layer,
    created: true,
  };
}

export function preparePokeDiscoverTiledMap(
  source: LoadedTiledMap,
): PokeDiscoverPreparedMap {
  let tilemap = source as PokeDiscoverEditableTiledMap;
  const ground = tilemap.layers.find(layer => layer.name === 'Ground');
  if (!ground || ground.type !== 'tilelayer') {
    throw new Error('La sector necesita una capa de tiles Ground creada en Tiled.');
  }
  const createdLayers: PokeDiscoverEditableLayerName[] = [];
  for (const name of ['Above', ...REQUIRED_OBJECT_LAYERS] as PokeDiscoverEditableLayerName[]) {
    const prepared = ensurePokeDiscoverTiledLayer(tilemap, name);
    tilemap = prepared.tilemap;
    if (prepared.created) createdLayers.push(name);
  }
  return { tilemap, createdLayers };
}

export function addPokeDiscoverTiledObject(
  source: PokeDiscoverEditableTiledMap,
  layerName: PokeDiscoverObjectLayerName,
  object: PokeDiscoverNewTiledObject,
) {
  const ensured = ensurePokeDiscoverTiledLayer(source, layerName);
  const id = nextObjectId(ensured.tilemap);
  const created: PokeDiscoverTiledObject = {
    ...object,
    id,
    rotation: object.rotation ?? 0,
    visible: object.visible ?? true,
  };
  const layers = ensured.tilemap.layers.map(layer => layer.name === layerName
    ? { ...layer, objects: [...(Array.isArray(layer.objects) ? layer.objects : []), created] }
    : layer);
  return {
    tilemap: { ...ensured.tilemap, layers, nextobjectid: id + 1 },
    object: created,
    createdLayer: ensured.created,
  };
}

export function updatePokeDiscoverTiledObject(
  tilemap: PokeDiscoverEditableTiledMap,
  objectId: number,
  update: (object: PokeDiscoverTiledObject) => PokeDiscoverTiledObject,
) {
  let found = false;
  const layers = tilemap.layers.map(layer => {
    if (!Array.isArray(layer.objects)) return layer;
    return {
      ...layer,
      objects: (layer.objects as PokeDiscoverTiledObject[]).map(object => {
        if (object.id !== objectId) return object;
        found = true;
        return update(object);
      }),
    };
  });
  if (!found) throw new Error(`No existe el objeto Tiled #${objectId}.`);
  return { ...tilemap, layers };
}

export function removePokeDiscoverTiledObject(
  tilemap: PokeDiscoverEditableTiledMap,
  objectId: number,
) {
  let found = false;
  const layers = tilemap.layers.map(layer => {
    if (!Array.isArray(layer.objects)) return layer;
    const objects = (layer.objects as PokeDiscoverTiledObject[]).filter(object => {
      if (object.id !== objectId) return true;
      found = true;
      return false;
    });
    return { ...layer, objects };
  });
  if (!found) throw new Error(`No existe el objeto Tiled #${objectId}.`);
  return { ...tilemap, layers };
}

export function listPokeDiscoverSpawnAnchors(tilemap: LoadedTiledMap) {
  const layer = tilemap.layers.find(candidate => candidate.name === 'Anchors');
  const objects = Array.isArray(layer?.objects) ? layer.objects as Array<Record<string, unknown>> : [];
  return objects
    .filter(object => ['PlayerSpawn', 'TransitionAnchor'].includes(objectClass(object)))
    .map(object => String(object.name ?? '').trim())
    .filter(Boolean);
}

function uniqueStableId(preferred: string, used: Set<string>) {
  if (!used.has(preferred)) return preferred;
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${preferred}-${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
}

function commonIdPrefix(ids: string[], fallback: string) {
  const first = ids[0];
  return first?.includes(':') ? first.slice(0, first.lastIndexOf(':')) : fallback;
}

export function registerPokeDiscoverTiledSources(
  adventure: AdventureMapV3,
  sources: PokeDiscoverTiledSource[],
  directoryPath?: string,
) {
  let next = adventure;
  const registrations: PokeDiscoverRoomRegistration[] = [];
  const usedAssetIds = new Set(next.tiledMapAssets.map(asset => asset.assetId));
  const usedRoomIds = new Set(next.sectors.map(sector => sector.sectorId));
  const mapSlug = slugifyEditorLabel(next.mapId.split(':').at(-1) ?? next.title);
  const assetPrefix = commonIdPrefix([...usedAssetIds], `tiled-map:${mapSlug}`);
  const roomPrefix = commonIdPrefix([...usedRoomIds], `sector:${mapSlug}`);
  const knownByFile = new Map(next.tiledMapAssets.map(asset => [fileBaseName(asset.path), asset]));

  for (const source of sources) {
    let asset = knownByFile.get(source.fileName);
    let room = asset ? next.sectors.find(candidate => candidate.tiledMapAssetId === asset?.assetId) : undefined;
    let created = false;
    const suffixMatch = fileStem(source.fileName).match(/(\d+-\d+)$/u);
    const suffix = suffixMatch?.[1] ?? slugifyEditorLabel(fileStem(source.fileName));
    if (!asset) {
      const assetId = uniqueStableId(`${assetPrefix}:${suffix}`, usedAssetIds);
      usedAssetIds.add(assetId);
      const normalizedDirectory = directoryPath?.replaceAll('\\', '/').replace(/^\/+|\/+$/g, '');
      const path = normalizedDirectory ? `${normalizedDirectory}/${source.fileName}` : source.fileName;
      asset = { schemaVersion: 1, assetId, path };
      next = { ...next, tiledMapAssets: [...next.tiledMapAssets, asset] };
      knownByFile.set(source.fileName, asset);
      created = true;
    }
    if (!room) {
      const sectorId = uniqueStableId(`${roomPrefix}:${suffix}`, usedRoomIds);
      usedRoomIds.add(sectorId);
      room = {
        schemaVersion: 1,
        sectorId,
        tiledMapAssetId: asset.assetId,
        staticCamera: true,
        spawnAnchorIds: listPokeDiscoverSpawnAnchors(source.tilemap),
        roster: {
          schemaVersion: 1,
          pokemonAssetIds: [],
          npcAssetIds: [],
        },
      };
      next = { ...next, sectors: [...next.sectors, room] };
      created = true;
    } else {
      const spawnAnchorIds = listPokeDiscoverSpawnAnchors(source.tilemap);
      const merged = [...new Set([...room.spawnAnchorIds, ...spawnAnchorIds])];
      if (merged.length !== room.spawnAnchorIds.length) {
        next = {
          ...next,
          sectors: next.sectors.map(candidate => candidate.sectorId === room?.sectorId
            ? { ...candidate, spawnAnchorIds: merged }
            : candidate),
        };
        room = { ...room, spawnAnchorIds: merged };
      }
    }
    registrations.push({
      fileName: source.fileName,
      assetId: asset.assetId,
      sectorId: room.sectorId,
      created,
    });
  }
  return { adventure: next, registrations };
}

export function createPokeDiscoverAdventure({
  title,
  mapId,
}: {
  title: string;
  mapId: string;
}): AdventureMapV3 {
  return {
    schemaVersion: 3,
    mapId,
    title,
    tiledMapAssets: [],
    sectors: [],
    actorPlacements: [],
    characterPlacements: [],
    transitions: [],
    variants: [],
    missionIds: [],
    entryPoints: [],
    missionEntryPoints: [],
    behaviorTriggers: [],
    companionSequences: [],
    mapSequences: [],
    expressionTriggers: [],
    interactions: [],
    dialogues: [],
    fieldNotebookHints: [],
    researchFacts: [],
    ambientSequences: [],
    rareEncounters: [],
    worldEvents: [],
    requiredAssetIds: [],
  };
}

export function createPokeDiscoverWorld(
  sources: PokeDiscoverTiledSource[],
): PokeDiscoverWorldFile {
  const columns = Math.max(1, Math.ceil(Math.sqrt(sources.length)));
  return {
    type: 'world',
    maps: sources.map((source, index) => ({
      fileName: source.fileName,
      x: (index % columns) * source.tilemap.width * source.tilemap.tilewidth,
      y: Math.floor(index / columns) * source.tilemap.height * source.tilemap.tileheight,
      width: source.tilemap.width * source.tilemap.tilewidth,
      height: source.tilemap.height * source.tilemap.tileheight,
    })),
  };
}

export function mergePokeDiscoverWorldSources(
  world: PokeDiscoverWorldFile,
  sources: PokeDiscoverTiledSource[],
) {
  const known = new Set(world.maps.map(entry => fileBaseName(entry.fileName)));
  if (sources.every(source => known.has(source.fileName))) return world;
  const currentRight = world.maps.reduce((right, entry) => Math.max(
    right,
    entry.x + (entry.width ?? 0),
  ), 0);
  let nextX = currentRight;
  const maps = [...world.maps];
  for (const source of sources) {
    if (known.has(source.fileName)) continue;
    const width = source.tilemap.width * source.tilemap.tilewidth;
    const height = source.tilemap.height * source.tilemap.tileheight;
    maps.push({ fileName: source.fileName, x: nextX, y: 0, width, height });
    known.add(source.fileName);
    nextX += width;
  }
  return { ...world, maps };
}

function worldFilePrefix(world: PokeDiscoverWorldFile, registrations: PokeDiscoverRoomRegistration[]) {
  const candidates = [
    ...world.maps.map(entry => fileBaseName(entry.fileName)),
    ...registrations.map(registration => fileBaseName(registration.fileName)),
  ];
  for (const candidate of candidates) {
    const match = candidate.match(/^(.*)-\d{2}-\d{2}\.tmj(?:\.\d+)?(?:\.old)?$/iu);
    if (match?.[1]) return match[1];
  }
  return 'mapa';
}

export function previewPokeDiscoverWorldNames(
  world: PokeDiscoverWorldFile,
  registrations: PokeDiscoverRoomRegistration[],
) {
  const prefix = worldFilePrefix(world, registrations);
  const ordered = [...world.maps].sort((left, right) => {
    const leftY = Math.round(left.y / 16);
    const rightY = Math.round(right.y / 16);
    return leftY - rightY || Math.round(left.x / 16) - Math.round(right.x / 16);
  });
  const total = String(ordered.length).padStart(2, '0');
  return new Map(ordered.map((entry, index) => [
    entry,
    `${prefix}-${String(index + 1).padStart(2, '0')}-${total}.tmj`,
  ]));
}

function replaceAssetFileName(path: string, fileName: string) {
  const normalized = path.replaceAll('\\', '/');
  const separator = normalized.lastIndexOf('/');
  return separator < 0 ? fileName : `${normalized.slice(0, separator + 1)}${fileName}`;
}

function archivedFileName(fileName: string, used: Set<string>) {
  if (fileName.endsWith('.old')) return fileName;
  const candidate = `${fileName}.old`;
  if (!used.has(candidate)) return candidate;
  for (let suffix = 2; ; suffix += 1) {
    const numbered = `${fileName}.${suffix}.old`;
    if (!used.has(numbered)) return numbered;
  }
}

export interface PokeDiscoverWorldOrganizationSnapshot {
  adventure: AdventureMapV3;
  tilemapsByFileName: Record<string, PokeDiscoverEditableTiledMap>;
  world: PokeDiscoverWorldFile;
  registrations: PokeDiscoverRoomRegistration[];
  sourceFileNameByFileName: Record<string, string>;
}

export function applyPokeDiscoverWorldOrganization<T extends PokeDiscoverWorldOrganizationSnapshot>(
  snapshot: T,
  draftWorld: PokeDiscoverWorldFile,
): T {
  const proposedNames = previewPokeDiscoverWorldNames(draftWorld, snapshot.registrations);
  const registrationByFileName = new Map(snapshot.registrations.map(item => [fileBaseName(item.fileName), item]));
  const activeOriginalNames = new Set(draftWorld.maps.map(entry => fileBaseName(entry.fileName)));
  const usedNames = new Set<string>([...proposedNames.values()]);
  const renameByCurrentName = new Map<string, string>();

  for (const [entry, proposedName] of proposedNames) {
    const currentName = fileBaseName(entry.fileName);
    if (registrationByFileName.has(currentName)) renameByCurrentName.set(currentName, proposedName);
  }
  for (const registration of snapshot.registrations) {
    if (activeOriginalNames.has(fileBaseName(registration.fileName))) continue;
    const currentName = fileBaseName(registration.fileName);
    const nextName = archivedFileName(currentName, usedNames);
    usedNames.add(nextName);
    renameByCurrentName.set(currentName, nextName);
  }

  const registrations = snapshot.registrations.map(registration => {
    const nextName = renameByCurrentName.get(fileBaseName(registration.fileName)) ?? registration.fileName;
    return {
      ...registration,
      fileName: nextName,
      archived: !draftWorld.maps.some(entry => fileBaseName(entry.fileName) === fileBaseName(registration.fileName)),
    };
  });
  const tilemapsByFileName = Object.fromEntries(Object.entries(snapshot.tilemapsByFileName).map(
    ([fileName, tilemap]) => [renameByCurrentName.get(fileBaseName(fileName)) ?? fileName, tilemap],
  ));
  const sourceFileNameByFileName = Object.fromEntries(Object.keys(tilemapsByFileName).map(nextName => {
    const registration = registrations.find(item => item.fileName === nextName);
    const previous = registration
      ? snapshot.registrations.find(item => item.sectorId === registration.sectorId)
      : undefined;
    const currentName = previous?.fileName ?? nextName;
    return [nextName, snapshot.sourceFileNameByFileName[currentName] ?? currentName];
  }));
  const fileNameByAssetId = new Map(registrations.map(item => [item.assetId, item.fileName]));
  const adventure = {
    ...snapshot.adventure,
    tiledMapAssets: snapshot.adventure.tiledMapAssets.map(asset => {
      const nextName = fileNameByAssetId.get(asset.assetId);
      return nextName ? { ...asset, path: replaceAssetFileName(asset.path, nextName) } : asset;
    }),
  };
  const world = {
    ...draftWorld,
    maps: draftWorld.maps.map(entry => ({
      ...entry,
      fileName: proposedNames.get(entry) ?? entry.fileName,
    })),
  };
  return {
    ...snapshot,
    adventure,
    tilemapsByFileName,
    world,
    registrations,
    sourceFileNameByFileName,
  };
}

export function createPokeDiscoverEditorHistory<T>(initial: T): PokeDiscoverEditorHistory<T> {
  return { past: [], present: initial, future: [] };
}

export function commitPokeDiscoverEditorHistory<T>(
  history: PokeDiscoverEditorHistory<T>,
  next: T,
  limit = 100,
): PokeDiscoverEditorHistory<T> {
  if (Object.is(history.present, next)) return history;
  return {
    past: [...history.past, history.present].slice(-limit),
    present: next,
    future: [],
  };
}

export function undoPokeDiscoverEditorHistory<T>(
  history: PokeDiscoverEditorHistory<T>,
): PokeDiscoverEditorHistory<T> {
  const previous = history.past.at(-1);
  if (previous === undefined) return history;
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redoPokeDiscoverEditorHistory<T>(
  history: PokeDiscoverEditorHistory<T>,
): PokeDiscoverEditorHistory<T> {
  const next = history.future[0];
  if (next === undefined) return history;
  return {
    past: [...history.past, history.present].slice(-100),
    present: next,
    future: history.future.slice(1),
  };
}
