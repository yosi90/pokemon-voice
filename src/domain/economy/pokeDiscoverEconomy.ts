import type {
  InventoryCategory,
  PokeDiscoverStateV1,
  PurchaseRecordV1,
  ShopOfferV1,
} from '../../../packages/contracts/src/index.js';
import { POKE_DISCOVER_SHOP_CONTENT } from '../../data/adventure/pokeDiscoverShop.js';
import {
  getBalancedPokeDiscoverRewards,
  type BalancedPokeDiscoverReward,
} from '../../data/adventure/rewardBalance.js';
import { claimPokeDiscoverRewards } from '../progress/rewardLedger.js';
export { POKE_DISCOVER_REWARD_AMOUNTS } from '../../data/adventure/rewardBalance.js';
export { POKE_DISCOVER_SHOP_OFFERS } from '../../data/adventure/pokeDiscoverShop.js';

export type PurchaseShopOfferResult =
  | { status: 'purchased'; state: PokeDiscoverStateV1; record: PurchaseRecordV1 }
  | { status: 'alreadyOwned'; state: PokeDiscoverStateV1; record?: PurchaseRecordV1 }
  | { status: 'insufficientDiscoveryPoints'; state: PokeDiscoverStateV1; missing: number };

export function claimBalancedDiscoveryReward(
  state: PokeDiscoverStateV1,
  request: {
    originId: string;
    kind: Extract<BalancedPokeDiscoverReward, 'mapSecret' | 'specialDiscovery'>;
    claimedAt: string;
    mapId: string;
    runId?: string;
    missionId?: string;
  },
) {
  return claimPokeDiscoverRewards(state, {
    originId: request.originId,
    rewards: getBalancedPokeDiscoverRewards(request.kind),
    claimedAt: request.claimedAt,
    mapId: request.mapId,
    ...(request.runId ? { runId: request.runId } : {}),
    ...(request.missionId ? { missionId: request.missionId } : {}),
  });
}

function inventoryField(category: InventoryCategory) {
  switch (category) {
    case 'tool': return 'toolIds' as const;
    case 'keyItem': return 'keyItemIds' as const;
    case 'permission': return 'permissionIds' as const;
    case 'cosmetic': return 'cosmeticIds' as const;
  }
}

function validateOffer(offer: ShopOfferV1) {
  if (!offer.offerId?.trim() || !offer.contentId?.trim()) {
    throw new Error('offerId y contentId deben ser identificadores estables no vacíos.');
  }
  if (!Number.isSafeInteger(offer.discoveryPointCost) || offer.discoveryPointCost <= 0) {
    throw new Error('El coste de una oferta debe ser un entero positivo.');
  }
  if (offer.optionalContentOnly !== true) {
    throw new Error('La tienda solo puede contener contenido opcional.');
  }
  if (/^(pokemon|species|form|appearance|research)(:|-)/i.test(offer.contentId)) {
    throw new Error('La tienda no puede vender descubrimientos, especies, formas ni investigación directamente.');
  }
}

export function purchaseShopOffer(
  state: PokeDiscoverStateV1,
  offer: ShopOfferV1,
  purchasedAt: string,
): PurchaseShopOfferResult {
  validateOffer(offer);
  if (Number.isNaN(Date.parse(purchasedAt))) {
    throw new Error('purchasedAt debe ser una fecha ISO válida.');
  }
  const previous = state.purchaseLedger?.[offer.offerId];
  const field = inventoryField(offer.category);
  if (previous || state.inventory[field].includes(offer.contentId)) {
    return { status: 'alreadyOwned', state, ...(previous ? { record: previous } : {}) };
  }
  if (state.discoveryPoints < offer.discoveryPointCost) {
    return {
      status: 'insufficientDiscoveryPoints',
      state,
      missing: offer.discoveryPointCost - state.discoveryPoints,
    };
  }

  const record: PurchaseRecordV1 = {
    schemaVersion: 1,
    offerId: offer.offerId,
    contentId: offer.contentId,
    category: offer.category,
    discoveryPointCost: offer.discoveryPointCost,
    purchasedAt: new Date(purchasedAt).toISOString(),
  };
  return {
    status: 'purchased',
    record,
    state: {
      ...state,
      discoveryPoints: state.discoveryPoints - offer.discoveryPointCost,
      inventory: {
        ...state.inventory,
        [field]: [...state.inventory[field], offer.contentId],
        ...(offer.category === 'tool' && !state.inventory.selectedToolId
          ? { selectedToolId: offer.contentId }
          : {}),
      },
      purchaseLedger: { ...(state.purchaseLedger ?? {}), [offer.offerId]: record },
    },
  };
}

export function selectFieldTool(state: PokeDiscoverStateV1, toolId: string) {
  if (!state.inventory.toolIds.includes(toolId)) {
    throw new Error('No se puede preparar una herramienta que no se ha comprado.');
  }
  if (state.inventory.selectedToolId === toolId) return state;
  return {
    ...state,
    inventory: { ...state.inventory, selectedToolId: toolId },
  };
}

export function getToolUnlockedMissionIds(state: PokeDiscoverStateV1) {
  const owned = new Set(state.inventory.toolIds);
  return [...new Set(POKE_DISCOVER_SHOP_CONTENT.flatMap(content => (
    content.category === 'tool' && owned.has(content.toolId)
      ? [...('unlocksMissionIds' in content ? content.unlocksMissionIds : [])]
      : []
  )))];
}

export function equipCosmetic(state: PokeDiscoverStateV1, cosmeticId: string) {
  if (!state.inventory.cosmeticIds.includes(cosmeticId)) {
    throw new Error('No se puede equipar un cosmético que no se ha comprado.');
  }
  if (state.inventory.equippedCosmeticIds.includes(cosmeticId)) return state;
  return {
    ...state,
    inventory: {
      ...state.inventory,
      equippedCosmeticIds: [...state.inventory.equippedCosmeticIds, cosmeticId],
    },
  };
}
