import { describe, expect, it } from 'vitest';
import type { AdventureMapV3 } from '../../packages/contracts/src/index.js';
import { auditPokeDiscoverAuthoringSnapshot } from '../../src/domain/tools/pokeDiscoverEditorAuthoringAudit.js';
import { prepareOrphanPokemonAnchorRepair } from '../../src/domain/tools/pokeDiscoverOrphanAnchorRepair.js';
import type { PokeDiscoverTiledObject } from '../../src/domain/tools/pokeDiscoverEditorProject.js';
import type { PokeDiscoverWorkspaceSnapshot } from '../../src/domain/tools/pokeDiscoverEditorWorkspace.js';

const PELIPPER = 'pmd:0279-pelipper:default';

function snapshot(): PokeDiscoverWorkspaceSnapshot {
  const adventure: AdventureMapV3 = {
    schemaVersion: 3,
    mapId: 'map:test',
    title: 'Mapa',
    tiledMapAssets: [{
      schemaVersion: 1,
      assetId: 'tiled-map:test:01',
      path: 'sector.tmj',
    }],
    sectors: [{
      schemaVersion: 1,
      sectorId: 'sector:test:01',
      tiledMapAssetId: 'tiled-map:test:01',
      staticCamera: true,
      spawnAnchorIds: [],
      roster: {
        schemaVersion: 1,
        pokemonAssetIds: [
          PELIPPER,
          'pmd:0001-bulbasaur:default',
          'pmd:0004-charmander:default',
          'pmd:0007-squirtle:default',
          'pmd:0019-rattata:default',
        ],
        npcAssetIds: [],
      },
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
  };
  return {
    adventure,
    tilemapsByFileName: {
      'sector.tmj': {
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
          objects: [{
            id: 65,
            name: 'anchor:pelipper:sleep',
            class: 'ActorAnchor',
            x: 282,
            y: 156,
            width: 0,
            height: 0,
            rotation: 0,
            visible: true,
            point: true,
          }],
        }],
        nextlayerid: 2,
        nextobjectid: 66,
      },
    },
    world: { type: 'world', maps: [] },
    registrations: [{
      fileName: 'sector.tmj',
      assetId: 'tiled-map:test:01',
      sectorId: 'sector:test:01',
      archived: false,
      created: false,
    }],
    sourceFileNameByFileName: { 'sector.tmj': 'sector.tmj' },
  };
}

describe('adaptación de un ancla Pokémon huérfana', () => {
  it('conserva el objeto y crea una colocación sidecar real', () => {
    const current = snapshot();
    const issue = auditPokeDiscoverAuthoringSnapshot(current)
      .find(candidate => candidate.kind === 'orphan')!;

    const repaired = prepareOrphanPokemonAnchorRepair({
      snapshot: current,
      issue,
      assetId: PELIPPER,
      animation: 'Sleep',
    });

    expect(repaired.placementId).toBe('placement:pokemon:pelipper:default:01');
    expect(repaired.snapshot.adventure.actorPlacements[0]).toMatchObject({
      placementId: 'placement:pokemon:pelipper:default:01',
      anchorId: 'placement:pokemon:pelipper:default:01',
      assetId: PELIPPER,
      animation: 'Sleep',
    });
    expect(repaired.snapshot.adventure.ambientSequences).toEqual([]);
    const repairedObjects = repaired.snapshot.tilemapsByFileName['sector.tmj']
      .layers[0].objects as PokeDiscoverTiledObject[];
    const repairedObject = repairedObjects[0];
    expect(repairedObject)
      .toMatchObject({
        id: 65,
        name: 'placement:pokemon:pelipper:default:01',
        class: 'ActorAnchor',
      });
    expect(auditPokeDiscoverAuthoringSnapshot(repaired.snapshot)
      .some(candidate => candidate.objectId === 65)).toBe(false);
  });

  it('incorpora al reparto un Pokémon recuperado de forma inequívoca', () => {
    const current = snapshot();
    const issue = auditPokeDiscoverAuthoringSnapshot(current)
      .find(candidate => candidate.kind === 'orphan')!;

    const repaired = prepareOrphanPokemonAnchorRepair({
      snapshot: current,
      issue,
      assetId: 'pmd:0025-pikachu:default',
      animation: 'Idle',
    });
    expect(repaired.snapshot.adventure.sectors[0].roster.pokemonAssetIds)
      .toContain('pmd:0025-pikachu:default');
  });
});
