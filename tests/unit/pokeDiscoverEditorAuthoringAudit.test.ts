import { describe, expect, it } from 'vitest';
import type { AdventureMapV3 } from '../../packages/contracts/src/index.js';
import {
  auditPokeDiscoverAuthoringSnapshot,
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

describe('auditoría estricta de autoría', () => {
  it('bloquea una clase desconocida y ofrece reparación derivada del sidecar', () => {
    const source = snapshot();
    const issue = auditPokeDiscoverAuthoringSnapshot(source)
      .find(candidate => candidate.currentName === 'anchor:legacy');
    expect(issue).toMatchObject({
      kind: 'unsupported-class',
      expectedName: 'placement:pokemon:01',
      expectedClass: 'ActorAnchor',
      canRepair: true,
      canDelete: false,
    });
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
    expect(issues.find(candidate => candidate.currentName === 'anchor:legacy')?.canDelete).toBe(false);
  });
});
