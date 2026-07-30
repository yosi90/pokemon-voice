import type {
  AdventureMapDocument,
  AdventureMissionDocumentV1,
  AdventureMissionManifestV1,
} from '../../../packages/contracts/src/index.js';
import type {
  PokeDiscoverDirectoryHandle,
  PokeDiscoverWorkspaceSourceFile,
  PokeDiscoverWritableFileHandle,
} from './pokeDiscoverEditorWorkspace.js';

export interface PokeDiscoverRootProject {
  projectPath: string;
  projectName: string;
  mapId: string;
  title: string;
  directoryHandle?: PokeDiscoverDirectoryHandle;
  files: PokeDiscoverWorkspaceSourceFile[];
  sectors: Array<{ sectorId: string; label: string }>;
  missions: Array<{ missionId: string; title: string }>;
}

export interface PokeDiscoverProjectRoot {
  rootName: string;
  directoryHandle?: PokeDiscoverDirectoryHandle;
  projects: PokeDiscoverRootProject[];
}

function projectFromDocuments(
  projectPath: string,
  projectName: string,
  files: PokeDiscoverWorkspaceSourceFile[],
  adventure: AdventureMapDocument,
  missionDocument?: AdventureMissionDocumentV1,
  directoryHandle?: PokeDiscoverDirectoryHandle,
): PokeDiscoverRootProject {
  const sectors = adventure.schemaVersion === 3
    ? adventure.sectors.map(sector => ({
      sectorId: sector.sectorId,
      label: sector.sectorId.split(':').at(-1) ?? sector.sectorId,
    }))
    : adventure.rooms.map(room => ({
      sectorId: room.roomId,
      label: room.roomId.split(':').at(-1) ?? room.roomId,
    }));
  return {
    projectPath,
    projectName,
    mapId: adventure.mapId,
    title: adventure.title,
    directoryHandle,
    files,
    sectors,
    missions: missionDocument?.missions.map(mission => ({
      missionId: mission.missionId,
      title: mission.title,
    })) ?? [],
  };
}

export async function discoverPokeDiscoverProjectFiles(
  files: PokeDiscoverWorkspaceSourceFile[],
): Promise<PokeDiscoverProjectRoot> {
  const groups = new Map<string, PokeDiscoverWorkspaceSourceFile[]>();
  let rootName = 'proyecto';
  for (const source of files) {
    const relative = source.file.webkitRelativePath.replaceAll('\\', '/');
    const parts = relative ? relative.split('/') : [source.file.name];
    if (relative) rootName = parts[0] || rootName;
    const directory = relative && parts.length > 1
      ? parts.slice(1, -1).join('/') || '.'
      : '.';
    groups.set(directory, [...(groups.get(directory) ?? []), source]);
  }
  const projects: PokeDiscoverRootProject[] = [];
  for (const [projectPath, groupedFiles] of groups) {
    const sidecars = groupedFiles.filter(source => (
      source.file.name.toLocaleLowerCase().endsWith('.adventure.json')
    ));
    if (!sidecars.length) continue;
    if (sidecars.length > 1) {
      throw new Error(`${projectPath} contiene varios .adventure.json.`);
    }
    const adventure = parseJson<AdventureMapDocument>(
      sidecars[0].file,
      await sidecars[0].file.text(),
    );
    if (![2, 3].includes(adventure.schemaVersion) || typeof adventure.mapId !== 'string') {
      throw new Error(`${sidecars[0].file.name} no es una aventura compatible.`);
    }
    const missionSource = groupedFiles.find(source => (
      source.file.name.toLocaleLowerCase().endsWith('.missions.json')
    ));
    const missionDocument = missionSource
      ? parseJson<AdventureMissionDocumentV1>(
        missionSource.file,
        await missionSource.file.text(),
      )
      : undefined;
    projects.push(projectFromDocuments(
      projectPath,
      projectPath.split('/').at(-1) || rootName,
      groupedFiles,
      adventure,
      missionDocument,
    ));
  }
  projects.sort((left, right) => left.title.localeCompare(right.title));
  if (!projects.length) {
    throw new Error('No se encontró ningún proyecto .adventure.json en la carpeta elegida.');
  }
  return { rootName, projects };
}

async function nestedDirectory(
  root: PokeDiscoverDirectoryHandle,
  segments: readonly string[],
) {
  let current = root;
  for (const segment of segments) {
    if (!current.getDirectoryHandle) {
      throw new Error('El navegador no permite actualizar el manifiesto global de misiones.');
    }
    current = await current.getDirectoryHandle(segment, { create: true });
  }
  return current;
}

async function missionDocumentForProject(
  project: PokeDiscoverRootProject,
  currentDocument?: AdventureMissionDocumentV1,
) {
  if (currentDocument?.mapId === project.mapId) return currentDocument;
  const source = project.files.find(candidate => (
    candidate.file.name.toLocaleLowerCase().endsWith('.missions.json')
  ));
  return source
    ? parseJson<AdventureMissionDocumentV1>(source.file, await source.file.text())
    : undefined;
}

export async function buildPokeDiscoverMissionManifest(
  root: PokeDiscoverProjectRoot,
  currentDocument?: AdventureMissionDocumentV1,
  currentFileName?: string,
): Promise<AdventureMissionManifestV1> {
  const usedIds = new Set<string>();
  const missions = [];
  for (const project of root.projects) {
    const document = await missionDocumentForProject(project, currentDocument);
    if (!document) continue;
    const missionFile = currentDocument?.mapId === project.mapId && currentFileName
      ? currentFileName
      : project.files.find(candidate => (
        candidate.file.name.toLocaleLowerCase().endsWith('.missions.json')
      ))?.file.name ?? `${project.projectName}.missions.json`;
    const directory = project.projectPath === '.' ? '' : `${project.projectPath}/`;
    const documentPath = `${directory}${missionFile}`.replace(/^public\//u, '');
    for (const mission of document.missions) {
      if (mission.mapId !== document.mapId) {
        throw new Error(`${mission.missionId} apunta a un mapa distinto de su documento.`);
      }
      if (usedIds.has(mission.missionId)) {
        throw new Error(`Misión duplicada en el manifiesto global: ${mission.missionId}.`);
      }
      usedIds.add(mission.missionId);
      missions.push({
        schemaVersion: 1 as const,
        missionId: mission.missionId,
        mapId: mission.mapId,
        documentPath,
      });
    }
  }
  missions.sort((left, right) => left.missionId.localeCompare(right.missionId));
  return { schemaVersion: 1, missions };
}

/**
 * Incluye el manifiesto global en la misma operación lógica que el guardado del
 * workspace. Si la escritura posterior falla, restaura el manifiesto anterior.
 */
export async function withPokeDiscoverMissionManifestTransaction<Result>(
  root: PokeDiscoverProjectRoot,
  currentDocument: AdventureMissionDocumentV1 | undefined,
  currentFileName: string | undefined,
  operation: () => Promise<Result>,
): Promise<Result> {
  if (!root.directoryHandle) return operation();
  const directory = await nestedDirectory(
    root.directoryHandle,
    ['public', 'assets', 'adventure', 'missions'],
  );
  let handle: PokeDiscoverWritableFileHandle;
  let previous: string | undefined;
  try {
    handle = await directory.getFileHandle('manifest.v1.json');
    previous = await (await handle.getFile()).text();
  } catch {
    handle = await directory.getFileHandle('manifest.v1.json', { create: true });
  }
  const manifest = await buildPokeDiscoverMissionManifest(
    root,
    currentDocument,
    currentFileName,
  );
  const writable = await handle.createWritable();
  await writable.write(`${JSON.stringify(manifest, null, 2)}\n`);
  await writable.close();
  try {
    return await operation();
  } catch (cause) {
    if (previous === undefined) {
      await directory.removeEntry?.('manifest.v1.json');
    } else {
      const rollback = await handle.createWritable();
      await rollback.write(previous);
      await rollback.close();
    }
    throw cause;
  }
}

interface DirectorySnapshot {
  path: string;
  handle: PokeDiscoverDirectoryHandle;
  files: PokeDiscoverWorkspaceSourceFile[];
}

async function readDirectoryTree(
  handle: PokeDiscoverDirectoryHandle,
  path = '',
  result: DirectorySnapshot[] = [],
): Promise<DirectorySnapshot[]> {
  const snapshot: DirectorySnapshot = { path, handle, files: [] };
  result.push(snapshot);
  for await (const entry of handle.values()) {
    if ('getFile' in entry) {
      snapshot.files.push({ file: await entry.getFile(), handle: entry });
    } else if ('values' in entry) {
      await readDirectoryTree(entry, path ? `${path}/${entry.name}` : entry.name, result);
    }
  }
  return result;
}

function parseJson<T>(file: File, source: string) {
  try {
    return JSON.parse(source) as T;
  } catch {
    throw new Error(`${file.name} no contiene JSON válido.`);
  }
}

export async function discoverPokeDiscoverProjectRoot(
  directoryHandle: PokeDiscoverDirectoryHandle,
): Promise<PokeDiscoverProjectRoot> {
  const directories = await readDirectoryTree(directoryHandle);
  const projects: PokeDiscoverRootProject[] = [];
  for (const directory of directories) {
    const sidecars = directory.files.filter(source => (
      source.file.name.toLocaleLowerCase().endsWith('.adventure.json')
    ));
    if (!sidecars.length) continue;
    if (sidecars.length > 1) {
      throw new Error(`${directory.path || directoryHandle.name} contiene varios .adventure.json.`);
    }
    const sidecarSource = sidecars[0];
    const adventure = parseJson<AdventureMapDocument>(
      sidecarSource.file,
      await sidecarSource.file.text(),
    );
    if (![2, 3].includes(adventure.schemaVersion) || typeof adventure.mapId !== 'string') {
      throw new Error(`${sidecarSource.file.name} no es una aventura compatible.`);
    }
    const missionSource = directory.files.find(source => (
      source.file.name.toLocaleLowerCase().endsWith('.missions.json')
    ));
    const missionDocument = missionSource
      ? parseJson<AdventureMissionDocumentV1>(missionSource.file, await missionSource.file.text())
      : undefined;
    const sectors = adventure.schemaVersion === 3
      ? adventure.sectors.map(sector => ({
        sectorId: sector.sectorId,
        label: sector.sectorId.split(':').at(-1) ?? sector.sectorId,
      }))
      : adventure.rooms.map(room => ({
        sectorId: room.roomId,
        label: room.roomId.split(':').at(-1) ?? room.roomId,
      }));
    projects.push({
      projectPath: directory.path || '.',
      projectName: directory.path.split('/').at(-1) || directoryHandle.name,
      mapId: adventure.mapId,
      title: adventure.title,
      directoryHandle: directory.handle,
      files: directory.files,
      sectors,
      missions: missionDocument?.missions.map(mission => ({
        missionId: mission.missionId,
        title: mission.title,
      })) ?? [],
    });
  }
  projects.sort((left, right) => left.title.localeCompare(right.title));
  if (!projects.length) {
    throw new Error('No se encontró ningún proyecto .adventure.json en la carpeta elegida.');
  }
  return {
    rootName: directoryHandle.name,
    directoryHandle,
    projects,
  };
}
