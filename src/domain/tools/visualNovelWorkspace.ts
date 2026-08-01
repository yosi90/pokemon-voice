import type {
  AdventureMediaManifestV1,
  AdventureMissionDocument,
  NarrativeConversationManifestV1,
  NarrativeConversationV1,
  PmdAnimationManifestV1,
} from '../../../packages/contracts/src/index.js';
import {
  buildNarrativeManifest,
  validateNarrativeConversation,
} from '../narrative/visualNovel.js';
import type {
  PokeDiscoverDirectoryHandle,
  PokeDiscoverWritableFileHandle,
} from './pokeDiscoverEditorWorkspace.js';

export interface VisualNovelWorkspace {
  root: PokeDiscoverDirectoryHandle;
  conversations: NarrativeConversationV1[];
  fileNameByConversationId: Record<string, string>;
  mediaManifest: AdventureMediaManifestV1;
  pmdManifest: PmdAnimationManifestV1;
  missionDocuments: AdventureMissionDocument[];
  baselineByFileName: Record<string, string>;
  handlesByFileName: Record<string, PokeDiscoverWritableFileHandle>;
}

async function directoryAt(
  root: PokeDiscoverDirectoryHandle,
  segments: string[],
  create = false,
) {
  let current = root;
  for (const segment of segments) {
    if (!current.getDirectoryHandle) throw new Error('El navegador no permite recorrer subcarpetas.');
    current = await current.getDirectoryHandle(segment, { create });
  }
  return current;
}

async function fileText(
  directory: PokeDiscoverDirectoryHandle,
  fileName: string,
) {
  const handle = await directory.getFileHandle(fileName);
  return { handle, text: await (await handle.getFile()).text() };
}

async function readJsonAt<T>(
  root: PokeDiscoverDirectoryHandle,
  segments: string[],
  fileName: string,
) {
  const directory = await directoryAt(root, segments);
  const source = await fileText(directory, fileName);
  return { ...source, value: JSON.parse(source.text) as T };
}

async function collectMissionDocuments(
  directory: PokeDiscoverDirectoryHandle,
) {
  const documents: AdventureMissionDocument[] = [];
  for await (const entry of directory.values()) {
    if (entry.kind === 'directory') {
      documents.push(...await collectMissionDocuments(entry));
    } else if (entry.name.endsWith('.missions.json')) {
      try {
        const file = entry as PokeDiscoverWritableFileHandle;
        documents.push(JSON.parse(await (await file.getFile()).text()) as AdventureMissionDocument);
      } catch {
        // El cargador principal mostrará el diagnóstico específico del documento.
      }
    }
  }
  return documents;
}

export async function loadVisualNovelWorkspace(
  root: PokeDiscoverDirectoryHandle,
): Promise<VisualNovelWorkspace> {
  const permission = await root.queryPermission?.({ mode: 'readwrite' });
  if (permission === 'denied') throw new Error('La carpeta no concede permiso de lectura y escritura.');
  const narrativeSegments = ['public', 'assets', 'adventure', 'narratives'];
  const narrativeDirectory = await directoryAt(root, narrativeSegments, true);
  const manifestSource = await fileText(narrativeDirectory, 'manifest.v1.json').catch(() => undefined);
  const manifest = manifestSource
    ? JSON.parse(manifestSource.text) as NarrativeConversationManifestV1
    : { schemaVersion: 1 as const, conversations: [] };
  const conversations: NarrativeConversationV1[] = [];
  const fileNameByConversationId: Record<string, string> = {};
  const baselineByFileName: Record<string, string> = {};
  const handlesByFileName: Record<string, PokeDiscoverWritableFileHandle> = {};
  if (manifestSource) {
    baselineByFileName['manifest.v1.json'] = manifestSource.text;
    handlesByFileName['manifest.v1.json'] = manifestSource.handle;
  }
  for (const entry of manifest.conversations) {
    const fileName = entry.documentPath.split('/').at(-1);
    if (!fileName) continue;
    const source = await fileText(narrativeDirectory, fileName);
    const document = JSON.parse(source.text) as NarrativeConversationV1;
    conversations.push(document);
    fileNameByConversationId[document.conversationId] = fileName;
    baselineByFileName[fileName] = source.text;
    handlesByFileName[fileName] = source.handle;
  }
  const media = await readJsonAt<AdventureMediaManifestV1>(
    root,
    ['public', 'assets', 'adventure', 'media'],
    'manifest.v1.json',
  );
  const pmd = await readJsonAt<PmdAnimationManifestV1>(
    root,
    ['public', 'assets', 'sprites', 'pokemon', 'pmd'],
    'manifest.v1.json',
  );
  const mapsDirectory = await directoryAt(root, ['public', 'assets', 'adventure', 'maps']);
  return {
    root,
    conversations,
    fileNameByConversationId,
    mediaManifest: media.value,
    pmdManifest: pmd.value,
    missionDocuments: await collectMissionDocuments(mapsDirectory),
    baselineByFileName,
    handlesByFileName,
  };
}

function slug(value: string) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '') || 'conversation';
}

export function serializeNarrativeConversation(conversation: NarrativeConversationV1) {
  return `${JSON.stringify(conversation, null, 2)}\n`;
}

export function getVisualNovelWorkspaceDocuments(
  workspace: VisualNovelWorkspace,
  conversations = workspace.conversations,
) {
  const usedNames = new Set<string>();
  const fileNameByConversationId: Record<string, string> = {};
  const documents: Record<string, string> = {};
  for (const conversation of conversations) {
    let fileName = workspace.fileNameByConversationId[conversation.conversationId]
      ?? `${slug(conversation.conversationId.split(':').at(-1) ?? conversation.title)}.conversation.json`;
    let suffix = 2;
    const stem = fileName.replace(/\.conversation\.json$/u, '');
    while (usedNames.has(fileName)) fileName = `${stem}-${suffix++}.conversation.json`;
    usedNames.add(fileName);
    fileNameByConversationId[conversation.conversationId] = fileName;
    documents[fileName] = serializeNarrativeConversation(conversation);
  }
  const manifest = buildNarrativeManifest(conversations.map(conversation => ({
    document: conversation,
    documentPath: `assets/adventure/narratives/${fileNameByConversationId[conversation.conversationId]}`,
  })));
  documents['manifest.v1.json'] = `${JSON.stringify(manifest, null, 2)}\n`;
  return { documents, fileNameByConversationId };
}

export function getVisualNovelDirtyFiles(
  workspace: VisualNovelWorkspace,
  conversations: NarrativeConversationV1[],
) {
  const { documents } = getVisualNovelWorkspaceDocuments(workspace, conversations);
  const names = new Set([
    ...Object.keys(documents),
    ...Object.keys(workspace.baselineByFileName),
  ]);
  return [...names].filter(name => documents[name] !== workspace.baselineByFileName[name]);
}

async function writeText(
  directory: PokeDiscoverDirectoryHandle,
  name: string,
  content: string,
) {
  const handle = await directory.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
  return handle;
}

export async function saveVisualNovelWorkspace(
  workspace: VisualNovelWorkspace,
  conversations: NarrativeConversationV1[],
) {
  const validationErrors = conversations.flatMap(conversation => (
    validateNarrativeConversation(conversation, workspace.mediaManifest, workspace.pmdManifest)
      .map(error => `${conversation.title}: ${error}`)
  ));
  if (validationErrors.length) {
    throw new Error(`No se puede guardar:\n${validationErrors.join('\n')}`);
  }
  const directory = await directoryAt(
    workspace.root,
    ['public', 'assets', 'adventure', 'narratives'],
    true,
  );
  const next = getVisualNovelWorkspaceDocuments(workspace, conversations);
  const previousNames = new Set(Object.keys(workspace.baselineByFileName));
  const backup = { ...workspace.baselineByFileName };
  const written: string[] = [];
  try {
    for (const [name, content] of Object.entries(next.documents)) {
      await writeText(directory, name, content);
      written.push(name);
    }
    for (const name of previousNames) {
      if (!(name in next.documents) && name !== 'manifest.v1.json') {
        await directory.removeEntry?.(name);
      }
    }
  } catch (cause) {
    for (const [name, content] of Object.entries(backup)) {
      await writeText(directory, name, content).catch(() => undefined);
    }
    for (const name of written) {
      if (!(name in backup)) await directory.removeEntry?.(name).catch(() => undefined);
    }
    throw cause;
  }
  const handlesByFileName: Record<string, PokeDiscoverWritableFileHandle> = {};
  for (const name of Object.keys(next.documents)) {
    handlesByFileName[name] = await directory.getFileHandle(name);
  }
  return {
    ...workspace,
    conversations,
    fileNameByConversationId: next.fileNameByConversationId,
    baselineByFileName: next.documents,
    handlesByFileName,
  };
}

export async function findVisualNovelWorkspaceConflicts(
  workspace: VisualNovelWorkspace,
) {
  const conflicts: string[] = [];
  for (const [name, baseline] of Object.entries(workspace.baselineByFileName)) {
    const handle = workspace.handlesByFileName[name];
    if (!handle) continue;
    const current = await (await handle.getFile()).text().catch(() => undefined);
    if (current === undefined || current !== baseline) conflicts.push(name);
  }
  return conflicts;
}

export function findConversationDependencies(
  workspace: Pick<VisualNovelWorkspace, 'missionDocuments'>,
  conversationId: string,
) {
  return workspace.missionDocuments.flatMap(document => document.missions.flatMap(mission => {
    const legacy = mission.schemaVersion === 1
      && Object.values(mission.narratives ?? {}).includes(conversationId);
    const flow = mission.flow?.nodes.some(node => (
      node.kind === 'conversation' && node.conversationId === conversationId
    ));
    return legacy || flow ? [{ missionId: mission.missionId, title: mission.title }] : [];
  }));
}
