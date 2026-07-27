import type {
  CompanionBehaviorTriggerV3,
  PokemonFormV1,
  PokemonSpeciesV1,
  PokeVoiceSaveV1,
  RewardDefinitionV1,
} from '../../../packages/contracts/src/index.js';
import { claimPokeDiscoverRewards } from '../progress/rewardLedger.js';
import { evaluateRequirement } from '../requirements/evaluateRequirement.js';
import { createAdventureMapProgressV1 } from './adventureMapProgress.js';
import { recordMapDiscovery } from './adventureMapProgress.js';

export interface CompanionBehaviorContext {
  companionForm: PokemonFormV1;
  species?: readonly PokemonSpeciesV1[];
  expeditionCapabilities?: ReadonlyArray<{ id: string; strength?: number }>;
}

export interface ExecuteCompanionBehaviorRequest extends CompanionBehaviorContext {
  mapId: string;
  trigger: CompanionBehaviorTriggerV3;
  executedAt: string;
  rewards?: readonly RewardDefinitionV1[];
}

export interface ExecuteCompanionBehaviorResult {
  status: 'executed' | 'ineligible' | 'alreadyCompleted';
  save: PokeVoiceSaveV1;
  sequenceId?: string;
  rewardStatus: 'claimed' | 'alreadyClaimed' | 'notApplicable';
}

function assertActiveContext(save: PokeVoiceSaveV1, mapId: string, companionForm: PokemonFormV1) {
  const session = save.activeExpeditionSession;
  if (!session || session.mapId !== mapId) {
    throw new Error('El comportamiento solo puede ejecutarse dentro de su mapa activo.');
  }
  const selectedFormId = session.loadout?.companion.formId ?? session.companionFormId;
  if (selectedFormId !== companionForm.formId) {
    throw new Error('El compañero evaluado no coincide con el loadout bloqueado.');
  }
  return session;
}

function isCompleted(save: PokeVoiceSaveV1, mapId: string, trigger: CompanionBehaviorTriggerV3) {
  const unlocked = save.pokeDiscover.mapProgress[mapId]?.unlockedSecretIds ?? [];
  if ((trigger.completionEffects?.unlockSecretIds ?? []).some(secretId => unlocked.includes(secretId))) return true;
  const policy = trigger.repeatPolicy ?? 'oncePerVisit';
  if (policy === 'repeatable') return false;
  if (policy === 'persistent') {
    return save.pokeDiscover.mapProgress[mapId]
      ?.completedBehaviorTriggerIds?.includes(trigger.triggerId) ?? false;
  }
  return save.activeExpeditionSession
    ?.completedBehaviorTriggerIds?.includes(trigger.triggerId) ?? false;
}

function requirementMet(
  save: PokeVoiceSaveV1,
  trigger: CompanionBehaviorTriggerV3,
  context: CompanionBehaviorContext,
) {
  return evaluateRequirement(trigger.requirement, {
    save,
    companionForm: context.companionForm,
    ...(context.species ? { species: context.species } : {}),
    ...(context.expeditionCapabilities
      ? { expeditionCapabilities: context.expeditionCapabilities }
      : {}),
  }).met;
}

export function listAvailableCompanionBehaviors(
  save: PokeVoiceSaveV1,
  mapId: string,
  triggers: readonly CompanionBehaviorTriggerV3[],
  context: CompanionBehaviorContext,
) {
  assertActiveContext(save, mapId, context.companionForm);
  return listMatchingCompanionBehaviors(save, mapId, triggers, context);
}

export function listMatchingCompanionBehaviors(
  save: PokeVoiceSaveV1,
  mapId: string,
  triggers: readonly CompanionBehaviorTriggerV3[],
  context: CompanionBehaviorContext,
) {
  return triggers.filter(trigger => (
    !isCompleted(save, mapId, trigger) && requirementMet(save, trigger, context)
  ));
}

function markCompleted(
  save: PokeVoiceSaveV1,
  mapId: string,
  trigger: CompanionBehaviorTriggerV3,
) {
  const policy = trigger.repeatPolicy ?? 'oncePerVisit';
  if (policy === 'repeatable') return save;
  if (policy === 'persistent') {
    const current = save.pokeDiscover.mapProgress[mapId]
      ?? createAdventureMapProgressV1(mapId);
    const completedBehaviorTriggerIds = [
      ...(current.completedBehaviorTriggerIds ?? []),
      trigger.triggerId,
    ].filter((id, index, all) => all.indexOf(id) === index);
    return {
      ...save,
      pokeDiscover: {
        ...save.pokeDiscover,
        mapProgress: {
          ...save.pokeDiscover.mapProgress,
          [mapId]: { ...current, completedBehaviorTriggerIds },
        },
      },
    };
  }
  const session = save.activeExpeditionSession!;
  return {
    ...save,
    activeExpeditionSession: {
      ...session,
      completedBehaviorTriggerIds: [
        ...(session.completedBehaviorTriggerIds ?? []),
        trigger.triggerId,
      ],
    },
  };
}

export function executeCompanionBehavior(
  save: PokeVoiceSaveV1,
  request: ExecuteCompanionBehaviorRequest,
): ExecuteCompanionBehaviorResult {
  const session = assertActiveContext(save, request.mapId, request.companionForm);
  if (isCompleted(save, request.mapId, request.trigger)) {
    return { status: 'alreadyCompleted', save, rewardStatus: 'notApplicable' };
  }
  if (!requirementMet(save, request.trigger, request)) {
    return { status: 'ineligible', save, rewardStatus: 'notApplicable' };
  }
  if (Number.isNaN(Date.parse(request.executedAt))) {
    throw new Error('executedAt debe ser una fecha ISO válida.');
  }

  let nextSave = markCompleted(save, request.mapId, request.trigger);
  for (const secretId of request.trigger.completionEffects?.unlockSecretIds ?? []) {
    const discovery = recordMapDiscovery(nextSave.pokeDiscover, request.mapId, 'secret', secretId);
    nextSave = { ...nextSave, pokeDiscover: discovery.state };
  }
  let rewardStatus: ExecuteCompanionBehaviorResult['rewardStatus'] = 'notApplicable';
  const rewards = request.rewards ?? request.trigger.rewards;
  if (rewards?.length) {
    if (!request.trigger.rewardOriginId) {
      throw new Error('Un comportamiento con recompensas debe declarar rewardOriginId.');
    }
    const reward = claimPokeDiscoverRewards(nextSave.pokeDiscover, {
      originId: request.trigger.rewardOriginId,
      rewards,
      claimedAt: request.executedAt,
      runId: nextSave.pokedexRun.runId,
      mapId: request.mapId,
      ...(session.missionId ? { missionId: session.missionId } : {}),
    });
    rewardStatus = reward.status;
    nextSave = { ...nextSave, pokeDiscover: reward.state };
  }

  return {
    status: 'executed',
    save: nextSave,
    sequenceId: request.trigger.sequenceId,
    rewardStatus,
  };
}
