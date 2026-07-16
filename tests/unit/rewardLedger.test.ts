import { beforeEach, describe, expect, it } from 'vitest';
import { createPokeDiscoverStateV1 } from '../../src/domain/progress/pokeVoiceSave.js';
import { claimPokeDiscoverRewards } from '../../src/domain/progress/rewardLedger.js';
import {
  claimBrowserPokeDiscoverRewards,
  getBrowserPokeVoiceSave,
  startNewPokedexRun,
} from '../../src/store/browserPokeVoiceSaveStore.js';

const CLAIMED_AT = '2026-07-15T20:00:00.000Z';

describe('ledger de recompensas de PokeDiscover', () => {
  beforeEach(() => localStorage.clear());

  it('aplica un lote completo de forma atómica y conserva su procedencia', () => {
    const initial = createPokeDiscoverStateV1();
    const result = claimPokeDiscoverRewards(initial, {
      originId: 'secret:zero-reserve:hidden-cave',
      claimedAt: CLAIMED_AT,
      runId: 'run:one',
      missionId: 'mission:first',
      mapId: 'map:zero-reserve',
      rewards: [
        { kind: 'trainerExperience', amount: 40 },
        { kind: 'discoveryPoints', amount: 25 },
        { kind: 'item', category: 'tool', contentId: 'tool:shovel' },
        { kind: 'item', category: 'keyItem', contentId: 'key-item:dragon-scale' },
        { kind: 'permission', contentId: 'permission:fossil-site' },
        { kind: 'cosmetic', contentId: 'cosmetic:field-coat' },
      ],
    });

    expect(result.status).toBe('claimed');
    expect(result.state).not.toBe(initial);
    expect(result.state).toMatchObject({
      trainerLevel: 2,
      trainerExperience: 40,
      discoveryPoints: 25,
      inventory: {
        toolIds: ['tool:shovel'],
        keyItemIds: ['key-item:dragon-scale'],
        permissionIds: ['permission:fossil-site'],
        cosmeticIds: ['cosmetic:field-coat'],
      },
    });
    expect(result.entry).toMatchObject({
      originId: 'secret:zero-reserve:hidden-cave',
      claimedAt: CLAIMED_AT,
      runId: 'run:one',
      missionId: 'mission:first',
      mapId: 'map:zero-reserve',
    });
  });

  it('deriva el nivel de la experiencia acumulada y no lo altera al repetir el origen', () => {
    const initial = { ...createPokeDiscoverStateV1(), trainerExperience: 20, trainerLevel: 99 };
    const first = claimPokeDiscoverRewards(initial, {
      originId: 'mission:trainer-level-boundary',
      claimedAt: CLAIMED_AT,
      rewards: [{ kind: 'trainerExperience', amount: 5 }],
    });
    const repeated = claimPokeDiscoverRewards(first.state, {
      originId: 'mission:trainer-level-boundary',
      claimedAt: CLAIMED_AT,
      rewards: [{ kind: 'trainerExperience', amount: 1000 }],
    });

    expect(first.state).toMatchObject({ trainerExperience: 25, trainerLevel: 2 });
    expect(repeated.state).toBe(first.state);
  });

  it('ignora por completo un origen ya cobrado aunque cambie su declaración', () => {
    const first = claimPokeDiscoverRewards(createPokeDiscoverStateV1(), {
      originId: 'research-fact:pikachu:conduct',
      claimedAt: CLAIMED_AT,
      rewards: [{ kind: 'discoveryPoints', amount: 10 }],
    });
    const repeated = claimPokeDiscoverRewards(first.state, {
      originId: 'research-fact:pikachu:conduct',
      claimedAt: '2026-07-16T20:00:00.000Z',
      rewards: [{ kind: 'discoveryPoints', amount: 999 }],
    });

    expect(repeated.status).toBe('alreadyClaimed');
    expect(repeated.state).toBe(first.state);
    expect(repeated.entry).toBe(first.entry);
    expect(repeated.state.discoveryPoints).toBe(10);
  });

  it('no duplica inventario aunque un lote repita contenido permanente', () => {
    const result = claimPokeDiscoverRewards(createPokeDiscoverStateV1(), {
      originId: 'mission:supplies',
      claimedAt: CLAIMED_AT,
      rewards: [
        { kind: 'item', category: 'tool', contentId: 'tool:boat' },
        { kind: 'item', category: 'tool', contentId: 'tool:boat' },
      ],
    });

    expect(result.state.inventory.toolIds).toEqual(['tool:boat']);
  });

  it.each([
    { originId: '', claimedAt: CLAIMED_AT, rewards: [{ kind: 'discoveryPoints', amount: 10 }] },
    { originId: 'bad:empty', claimedAt: CLAIMED_AT, rewards: [] },
    { originId: 'bad:date', claimedAt: 'not-a-date', rewards: [{ kind: 'discoveryPoints', amount: 10 }] },
    { originId: 'bad:amount', claimedAt: CLAIMED_AT, rewards: [{ kind: 'trainerExperience', amount: -1 }] },
  ])('rechaza declaraciones inválidas sin mutar el estado: $originId', request => {
    const initial = createPokeDiscoverStateV1();
    expect(() => claimPokeDiscoverRewards(initial, request as never)).toThrow();
    expect(initial.rewardLedger).toEqual({});
    expect(initial.discoveryPoints).toBe(0);
  });

  it('persiste el cobro en el guardado raíz y sobrevive a una recarga', () => {
    const request = {
      originId: 'achievement:first-mission',
      claimedAt: CLAIMED_AT,
      rewards: [{ kind: 'discoveryPoints' as const, amount: 25 }],
    };

    expect(claimBrowserPokeDiscoverRewards(request).status).toBe('claimed');
    expect(claimBrowserPokeDiscoverRewards(request).status).toBe('alreadyClaimed');
    const persisted = JSON.parse(localStorage.getItem('pokevoice-save-v1') || '{}');

    expect(getBrowserPokeVoiceSave().pokeDiscover.discoveryPoints).toBe(25);
    expect(persisted.pokeDiscover.discoveryPoints).toBe(25);
    expect(persisted.pokeDiscover.rewardLedger[request.originId].originId).toBe(request.originId);
  });

  it('sobrevive a una nueva run y no permite farmear mediante resets', () => {
    const request = {
      originId: 'collectible:gimmighoul:coin:001',
      claimedAt: CLAIMED_AT,
      rewards: [{ kind: 'discoveryPoints' as const, amount: 10 }],
    };
    claimBrowserPokeDiscoverRewards(request);

    startNewPokedexRun({ runId: 'run:after-reset' });
    const repeated = claimBrowserPokeDiscoverRewards({
      ...request,
      claimedAt: '2026-07-16T20:00:00.000Z',
    });

    expect(repeated.status).toBe('alreadyClaimed');
    expect(getBrowserPokeVoiceSave().pokeDiscover.discoveryPoints).toBe(10);
    expect(Object.keys(getBrowserPokeVoiceSave().pokeDiscover.rewardLedger)).toEqual([
      'collectible:gimmighoul:coin:001',
    ]);
  });
});
