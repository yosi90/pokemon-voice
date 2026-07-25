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
  commitPokeDiscoverEditorHistory,
  createPokeDiscoverAdventure,
  createPokeDiscoverEditorHistory,
  createPokeDiscoverWorld,
  preparePokeDiscoverTiledMap,
  registerPokeDiscoverTiledSources,
  type PokeDiscoverEditableTiledMap,
} from '../../src/domain/tools/pokeDiscoverEditorProject.js';
import {
  readTiledCollisionShape,
  rectangleOverlapsCollision,
} from '../../src/domain/maps/tiledCollisionGeometry.js';
import {
  findPokeDiscoverWorkspaceConflicts,
  openPokeDiscoverWorkspace,
  savePokeDiscoverWorkspace,
  type PokeDiscoverDirectoryHandle,
  type PokeDiscoverWritableFileHandle,
} from '../../src/domain/tools/pokeDiscoverEditorWorkspace.js';

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
      rooms: [{
        schemaVersion: 1 as const,
        roomId: 'room:tegueste-forest:02-04',
        tiledMapAssetId: 'tiled-map:tegueste-forest:02-04',
        staticCamera: true as const,
        spawnAnchorIds: [],
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
        roomId: 'room:tegueste-forest:02-04',
        created: false,
      });
    expect(registered.adventure.rooms.map(room => room.roomId)).toContain('room:tegueste-forest:05-05');
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
      fromRoomId: source.roomId,
      toRoomId: target.roomId,
      destinationFacing: 'right',
    });
    expect(connected.adventure.transitions[1]).toMatchObject({
      fromRoomId: target.roomId,
      toRoomId: source.roomId,
      destinationFacing: 'left',
    });
    expect(connected.adventure.rooms.find(room => room.roomId === source.roomId)?.spawnAnchorIds)
      .toContain(connected.sourceAnchorId);
    expect(connected.adventure.rooms.find(room => room.roomId === target.roomId)?.spawnAnchorIds)
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
      roomId: 'room:test:north',
      anchorId: 'anchor:player:north',
    });
    adventure = upsertPokeDiscoverEntryPoint(adventure, {
      schemaVersion: 1,
      entryPointId: 'entry:test:south',
      label: 'Entrada sur',
      roomId: 'room:test:south',
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

    expect(resolvePokeDiscoverEntryPoint(adventure, { missionId: 'mission:test:one' })?.roomId)
      .toBe('room:test:north');
    expect(resolvePokeDiscoverEntryPoint(adventure, { missionId: 'mission:test:two' })?.roomId)
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
        roomId: 'room:test',
        anchorId: 'anchor:test',
        assetId: 'pokemon:test',
        animation: 'Idle',
      }],
      entryPoints: [{
        schemaVersion: 1 as const,
        entryPointId: 'entry:test',
        label: 'Entrada',
        roomId: 'room:test',
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
    const map = tiledMap();
    const adventure = {
      ...createPokeDiscoverAdventure({ title: 'Prueba', mapId: 'map:test:save' }),
      tiledMapAssets: [{
        schemaVersion: 1 as const,
        assetId: 'tiled-map:test:01',
        path: 'room-01.tmj',
      }],
      rooms: [{
        schemaVersion: 1 as const,
        roomId: 'room:test:01',
        tiledMapAssetId: 'tiled-map:test:01',
        staticCamera: true as const,
        spawnAnchorIds: [],
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
    };
    return { writes, handles, directory };
  }

  it('guarda TMJ modificados, world y proyecto en ese orden', async () => {
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
      'test.adventure.json',
    ]);
    expect(saved.baselineByFileName['test.world']).toContain('"type": "world"');
    expect(saved.baselineByFileName['room-01.tmj']).toContain('"name": "Anchors"');
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
