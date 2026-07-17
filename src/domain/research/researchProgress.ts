import type {
  PokeDiscoverStateV1,
  ResearchFactV1,
  ResearchFieldKey,
  SpeciesResearchProgressV1,
} from '../../../packages/contracts/src/index.js';
import { claimPokeDiscoverRewards } from '../progress/rewardLedger.js';
import { getBalancedPokeDiscoverRewards } from '../../data/adventure/rewardBalance.js';
import { RESEARCH_FIELD_KEYS } from './pokemonEntryState.js';

export interface DiscoverResearchFactContext {
  discoveredAt: string;
  runId?: string;
  missionId?: string;
}

export type DiscoverResearchFactResult =
  | {
    status: 'discovered';
    state: PokeDiscoverStateV1;
    progress: SpeciesResearchProgressV1;
  }
  | {
    status: 'alreadyDiscovered';
    state: PokeDiscoverStateV1;
    progress: SpeciesResearchProgressV1;
  };

function requireStableId(value: string, field: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} debe ser un identificador estable no vacío.`);
  }
}

function createEmptyProgress(speciesId: number): SpeciesResearchProgressV1 {
  const emptyField = (field: ResearchFieldKey) => ({
    field,
    discoveredFactIds: [],
    completed: false,
  });
  return {
    schemaVersion: 1,
    speciesId,
    status: 'notSeen',
    fields: {
      biometrics: emptyField('biometrics'),
      behavior: emptyField('behavior'),
      habitat: emptyField('habitat'),
      exceptional: emptyField('exceptional'),
    },
    additionalNoteIds: [],
  };
}

function locateFact(state: PokeDiscoverStateV1, factId: string) {
  for (const progress of Object.values(state.researchBySpecies)) {
    if (progress.additionalNoteIds.includes(factId)) {
      return { speciesId: progress.speciesId, contribution: 'additionalNote' as const };
    }
    for (const field of RESEARCH_FIELD_KEYS) {
      if (progress.fields[field].discoveredFactIds.includes(factId)) {
        return { speciesId: progress.speciesId, contribution: 'field' as const, field };
      }
    }
  }
  return undefined;
}

function calculateStatus(progress: SpeciesResearchProgressV1) {
  if (RESEARCH_FIELD_KEYS.every(field => progress.fields[field].completed)) return 'complete' as const;
  const hasResearch = progress.additionalNoteIds.length > 0
    || RESEARCH_FIELD_KEYS.some(field => progress.fields[field].discoveredFactIds.length > 0);
  return hasResearch ? 'partial' as const : 'sighted' as const;
}

export function discoverResearchFact(
  current: PokeDiscoverStateV1,
  fact: ResearchFactV1,
  context: DiscoverResearchFactContext,
): DiscoverResearchFactResult {
  requireStableId(fact.factId, 'factId');
  requireStableId(fact.mapId, 'mapId');
  requireStableId(fact.interactionId, 'interactionId');
  if (!Number.isInteger(fact.speciesId) || fact.speciesId <= 0) {
    throw new Error('speciesId debe ser un entero positivo.');
  }
  if (!RESEARCH_FIELD_KEYS.includes(fact.field)) {
    throw new Error(`Campo de investigación desconocido: ${fact.field}.`);
  }

  const existingProgress = current.researchBySpecies[fact.speciesId] ?? createEmptyProgress(fact.speciesId);
  const existingFact = locateFact(current, fact.factId);
  if (existingFact) {
    const expectedContribution = fact.contribution === 'additionalNote' ? 'additionalNote' : 'field';
    if (
      existingFact.speciesId !== fact.speciesId
      || existingFact.contribution !== expectedContribution
      || (existingFact.contribution === 'field' && existingFact.field !== fact.field)
    ) {
      throw new Error(`El factId ${fact.factId} ya está relacionado con otra especie, campo o contribución.`);
    }
    return { status: 'alreadyDiscovered', state: current, progress: existingProgress };
  }

  let rewardedState = current;
  if (fact.rewards.length > 0) {
    rewardedState = claimPokeDiscoverRewards(current, {
      originId: fact.factId,
      rewards: fact.rewards,
      claimedAt: context.discoveredAt,
      mapId: fact.mapId,
      ...(context.runId ? { runId: context.runId } : {}),
      ...(context.missionId ? { missionId: context.missionId } : {}),
    }).state;
  } else if (Number.isNaN(Date.parse(context.discoveredAt))) {
    throw new Error('discoveredAt debe ser una fecha ISO válida.');
  }

  const progress: SpeciesResearchProgressV1 = {
    ...existingProgress,
    fields: Object.fromEntries(RESEARCH_FIELD_KEYS.map(field => [field, {
      ...existingProgress.fields[field],
      discoveredFactIds: [...existingProgress.fields[field].discoveredFactIds],
    }])) as SpeciesResearchProgressV1['fields'],
    additionalNoteIds: [...existingProgress.additionalNoteIds],
  };

  if (fact.contribution === 'additionalNote') {
    progress.additionalNoteIds.push(fact.factId);
  } else {
    progress.fields[fact.field].discoveredFactIds.push(fact.factId);
    if (fact.contribution === 'fieldCompletion') progress.fields[fact.field].completed = true;
  }
  progress.status = calculateStatus(progress);

  if (existingProgress.status !== 'complete' && progress.status === 'complete') {
    rewardedState = claimPokeDiscoverRewards(rewardedState, {
      originId: `reward:research-entry-complete:${fact.speciesId}`,
      rewards: getBalancedPokeDiscoverRewards('completedResearchEntry'),
      claimedAt: context.discoveredAt,
      ...(context.runId ? { runId: context.runId } : {}),
      ...(context.missionId ? { missionId: context.missionId } : {}),
    }).state;
  }

  return {
    status: 'discovered',
    progress,
    state: {
      ...rewardedState,
      sightings: rewardedState.sightings.includes(fact.speciesId)
        ? [...rewardedState.sightings]
        : [...rewardedState.sightings, fact.speciesId],
      researchBySpecies: {
        ...rewardedState.researchBySpecies,
        [fact.speciesId]: progress,
      },
    },
  };
}
