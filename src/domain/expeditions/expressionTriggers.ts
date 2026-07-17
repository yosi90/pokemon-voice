import type {
  ExpeditionExpressionTriggerV1,
  ExpressionInputMethod,
  ExpressionIntent,
  PokemonFormV1,
  PokemonSpeciesV1,
  PokeVoiceSaveV1,
  RewardDefinitionV1,
} from '../../../packages/contracts/src/index.js';
import { claimPokeDiscoverRewards } from '../progress/rewardLedger.js';
import { evaluateRequirement } from '../requirements/evaluateRequirement.js';
import { createAdventureMapProgressV1 } from './adventureMapProgress.js';

export interface AcousticExpressionFeatures {
  loudness?: number;
  durationMs?: number;
  sustainedNote?: boolean;
  simpleHum?: boolean;
}

export interface ExpressionAttemptV1 {
  method: ExpressionInputMethod;
  transcript?: string;
  intent?: ExpressionIntent;
  contextActionId?: string;
  acoustic?: AcousticExpressionFeatures;
}

export interface ResolveExpressionTriggerRequest {
  mapId: string;
  trigger: ExpeditionExpressionTriggerV1;
  attempt: ExpressionAttemptV1;
  resolvedAt: string;
  companionForm?: PokemonFormV1;
  species?: readonly PokemonSpeciesV1[];
  expeditionCapabilities?: ReadonlyArray<{ id: string; strength?: number }>;
  rewards?: readonly RewardDefinitionV1[];
}

export interface ResolveExpressionTriggerResult {
  status:
    | 'resolved'
    | 'alreadyResolved'
    | 'ineligible'
    | 'methodUnavailable'
    | 'notMatched';
  save: PokeVoiceSaveV1;
  understoodText?: string;
  sequenceId?: string;
  rewardStatus: 'claimed' | 'alreadyClaimed' | 'notApplicable';
}

export function normalizeExpressionText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .replace(/[^a-z0-9ñü]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function matchesAcoustic(
  matcher: Extract<ExpeditionExpressionTriggerV1['matchAny'][number], { kind: 'acoustic' }>,
  attempt: ExpressionAttemptV1,
) {
  if (attempt.method !== 'voice' || !attempt.acoustic) return false;
  const durationMet = matcher.minimumDurationMs === undefined
    || (attempt.acoustic.durationMs ?? 0) >= matcher.minimumDurationMs;
  const levelMet = matcher.minimumLevel === undefined
    || (attempt.acoustic.loudness ?? 0) >= matcher.minimumLevel;
  if (!durationMet || !levelMet) return false;
  switch (matcher.feature) {
    case 'loudness': return attempt.acoustic.loudness !== undefined;
    case 'sustainedNote': return attempt.acoustic.sustainedNote === true;
    case 'simpleHum': return attempt.acoustic.simpleHum === true;
  }
}

function matchesAttempt(trigger: ExpeditionExpressionTriggerV1, attempt: ExpressionAttemptV1) {
  if (attempt.method === 'contextAction') {
    return attempt.contextActionId === trigger.fallbackActionId;
  }
  const understoodText = normalizeExpressionText(attempt.transcript ?? '');
  return trigger.matchAny.some(matcher => {
    if (matcher.kind === 'acoustic') return matchesAcoustic(matcher, attempt);
    if (matcher.kind === 'intent') {
      if (attempt.intent === matcher.intent) return true;
      return matcher.examples.some(example => normalizeExpressionText(example) === understoodText);
    }
    return [...matcher.phrases, ...(matcher.aliases ?? [])]
      .some(phrase => normalizeExpressionText(phrase) === understoodText);
  });
}

export function resolveExpressionTrigger(
  save: PokeVoiceSaveV1,
  request: ResolveExpressionTriggerRequest,
): ResolveExpressionTriggerResult {
  const session = save.activeExpeditionSession;
  if (!session || session.mapId !== request.mapId) {
    throw new Error('La expresión solo puede resolverse dentro de su mapa activo.');
  }
  if (request.companionForm) {
    const selectedFormId = session.loadout?.companion.formId ?? session.companionFormId;
    if (selectedFormId !== request.companionForm.formId) {
      throw new Error('El compañero evaluado no coincide con el loadout bloqueado.');
    }
  }

  const current = save.pokeDiscover.mapProgress[request.mapId]
    ?? createAdventureMapProgressV1(request.mapId);
  if (current.resolvedExpressionTriggers?.[request.trigger.triggerId]) {
    return { status: 'alreadyResolved', save, rewardStatus: 'notApplicable' };
  }
  if (!evaluateRequirement(request.trigger.activationRequirement, {
    save,
    ...(request.companionForm ? { companionForm: request.companionForm } : {}),
    ...(request.species ? { species: request.species } : {}),
    ...(request.expeditionCapabilities
      ? { expeditionCapabilities: request.expeditionCapabilities }
      : {}),
  }).met) {
    return { status: 'ineligible', save, rewardStatus: 'notApplicable' };
  }
  if (!request.trigger.inputMethods.includes(request.attempt.method)) {
    return { status: 'methodUnavailable', save, rewardStatus: 'notApplicable' };
  }
  const understoodText = request.attempt.transcript === undefined
    ? undefined
    : normalizeExpressionText(request.attempt.transcript);
  if (!matchesAttempt(request.trigger, request.attempt)) {
    return {
      status: 'notMatched',
      save,
      rewardStatus: 'notApplicable',
      ...(understoodText ? { understoodText } : {}),
    };
  }
  if (Number.isNaN(Date.parse(request.resolvedAt))) {
    throw new Error('resolvedAt debe ser una fecha ISO válida.');
  }

  const record = {
    schemaVersion: 1 as const,
    triggerId: request.trigger.triggerId,
    method: request.attempt.method,
    resolvedAt: new Date(request.resolvedAt).toISOString(),
  };
  const mapProgress = {
    ...current,
    resolvedExpressionTriggers: {
      ...(current.resolvedExpressionTriggers ?? {}),
      [request.trigger.triggerId]: record,
    },
  };
  let nextSave: PokeVoiceSaveV1 = {
    ...save,
    pokeDiscover: {
      ...save.pokeDiscover,
      mapProgress: { ...save.pokeDiscover.mapProgress, [request.mapId]: mapProgress },
    },
  };
  let rewardStatus: ResolveExpressionTriggerResult['rewardStatus'] = 'notApplicable';
  if (request.rewards?.length) {
    if (!request.trigger.rewardOriginId) {
      throw new Error('Una interacción expresiva con recompensas debe declarar rewardOriginId.');
    }
    const reward = claimPokeDiscoverRewards(nextSave.pokeDiscover, {
      originId: request.trigger.rewardOriginId,
      rewards: request.rewards,
      claimedAt: request.resolvedAt,
      runId: nextSave.pokedexRun.runId,
      mapId: request.mapId,
      ...(session.missionId ? { missionId: session.missionId } : {}),
    });
    rewardStatus = reward.status;
    nextSave = { ...nextSave, pokeDiscover: reward.state };
  }

  return {
    status: 'resolved',
    save: nextSave,
    sequenceId: request.trigger.successSequenceId,
    rewardStatus,
    ...(understoodText ? { understoodText } : {}),
  };
}
