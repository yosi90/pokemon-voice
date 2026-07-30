import { describe, expect, it } from 'vitest';
import type { CharacterSpriteManifestV1 } from '../../packages/contracts/src/index.js';
import { resolvePlayerAppearance } from '../../src/domain/expeditions/playerAppearance.js';

const manifest: CharacterSpriteManifestV1 = {
  schemaVersion: 1,
  appearances: [{
    schemaVersion: 1,
    appearanceId: 'appearance:achaman:default',
    avatarId: 'achaman',
    label: 'Achamán',
    modes: {
      walk: 'character:achaman:walk',
      swim: 'character:achaman:swim',
    },
  }],
  assets: [
    {
      schemaVersion: 1,
      assetId: 'character:achaman:walk',
      role: 'player',
      path: 'walk.png',
      frameWidth: 16,
      frameHeight: 24,
      columns: 4,
      rows: 4,
      directionRows: { down: 0, left: 1, right: 2, up: 3 },
      idleFrame: 0,
      walkFrames: [0, 1],
      frameDurationMs: 140,
      source: 'test',
    },
    {
      schemaVersion: 1,
      assetId: 'character:achaman:swim',
      role: 'player',
      path: 'swim.png',
      frameWidth: 16,
      frameHeight: 24,
      columns: 4,
      rows: 4,
      directionRows: { down: 0, left: 1, right: 2, up: 3 },
      idleFrame: 0,
      walkFrames: [0, 1],
      frameDurationMs: 140,
      source: 'test',
    },
  ],
};

describe('player appearance', () => {
  it('resuelve walk y swim desde el perfil, no desde el sector', () => {
    const result = resolvePlayerAppearance(manifest, { avatarId: 'achaman' });
    expect(result?.walk.assetId).toBe('character:achaman:walk');
    expect(result?.swim?.assetId).toBe('character:achaman:swim');
  });

  it('permite seleccionar un disfraz explícito y falla de forma editorial si falta', () => {
    expect(resolvePlayerAppearance(manifest, {
      avatarId: 'achaman',
      appearanceId: 'appearance:missing',
    })).toBeUndefined();
  });
});
