import { beforeEach, describe, expect, it } from 'vitest';
import type { ShopOfferV1 } from '../../packages/contracts/src/index.js';
import {
  claimBalancedDiscoveryReward,
  equipCosmetic,
  getToolUnlockedMissionIds,
  POKE_DISCOVER_REWARD_AMOUNTS,
  POKE_DISCOVER_SHOP_OFFERS,
  purchaseShopOffer,
  selectFieldTool,
} from '../../src/domain/economy/pokeDiscoverEconomy.js';
import { POKE_DISCOVER_SHOP_CONTENT } from '../../src/data/adventure/pokeDiscoverShop.js';
import { createPokeDiscoverStateV1 } from '../../src/domain/progress/pokeVoiceSave.js';
import {
  getBrowserPokeVoiceSave,
  purchaseBrowserShopOffer,
  updateBrowserPokeDiscover,
} from '../../src/store/browserPokeVoiceSaveStore.js';

const PURCHASED_AT = '2026-07-18T01:00:00.000Z';

describe('economía de PokeDiscover', () => {
  beforeEach(() => localStorage.clear());

  it('centraliza las recompensas iniciales sin esconder importes en escenas', () => {
    expect(POKE_DISCOVER_REWARD_AMOUNTS).toEqual({
      uniqueObservationTrainerExperience: 5,
      uniqueObservationDiscoveryPoints: 10,
      completedResearchEntryTrainerExperience: 25,
      completedResearchEntryDiscoveryPoints: 40,
      completedMissionTrainerExperience: 25,
      completedMissionDiscoveryPoints: 25,
      mapSecretTrainerExperience: 15,
      mapSecretDiscoveryPoints: 15,
      specialDiscoveryTrainerExperience: 25,
      specialDiscoveryDiscoveryPoints: 30,
      companionSecretTrainerExperience: 10,
      companionSecretDiscoveryPoints: 10,
    });
  });

  it('paga secretos y descubrimientos especiales una sola vez mediante el ledger', () => {
    const initial = createPokeDiscoverStateV1();
    const first = claimBalancedDiscoveryReward(initial, {
      originId: 'secret:test:burrow',
      kind: 'mapSecret',
      claimedAt: PURCHASED_AT,
      mapId: 'map:test',
    });
    const repeated = claimBalancedDiscoveryReward(first.state, {
      originId: 'secret:test:burrow',
      kind: 'mapSecret',
      claimedAt: PURCHASED_AT,
      mapId: 'map:test',
    });
    const special = claimBalancedDiscoveryReward(repeated.state, {
      originId: 'special:test:meteorite',
      kind: 'specialDiscovery',
      claimedAt: PURCHASED_AT,
      mapId: 'map:test',
    });

    expect(first).toMatchObject({ status: 'claimed', state: { trainerExperience: 15, discoveryPoints: 15 } });
    expect(repeated.status).toBe('alreadyClaimed');
    expect(repeated.state).toBe(first.state);
    expect(special).toMatchObject({ status: 'claimed', state: { trainerExperience: 40, discoveryPoints: 45 } });
  });

  it('declara herramientas, objeto, permiso y cosméticos como contenido opcional', () => {
    expect(POKE_DISCOVER_SHOP_OFFERS).toHaveLength(7);
    expect(POKE_DISCOVER_SHOP_OFFERS).toEqual(expect.arrayContaining([
      expect.objectContaining({ contentId: 'tool:shovel', category: 'tool', discoveryPointCost: 90, optionalContentOnly: true }),
      expect.objectContaining({ contentId: 'tool:archaeology-brush', category: 'tool', optionalContentOnly: true }),
      expect.objectContaining({ contentId: 'tool:boat', category: 'tool', optionalContentOnly: true }),
      expect.objectContaining({ contentId: 'key-item:dragon-scale', category: 'keyItem', optionalContentOnly: true }),
      expect.objectContaining({ contentId: 'permission:special-phenomena-fieldwork', category: 'permission', optionalContentOnly: true }),
      expect.objectContaining({ category: 'cosmetic', discoveryPointCost: 120, optionalContentOnly: true }),
      expect.objectContaining({ category: 'cosmetic', discoveryPointCost: 180, optionalContentOnly: true }),
    ]));
    expect(POKE_DISCOVER_SHOP_CONTENT.find(item => item.contentId === 'tool:boat'))
      .toMatchObject({ capabilities: [{ id: 'surf' }] });
  });

  it('selecciona automáticamente la primera herramienta y permite cambiarla', () => {
    const initial = { ...createPokeDiscoverStateV1(), discoveryPoints: 500 };
    const shovelOffer = POKE_DISCOVER_SHOP_OFFERS.find(offer => offer.contentId === 'tool:shovel')!;
    const boatOffer = POKE_DISCOVER_SHOP_OFFERS.find(offer => offer.contentId === 'tool:boat')!;
    const shovel = purchaseShopOffer(initial, shovelOffer, PURCHASED_AT);
    if (shovel.status !== 'purchased') throw new Error('La pala debía comprarse.');
    expect(shovel.state.inventory).toMatchObject({ toolIds: ['tool:shovel'], selectedToolId: 'tool:shovel' });
    const boat = purchaseShopOffer(shovel.state, boatOffer, PURCHASED_AT);
    if (boat.status !== 'purchased') throw new Error('El bote debía comprarse.');
    expect(selectFieldTool(boat.state, 'tool:boat').inventory.selectedToolId).toBe('tool:boat');
    expect(getToolUnlockedMissionIds(boat.state)).toContain('mission:kanto:fossil-tunnel');
    expect(() => selectFieldTool(boat.state, 'tool:missing')).toThrow('no se ha comprado');
  });

  it('compra y equipa un cosmético permanente descontando PD una sola vez', () => {
    const initial = { ...createPokeDiscoverStateV1(), discoveryPoints: 200 };
    const offer = POKE_DISCOVER_SHOP_OFFERS.find(candidate => candidate.contentId === 'cosmetic:field-avatar-palette')!;
    const first = purchaseShopOffer(initial, offer, PURCHASED_AT);

    expect(first).toMatchObject({
      status: 'purchased',
      state: {
        discoveryPoints: 80,
        inventory: { cosmeticIds: [offer.contentId] },
        purchaseLedger: { [offer.offerId]: { discoveryPointCost: 120 } },
      },
    });
    if (first.status !== 'purchased') throw new Error('La compra debía completarse.');
    const equipped = equipCosmetic(first.state, offer.contentId);
    const repeated = purchaseShopOffer(equipped, offer, PURCHASED_AT);

    expect(equipped.inventory.equippedCosmeticIds).toEqual([offer.contentId]);
    expect(repeated.status).toBe('alreadyOwned');
    expect(repeated.state).toBe(equipped);
    expect(repeated.state.discoveryPoints).toBe(80);
  });

  it('rechaza saldo insuficiente sin mutar el inventario', () => {
    const initial = { ...createPokeDiscoverStateV1(), discoveryPoints: 119 };
    const offer = POKE_DISCOVER_SHOP_OFFERS.find(candidate => candidate.contentId === 'cosmetic:field-avatar-palette')!;
    const result = purchaseShopOffer(initial, offer, PURCHASED_AT);

    expect(result).toMatchObject({ status: 'insufficientDiscoveryPoints', missing: 1 });
    expect(result.state).toBe(initial);
    expect(initial.inventory.cosmeticIds).toEqual([]);
  });

  it('impide introducir progreso obligatorio en la tienda', () => {
    const invalid = {
      schemaVersion: 1,
      offerId: 'offer:story:required-map',
      category: 'permission',
      contentId: 'permission:required-map',
      discoveryPointCost: 1,
      optionalContentOnly: false,
    } as unknown as ShopOfferV1;

    expect(() => purchaseShopOffer(
      { ...createPokeDiscoverStateV1(), discoveryPoints: 10 },
      invalid,
      PURCHASED_AT,
    )).toThrow('La tienda solo puede contener contenido opcional.');
  });

  it('impide vender directamente especies, formas o investigación', () => {
    const invalid = {
      schemaVersion: 1,
      offerId: 'offer:invalid:species',
      category: 'permission',
      contentId: 'species:151',
      discoveryPointCost: 1,
      optionalContentOnly: true,
    } as const satisfies ShopOfferV1;
    expect(() => purchaseShopOffer(
      { ...createPokeDiscoverStateV1(), discoveryPoints: 10 }, invalid, PURCHASED_AT,
    )).toThrow('no puede vender descubrimientos');
  });

  it('persiste una compra en el guardado del navegador', () => {
    getBrowserPokeVoiceSave();
    updateBrowserPokeDiscover(state => ({ ...state, discoveryPoints: 200 }));
    const offer = POKE_DISCOVER_SHOP_OFFERS.find(candidate => candidate.contentId === 'cosmetic:field-avatar-palette')!;
    const result = purchaseBrowserShopOffer(offer, PURCHASED_AT);

    expect(result.status).toBe('purchased');
    expect(getBrowserPokeVoiceSave().pokeDiscover).toMatchObject({
      discoveryPoints: 80,
      inventory: { cosmeticIds: [offer.contentId] },
    });
  });
});
