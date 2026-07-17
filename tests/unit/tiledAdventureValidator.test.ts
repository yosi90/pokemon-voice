import { describe, expect, it } from 'vitest';
import technicalAdventure from '../../public/assets/adventure/maps/_technical/technical-test.adventure.json';
import technicalRoomRaw from '../../public/assets/adventure/maps/_technical/technical-clearing.tmj?raw';
import technicalPathRaw from '../../public/assets/adventure/maps/_technical/technical-path.tmj?raw';
import pmdManifest from '../../public/assets/sprites/pokemon/pmd/manifest.v1.json';
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

function bundle() {
  return {
    adventure: structuredClone(technicalAdventure),
    tiledMaps: {
      'tiled-map:technical:clearing': structuredClone(technicalRoom),
      'tiled-map:technical:path': structuredClone(technicalPath),
    },
    pmdManifest: structuredClone(pmdManifest),
  };
}

describe('validador cruzado Tiled + aventura + PMD', () => {
  it('acepta la habitación técnica y coloca a Rattata desde el sidecar', () => {
    expect(validateTiledAdventureBundle(bundle())).toEqual([]);
    expect(technicalAdventure.transitions).toHaveLength(2);
    const idle = pmdManifest.assets
      .find(asset => asset.assetId === 'pmd:0019-rattata:default')
      ?.animations.find(animation => animation.name === 'Idle');
    expect(idle).toMatchObject({ frameWidth: 32, frameHeight: 32, frameCount: 8, directionCount: 8 });
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
});
