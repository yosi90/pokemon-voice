import type {
  AdventureMapDocument,
  AdventureMissionDocument,
  AdventureMissionDocumentV2,
  AdventureMissionManifestV2,
  MissionDefinitionV2,
  NarrativeConversationManifestV1,
  NarrativeConversationV1,
  StoryOutlineV1,
} from '../../../packages/contracts/src/index.js';
import { validateMissionFlow } from '../expeditions/missionFlow.js';
import {
  createDefaultStoryOutline,
  listedMissionIds,
  normalizeAdventureMissionDocument,
} from '../expeditions/missionV2.js';
import type {
  PokeDiscoverDirectoryHandle,
  PokeDiscoverWritableFileHandle,
} from './pokeDiscoverEditorWorkspace.js';

export const STORY_OUTLINE_PATH = 'public/assets/adventure/story/outline.v1.json';
export const STORY_MISSION_MANIFEST_PATH = 'public/assets/adventure/missions/manifest.v1.json';

export interface StoryEditorMapProject {
  directoryPath: string;
  adventureFileName: string;
  missionFileName: string;
  adventure: AdventureMapDocument;
  missionDocument: AdventureMissionDocumentV2;
  sourceMissionDocument?: AdventureMissionDocument;
}

export interface StoryEditorWorkspace {
  root: PokeDiscoverDirectoryHandle;
  maps: StoryEditorMapProject[];
  outline: StoryOutlineV1;
  conversations: NarrativeConversationV1[];
  baselineByPath: Record<string, string>;
  handlesByPath: Record<string, PokeDiscoverWritableFileHandle | undefined>;
}

interface DirectorySnapshot {
  path: string;
  directory: PokeDiscoverDirectoryHandle;
  files: Array<{ handle: PokeDiscoverWritableFileHandle; text: string }>;
}

function parseJson<T>(source: string, path: string): T {
  try {
    return JSON.parse(source) as T;
  } catch {
    throw new Error(`${path} no contiene JSON válido.`);
  }
}

async function directoryAt(
  root: PokeDiscoverDirectoryHandle,
  segments: readonly string[],
  create = false,
) {
  let current = root;
  for (const segment of segments) {
    if (!current.getDirectoryHandle) throw new Error('El navegador no permite recorrer subcarpetas.');
    current = await current.getDirectoryHandle(segment, { create });
  }
  return current;
}

async function fileAt(root: PokeDiscoverDirectoryHandle, path: string) {
  const parts = path.split('/').filter(Boolean);
  const name = parts.pop();
  if (!name) throw new Error(`Ruta de archivo inválida: ${path}.`);
  const directory = await directoryAt(root, parts);
  const handle = await directory.getFileHandle(name);
  return { handle, text: await (await handle.getFile()).text() };
}

async function collectDirectories(
  directory: PokeDiscoverDirectoryHandle,
  path: string,
  result: DirectorySnapshot[],
) {
  const snapshot: DirectorySnapshot = { path, directory, files: [] };
  result.push(snapshot);
  for await (const entry of directory.values()) {
    if ('values' in entry) {
      await collectDirectories(
        entry as PokeDiscoverDirectoryHandle,
        path ? `${path}/${entry.name}` : entry.name,
        result,
      );
    } else {
      const handle = entry as PokeDiscoverWritableFileHandle;
      snapshot.files.push({ handle, text: await (await handle.getFile()).text() });
    }
  }
}

function missionFileForAdventure(adventureFileName: string) {
  return adventureFileName.replace(/\.adventure\.json$/iu, '.missions.json');
}

function ensureOutlineAssignments(outline: StoryOutlineV1, missionIds: readonly string[]) {
  const known = new Set(missionIds);
  const assigned = new Set<string>();
  const acts = outline.acts.map(act => ({
    ...act,
    chapters: act.chapters.map(chapter => ({
      ...chapter,
      missionIds: chapter.missionIds.filter(id => {
        if (!known.has(id) || assigned.has(id)) return false;
        assigned.add(id);
        return true;
      }),
    })),
  }));
  const missing = missionIds.filter(id => !assigned.has(id));
  if (missing.length) {
    if (!acts.length) return createDefaultStoryOutline(missionIds, outline.title);
    if (!acts[0].chapters.length) {
      acts[0].chapters.push({
        schemaVersion: 1,
        chapterId: `${acts[0].actId}:chapter:01`,
        title: 'Capítulo 1',
        missionIds: missing,
      });
    } else acts[0].chapters[0].missionIds.push(...missing);
  }
  return { ...outline, acts };
}

export async function loadStoryEditorWorkspace(
  root: PokeDiscoverDirectoryHandle,
): Promise<StoryEditorWorkspace> {
  const permission = await root.queryPermission?.({ mode: 'readwrite' });
  if (permission === 'denied') throw new Error('La carpeta no concede permiso de lectura y escritura.');
  const mapsRoot = await directoryAt(root, ['public', 'assets', 'adventure', 'maps']);
  const directories: DirectorySnapshot[] = [];
  await collectDirectories(mapsRoot, 'public/assets/adventure/maps', directories);
  const baselineByPath: Record<string, string> = {};
  const handlesByPath: Record<string, PokeDiscoverWritableFileHandle | undefined> = {};
  const maps: StoryEditorMapProject[] = [];
  for (const snapshot of directories) {
    const adventures = snapshot.files.filter(file => file.handle.name.endsWith('.adventure.json'));
    if (!adventures.length) continue;
    if (adventures.length > 1) throw new Error(`${snapshot.path} contiene varios sidecars de aventura.`);
    const adventureSource = adventures[0];
    const adventurePath = `${snapshot.path}/${adventureSource.handle.name}`;
    const adventure = parseJson<AdventureMapDocument>(adventureSource.text, adventurePath);
    const missionFileName = missionFileForAdventure(adventureSource.handle.name);
    const missionSource = snapshot.files.find(file => file.handle.name === missionFileName);
    const missionPath = `${snapshot.path}/${missionFileName}`;
    const sourceMissionDocument = missionSource
      ? parseJson<AdventureMissionDocument>(missionSource.text, missionPath)
      : undefined;
    const missionDocument: AdventureMissionDocumentV2 = sourceMissionDocument
      ? normalizeAdventureMissionDocument(sourceMissionDocument)
      : { schemaVersion: 2, mapId: adventure.mapId, missions: [], narrativeSequences: [] };
    baselineByPath[adventurePath] = adventureSource.text;
    handlesByPath[adventurePath] = adventureSource.handle;
    if (missionSource) {
      baselineByPath[missionPath] = missionSource.text;
      handlesByPath[missionPath] = missionSource.handle;
    }
    maps.push({
      directoryPath: snapshot.path,
      adventureFileName: adventureSource.handle.name,
      missionFileName,
      adventure,
      missionDocument,
      sourceMissionDocument,
    });
  }
  if (!maps.length) throw new Error('No se encontraron aventuras en la raíz elegida.');

  const allMissions = maps.flatMap(map => map.missionDocument.missions);
  const outlineSource = await fileAt(root, STORY_OUTLINE_PATH).catch(() => undefined);
  if (outlineSource) {
    baselineByPath[STORY_OUTLINE_PATH] = outlineSource.text;
    handlesByPath[STORY_OUTLINE_PATH] = outlineSource.handle;
  }
  const outline = ensureOutlineAssignments(
    outlineSource
      ? parseJson<StoryOutlineV1>(outlineSource.text, STORY_OUTLINE_PATH)
      : createDefaultStoryOutline(
        allMissions.filter(mission => mission.publicationStatus !== 'draft').map(mission => mission.missionId),
      ),
    allMissions
      .filter(mission => mission.publicationStatus !== 'draft')
      .map(mission => mission.missionId),
  );

  const narrativeManifest = await fileAt(
    root,
    'public/assets/adventure/narratives/manifest.v1.json',
  ).catch(() => undefined);
  const conversations: NarrativeConversationV1[] = [];
  if (narrativeManifest) {
    const manifest = parseJson<NarrativeConversationManifestV1>(
      narrativeManifest.text,
      'public/assets/adventure/narratives/manifest.v1.json',
    );
    for (const entry of manifest.conversations) {
      const source = await fileAt(root, `public/${entry.documentPath.replace(/^assets\//u, 'assets/')}`);
      conversations.push(parseJson<NarrativeConversationV1>(source.text, entry.documentPath));
    }
  }
  const missionManifest = await fileAt(root, STORY_MISSION_MANIFEST_PATH).catch(() => undefined);
  if (missionManifest) {
    baselineByPath[STORY_MISSION_MANIFEST_PATH] = missionManifest.text;
    handlesByPath[STORY_MISSION_MANIFEST_PATH] = missionManifest.handle;
  }
  return { root, maps, outline, conversations, baselineByPath, handlesByPath };
}

function serialize(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function jsonDocumentsEqual(left: string | undefined, right: string) {
  if (left === undefined) return false;
  try {
    return JSON.stringify(JSON.parse(left)) === JSON.stringify(JSON.parse(right));
  } catch {
    return left === right;
  }
}

export function buildStoryMissionManifest(maps: readonly StoryEditorMapProject[]): AdventureMissionManifestV2 {
  return {
    schemaVersion: 2,
    missions: maps.flatMap(map => map.missionDocument.missions.flatMap(mission => (
      mission.publicationStatus === 'draft' ? [] : [{
        schemaVersion: 2 as const,
        missionId: mission.missionId,
        mapId: mission.mapId,
        documentPath: `${map.directoryPath.replace(/^public\//u, '')}/${map.missionFileName}`,
        publicationStatus: mission.publicationStatus,
      }]
    ))).sort((left, right) => left.missionId.localeCompare(right.missionId)),
  };
}

export function getStoryWorkspaceDocuments(
  workspace: StoryEditorWorkspace,
  maps = workspace.maps,
  outline = workspace.outline,
) {
  const documents: Record<string, string> = {
    [STORY_OUTLINE_PATH]: serialize(outline),
    [STORY_MISSION_MANIFEST_PATH]: serialize(buildStoryMissionManifest(maps)),
  };
  for (const map of maps) {
    const missionPath = `${map.directoryPath}/${map.missionFileName}`;
    const adventurePath = `${map.directoryPath}/${map.adventureFileName}`;
    const missionIds = listedMissionIds(map.missionDocument);
    documents[missionPath] = serialize(map.missionDocument);
    documents[adventurePath] = serialize({ ...map.adventure, missionIds });
  }
  return documents;
}

function allMissions(maps: readonly StoryEditorMapProject[]) {
  return maps.flatMap(map => map.missionDocument.missions);
}

function assignmentCounts(outline: StoryOutlineV1) {
  const counts = new Map<string, number>();
  for (const act of outline.acts) for (const chapter of act.chapters) {
    for (const missionId of chapter.missionIds) counts.set(missionId, (counts.get(missionId) ?? 0) + 1);
  }
  return counts;
}

export function validateStoryWorkspace(
  maps: readonly StoryEditorMapProject[],
  outline: StoryOutlineV1,
  conversations: readonly NarrativeConversationV1[],
) {
  const errors: string[] = [];
  const missions = allMissions(maps);
  const missionById = new Map(missions.map(mission => [mission.missionId, mission]));
  const missionIds = new Set<string>();
  const mapIds = new Set(maps.map(map => map.adventure.mapId));
  const conversationIds = new Set(conversations.map(item => item.conversationId));
  const assignments = assignmentCounts(outline);
  for (const mission of missions) {
    if (!mission.missionId || missionIds.has(mission.missionId)) errors.push(`Misión duplicada o sin ID: ${mission.missionId}.`);
    missionIds.add(mission.missionId);
    if (!mapIds.has(mission.mapId)) errors.push(`${mission.missionId}: mapa propietario inexistente ${mission.mapId}.`);
    if (mission.publicationStatus === 'published' && assignments.get(mission.missionId) !== 1) {
      errors.push(`${mission.missionId}: una misión publicada debe pertenecer a un capítulo.`);
    }
    if (mission.publicationStatus === 'draft') continue;
    if (!mission.flow) {
      errors.push(`${mission.missionId}: una misión publicable necesita flujo.`);
      continue;
    }
    errors.push(...validateMissionFlow(mission.flow).map(error => `${mission.missionId}: ${error}`));
    for (const node of mission.flow.nodes) {
      if (node.kind === 'conversation' && !conversationIds.has(node.conversationId)) {
        errors.push(`${mission.missionId}: conversación inexistente ${node.conversationId}.`);
      }
      if (node.kind === 'conversation') {
        const conversation = conversations.find(item => item.conversationId === node.conversationId);
        const emittedOutcomes = new Set(conversation?.cues
          .map(cue => 'outcomeId' in cue ? cue.outcomeId : undefined)
          .filter((outcomeId): outcomeId is string => Boolean(outcomeId)) ?? []);
        for (const outcomeId of Object.keys(node.outcomes)) {
          if (!emittedOutcomes.has(outcomeId)) {
            errors.push(`${mission.missionId}: ${node.conversationId} no puede emitir ${outcomeId}.`);
          }
        }
      }
      if (node.kind === 'expedition' && !mapIds.has(node.mapId)) {
        errors.push(`${mission.missionId}: mapa de expedición inexistente ${node.mapId}.`);
      }
    }
    const hasSuccess = mission.flow.nodes.some(node => node.kind === 'terminal' && node.result === 'success');
    if (!hasSuccess) errors.push(`${mission.missionId}: falta un final de éxito.`);
  }
  for (const mission of missions) {
    if (!mission.availability) continue;
    const visit = (value: typeof mission.availability): void => {
      if ('all' in value) value.all.forEach(visit);
      else if ('any' in value) value.any.forEach(visit);
      else if (value.kind === 'completedMission' && !missionIds.has(value.missionId)) {
        errors.push(`${mission.missionId}: dependencia inexistente ${value.missionId}.`);
      } else if (value.kind === 'completedMission'
        && mission.publicationStatus === 'published'
        && missionById.get(value.missionId)?.publicationStatus === 'draft') {
        errors.push(`${mission.missionId}: una misión publicada no puede depender del borrador ${value.missionId}.`);
      }
    };
    visit(mission.availability);
  }
  return [...new Set(errors)];
}

export function getStoryDirtyPaths(
  workspace: StoryEditorWorkspace,
  maps = workspace.maps,
  outline = workspace.outline,
) {
  const documents = getStoryWorkspaceDocuments(workspace, maps, outline);
  return Object.keys(documents).filter(path => (
    !jsonDocumentsEqual(workspace.baselineByPath[path], documents[path])
  ));
}

async function writePath(root: PokeDiscoverDirectoryHandle, path: string, content: string) {
  const segments = path.split('/');
  const name = segments.pop()!;
  const directory = await directoryAt(root, segments, true);
  const handle = await directory.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
  return handle;
}

export async function findStoryWorkspaceConflicts(workspace: StoryEditorWorkspace) {
  const conflicts: string[] = [];
  for (const [path, baseline] of Object.entries(workspace.baselineByPath)) {
    const handle = workspace.handlesByPath[path];
    if (!handle) continue;
    const current = await (await handle.getFile()).text().catch(() => undefined);
    if (current !== baseline) conflicts.push(path);
  }
  return conflicts;
}

export async function saveStoryEditorWorkspace(
  workspace: StoryEditorWorkspace,
  maps: StoryEditorMapProject[],
  outline: StoryOutlineV1,
) {
  const errors = validateStoryWorkspace(maps, outline, workspace.conversations)
    .filter(error => {
      const missionId = error.split(': ').at(0);
      const mission = allMissions(maps).find(item => item.missionId === missionId);
      return mission?.publicationStatus !== 'draft';
    });
  if (errors.length) throw new Error(`No se puede guardar:\n${errors.join('\n')}`);
  const conflicts = await findStoryWorkspaceConflicts(workspace);
  if (conflicts.length) throw new Error(`Archivos modificados fuera del editor:\n${conflicts.join('\n')}`);
  const documents = getStoryWorkspaceDocuments(workspace, maps, outline);
  const previous: Record<string, string | undefined> = {};
  const written: string[] = [];
  try {
    for (const map of maps) {
      if (map.sourceMissionDocument?.schemaVersion !== 1) continue;
      const sourcePath = `${map.directoryPath}/${map.missionFileName}`;
      const backupPath = sourcePath.replace(/\.missions\.json$/u, '.missions.v1.backup.json');
      const source = workspace.baselineByPath[sourcePath];
      const existing = await fileAt(workspace.root, backupPath).catch(() => undefined);
      if (existing && existing.text !== source) {
        throw new Error(`${backupPath} no coincide con el documento V1 actual.`);
      }
      if (!existing && source !== undefined) {
        previous[backupPath] = undefined;
        await writePath(workspace.root, backupPath, source);
        written.push(backupPath);
      }
    }
    for (const [path, content] of Object.entries(documents)) {
      if (jsonDocumentsEqual(workspace.baselineByPath[path], content)) continue;
      previous[path] = workspace.baselineByPath[path];
      await writePath(workspace.root, path, content);
      written.push(path);
    }
  } catch (cause) {
    for (const path of written.reverse()) {
      const old = previous[path];
      if (old !== undefined) await writePath(workspace.root, path, old).catch(() => undefined);
      else {
        const parts = path.split('/');
        const name = parts.pop()!;
        const directory = await directoryAt(workspace.root, parts).catch(() => undefined);
        await directory?.removeEntry?.(name).catch(() => undefined);
      }
    }
    throw cause;
  }
  return loadStoryEditorWorkspace(workspace.root);
}

export function replaceStoryMission(
  maps: readonly StoryEditorMapProject[],
  mission: MissionDefinitionV2,
) {
  const exists = maps.some(map => map.missionDocument.missions
    .some(candidate => candidate.missionId === mission.missionId));
  if (!exists) return maps.map(map => map);
  return maps.map(map => {
    const remaining = map.missionDocument.missions
      .filter(candidate => candidate.missionId !== mission.missionId);
    return {
      ...map,
      missionDocument: {
        ...map.missionDocument,
        mapId: map.adventure.mapId,
        missions: map.adventure.mapId === mission.mapId ? [...remaining, mission] : remaining,
      },
    };
  });
}

export function removeStoryDraft(
  maps: readonly StoryEditorMapProject[],
  missionId: string,
) {
  return maps.map(map => ({
    ...map,
    missionDocument: {
      ...map.missionDocument,
      missions: map.missionDocument.missions.filter(mission => mission.missionId !== missionId),
    },
  }));
}
