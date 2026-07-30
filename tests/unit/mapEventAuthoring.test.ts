import { describe, expect, it } from 'vitest';
import type { AdventureMapV3, MapEventTriggerV3 } from '../../packages/contracts/src/index.js';
import {
  DEFAULT_MIGRATION_COMMENT,
  defaultPokeDiscoverMigrationComment,
  readPokeDiscoverEditorCommentText,
  replacePokeDiscoverTiledObjectWithComment,
} from '../../src/domain/tools/pokeDiscoverEditorComments.js';
import { createPokeDiscoverMapEventFromComment } from '../../src/domain/tools/pokeDiscoverMapEventAuthoring.js';
import {
  commitPokeDiscoverEditorHistory,
  redoPokeDiscoverEditorHistory,
  undoPokeDiscoverEditorHistory,
  type PokeDiscoverEditableTiledMap,
  type PokeDiscoverTiledObject,
} from '../../src/domain/tools/pokeDiscoverEditorProject.js';
import {
  completeMapEventTrigger,
  enterMapEventSector,
  isMapEventTriggerCompleted,
} from '../../src/domain/expeditions/mapEventTriggers.js';
import { beginExpedition } from '../../src/domain/expeditions/expeditionSession.js';
import { createPokeVoiceSaveV1 } from '../../src/domain/progress/pokeVoiceSave.js';

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
      visible: true,
      opacity: 1,
      objects: [{
        id: 67,
        name: 'anchor:action:1',
        class: 'ActionAnchor',
        type: 'ActionAnchor',
        x: 24,
        y: 48,
        width: 32,
        height: 48,
        rotation: 17,
        visible: true,
      }],
    }],
    nextlayerid: 2,
    nextobjectid: 68,
  } as PokeDiscoverEditableTiledMap;
}

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
      placementId: 'placement:pokemon:01',
      sectorId: 'sector:test:01',
      anchorId: 'placement:pokemon:01',
      assetId: 'pmd:test',
      animation: 'Sleep',
      direction: 'down',
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

describe('comentarios editoriales y eventos de mapa', () => {
  it('describe la eliminación según el tipo de objeto', () => {
    expect(defaultPokeDiscoverMigrationComment({
      layerName: 'Collision',
      className: 'Collision',
    })).toBe('Colisión eliminada durante la migración');
    expect(defaultPokeDiscoverMigrationComment({
      layerName: 'Paths',
      className: 'AmbientPath',
    })).toBe('Ruta eliminada durante la migración');
    expect(defaultPokeDiscoverMigrationComment({
      layerName: 'Anchors',
      className: 'ActorAnchor',
      objectName: 'anchor:pelipper',
    })).toBe('Ancla eliminada durante la migración\nanchor:pelipper');
  });
  it('sustituye #67 en una operación y conserva geometría y metadatos', () => {
    const initial = tilemap();
    const replacement = replacePokeDiscoverTiledObjectWithComment(initial, 67);
    const comment = replacement.object;

    expect(replacement.tilemap.layers.find(layer => layer.name === 'Anchors')?.objects).toEqual([]);
    expect(comment).toMatchObject({
      name: 'comment:01',
      class: 'EditorComment',
      x: 24,
      y: 48,
      width: 32,
      height: 48,
      rotation: 17,
    });
    expect(readPokeDiscoverEditorCommentText(comment))
      .toBe(`${DEFAULT_MIGRATION_COMMENT}\nanchor:action:1`);
    expect(comment.properties).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'migrationSourceObjectId', value: 67 }),
      expect.objectContaining({ name: 'migrationSourceObjectName', value: 'anchor:action:1' }),
      expect.objectContaining({ name: 'migrationSourceObjectClass', value: 'ActionAnchor' }),
    ]));

    const history = commitPokeDiscoverEditorHistory(
      { past: [], present: initial, future: [] },
      replacement.tilemap,
    );
    expect(undoPokeDiscoverEditorHistory(history).present).toEqual(initial);
    expect(redoPokeDiscoverEditorHistory(undoPokeDiscoverEditorHistory(history)).present)
      .toEqual(replacement.tilemap);
  });

  it('crea trigger, zona, ruta, secuencia y estado final con IDs deterministas', () => {
    const replacement = replacePokeDiscoverTiledObjectWithComment(tilemap(), 67);
    const result = createPokeDiscoverMapEventFromComment(
      adventure(),
      replacement.tilemap,
      'sector:test:01',
      replacement.object.id,
      {
        activationKind: 'enterZone',
        repeatPolicy: 'oncePerVisit',
        placementId: 'placement:pokemon:01',
        startAnimation: 'Surprise',
        movementAnimation: 'Fly',
        finalAnimation: 'Idle',
        finalDirection: 'right',
        pathPoints: [{ x: 40, y: 80 }, { x: 72, y: 80 }, { x: 104, y: 48 }],
      },
    );

    expect(result).toMatchObject({
      triggerId: 'trigger:map:01',
      sequenceId: 'sequence:map-event:01',
      zoneId: 'trigger:map:01:zone:01',
    });
    expect(result.adventure.mapEventTriggers?.[0]).toMatchObject({
      repeatPolicy: 'oncePerVisit',
      activation: { kind: 'enterZone', zoneId: 'trigger:map:01:zone:01' },
      resultingActorStates: [{
        placementId: 'placement:pokemon:01',
        animation: 'Idle',
        position: { kind: 'pathEnd' },
      }],
    });
    expect(result.adventure.mapSequences?.[0].beats.map(beat => beat.actions[0].kind))
      .toEqual(['playAnimation', 'movePath', 'playAnimation']);
    expect(result.tilemap.layers.find(layer => layer.name === 'Comments')?.objects).toEqual([]);
    expect((result.tilemap.layers.find(layer => layer.name === 'Triggers')?.objects as PokeDiscoverTiledObject[])[0])
      .toMatchObject({ name: 'trigger:map:01:zone:01', class: 'TriggerZone', x: 24, y: 48 });
  });

  it('separa la memoria por visita de la persistente y no almacena la repetible', () => {
    const initial = createPokeVoiceSaveV1({ runId: 'run:test', now: 1 });
    const base = beginExpedition({
      ...initial,
      pokedexRun: {
        ...initial.pokedexRun,
        selectedCompanion: { schemaVersion: 1, formId: 'pokemon-form:25:default' },
      },
    }, {
      mapId: 'map:test',
      enteredAt: '2026-07-28T10:00:00.000Z',
    });
    const trigger = (policy: MapEventTriggerV3['repeatPolicy']): MapEventTriggerV3 => ({
      schemaVersion: 1,
      triggerId: `trigger:map:${policy}`,
      sectorId: 'sector:test:01',
      activation: { kind: 'enterZone', zoneId: 'trigger:map:01:zone:01' },
      requirement: { kind: 'trainerLevel', minimum: 1 },
      sequenceId: 'sequence:map-event:01',
      repeatPolicy: policy,
      resultingActorStates: [],
    });

    const visit = completeMapEventTrigger(base, 'map:test', trigger('oncePerVisit')).save;
    expect(visit.activeExpeditionSession?.completedMapEventTriggerIds)
      .toContain('trigger:map:oncePerVisit');
    expect(isMapEventTriggerCompleted(visit, 'map:test', trigger('oncePerVisit'))).toBe(true);

    const persistent = completeMapEventTrigger(visit, 'map:test', trigger('persistent')).save;
    expect(persistent.pokeDiscover.mapProgress['map:test'].completedMapEventTriggerIds)
      .toContain('trigger:map:persistent');

    const repeatable = completeMapEventTrigger(persistent, 'map:test', trigger('repeatable')).save;
    expect(repeatable).toBe(persistent);
    expect(isMapEventTriggerCompleted(repeatable, 'map:test', trigger('repeatable'))).toBe(false);
  });

  it('conserva un evento de sector al recargar y lo rearma al visitar otro sector', () => {
    const initial = createPokeVoiceSaveV1({ runId: 'run:test', now: 1 });
    const started = beginExpedition({
      ...initial,
      pokedexRun: {
        ...initial.pokedexRun,
        selectedCompanion: { schemaVersion: 1, formId: 'pokemon-form:25:default' },
      },
    }, {
      mapId: 'map:test',
      enteredAt: '2026-07-28T10:00:00.000Z',
    });
    const entered = enterMapEventSector(started, 'map:test', 'sector:test:01');
    const trigger: MapEventTriggerV3 = {
      schemaVersion: 1,
      triggerId: 'trigger:map:sector',
      sectorId: 'sector:test:01',
      activation: { kind: 'enterZone', zoneId: 'trigger:map:01:zone:01' },
      requirement: { kind: 'trainerLevel', minimum: 1 },
      sequenceId: 'sequence:map-event:01',
      repeatPolicy: 'oncePerSectorVisit',
      resultingActorStates: [],
    };
    const completed = completeMapEventTrigger(entered, 'map:test', trigger).save;
    expect(isMapEventTriggerCompleted(completed, 'map:test', trigger)).toBe(true);
    expect(enterMapEventSector(completed, 'map:test', 'sector:test:01')).toBe(completed);
    const elsewhere = enterMapEventSector(completed, 'map:test', 'sector:test:02');
    expect(isMapEventTriggerCompleted(elsewhere, 'map:test', trigger)).toBe(false);
  });

  it('aplica recompensas y secretos de un evento una sola vez', () => {
    const initial = createPokeVoiceSaveV1({ runId: 'run:test', now: 1 });
    const started = beginExpedition({
      ...initial,
      pokedexRun: {
        ...initial.pokedexRun,
        selectedCompanion: { schemaVersion: 1, formId: 'pokemon-form:25:default' },
      },
    }, {
      mapId: 'map:test',
      enteredAt: '2026-07-28T10:00:00.000Z',
    });
    const trigger: MapEventTriggerV3 = {
      schemaVersion: 1,
      triggerId: 'trigger:map:reward',
      sectorId: 'sector:test:01',
      activation: { kind: 'interval', intervalMs: 1_000 },
      requirement: { kind: 'trainerLevel', minimum: 1 },
      sequenceId: 'sequence:map-event:01',
      resultingActorStates: [],
      rewardOriginId: 'reward:map:test',
      rewards: [{ kind: 'discoveryPoints', amount: 10 }],
      completionEffects: { unlockSecretIds: ['secret:test'] },
    };
    const completed = completeMapEventTrigger(started, 'map:test', trigger, {
      completedAt: '2026-07-28T10:01:00.000Z',
    }).save;

    expect(completed.pokeDiscover.discoveryPoints).toBe(10);
    expect(completed.pokeDiscover.mapProgress['map:test'].unlockedSecretIds)
      .toContain('secret:test');
    expect(completeMapEventTrigger(completed, 'map:test', trigger, {
      completedAt: '2026-07-28T10:02:00.000Z',
    }).save).toBe(completed);
  });
});
