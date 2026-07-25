import { describe, expect, it } from 'vitest';
import manifest from '../../public/assets/sprites/pokemon/pmd/manifest.v1.json';
import type { PmdAnimationManifestV1 } from '../../packages/contracts/src/index.js';
import { POKEDISCOVER_EDITOR_CATALOG } from '../../src/domain/tools/pokeDiscoverEditorCatalog.js';
import {
  findPmdAssetForCatalogEntry,
  getPmdAnimations,
} from '../../src/domain/tools/pokeDiscoverEditorPmd.js';

const pmdManifest = manifest as PmdAnimationManifestV1;

describe('animaciones PMD del configurador PokeDiscover', () => {
  it('ofrece únicamente las animaciones declaradas y conserva sus alias', () => {
    const bulbasaur = POKEDISCOVER_EDITOR_CATALOG.find(entry => entry.form.formId === 'pokemon-form:1:default');
    expect(bulbasaur).toBeDefined();
    const asset = findPmdAssetForCatalogEntry(bulbasaur!, pmdManifest);
    expect(asset).toBeDefined();
    const animations = getPmdAnimations(asset!, pmdManifest.tickRate);

    expect(animations.map(animation => animation.name)).toEqual(asset!.animations.map(animation => animation.name));
    expect(animations.find(animation => animation.name === 'Strike')).toMatchObject({ copyOf: 'Attack' });
    expect(animations.every(animation => animation.durationMs > 0)).toBe(true);
  });

  it('reutiliza la forma base para apariencias y no inventa assets ausentes', () => {
    const surfista = POKEDISCOVER_EDITOR_CATALOG.find(entry => entry.variantId === 'pokemon-appearance:25:surfista');
    const geodude = POKEDISCOVER_EDITOR_CATALOG.find(entry => entry.form.formId === 'pokemon-form:74:default');

    expect(findPmdAssetForCatalogEntry(surfista!, pmdManifest)?.formId).toBe('pokemon-form:25:default');
    expect(findPmdAssetForCatalogEntry(geodude!, pmdManifest)).toBeUndefined();
  });
});
