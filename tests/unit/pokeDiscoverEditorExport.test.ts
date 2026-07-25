import { describe, expect, it } from 'vitest';
import type {
  AdventureMapV2,
  CharacterSpriteManifestV1,
  PmdAnimationManifestV1,
} from '../../packages/contracts/src/index.js';
import {
  createPokeDiscoverEditorExportArtifacts,
  serializePokeDiscoverEditorJson,
  verifyPokeDiscoverEditorExportRoundTrip,
} from '../../src/domain/tools/pokeDiscoverEditorExport.js';

const adventure = {
  schemaVersion: 2,
  mapId: 'map:test:forest',
  title: 'Bosque de prueba',
  tiledMapAssets: [{ assetId: 'tiled:test', path: 'assets/adventure/maps/test-forest/test-room.tmj' }],
  rooms: [], transitions: [], requiredAssetIds: [], ambientSequences: [], companionSequences: [], rareEncounters: [], interactions: [], dialogues: [], fieldNotebookHints: [], researchFacts: [],
  actorPlacements: [], characterPlacements: [], variants: [], behaviorTriggers: [], expressionTriggers: [], missionIds: [],
} as unknown as AdventureMapV2;

const pmdManifest: PmdAnimationManifestV1 = { schemaVersion: 1, tickRate: 60, assets: [] };
const characterManifest: CharacterSpriteManifestV1 = { schemaVersion: 1, assets: [] };

describe('exportación del editor PokeDiscover', () => {
  it('genera únicamente el sidecar y los dos manifiestos propios', () => {
    const artifacts = createPokeDiscoverEditorExportArtifacts({
      adventure,
      sidecarFileName: 'test-forest.adventure.json',
      pmdManifest,
      characterManifest,
    });

    expect(artifacts.map(artifact => artifact.kind)).toEqual(['sidecar', 'pmdManifest', 'characterManifest']);
    expect(artifacts.map(artifact => artifact.fileName)).toEqual([
      'test-forest.adventure.json',
      'pmd-manifest.v1.json',
      'character-manifest.v1.json',
    ]);
    expect(artifacts[0].projectPath).toBe('public/assets/adventure/maps/test-forest/test-forest.adventure.json');
    expect(artifacts.some(artifact => artifact.fileName.endsWith('.tmj'))).toBe(false);
    expect(JSON.parse(artifacts[0].content)).toEqual(adventure);
    expect(JSON.parse(artifacts[1].content)).toEqual(pmdManifest);
    expect(JSON.parse(artifacts[2].content)).toEqual(characterManifest);
    expect(artifacts.every(verifyPokeDiscoverEditorExportRoundTrip)).toBe(true);
  });

  it('normaliza el nombre del sidecar y produce JSON legible con salto final', () => {
    const artifacts = createPokeDiscoverEditorExportArtifacts({
      adventure,
      sidecarFileName: 'datos.json',
      pmdManifest,
      characterManifest,
    });

    expect(artifacts[0].fileName).toBe('forest.adventure.json');
    expect(serializePokeDiscoverEditorJson({ value: 1 })).toBe('{\n  "value": 1\n}\n');
  });

  it('rechaza un artefacto cuyo JSON no completa el round-trip canónico', () => {
    const [artifact] = createPokeDiscoverEditorExportArtifacts({ adventure, sidecarFileName: 'test.adventure.json', pmdManifest, characterManifest });
    expect(verifyPokeDiscoverEditorExportRoundTrip({ ...artifact, content: '{"mapId":"map:test"}' })).toBe(false);
    expect(verifyPokeDiscoverEditorExportRoundTrip({ ...artifact, content: '{ roto' })).toBe(false);
  });
});
