import { describe, expect, it } from 'vitest';
import type { AdventureMapV3 } from '../../packages/contracts/src/index.js';
import pmdManifest from '../../public/assets/sprites/pokemon/pmd/manifest.v1.json';
import characterManifest from '../../public/assets/sprites/characters/manifest.v1.json';
import { validateTiledAdventureBundle } from '../../src/domain/maps/tiledAdventureValidator.js';
import {
  applyPokeDiscoverImmediateRecipe,
  deriveCanonicalPokemonPlacementIds,
  nextPokeDiscoverAuthoringId,
  pokeDiscoverPokemonPlacementPrefix,
  POKEDISCOVER_AUTHORING_RECIPES,
  POKEDISCOVER_RUNTIME_AUTHORING_COVERAGE,
  type PokeDiscoverImmediateRecipeRequest,
} from '../../src/domain/tools/pokeDiscoverEditorAuthoringRegistry.js';
import type { PokeDiscoverEditableTiledMap } from '../../src/domain/tools/pokeDiscoverEditorProject.js';

const POKEMON = pmdManifest.assets.slice(0, 5).map(asset => asset.assetId);
const NPC = characterManifest.assets.find(asset => asset.role === 'npc')!.assetId;

function adventure(): AdventureMapV3 {
  return {
    schemaVersion: 3,
    mapId: 'map:test',
    title: 'Mapa de prueba',
    tiledMapAssets: [{
      schemaVersion: 1,
      assetId: 'tiled-map:test:01',
      path: 'test.tmj',
    }],
    sectors: [{
      schemaVersion: 1,
      sectorId: 'sector:test:01',
      tiledMapAssetId: 'tiled-map:test:01',
      staticCamera: true,
      spawnAnchorIds: [],
      roster: {
        schemaVersion: 1,
        pokemonAssetIds: POKEMON,
        npcAssetIds: [NPC],
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
    requiredAssetIds: [...POKEMON, NPC],
  };
}

function tilemap(): PokeDiscoverEditableTiledMap {
  const tileLayer = {
    id: 1,
    name: 'Ground',
    type: 'tilelayer' as const,
    width: 10,
    height: 10,
    visible: true,
    opacity: 1,
    data: Array.from({ length: 100 }, () => 0),
  };
  return {
    type: 'map',
    orientation: 'orthogonal',
    infinite: false,
    width: 10,
    height: 10,
    tilewidth: 16,
    tileheight: 16,
    tilesets: [],
    layers: [
      tileLayer,
      { ...tileLayer, id: 2, name: 'Above' },
      { id: 3, name: 'Collision', type: 'objectgroup', visible: true, opacity: 1, objects: [] },
      { id: 4, name: 'Anchors', type: 'objectgroup', visible: true, opacity: 1, objects: [] },
    ],
  } as PokeDiscoverEditableTiledMap;
}

const cases: Array<{
  label: string;
  request: PokeDiscoverImmediateRecipeRequest;
  expectedClass: string;
}> = [
  {
    label: 'colocación Pokémon',
    request: {
      recipeId: 'pokemon-placement',
      assetId: POKEMON[0],
      animation: 'Idle',
      x: 16,
      y: 16,
    },
    expectedClass: 'ActorAnchor',
  },
  {
    label: 'encuentro Pokémon',
    request: {
      recipeId: 'pokemon-encounter',
      assetId: POKEMON[1],
      animation: 'Idle',
      x: 32,
      y: 16,
    },
    expectedClass: 'EncounterAnchor',
  },
  {
    label: 'colocación NPC',
    request: { recipeId: 'npc-placement', assetId: NPC, x: 48, y: 16 },
    expectedClass: 'ActorAnchor',
  },
  {
    label: 'entrada',
    request: { recipeId: 'entry-point', label: 'Entrada norte', x: 64, y: 16 },
    expectedClass: 'PlayerSpawn',
  },
  {
    label: 'interacción',
    request: {
      recipeId: 'interaction',
      meaningfulKind: 'inspection',
      prompt: 'Inspeccionar',
      text: 'Una señal antigua.',
      x: 80,
      y: 16,
    },
    expectedClass: 'InteractionAnchor',
  },
  {
    label: 'secreto',
    request: {
      recipeId: 'secret',
      meaningfulKind: 'secret',
      prompt: 'Investigar',
      text: 'Has encontrado un secreto.',
      x: 96,
      y: 16,
    },
    expectedClass: 'SecretAnchor',
  },
];

describe('registro de autoría garantizada', () => {
  it.each(cases)('crea $label con IDs deterministas y supera el validador', ({ request, expectedClass }) => {
    const first = applyPokeDiscoverImmediateRecipe({
      adventure: adventure(),
      tilemap: tilemap(),
      sectorId: 'sector:test:01',
      request,
    });
    const second = applyPokeDiscoverImmediateRecipe({
      adventure: adventure(),
      tilemap: tilemap(),
      sectorId: 'sector:test:01',
      request,
    });
    expect(first.primaryId).toBe(second.primaryId);
    expect(first.primaryId).toMatch(/:01$/u);
    const object = first.tilemap.layers
      .flatMap(layer => (layer.objects ?? []) as Array<{ id: number; name: string; class?: string }>)
      .find(candidate => candidate.id === first.objectId);
    expect(object).toMatchObject({ name: first.primaryId, class: expectedClass });
    expect(JSON.parse(JSON.stringify(first.tilemap))).toEqual(first.tilemap);
    expect(validateTiledAdventureBundle({
      adventure: first.adventure,
      tiledMaps: { 'tiled-map:test:01': first.tilemap },
      pmdManifest,
      characterManifest,
    })).toEqual([]);
  });

  it('rechaza assets fuera del reparto y repartos incompletos', () => {
    expect(() => applyPokeDiscoverImmediateRecipe({
      adventure: adventure(),
      tilemap: tilemap(),
      sectorId: 'sector:test:01',
      request: {
        recipeId: 'pokemon-placement',
        assetId: pmdManifest.assets[6].assetId,
        animation: 'Idle',
        x: 0,
        y: 0,
      },
    })).toThrow(/no pertenece al reparto/u);
    const incomplete = adventure();
    incomplete.sectors[0].roster.pokemonAssetIds = POKEMON.slice(0, 4);
    expect(() => applyPokeDiscoverImmediateRecipe({
      adventure: incomplete,
      tilemap: tilemap(),
      sectorId: 'sector:test:01',
      request: {
        recipeId: 'entry-point',
        label: 'Entrada',
        x: 0,
        y: 0,
      },
    })).toThrow(/al menos 5/u);
  });

  it('evita duplicados con ordinales y cubre el vocabulario runtime', () => {
    expect(nextPokeDiscoverAuthoringId(
      'placement:pokemon',
      new Set(['placement:pokemon:01', 'placement:pokemon:02']),
    )).toBe('placement:pokemon:03');
    expect(new Set(POKEDISCOVER_AUTHORING_RECIPES.map(recipe => recipe.recipeId)).size)
      .toBe(POKEDISCOVER_AUTHORING_RECIPES.length);
    expect(Object.keys(POKEDISCOVER_RUNTIME_AUTHORING_COVERAGE.anchors)).toHaveLength(6);
    expect(Object.keys(POKEDISCOVER_RUNTIME_AUTHORING_COVERAGE.meaningfulInteractions)).toHaveLength(10);
  });

  it('distingue especie, forma o apariencia y ejemplar en los IDs Pokémon', () => {
    expect(pokeDiscoverPokemonPlacementPrefix('pmd:0025-pikachu:default'))
      .toBe('placement:pokemon:pikachu:default');
    expect(pokeDiscoverPokemonPlacementPrefix('pmd:0025-pikachu:shiny'))
      .toBe('placement:pokemon:pikachu:shiny');
    expect(pokeDiscoverPokemonPlacementPrefix('pmd:0865-sirfetchd:default'))
      .toBe('placement:pokemon:sirfetchd:default');
    const source = adventure();
    source.actorPlacements = [{
      schemaVersion: 1,
      placementId: 'actor:pikachu:normal',
      sectorId: 'sector:test:01',
      anchorId: 'anchor:pikachu:normal',
      assetId: 'pmd:0025-pikachu:default',
      animation: 'Idle',
    }, {
      schemaVersion: 1,
      placementId: 'actor:pikachu:shiny',
      sectorId: 'sector:test:01',
      anchorId: 'anchor:pikachu:shiny',
      assetId: 'pmd:0025-pikachu:shiny',
      animation: 'Idle',
    }];
    expect(deriveCanonicalPokemonPlacementIds(source)).toEqual(new Map([
      ['actor:pikachu:normal', 'placement:pokemon:pikachu:default:01'],
      ['actor:pikachu:shiny', 'placement:pokemon:pikachu:shiny:01'],
    ]));
  });

  it('documenta cada receta y prueba todas las que el wizard puede ofrecer', () => {
    const wizardRecipeIds = POKEDISCOVER_AUTHORING_RECIPES
      .filter(recipe => recipe.creationMode === 'wizard')
      .map(recipe => recipe.recipeId)
      .sort();
    expect(wizardRecipeIds).toEqual([
      ...cases.map(value => value.request.recipeId),
      'map-event',
    ].sort());
    for (const recipe of POKEDISCOVER_AUTHORING_RECIPES) {
      expect(recipe.fields.length).toBeGreaterThan(0);
      expect(recipe.outputs.length).toBeGreaterThan(0);
      expect(recipe.prerequisite).not.toBe('');
      expect(recipe.validator).toBe('maps:validate');
    }
  });
});
