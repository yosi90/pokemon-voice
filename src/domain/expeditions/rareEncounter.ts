import type {
  PokemonFormV1,
  PokemonSpeciesV1,
  PokeVoiceSaveV1,
  RareEncounterDefinitionV1,
} from '../../../packages/contracts/src/index.js';
import { createAdventureMapProgressV1 } from './adventureMapProgress.js';
import { evaluateRequirement } from '../requirements/evaluateRequirement.js';

export const DEFAULT_GUARANTEED_ELIGIBLE_VISIT = 3;

export interface EvaluateRareEncounterRequest {
  mapId: string;
  definition: RareEncounterDefinitionV1;
  /** Valor inyectado y estable entre 0 inclusive y 1 exclusive. */
  randomRoll: number;
  species?: readonly PokemonSpeciesV1[];
  companionForm?: PokemonFormV1;
}

export interface RareEncounterVisitResult {
  status: 'appeared' | 'missed' | 'ineligible' | 'alreadyEvaluated';
  save: PokeVoiceSaveV1;
  eligibleVisit: number;
  probability: number;
  guaranteed: boolean;
  appeared: boolean;
}

function validateDefinition(definition: RareEncounterDefinitionV1) {
  if (!definition.encounterId?.trim()) throw new Error('encounterId debe ser estable y no vacío.');
  if (!(definition.baseProbability > 0 && definition.baseProbability < 1)) {
    throw new Error('baseProbability debe ser mayor que 0 y menor que 1.');
  }
  const guarantee = definition.guaranteedEligibleVisit
    ?? DEFAULT_GUARANTEED_ELIGIBLE_VISIT;
  if (!Number.isSafeInteger(guarantee) || guarantee < 1) {
    throw new Error('guaranteedEligibleVisit debe ser un entero positivo.');
  }
  return guarantee;
}

export function evaluateRareEncounterVisit(
  save: PokeVoiceSaveV1,
  request: EvaluateRareEncounterRequest,
): RareEncounterVisitResult {
  const guaranteeVisit = validateDefinition(request.definition);
  if (!(request.randomRoll >= 0 && request.randomRoll < 1)) {
    throw new Error('randomRoll debe estar entre 0 inclusive y 1 exclusive.');
  }
  const session = save.activeExpeditionSession;
  if (!session || session.mapId !== request.mapId) {
    throw new Error('El encuentro solo puede evaluarse dentro de una expedición activa en su mapa.');
  }

  const encounterId = request.definition.encounterId;
  const currentProgress = save.pokeDiscover.mapProgress[request.mapId]
    ?? createAdventureMapProgressV1(request.mapId);
  const currentVisit = currentProgress.eligibleEncounterVisits[encounterId] ?? 0;
  const previousResult = session.evaluatedEncounterResults?.[encounterId];
  if (previousResult !== undefined) {
    const guaranteed = currentVisit >= guaranteeVisit;
    return {
      status: 'alreadyEvaluated',
      save,
      eligibleVisit: currentVisit,
      probability: guaranteed ? 1 : Math.min(1, request.definition.baseProbability * currentVisit),
      guaranteed,
      appeared: previousResult,
    };
  }

  const eligible = evaluateRequirement(request.definition.requirement, {
    save,
    ...(request.species ? { species: request.species } : {}),
    ...(request.companionForm ? { companionForm: request.companionForm } : {}),
  }).met;
  if (!eligible) {
    const nextSession = {
      ...session,
      evaluatedEncounterResults: {
        ...(session.evaluatedEncounterResults ?? {}),
        [encounterId]: false,
      },
    };
    return {
      status: 'ineligible',
      save: { ...save, activeExpeditionSession: nextSession },
      eligibleVisit: currentVisit,
      probability: 0,
      guaranteed: false,
      appeared: false,
    };
  }

  const eligibleVisit = currentVisit + 1;
  const guaranteed = eligibleVisit >= guaranteeVisit;
  const probability = guaranteed
    ? 1
    : Math.min(1, request.definition.baseProbability * eligibleVisit);
  const appeared = guaranteed || request.randomRoll < probability;
  const mapProgress = {
    ...currentProgress,
    eligibleEncounterVisits: {
      ...currentProgress.eligibleEncounterVisits,
      [encounterId]: eligibleVisit,
    },
  };
  const nextSession = {
    ...session,
    evaluatedEncounterResults: {
      ...(session.evaluatedEncounterResults ?? {}),
      [encounterId]: appeared,
    },
  };

  return {
    status: appeared ? 'appeared' : 'missed',
    save: {
      ...save,
      pokeDiscover: {
        ...save.pokeDiscover,
        mapProgress: { ...save.pokeDiscover.mapProgress, [request.mapId]: mapProgress },
      },
      activeExpeditionSession: nextSession,
    },
    eligibleVisit,
    probability,
    guaranteed,
    appeared,
  };
}
