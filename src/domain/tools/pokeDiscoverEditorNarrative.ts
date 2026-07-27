import type {
  AdventureMapV3,
  CompanionBehaviorTriggerV3,
  ExpeditionExpressionTriggerV3,
  ResearchFactV1,
} from '../../../packages/contracts/src/index.js';

export function upsertEditorResearchFact(adventure: AdventureMapV3, fact: ResearchFactV1): AdventureMapV3 {
  const exists = (adventure.researchFacts ?? []).some(candidate => candidate.factId === fact.factId);
  return {
    ...adventure,
    researchFacts: exists
      ? (adventure.researchFacts ?? []).map(candidate => candidate.factId === fact.factId ? fact : candidate)
      : [...(adventure.researchFacts ?? []), fact],
  };
}

export function updateEditorBehaviorTrigger(
  adventure: AdventureMapV3,
  trigger: CompanionBehaviorTriggerV3,
): AdventureMapV3 {
  return {
    ...adventure,
    behaviorTriggers: adventure.behaviorTriggers.map(candidate => candidate.triggerId === trigger.triggerId ? trigger : candidate),
  };
}

export function updateEditorExpressionTrigger(
  adventure: AdventureMapV3,
  trigger: ExpeditionExpressionTriggerV3,
): AdventureMapV3 {
  return {
    ...adventure,
    expressionTriggers: adventure.expressionTriggers.map(candidate => candidate.triggerId === trigger.triggerId ? trigger : candidate),
  };
}

