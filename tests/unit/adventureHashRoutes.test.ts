import { describe, expect, it } from 'vitest';
import {
  buildExpeditionHash,
  buildMissionHash,
  buildPokeDiscoverHash,
  parseAdventureHashRoute,
} from '../../src/domain/expeditions/adventureHashRoutes.js';

describe('rutas hash de misiones y expediciones', () => {
  it('mantiene IDs estables con dos puntos mediante segmentos codificados', () => {
    const missionId = 'mission:tegueste:help-professor-camphor';
    const mapId = 'map:tegueste:camphor-forest';
    const roomId = 'room:tegueste-forest:02-04';

    expect(parseAdventureHashRoute(buildMissionHash(missionId))).toEqual({ kind: 'mission', missionId });
    expect(parseAdventureHashRoute(buildExpeditionHash(mapId, roomId))).toEqual({
      kind: 'expedition',
      mapId,
      roomId,
    });
  });

  it('distingue PokeDiscover y degrada rutas desconocidas a la Pokédex', () => {
    expect(parseAdventureHashRoute(buildPokeDiscoverHash())).toEqual({ kind: 'pokeDiscover' });
    expect(parseAdventureHashRoute('#/expeditions/incompleta')).toEqual({ kind: 'pokedex' });
    expect(parseAdventureHashRoute('#/cualquier-cosa')).toEqual({ kind: 'pokedex' });
  });
});
