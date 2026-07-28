import { describe, expect, it } from 'vitest';
import {
  isPokeDiscoverLegacyBackupRecent,
  migratePokeDiscoverWorkspaceToV3,
  type PokeDiscoverWorkspace,
} from '../../src/domain/tools/pokeDiscoverEditorWorkspace.js';

function file(contents: () => string, lastModified = 1) {
  return new File([contents()], 'map.adventure.v2.backup.json', {
    type: 'application/json',
    lastModified,
  });
}

describe('migración transaccional del workspace V2', () => {
  it('escribe la copia original antes de habilitar V3', async () => {
    let backup = '';
    const workspace = {
      sourceSchemaVersion: 2,
      legacySidecarSource: '{"schemaVersion":2}\n',
      sidecarFileName: 'map.adventure.json',
      directoryHandle: {
        async getFileHandle(name: string) {
          expect(name).toBe('map.adventure.v2.backup.json');
          return {
            name,
            getFile: async () => file(() => backup),
            createWritable: async () => ({
              write: async (value: string) => { backup = value; },
              close: async () => undefined,
            }),
          };
        },
      },
    } as unknown as PokeDiscoverWorkspace;
    const result = await migratePokeDiscoverWorkspaceToV3(workspace);
    expect(backup).toBe(workspace.legacySidecarSource);
    expect(result.backupFileName).toBe('map.adventure.v2.backup.json');
    expect(result.workspace.sourceSchemaVersion).toBe(3);
    expect(result.workspace.legacySidecarSource).toBeUndefined();
    expect(result.backupReused).toBe(false);
  });

  it('reutiliza una copia idéntica de menos de una hora sin volver a escribirla', async () => {
    let requestedHandle = false;
    const workspace = {
      sourceSchemaVersion: 2,
      legacySidecarSource: '{"schemaVersion":2}\n',
      sidecarFileName: 'map.adventure.json',
      legacyBackup: {
        fileName: 'map.adventure.v2.backup.json',
        lastModified: Date.now() - 30 * 60 * 1000,
        matchesSource: true,
        recent: true,
      },
      directoryHandle: {
        async getFileHandle() {
          requestedHandle = true;
          throw new Error('No debe solicitar un archivo nuevo');
        },
      },
    } as unknown as PokeDiscoverWorkspace;

    const result = await migratePokeDiscoverWorkspaceToV3(workspace);

    expect(requestedHandle).toBe(false);
    expect(result.backupReused).toBe(true);
    expect(result.workspace.sourceSchemaVersion).toBe(3);
  });

  it('considera reciente una copia hasta una hora de antigüedad', () => {
    const now = 10_000_000;
    expect(isPokeDiscoverLegacyBackupRecent(now - 59 * 60 * 1000, now)).toBe(true);
    expect(isPokeDiscoverLegacyBackupRecent(now - 61 * 60 * 1000, now)).toBe(false);
  });

  it('no sobrescribe una copia previa diferente', async () => {
    const workspace = {
      sourceSchemaVersion: 2,
      legacySidecarSource: '{"schemaVersion":2}\n',
      sidecarFileName: 'map.adventure.json',
      directoryHandle: {
        async getFileHandle(name: string) {
          return {
            name,
            getFile: async () => file(() => '{"otro":"documento"}'),
            createWritable: async () => ({
              write: async () => undefined,
              close: async () => undefined,
            }),
          };
        },
      },
    } as unknown as PokeDiscoverWorkspace;
    await expect(migratePokeDiscoverWorkspaceToV3(workspace)).rejects.toThrow(
      /contenido diferente/u,
    );
    expect(workspace.sourceSchemaVersion).toBe(2);
  });
});
