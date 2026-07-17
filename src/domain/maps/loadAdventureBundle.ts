import type {
  AdventureMapV2,
  PmdAnimationManifestV1,
  PmdSpriteAssetV1,
} from '../../../packages/contracts/src/index.js';

export interface LoadedTiledTileset {
  name: string;
  imageUrl: string;
}

export interface LoadedAdventureRoomBundle {
  adventure: AdventureMapV2;
  room: AdventureMapV2['rooms'][number];
  tilemap: Record<string, unknown> & {
    width: number;
    height: number;
    tilewidth: number;
    tileheight: number;
    layers: Array<Record<string, unknown>>;
    tilesets: Array<Record<string, unknown>>;
  };
  tilesets: LoadedTiledTileset[];
  pmdManifest: PmdAnimationManifestV1;
  actorAssets: Map<string, PmdSpriteAssetV1>;
}

export interface LoadedAdventureMapBundle {
  adventure: AdventureMapV2;
  rooms: LoadedAdventureRoomBundle[];
  pmdManifest: PmdAnimationManifestV1;
}

function assetUrl(path: string, baseUrl: string) {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return new URL(path, new URL(normalizedBase, window.location.href)).href;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`No se pudo cargar ${url} (${response.status}).`);
  return response.json() as Promise<T>;
}

async function inlineExternalTilesets(
  tilemap: LoadedAdventureRoomBundle['tilemap'],
  tmjUrl: string,
) {
  const tilesets: LoadedTiledTileset[] = [];
  const resolved = await Promise.all(tilemap.tilesets.map(async reference => {
    if (typeof reference.source !== 'string') {
      if (typeof reference.name !== 'string' || typeof reference.image !== 'string') {
        throw new Error('Tileset incrustado sin name o image.');
      }
      const imageUrl = new URL(reference.image, tmjUrl).href;
      tilesets.push({ name: reference.name, imageUrl });
      return { ...reference, image: imageUrl };
    }
    const tsjUrl = new URL(reference.source, tmjUrl).href;
    const definition = await fetchJson<Record<string, unknown>>(tsjUrl);
    if (typeof definition.name !== 'string' || typeof definition.image !== 'string') {
      throw new Error(`${reference.source}: tileset sin name o image.`);
    }
    const imageUrl = new URL(definition.image, tsjUrl).href;
    tilesets.push({ name: definition.name, imageUrl });
    return {
      ...definition,
      firstgid: reference.firstgid,
      image: imageUrl,
    };
  }));
  return { tilemap: { ...tilemap, tilesets: resolved }, tilesets };
}

export async function loadAdventureRoomBundle({
  adventurePath,
  roomId,
  baseUrl,
}: {
  adventurePath: string;
  roomId: string;
  baseUrl: string;
}): Promise<LoadedAdventureRoomBundle> {
  const mapBundle = await loadAdventureMapBundle({ adventurePath, baseUrl });
  const room = mapBundle.rooms.find(candidate => candidate.room.roomId === roomId);
  if (!room) throw new Error(`Habitación inexistente: ${roomId}.`);
  return room;
}

export async function loadAdventureMapBundle({
  adventurePath,
  baseUrl,
}: {
  adventurePath: string;
  baseUrl: string;
}): Promise<LoadedAdventureMapBundle> {
  const adventure = await fetchJson<AdventureMapV2>(assetUrl(adventurePath, baseUrl));
  const pmdManifest = await fetchJson<PmdAnimationManifestV1>(assetUrl(
    'assets/sprites/pokemon/pmd/manifest.v1.json',
    baseUrl,
  ));
  const pmdById = new Map(pmdManifest.assets.map(asset => [asset.assetId, asset]));
  const rooms = await Promise.all(adventure.rooms.map(async room => {
    const tiledReference = adventure.tiledMapAssets
      .find(candidate => candidate.assetId === room.tiledMapAssetId);
    if (!tiledReference) throw new Error(`Asset Tiled inexistente: ${room.tiledMapAssetId}.`);
    const tmjUrl = assetUrl(tiledReference.path, baseUrl);
    const rawTilemap = await fetchJson<LoadedAdventureRoomBundle['tilemap']>(tmjUrl);
    const resolved = await inlineExternalTilesets(rawTilemap, tmjUrl);
    const actorAssets = new Map<string, PmdSpriteAssetV1>();
    for (const placement of adventure.actorPlacements.filter(item => item.roomId === room.roomId)) {
      const asset = pmdById.get(placement.assetId);
      if (!asset) throw new Error(`Asset PMD inexistente: ${placement.assetId}.`);
      if (!asset.animations.some(animation => animation.name === placement.animation)) {
        throw new Error(`Animación PMD inexistente: ${placement.assetId}/${placement.animation}.`);
      }
      actorAssets.set(asset.assetId, asset);
    }
    return {
      adventure,
      room,
      tilemap: resolved.tilemap,
      tilesets: resolved.tilesets,
      pmdManifest,
      actorAssets,
    };
  }));
  return {
    adventure,
    rooms,
    pmdManifest,
  };
}

export function findTiledObject(
  tilemap: LoadedAdventureRoomBundle['tilemap'],
  layerName: string,
  objectName: string,
) {
  const layer = tilemap.layers.find(candidate => candidate.name === layerName);
  const objects = Array.isArray(layer?.objects) ? layer.objects as Array<Record<string, unknown>> : [];
  return objects.find(object => object.name === objectName);
}
