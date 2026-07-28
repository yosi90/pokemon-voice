import { describe, expect, it } from 'vitest';
import {
  assignPokeDiscoverMissionEntry,
  connectPokeDiscoverRoomsBidirectionally,
  findPokeDiscoverGeometryReferences,
  resolvePokeDiscoverEntryPoint,
  upsertPokeDiscoverEntryPoint,
} from '../../src/domain/tools/pokeDiscoverEditorGeometry.js';
import {
  addPokeDiscoverTiledObject,
  applyPokeDiscoverWorldOrganization,
  commitPokeDiscoverEditorHistory,
  createPokeDiscoverAdventure,
  createPokeDiscoverEditorHistory,
  createPokeDiscoverWorld,
  preparePokeDiscoverTiledMap,
  registerPokeDiscoverTiledSources,
  previewPokeDiscoverWorldNames,
  type PokeDiscoverEditableTiledMap,
} from '../../src/domain/tools/pokeDiscoverEditorProject.js';
import {
  readTiledCollisionShape,
  rectangleOverlapsCollision,
} from '../../src/domain/maps/tiledCollisionGeometry.js';
import {
  attachPokeDiscoverWorkspaceDirectory,
  findPokeDiscoverWorkspaceConflicts,
  getPokeDiscoverWorkspaceDirtyFiles,
  markPokeDiscoverWorkspaceExported,
  openPokeDiscoverWorkspace,
  requestPokeDiscoverDirectoryWritePermission,
  savePokeDiscoverWorkspace,
  type PokeDiscoverDirectoryHandle,
  type PokeDiscoverWritableFileHandle,
} from '../../src/domain/tools/pokeDiscoverEditorWorkspace.js';
import {
  centerPokeDiscoverCamera,
  zoomPokeDiscoverCameraAtPoint,
} from '../../src/domain/tools/pokeDiscoverEditorCamera.js';
import {
  readTiledTileTransform,
  transformTiledObjectPoint,
} from '../../src/domain/maps/tiledObjectTransform.js';
import {
  getPokeDiscoverEntityScaleMultiplier,
  getPokeDiscoverEntityScalePercent,
} from '../../src/domain/tools/pokeDiscoverEditorEntityScale.js';
import {
  createPokeDiscoverRecentWorkspaceSources,
  isPokeDiscoverRecentFolderValid,
  POKEDISCOVER_RECENT_FOLDER_TTL_MS,
} from '../../src/domain/tools/pokeDiscoverEditorRecentFolder.js';

function tiledMap(extra: Partial<PokeDiscoverEditableTiledMap> = {}): PokeDiscoverEditableTiledMap {
  return {
    type: 'map',
    width: 30,
    height: 20,
    tilewidth: 16,
    tileheight: 16,
    tilesets: [],
    layers: [{
      id: 1,
      name: 'Ground',
      type: 'tilelayer',
      width: 30,
      height: 20,
      visible: true,
      opacity: 1,
      data: Array.from({ length: 600 }, () => 0),
    }],
    customDocumentField: 'preserved',
    ...extra,
  } as PokeDiscoverEditableTiledMap;
}

describe('modelo de autoría del configurador', () => {
  it('muestra y edita la escala efectiva combinando recurso y entidad', () => {
    const bundle = {
      pmdManifest: { assets: [{ assetId: 'pmd:rattata', renderScale: .8 }] },
      characterManifest: { assets: [{ assetId: 'character:player', renderScale: .6 }] },
    } as never;
    expect(getPokeDiscoverEntityScalePercent(bundle, {
      assetId: 'pmd:rattata',
    })).toBe(80);
    expect(getPokeDiscoverEntityScalePercent(bundle, {
      assetId: 'character:player',
      renderScaleMultiplier: 1.5,
    })).toBe(90);
    expect(getPokeDiscoverEntityScaleMultiplier(bundle, 'pmd:rattata', 120)).toBeCloseTo(1.5);
    expect(getPokeDiscoverEntityScaleMultiplier(bundle, 'pmd:rattata', 80)).toBeUndefined();
  });

  it('conserva una carpeta reciente durante 24 horas', () => {
    const now = Date.UTC(2026, 6, 26);
    expect(isPokeDiscoverRecentFolderValid({
      expiresAt: now + POKEDISCOVER_RECENT_FOLDER_TTL_MS,
    }, now + POKEDISCOVER_RECENT_FOLDER_TTL_MS)).toBe(true);
    expect(isPokeDiscoverRecentFolderValid({
      expiresAt: now + POKEDISCOVER_RECENT_FOLDER_TTL_MS,
    }, now + POKEDISCOVER_RECENT_FOLDER_TTL_MS + 1)).toBe(false);
  });

  it('interpreta las ocho orientaciones ortogonales de Tiled', () => {
    const H = 0x80000000;
    const V = 0x40000000;
    const D = 0x20000000;
    expect([
      readTiledTileTransform(0),
      readTiledTileTransform(H),
      readTiledTileTransform(V),
      readTiledTileTransform(H | V),
      readTiledTileTransform(D),
      readTiledTileTransform(D | H),
      readTiledTileTransform(D | V),
      readTiledTileTransform(D | H | V),
    ]).toEqual([
      { rotation: 0, scaleX: 1, scaleY: 1 },
      { rotation: 0, scaleX: -1, scaleY: 1 },
      { rotation: 0, scaleX: 1, scaleY: -1 },
      { rotation: 0, scaleX: -1, scaleY: -1 },
      { rotation: Math.PI / 2, scaleX: 1, scaleY: -1 },
      { rotation: Math.PI / 2, scaleX: 1, scaleY: 1 },
      { rotation: -Math.PI / 2, scaleX: 1, scaleY: 1 },
      { rotation: Math.PI / 2, scaleX: -1, scaleY: 1 },
    ]);
  });

  it('aplica la rotación horaria de Tiled a paths y colisiones', () => {
    expect(transformTiledObjectPoint(
      { x: 32, y: 48, rotation: 90 },
      { x: 16, y: 0 },
    )).toEqual({ x: 32, y: 64 });
    const collision = readTiledCollisionShape({
      x: 32,
      y: 48,
      rotation: -90,
      polygon: [{ x: 0, y: 0 }, { x: 16, y: 0 }, { x: 16, y: 16 }],
    });
    expect(collision).toEqual({
      kind: 'polygon',
      points: [{ x: 32, y: 48 }, { x: 32, y: 32 }, { x: 48, y: 32 }],
    });
  });

  it('numera el mundo por posición, conserva IDs y aparta los TMJ quitados', () => {
    const adventure = {
      ...createPokeDiscoverAdventure({ title: 'Bosque', mapId: 'map:tegueste-forest' }),
      tiledMapAssets: [
        { schemaVersion: 1 as const, assetId: 'asset:historic', path: 'maps/tegueste-forest-02-05.tmj' },
        { schemaVersion: 1 as const, assetId: 'asset:south', path: 'maps/tegueste-forest-04-05.tmj' },
      ],
      sectors: [{
        schemaVersion: 1 as const,
        sectorId: 'room:tegueste-forest:02-04',
        tiledMapAssetId: 'asset:historic',
        staticCamera: true as const,
        spawnAnchorIds: [],
        roster: { schemaVersion: 1 as const, pokemonAssetIds: [], npcAssetIds: [] },
      }, {
        schemaVersion: 1 as const,
        sectorId: 'room:tegueste-forest:04-05',
        tiledMapAssetId: 'asset:south',
        staticCamera: true as const,
        spawnAnchorIds: [],
        roster: { schemaVersion: 1 as const, pokemonAssetIds: [], npcAssetIds: [] },
      }],
    };
    const registrations = [{
      fileName: 'tegueste-forest-02-05.tmj',
      assetId: 'asset:historic',
      sectorId: 'room:tegueste-forest:02-04',
      created: false,
    }, {
      fileName: 'tegueste-forest-04-05.tmj',
      assetId: 'asset:south',
      sectorId: 'room:tegueste-forest:04-05',
      created: false,
    }];
    const draftWorld = {
      type: 'world' as const,
      maps: [
        { fileName: 'tegueste-forest-04-05.tmj', x: 0, y: 640, width: 480, height: 320 },
        { fileName: 'pending.tmj', x: 480, y: 0, width: 480, height: 320 },
      ],
    };
    expect([...previewPokeDiscoverWorldNames(draftWorld, registrations).values()])
      .toEqual(['tegueste-forest-01-02.tmj', 'tegueste-forest-02-02.tmj']);
    const organized = applyPokeDiscoverWorldOrganization({
      adventure,
      registrations,
      world: draftWorld,
      tilemapsByFileName: {
        'tegueste-forest-02-05.tmj': tiledMap(),
        'tegueste-forest-04-05.tmj': tiledMap(),
      },
      sourceFileNameByFileName: {
        'tegueste-forest-02-05.tmj': 'tegueste-forest-02-05.tmj',
        'tegueste-forest-04-05.tmj': 'tegueste-forest-04-05.tmj',
      },
    }, draftWorld);
    expect(organized.world.maps.map(entry => entry.fileName)).toEqual([
      'tegueste-forest-02-02.tmj',
      'tegueste-forest-01-02.tmj',
    ]);
    expect(organized.registrations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sectorId: 'room:tegueste-forest:02-04',
        fileName: 'tegueste-forest-02-05.tmj.old',
        archived: true,
      }),
      expect.objectContaining({
        sectorId: 'room:tegueste-forest:04-05',
        fileName: 'tegueste-forest-02-02.tmj',
        archived: false,
      }),
    ]));
    expect(organized.adventure.sectors[0].sectorId).toBe('room:tegueste-forest:02-04');
  });

  it('centra sin alterar el zoom y conserva el punto focal al acercar', () => {
    const centered = centerPokeDiscoverCamera({
      viewportWidth: 1200,
      viewportHeight: 700,
      contentWidth: 480,
      contentHeight: 320,
      zoom: 2,
    });
    expect(centered).toEqual({ x: 120, y: 30 });

    const focalPoint = { x: 600, y: 350 };
    const mapPointBefore = {
      x: (focalPoint.x - centered.x) / 2,
      y: (focalPoint.y - centered.y) / 2,
    };
    const zoomed = zoomPokeDiscoverCameraAtPoint({
      offset: centered,
      currentZoom: 2,
      nextZoom: 1.5,
      focalPoint,
    });
    expect({
      x: (focalPoint.x - zoomed.x) / 1.5,
      y: (focalPoint.y - zoomed.y) / 1.5,
    }).toEqual(mapPointBefore);
  });

  it('crea capas editables con IDs correctos y conserva campos desconocidos', () => {
    const prepared = preparePokeDiscoverTiledMap(tiledMap({
      nextlayerid: 8,
      nextobjectid: 40,
    }));

    expect(prepared.createdLayers).toEqual(['Above', 'Collision', 'Anchors']);
    expect(prepared.tilemap.layers.map(layer => layer.name)).toEqual([
      'Ground',
      'Collision',
      'Above',
      'Anchors',
    ]);
    expect(prepared.tilemap.nextlayerid).toBe(11);
    expect(prepared.tilemap.customDocumentField).toBe('preserved');

    const added = addPokeDiscoverTiledObject(prepared.tilemap, 'Paths', {
      name: 'path:test',
      class: 'AmbientPath',
      x: 16,
      y: 16,
      width: 0,
      height: 0,
      polyline: [{ x: 0, y: 0 }, { x: 16, y: 0 }],
      customObjectField: true,
    });
    expect(added.object.id).toBe(40);
    expect(added.tilemap.nextobjectid).toBe(41);
    expect(added.object.customObjectField).toBe(true);
  });

  it('registra todos los TMJ sin migrar el ID histórico de 02-05', () => {
    const adventure = {
      ...createPokeDiscoverAdventure({
        title: 'Bosque de Tegueste',
        mapId: 'map:tegueste:camphor-forest',
      }),
      tiledMapAssets: [{
        schemaVersion: 1 as const,
        assetId: 'tiled-map:tegueste-forest:02-04',
        path: 'assets/adventure/maps/tegueste-forest/tegueste-forest-02-05.tmj',
      }],
      sectors: [{
        schemaVersion: 1 as const,
        sectorId: 'room:tegueste-forest:02-04',
        tiledMapAssetId: 'tiled-map:tegueste-forest:02-04',
        staticCamera: true as const,
        spawnAnchorIds: [],
        roster: { schemaVersion: 1 as const, pokemonAssetIds: [], npcAssetIds: [] },
      }],
    };
    const registered = registerPokeDiscoverTiledSources(adventure, [
      { fileName: 'tegueste-forest-01-05.tmj', tilemap: tiledMap() },
      { fileName: 'tegueste-forest-02-05.tmj', tilemap: tiledMap() },
      { fileName: 'tegueste-forest-04-05.tmj', tilemap: tiledMap() },
      { fileName: 'tegueste-forest-05-05.tmj', tilemap: tiledMap() },
    ], 'assets/adventure/maps/tegueste-forest');

    expect(registered.registrations).toHaveLength(4);
    expect(registered.registrations.find(item => item.fileName.endsWith('02-05.tmj')))
      .toMatchObject({
        assetId: 'tiled-map:tegueste-forest:02-04',
        sectorId: 'room:tegueste-forest:02-04',
        created: false,
      });
    expect(registered.adventure.sectors.map(room => room.sectorId)).toContain('room:tegueste-forest:05-05');
  });

  it('limita el historial global a 100 transacciones y restaura snapshots completos', () => {
    let history = createPokeDiscoverEditorHistory({ sidecar: 0, tmj: 0, world: 0 });
    for (let index = 1; index <= 120; index += 1) {
      history = commitPokeDiscoverEditorHistory(history, {
        sidecar: index,
        tmj: index,
        world: index,
      });
    }
    expect(history.past).toHaveLength(100);
    expect(history.past[0]).toEqual({ sidecar: 20, tmj: 20, world: 20 });
    expect(history.present).toEqual({ sidecar: 120, tmj: 120, world: 120 });
  });

  it('crea una conexión bidireccional como una operación multiarchivo', () => {
    const sourceMap = preparePokeDiscoverTiledMap(tiledMap()).tilemap;
    const targetMap = preparePokeDiscoverTiledMap(tiledMap()).tilemap;
    const base = createPokeDiscoverAdventure({ title: 'Mundo', mapId: 'map:test:world' });
    const registered = registerPokeDiscoverTiledSources(base, [
      { fileName: 'world-01-01.tmj', tilemap: sourceMap },
      { fileName: 'world-02-01.tmj', tilemap: targetMap },
    ]);
    const [source, target] = registered.registrations;
    const connected = connectPokeDiscoverRoomsBidirectionally({
      adventure: registered.adventure,
      source: { ...source, tilemap: sourceMap },
      target: { ...target, tilemap: targetMap },
      sourceEdge: 'right',
      sourceStart: 64,
      targetStart: 32,
      length: 32,
    });

    expect(connected.adventure.transitions).toHaveLength(2);
    expect(connected.adventure.transitions[0]).toMatchObject({
      fromSectorId: source.sectorId,
      toSectorId: target.sectorId,
      destinationFacing: 'right',
    });
    expect(connected.adventure.transitions[1]).toMatchObject({
      fromSectorId: target.sectorId,
      toSectorId: source.sectorId,
      destinationFacing: 'left',
    });
    expect(connected.adventure.sectors.find(room => room.sectorId === source.sectorId)?.spawnAnchorIds)
      .toContain(connected.sourceAnchorId);
    expect(connected.adventure.sectors.find(room => room.sectorId === target.sectorId)?.spawnAnchorIds)
      .toContain(connected.targetAnchorId);
    const targetObjects = connected.targetTilemap.layers
      .find(layer => layer.name === 'Anchors')?.objects as Array<Record<string, unknown>> | undefined;
    const targetAnchor = targetObjects?.find(object => object.name === connected.targetAnchorId);
    expect(targetAnchor?.y).toBe(32);
  });

  it('empaqueta provisionalmente mapas sin world y respeta sus dimensiones', () => {
    const sources = [
      { fileName: 'one.tmj', tilemap: tiledMap() },
      { fileName: 'two.tmj', tilemap: tiledMap() },
      { fileName: 'three.tmj', tilemap: tiledMap() },
    ];
    const world = createPokeDiscoverWorld(sources);
    expect(world.maps).toEqual([
      expect.objectContaining({ fileName: 'one.tmj', x: 0, y: 0, width: 480, height: 320 }),
      expect.objectContaining({ fileName: 'two.tmj', x: 480, y: 0, width: 480, height: 320 }),
      expect.objectContaining({ fileName: 'three.tmj', x: 0, y: 320, width: 480, height: 320 }),
    ]);
  });

  it('resuelve entradas distintas para misiones y expedición libre', () => {
    let adventure = createPokeDiscoverAdventure({ title: 'Entradas', mapId: 'map:test:entries' });
    adventure = upsertPokeDiscoverEntryPoint(adventure, {
      schemaVersion: 1,
      entryPointId: 'entry:test:north',
      label: 'Entrada norte',
      sectorId: 'room:test:north',
      anchorId: 'anchor:player:north',
    });
    adventure = upsertPokeDiscoverEntryPoint(adventure, {
      schemaVersion: 1,
      entryPointId: 'entry:test:south',
      label: 'Entrada sur',
      sectorId: 'room:test:south',
      anchorId: 'anchor:player:south',
    });
    adventure = assignPokeDiscoverMissionEntry(adventure, {
      schemaVersion: 1,
      missionId: 'mission:test:one',
      entryPointId: 'entry:test:north',
    });
    adventure = assignPokeDiscoverMissionEntry(adventure, {
      schemaVersion: 1,
      missionId: 'mission:test:two',
      entryPointId: 'entry:test:south',
    });
    adventure = { ...adventure, freeExpeditionEntryPointId: 'entry:test:south' };

    expect(resolvePokeDiscoverEntryPoint(adventure, { missionId: 'mission:test:one' })?.sectorId)
      .toBe('room:test:north');
    expect(resolvePokeDiscoverEntryPoint(adventure, { missionId: 'mission:test:two' })?.sectorId)
      .toBe('room:test:south');
    expect(resolvePokeDiscoverEntryPoint(adventure, { freeExpedition: true })?.anchorId)
      .toBe('anchor:player:south');
  });

  it('enumera dependencias antes de borrar geometría referenciada', () => {
    const adventure = {
      ...createPokeDiscoverAdventure({ title: 'Referencias', mapId: 'map:test:references' }),
      actorPlacements: [{
        schemaVersion: 1 as const,
        placementId: 'placement:test',
        sectorId: 'room:test',
        anchorId: 'anchor:test',
        assetId: 'pokemon:test',
        animation: 'Idle',
      }],
      entryPoints: [{
        schemaVersion: 1 as const,
        entryPointId: 'entry:test',
        label: 'Entrada',
        sectorId: 'room:test',
        anchorId: 'anchor:test',
      }],
    };

    expect(findPokeDiscoverGeometryReferences(adventure, 'anchor:test')).toEqual([
      'Colocación placement:test',
      'Entrada Entrada',
    ]);
  });
});

describe('colisiones poligonales del runtime', () => {
  it('bloquea un rectángulo que cruza un polígono aunque no toque su caja completa', () => {
    const polygon = readTiledCollisionShape({
      x: 100,
      y: 100,
      polygon: [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 20, y: 40 }],
    });
    expect(polygon).toBeDefined();
    expect(rectangleOverlapsCollision({ x: 117, y: 112, width: 6, height: 6 }, polygon!)).toBe(true);
    expect(rectangleOverlapsCollision({ x: 100, y: 135, width: 5, height: 5 }, polygon!)).toBe(false);
  });
});

class MemoryFileHandle implements PokeDiscoverWritableFileHandle {
  lastModified = 1;

  constructor(
    public name: string,
    public content: string,
    private readonly writes: string[],
  ) {}

  async getFile() {
    return new File([this.content], this.name, {
      type: 'application/json',
      lastModified: this.lastModified,
    });
  }

  async createWritable() {
    return {
      write: async (data: string) => {
        this.content = data;
        this.writes.push(this.name);
      },
      close: async () => {
        this.lastModified += 1;
      },
    };
  }
}

describe('apertura y guardado multiarchivo', () => {
  function memoryProject() {
    const writes: string[] = [];
    const deletes: string[] = [];
    const map = tiledMap();
    const adventure = {
      ...createPokeDiscoverAdventure({ title: 'Prueba', mapId: 'map:test:save' }),
      tiledMapAssets: [{
        schemaVersion: 1 as const,
        assetId: 'tiled-map:test:01',
        path: 'room-01.tmj',
      }],
      sectors: [{
        schemaVersion: 1 as const,
        sectorId: 'room:test:01',
        tiledMapAssetId: 'tiled-map:test:01',
        staticCamera: true as const,
        spawnAnchorIds: [],
        roster: { schemaVersion: 1 as const, pokemonAssetIds: [], npcAssetIds: [] },
      }],
    };
    const handles = new Map<string, MemoryFileHandle>([
      ['room-01.tmj', new MemoryFileHandle('room-01.tmj', JSON.stringify(map), writes)],
      ['test.adventure.json', new MemoryFileHandle('test.adventure.json', JSON.stringify(adventure), writes)],
    ]);
    const directory: PokeDiscoverDirectoryHandle = {
      name: 'test',
      async *values() {
        for (const handle of handles.values()) yield handle;
      },
      async getFileHandle(name, options) {
        const existing = handles.get(name);
        if (existing) return existing;
        if (!options?.create) throw new Error('missing');
        const created = new MemoryFileHandle(name, '', writes);
        handles.set(name, created);
        return created;
      },
      async removeEntry(name) {
        if (!handles.delete(name)) throw new Error('missing');
        deletes.push(name);
      },
    };
    return { writes, deletes, handles, directory };
  }

  it('genera la caché reciente desde el estado actual y no desde los archivos abiertos', async () => {
    const memory = memoryProject();
    const workspace = await openPokeDiscoverWorkspace({
      files: [...memory.handles.values()].map(handle => ({
        file: new File([handle.content], handle.name, {
          lastModified: handle.lastModified,
        }),
      })),
    });
    const current = {
      ...workspace,
      history: {
        ...workspace.history,
        present: {
          ...workspace.history.present,
          adventure: {
            ...workspace.history.present.adventure,
            schemaVersion: 3 as const,
            title: 'Versión actual de la caché',
          },
        },
      },
    };
    const sidecar = createPokeDiscoverRecentWorkspaceSources(current)
      .find(source => source.file.name === 'test.adventure.json');

    expect(await sidecar?.file.text()).toContain('Versión actual de la caché');
    expect(await sidecar?.file.text()).toContain('"schemaVersion": 3');
  });

  it('guarda únicamente los documentos modificados y respeta su orden', async () => {
    const memory = memoryProject();
    const sources = [...memory.handles.values()].map(handle => ({
      file: new File([handle.content], handle.name, { lastModified: handle.lastModified }),
      handle,
    }));
    const workspace = await openPokeDiscoverWorkspace({
      files: sources,
      directoryHandle: memory.directory,
    });
    const saved = await savePokeDiscoverWorkspace(workspace);

    expect(memory.writes).toEqual([
      'room-01.tmj',
      'test.world',
    ]);
    expect(saved.baselineByFileName['test.world']).toContain('"type": "world"');
    expect(saved.baselineByFileName['room-01.tmj']).toContain('"name": "Anchors"');
    expect(getPokeDiscoverWorkspaceDirtyFiles(saved)).toEqual([]);
  });

  it('limpia los cambios pendientes después de exportar sin permiso de escritura', async () => {
    const memory = memoryProject();
    const sources = [...memory.handles.values()].map(handle => ({
      file: new File([handle.content], handle.name, { lastModified: handle.lastModified }),
      handle,
    }));
    const workspace = await openPokeDiscoverWorkspace({ files: sources });
    const exported = markPokeDiscoverWorkspaceExported(workspace);

    expect(getPokeDiscoverWorkspaceDirtyFiles(workspace)).not.toEqual([]);
    expect(getPokeDiscoverWorkspaceDirtyFiles(exported)).toEqual([]);
    expect(exported.history).toBe(workspace.history);
  });

  it('vincula de nuevo la misma carpeta sin perder los cambios pendientes', async () => {
    const memory = memoryProject();
    const sources = [...memory.handles.values()].map(handle => ({
      file: new File([handle.content], handle.name, { lastModified: handle.lastModified }),
    }));
    const workspace = await openPokeDiscoverWorkspace({ files: sources });
    const changed = {
      ...workspace,
      history: {
        ...workspace.history,
        present: {
          ...workspace.history.present,
          adventure: {
            ...workspace.history.present.adventure,
            title: 'Título pendiente',
          },
        },
      },
    };

    const attached = await attachPokeDiscoverWorkspaceDirectory(changed, memory.directory);

    expect(attached.directoryHandle).toBe(memory.directory);
    expect(attached.history.present.adventure.title).toBe('Título pendiente');
    expect(getPokeDiscoverWorkspaceDirtyFiles(attached))
      .toContain('test.adventure.json');
    expect(getPokeDiscoverWorkspaceDirtyFiles(
      await savePokeDiscoverWorkspace(attached),
    )).toEqual([]);
  });

  it('solicita permiso de escritura cuando el navegador mantiene el handle en prompt', async () => {
    let requested = false;
    const directory = {
      ...memoryProject().directory,
      queryPermission: async () => 'prompt' as PermissionState,
      requestPermission: async ({ mode }: { mode?: 'read' | 'readwrite' } = {}) => {
        requested = mode === 'readwrite';
        return 'granted' as PermissionState;
      },
    };

    expect(await requestPokeDiscoverDirectoryWritePermission(directory)).toBe('granted');
    expect(requested).toBe(true);
  });

  it('no vuelve a guardar otros documentos cuando sólo cambia un sector', async () => {
    const memory = memoryProject();
    const sources = [...memory.handles.values()].map(handle => ({
      file: new File([handle.content], handle.name, { lastModified: handle.lastModified }),
      handle,
    }));
    const initial = await openPokeDiscoverWorkspace({
      files: sources,
      directoryHandle: memory.directory,
    });
    const saved = await savePokeDiscoverWorkspace(initial);
    memory.writes.length = 0;
    const changedTilemap = {
      ...saved.history.present.tilemapsByFileName['room-01.tmj'],
      customDocumentField: 'cambio-local',
    };

    await savePokeDiscoverWorkspace({
      ...saved,
      history: {
        ...saved.history,
        present: {
          ...saved.history.present,
          tilemapsByFileName: {
            ...saved.history.present.tilemapsByFileName,
            'room-01.tmj': changedTilemap,
          },
        },
      },
    });

    expect(memory.writes).toEqual(['room-01.tmj']);
  });

  it('persiste el tamaño de una entidad en el sidecar', async () => {
    const memory = memoryProject();
    const sources = [...memory.handles.values()].map(handle => ({
      file: new File([handle.content], handle.name, { lastModified: handle.lastModified }),
      handle,
    }));
    const workspace = await openPokeDiscoverWorkspace({
      files: sources,
      directoryHandle: memory.directory,
    });
    const adventure = {
      ...workspace.history.present.adventure,
      actorPlacements: [{
        schemaVersion: 1 as const,
        placementId: 'actor:test',
        sectorId: 'room:test:01',
        anchorId: 'anchor:test',
        assetId: 'pmd:test',
        animation: 'Idle',
        renderScaleMultiplier: 1.25,
      }],
    };
    await savePokeDiscoverWorkspace({
      ...workspace,
      history: {
        ...workspace.history,
        present: { ...workspace.history.present, adventure },
      },
    });

    expect(memory.handles.get('test.adventure.json')?.content)
      .toContain('"renderScaleMultiplier": 1.25');
  });

  it('consolida un renombrado físico después de escribir world y sidecar', async () => {
    const memory = memoryProject();
    const sources = [...memory.handles.values()].map(handle => ({
      file: new File([handle.content], handle.name, { lastModified: handle.lastModified }),
      handle,
    }));
    const workspace = await openPokeDiscoverWorkspace({
      files: sources,
      directoryHandle: memory.directory,
    });
    const organized = applyPokeDiscoverWorldOrganization(
      workspace.history.present,
      workspace.history.present.world,
    );
    const saved = await savePokeDiscoverWorkspace({
      ...workspace,
      history: { ...workspace.history, present: organized },
    });

    expect(memory.writes).toEqual([
      'mapa-01-01.tmj',
      'test.world',
      'test.adventure.json',
    ]);
    expect(memory.deletes).toEqual(['room-01.tmj']);
    expect(memory.handles.has('mapa-01-01.tmj')).toBe(true);
    expect(memory.handles.has('room-01.tmj')).toBe(false);
    expect(saved.history.present.sourceFileNameByFileName).toEqual({
      'mapa-01-01.tmj': 'mapa-01-01.tmj',
    });
  });

  it('detecta una modificación externa antes de sobrescribir', async () => {
    const memory = memoryProject();
    const sources = [...memory.handles.values()].map(handle => ({
      file: new File([handle.content], handle.name, { lastModified: handle.lastModified }),
      handle,
    }));
    const workspace = await openPokeDiscoverWorkspace({
      files: sources,
      directoryHandle: memory.directory,
    });
    const sidecar = memory.handles.get('test.adventure.json')!;
    sidecar.content = '{"changedOutside":true}';
    sidecar.lastModified = 9;

    expect(await findPokeDiscoverWorkspaceConflicts(workspace)).toEqual(['test.adventure.json']);
    await expect(savePokeDiscoverWorkspace(workspace)).rejects.toMatchObject({
      message: 'EXTERNAL_FILE_CONFLICT',
      conflicts: ['test.adventure.json'],
    });
  });

  it('rechaza carpetas con varios proyectos explícitamente', async () => {
    const map = new File([JSON.stringify(tiledMap())], 'room.tmj');
    const sidecar = JSON.stringify(createPokeDiscoverAdventure({ title: 'Uno', mapId: 'map:test:one' }));
    await expect(openPokeDiscoverWorkspace({
      files: [
        { file: map },
        { file: new File([sidecar], 'one.adventure.json') },
        { file: new File([sidecar], 'two.adventure.json') },
      ],
    })).rejects.toThrow('varios proyectos .adventure.json');
  });

  it('conserva la exportación alternativa cuando no hay permiso de escritura', async () => {
    const memory = memoryProject();
    const sources = [...memory.handles.values()].map(handle => ({
      file: new File([handle.content], handle.name, { lastModified: handle.lastModified }),
    }));
    const workspace = await openPokeDiscoverWorkspace({ files: sources });

    await expect(savePokeDiscoverWorkspace(workspace))
      .rejects.toThrow('Usa Exportar copia');
  });
});
