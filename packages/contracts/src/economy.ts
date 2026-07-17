import type { ISODateString, StableId, VersionedContractV1 } from './common.js';
import type { FieldCapabilityId } from './catalog.js';

export type InventoryCategory = 'tool' | 'keyItem' | 'permission' | 'cosmetic';
export type RewardKind = 'trainerExperience' | 'discoveryPoints' | 'item' | 'permission' | 'cosmetic';

export type RewardDefinitionV1 =
  | { kind: 'trainerExperience' | 'discoveryPoints'; amount: number }
  | { kind: 'item'; contentId: StableId; category: 'tool' | 'keyItem' }
  | { kind: 'permission' | 'cosmetic'; contentId: StableId };

export interface ShopOfferV1 extends VersionedContractV1 {
  offerId: StableId;
  category: InventoryCategory;
  contentId: StableId;
  discoveryPointCost: number;
  optionalContentOnly: true;
}

export interface FieldToolCapabilityV1 {
  id: FieldCapabilityId;
  strength?: number;
  tags?: string[];
}

export interface FieldToolDefinitionV1 extends VersionedContractV1 {
  toolId: StableId;
  displayName: string;
  description?: string;
  unlockHint?: string;
  unlocksMissionIds?: StableId[];
  capabilities: FieldToolCapabilityV1[];
}

export interface KeyItemDefinitionV1 extends VersionedContractV1 {
  keyItemId: StableId;
  displayName: string;
  description: string;
  unlockHint: string;
}

export interface MissionPermissionDefinitionV1 extends VersionedContractV1 {
  permissionId: StableId;
  displayName: string;
  description: string;
  unlockHint: string;
  discoveryTags: StableId[];
}

export interface CosmeticDefinitionV1 extends VersionedContractV1 {
  cosmeticId: StableId;
  displayName: string;
  description: string;
  unlockHint: string;
}

export type PokeDiscoverShopContentV1 =
  | ({ category: 'tool'; contentId: StableId } & FieldToolDefinitionV1)
  | ({ category: 'keyItem'; contentId: StableId } & KeyItemDefinitionV1)
  | ({ category: 'permission'; contentId: StableId } & MissionPermissionDefinitionV1)
  | ({ category: 'cosmetic'; contentId: StableId } & CosmeticDefinitionV1);

export interface InventoryStateV1 {
  toolIds: StableId[];
  /** Última herramienta preparada; se conserva entre expediciones y puede no existir. */
  selectedToolId?: StableId;
  keyItemIds: StableId[];
  permissionIds: StableId[];
  cosmeticIds: StableId[];
  equippedCosmeticIds: StableId[];
}

export interface PurchaseRecordV1 extends VersionedContractV1 {
  offerId: StableId;
  contentId: StableId;
  category: InventoryCategory;
  discoveryPointCost: number;
  purchasedAt: ISODateString;
}
