import { describe, expect, it } from 'vitest';
import technicalAdventure from '../../public/assets/adventure/maps/_technical/technical-test.adventure.json';
import technicalRoomRaw from '../../public/assets/adventure/maps/_technical/technical-clearing.tmj?raw';
import technicalPathRaw from '../../public/assets/adventure/maps/_technical/technical-path.tmj?raw';
import teguesteAdventure from '../../public/assets/adventure/maps/tegueste-forest/tegueste-forest.adventure.json';
import teguesteRoomRaw from '../../public/assets/adventure/maps/tegueste-forest/tegueste-forest-02-05.tmj?raw';
import pmdManifest from '../../public/assets/sprites/pokemon/pmd/manifest.v1.json';
import characterManifest from '../../public/assets/sprites/characters/manifest.v1.json';
import { validateTiledAdventureBundle } from '../../src/domain/maps/tiledAdventureValidator.js';

interface TestTiledObject {
  name: string;
  class: string;
  width?: number;
  height?: number;
}

interface TestTiledLayer {
  name: string;
  objects?: TestTiledObject[];
  [key: string]: unknown;
}

const technicalRoom = JSON.parse(technicalRoomRaw) as {
  layers: TestTiledLayer[];
  [key: string]: unknown;
};
const technicalPath = JSON.parse(technicalPathRaw) as {
  layers: TestTiledLayer[];
  [key: string]: unknown;
};
const teguesteRoom = JSON.parse(teguesteRoomRaw) as {
  layers: TestTiledLayer[];
  [key: string]: unknown;
};

function bundle() {
  return {
    adventure: structuredClone(technicalAdventure),
    tiledMaps: {
      'tiled-map:technical:clearing': structuredClone(technicalRoom),
      'tiled-map:technical:path': structuredClone(technicalPath),
    },
    pmdManifest: structuredClone(pmdManifest),
    characterManifest: structuredClone(characterManifest),
  };
}

function teguesteBundle() {
  const adventure = structuredClone(teguesteAdventure) as any;
  const sectorId = 'sector:tegueste-forest:02-04';
  const tiledMapAssetId = 'tiled-map:tegueste-forest:02-04';
  adventure.sectors = adventure.sectors.filter(
    (sector: { sectorId: string }) => sector.sectorId === sectorId,
  );
  adventure.tiledMapAssets = adventure.tiledMapAssets.filter(
    (asset: { assetId: string }) => asset.assetId === tiledMapAssetId,
  );
  for (const collection of [
    'actorPlacements',
    'characterPlacements',
    'entryPoints',
    'behaviorTriggers',
    'mapSequences',
    'expressionTriggers',
    'interactions',
    'ambientSequences',
    'rareEncounters',
    'mapEventTriggers',
  ]) {
    adventure[collection] = (adventure[collection] ?? []).filter(
      (item: { sectorId?: string }) => !item.sectorId || item.sectorId === sectorId,
    );
  }
  adventure.transitions = adventure.transitions.filter(
    (transition: { fromSectorId: string; toSectorId: string }) => (
      transition.fromSectorId === sectorId && transition.toSectorId === sectorId
    ),
  );
  return {
    adventure,
    tiledMaps: {
      'tiled-map:tegueste-forest:02-04': structuredClone(teguesteRoom),
    },
    pmdManifest: structuredClone(pmdManifest),
    characterManifest: structuredClone(characterManifest),
  };
}

describe('validador cruzado Tiled + aventura + PMD', () => {
  it('acepta la primera habitación definitiva del Bosque de Tegueste', () => {
    const candidate = teguesteBundle();
    expect(validateTiledAdventureBundle(candidate)).toEqual([]);
    expect(candidate.adventure.actorPlacements).toHaveLength(19);
    expect(teguesteAdventure.characterPlacements).toHaveLength(5);
    expect(teguesteAdventure.mapSequences).toHaveLength(7);
    expect(teguesteAdventure.interactions).toHaveLength(1);
    expect(teguesteAdventure.behaviorTriggers).toHaveLength(4);
    expect(teguesteAdventure.companionSequences).toHaveLength(7);
    expect(teguesteAdventure.behaviorTriggers.every(trigger => (
      trigger.completionEffects?.unlockSecretIds?.includes('secret:tegueste-forest:burrow-intimidation')
    ))).toBe(true);
    const snakeThreats = teguesteAdventure.companionSequences
      .flatMap(sequence => sequence.beats)
      .flatMap(beat => beat.actions)
      .filter((action): action is typeof action & { animationByCompanionSpecies: Record<string, string> } => (
        action.kind === 'playAnimation' && 'animationByCompanionSpecies' in action
      ));
    expect(snakeThreats).toHaveLength(3);
    expect(snakeThreats[0].animationByCompanionSpecies).toEqual({ 23: 'Eat', 24: 'Shoot', 336: 'Bite' });
    expect(teguesteAdventure.behaviorTriggers.find(trigger => trigger.triggerId.endsWith(':rock-tomb')))
      .toMatchObject({
        requirement: { kind: 'fieldCapability', capabilityId: 'rock-tomb', minimumStrength: 1 },
        sequenceId: 'sequence:tegueste:burrow-left:rock-tomb',
      });
    expect(teguesteAdventure.dialogues).toHaveLength(1);
    expect(teguesteAdventure.fieldNotebookHints).toHaveLength(2);
    expect(teguesteAdventure.interactions[0].completionEffects).toMatchObject({
      npcId: 'npc:tegueste:professor-alcanfor',
      conversationId: 'conversation:tegueste:professor-warning',
      hintIds: ['hint:tegueste:rattata-follow-food', 'hint:tegueste:cramorant-startle'],
    });
    expect(teguesteAdventure.expressionTriggers.every(trigger => (
      trigger.rewardPackageId === 'reward-package:map-secret'
      && trigger.completionEffects?.unlockSecretIds?.length === 1
    ))).toBe(true);
    expect(teguesteAdventure.actorPlacements.find(
      placement => placement.placementId === 'placement:pokemon:cottonee:default:01',
    ))
      .toMatchObject({ collision: 'pass-through' });
    expect(characterManifest.assets.every(asset => asset.renderScale === 1)).toBe(true);
    expect(characterManifest.assets).toEqual(expect.arrayContaining([
      expect.objectContaining({ assetId: 'character:trainer:achaman:swim', role: 'player' }),
      expect.objectContaining({ assetId: 'character:trainer:guayota:swim', role: 'player' }),
      expect.objectContaining({ assetId: 'character:mount:lapras-surf', role: 'mount' }),
    ]));
  });

  it('rechaza interacciones con objetivos o páginas de diálogo rotas', () => {
    const broken = teguesteBundle() as any;
    broken.adventure.interactions[0].target.placementId = 'character:missing';
    broken.adventure.dialogues[0].pages[0].nextPageId = 'dialogue-page:missing';

    expect(validateTiledAdventureBundle(broken)).toEqual(expect.arrayContaining([
      'interaction:tegueste:talk-professor-camphor: placement objetivo inexistente character:missing',
      'dialogue-page:tegueste:professor-warning:1: página siguiente inexistente dialogue-page:missing',
    ]));
  });

  it('valida eventos espaciales y rechaza políticas, zonas o secuencias desconocidas', () => {
    const candidate = bundle() as any;
    const placement = candidate.adventure.actorPlacements[0];
    const sector = candidate.adventure.rooms.find(
      (item: any) => item.roomId === placement.roomId,
    );
    const tmj = candidate.tiledMaps[sector.tiledMapAssetId];
    tmj.layers.push({
      id: 999,
      name: 'Triggers',
      type: 'objectgroup',
      objects: [{
        id: 999,
        name: 'trigger:map:99:zone:01',
        class: 'TriggerZone',
        x: 16,
        y: 16,
        width: 32,
        height: 32,
      }],
    });
    candidate.adventure.mapSequences = [...(candidate.adventure.mapSequences ?? []), {
      schemaVersion: 1,
      sequenceId: 'sequence:map-event:99',
      roomId: placement.roomId,
      beats: [{
        schemaVersion: 1,
        beatId: 'sequence:map-event:99:beat:01',
        actions: [{
          kind: 'playAnimation',
          actorRef: placement.placementId,
          animation: placement.animation,
        }],
      }],
    }];
    candidate.adventure.mapEventTriggers = [{
      schemaVersion: 1,
      triggerId: 'trigger:map:99',
      roomId: placement.roomId,
      activation: { kind: 'enterZone', zoneId: 'trigger:map:99:zone:01' },
      requirement: { kind: 'trainerLevel', minimum: 1 },
      sequenceId: 'sequence:map-event:99',
      repeatPolicy: 'oncePerVisit',
      resultingActorStates: [{
        schemaVersion: 1,
        placementId: placement.placementId,
        animation: placement.animation,
      }],
    }];
    expect(validateTiledAdventureBundle(candidate)).toEqual([]);

    const unknown = structuredClone(candidate);
    unknown.adventure.mapEventTriggers[0].activation.kind = 'telepathy';
    unknown.adventure.mapSequences.at(-1).beats[0].actions[0].kind = 'warp';
    expect(validateTiledAdventureBundle(unknown)).toEqual(expect.arrayContaining([
      'trigger:map:99: activación desconocida telepathy',
      'sequence:map-event:99:beat:01: acción de secuencia desconocida warp',
    ]));

    candidate.adventure.mapEventTriggers[0].repeatPolicy = 'cada-rato';
    candidate.adventure.mapEventTriggers[0].sequenceId = 'sequence:missing';
    candidate.adventure.mapEventTriggers[0].activation.zoneId = 'zone:missing';
    expect(validateTiledAdventureBundle(candidate)).toEqual(expect.arrayContaining([
      'trigger:map:99: política de repetición desconocida cada-rato',
      'trigger:map:99: secuencia de evento inexistente sequence:missing',
      'trigger:map:99: zona inexistente zone:missing',
      'trigger:map:99:zone:01: zona de trigger huérfana',
    ]));
  });

  it('acepta comentarios editoriales estrictos y los rechaza fuera de Comments', () => {
    const candidate = bundle() as any;
    const tmj = candidate.tiledMaps['tiled-map:technical:clearing'];
    tmj.layers.push({
      id: 998,
      name: 'Comments',
      type: 'objectgroup',
      objects: [{
        id: 998,
        name: 'comment:01',
        class: 'EditorComment',
        x: 16,
        y: 16,
        width: 32,
        height: 32,
        properties: [{ name: 'text', value: 'Revisar esta zona' }],
      }],
    });
    expect(validateTiledAdventureBundle(candidate)).toEqual([]);

    tmj.layers.find((layer: any) => layer.name === 'Anchors').objects.push({
      id: 997,
      name: 'comment:outside',
      class: 'EditorComment',
      x: 8,
      y: 8,
      width: 16,
      height: 16,
    });
    tmj.layers.find((layer: any) => layer.name === 'Comments').objects[0]
      .properties.push({ name: 'runtimeTriggerId', value: 'trigger:map:01' });
    expect(validateTiledAdventureBundle(candidate)).toEqual(expect.arrayContaining([
      'tiled-map:technical:clearing: comment:outside usa EditorComment fuera de Comments',
      'tiled-map:technical:clearing: comment:01 contiene la propiedad no editorial runtimeTriggerId',
    ]));
  });

  it('admite encuentros y secretos sobre sus clases de anclaje específicas', () => {
    const candidate = teguesteBundle() as any;
    const anchors = candidate.tiledMaps['tiled-map:tegueste-forest:02-04'].layers
      .find((layer: TestTiledLayer) => layer.name === 'Anchors').objects;
    anchors.push({ id: 999, name: 'anchor:test:encounter', type: 'EncounterAnchor', x: 100, y: 100, width: 0, height: 0 });
    anchors.push({ id: 1000, name: 'anchor:tree:hit', type: 'SecretAnchor', x: 116, y: 100, width: 16, height: 16 });
    candidate.adventure.actorPlacements.push({
      schemaVersion: 1,
      placementId: 'actor:test:encounter',
      sectorId: 'sector:tegueste-forest:02-04',
      anchorId: 'anchor:test:encounter',
      assetId: 'pmd:0019-rattata:default',
      animation: 'Idle',
    });
    candidate.adventure.dialogues.push({
      schemaVersion: 1,
      dialogueId: 'dialogue:test:secret',
      initialPageId: 'page:test:secret',
      pages: [{ schemaVersion: 1, pageId: 'page:test:secret', speakerName: 'PokeDiscover', text: 'Secreto.' }],
    });
    candidate.adventure.interactions.push({
      schemaVersion: 1,
      interactionId: 'interaction:test:secret',
      sectorId: 'sector:tegueste-forest:02-04',
      target: { kind: 'anchor', anchorId: 'anchor:tree:hit' },
      prompt: 'Investigar',
      dialogueId: 'dialogue:test:secret',
      meaningfulKind: 'secret',
    });

    expect(validateTiledAdventureBundle(candidate)).toEqual([]);
  });

  it('valida investigación portable contra mapa e interacción', () => {
    const candidate = teguesteBundle() as any;
    candidate.adventure.researchFacts = [{
      schemaVersion: 1,
      factId: 'research:test:rattata',
      speciesId: 19,
      field: 'behavior',
      contribution: 'fieldCompletion',
      mapId: candidate.adventure.mapId,
      interactionId: candidate.adventure.interactions[0].interactionId,
      text: 'Rattata busca alimento en grupo.',
      rewards: [{ kind: 'discoveryPoints', amount: 10 }],
    }];
    expect(validateTiledAdventureBundle(candidate)).toEqual([]);

    candidate.adventure.researchFacts[0].interactionId = 'interaction:missing';
    candidate.adventure.researchFacts[0].rewards[0].amount = 0;
    expect(validateTiledAdventureBundle(candidate)).toEqual(expect.arrayContaining([
      'research:test:rattata: interacción inexistente interaction:missing',
      'research:test:rattata: recompensa discoveryPoints debe ser positiva',
    ]));
  });

  it('rechaza pistas inexistentes o adscritas a otro mapa', () => {
    const broken = teguesteBundle() as any;
    broken.adventure.interactions[0].completionEffects.hintIds = ['hint:tegueste:missing'];
    broken.adventure.fieldNotebookHints[0].mapId = 'map:other';

    expect(validateTiledAdventureBundle(broken)).toEqual(expect.arrayContaining([
      'hint:tegueste:rattata-follow-food: mapId no coincide con map:tegueste:camphor-forest',
      'interaction:tegueste:talk-professor-camphor: pista de cuaderno inexistente hint:tegueste:missing',
    ]));
  });

  it('rechaza pistas expresivas inexistentes o relacionadas con otro trigger', () => {
    const broken = teguesteBundle() as any;
    broken.adventure.expressionTriggers[0].knownHintIds = ['hint:tegueste:missing'];
    broken.adventure.expressionTriggers[1].knownHintIds = ['hint:tegueste:rattata-follow-food'];
    broken.adventure.fieldNotebookHints[0].relatedTriggerId = 'expression:tegueste:other';

    expect(validateTiledAdventureBundle(broken)).toEqual(expect.arrayContaining([
      'expression:tegueste:compliment-cottonee: pista expresiva inexistente hint:tegueste:missing',
      'expression:tegueste:scare-cramorant: hint:tegueste:rattata-follow-food está relacionada con otro trigger',
    ]));
  });

  it('valida el contexto espacial de las interacciones expresivas', () => {
    const broken = teguesteBundle() as any;
    const trigger = broken.adventure.expressionTriggers[0];
    trigger.target.placementId = 'actor:missing';
    trigger.rangeTiles = 0;

    expect(validateTiledAdventureBundle(broken)).toEqual(expect.arrayContaining([
      'expression:tegueste:compliment-cottonee: placement objetivo inexistente actor:missing',
      'expression:tegueste:compliment-cottonee: rangeTiles debe ser un entero positivo',
    ]));
  });

  it('rechaza recompensas expresivas sin origen y secretos expresivos duplicados', () => {
    const broken = teguesteBundle() as any;
    broken.adventure.expressionTriggers[0].rewardOriginId = undefined;
    const secretId = broken.adventure.expressionTriggers[1].completionEffects.unlockSecretIds[0];
    broken.adventure.expressionTriggers[1].completionEffects.unlockSecretIds.push(secretId);

    expect(validateTiledAdventureBundle(broken)).toEqual(expect.arrayContaining([
      'expression:tegueste:compliment-cottonee: una recompensa necesita rewardOriginId',
      'expression:tegueste:scare-cramorant: secreto expresivo duplicado secret:tegueste-forest:scare-cramorant',
    ]));
  });

  it('rechaza umbrales acústicos imposibles o sin entrada de voz', () => {
    const broken = teguesteBundle() as any;
    const trigger = broken.adventure.expressionTriggers
      .find((candidate: { triggerId: string }) => candidate.triggerId === 'expression:tegueste:scare-cramorant');
    trigger.inputMethods = ['contextAction'];
    trigger.matchAny[0].minimumLevel = 2;
    trigger.matchAny[0].minimumDurationMs = -1;

    expect(validateTiledAdventureBundle(broken)).toEqual(expect.arrayContaining([
      'expression:tegueste:scare-cramorant: una condición acústica necesita el método voice',
      'expression:tegueste:scare-cramorant: minimumLevel acústico debe estar entre 0 y 1',
      'expression:tegueste:scare-cramorant: minimumDurationMs acústico debe ser positivo',
    ]));
  });

  it('valida rutas, animaciones y una única acción ambiental por actor y beat', () => {
    const broken = teguesteBundle() as any;
    const sequence = broken.adventure.ambientSequences[0];
    sequence.beats[0].actions.push(structuredClone(sequence.beats[0].actions[0]));
    sequence.beats[2].actions[0].pathId = 'path:missing';
    sequence.beats[1].actions[0].animation = 'SplashForever';

    expect(validateTiledAdventureBundle(broken)).toEqual(expect.arrayContaining([
      'beat:gyarados:challenge: más de una acción para placement:pokemon:gyarados:default:01',
      'beat:gyarados:advance: ruta inexistente path:missing',
      'beat:gyarados:first-strike: animación inexistente SplashForever para placement:pokemon:gyarados:default:01',
    ]));
  });

  it('rechaza polígonos de oclusión inválidos y grupos sin actores', () => {
    const broken = teguesteBundle() as any;
    const occlusion = broken.tiledMaps['tiled-map:tegueste-forest:02-04'].layers
      .find((layer: TestTiledLayer) => layer.name === 'Occlusion');
    const object = occlusion.objects[0];
    object.polygon = [{ x: 0, y: 0 }, { x: 16, y: 0 }];
    object.properties.find((property: { name: string }) => property.name === 'occlusionGroup').value = 'occlusion-group:missing';

    expect(validateTiledAdventureBundle(broken)).toEqual(expect.arrayContaining([
      `tiled-map:tegueste-forest:02-04: ${object.name} necesita rectángulo o polígono de oclusión`,
      `${object.name}: grupo de oclusión sin actores occlusion-group:missing`,
    ]));
  });

  it('acepta la habitación técnica y coloca a Rattata desde el sidecar', () => {
    expect(validateTiledAdventureBundle(bundle())).toEqual([]);
    expect(technicalAdventure.transitions).toHaveLength(2);
    const idle = pmdManifest.assets
      .find(asset => asset.assetId === 'pmd:0019-rattata:default')
      ?.animations.find(animation => animation.name === 'Idle');
    expect(idle).toMatchObject({ frameWidth: 32, frameHeight: 32, frameCount: 8, directionCount: 8 });
    expect(idle?.groundOrigins).toHaveLength(8);
    expect(idle?.groundOrigins[0]).toEqual({ x: .5, y: .625 });
  });

  it('valida raros, variantes y referencias locales de eventos globales', () => {
    const candidate = bundle() as any;
    candidate.adventure.rareEncounters = [{ encounterId: 'encounter:test:rare', speciesId: 151, requirement: { kind: 'trainerLevel', minimum: 2 }, baseProbability: .2, guaranteedEligibleVisit: 3 }];
    candidate.adventure.variants = [{ variantId: 'variant:test:night', requirement: { kind: 'worldFlag', flagId: 'night', expected: true }, enabledObjectIds: ['object:moon'] }];
    candidate.adventure.worldEvents = [{ schemaVersion: 1, eventId: 'event:test:night', activation: { kind: 'trainerLevel', minimum: 3 }, setFlags: { night: true }, encounterInjections: [{ mapId: candidate.adventure.mapId, encounterId: 'encounter:test:rare' }], mapVariants: [{ mapId: candidate.adventure.mapId, variantId: 'variant:test:night' }] }];
    expect(validateTiledAdventureBundle(candidate)).toEqual([]);

    candidate.adventure.rareEncounters[0].baseProbability = 1;
    candidate.adventure.variants[0].disabledObjectIds = ['object:moon'];
    candidate.adventure.worldEvents[0].encounterInjections[0].encounterId = 'encounter:missing';
    candidate.adventure.worldEvents[0].mapVariants[0].variantId = 'variant:missing';
    expect(validateTiledAdventureBundle(candidate)).toEqual(expect.arrayContaining([
      'encounter:test:rare: baseProbability debe estar entre 0 y 1 sin incluirlos',
      'variant:test:night: object:moon no puede estar habilitado y deshabilitado a la vez',
      'event:test:night: encuentro local inexistente encounter:missing',
      'event:test:night: variante local inexistente variant:missing',
    ]));
  });

  it('detecta capas, anclas y animaciones rotas con mensajes accionables', () => {
    const broken = bundle();
    broken.tiledMaps['tiled-map:technical:clearing'].layers = broken
      .tiledMaps['tiled-map:technical:clearing'].layers
      .filter((layer: TestTiledLayer) => layer.name !== 'Above');
    broken.adventure.rooms[0].spawnAnchorIds = ['anchor:technical:missing'];
    broken.adventure.actorPlacements[0].animation = 'DanceForever';

    expect(validateTiledAdventureBundle(broken)).toEqual(expect.arrayContaining([
      'tiled-map:technical:clearing: falta la capa Above',
      'room:technical:clearing: spawnAnchorId inexistente anchor:technical:missing',
      'actor-placement:technical:rattata: animación inexistente DanceForever',
    ]));
  });

  it('rechaza políticas de colisión desconocidas en actores', () => {
    const broken = bundle();
    Object.assign(broken.adventure.actorPlacements[0], { collision: 'sometimes' });

    expect(validateTiledAdventureBundle(broken)).toContain(
      'actor-placement:technical:rattata: colisión de actor desconocida sometimes',
    );
  });

  it('rechaza IDs numéricos accidentales y objetos sin clase semántica', () => {
    const broken = bundle();
    const anchors = broken.tiledMaps['tiled-map:technical:clearing'].layers
      .find((layer: TestTiledLayer) => layer.name === 'Anchors');
    if (!anchors?.objects) throw new Error('La plantilla debe contener Anchors.');
    anchors.objects[0].name = '';
    anchors.objects[1].class = '';

    expect(validateTiledAdventureBundle(broken)).toEqual(expect.arrayContaining([
      'tiled-map:technical:clearing: objeto de Anchors sin nombre estable',
      'tiled-map:technical:clearing: clase de ancla desconocida (vacía)',
    ]));
  });

  it('exige zonas rectangulares para las transiciones', () => {
    const broken = bundle();
    const anchors = broken.tiledMaps['tiled-map:technical:clearing'].layers
      .find((layer: TestTiledLayer) => layer.name === 'Anchors');
    const transitionAnchor = anchors?.objects?.find(object => object.class === 'TransitionAnchor');
    if (!transitionAnchor) throw new Error('La plantilla debe contener un TransitionAnchor.');
    transitionAnchor.width = 0;

    expect(validateTiledAdventureBundle(broken)).toContain(
      'tiled-map:technical:clearing: anchor:technical:clearing-east debe ser un rectángulo de transición',
    );
  });

  it('no exige nombres ni clase repetida a las colisiones estáticas', () => {
    const valid = bundle();
    const collisionLayer = valid.tiledMaps['tiled-map:technical:clearing'].layers
      .find((layer: TestTiledLayer) => layer.name === 'Collision');
    if (!collisionLayer?.objects) throw new Error('La plantilla debe contener Collision.');
    collisionLayer.objects[0].name = '';
    collisionLayer.objects[0].class = '';

    expect(validateTiledAdventureBundle(valid)).toEqual([]);
  });
});
