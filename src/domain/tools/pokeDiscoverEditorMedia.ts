import type {
  AdventureAudioAssetV1,
  AdventureEffectAssetV1,
  AdventureMediaManifestV1,
  CharacterAppearanceV1,
  CharacterSpriteAssetV1,
  CharacterSpriteManifestV1,
} from '../../../packages/contracts/src/index.js';
import type {
  PokeDiscoverDirectoryHandle,
  PokeDiscoverWritableFileHandle,
} from './pokeDiscoverEditorWorkspace.js';

const AUDIO_EXTENSIONS = new Set(['wav', 'ogg', 'mp3']);

function extension(name: string) {
  return name.split('.').at(-1)?.toLocaleLowerCase() ?? '';
}

export function validatePokeDiscoverMediaFile(
  file: Pick<File, 'name' | 'type'>,
  kind: 'effect' | 'audio' | 'character' | 'mount',
) {
  const ext = extension(file.name);
  if ((kind === 'effect' || kind === 'character' || kind === 'mount') && ext !== 'png') {
    return 'Los efectos y personajes deben importarse como PNG transparente.';
  }
  if (kind === 'audio' && !AUDIO_EXTENSIONS.has(ext)) {
    return 'El audio debe usar WAV, OGG o MP3.';
  }
  return undefined;
}

export function createPokeDiscoverEffectAsset(request: {
  assetId: string;
  path: string;
  frameWidth: number;
  frameHeight: number;
  columns: number;
  rows: number;
  frameDurationMs: number;
  source: string;
}): AdventureEffectAssetV1 {
  const frameCount = request.columns * request.rows;
  if (!request.assetId.trim() || !request.path.trim()) throw new Error('El efecto necesita ID y ruta.');
  if (![request.frameWidth, request.frameHeight, request.columns, request.rows]
    .every(value => Number.isInteger(value) && value > 0)) {
    throw new Error('La cuadrícula del efecto debe usar enteros positivos.');
  }
  return {
    schemaVersion: 1,
    kind: 'effect',
    assetId: request.assetId,
    path: request.path,
    frameWidth: request.frameWidth,
    frameHeight: request.frameHeight,
    columns: request.columns,
    rows: request.rows,
    pivot: { x: .5, y: .5 },
    animations: [{
      name: 'default',
      frames: Array.from({ length: frameCount }, (_, index) => index),
      frameDurationMs: Math.max(1, request.frameDurationMs),
      loop: false,
    }],
    source: request.source,
  };
}

export function createPokeDiscoverAudioAsset(request: {
  assetId: string;
  path: string;
  audioKind: 'effect' | 'music' | 'voice';
  source: string;
}): AdventureAudioAssetV1 {
  if (!AUDIO_EXTENSIONS.has(extension(request.path))) {
    throw new Error('El audio debe usar WAV, OGG o MP3.');
  }
  return {
    schemaVersion: 1,
    kind: 'audio',
    assetId: request.assetId,
    path: request.path,
    audioKind: request.audioKind,
    defaultVolume: 1,
    defaultLoop: request.audioKind === 'music',
    source: request.source,
  };
}

export function addPokeDiscoverMediaAsset(
  manifest: AdventureMediaManifestV1,
  asset: AdventureMediaManifestV1['assets'][number],
) {
  if (manifest.assets.some(candidate => candidate.assetId === asset.assetId)) {
    throw new Error(`Ya existe el recurso ${asset.assetId}.`);
  }
  return {
    ...manifest,
    assets: [...manifest.assets, asset].sort((left, right) => (
      left.assetId.localeCompare(right.assetId)
    )),
  };
}

export function addPokeDiscoverCharacterMode(
  manifest: CharacterSpriteManifestV1,
  asset: CharacterSpriteAssetV1,
  appearance: CharacterAppearanceV1,
) {
  if (asset.role !== 'player') {
    throw new Error('Las apariencias sólo admiten recursos con role player.');
  }
  if (manifest.assets.some(candidate => candidate.assetId === asset.assetId)) {
    throw new Error(`Ya existe el personaje ${asset.assetId}.`);
  }
  const existingAppearance = manifest.appearances?.find(candidate => (
    candidate.appearanceId === appearance.appearanceId
  ));
  const appearances = existingAppearance
    ? (manifest.appearances ?? []).map(candidate => candidate.appearanceId === appearance.appearanceId
      ? {
        ...candidate,
        modes: {
          ...candidate.modes,
          ...(asset.locomotionMode === 'swim' ? { swim: asset.assetId } : { walk: asset.assetId }),
        },
      }
      : candidate)
    : [...(manifest.appearances ?? []), appearance];
  return {
    ...manifest,
    assets: [...manifest.assets, asset],
    appearances,
  };
}

type BinaryWritableHandle = {
  createWritable(): Promise<{
    write(data: string | Blob | ArrayBuffer): Promise<void>;
    close(): Promise<void>;
  }>;
};

async function directoryAt(
  root: PokeDiscoverDirectoryHandle,
  segments: string[],
  create = false,
) {
  let current = root;
  for (const segment of segments) {
    if (!current.getDirectoryHandle) {
      throw new Error('El navegador no permite escribir en subcarpetas.');
    }
    current = await current.getDirectoryHandle(segment, { create });
  }
  return current;
}

async function readJsonFile<T>(
  root: PokeDiscoverDirectoryHandle,
  directorySegments: string[],
  fileName: string,
): Promise<T> {
  const directory = await directoryAt(root, directorySegments);
  const handle = await directory.getFileHandle(fileName);
  return JSON.parse(await (await handle.getFile()).text()) as T;
}

async function writeFile(
  directory: PokeDiscoverDirectoryHandle,
  fileName: string,
  data: string | Blob,
) {
  const handle = await directory.getFileHandle(
    fileName,
    { create: true },
  ) as unknown as BinaryWritableHandle;
  const writable = await handle.createWritable();
  await writable.write(data);
  await writable.close();
}

async function assertFileDoesNotExist(
  directory: PokeDiscoverDirectoryHandle,
  fileName: string,
) {
  try {
    await directory.getFileHandle(fileName);
  } catch {
    return;
  }
  throw new Error(`Ya existe el archivo ${fileName}; cambia el ID para no sobrescribirlo.`);
}

function canonicalFileName(assetId: string, originalName: string) {
  const ext = extension(originalName);
  const stem = assetId.replace(/^[^:]+:/u, '').replace(/[^a-z0-9]+/giu, '-')
    .replace(/^-+|-+$/gu, '').toLocaleLowerCase();
  return `${stem || 'asset'}.${ext}`;
}

export async function importPokeDiscoverMediaFile(
  root: PokeDiscoverDirectoryHandle,
  file: File,
  asset: AdventureMediaManifestV1['assets'][number],
) {
  const manifestDirectory = ['public', 'assets', 'adventure', 'media'];
  const manifest = await readJsonFile<AdventureMediaManifestV1>(
    root,
    manifestDirectory,
    'manifest.v1.json',
  );
  const folderName = asset.kind === 'effect' ? 'effects' : 'audio';
  const targetDirectory = await directoryAt(root, [...manifestDirectory, folderName], true);
  const fileName = canonicalFileName(asset.assetId, file.name);
  await assertFileDoesNotExist(targetDirectory, fileName);
  const registered = {
    ...asset,
    path: `assets/adventure/media/${folderName}/${fileName}`,
  };
  const nextManifest = addPokeDiscoverMediaAsset(manifest, registered);
  await writeFile(targetDirectory, fileName, file);
  try {
    await writeFile(
      await directoryAt(root, manifestDirectory),
      'manifest.v1.json',
      `${JSON.stringify(nextManifest, null, 2)}\n`,
    );
  } catch (cause) {
    await targetDirectory.removeEntry?.(fileName);
    throw cause;
  }
  return { manifest: nextManifest, asset: registered };
}

export async function importPokeDiscoverCharacterFile(
  root: PokeDiscoverDirectoryHandle,
  file: File,
  asset: CharacterSpriteAssetV1,
  appearance: CharacterAppearanceV1,
) {
  const manifestDirectory = ['public', 'assets', 'sprites', 'characters'];
  const manifest = await readJsonFile<CharacterSpriteManifestV1>(
    root,
    manifestDirectory,
    'manifest.v1.json',
  );
  const folder = appearance.appearanceId.split(':').at(-1) ?? 'imported';
  const targetDirectory = await directoryAt(root, [...manifestDirectory, folder], true);
  const fileName = canonicalFileName(asset.assetId, file.name);
  await assertFileDoesNotExist(targetDirectory, fileName);
  const registered = {
    ...asset,
    path: `assets/sprites/characters/${folder}/${fileName}`,
  };
  const nextManifest = addPokeDiscoverCharacterMode(manifest, registered, {
    ...appearance,
    modes: {
      ...appearance.modes,
      ...(registered.locomotionMode === 'swim'
        ? { swim: registered.assetId }
        : { walk: registered.assetId }),
    },
  });
  await writeFile(targetDirectory, fileName, file);
  try {
    await writeFile(
      await directoryAt(root, manifestDirectory),
      'manifest.v1.json',
      `${JSON.stringify(nextManifest, null, 2)}\n`,
    );
  } catch (cause) {
    await targetDirectory.removeEntry?.(fileName);
    throw cause;
  }
  return { manifest: nextManifest, asset: registered };
}

export async function importPokeDiscoverMountFile(
  root: PokeDiscoverDirectoryHandle,
  file: File,
  asset: CharacterSpriteAssetV1,
) {
  if (asset.role !== 'mount') throw new Error('El recurso debe declarar role mount.');
  const manifestDirectory = ['public', 'assets', 'sprites', 'characters'];
  const manifest = await readJsonFile<CharacterSpriteManifestV1>(
    root,
    manifestDirectory,
    'manifest.v1.json',
  );
  if (manifest.assets.some(candidate => candidate.assetId === asset.assetId)) {
    throw new Error(`Ya existe el personaje ${asset.assetId}.`);
  }
  const targetDirectory = await directoryAt(root, [...manifestDirectory, 'mounts'], true);
  const fileName = canonicalFileName(asset.assetId, file.name);
  await assertFileDoesNotExist(targetDirectory, fileName);
  const registered: CharacterSpriteAssetV1 = {
    ...asset,
    path: `assets/sprites/characters/mounts/${fileName}`,
  };
  const nextManifest: CharacterSpriteManifestV1 = {
    ...manifest,
    assets: [...manifest.assets, registered],
  };
  await writeFile(targetDirectory, fileName, file);
  try {
    await writeFile(
      await directoryAt(root, manifestDirectory),
      'manifest.v1.json',
      `${JSON.stringify(nextManifest, null, 2)}\n`,
    );
  } catch (cause) {
    await targetDirectory.removeEntry?.(fileName);
    throw cause;
  }
  return { manifest: nextManifest, asset: registered };
}
