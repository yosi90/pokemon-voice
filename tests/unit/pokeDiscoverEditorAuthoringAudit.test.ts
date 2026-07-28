import { describe, expect, it } from 'vitest';
import type { AdventureMapV3 } from '../../packages/contracts/src/index.js';
import teguesteAdventure from '../../public/assets/adventure/maps/tegueste-forest/tegueste-forest.adventure.json';
import teguesteSector01Raw from '../../public/assets/adventure/maps/tegueste-forest/tegueste-forest-01-05.tmj?raw';
import teguesteSectorRaw from '../../public/assets/adventure/maps/tegueste-forest/tegueste-forest-02-05.tmj?raw';
import teguesteSector04Raw from '../../public/assets/adventure/maps/tegueste-forest/tegueste-forest-04-05.tmj?raw';
import teguesteSector05Raw from '../../public/assets/adventure/maps/tegueste-forest/tegueste-forest-05-05.tmj?raw';
import teguesteWorldRaw from '../../public/assets/adventure/maps/tegueste-forest/tegueste-forest.world?raw';
import {
  auditPokeDiscoverAuthoringSnapshot,
  extendPokeDiscoverSanitationIssueOrder,
  findIntroducedPokeDiscoverValidationErrors,
  repairPokeDiscoverAuthoringIssue,
} from '../../src/domain/tools/pokeDiscoverEditorAuthoringAudit.js';
import type { PokeDiscoverWorkspaceSnapshot } from '../../src/domain/tools/pokeDiscoverEditorWorkspace.js';

function snapshot(): PokeDiscoverWorkspaceSnapshot {
  const adventure: AdventureMapV3 = {
    schemaVersion: 3,
    mapId: 'map:test',
    title: 'Test',
    tiledMapAssets: [{ schemaVersion: 1, assetId: 'tmj:test', path: 'test.tmj' }],
    sectors: [{
      schemaVersion: 1,
      sectorId: 'sector:test',
      tiledMapAssetId: 'tmj:test',
      staticCamera: true,
      spawnAnchorIds: [],
      roster: {
        schemaVersion: 1,
        pokemonAssetIds: ['pmd:1', 'pmd:2', 'pmd:3', 'pmd:4', 'pmd:5'],
        npcAssetIds: [],
      },
    }],
    actorPlacements: [{
      schemaVersion: 1,
      placementId: 'placement:pokemon:01',
      sectorId: 'sector:test',
      anchorId: 'anchor:legacy',
      assetId: 'pmd:1',
      animation: 'Idle',
    }],
    characterPlacements: [],
    transitions: [],
    variants: [],
    missionIds: [],
    behaviorTriggers: [],
    expressionTriggers: [],
    ambientSequences: [],
    rareEncounters: [],
    requiredAssetIds: ['pmd:1', 'pmd:2', 'pmd:3', 'pmd:4', 'pmd:5'],
  };
  return {
    adventure,
    registrations: [{
      fileName: 'test.tmj',
      assetId: 'tmj:test',
      sectorId: 'sector:test',
      created: false,
    }],
    tilemapsByFileName: {
      'test.tmj': {
        type: 'map',
        width: 10,
        height: 10,
        tilewidth: 16,
        tileheight: 16,
        tilesets: [],
        layers: [{
          id: 1,
          name: 'Anchors',
          type: 'objectgroup',
          visible: true,
          opacity: 1,
          objects: [
            {
              id: 1,
              name: 'anchor:legacy',
              class: 'ActionAnchor',
              x: 16,
              y: 16,
              width: 0,
              height: 0,
              rotation: 0,
              visible: true,
              point: true,
            },
            {
              id: 2,
              name: 'anchor:orphan',
              class: 'ActorAnchor',
              x: 32,
              y: 16,
              width: 0,
              height: 0,
              rotation: 0,
              visible: true,
              point: true,
            },
          ],
        }],
      } as never,
    },
    world: { type: 'world', maps: [] },
    sourceFileNameByFileName: { 'test.tmj': 'test.tmj' },
  };
}

function teguesteSnapshot(): PokeDiscoverWorkspaceSnapshot {
  const adventure = structuredClone(teguesteAdventure) as AdventureMapV3;
  const tilemapsByFileName = {
    'tegueste-forest-01-05.tmj': JSON.parse(teguesteSector01Raw),
    'tegueste-forest-02-05.tmj': JSON.parse(teguesteSectorRaw),
    'tegueste-forest-04-05.tmj': JSON.parse(teguesteSector04Raw),
    'tegueste-forest-05-05.tmj': JSON.parse(teguesteSector05Raw),
  };
  const assetById = new Map(adventure.tiledMapAssets.map(asset => [asset.assetId, asset]));
  const registrations = adventure.sectors.map(sector => {
    const asset = assetById.get(sector.tiledMapAssetId)!;
    return {
      fileName: asset.path.split('/').at(-1)!,
      assetId: asset.assetId,
      sectorId: sector.sectorId,
      created: false,
    };
  });
  return {
    adventure,
    registrations,
    tilemapsByFileName,
    world: JSON.parse(teguesteWorldRaw),
    sourceFileNameByFileName: Object.fromEntries(
      Object.keys(tilemapsByFileName).map(fileName => [fileName, fileName]),
    ),
  } as PokeDiscoverWorkspaceSnapshot;
}

describe('auditoría estricta de autoría', () => {
  it('bloquea una clase desconocida y ofrece reparación derivada del sidecar', () => {
    const source = snapshot();
    const issue = auditPokeDiscoverAuthoringSnapshot(source)
      .find(candidate => candidate.currentName === 'anchor:legacy');
    expect(issue).toMatchObject({
      kind: 'unsupported-class',
      objectId: 1,
      layerName: 'Anchors',
      position: { x: 16, y: 16 },
      expectedName: 'placement:pokemon:01',
      expectedClass: 'ActorAnchor',
      canRepair: true,
      canDelete: true,
    });
    expect(issue?.message).toContain('objeto Tiled #1 de la capa Anchors');
    const repaired = repairPokeDiscoverAuthoringIssue(source, issue!);
    expect(repaired.adventure.actorPlacements[0].anchorId).toBe('placement:pokemon:01');
    const objects = repaired.tilemapsByFileName['test.tmj'].layers[0].objects as Array<{
      name: string;
      class: string;
    }>;
    expect(objects[0]).toMatchObject({
      name: 'placement:pokemon:01',
      class: 'ActorAnchor',
    });
  });

  it('solo permite borrar el ancla huérfana', () => {
    const issues = auditPokeDiscoverAuthoringSnapshot(snapshot());
    expect(issues.find(candidate => candidate.currentName === 'anchor:orphan')).toMatchObject({
      kind: 'orphan',
      canDelete: true,
      canRepair: false,
    });
    expect(issues.find(candidate => candidate.currentName === 'anchor:legacy')?.canDelete).toBe(true);
  });

  it('separa un ancla compartida sin perder sus colocaciones', () => {
    const source = snapshot();
    source.adventure.actorPlacements.push({
      ...source.adventure.actorPlacements[0],
      placementId: 'placement:pokemon:02',
      assetId: 'pmd:2',
    });
    const issue = auditPokeDiscoverAuthoringSnapshot(source)
      .find(candidate => candidate.currentName === 'anchor:legacy');
    expect(issue).toMatchObject({
      kind: 'shared-anchor',
      canRepair: true,
      canDelete: false,
    });

    const repaired = repairPokeDiscoverAuthoringIssue(source, issue!);
    expect(repaired.adventure.actorPlacements.map(placement => placement.anchorId))
      .toEqual(['placement:pokemon:01', 'placement:pokemon:02']);
    const anchors = repaired.tilemapsByFileName['test.tmj'].layers[0].objects as Array<{
      id: number;
      name: string;
      x: number;
      y: number;
      class: string;
    }>;
    expect(anchors.filter(anchor => anchor.name.startsWith('placement:pokemon:')))
      .toEqual([
        expect.objectContaining({
          id: 1,
          name: 'placement:pokemon:01',
          x: 16,
          y: 16,
          class: 'ActorAnchor',
        }),
        expect.objectContaining({
          name: 'placement:pokemon:02',
          x: 16,
          y: 16,
          class: 'ActorAnchor',
        }),
      ]);
  });

  it('mantiene separadas las cuatro colocaciones del prólogo ya saneadas', () => {
    const source = {
      adventure: structuredClone(teguesteAdventure),
      registrations: [{
        fileName: 'tegueste-forest-02-05.tmj',
        assetId: 'tiled-map:tegueste-forest:02-04',
        sectorId: 'sector:tegueste-forest:02-04',
        created: false,
      }],
      tilemapsByFileName: {
        'tegueste-forest-02-05.tmj': JSON.parse(teguesteSectorRaw),
      },
      world: { type: 'world', maps: [] },
      sourceFileNameByFileName: {
        'tegueste-forest-02-05.tmj': 'tegueste-forest-02-05.tmj',
      },
    } as PokeDiscoverWorkspaceSnapshot;
    const expectedIds = [
      'placement:pokemon:bulbasaur:default:01',
      'placement:pokemon:charmander:default:01',
      'placement:pokemon:squirtle:default:01',
      'character:professor-alcanfor-fallen',
    ];
    const anchors = source.tilemapsByFileName['tegueste-forest-02-05.tmj']
      .layers.find(layer => layer.name === 'Anchors')?.objects as Array<{
        name: string;
        x: number;
        y: number;
      }>;
    expect(anchors.filter(anchor => expectedIds.includes(anchor.name)))
      .toEqual(expectedIds.map(name => expect.objectContaining({ name, x: 200, y: 142 })));
    expect([
      ...source.adventure.actorPlacements,
      ...source.adventure.characterPlacements,
    ].filter(placement => expectedIds.includes(placement.placementId))
      .map(placement => placement.anchorId)).toEqual(expectedIds);
    expect(auditPokeDiscoverAuthoringSnapshot(source).some(candidate => (
      candidate.currentName === 'anchor:professor:fall'
    ))).toBe(false);
  });

  it('mantiene separadas la colocación del jugador y su punto de entrada', () => {
    const source = teguesteSnapshot();
    const anchors = source.tilemapsByFileName['tegueste-forest-02-05.tmj']
      .layers.find(layer => layer.name === 'Anchors')?.objects as Array<{
        name: string;
        class: string;
        x: number;
        y: number;
      }>;
    expect(anchors).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'character:player',
        class: 'PlayerSpawn',
        x: 184,
        y: 301,
      }),
      expect.objectContaining({
        name: 'entry-point:tegueste-forest:camphor-rescue',
        class: 'PlayerSpawn',
        x: 184,
        y: 301,
      }),
    ]));
    expect(source.adventure.characterPlacements
      .find(placement => placement.placementId === 'character:player')?.anchorId)
      .toBe('character:player');
    expect(source.adventure.entryPoints
      ?.find(entry => entry.entryPointId === 'entry-point:tegueste-forest:camphor-rescue')
      ?.anchorId).toBe('entry-point:tegueste-forest:camphor-rescue');
    expect(source.adventure.sectors
      .find(sector => sector.sectorId === 'sector:tegueste-forest:02-04')
      ?.spawnAnchorIds).toContain('entry-point:tegueste-forest:camphor-rescue');
    expect(auditPokeDiscoverAuthoringSnapshot(source).some(candidate => (
      candidate.currentName === 'entry-point:tegueste-forest:camphor-rescue'
    ))).toBe(false);
  });

  it('mantiene Cramorant con el ID derivado de su asset completo', () => {
    const source = teguesteSnapshot();
    const placement = source.adventure.actorPlacements.find(
      candidate => candidate.assetId === 'pmd:0845-cramorant:default',
    );
    expect(placement).toMatchObject({
      placementId: 'placement:pokemon:cramorant:default:01',
      anchorId: 'placement:pokemon:cramorant:default:01',
    });
    const anchor = (source.tilemapsByFileName['tegueste-forest-02-05.tmj']
      .layers.find(layer => layer.name === 'Anchors')?.objects as Array<{
        id: number;
        name: string;
        class: string;
      }>).find(object => object.id === 58);
    expect(anchor).toMatchObject({
      name: 'placement:pokemon:cramorant:default:01',
      class: 'ActorAnchor',
    });
    expect(auditPokeDiscoverAuthoringSnapshot(source).some(
      candidate => candidate.objectId === 58,
    )).toBe(false);
  });

  it('mantiene la oclusión del agua vinculada a sus Gyarados', () => {
    const source = teguesteSnapshot();
    const occluder = (source.tilemapsByFileName['tegueste-forest-02-05.tmj'].layers
      .find(layer => layer.name === 'Occlusion')?.objects as Array<{
        id: number;
        name: string;
        polygon: Array<{ x: number; y: number }>;
        properties: Array<{ name: string; value: unknown }>;
      }>).find(object => object.id === 84);
    expect(occluder).toMatchObject({
      name: 'occlusion-group:water-actors:occluder:placement:pokemon:gyarados:default:01:01',
      polygon: expect.any(Array),
    });
    expect(occluder?.polygon).toHaveLength(34);
    expect(occluder?.properties).toContainEqual(expect.objectContaining({
      name: 'occlusionGroup',
      value: 'occlusion-group:water-actors',
    }));
    expect(auditPokeDiscoverAuthoringSnapshot(source).some(
      candidate => candidate.objectId === 84,
    )).toBe(false);
  });

  it('no deja ninguna incidencia del mapa real sin una salida', () => {
    const issues = auditPokeDiscoverAuthoringSnapshot(teguesteSnapshot());
    const blocked = issues.filter(issue => (
      issue.kind !== 'roster' && !issue.canRepair && !issue.canDelete
    ));
    expect(blocked.map(issue => ({
      issueId: issue.issueId,
      message: issue.message,
      references: issue.references,
    }))).toEqual([]);
  });

  it('mantiene enlazadas las transiciones entre sectores contiguos', () => {
    const source = teguesteSnapshot();
    expect(source.adventure.transitions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        transitionId: 'transition:01',
        fromSectorId: 'sector:tegueste-forest:01-05',
        toSectorId: 'sector:tegueste-forest:02-04',
      }),
      expect.objectContaining({
        transitionId: 'transition:02',
        fromSectorId: 'sector:tegueste-forest:02-04',
        toSectorId: 'sector:tegueste-forest:01-05',
      }),
    ]));
    const sourceAnchors = source.tilemapsByFileName['tegueste-forest-01-05.tmj']
      .layers.find(layer => layer.name === 'Anchors')?.objects as Array<{
        id: number;
        name: string;
      }>;
    const targetAnchors = source.tilemapsByFileName['tegueste-forest-02-05.tmj']
      .layers.find(layer => layer.name === 'Anchors')?.objects as Array<{
        id: number;
        name: string;
      }>;
    expect(sourceAnchors.map(anchor => anchor.name)).toEqual(expect.arrayContaining([
      'transition:01:from',
      'transition:02:to',
    ]));
    expect(targetAnchors.map(anchor => anchor.name)).toEqual(expect.arrayContaining([
      'transition:01:to',
      'transition:02:from',
    ]));
    expect(auditPokeDiscoverAuthoringSnapshot(source).some(
      candidate => candidate.kind === 'unlinked-transition',
    )).toBe(false);
  });

  it('conserva como nota una transición cuyo sector de destino aún no existe', () => {
    const source = teguesteSnapshot();
    const tilemap = source.tilemapsByFileName['tegueste-forest-02-05.tmj'];
    const anchors = tilemap.layers.find(layer => layer.name === 'Anchors')
      ?.objects as Array<{ id: number }>;
    expect(anchors.some(anchor => anchor.id === 62)).toBe(false);
    const comments = tilemap.layers.find(layer => layer.name === 'Comments')
      ?.objects as Array<{ properties?: Array<{ name: string; value: unknown }> }>;
    const pendingComment = comments.find(comment => comment.properties?.some(
      property => property.name === 'pendingConnectionTargetFileName',
    ));
    expect(pendingComment?.properties?.find(property => property.name === 'text')?.value)
      .toBe(
        'Conexión pendiente hacia tegueste-forest-03-05.tmj\n'
        + 'anchor:transition:east',
      );
    expect(pendingComment?.properties).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'pendingConnectionTargetFileName',
        value: 'tegueste-forest-03-05.tmj',
      }),
      expect.objectContaining({
        name: 'pendingConnectionSourceEdge',
        value: 'right',
      }),
    ]));
    expect(source.adventure.sectors
      .find(sector => sector.sectorId === 'sector:tegueste-forest:02-04')
      ?.spawnAnchorIds).not.toContain('anchor:transition:east');
    expect(auditPokeDiscoverAuthoringSnapshot(source).some(
      candidate => candidate.currentName === 'anchor:transition:east',
    )).toBe(false);

    const ready = structuredClone(source);
    ready.adventure.tiledMapAssets.push({
      schemaVersion: 1,
      assetId: 'tiled-map:tegueste-forest:03-05',
      path: 'assets/adventure/maps/tegueste-forest/tegueste-forest-03-05.tmj',
    });
    ready.adventure.sectors.push({
      schemaVersion: 1,
      sectorId: 'sector:tegueste-forest:03-05',
      tiledMapAssetId: 'tiled-map:tegueste-forest:03-05',
      staticCamera: true,
      spawnAnchorIds: [],
      roster: structuredClone(ready.adventure.sectors[0].roster),
    });
    ready.registrations.push({
      fileName: 'tegueste-forest-03-05.tmj',
      assetId: 'tiled-map:tegueste-forest:03-05',
      sectorId: 'sector:tegueste-forest:03-05',
      created: true,
    });
    ready.tilemapsByFileName['tegueste-forest-03-05.tmj'] = JSON.parse(teguesteSector04Raw);
    ready.sourceFileNameByFileName['tegueste-forest-03-05.tmj'] = 'tegueste-forest-03-05.tmj';
    const readyIssue = auditPokeDiscoverAuthoringSnapshot(ready)
      .find(candidate => candidate.kind === 'pending-transition-ready');
    expect(readyIssue).toMatchObject({
      fileName: 'tegueste-forest-02-05.tmj',
      canRepair: true,
    });
    const connected = repairPokeDiscoverAuthoringIssue(ready, readyIssue!);
    expect(connected.adventure.transitions).toHaveLength(source.adventure.transitions.length + 2);
    expect((connected.tilemapsByFileName['tegueste-forest-02-05.tmj'].layers
      .find(layer => layer.name === 'Comments')?.objects as Array<{
        properties?: Array<{ name: string }>;
      }>).some(comment => comment.properties?.some(
      property => property.name === 'pendingConnectionTargetFileName',
    ))).toBe(false);
    expect((connected.tilemapsByFileName['tegueste-forest-03-05.tmj'].layers
      .find(layer => layer.name === 'Anchors')?.objects as Array<{ name: string }>)
      .filter(anchor => /^transition:\d{2,}:(?:from|to)$/u.test(anchor.name)))
      .toHaveLength(4);
  });

  it('repara una zona referenciada aunque su clase, ID y geometría sean antiguos', () => {
    const source = snapshot();
    source.adventure.mapEventTriggers = [{
      schemaVersion: 1,
      triggerId: 'trigger:map:01',
      sectorId: 'sector:test',
      activation: { kind: 'enterZone', zoneId: 'zone:legacy' },
      requirement: { kind: 'trainerLevel', minimum: 1 },
      sequenceId: 'sequence:map-event:01',
      repeatPolicy: 'oncePerVisit',
      resultingActorStates: [],
    }];
    source.tilemapsByFileName['test.tmj'].layers.push({
      id: 2,
      name: 'Triggers',
      type: 'objectgroup',
      visible: true,
      opacity: 1,
      objects: [{
        id: 3,
        name: 'zone:legacy',
        class: '',
        x: 48,
        y: 32,
        width: 0,
        height: 0,
        point: true,
        rotation: 0,
        visible: true,
      }],
    } as never);

    const issue = auditPokeDiscoverAuthoringSnapshot(source)
      .find(candidate => candidate.objectId === 3);
    expect(issue).toMatchObject({
      kind: 'invalid-trigger-zone',
      expectedName: 'trigger:map:01:zone:01',
      expectedClass: 'TriggerZone',
      canRepair: true,
      canDelete: false,
    });

    const repaired = repairPokeDiscoverAuthoringIssue(source, issue!);
    expect(repaired.adventure.mapEventTriggers?.[0].activation).toEqual({
      kind: 'enterZone',
      zoneId: 'trigger:map:01:zone:01',
    });
    const zone = (repaired.tilemapsByFileName['test.tmj'].layers
      .find(layer => layer.name === 'Triggers')?.objects as Array<Record<string, unknown>>)[0];
    expect(zone).toMatchObject({
      name: 'trigger:map:01:zone:01',
      class: 'TriggerZone',
      width: 16,
      height: 16,
    });
    expect(zone.point).toBeUndefined();
  });

  it('conserva el orden inicial aunque se resuelvan incidencias', () => {
    const initial = [
      { issueId: 'roster:sector:test' },
      { issueId: 'class:test.tmj:1' },
      { issueId: 'orphan:test.tmj:2' },
    ];
    const order = extendPokeDiscoverSanitationIssueOrder([], initial);
    expect(order).toEqual(initial.map(issue => issue.issueId));
    expect(extendPokeDiscoverSanitationIssueOrder(order, initial.slice(1))).toEqual(order);
    expect(order.indexOf('class:test.tmj:1') + 1).toBe(2);
  });

  it('permite sanear un elemento aunque permanezcan errores heredados', () => {
    expect(findIntroducedPokeDiscoverValidationErrors(
      ['error heredado', 'error duplicado', 'error duplicado'],
      ['error heredado', 'error duplicado'],
    )).toEqual([]);
    expect(findIntroducedPokeDiscoverValidationErrors(
      ['error heredado', 'error duplicado'],
      ['error heredado', 'error duplicado', 'error duplicado', 'error nuevo'],
    )).toEqual(['error duplicado', 'error nuevo']);
  });
});
