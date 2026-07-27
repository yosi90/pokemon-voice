import type {
  PokeDiscoverDirectoryHandle,
  PokeDiscoverWorkspaceSourceFile,
} from './pokeDiscoverEditorWorkspace.js';

const DATABASE_NAME = 'pokediscover-editor';
const STORE_NAME = 'recent-folders';
const LEGACY_DIRECTORY_KEY = 'last-directory-v1';
const LAST_SNAPSHOT_KEY = 'last-directory-snapshot-v2';
const LAST_HANDLE_KEY = 'last-directory-handle-v2';

export const POKEDISCOVER_RECENT_FOLDER_TTL_MS = 24 * 60 * 60 * 1_000;

export interface PokeDiscoverRecentFolder {
  directoryHandle?: PokeDiscoverDirectoryHandle;
  files: File[];
  projectName: string;
  savedAt: number;
  expiresAt: number;
}

interface StoredRecentFolderSnapshot {
  files: File[];
  projectName: string;
  savedAt: number;
  expiresAt: number;
}

interface StoredRecentFolderHandle {
  directoryHandle: PokeDiscoverDirectoryHandle;
  projectName: string;
}

interface LegacyRecentFolder {
  directoryHandle: PokeDiscoverDirectoryHandle;
  savedAt: number;
  expiresAt: number;
}

export function isPokeDiscoverRecentFolderValid(
  recent: Pick<PokeDiscoverRecentFolder, 'expiresAt'>,
  now = Date.now(),
) {
  return Number.isFinite(recent.expiresAt) && recent.expiresAt >= now;
}

function isCachedProjectDocument(file: File) {
  const name = file.name.toLocaleLowerCase();
  return name.endsWith('.adventure.json')
    || name.endsWith('.tmj')
    || name.endsWith('.world')
    || /\.tmj(?:\.\d+)?\.old$/u.test(name);
}

function openRecentFolderDatabase() {
  if (typeof indexedDB === 'undefined') return Promise.resolve<IDBDatabase | undefined>(undefined);
  return new Promise<IDBDatabase | undefined>(resolve => {
    try {
      const request = indexedDB.open(DATABASE_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(undefined);
      request.onblocked = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

async function useRecentFolderStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const database = await openRecentFolderDatabase();
  if (!database) return undefined;
  return new Promise<T | undefined>(resolve => {
    try {
      const transaction = database.transaction(STORE_NAME, mode);
      const request = operation(transaction.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(undefined);
      transaction.oncomplete = () => database.close();
      transaction.onerror = () => {
        database.close();
        resolve(undefined);
      };
      transaction.onabort = () => {
        database.close();
        resolve(undefined);
      };
    } catch {
      database.close();
      resolve(undefined);
    }
  });
}

export async function rememberPokeDiscoverRecentFolder(
  {
    directoryHandle,
    files,
    projectName,
  }: {
    directoryHandle?: PokeDiscoverDirectoryHandle;
    files: PokeDiscoverWorkspaceSourceFile[];
    projectName: string;
  },
  now = Date.now(),
) {
  const snapshot: StoredRecentFolderSnapshot = {
    files: files.map(source => source.file).filter(isCachedProjectDocument),
    projectName,
    savedAt: now,
    expiresAt: now + POKEDISCOVER_RECENT_FOLDER_TTL_MS,
  };
  await useRecentFolderStore('readwrite', store => store.put(snapshot, LAST_SNAPSHOT_KEY));
  if (directoryHandle) {
    await useRecentFolderStore('readwrite', store => store.put({
      directoryHandle,
      projectName,
    } satisfies StoredRecentFolderHandle, LAST_HANDLE_KEY));
  } else {
    await useRecentFolderStore('readwrite', store => store.delete(LAST_HANDLE_KEY));
  }
  await useRecentFolderStore('readwrite', store => store.delete(LEGACY_DIRECTORY_KEY));
  return { ...snapshot, directoryHandle } satisfies PokeDiscoverRecentFolder;
}

export async function forgetPokeDiscoverRecentFolder() {
  await useRecentFolderStore('readwrite', store => store.delete(LAST_SNAPSHOT_KEY));
  await useRecentFolderStore('readwrite', store => store.delete(LAST_HANDLE_KEY));
  await useRecentFolderStore('readwrite', store => store.delete(LEGACY_DIRECTORY_KEY));
}

export async function readPokeDiscoverRecentFolder(now = Date.now()) {
  const snapshot = await useRecentFolderStore<StoredRecentFolderSnapshot>(
    'readonly',
    store => store.get(LAST_SNAPSHOT_KEY),
  );
  if (snapshot) {
    if (!isPokeDiscoverRecentFolderValid(snapshot, now)) {
      await forgetPokeDiscoverRecentFolder();
      return undefined;
    }
    const storedHandle = await useRecentFolderStore<StoredRecentFolderHandle>(
      'readonly',
      store => store.get(LAST_HANDLE_KEY),
    );
    return {
      ...snapshot,
      directoryHandle: storedHandle?.projectName === snapshot.projectName
        ? storedHandle.directoryHandle
        : undefined,
    } satisfies PokeDiscoverRecentFolder;
  }

  const legacy = await useRecentFolderStore<LegacyRecentFolder>(
    'readonly',
    store => store.get(LEGACY_DIRECTORY_KEY),
  );
  if (!legacy || !isPokeDiscoverRecentFolderValid(legacy, now)) {
    if (legacy) await forgetPokeDiscoverRecentFolder();
    return undefined;
  }
  return {
    directoryHandle: legacy.directoryHandle,
    files: [],
    projectName: legacy.directoryHandle.name,
    savedAt: legacy.savedAt,
    expiresAt: legacy.expiresAt,
  } satisfies PokeDiscoverRecentFolder;
}
