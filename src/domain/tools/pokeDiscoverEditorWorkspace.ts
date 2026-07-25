import type { AdventureMapV2 } from '../../../packages/contracts/src/index.js';
import type { LoadedTiledMap } from '../maps/loadAdventureBundle.js';
import {
  createPokeDiscoverAdventure,
  createPokeDiscoverEditorHistory,
  createPokeDiscoverWorld,
  fileBaseName,
  mergePokeDiscoverWorldSources,
  parsePokeDiscoverWorld,
  preparePokeDiscoverTiledMap,
  registerPokeDiscoverTiledSources,
  serializePokeDiscoverProjectJson,
  slugifyEditorLabel,
  type PokeDiscoverEditableTiledMap,
  type PokeDiscoverEditorHistory,
  type PokeDiscoverRoomRegistration,
  type PokeDiscoverTiledSource,
  type PokeDiscoverWorldFile,
} from './pokeDiscoverEditorProject.js';

export interface PokeDiscoverWritableFileHandle {
  kind?: 'file';
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{
    write(data: string): Promise<void>;
    close(): Promise<void>;
  }>;
}

export interface PokeDiscoverDirectoryHandle {
  kind?: 'directory';
  name: string;
  values(): AsyncIterableIterator<PokeDiscoverWritableFileHandle | PokeDiscoverDirectoryHandle>;
  getFileHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<PokeDiscoverWritableFileHandle>;
}

export interface PokeDiscoverWorkspaceSourceFile {
  file: File;
  handle?: PokeDiscoverWritableFileHandle;
}

export interface PokeDiscoverWorkspaceSnapshot {
  adventure: AdventureMapV2;
  tilemapsByFileName: Record<string, PokeDiscoverEditableTiledMap>;
  world: PokeDiscoverWorldFile;
}

export interface PokeDiscoverWorkspace {
  projectName: string;
  sidecarFileName: string;
  worldFileName: string;
  registrations: PokeDiscoverRoomRegistration[];
  history: PokeDiscoverEditorHistory<PokeDiscoverWorkspaceSnapshot>;
  baselineByFileName: Record<string, string>;
  diskContentByFileName: Record<string, string>;
  lastModifiedByFileName: Record<string, number>;
  handlesByFileName: Record<string, PokeDiscoverWritableFileHandle | undefined>;
  directoryHandle?: PokeDiscoverDirectoryHandle;
  createdProject: boolean;
  pendingLayout: boolean;
}

export interface PokeDiscoverProjectMetadata {
  title: string;
  mapId: string;
}

export interface PokeDiscoverWorkspaceInspection {
  sidecars: PokeDiscoverWorkspaceSourceFile[];
  tiledMaps: PokeDiscoverWorkspaceSourceFile[];
  worlds: PokeDiscoverWorkspaceSourceFile[];
}

function parseJson(source: string, fileName: string) {
  try {
    return JSON.parse(source) as unknown;
  } catch {
    throw new Error(`${fileName} no contiene JSON válido.`);
  }
}

function requireAdventureMap(value: unknown, fileName: string): AdventureMapV2 {
  if (!value || typeof value !== 'object') {
    throw new Error(`${fileName} debe contener un proyecto de aventura.`);
  }
  const candidate = value as Partial<AdventureMapV2>;
  if (candidate.schemaVersion !== 2 || typeof candidate.mapId !== 'string') {
    throw new Error(`${fileName} no cumple el contrato actual de proyecto.`);
  }
  if (!Array.isArray(candidate.rooms) || !Array.isArray(candidate.tiledMapAssets)) {
    throw new Error(`${fileName} no declara habitaciones y mapas de Tiled.`);
  }
  return candidate as AdventureMapV2;
}

function requireTiledMap(value: unknown, fileName: string): LoadedTiledMap {
  if (!value || typeof value !== 'object') throw new Error(`${fileName} no contiene un mapa.`);
  const candidate = value as Partial<LoadedTiledMap> & { type?: unknown };
  if (candidate.type !== 'map' || !Array.isArray(candidate.layers) || !Array.isArray(candidate.tilesets)) {
    throw new Error(`${fileName} no parece un TMJ de Tiled.`);
  }
  for (const field of ['width', 'height', 'tilewidth', 'tileheight'] as const) {
    if (!Number.isFinite(candidate[field]) || Number(candidate[field]) <= 0) {
      throw new Error(`${fileName} no declara ${field} correctamente.`);
    }
  }
  return candidate as LoadedTiledMap;
}

function sidecarDirectory(adventure: AdventureMapV2) {
  const reference = adventure.tiledMapAssets[0]?.path.replaceAll('\\', '/');
  return reference?.includes('/') ? reference.slice(0, reference.lastIndexOf('/')) : undefined;
}

function snapshotDocuments(
  snapshot: PokeDiscoverWorkspaceSnapshot,
  sidecarFileName: string,
  worldFileName: string,
) {
  const documents: Record<string, string> = {
    [sidecarFileName]: serializePokeDiscoverProjectJson(snapshot.adventure),
    [worldFileName]: serializePokeDiscoverProjectJson(snapshot.world),
  };
  for (const [fileName, tilemap] of Object.entries(snapshot.tilemapsByFileName)) {
    documents[fileName] = serializePokeDiscoverProjectJson(tilemap);
  }
  return documents;
}

function uniqueFiles(files: PokeDiscoverWorkspaceSourceFile[]) {
  const names = new Set<string>();
  for (const source of files) {
    if (names.has(source.file.name)) {
      throw new Error(`La carpeta contiene más de un archivo llamado ${source.file.name}.`);
    }
    names.add(source.file.name);
  }
}

export function inspectPokeDiscoverWorkspaceFiles(
  files: PokeDiscoverWorkspaceSourceFile[],
): PokeDiscoverWorkspaceInspection {
  uniqueFiles(files);
  return {
    sidecars: files.filter(source => source.file.name.toLocaleLowerCase().endsWith('.adventure.json')),
    tiledMaps: files.filter(source => source.file.name.toLocaleLowerCase().endsWith('.tmj')),
    worlds: files.filter(source => source.file.name.toLocaleLowerCase().endsWith('.world')),
  };
}

export async function readPokeDiscoverDirectory(
  directoryHandle: PokeDiscoverDirectoryHandle,
) {
  const files: PokeDiscoverWorkspaceSourceFile[] = [];
  const visit = async (directory: PokeDiscoverDirectoryHandle): Promise<void> => {
    for await (const entry of directory.values()) {
      if ('getFile' in entry) {
        const file = await entry.getFile();
        files.push({ file, handle: entry });
      } else if ('values' in entry) {
        await visit(entry);
      }
    }
  };
  await visit(directoryHandle);
  return files;
}

export async function openPokeDiscoverWorkspace({
  files,
  directoryHandle,
  metadata,
  projectName,
}: {
  files: PokeDiscoverWorkspaceSourceFile[];
  directoryHandle?: PokeDiscoverDirectoryHandle;
  metadata?: PokeDiscoverProjectMetadata;
  projectName?: string;
}): Promise<PokeDiscoverWorkspace> {
  const inspection = inspectPokeDiscoverWorkspaceFiles(files);
  if (inspection.sidecars.length > 1) {
    throw new Error('La carpeta contiene varios proyectos .adventure.json. Conserva sólo uno antes de abrirla.');
  }
  if (!inspection.tiledMaps.length) {
    throw new Error('La carpeta no contiene ningún mapa .tmj.');
  }
  const createdProject = inspection.sidecars.length === 0;
  if (createdProject && !metadata) {
    throw new Error('MISSING_PROJECT_METADATA');
  }

  const rawByFileName: Record<string, string> = {};
  const lastModifiedByFileName: Record<string, number> = {};
  const handlesByFileName: Record<string, PokeDiscoverWritableFileHandle | undefined> = {};
  const documentSources = [
    ...inspection.sidecars,
    ...inspection.tiledMaps,
    ...inspection.worlds,
  ];
  for (const source of documentSources) {
    rawByFileName[source.file.name] = await source.file.text();
    lastModifiedByFileName[source.file.name] = source.file.lastModified;
    handlesByFileName[source.file.name] = source.handle;
  }

  const existingSidecar = inspection.sidecars[0];
  const adventure = existingSidecar
    ? requireAdventureMap(
      parseJson(rawByFileName[existingSidecar.file.name], existingSidecar.file.name),
      existingSidecar.file.name,
    )
    : createPokeDiscoverAdventure(metadata!);
  const effectiveName = projectName || directoryHandle?.name || metadata?.title || adventure.title;
  const slug = slugifyEditorLabel(adventure.mapId.split(':').at(-1) || effectiveName);
  const sidecarFileName = existingSidecar?.file.name ?? `${slug}.adventure.json`;
  const existingWorld = inspection.worlds[0];
  const worldFileName = existingWorld?.file.name
    ?? sidecarFileName.replace(/\.adventure\.json$/iu, '.world');

  const baselineByFileName: Record<string, string> = {};
  if (existingSidecar) {
    baselineByFileName[sidecarFileName] = serializePokeDiscoverProjectJson(adventure);
  }
  const sources: PokeDiscoverTiledSource[] = inspection.tiledMaps.map(source => {
    const raw = requireTiledMap(
      parseJson(rawByFileName[source.file.name], source.file.name),
      source.file.name,
    );
    baselineByFileName[source.file.name] = serializePokeDiscoverProjectJson(raw);
    const prepared = preparePokeDiscoverTiledMap(raw);
    return { fileName: source.file.name, tilemap: prepared.tilemap };
  });
  const registered = registerPokeDiscoverTiledSources(
    adventure,
    sources,
    sidecarDirectory(adventure),
  );
  const parsedWorld = existingWorld
    ? parsePokeDiscoverWorld(parseJson(rawByFileName[existingWorld.file.name], existingWorld.file.name))
    : createPokeDiscoverWorld(sources);
  if (existingWorld) {
    baselineByFileName[worldFileName] = serializePokeDiscoverProjectJson(parsedWorld);
  }
  const world = mergePokeDiscoverWorldSources(parsedWorld, sources);
  const snapshot: PokeDiscoverWorkspaceSnapshot = {
    adventure: registered.adventure,
    tilemapsByFileName: Object.fromEntries(sources.map(source => [source.fileName, source.tilemap])),
    world,
  };

  return {
    projectName: effectiveName,
    sidecarFileName,
    worldFileName,
    registrations: registered.registrations,
    history: createPokeDiscoverEditorHistory(snapshot),
    baselineByFileName,
    diskContentByFileName: rawByFileName,
    lastModifiedByFileName,
    handlesByFileName,
    directoryHandle,
    createdProject,
    pendingLayout: !existingWorld,
  };
}

export function getPokeDiscoverWorkspaceDocuments(workspace: PokeDiscoverWorkspace) {
  return snapshotDocuments(
    workspace.history.present,
    workspace.sidecarFileName,
    workspace.worldFileName,
  );
}

export function getPokeDiscoverWorkspaceDirtyFiles(workspace: PokeDiscoverWorkspace) {
  const documents = getPokeDiscoverWorkspaceDocuments(workspace);
  return Object.keys(documents).filter(fileName => documents[fileName] !== workspace.baselineByFileName[fileName]);
}

export async function findPokeDiscoverWorkspaceConflicts(workspace: PokeDiscoverWorkspace) {
  const conflicts: string[] = [];
  for (const [fileName, diskContent] of Object.entries(workspace.diskContentByFileName)) {
    const handle = workspace.handlesByFileName[fileName];
    if (!handle || !(fileName in getPokeDiscoverWorkspaceDocuments(workspace))) continue;
    const current = await handle.getFile();
    if (current.lastModified !== workspace.lastModifiedByFileName[fileName]
      && await current.text() !== diskContent) {
      conflicts.push(fileName);
    }
  }
  return conflicts;
}

async function writableHandle(workspace: PokeDiscoverWorkspace, fileName: string) {
  const existing = workspace.handlesByFileName[fileName];
  if (existing) return existing;
  if (!workspace.directoryHandle) return undefined;
  return workspace.directoryHandle.getFileHandle(fileName, { create: true });
}

export async function savePokeDiscoverWorkspace(
  workspace: PokeDiscoverWorkspace,
  options?: { overwriteConflicts?: boolean },
) {
  if (!workspace.directoryHandle) {
    throw new Error('Este navegador no concedió escritura directa. Usa Exportar copia.');
  }
  const conflicts = await findPokeDiscoverWorkspaceConflicts(workspace);
  if (conflicts.length && !options?.overwriteConflicts) {
    const error = new Error('EXTERNAL_FILE_CONFLICT');
    Object.assign(error, { conflicts });
    throw error;
  }
  const documents = getPokeDiscoverWorkspaceDocuments(workspace);
  const dirtyFiles = new Set(getPokeDiscoverWorkspaceDirtyFiles(workspace));
  const orderedNames = [
    ...Object.keys(workspace.history.present.tilemapsByFileName)
      .filter(fileName => dirtyFiles.has(fileName)),
    workspace.worldFileName,
    workspace.sidecarFileName,
  ];
  const handlesByFileName = { ...workspace.handlesByFileName };
  const baselineByFileName = { ...workspace.baselineByFileName };
  const diskContentByFileName = { ...workspace.diskContentByFileName };
  const lastModifiedByFileName = { ...workspace.lastModifiedByFileName };
  for (const fileName of orderedNames) {
    const handle = await writableHandle({ ...workspace, handlesByFileName }, fileName);
    if (!handle) throw new Error(`No se puede escribir ${fileName}.`);
    const writable = await handle.createWritable();
    await writable.write(documents[fileName]);
    await writable.close();
    const saved = await handle.getFile();
    handlesByFileName[fileName] = handle;
    baselineByFileName[fileName] = documents[fileName];
    diskContentByFileName[fileName] = documents[fileName];
    lastModifiedByFileName[fileName] = saved.lastModified;
  }
  return {
    ...workspace,
    handlesByFileName,
    baselineByFileName,
    diskContentByFileName,
    lastModifiedByFileName,
    createdProject: false,
  };
}

export function downloadPokeDiscoverWorkspaceCopy(workspace: PokeDiscoverWorkspace) {
  if (typeof document === 'undefined') return;
  const documents = getPokeDiscoverWorkspaceDocuments(workspace);
  for (const [fileName, content] of Object.entries(documents)) {
    const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }
}

export function displayPokeDiscoverRoomLabel(fileName: string) {
  return fileBaseName(fileName).replace(/\.tmj$/iu, '').match(/(\d+-\d+)$/u)?.[1]
    ?? fileBaseName(fileName).replace(/\.tmj$/iu, '');
}
