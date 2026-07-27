import type {
  AdventureMapDocument,
  AdventureMapV3,
  CharacterSpriteAssetV1,
  CharacterSpriteManifestV1,
  PmdAnimationManifestV1,
  PmdSpriteAssetV1,
} from '../../../packages/contracts/src/index.js';
import {
  normalizeAdventureMapV3,
  resolveAdventureSectorId,
} from '../expeditions/adventureMapV3.js';

export interface LoadedTiledTileset {
  name: string;
  imageUrl: string;
}

export type LoadedTiledMap = Record<string, unknown> & {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: Array<Record<string, unknown>>;
  tilesets: Array<Record<string, unknown>>;
};

export interface LoadedAdventureSectorBundle {
  adventure: AdventureMapV3;
  sector: AdventureMapV3['sectors'][number];
  tilemap: LoadedTiledMap;
  tilesets: LoadedTiledTileset[];
  pmdManifest: PmdAnimationManifestV1;
  actorAssets: Map<string, PmdSpriteAssetV1>;
  characterAssets: Map<string, CharacterSpriteAssetV1>;
}

/** @deprecated Utiliza LoadedAdventureSectorBundle. */
export type LoadedAdventureRoomBundle = LoadedAdventureSectorBundle;

export interface LoadedAdventureMapBundle {
  adventure: AdventureMapV3;
  sectors: LoadedAdventureSectorBundle[];
  pmdManifest: PmdAnimationManifestV1;
  characterManifest: CharacterSpriteManifestV1;
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

function xmlAttributes(source: string) {
  return Object.fromEntries([...source.matchAll(/([\w-]+)="([^"]*)"/g)].map(match => [match[1], match[2]]));
}

async function fetchTiledTileset(url: string): Promise<Record<string, unknown>> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`No se pudo cargar ${url} (${response.status}).`);
  if (!url.toLocaleLowerCase().endsWith('.tsx')) return response.json() as Promise<Record<string, unknown>>;
  const source = await response.text();
  const tilesetTag = source.match(/<tileset\b[^>]*>/)?.[0];
  const imageTag = source.match(/<image\b[^>]*>/)?.[0];
  if (!tilesetTag || !imageTag) throw new Error(`${url}: TSX sin tileset o image.`);
  const tileset = xmlAttributes(tilesetTag);
  const image = xmlAttributes(imageTag);
  return {
    name: tileset.name,
    image: image.source,
    tilewidth: Number(tileset.tilewidth),
    tileheight: Number(tileset.tileheight),
    tilecount: Number(tileset.tilecount),
    columns: Number(tileset.columns),
    imagewidth: Number(image.width),
    imageheight: Number(image.height),
  };
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
    const definition = await fetchTiledTileset(tsjUrl);
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

export async function loadAdventureSectorBundle({
  adventurePath,
  sectorId,
  baseUrl,
}: {
  adventurePath: string;
  sectorId: string;
  baseUrl: string;
}): Promise<LoadedAdventureSectorBundle> {
  const mapBundle = await loadAdventureMapBundle({ adventurePath, baseUrl });
  const resolvedSectorId = resolveAdventureSectorId(mapBundle.adventure, sectorId);
  const sector = mapBundle.sectors.find(candidate => candidate.sector.sectorId === resolvedSectorId);
  if (!sector) throw new Error(`Sector inexistente: ${sectorId}.`);
  return sector;
}

/** @deprecated Utiliza loadAdventureSectorBundle. */
export async function loadAdventureRoomBundle({
  adventurePath,
  roomId,
  baseUrl,
}: {
  adventurePath: string;
  roomId: string;
  baseUrl: string;
}) {
  return loadAdventureSectorBundle({ adventurePath, sectorId: roomId, baseUrl });
}

export async function loadAdventureMapBundle({
  adventurePath,
  baseUrl,
}: {
  adventurePath: string;
  baseUrl: string;
}): Promise<LoadedAdventureMapBundle> {
  const adventure = await fetchJson<AdventureMapDocument>(assetUrl(adventurePath, baseUrl));
  return loadAdventureMapBundleFromData({ adventure, baseUrl });
}

/**
 * Construye el mismo bundle que usa el juego permitiendo que herramientas de
 * autoría sustituyan uno o más TMJ leídos localmente por el usuario.
 */
export async function loadAdventureMapBundleFromData({
  adventure,
  baseUrl,
  tiledMapsByAssetId = new Map(),
}: {
  adventure: AdventureMapDocument;
  baseUrl: string;
  tiledMapsByAssetId?: ReadonlyMap<string, LoadedTiledMap>;
}): Promise<LoadedAdventureMapBundle> {
  const normalizedAdventure = normalizeAdventureMapV3(adventure);
  const [pmdManifest, characterManifest] = await Promise.all([
    fetchJson<PmdAnimationManifestV1>(assetUrl('assets/sprites/pokemon/pmd/manifest.v1.json', baseUrl)),
    fetchJson<CharacterSpriteManifestV1>(assetUrl('assets/sprites/characters/manifest.v1.json', baseUrl)),
  ]);
  const pmdById = new Map(pmdManifest.assets.map(asset => [asset.assetId, asset]));
  const charactersById = new Map(characterManifest.assets.map(asset => [asset.assetId, asset]));
  const sectors = await Promise.all(normalizedAdventure.sectors.map(async sector => {
    const tiledReference = normalizedAdventure.tiledMapAssets
      .find(candidate => candidate.assetId === sector.tiledMapAssetId);
    if (!tiledReference) throw new Error(`Asset Tiled inexistente: ${sector.tiledMapAssetId}.`);
    const tmjUrl = assetUrl(tiledReference.path, baseUrl);
    const rawTilemap = tiledMapsByAssetId.get(tiledReference.assetId)
      ?? await fetchJson<LoadedTiledMap>(tmjUrl);
    const resolved = await inlineExternalTilesets(rawTilemap, tmjUrl);
    const actorAssets = new Map<string, PmdSpriteAssetV1>();
    for (const placement of normalizedAdventure.actorPlacements
      .filter(item => item.sectorId === sector.sectorId)) {
      const asset = pmdById.get(placement.assetId);
      if (!asset) throw new Error(`Asset PMD inexistente: ${placement.assetId}.`);
      if (!asset.animations.some(animation => animation.name === placement.animation)) {
        throw new Error(`Animación PMD inexistente: ${placement.assetId}/${placement.animation}.`);
      }
      actorAssets.set(asset.assetId, asset);
    }
    const characterAssets = new Map<string, CharacterSpriteAssetV1>();
    for (const placement of normalizedAdventure.characterPlacements
      .filter(item => item.sectorId === sector.sectorId)) {
      const asset = charactersById.get(placement.assetId);
      if (!asset) throw new Error(`Asset de personaje inexistente: ${placement.assetId}.`);
      characterAssets.set(asset.assetId, asset);
    }
    return {
      adventure: normalizedAdventure,
      sector,
      tilemap: resolved.tilemap,
      tilesets: resolved.tilesets,
      pmdManifest,
      actorAssets,
      characterAssets,
    };
  }));
  return {
    adventure: normalizedAdventure,
    sectors,
    pmdManifest,
    characterManifest,
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
