import type {
  AdventureMapV2,
  CompanionBehaviorTriggerV1,
  ExpeditionExpressionTriggerV1,
  ResearchFactV1,
} from '../../../packages/contracts/src/index.js';

export function upsertEditorResearchFact(adventure: AdventureMapV2, fact: ResearchFactV1): AdventureMapV2 {
  const exists = (adventure.researchFacts ?? []).some(candidate => candidate.factId === fact.factId);
  return {
    ...adventure,
    researchFacts: exists
      ? (adventure.researchFacts ?? []).map(candidate => candidate.factId === fact.factId ? fact : candidate)
      : [...(adventure.researchFacts ?? []), fact],
  };
}

export function updateEditorBehaviorTrigger(
  adventure: AdventureMapV2,
  trigger: CompanionBehaviorTriggerV1,
): AdventureMapV2 {
  return {
    ...adventure,
    behaviorTriggers: adventure.behaviorTriggers.map(candidate => candidate.triggerId === trigger.triggerId ? trigger : candidate),
  };
}

export function updateEditorExpressionTrigger(
  adventure: AdventureMapV2,
  trigger: ExpeditionExpressionTriggerV1,
): AdventureMapV2 {
  return {
    ...adventure,
    expressionTriggers: adventure.expressionTriggers.map(candidate => candidate.triggerId === trigger.triggerId ? trigger : candidate),
  };
}

