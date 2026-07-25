import type {
  AdventureMapV2,
  MissionDefinitionV1,
  PokeDiscoverShopContentV1,
  RequirementAtomV1,
  RequirementExpressionV1,
  RewardDefinitionV1,
  ShopOfferV1,
} from '../../../packages/contracts/src/index.js';
import { POKEDISCOVER_MISSION_CATALOG } from '../../data/adventure/missionCatalog.js';
import {
  POKE_DISCOVER_SHOP_CONTENT,
  POKE_DISCOVER_SHOP_OFFERS,
} from '../../data/adventure/pokeDiscoverShop.js';
import { getPokeDiscoverRewardPackage } from '../../data/adventure/rewardBalance.js';
import { COMPANION_GAMEPLAY_SPECIES } from '../companions/companionGameplayCatalog.js';
import { DEFAULT_TRAINER_LEVEL_THRESHOLDS, getTrainerLevelForExperience } from '../trainer/trainerLevel.js';
import { listAdventureRequirementTargets } from './pokeDiscoverEditorRequirements.js';

export interface PokeDiscoverEditorEconomyWarning {
  kind: 'insufficientExperience' | 'mandatoryPurchase';
  sourceId: string;
  message: string;
}

export interface PokeDiscoverEditorEconomyAnalysis {
  trainerExperience: number;
  discoveryPoints: number;
  reachableTrainerLevel: number;
  mandatoryPurchaseCost: number;
  warnings: PokeDiscoverEditorEconomyWarning[];
}

export interface PokeDiscoverEditorEconomyOptions {
  missions?: readonly MissionDefinitionV1[];
  offers?: readonly ShopOfferV1[];
  shopContent?: readonly PokeDiscoverShopContentV1[];
  trainerLevelThresholds?: readonly number[];
}

interface RewardSource {
  sourceId: string;
  requirement?: RequirementExpressionV1;
  rewards: readonly RewardDefinitionV1[];
}

function rewardAmount(rewards: readonly RewardDefinitionV1[], kind: 'trainerExperience' | 'discoveryPoints') {
  return rewards.reduce((total, reward) => total + (reward.kind === kind ? reward.amount : 0), 0);
}

function minimumTrainerLevel(expression?: RequirementExpressionV1): number {
  if (!expression) return 1;
  if ('all' in expression) return Math.max(1, ...expression.all.map(minimumTrainerLevel));
  if ('any' in expression) return expression.any.length ? Math.min(...expression.any.map(minimumTrainerLevel)) : Number.POSITIVE_INFINITY;
  return expression.kind === 'trainerLevel' ? expression.minimum : 1;
}

function purchaseToken(atom: RequirementAtomV1) {
  if (atom.kind === 'inventoryItem') return `item:${atom.itemId}`;
  if (atom.kind === 'fieldCapability') return `capability:${atom.capabilityId}:${atom.minimumStrength ?? 1}`;
  return undefined;
}

function mandatoryPurchaseTokens(expression?: RequirementExpressionV1): Set<string> {
  if (!expression) return new Set();
  if ('all' in expression) return new Set(expression.all.flatMap(child => [...mandatoryPurchaseTokens(child)]));
  if ('any' in expression) {
    if (!expression.any.length) return new Set();
    const branches = expression.any.map(mandatoryPurchaseTokens);
    return new Set([...branches[0]].filter(token => branches.every(branch => branch.has(token))));
  }
  const token = purchaseToken(expression);
  return new Set(token ? [token] : []);
}

function companionCapabilityStrength(capabilityId: string) {
  return Math.max(0, ...COMPANION_GAMEPLAY_SPECIES.flatMap(species => species.forms.flatMap(form => [
    ...form.fieldCapabilities,
    ...form.appearances.flatMap(appearance => appearance.additionalFieldCapabilities),
  ])).filter(capability => capability.id === capabilityId).map(capability => capability.strength ?? 1));
}

export function analyzePokeDiscoverEditorEconomy(
  adventure: AdventureMapV2,
  options: PokeDiscoverEditorEconomyOptions = {},
): PokeDiscoverEditorEconomyAnalysis {
  const missions = options.missions ?? POKEDISCOVER_MISSION_CATALOG;
  const offers = options.offers ?? POKE_DISCOVER_SHOP_OFFERS;
  const shopContent = options.shopContent ?? POKE_DISCOVER_SHOP_CONTENT;
  const thresholds = options.trainerLevelThresholds ?? DEFAULT_TRAINER_LEVEL_THRESHOLDS;
  const mapMissions = missions.filter(mission => adventure.missionIds.includes(mission.missionId) && mission.mapId === adventure.mapId);
  const rewardSources: RewardSource[] = [
    ...mapMissions.map(mission => ({ sourceId: mission.missionId, requirement: { all: [
      ...(mission.availability ? [mission.availability] : []),
      ...mission.objectives.filter(objective => !objective.optional).map(objective => objective.requirement),
    ] } as RequirementExpressionV1, rewards: mission.rewards })),
    ...(adventure.researchFacts ?? []).map(fact => ({ sourceId: fact.factId, requirement: fact.requirement, rewards: fact.rewards })),
    ...adventure.behaviorTriggers.map(trigger => ({ sourceId: trigger.triggerId, requirement: trigger.requirement, rewards: trigger.rewards ?? getPokeDiscoverRewardPackage(trigger.rewardPackageId) ?? [] })),
    ...adventure.expressionTriggers.map(trigger => ({ sourceId: trigger.triggerId, requirement: trigger.activationRequirement, rewards: getPokeDiscoverRewardPackage(trigger.rewardPackageId) ?? [] })),
  ];
  const trainerExperience = rewardSources.reduce((total, source) => total + rewardAmount(source.rewards, 'trainerExperience'), 0);
  const discoveryPoints = rewardSources.reduce((total, source) => total + rewardAmount(source.rewards, 'discoveryPoints'), 0);
  const warnings: PokeDiscoverEditorEconomyWarning[] = [];

  const levelRequirements = [
    ...listAdventureRequirementTargets(adventure).map(target => ({ sourceId: target.definitionId, level: minimumTrainerLevel(target.expression) })),
    ...mapMissions.flatMap(mission => [
      { sourceId: mission.missionId, level: minimumTrainerLevel(mission.availability) },
      ...mission.objectives.filter(objective => !objective.optional).map(objective => ({ sourceId: objective.objectiveId, level: minimumTrainerLevel(objective.requirement) })),
    ]),
  ].filter(requirement => Number.isFinite(requirement.level) && requirement.level > 1);
  for (const requirement of levelRequirements) {
    const requiredExperience = thresholds[requirement.level - 1];
    if (requiredExperience === undefined) {
      warnings.push({ kind: 'insufficientExperience', sourceId: requirement.sourceId, message: `Exige nivel ${requirement.level}, fuera de la curva configurada.` });
      continue;
    }
    const availableBefore = rewardSources
      .filter(source => minimumTrainerLevel(source.requirement) < requirement.level)
      .reduce((total, source) => total + rewardAmount(source.rewards, 'trainerExperience'), 0);
    if (availableBefore < requiredExperience) warnings.push({ kind: 'insufficientExperience', sourceId: requirement.sourceId, message: `Exige nivel ${requirement.level} (${requiredExperience} EXP), pero el contenido previo analizado solo aporta ${availableBefore} EXP.` });
  }

  const requiredPurchases = new Map<string, { offer: ShopOfferV1; sourceIds: string[] }>();
  for (const mission of mapMissions.filter(candidate => candidate.unlocksFreeExpedition)) {
    const requirements = [mission.availability, ...mission.objectives.filter(objective => !objective.optional).map(objective => objective.requirement)].filter(Boolean) as RequirementExpressionV1[];
    for (const token of new Set(requirements.flatMap(requirement => [...mandatoryPurchaseTokens(requirement)]))) {
      let contentId: string | undefined;
      if (token.startsWith('item:')) contentId = token.slice('item:'.length);
      else {
        const [, capabilityId, strengthText] = token.split(':');
        const strength = Number(strengthText);
        if (companionCapabilityStrength(capabilityId) >= strength) continue;
        const tool = shopContent.filter(content => content.category === 'tool')
          .find(content => content.capabilities.some(capability => capability.id === capabilityId && (capability.strength ?? 1) >= strength));
        contentId = tool?.contentId;
      }
      if (!contentId) continue;
      const grantedWithoutPurchase = rewardSources.some(source =>
        source.rewards.some(reward => 'contentId' in reward && reward.contentId === contentId)
        && !mandatoryPurchaseTokens(source.requirement).has(token));
      if (grantedWithoutPurchase) continue;
      const offer = offers.filter(candidate => candidate.contentId === contentId).sort((a, b) => a.discoveryPointCost - b.discoveryPointCost)[0];
      if (!offer) continue;
      const current = requiredPurchases.get(contentId);
      requiredPurchases.set(contentId, { offer, sourceIds: [...new Set([...(current?.sourceIds ?? []), mission.missionId])] });
    }
  }
  const mandatoryPurchaseCost = [...requiredPurchases.values()].reduce((total, item) => total + item.offer.discoveryPointCost, 0);
  for (const [contentId, item] of requiredPurchases) warnings.push({
    kind: 'mandatoryPurchase',
    sourceId: item.sourceIds.join(', '),
    message: `${contentId} cuesta ${item.offer.discoveryPointCost} PD y está marcado como compra opcional, pero bloquea progreso obligatorio.${discoveryPoints < item.offer.discoveryPointCost ? ` El contenido analizado solo aporta ${discoveryPoints} PD.` : ''}`,
  });
  if (requiredPurchases.size > 1 && mandatoryPurchaseCost > discoveryPoints) warnings.push({ kind: 'mandatoryPurchase', sourceId: adventure.mapId, message: `Las compras obligatorias suman ${mandatoryPurchaseCost} PD y el contenido analizado solo aporta ${discoveryPoints} PD.` });

  return {
    trainerExperience,
    discoveryPoints,
    reachableTrainerLevel: getTrainerLevelForExperience(trainerExperience, thresholds),
    mandatoryPurchaseCost,
    warnings,
  };
}
