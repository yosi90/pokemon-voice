import { describe, expect, it } from 'vitest';
import {
  POKEDISCOVER_TOOLS,
  resolvePokeDiscoverToolUrl,
} from '../../src/sidewebs/shared/ToolNavigation.js';

describe('navegación común de herramientas', () => {
  it('mantiene un registro único de las cuatro sidewebs', () => {
    expect(POKEDISCOVER_TOOLS.map(tool => tool.id))
      .toEqual(['editor', 'story', 'visualNovel', 'randomizer']);
  });

  it('resuelve rutas hermanas bajo cualquier subdirectorio de despliegue', () => {
    expect(resolvePokeDiscoverToolUrl(
      'visualNovel',
      'https://example.test/pokemon/tools/pokediscover-editor/',
    )).toBe('https://example.test/pokemon/tools/visual-novel-editor/');
    expect(resolvePokeDiscoverToolUrl(
      'randomizer',
      'https://example.test/subdir/tools/visual-novel-editor/index.html',
    )).toBe('https://example.test/subdir/tools/pokediscover-randomizer/');
  });
});
