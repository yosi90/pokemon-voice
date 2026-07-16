import { describe, expect, it } from 'vitest';
import {
  getAvailableThemedChallenges,
  getChallengeKindsCompleted,
  mixThemedChallenges,
  THEMED_CHALLENGES,
} from '../../src/domain/modes/themedChallenges.js';
import localPokemonCatalog from '../../src/data/pokemonCatalog.json';

const fixtureCatalog = [
  { id: 1, name: 'bulbasaur' },
  { id: 2, name: 'ivysaur' },
  { id: 3, name: 'venusaur' },
  { id: 4, name: 'charmander' },
  { id: 7, name: 'squirtle' },
  { id: 25, name: 'pikachu' },
  { id: 133, name: 'eevee' },
  { id: 152, name: 'chikorita' },
  { id: 906, name: 'sprigatito' },
];

describe('retos temáticos declarativos', () => {
  it('cubre generación, tipo y familia con IDs estables y objetivos alcanzables', () => {
    expect(THEMED_CHALLENGES).toHaveLength(30);
    expect(THEMED_CHALLENGES.filter(challenge => challenge.kind === 'generation')).toHaveLength(10);
    expect(THEMED_CHALLENGES.filter(challenge => challenge.kind === 'type')).toHaveLength(10);
    expect(THEMED_CHALLENGES.filter(challenge => challenge.kind === 'family')).toHaveLength(10);
    expect(new Set(THEMED_CHALLENGES.map(challenge => challenge.kind)))
      .toEqual(new Set(['generation', 'type', 'family']));
    expect(new Set(THEMED_CHALLENGES.map(challenge => challenge.challengeId)).size)
      .toBe(THEMED_CHALLENGES.length);
    for (const challenge of THEMED_CHALLENGES) {
      expect(challenge.targetCount).toBeGreaterThan(0);
      expect(challenge.targetCount).toBeLessThanOrEqual(challenge.targetSpeciesIds.length);
    }
  });

  it('solo ofrece retos resolubles con el catálogo cargado', () => {
    expect(getAvailableThemedChallenges(fixtureCatalog).map(challenge => challenge.challengeId))
      .toEqual(expect.arrayContaining(['generation:kanto-icons', 'type:deep-roots', 'family-ash-owned-pokemon']));
    expect(getAvailableThemedChallenges([{ id: 25, name: 'pikachu' }])).toEqual([]);
    expect(getAvailableThemedChallenges(localPokemonCatalog)).toHaveLength(30);
  });

  it('solo referencia especies disponibles en el catálogo local completo', () => {
    const localIds = new Set(localPokemonCatalog.map(pokemon => pokemon.id));
    const missingIds = THEMED_CHALLENGES.flatMap(challenge => (
      challenge.targetSpeciesIds.filter(id => !localIds.has(id))
    ));

    expect(missingIds).toEqual([]);
  });

  it('separa la cantidad de respuestas válidas del objetivo necesario', () => {
    const kanto = THEMED_CHALLENGES.find(challenge => challenge.challengeId === 'generation:kanto-icons');

    expect(kanto?.targetCount).toBe(3);
    expect(kanto?.targetSpeciesIds).toEqual(expect.arrayContaining([1, 4, 6, 25, 130, 150, 151]));
    expect(kanto?.targetSpeciesIds.length).toBeGreaterThan(kanto?.targetCount ?? 0);
  });

  it('no regala en la respuesta los Pokémon citados por los retos evolutivos', () => {
    const tyrogue = THEMED_CHALLENGES.find(challenge => challenge.challengeId === 'family-tyrogue');
    const applin = THEMED_CHALLENGES.find(challenge => challenge.challengeId === 'family-applin');

    expect(tyrogue?.targetSpeciesIds).not.toContain(236);
    expect(applin?.targetSpeciesIds).not.toContain(840);
    expect(tyrogue?.targetSpeciesIds).toHaveLength(3);
    expect(applin?.targetSpeciesIds.length).toBeGreaterThan(applin?.targetCount ?? 0);
  });

  it('aplica las nuevas listas abiertas de temática y conocimiento', () => {
    const byId = new Map(THEMED_CHALLENGES.map(challenge => [challenge.challengeId, challenge]));

    expect(byId.get('family-charcadet')?.targetSpeciesIds).toHaveLength(35);
    expect(byId.get('family-charcadet')?.targetSpeciesIds)
      .toEqual(expect.arrayContaining([123, 410, 681, 798, 888, 937, 983, 1006]));
    expect(byId.get('family-wurmple')?.targetSpeciesIds)
      .toEqual([10, 13, 265, 412, 540, 636, 664, 736, 824, 850, 872, 968]);
    expect(byId.get('family-ralts')?.targetSpeciesIds)
      .toEqual([149, 248, 373, 376, 445, 635, 706, 784, 887, 998]);
    expect(byId.get('family:bulbasaur')?.targetSpeciesIds).toHaveLength(26);
  });

  it('reconoce la tríada únicamente al completar las tres clases', () => {
    expect(getChallengeKindsCompleted(['generation:kanto-icons', 'type:deep-roots']).size).toBe(2);
    expect(getChallengeKindsCompleted([
      'generation:kanto-icons',
      'type:deep-roots',
      'family:bulbasaur',
    ]).size).toBe(3);
  });

  it('mezcla las categorías en páginas equilibradas de seis retos', () => {
    const mixed = mixThemedChallenges(THEMED_CHALLENGES, 'run:trivia');
    expect(mixThemedChallenges(THEMED_CHALLENGES, 'run:trivia')).toEqual(mixed);
    expect(new Set(mixed.map(challenge => challenge.challengeId)).size).toBe(30);

    for (let offset = 0; offset < mixed.length; offset += 6) {
      const page = mixed.slice(offset, offset + 6);
      expect(page.filter(challenge => challenge.kind === 'generation')).toHaveLength(2);
      expect(page.filter(challenge => challenge.kind === 'type')).toHaveLength(2);
      expect(page.filter(challenge => challenge.kind === 'family')).toHaveLength(2);
    }
  });
});
