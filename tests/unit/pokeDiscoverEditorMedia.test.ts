import { describe, expect, it } from 'vitest';
import {
  addPokeDiscoverCharacterMode,
  addPokeDiscoverMediaAsset,
  createPokeDiscoverAudioAsset,
  createPokeDiscoverEffectAsset,
  validatePokeDiscoverMediaFile,
} from '../../src/domain/tools/pokeDiscoverEditorMedia.js';
import {
  resolveCompanionWaterMount,
  resolveCompanionWaterTraversal,
} from '../../src/domain/expeditions/companionWaterTraversal.js';

describe('catálogo global de medios', () => {
  it('crea un spritesheet de efecto reproducible', () => {
    const effect = createPokeDiscoverEffectAsset({
      assetId: 'effect:bubble',
      path: 'assets/adventure/media/effects/bubble.png',
      frameWidth: 16,
      frameHeight: 16,
      columns: 3,
      rows: 2,
      frameDurationMs: 80,
      source: 'importado',
    });
    expect(effect.animations[0].frames).toEqual([0, 1, 2, 3, 4, 5]);
    expect(addPokeDiscoverMediaAsset({ schemaVersion: 1, assets: [] }, effect).assets)
      .toEqual([effect]);
    expect(() => addPokeDiscoverMediaAsset(
      { schemaVersion: 1, assets: [effect] },
      effect,
    )).toThrow('Ya existe');
  });

  it('acepta WAV/OGG/MP3 y clasifica música en bucle', () => {
    expect(validatePokeDiscoverMediaFile({ name: 'theme.ogg', type: 'audio/ogg' }, 'audio'))
      .toBeUndefined();
    expect(validatePokeDiscoverMediaFile({ name: 'theme.aac', type: 'audio/aac' }, 'audio'))
      .toContain('WAV');
    expect(createPokeDiscoverAudioAsset({
      assetId: 'audio:forest',
      path: 'assets/adventure/media/audio/forest.mp3',
      audioKind: 'music',
      source: 'importado',
    }).defaultLoop).toBe(true);
    expect(createPokeDiscoverAudioAsset({
      assetId: 'audio:voice:alcanfor:welcome',
      path: 'assets/adventure/media/audio/alcanfor-welcome.ogg',
      audioKind: 'voice',
      source: 'importado',
    })).toMatchObject({ audioKind: 'voice', defaultLoop: false });
    expect(validatePokeDiscoverMediaFile({
      name: 'lapras-surf.png',
      type: 'image/png',
    }, 'mount')).toBeUndefined();
  });

  it('agrupa caminar y nadar en la misma apariencia', () => {
    const manifest = addPokeDiscoverCharacterMode({
      schemaVersion: 1,
      assets: [{
        schemaVersion: 1,
        assetId: 'character:trainer:test',
        role: 'player',
        path: 'walk.png',
        frameWidth: 16,
        frameHeight: 24,
        columns: 4,
        rows: 4,
        directionRows: { down: 0, left: 1, right: 2, up: 3 },
        idleFrame: 0,
        walkFrames: [0, 1, 2, 3],
        frameDurationMs: 140,
        appearanceId: 'appearance:trainer:test',
        locomotionMode: 'walk',
        source: 'test',
      }],
      appearances: [{
        schemaVersion: 1,
        appearanceId: 'appearance:trainer:test',
        label: 'Test',
        modes: { walk: 'character:trainer:test' },
      }],
    }, {
      schemaVersion: 1,
      assetId: 'character:trainer:test:swim',
      role: 'player',
      path: 'swim.png',
      frameWidth: 16,
      frameHeight: 24,
      columns: 4,
      rows: 4,
      directionRows: { down: 0, left: 1, right: 2, up: 3 },
      idleFrame: 0,
      walkFrames: [0, 1, 2, 3],
      frameDurationMs: 140,
      appearanceId: 'appearance:trainer:test',
      locomotionMode: 'swim',
      source: 'test',
    }, {
      schemaVersion: 1,
      appearanceId: 'appearance:trainer:test',
      label: 'Test',
      modes: { walk: 'character:trainer:test', swim: 'character:trainer:test:swim' },
    });
    expect(manifest.appearances?.[0].modes.swim).toBe('character:trainer:test:swim');
  });
});

describe('regla acuática del acompañante', () => {
  it('usa recall para entradas antiguas y permite override de apariencia', () => {
    expect(resolveCompanionWaterTraversal({})).toEqual({ kind: 'recall' });
    expect(resolveCompanionWaterTraversal(
      { waterTraversal: { kind: 'swim' } },
      { waterTraversal: { kind: 'alternateAsset', alternateAssetId: 'pmd:test:surf' } },
    )).toEqual({ kind: 'alternateAsset', alternateAssetId: 'pmd:test:surf' });
    expect(resolveCompanionWaterTraversal({
      waterTraversal: {
        kind: 'swim',
        mountAssetId: 'character:mount:lapras-surf',
      },
    })).toEqual({
      kind: 'swim',
      mountAssetId: 'character:mount:lapras-surf',
    });
    expect(resolveCompanionWaterMount({
      assets: [{
        schemaVersion: 1,
        assetId: 'character:mount:lapras-surf',
        role: 'mount',
        path: 'lapras.png',
        frameWidth: 32,
        frameHeight: 32,
        columns: 2,
        rows: 4,
        directionRows: { down: 0, left: 1, right: 2, up: 3 },
        idleFrame: 0,
        walkFrames: [0, 1],
        frameDurationMs: 220,
        source: 'test',
      }],
    }, {
      kind: 'swim',
      mountAssetId: 'character:mount:lapras-surf',
    })?.role).toBe('mount');
  });
});
