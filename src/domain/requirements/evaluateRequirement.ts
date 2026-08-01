import type {
  PokemonFormV1,
  PokemonSizeClass,
  PokemonSpeciesV1,
  PokeVoiceSaveV1,
  RequirementAtomV1,
  RequirementExpressionV1,
  ResearchStatus,
} from '../../../packages/contracts/src/index.js';

const RESEARCH_STATUS_RANK: Record<ResearchStatus, number> = {
  notSeen: 0,
  sighted: 1,
  partial: 2,
  complete: 3,
};

const SIZE_RANK: Record<PokemonSizeClass, number> = {
  tiny: 0,
  small: 1,
  medium: 2,
  large: 3,
  huge: 4,
};

export interface RequirementEvaluationContext {
  save: PokeVoiceSaveV1;
  species?: readonly PokemonSpeciesV1[];
  companionForm?: PokemonFormV1;
  /** Capacidades ya resueltas para el loadout completo; prevalecen sobre el fallback del compañero. */
  expeditionCapabilities?: ReadonlyArray<{ id: string; strength?: number }>;
  /** Compañeros cuya elegibilidad ya fue resuelta contra el catálogo curado. */
  unlockedCompanions?: ReadonlyArray<{
    speciesId: number;
    formId?: string;
    appearanceId?: string;
  }>;
}

export interface RequirementEvaluationResult {
  met: boolean;
  unmetAtoms: RequirementAtomV1[];
}

function compare(
  value: number,
  comparison: Extract<RequirementAtomV1, { kind: 'counter' | 'missionCounter' }>,
) {
  switch (comparison.comparison) {
    case 'eq': return value === comparison.value;
    case 'gte': return value >= comparison.value;
    case 'lte': return value <= comparison.value;
    case 'gt': return value > comparison.value;
    case 'lt': return value < comparison.value;
  }
}

function includesInMapProgress(
  context: RequirementEvaluationContext,
  key: 'knownNpcIds' | 'conversationIds' | 'unlockedSecretIds',
  id: string,
) {
  return Object.values(context.save.pokeDiscover.mapProgress)
    .some(progress => progress[key].includes(id));
}

function evaluateAtom(atom: RequirementAtomV1, context: RequirementEvaluationContext) {
  const { pokedexRun, pokeDiscover } = context.save;
  const companion = context.companionForm;
  switch (atom.kind) {
    case 'trainerLevel':
      return pokeDiscover.trainerLevel >= atom.minimum;
    case 'completedMaps':
      return Object.values(pokeDiscover.mapProgress)
        .filter(progress => progress.freeExpeditionUnlocked).length >= atom.minimum;
    case 'unlockedSecrets':
      return new Set(Object.values(pokeDiscover.mapProgress)
        .flatMap(progress => progress.unlockedSecretIds)).size >= atom.minimum;
    case 'completedResearchEntries':
      return Object.values(pokeDiscover.researchBySpecies)
        .filter(progress => progress.status === 'complete').length >= atom.minimum;
    case 'registeredSpecies':
      return pokedexRun.registeredSpeciesIds.includes(atom.speciesId);
    case 'registeredSpeciesByTag': {
      const registered = new Set(pokedexRun.registeredSpeciesIds);
      const count = (context.species ?? [])
        .filter(candidate => registered.has(candidate.speciesId) && candidate.tags.includes(atom.tag))
        .length;
      return count >= atom.minimum;
    }
    case 'sightedSpecies':
      return pokeDiscover.sightings.includes(atom.speciesId);
    case 'researchStatus': {
      const current = pokeDiscover.researchBySpecies[atom.speciesId]?.status ?? 'notSeen';
      return RESEARCH_STATUS_RANK[current] >= RESEARCH_STATUS_RANK[atom.status];
    }
    case 'researchField':
      return pokeDiscover.researchBySpecies[atom.speciesId]?.fields[atom.field].completed ?? false;
    case 'achievement':
      return Boolean(pokeDiscover.achievements[atom.achievementId]);
    case 'modeCompleted':
      return pokeDiscover.modeProgress[atom.modeId]?.completed ?? false;
    case 'worldFlag': {
      const value = pokeDiscover.worldFlags[atom.flagId];
      return atom.expected === undefined ? value === true : value === atom.expected;
    }
    case 'fieldCapability': {
      const capabilities = context.expeditionCapabilities ?? companion?.fieldCapabilities ?? [];
      const capability = capabilities.find(candidate => candidate.id === atom.capabilityId);
      return Boolean(capability && (capability.strength ?? 1) >= (atom.minimumStrength ?? 1));
    }
    case 'companionSpecies':
      return companion?.speciesId === atom.speciesId;
    case 'companionForm':
      return companion?.formId === atom.formId;
    case 'companionType':
      return companion?.types.includes(atom.typeId) ?? false;
    case 'companionSize':
      return companion?.sizeClass !== undefined
        && SIZE_RANK[companion.sizeClass] >= SIZE_RANK[atom.minimumClass];
    case 'companionEvolutionStage':
      return companion !== undefined && companion.evolutionStage >= atom.minimum;
    case 'companionTag':
      return companion?.narrativeTags.includes(atom.tag) ?? false;
    case 'knownNpc':
      return includesInMapProgress(context, 'knownNpcIds', atom.npcId);
    case 'conversation':
      return includesInMapProgress(context, 'conversationIds', atom.conversationId);
    case 'counter':
      return compare(pokeDiscover.globalCounters[atom.counterId] ?? 0, atom);
    case 'missionCounter':
      return compare(context.save.activeExpeditionSession?.missionRuntime?.counters[atom.counterId] ?? 0, atom);
    case 'missionFlag': {
      const value = context.save.activeExpeditionSession?.missionRuntime?.flags[atom.flagId];
      return atom.expected === undefined ? value === true : value === atom.expected;
    }
    case 'inventoryItem':
      return [
        ...pokeDiscover.inventory.toolIds,
        ...pokeDiscover.inventory.keyItemIds,
        ...pokeDiscover.inventory.permissionIds,
        ...pokeDiscover.inventory.cosmeticIds,
      ].includes(atom.itemId);
    case 'unlockedSecret':
      return includesInMapProgress(context, 'unlockedSecretIds', atom.secretId);
    case 'storyEvent':
      return pokeDiscover.worldFlags[atom.eventId] === true;
    case 'completedMission':
      return Object.values(pokeDiscover.mapProgress)
        .some(progress => progress.completedMissionIds.includes(atom.missionId));
    case 'companionUnlocked': {
      const resolved = context.unlockedCompanions ?? pokeDiscover.companionQualifications;
      return resolved.some(candidate => (
        candidate.speciesId === atom.speciesId
        && (!atom.formId || candidate.formId === atom.formId)
        && (!atom.appearanceId || candidate.appearanceId === atom.appearanceId)
      ));
    }
  }
}

export function evaluateRequirement(
  expression: RequirementExpressionV1,
  context: RequirementEvaluationContext,
): RequirementEvaluationResult {
  if ('all' in expression) {
    const results = expression.all.map(child => evaluateRequirement(child, context));
    return {
      met: results.every(result => result.met),
      unmetAtoms: results.flatMap(result => result.unmetAtoms),
    };
  }
  if ('any' in expression) {
    const results = expression.any.map(child => evaluateRequirement(child, context));
    if (results.some(result => result.met)) return { met: true, unmetAtoms: [] };
    const nearest = results.reduce<RequirementEvaluationResult | undefined>((best, result) => (
      best === undefined || result.unmetAtoms.length < best.unmetAtoms.length ? result : best
    ), undefined);
    return { met: false, unmetAtoms: nearest?.unmetAtoms ?? [] };
  }
  return evaluateAtom(expression, context)
    ? { met: true, unmetAtoms: [] }
    : { met: false, unmetAtoms: [expression] };
}
