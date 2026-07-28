import type {
  AdventureMapDocument,
  AdventureMapV3,
} from '../../../packages/contracts/src/index.js';
import { normalizeAdventureMapV3 } from '../expeditions/adventureMapV3.js';
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
  queryPermission?(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission?(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
  getFileHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<PokeDiscoverWritableFileHandle>;
  removeEntry?(name: string): Promise<void>;
}

export interface PokeDiscoverWorkspaceSourceFile {
  file: File;
  handle?: PokeDiscoverWritableFileHandle;
}

export interface PokeDiscoverWorkspaceSnapshot {
  adventure: AdventureMapV3;
  tilemapsByFileName: Record<string, PokeDiscoverEditableTiledMap>;
  world: PokeDiscoverWorldFile;
  registrations: PokeDiscoverRoomRegistration[];
  sourceFileNameByFileName: Record<string, string>;
}

export interface PokeDiscoverWorkspace {
  projectName: string;
  sidecarFileName: string;
  worldFileName: string;
  /** @deprecated Use history.present.registrations so undo/redo remains atomic. */
  registrations: PokeDiscoverRoomRegistration[];
  history: PokeDiscoverEditorHistory<PokeDiscoverWorkspaceSnapshot>;
  baselineByFileName: Record<string, string>;
  diskContentByFileName: Record<string, string>;
  lastModifiedByFileName: Record<string, number>;
  handlesByFileName: Record<string, PokeDiscoverWritableFileHandle | undefined>;
  directoryHandle?: PokeDiscoverDirectoryHandle;
  createdProject: boolean;
  pendingLayout: boolean;
  sourceSchemaVersion: 2 | 3;
  legacySidecarSource?: string;
  legacyBackup?: {
    fileName: string;
    lastModified: number;
    matchesSource: boolean;
    recent: boolean;
  };
}

export interface PokeDiscoverProjectMetadata {
  title: string;
  mapId: string;
}

export interface PokeDiscoverWorkspaceInspection {
  sidecars: PokeDiscoverWorkspaceSourceFile[];
  tiledMaps: PokeDiscoverWorkspaceSourceFile[];
  worlds: PokeDiscoverWorkspaceSourceFile[];
  archivedTiledMaps: PokeDiscoverWorkspaceSourceFile[];
  legacyBackups: PokeDiscoverWorkspaceSourceFile[];
}

export const RECENT_LEGACY_BACKUP_MAX_AGE_MS = 60 * 60 * 1000;

export function isPokeDiscoverLegacyBackupRecent(
  lastModified: number,
  now = Date.now(),
) {
  return Number.isFinite(lastModified)
    && now - lastModified <= RECENT_LEGACY_BACKUP_MAX_AGE_MS;
}

export function legacyBackupFileName(sidecarFileName: string) {
  return sidecarFileName.replace(/\.adventure\.json$/iu, '.adventure.v2.backup.json');
}

function parseJson(source: string, fileName: string) {
  try {
    return JSON.parse(source) as unknown;
  } catch {
    throw new Error(`${fileName} no contiene JSON válido.`);
  }
}

function requireAdventureMap(value: unknown, fileName: string): AdventureMapDocument {
  if (!value || typeof value !== 'object') {
    throw new Error(`${fileName} debe contener un proyecto de aventura.`);
  }
  const candidate = value as Partial<AdventureMapDocument>;
  if (![2, 3].includes(Number(candidate.schemaVersion)) || typeof candidate.mapId !== 'string') {
    throw new Error(`${fileName} no cumple el contrato actual de proyecto.`);
  }
  const hasSpatialList = candidate.schemaVersion === 3
    ? Array.isArray((candidate as Partial<AdventureMapV3>).sectors)
    : Array.isArray((candidate as { rooms?: unknown }).rooms);
  if (!hasSpatialList || !Array.isArray(candidate.tiledMapAssets)) {
    throw new Error(`${fileName} no declara sectores/habitaciones y mapas de Tiled.`);
  }
  return candidate as AdventureMapDocument;
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

function sidecarDirectory(adventure: AdventureMapV3) {
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
    archivedTiledMaps: files.filter(source => /\.tmj(?:\.\d+)?\.old$/iu.test(source.file.name)),
    legacyBackups: files.filter(source => /\.adventure\.v2\.backup\.json$/iu.test(source.file.name)),
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

export async function requestPokeDiscoverDirectoryWritePermission(
  directoryHandle: PokeDiscoverDirectoryHandle,
) {
  const permission = await directoryHandle.queryPermission?.({
    mode: 'readwrite',
  }) ?? 'granted';
  if (permission !== 'prompt') return permission;
  return directoryHandle.requestPermission?.({
    mode: 'readwrite',
  }) ?? 'denied';
}

export async function attachPokeDiscoverWorkspaceDirectory(
  workspace: PokeDiscoverWorkspace,
  directoryHandle: PokeDiscoverDirectoryHandle,
) {
  const files = await readPokeDiscoverDirectory(directoryHandle);
  const inspection = inspectPokeDiscoverWorkspaceFiles(files);
  const selectedSidecar = inspection.sidecars.find(
    source => source.file.name === workspace.sidecarFileName,
  );
  if (!workspace.createdProject && !selectedSidecar) {
    throw new Error(`Selecciona la carpeta que contiene ${workspace.sidecarFileName}.`);
  }
  if (selectedSidecar) {
    let selectedMapId = '';
    try {
      selectedMapId = String(JSON.parse(await selectedSidecar.file.text()).mapId ?? '');
    } catch {
      throw new Error(`${workspace.sidecarFileName} no contiene un proyecto válido.`);
    }
    if (selectedMapId !== workspace.history.present.adventure.mapId) {
      throw new Error('La carpeta seleccionada pertenece a otro mapa.');
    }
  }
  const selectedFileNames = new Set(files.map(source => source.file.name));
  const missingTilemap = Object.keys(workspace.history.present.tilemapsByFileName)
    .find(fileName => !selectedFileNames.has(
      workspace.history.present.sourceFileNameByFileName[fileName] ?? fileName,
    ));
  if (missingTilemap) {
    throw new Error(`La carpeta seleccionada no contiene ${missingTilemap}.`);
  }
  const handlesByFileName = { ...workspace.handlesByFileName };
  const diskContentByFileName = { ...workspace.diskContentByFileName };
  const lastModifiedByFileName = { ...workspace.lastModifiedByFileName };
  for (const source of files) {
    handlesByFileName[source.file.name] = source.handle;
    diskContentByFileName[source.file.name] = await source.file.text();
    lastModifiedByFileName[source.file.name] = source.file.lastModified;
  }
  return {
    ...workspace,
    directoryHandle,
    handlesByFileName,
    diskContentByFileName,
    lastModifiedByFileName,
  };
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
    ...inspection.archivedTiledMaps,
    ...inspection.worlds,
    ...inspection.legacyBackups,
  ];
  for (const source of documentSources) {
    rawByFileName[source.file.name] = await source.file.text();
    lastModifiedByFileName[source.file.name] = source.file.lastModified;
    handlesByFileName[source.file.name] = source.handle;
  }

  const existingSidecar = inspection.sidecars[0];
  const adventureDocument = existingSidecar
    ? requireAdventureMap(
      parseJson(rawByFileName[existingSidecar.file.name], existingSidecar.file.name),
      existingSidecar.file.name,
    )
    : createPokeDiscoverAdventure(metadata!);
  const sourceSchemaVersion = adventureDocument.schemaVersion;
  const adventure = normalizeAdventureMapV3(adventureDocument);
  const effectiveName = projectName || directoryHandle?.name || metadata?.title || adventure.title;
  const slug = slugifyEditorLabel(adventure.mapId.split(':').at(-1) || effectiveName);
  const sidecarFileName = existingSidecar?.file.name ?? `${slug}.adventure.json`;
  const backupFileName = legacyBackupFileName(sidecarFileName);
  const legacyBackupSource = inspection.legacyBackups.find(
    source => source.file.name === backupFileName,
  );
  const existingWorld = inspection.worlds[0];
  const worldFileName = existingWorld?.file.name
    ?? sidecarFileName.replace(/\.adventure\.json$/iu, '.world');

  const baselineByFileName: Record<string, string> = {};
  if (existingSidecar) {
    baselineByFileName[sidecarFileName] = serializePokeDiscoverProjectJson(adventure);
  }
  const tiledSources = [...inspection.tiledMaps, ...inspection.archivedTiledMaps];
  const sources: PokeDiscoverTiledSource[] = tiledSources.map(source => {
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
  const world = existingWorld ? parsedWorld : mergePokeDiscoverWorldSources(parsedWorld, sources);
  const placedFileNames = new Set(world.maps.map(entry => fileBaseName(entry.fileName)));
  const registrations = registered.registrations.map(registration => ({
    ...registration,
    archived: /\.tmj(?:\.\d+)?\.old$/iu.test(registration.fileName)
      || !placedFileNames.has(fileBaseName(registration.fileName)),
  }));
  const snapshot: PokeDiscoverWorkspaceSnapshot = {
    adventure: registered.adventure,
    tilemapsByFileName: Object.fromEntries(sources.map(source => [source.fileName, source.tilemap])),
    world,
    registrations,
    sourceFileNameByFileName: Object.fromEntries(sources.map(source => [source.fileName, source.fileName])),
  };

  return {
    projectName: effectiveName,
    sidecarFileName,
    worldFileName,
    registrations,
    history: createPokeDiscoverEditorHistory(snapshot),
    baselineByFileName,
    diskContentByFileName: rawByFileName,
    lastModifiedByFileName,
    handlesByFileName,
    directoryHandle,
    createdProject,
    pendingLayout: !existingWorld,
    sourceSchemaVersion,
    legacySidecarSource: sourceSchemaVersion === 2 && existingSidecar
      ? rawByFileName[existingSidecar.file.name]
      : undefined,
    legacyBackup: sourceSchemaVersion === 2 && existingSidecar && legacyBackupSource
      ? {
        fileName: backupFileName,
        lastModified: legacyBackupSource.file.lastModified,
        matchesSource: rawByFileName[backupFileName] === rawByFileName[existingSidecar.file.name],
        recent: isPokeDiscoverLegacyBackupRecent(legacyBackupSource.file.lastModified),
      }
      : undefined,
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

export function markPokeDiscoverWorkspaceExported(
  workspace: PokeDiscoverWorkspace,
  options?: { dirtyOnly?: boolean },
) {
  const documents = getPokeDiscoverWorkspaceDocuments(workspace);
  const exportedFileNames = options?.dirtyOnly
    ? getPokeDiscoverWorkspaceDirtyFiles(workspace)
    : Object.keys(documents);
  const baselineByFileName = { ...workspace.baselineByFileName };
  for (const fileName of exportedFileNames) {
    baselineByFileName[fileName] = documents[fileName];
  }
  return {
    ...workspace,
    baselineByFileName,
  };
}

export async function findPokeDiscoverWorkspaceConflicts(workspace: PokeDiscoverWorkspace) {
  const conflicts: string[] = [];
  const documents = getPokeDiscoverWorkspaceDocuments(workspace);
  const renameSources = new Set(Object.values(workspace.history.present.sourceFileNameByFileName));
  for (const [fileName, diskContent] of Object.entries(workspace.diskContentByFileName)) {
    const handle = workspace.handlesByFileName[fileName];
    if (!handle || (!(fileName in documents) && !renameSources.has(fileName))) continue;
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
  const finalNames = new Set(Object.keys(documents));
  const renamedSources = new Set(Object.entries(workspace.history.present.sourceFileNameByFileName)
    .filter(([target, source]) => target !== source && !finalNames.has(source))
    .map(([, source]) => source));
  if (renamedSources.size && !workspace.directoryHandle.removeEntry) {
    throw new Error('El navegador no permite completar el renombrado de archivos. Usa Exportar copia.');
  }
  const orderedNames = [
    ...Object.keys(workspace.history.present.tilemapsByFileName)
      .filter(fileName => dirtyFiles.has(fileName)),
    ...(dirtyFiles.has(workspace.worldFileName) ? [workspace.worldFileName] : []),
    ...(dirtyFiles.has(workspace.sidecarFileName) ? [workspace.sidecarFileName] : []),
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
  for (const sourceName of renamedSources) {
    await workspace.directoryHandle.removeEntry?.(sourceName);
    delete handlesByFileName[sourceName];
    delete baselineByFileName[sourceName];
    delete diskContentByFileName[sourceName];
    delete lastModifiedByFileName[sourceName];
  }
  const sourceFileNameByFileName = Object.fromEntries(
    Object.keys(workspace.history.present.tilemapsByFileName).map(fileName => [fileName, fileName]),
  );
  return {
    ...workspace,
    registrations: workspace.history.present.registrations,
    handlesByFileName,
    baselineByFileName,
    diskContentByFileName,
    lastModifiedByFileName,
    createdProject: false,
    history: {
      ...workspace.history,
      present: { ...workspace.history.present, sourceFileNameByFileName },
    },
  };
}

export async function migratePokeDiscoverWorkspaceToV3(
  workspace: PokeDiscoverWorkspace,
) {
  if (workspace.sourceSchemaVersion !== 2 || !workspace.legacySidecarSource) {
    throw new Error('El proyecto abierto no necesita migración V2.');
  }
  const backupFileName = legacyBackupFileName(workspace.sidecarFileName);
  const backupReused = Boolean(
    workspace.legacyBackup?.recent && workspace.legacyBackup.matchesSource,
  );
  if (workspace.legacyBackup?.recent && !workspace.legacyBackup.matchesSource) {
    throw new Error(`${backupFileName} es reciente, pero no corresponde al documento V2 abierto.`);
  }
  if (!backupReused && workspace.directoryHandle) {
    const handle = await workspace.directoryHandle.getFileHandle(backupFileName, { create: true });
    const existing = await handle.getFile();
    const existingSource = await existing.text();
    if (existingSource && existingSource !== workspace.legacySidecarSource) {
      throw new Error(`${backupFileName} ya existe con un contenido diferente.`);
    }
    const writable = await handle.createWritable();
    await writable.write(workspace.legacySidecarSource);
    await writable.close();
  } else if (!backupReused && typeof document !== 'undefined') {
    const url = URL.createObjectURL(new Blob(
      [workspace.legacySidecarSource],
      { type: 'application/json' },
    ));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = backupFileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  return {
    workspace: {
      ...workspace,
      sourceSchemaVersion: 3 as const,
      legacySidecarSource: undefined,
      legacyBackup: undefined,
    },
    backupFileName,
    backupReused,
  };
}

export function downloadPokeDiscoverWorkspaceCopy(
  workspace: PokeDiscoverWorkspace,
  options?: { dirtyOnly?: boolean },
) {
  if (typeof document === 'undefined') return;
  const documents = getPokeDiscoverWorkspaceDocuments(workspace);
  const dirtyFiles = options?.dirtyOnly
    ? new Set(getPokeDiscoverWorkspaceDirtyFiles(workspace))
    : undefined;
  for (const [fileName, content] of Object.entries(documents)
    .filter(([fileName]) => !dirtyFiles || dirtyFiles.has(fileName))) {
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
