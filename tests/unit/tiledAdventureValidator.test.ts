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
  return {
    adventure: structuredClone(teguesteAdventure),
    tiledMaps: {
      'tiled-map:tegueste-forest:02-04': structuredClone(teguesteRoom),
    },
    pmdManifest: structuredClone(pmdManifest),
    characterManifest: structuredClone(characterManifest),
  };
}

describe('validador cruzado Tiled + aventura + PMD', () => {
  it('acepta la primera habitación definitiva del Bosque de Tegueste', () => {
    expect(validateTiledAdventureBundle(teguesteBundle())).toEqual([]);
    expect(teguesteAdventure.actorPlacements).toHaveLength(7);
    expect(teguesteAdventure.characterPlacements).toHaveLength(2);
    expect(teguesteAdventure.interactions).toHaveLength(1);
    expect(teguesteAdventure.behaviorTriggers).toHaveLength(3);
    expect(teguesteAdventure.companionSequences).toHaveLength(6);
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
    expect(teguesteAdventure.dialogues).toHaveLength(1);
    expect(teguesteAdventure.actorPlacements.find(placement => placement.placementId === 'actor:cottonee'))
      .toMatchObject({ collision: 'pass-through' });
    expect(characterManifest.assets.map(asset => asset.renderScale)).toEqual([1, 1, 1]);
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
      'beat:gyarados:challenge: más de una acción para actor:gyarados:left',
      'beat:gyarados:advance: ruta inexistente path:missing',
      'beat:gyarados:first-strike: animación inexistente SplashForever para actor:gyarados:left',
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
      'tiled-map:tegueste-forest:02-04: occluder:tegueste:water-surface necesita rectángulo o polígono de oclusión',
      'occluder:tegueste:water-surface: grupo de oclusión sin actores occlusion-group:missing',
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
