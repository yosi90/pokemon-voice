import { describe, expect, it } from 'vitest';
import {
  buildPokeDiscoverMissionManifest,
  discoverPokeDiscoverProjectFiles,
  discoverPokeDiscoverProjectRoot,
} from '../../src/domain/tools/pokeDiscoverEditorProjectRoot.js';
import type {
  PokeDiscoverDirectoryHandle,
  PokeDiscoverWritableFileHandle,
} from '../../src/domain/tools/pokeDiscoverEditorWorkspace.js';

class MemoryFileHandle implements PokeDiscoverWritableFileHandle {
  kind = 'file' as const;
  constructor(public name: string, private source: string) {}
  async getFile() {
    return new File([this.source], this.name, { type: 'application/json' });
  }
  async createWritable() {
    return { write: async () => undefined, close: async () => undefined };
  }
}

class MemoryDirectoryHandle implements PokeDiscoverDirectoryHandle {
  kind = 'directory' as const;
  constructor(
    public name: string,
    private entries: Array<MemoryFileHandle | MemoryDirectoryHandle>,
  ) {}
  async *values() {
    for (const entry of this.entries) yield entry;
  }
  async getFileHandle(name: string) {
    const file = this.entries.find(entry => entry instanceof MemoryFileHandle && entry.name === name);
    if (!file || !(file instanceof MemoryFileHandle)) throw new Error(name);
    return file;
  }
}

function adventure(mapId: string, title: string, sectorId: string) {
  return JSON.stringify({
    schemaVersion: 3,
    mapId,
    title,
    tiledMapAssets: [],
    sectors: [{
      schemaVersion: 1,
      sectorId,
      tiledMapAssetId: 'tmj:test',
      staticCamera: true,
      spawnAnchorIds: [],
      roster: { schemaVersion: 1, pokemonAssetIds: [], npcAssetIds: [] },
    }],
    actorPlacements: [],
    characterPlacements: [],
    transitions: [],
    variants: [],
    missionIds: [],
    behaviorTriggers: [],
    expressionTriggers: [],
    ambientSequences: [],
    rareEncounters: [],
    requiredAssetIds: [],
  });
}

describe('raíz de proyectos del configurador', () => {
  it('descubre aventuras independientes y construye el árbol de sectores y misiones', async () => {
    const root = new MemoryDirectoryHandle('pokemon voice', [
      new MemoryDirectoryHandle('public', [
        new MemoryDirectoryHandle('assets', [
          new MemoryDirectoryHandle('adventure', [
            new MemoryDirectoryHandle('maps', [
              new MemoryDirectoryHandle('alpha', [
                new MemoryFileHandle('alpha.adventure.json', adventure('map:alpha', 'Alpha', 'sector:alpha:01')),
                new MemoryFileHandle('alpha.missions.json', JSON.stringify({
                  schemaVersion: 1,
                  mapId: 'map:alpha',
                  missions: [{
                    schemaVersion: 1,
                    missionId: 'mission:alpha:one',
                    mapId: 'map:alpha',
                    title: 'Primera',
                    loadingText: 'Carga',
                    briefing: 'Briefing',
                    objectives: [],
                    mapVariantIds: [],
                    rewards: [],
                    unlocksFreeExpedition: false,
                  }],
                  narrativeSequences: [],
                })),
              ]),
              new MemoryDirectoryHandle('beta', [
                new MemoryFileHandle('beta.adventure.json', adventure('map:beta', 'Beta', 'sector:beta:01')),
              ]),
            ]),
          ]),
        ]),
      ]),
    ]);
    const result = await discoverPokeDiscoverProjectRoot(root);
    expect(result.projects.map(project => project.title)).toEqual(['Alpha', 'Beta']);
    expect(result.projects[0]).toMatchObject({
      projectPath: 'public/assets/adventure/maps/alpha',
      sectors: [{ sectorId: 'sector:alpha:01', label: '01' }],
      missions: [{ missionId: 'mission:alpha:one', title: 'Primera' }],
    });
    expect(await buildPokeDiscoverMissionManifest(result)).toEqual({
      schemaVersion: 1,
      missions: [{
        schemaVersion: 1,
        missionId: 'mission:alpha:one',
        mapId: 'map:alpha',
        documentPath: 'assets/adventure/maps/alpha/alpha.missions.json',
      }],
    });
  });

  it('descubre la raíz también desde el fallback webkitdirectory', async () => {
    const source = (relativePath: string, content: string) => {
      const file = new File([content], relativePath.split('/').at(-1)!, {
        type: 'application/json',
      });
      Object.defineProperty(file, 'webkitRelativePath', { value: relativePath });
      return { file };
    };
    const result = await discoverPokeDiscoverProjectFiles([
      source(
        'pokemon voice/public/assets/adventure/maps/alpha/alpha.adventure.json',
        adventure('map:alpha', 'Alpha', 'sector:alpha:01'),
      ),
      source(
        'pokemon voice/public/assets/adventure/maps/beta/beta.adventure.json',
        adventure('map:beta', 'Beta', 'sector:beta:01'),
      ),
    ]);

    expect(result.rootName).toBe('pokemon voice');
    expect(result.directoryHandle).toBeUndefined();
    expect(result.projects.map(project => project.projectPath)).toEqual([
      'public/assets/adventure/maps/alpha',
      'public/assets/adventure/maps/beta',
    ]);
  });
});
