import { describe, expect, it } from 'vitest';
import type { AdventureMapV3 } from '../../packages/contracts/src/index.js';
import {
  createPokeDiscoverMovementRoute,
  listPokeDiscoverMovementPaths,
  movePokeDiscoverMovementPath,
} from '../../src/domain/tools/pokeDiscoverMovementAuthoring.js';
import type { PokeDiscoverEditableTiledMap } from '../../src/domain/tools/pokeDiscoverEditorProject.js';

function adventure(): AdventureMapV3 {
  return {
    schemaVersion: 3,
    mapId: 'map:test',
    title: 'Mapa',
    tiledMapAssets: [{ schemaVersion: 1, assetId: 'tmj:test', path: 'test.tmj' }],
    sectors: [{
      schemaVersion: 1,
      sectorId: 'sector:test:01',
      tiledMapAssetId: 'tmj:test',
      staticCamera: true,
      spawnAnchorIds: [],
      roster: {
        schemaVersion: 1,
        pokemonAssetIds: ['pmd:test', 'pmd:2', 'pmd:3', 'pmd:4', 'pmd:5'],
        npcAssetIds: [],
      },
    }],
    actorPlacements: [{
      schemaVersion: 1,
      placementId: 'placement:pokemon:test:default:01',
      sectorId: 'sector:test:01',
      anchorId: 'placement:pokemon:test:default:01',
      assetId: 'pmd:test',
      animation: 'Idle',
      collision: 'pass-through',
    }],
    characterPlacements: [],
    transitions: [],
    variants: [],
    missionIds: [],
    behaviorTriggers: [],
    expressionTriggers: [],
    ambientSequences: [],
    rareEncounters: [],
    requiredAssetIds: ['pmd:test', 'pmd:2', 'pmd:3', 'pmd:4', 'pmd:5'],
  };
}

function tilemap(): PokeDiscoverEditableTiledMap {
  return {
    type: 'map',
    orientation: 'orthogonal',
    infinite: false,
    width: 20,
    height: 20,
    tilewidth: 16,
    tileheight: 16,
    tilesets: [],
    layers: [{
      id: 1,
      name: 'Anchors',
      type: 'objectgroup',
      objects: [{
        id: 1,
        name: 'placement:pokemon:test:default:01',
        class: 'ActorAnchor',
        type: 'ActorAnchor',
        point: true,
        x: 8,
        y: 8,
      }],
    }],
    nextlayerid: 2,
    nextobjectid: 2,
  } as PokeDiscoverEditableTiledMap;
}

const points = [{ x: 8, y: 8 }, { x: 40, y: 8 }, { x: 40, y: 40 }];

describe('autoría transaccional de movimientos', () => {
  it('crea ruta y rutina ambiental juntas, con IDs derivados', () => {
    const result = createPokeDiscoverMovementRoute(
      adventure(),
      tilemap(),
      'sector:test:01',
      {
        placementId: 'placement:pokemon:test:default:01',
        points,
        usage: 'ambient',
        speedPixelsPerSecond: 64,
        movementAnimation: 'Walk',
        playbackMode: 'pingPong',
      },
    );
    expect(result.sequenceId).toBe('ambient:01:01');
    expect(result.pathId).toBe('ambient:01:01:path:01');
    expect(result.adventure.ambientSequences[0]).toMatchObject({
      playbackMode: 'pingPong',
      beats: [{ actions: [{ kind: 'movePath', movementStyle: 'grid' }] }],
    });
    expect(result.tilemap.layers.find(layer => layer.name === 'Paths')?.objects).toHaveLength(1);
  });

  it('crea un evento por estancia y su zona sin dejar rutas huérfanas', () => {
    const result = createPokeDiscoverMovementRoute(
      adventure(),
      tilemap(),
      'sector:test:01',
      {
        placementId: 'placement:pokemon:test:default:01',
        points,
        usage: 'event',
        speedPixelsPerSecond: 64,
        activationKind: 'enterZone',
        repeatPolicy: 'oncePerSectorVisit',
        triggerZone: { x: 16, y: 16, width: 32, height: 16 },
      },
    );
    expect(result.adventure.mapEventTriggers?.[0]).toMatchObject({
      repeatPolicy: 'oncePerSectorVisit',
      activation: { kind: 'enterZone' },
    });
    expect((result.tilemap.layers.find(layer => layer.name === 'Triggers')?.objects as Array<Record<string, unknown>>)[0])
      .toMatchObject({ x: 16, y: 16, width: 32, height: 16 });
  });

  it.each([
    { activationKind: 'enterZone' as const, usesZone: true },
    { activationKind: 'contextAction' as const, usesZone: false },
    { activationKind: 'proximity' as const, usesZone: false },
  ])('crea la activación $activationKind con un objetivo compatible', ({
    activationKind,
    usesZone,
  }) => {
    const result = createPokeDiscoverMovementRoute(
      adventure(),
      tilemap(),
      'sector:test:01',
      {
        placementId: 'placement:pokemon:test:default:01',
        points,
        usage: 'event',
        speedPixelsPerSecond: 64,
        activationKind,
        repeatPolicy: 'persistent',
        ...(usesZone
          ? {}
          : { targetPlacementId: 'placement:pokemon:test:default:01' }),
      },
    );
    expect(result.adventure.mapEventTriggers?.[0]).toMatchObject({
      repeatPolicy: 'persistent',
      activation: {
        kind: activationKind,
        ...(usesZone
          ? { zoneId: 'trigger:map:01:zone:01' }
          : {
            target: {
              kind: 'placement',
              placementId: 'placement:pokemon:test:default:01',
            },
          }),
      },
    });
    expect(result.tilemap.layers.some(layer => layer.name === 'Triggers')).toBe(usesZone);
  });

  it('añade rutas al final y permite reordenarlas sin cambiar sus IDs', () => {
    const first = createPokeDiscoverMovementRoute(
      adventure(),
      tilemap(),
      'sector:test:01',
      {
        placementId: 'placement:pokemon:test:default:01',
        points,
        usage: 'ambient',
        speedPixelsPerSecond: 64,
      },
    );
    const second = createPokeDiscoverMovementRoute(
      first.adventure,
      first.tilemap,
      'sector:test:01',
      {
        placementId: 'placement:pokemon:test:default:01',
        points: [{ x: 40, y: 40 }, { x: 72, y: 40 }],
        usage: 'ambient',
        speedPixelsPerSecond: 64,
        sequenceId: first.sequenceId,
      },
    );
    const paths = listPokeDiscoverMovementPaths(
      second.adventure,
      first.sequenceId,
      'placement:pokemon:test:default:01',
    );
    const reordered = movePokeDiscoverMovementPath(
      second.adventure,
      first.sequenceId,
      paths[1].pathId,
      -1,
    );
    expect(listPokeDiscoverMovementPaths(
      reordered,
      first.sequenceId,
      'placement:pokemon:test:default:01',
    ).map(path => path.pathId)).toEqual([paths[1].pathId, paths[0].pathId]);
  });

  it('amplía un evento repetible y conserva el regreso determinista al origen', () => {
    const first = createPokeDiscoverMovementRoute(
      adventure(),
      tilemap(),
      'sector:test:01',
      {
        placementId: 'placement:pokemon:test:default:01',
        points,
        usage: 'event',
        speedPixelsPerSecond: 64,
        activationKind: 'enterZone',
        repeatPolicy: 'repeatable',
      },
    );
    const second = createPokeDiscoverMovementRoute(
      first.adventure,
      first.tilemap,
      'sector:test:01',
      {
        placementId: 'placement:pokemon:test:default:01',
        points: [{ x: 40, y: 40 }, { x: 72, y: 40 }],
        usage: 'event',
        speedPixelsPerSecond: 64,
        sequenceId: first.sequenceId,
      },
    );
    const paths = listPokeDiscoverMovementPaths(
      second.adventure,
      second.sequenceId,
      'placement:pokemon:test:default:01',
    );
    expect(paths.map(path => path.pathId)).toEqual([
      'sequence:map-event:01:path:01',
      'sequence:map-event:01:path:02',
    ]);
    const movements = second.adventure.mapSequences?.[0].beats
      .flatMap(beat => beat.actions)
      .filter(action => action.kind === 'movePath');
    expect(movements?.map(action => ({
      pathId: action.pathId,
      reverse: Boolean(action.reverse),
    }))).toEqual([
      { pathId: paths[0].pathId, reverse: false },
      { pathId: paths[1].pathId, reverse: false },
      { pathId: paths[1].pathId, reverse: true },
      { pathId: paths[0].pathId, reverse: true },
    ]);
    expect(second.adventure.mapEventTriggers?.[0].resultingActorStates).toEqual([]);
  });
});
