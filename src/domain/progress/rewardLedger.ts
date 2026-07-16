import type {
  PokeDiscoverStateV1,
  RewardDefinitionV1,
  RewardLedgerEntryV1,
} from '../../../packages/contracts/src/index.js';
import { getTrainerLevelForExperience } from '../trainer/trainerLevel.js';

export interface RewardClaimRequest {
  originId: string;
  rewards: readonly RewardDefinitionV1[];
  claimedAt: string;
  runId?: string;
  missionId?: string;
  mapId?: string;
}

export type RewardClaimResult =
  | {
    status: 'claimed';
    state: PokeDiscoverStateV1;
    entry: RewardLedgerEntryV1;
  }
  | {
    status: 'alreadyClaimed';
    state: PokeDiscoverStateV1;
    entry: RewardLedgerEntryV1;
  };

function requireStableId(value: string, field: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} debe ser un identificador estable no vacío.`);
  }
}

function validateReward(reward: RewardDefinitionV1) {
  if (reward.kind === 'trainerExperience' || reward.kind === 'discoveryPoints') {
    if (!Number.isSafeInteger(reward.amount) || reward.amount <= 0) {
      throw new Error(`La recompensa ${reward.kind} debe tener una cantidad entera positiva.`);
    }
    return;
  }
  if (!('contentId' in reward)) throw new Error(`La recompensa ${reward.kind} requiere contentId.`);
  requireStableId(reward.contentId, `contentId de ${reward.kind}`);
  if (reward.kind === 'item' && reward.category !== 'tool' && reward.category !== 'keyItem') {
    throw new Error('Una recompensa item debe declarar category tool o keyItem.');
  }
}

function addUnique(items: readonly string[], contentId: string) {
  return items.includes(contentId) ? [...items] : [...items, contentId];
}

export function claimPokeDiscoverRewards(
  current: PokeDiscoverStateV1,
  request: RewardClaimRequest,
): RewardClaimResult {
  requireStableId(request.originId, 'originId');
  const previous = current.rewardLedger[request.originId];
  if (previous) return { status: 'alreadyClaimed', state: current, entry: previous };
  if (!request.rewards.length) throw new Error('Una entrada del ledger debe contener al menos una recompensa.');
  if (Number.isNaN(Date.parse(request.claimedAt))) {
    throw new Error('claimedAt debe ser una fecha ISO válida.');
  }
  request.rewards.forEach(validateReward);

  let trainerExperience = current.trainerExperience;
  let discoveryPoints = current.discoveryPoints;
  let inventory = {
    ...current.inventory,
    toolIds: [...current.inventory.toolIds],
    keyItemIds: [...current.inventory.keyItemIds],
    permissionIds: [...current.inventory.permissionIds],
    cosmeticIds: [...current.inventory.cosmeticIds],
    equippedCosmeticIds: [...current.inventory.equippedCosmeticIds],
  };

  for (const reward of request.rewards) {
    switch (reward.kind) {
      case 'trainerExperience':
        trainerExperience += reward.amount;
        break;
      case 'discoveryPoints':
        discoveryPoints += reward.amount;
        break;
      case 'item':
        if (reward.category === 'tool') {
          inventory.toolIds = addUnique(inventory.toolIds, reward.contentId);
        } else {
          inventory.keyItemIds = addUnique(inventory.keyItemIds, reward.contentId);
        }
        break;
      case 'permission':
        inventory.permissionIds = addUnique(inventory.permissionIds, reward.contentId);
        break;
      case 'cosmetic':
        inventory.cosmeticIds = addUnique(inventory.cosmeticIds, reward.contentId);
        break;
    }
  }

  const entry: RewardLedgerEntryV1 = {
    schemaVersion: 1,
    originId: request.originId,
    claimedAt: new Date(request.claimedAt).toISOString(),
    rewards: request.rewards.map(reward => ({ ...reward })),
    ...(request.runId ? { runId: request.runId } : {}),
    ...(request.missionId ? { missionId: request.missionId } : {}),
    ...(request.mapId ? { mapId: request.mapId } : {}),
  };

  return {
    status: 'claimed',
    entry,
    state: {
      ...current,
      trainerLevel: getTrainerLevelForExperience(trainerExperience),
      trainerExperience,
      discoveryPoints,
      inventory,
      rewardLedger: { ...current.rewardLedger, [request.originId]: entry },
    },
  };
}
