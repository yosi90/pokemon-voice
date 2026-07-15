import type { StableId, VersionedContractV1 } from './common.js';

export type InventoryCategory = 'tool' | 'keyItem' | 'permission' | 'cosmetic';
export type RewardKind = 'trainerExperience' | 'discoveryPoints' | 'item' | 'permission' | 'cosmetic';

export interface RewardDefinitionV1 {
  kind: RewardKind;
  amount?: number;
  contentId?: StableId;
}

export interface ShopOfferV1 extends VersionedContractV1 {
  offerId: StableId;
  category: InventoryCategory;
  contentId: StableId;
  discoveryPointCost: number;
  optionalContentOnly: true;
}

export interface InventoryStateV1 {
  toolIds: StableId[];
  keyItemIds: StableId[];
  permissionIds: StableId[];
  cosmeticIds: StableId[];
  equippedCosmeticIds: StableId[];
}
