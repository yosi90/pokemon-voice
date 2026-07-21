import type { RewardDefinitionV1 } from '../../../packages/contracts/src/index.js';

export const POKE_DISCOVER_REWARD_AMOUNTS = Object.freeze({
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

export type BalancedPokeDiscoverReward =
  | 'uniqueObservation'
  | 'completedResearchEntry'
  | 'completedMission'
  | 'mapSecret'
  | 'specialDiscovery'
  | 'companionSecret';

export function getBalancedPokeDiscoverRewards(
  kind: BalancedPokeDiscoverReward,
): RewardDefinitionV1[] {
  if (kind === 'uniqueObservation') {
    return [
      { kind: 'trainerExperience', amount: POKE_DISCOVER_REWARD_AMOUNTS.uniqueObservationTrainerExperience },
      { kind: 'discoveryPoints', amount: POKE_DISCOVER_REWARD_AMOUNTS.uniqueObservationDiscoveryPoints },
    ];
  }
  if (kind === 'completedResearchEntry') {
    return [
      { kind: 'trainerExperience', amount: POKE_DISCOVER_REWARD_AMOUNTS.completedResearchEntryTrainerExperience },
      { kind: 'discoveryPoints', amount: POKE_DISCOVER_REWARD_AMOUNTS.completedResearchEntryDiscoveryPoints },
    ];
  }
  if (kind === 'completedMission') {
    return [
      { kind: 'trainerExperience', amount: POKE_DISCOVER_REWARD_AMOUNTS.completedMissionTrainerExperience },
      { kind: 'discoveryPoints', amount: POKE_DISCOVER_REWARD_AMOUNTS.completedMissionDiscoveryPoints },
    ];
  }
  if (kind === 'companionSecret') {
    return [
      { kind: 'trainerExperience', amount: POKE_DISCOVER_REWARD_AMOUNTS.companionSecretTrainerExperience },
      { kind: 'discoveryPoints', amount: POKE_DISCOVER_REWARD_AMOUNTS.companionSecretDiscoveryPoints },
    ];
  }
  if (kind === 'mapSecret') {
    return [
      { kind: 'trainerExperience', amount: POKE_DISCOVER_REWARD_AMOUNTS.mapSecretTrainerExperience },
      { kind: 'discoveryPoints', amount: POKE_DISCOVER_REWARD_AMOUNTS.mapSecretDiscoveryPoints },
    ];
  }
  return [
    { kind: 'trainerExperience', amount: POKE_DISCOVER_REWARD_AMOUNTS.specialDiscoveryTrainerExperience },
    { kind: 'discoveryPoints', amount: POKE_DISCOVER_REWARD_AMOUNTS.specialDiscoveryDiscoveryPoints },
  ];
}

export const POKE_DISCOVER_REWARD_PACKAGES = Object.freeze({
  'reward-package:companion-secret': getBalancedPokeDiscoverRewards('companionSecret'),
});

export function getPokeDiscoverRewardPackage(packageId: string | undefined) {
  if (!packageId) return undefined;
  return POKE_DISCOVER_REWARD_PACKAGES[packageId as keyof typeof POKE_DISCOVER_REWARD_PACKAGES];
}
