import type {
  AdventureMapV3,
  RequirementAtomV1,
  RequirementExpressionV1,
} from '../../../packages/contracts/src/index.js';

export type AdventureRequirementTarget =
  | { source: 'variant'; definitionId: string; label: string; expression: RequirementExpressionV1 }
  | { source: 'rareEncounter'; definitionId: string; label: string; expression: RequirementExpressionV1 }
  | { source: 'behaviorTrigger'; definitionId: string; label: string; expression: RequirementExpressionV1 }
  | { source: 'expressionTrigger'; definitionId: string; label: string; expression: RequirementExpressionV1 }
  | { source: 'mapEventTrigger'; definitionId: string; label: string; expression: RequirementExpressionV1 }
  | { source: 'worldEvent'; definitionId: string; label: string; expression: RequirementExpressionV1 }
  | { source: 'transition'; definitionId: string; label: string; expression: RequirementExpressionV1 };

export function requirementTargetKey(target: Pick<AdventureRequirementTarget, 'source' | 'definitionId'>) {
  return `${target.source}:${target.definitionId}`;
}

export function listAdventureRequirementTargets(adventure: AdventureMapV3): AdventureRequirementTarget[] {
  return [
    ...adventure.variants.map(definition => ({ source: 'variant' as const, definitionId: definition.variantId, label: `Variante · ${definition.variantId}`, expression: definition.requirement })),
    ...adventure.rareEncounters.map(definition => ({ source: 'rareEncounter' as const, definitionId: definition.encounterId, label: `Encuentro raro · ${definition.encounterId}`, expression: definition.requirement })),
    ...adventure.behaviorTriggers.map(definition => ({ source: 'behaviorTrigger' as const, definitionId: definition.triggerId, label: `Comportamiento · ${definition.triggerId}`, expression: definition.requirement })),
    ...adventure.expressionTriggers.map(definition => ({ source: 'expressionTrigger' as const, definitionId: definition.triggerId, label: `Trigger expresivo · ${definition.triggerId}`, expression: definition.activationRequirement })),
    ...(adventure.mapEventTriggers ?? []).map(definition => ({ source: 'mapEventTrigger' as const, definitionId: definition.triggerId, label: `Evento de mapa · ${definition.triggerId}`, expression: definition.requirement })),
    ...(adventure.worldEvents ?? []).map(definition => ({ source: 'worldEvent' as const, definitionId: definition.eventId, label: `Evento global · ${definition.eventId}`, expression: definition.activation })),
    ...adventure.transitions.flatMap(definition => definition.requirement ? [{ source: 'transition' as const, definitionId: definition.transitionId, label: `Transición · ${definition.transitionId}`, expression: definition.requirement }] : []),
  ];
}

export function updateAdventureRequirement(
  adventure: AdventureMapV3,
  target: Pick<AdventureRequirementTarget, 'source' | 'definitionId'>,
  expression: RequirementExpressionV1,
): AdventureMapV3 {
  if (target.source === 'variant') return { ...adventure, variants: adventure.variants.map(item => item.variantId === target.definitionId ? { ...item, requirement: expression } : item) };
  if (target.source === 'rareEncounter') return { ...adventure, rareEncounters: adventure.rareEncounters.map(item => item.encounterId === target.definitionId ? { ...item, requirement: expression } : item) };
  if (target.source === 'behaviorTrigger') return { ...adventure, behaviorTriggers: adventure.behaviorTriggers.map(item => item.triggerId === target.definitionId ? { ...item, requirement: expression } : item) };
  if (target.source === 'expressionTrigger') return { ...adventure, expressionTriggers: adventure.expressionTriggers.map(item => item.triggerId === target.definitionId ? { ...item, activationRequirement: expression } : item) };
  if (target.source === 'mapEventTrigger') return { ...adventure, mapEventTriggers: (adventure.mapEventTriggers ?? []).map(item => item.triggerId === target.definitionId ? { ...item, requirement: expression } : item) };
  if (target.source === 'worldEvent') return { ...adventure, worldEvents: (adventure.worldEvents ?? []).map(item => item.eventId === target.definitionId ? { ...item, activation: expression } : item) };
  return { ...adventure, transitions: adventure.transitions.map(item => item.transitionId === target.definitionId ? { ...item, requirement: expression } : item) };
}

export function replaceRequirementNode(
  expression: RequirementExpressionV1,
  path: readonly number[],
  replacement: RequirementExpressionV1,
): RequirementExpressionV1 {
  if (!path.length) return replacement;
  const [index, ...rest] = path;
  if ('all' in expression) return { all: expression.all.map((child, childIndex) => childIndex === index ? replaceRequirementNode(child, rest, replacement) : child) };
  if ('any' in expression) return { any: expression.any.map((child, childIndex) => childIndex === index ? replaceRequirementNode(child, rest, replacement) : child) };
  return expression;
}

export function removeRequirementNode(
  expression: RequirementExpressionV1,
  path: readonly number[],
): RequirementExpressionV1 {
  if (!path.length) return expression;
  const [index, ...rest] = path;
  if ('all' in expression) return { all: rest.length
    ? expression.all.map((child, childIndex) => childIndex === index ? removeRequirementNode(child, rest) : child)
    : expression.all.filter((_, childIndex) => childIndex !== index) };
  if ('any' in expression) return { any: rest.length
    ? expression.any.map((child, childIndex) => childIndex === index ? removeRequirementNode(child, rest) : child)
    : expression.any.filter((_, childIndex) => childIndex !== index) };
  return expression;
}

export function createRequirementAtom(kind: RequirementAtomV1['kind']): RequirementAtomV1 {
  switch (kind) {
    case 'trainerLevel': case 'completedMaps': case 'unlockedSecrets': case 'completedResearchEntries': return { kind, minimum: 1 };
    case 'registeredSpecies': case 'sightedSpecies': case 'companionSpecies': return { kind, speciesId: 1 };
    case 'registeredSpeciesByTag': return { kind, tag: 'tag', minimum: 1 };
    case 'researchStatus': return { kind, speciesId: 1, status: 'sighted' };
    case 'researchField': return { kind, speciesId: 1, field: 'behavior' };
    case 'achievement': return { kind, achievementId: 'achievement:id' };
    case 'modeCompleted': return { kind, modeId: 'mode:id' };
    case 'worldFlag': return { kind, flagId: 'flag:id', expected: true };
    case 'fieldCapability': return { kind, capabilityId: 'cut', minimumStrength: 1 };
    case 'companionForm': return { kind, formId: 'pokemon-form:1:default' };
    case 'companionType': return { kind, typeId: 'normal' };
    case 'companionSize': return { kind, minimumClass: 'medium' };
    case 'companionEvolutionStage': return { kind, minimum: 1 };
    case 'companionTag': return { kind, tag: 'tag' };
    case 'knownNpc': return { kind, npcId: 'npc:id' };
    case 'conversation': return { kind, conversationId: 'conversation:id' };
    case 'counter': case 'missionCounter': return { kind, counterId: 'counter:id', comparison: 'gte', value: 1 };
    case 'missionFlag': return { kind, flagId: 'flag:id', expected: true };
    case 'inventoryItem': return { kind, itemId: 'item:id' };
    case 'unlockedSecret': return { kind, secretId: 'secret:id' };
    case 'storyEvent': return { kind, eventId: 'event:id' };
  }
}
