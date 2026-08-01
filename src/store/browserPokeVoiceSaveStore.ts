import type {
  ActiveModeSessionV1,
  ActiveExpeditionSessionV1,
  PermanentAchievementRecordV1,
  PokedexRunStateV1,
  PokeDiscoverStateV1,
  PokeVoicePreferencesV1,
  PokeVoiceSaveV1,
  ResearchFactV1,
} from '../../packages/contracts/src/index.js';
import {
  CAMPHOR_PROLOGUE_MISSION_ID,
  CAMPHOR_RATTATA_ACTOR_IDS,
} from '../data/adventure/camphorPrologue.js';
import { LS_CARD_SCALE, LS_GENS, LS_KEY } from '../../scripts/utils.js';
import type { AchievementRecord } from '../domain/achievements/achievementProgress.js';
import {
  POKE_DISCOVER_ACHIEVEMENT_EVENT,
  unlockSatisfiedPokeDiscoverAchievements,
} from '../domain/achievements/pokeDiscoverAchievements.js';
import type { PokemonCatalogRecord } from '../domain/catalog/pokemonCatalogModel.js';
import { purchaseShopOffer, selectFieldTool } from '../domain/economy/pokeDiscoverEconomy.js';
import { recordMissingNoCommand } from '../domain/expeditions/anomalyResearch.js';
import {
  completeAdventureMission,
  recordMapDiscovery,
  type CompleteMissionRequest,
  type MapDiscoveryKind,
} from '../domain/expeditions/adventureMapProgress.js';
import {
  beginExpedition,
  endExpeditionWithReport,
  recordMeaningfulExpeditionInteraction,
  type BeginExpeditionRequest,
  type EndExpeditionOptions,
  type RecordMeaningfulInteractionRequest,
} from '../domain/expeditions/expeditionSession.js';
import {
  recordNpcHint,
  type RecordNpcHintRequest,
} from '../domain/expeditions/fieldNotebook.js';
import {
  executeCompanionBehavior,
  type ExecuteCompanionBehaviorRequest,
} from '../domain/expeditions/companionBehavior.js';
import {
  evaluateRareEncounterVisit,
  type EvaluateRareEncounterRequest,
} from '../domain/expeditions/rareEncounter.js';
import {
  resolveExpressionTrigger,
  type ResolveExpressionTriggerRequest,
} from '../domain/expeditions/expressionTriggers.js';
import {
  completeMissionDefinition,
  startAdventureMission,
  type MissionEvaluationContext,
} from '../domain/expeditions/missionLifecycle.js';
import {
  beginCamphorPrologue,
  chooseCamphorStarter,
  completeCamphorPrologue,
  confirmCamphorCompanion,
  discoverCamphorPinecoSecret,
  driveAwayCamphorRattata,
  prepareCamphorPrologue,
  reachCamphorStarterChoice,
} from '../domain/expeditions/camphorPrologue.js';
import { activateWorldEvent } from '../domain/expeditions/worldEvents.js';
import {
  identifyVisibleExpeditionSpecies,
  type IdentifyVisibleSpeciesRequest,
} from '../domain/expeditions/expeditionIdentification.js';
import {
  completeExpeditionInteraction,
  type CompleteExpeditionInteractionRequest,
} from '../domain/expeditions/expeditionInteractionCompletion.js';
import {
  completeMapEventTrigger,
  enterMapEventSector,
} from '../domain/expeditions/mapEventTriggers.js';
import { applyHazardConsequenceToSave } from '../domain/expeditions/hazardConsequences.js';
import {
  advanceActiveMissionFlow,
  getActiveMissionFlowState,
  resolveActiveMissionFailure,
  settleMissionFlow,
} from '../domain/expeditions/missionFlowRuntime.js';
import { normalizeMissionDefinition } from '../domain/expeditions/missionV2.js';
import { getPokeDiscoverMission } from '../data/adventure/missionCatalog.js';
import {
  createCompanionCatalogSpecies,
  type CompanionCandidate,
} from '../domain/companions/companionCandidates.js';
import { selectCompanion } from '../domain/companions/companionEligibility.js';
import {
  claimPokeDiscoverRewards,
  type RewardClaimRequest,
  type RewardClaimResult,
} from '../domain/progress/rewardLedger.js';
import {
  discoverResearchFact,
  type DiscoverResearchFactContext,
} from '../domain/research/researchProgress.js';
import {
  POKE_VOICE_SAVE_KEY,
  createPokedexRunStateV1,
  splitLegacyEasterEggState,
} from '../domain/progress/pokeVoiceSave.js';
import { TIMER_KEY } from '../lib/constants.js';
import {
  EASTER_EGG_STORAGE_KEY,
  LEGACY_ACHIEVEMENT_STORAGE_KEY,
  loadOrMigratePokeVoiceSave,
  parsePokeVoiceSave,
} from '../services/pokeVoiceSaveStorage.js';

let save: PokeVoiceSaveV1 | null = null;
let serializedSave: string | null = null;

function readCurrentSave() {
  const raw = localStorage.getItem(POKE_VOICE_SAVE_KEY);
  if (save && raw === serializedSave) return save;
  save = parsePokeVoiceSave(raw)
    ?? loadOrMigratePokeVoiceSave({ storage: localStorage }).save;
  serializedSave = JSON.stringify(save);
  return save;
}

function persist(next: PokeVoiceSaveV1) {
  save = next;
  serializedSave = JSON.stringify(next);
  localStorage.setItem(POKE_VOICE_SAVE_KEY, serializedSave);
}

function persistWithPokeDiscoverAchievements(
  next: PokeVoiceSaveV1,
  unlockedAt = new Date().toISOString(),
) {
  const result = unlockSatisfiedPokeDiscoverAchievements(next, unlockedAt);
  persist(result.save);
  if (result.unlocked.length && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(POKE_DISCOVER_ACHIEVEMENT_EVENT, {
      detail: { achievementIds: result.unlocked.map(item => item.achievementId) },
    }));
  }
  return result;
}

export function getBrowserPokeVoiceSave() {
  return readCurrentSave();
}

function ensureBrowserMissionProgress(current: PokeVoiceSaveV1, missionId: string) {
  const mission = getPokeDiscoverMission(missionId);
  if (!mission) return current;
  const normalized = normalizeMissionDefinition(mission);
  const nodeId = normalized.flow?.initialNodeId ?? `${missionId}:start`;
  const existing = current.pokeDiscover.missionProgressById?.[missionId];
  if (existing) {
    const hasValidFlowNode = !normalized.flow || normalized.flow.nodes
      .some(node => node.nodeId === (existing.flowNodeId ?? normalized.flow!.initialNodeId));
    if (hasValidFlowNode || mission.schemaVersion !== 1 || !normalized.flow) return current;
    const repaired: PokeVoiceSaveV1 = {
      ...current,
      pokeDiscover: {
        ...current.pokeDiscover,
        missionProgressById: {
          ...current.pokeDiscover.missionProgressById,
          [missionId]: {
            ...existing,
            flowNodeId: normalized.flow.initialNodeId,
            updatedAt: new Date().toISOString(),
          },
        },
      },
    };
    persist(repaired);
    return repaired;
  }
  if (!current.pokeDiscover.activeMissionIds.includes(missionId)) return current;
  const now = new Date().toISOString();
  const legacyRuntime = current.activeExpeditionSession?.missionId === missionId
    ? current.activeExpeditionSession.missionRuntime
    : undefined;
  const next: PokeVoiceSaveV1 = {
    ...current,
    pokeDiscover: {
      ...current.pokeDiscover,
      missionProgressById: {
        ...(current.pokeDiscover.missionProgressById ?? {}),
        [missionId]: {
          schemaVersion: 1 as const,
          missionId,
          checkpointId: legacyRuntime?.checkpointId ?? nodeId,
          flowNodeId: legacyRuntime?.flowNodeId ?? nodeId,
          flags: { ...(legacyRuntime?.flags ?? {}) },
          counters: { ...(legacyRuntime?.counters ?? {}) },
          resolvedActorIds: [...(legacyRuntime?.resolvedActorIds ?? [])],
          executedFlowEffectIds: [...(legacyRuntime?.executedFlowEffectIds ?? [])],
          ...(legacyRuntime?.conversationCheckpoint
            ? { conversationCheckpoint: legacyRuntime.conversationCheckpoint }
            : {}),
          startedAt: now,
          updatedAt: now,
        },
      },
    },
  };
  persist(next);
  return next;
}

export function getBrowserMissionFlowState(missionId?: string) {
  let current = readCurrentSave();
  const resolvedMissionId = missionId
    ?? current.activeExpeditionSession?.missionId
    ?? Object.keys(current.pokeDiscover.missionProgressById ?? {})[0];
  if (!resolvedMissionId) return undefined;
  const mission = getPokeDiscoverMission(resolvedMissionId);
  if (!mission) return undefined;
  current = ensureBrowserMissionProgress(current, resolvedMissionId);
  const state = getActiveMissionFlowState(current, mission);
  return state ? { save: current, mission: state.mission, node: state.node } : undefined;
}

export function advanceBrowserMissionFlow(outcomeId?: string, missionId?: string) {
  const state = getBrowserMissionFlowState(missionId);
  if (!state) return undefined;
  const result = state.node.kind === 'condition' || state.node.kind === 'effect'
    ? settleMissionFlow(state.save, state.mission)
    : advanceActiveMissionFlow(state.save, state.mission, outcomeId);
  const reconciled = persistWithPokeDiscoverAchievements(result.save);
  return { save: reconciled.save, mission: result.mission, node: result.node };
}

export function resolveBrowserMissionFailure(missionId?: string) {
  const state = getBrowserMissionFlowState(missionId);
  if (!state) return undefined;
  const next = resolveActiveMissionFailure(state.save, state.mission);
  persist(next);
  return next;
}

export function enterBrowserMissionFlowExpedition(mapId: string) {
  const current = readCurrentSave();
  const session = current.activeExpeditionSession;
  if (!session?.missionId) return current;
  const next: PokeVoiceSaveV1 = {
    ...current,
    activeExpeditionSession: {
      ...session,
      mapId,
      activeSectorVisit: undefined,
    },
  };
  persist(next);
  return next;
}

export function checkpointBrowserMissionConversation(checkpoint: {
  conversationId: string;
    cueId: string;
    historyCueIds: string[];
    selectedChoices: Record<string, string>;
    variables: Record<string, string | number | boolean>;
    executedEffectIds: string[];
  }) {
    const current = readCurrentSave();
    const session = current.activeExpeditionSession;
    if (!session) return current;
    const mission = session.missionId ? getPokeDiscoverMission(session.missionId) : undefined;
    if (!mission) return current;
    const withProgress = ensureBrowserMissionProgress(current, mission.missionId);
    const missionProgress = withProgress.pokeDiscover.missionProgressById[mission.missionId];
  const readCueIds = [...new Set([
    ...(current.pokeDiscover.narrativeProgress.readCueIds ?? []),
    ...checkpoint.historyCueIds,
    checkpoint.cueId,
  ])];
  const next: PokeVoiceSaveV1 = {
    ...withProgress,
    pokeDiscover: {
      ...withProgress.pokeDiscover,
      narrativeProgress: {
        ...withProgress.pokeDiscover.narrativeProgress,
        readCueIds,
      },
      missionProgressById: {
        ...withProgress.pokeDiscover.missionProgressById,
        [mission.missionId]: {
          ...missionProgress,
        conversationCheckpoint: {
          schemaVersion: 1,
          conversationId: checkpoint.conversationId,
          cueId: checkpoint.cueId,
          historyCueIds: checkpoint.historyCueIds,
            executedEffectIds: checkpoint.executedEffectIds,
            variables: checkpoint.variables,
          selectedChoices: checkpoint.selectedChoices,
        },
          updatedAt: new Date().toISOString(),
        },
      },
    },
  };
  persist(next);
  return next;
}

export function prepareBrowserCamphorPrologue(
  availableCompanionCount: number,
  offeredAt = new Date().toISOString(),
) {
  const current = readCurrentSave();
  if (current.pendingMissionLaunch) return current;
  const prologueCompleted = Object.values(current.pokeDiscover.mapProgress)
    .some(progress => progress.completedMissionIds.includes(CAMPHOR_PROLOGUE_MISSION_ID));
  if (prologueCompleted) return current;
  const next = prepareCamphorPrologue(current, availableCompanionCount, offeredAt);
  persist(next);
  return next;
}

export function confirmBrowserCamphorCompanion() {
  const next = confirmCamphorCompanion(readCurrentSave());
  persist(next);
  return next;
}

export function reachBrowserCamphorStarterChoice() {
  const next = reachCamphorStarterChoice(readCurrentSave());
  persist(next);
  return next;
}

export function chooseBrowserCamphorStarter(speciesId: 1 | 4 | 7) {
  const next = chooseCamphorStarter(readCurrentSave(), speciesId);
  persist(next);
  return next;
}

export function beginBrowserCamphorPrologue(enteredAt = new Date().toISOString()) {
  const next = beginCamphorPrologue(readCurrentSave(), enteredAt);
  persist(next);
  return next;
}

export function resolveBrowserCamphorRescue() {
  let next = readCurrentSave();
  for (const actorId of CAMPHOR_RATTATA_ACTOR_IDS) {
    next = driveAwayCamphorRattata(next, actorId, 'companion');
  }
  persist(next);
  return next;
}

export function completeBrowserCamphorPrologueScene(completedAt = new Date().toISOString()) {
  const completion = completeCamphorPrologue(readCurrentSave(), completedAt);
  if (completion.status !== 'completed') return completion;
  const pineco = discoverCamphorPinecoSecret(completion.save, completedAt);
  const reconciled = persistWithPokeDiscoverAchievements(pineco.save, completedAt);
  return { ...completion, save: reconciled.save, pinecoStatus: pineco.status };
}

export function getBrowserLegacyEasterEggState() {
  const current = readCurrentSave();
  return {
    meowthCoins: current.pokeDiscover.globalCounters.meowthCoins ?? 0,
    gimmighoulCoins: current.pokeDiscover.globalCounters.gimmighoulCoins ?? 0,
    unownMessage: '',
    palafinPending: false,
    ...current.pokeDiscover.worldFlags,
  };
}

export function updateBrowserPokedexRun(
  updater: (current: PokedexRunStateV1) => PokedexRunStateV1,
) {
  const current = readCurrentSave();
  persist({ ...current, pokedexRun: updater(current.pokedexRun) });
}

export function updateBrowserPokeDiscover(
  updater: (current: PokeDiscoverStateV1) => PokeDiscoverStateV1,
) {
  const current = readCurrentSave();
  persist({ ...current, pokeDiscover: updater(current.pokeDiscover) });
}

export function updateBrowserPreferences(
  updater: (current: PokeVoicePreferencesV1) => PokeVoicePreferencesV1,
) {
  const current = readCurrentSave();
  persist({ ...current, preferences: updater(current.preferences) });
}

export function selectBrowserCompanion(
  candidate: CompanionCandidate,
  catalog: readonly PokemonCatalogRecord[],
  selectedAt = new Date().toISOString(),
) {
  const current = readCurrentSave();
  const result = selectCompanion({
    save: current,
    definition: candidate.requirement,
    form: candidate.form,
    species: catalog.map(createCompanionCatalogSpecies),
    selectedAt,
  });
  if (result.status === 'selected') persist(result.save);
  return result;
}

export function startNewPokedexRun({
  runId = typeof globalThis.crypto?.randomUUID === 'function'
    ? `pokedex-run:${globalThis.crypto.randomUUID()}`
    : `pokedex-run:${Date.now()}:${Math.random().toString(36).slice(2)}`,
  sourceModeId,
  startedAt = Date.now(),
}: {
  runId?: string;
  sourceModeId?: string;
  startedAt?: number;
}) {
  const current = readCurrentSave();
  if (current.activeExpeditionSession) {
    throw new Error('No se puede iniciar una nueva run durante una expedición activa.');
  }
  persist({
    ...current,
    pokedexRun: createPokedexRunStateV1({
      runId,
      startedAt: new Date(startedAt).toISOString(),
      ...(sourceModeId ? { sourceModeId } : {}),
    }),
    activeModeSession: undefined,
  });
  return runId;
}

export function startBrowserIsolatedModeSession(
  session: Omit<ActiveModeSessionV1, 'suspendedPokedexRun'>,
) {
  const current = readCurrentSave();
  if (current.activeExpeditionSession) {
    throw new Error('No se puede iniciar un modo aislado durante una expedición activa.');
  }
  const temporaryRun = createPokedexRunStateV1({
    runId: session.runId,
    startedAt: session.startedAt,
    sourceModeId: session.modeId,
  });
  persist({
    ...current,
    pokedexRun: temporaryRun,
    activeModeSession: {
      ...session,
      suspendedPokedexRun: current.pokedexRun,
    },
  });
  return temporaryRun;
}

export function setBrowserActiveModeSession(session: ActiveModeSessionV1 | undefined) {
  const current = readCurrentSave();
  persist({ ...current, activeModeSession: session });
}

export function updateBrowserActiveModeSession(
  updater: (current: ActiveModeSessionV1) => ActiveModeSessionV1,
) {
  const current = readCurrentSave();
  if (!current.activeModeSession) return;
  persist({ ...current, activeModeSession: updater(current.activeModeSession) });
}

export function completeBrowserMode(modeId: string, score: number, completedAt = new Date().toISOString()) {
  const current = readCurrentSave();
  const previous = current.pokeDiscover.modeProgress[modeId];
  const progress = {
    modeId,
    completed: true,
    completionCount: (previous?.completionCount ?? 0) + 1,
    bestScore: Math.max(previous?.bestScore ?? 0, score),
    lastScore: score,
    lastCompletedAt: completedAt,
  };
  persist({
    ...current,
    pokeDiscover: {
      ...current.pokeDiscover,
      modeProgress: { ...current.pokeDiscover.modeProgress, [modeId]: progress },
    },
  });
  return progress;
}

export function completeBrowserIsolatedMode(
  modeId: string,
  score: number,
  completedAt = new Date().toISOString(),
) {
  const current = readCurrentSave();
  const session = current.activeModeSession;
  if (!session || session.modeId !== modeId) {
    throw new Error(`No hay una sesión aislada activa para ${modeId}.`);
  }
  const previous = current.pokeDiscover.modeProgress[modeId];
  const progress = {
    ...previous,
    modeId,
    completed: true,
    completionCount: (previous?.completionCount ?? 0) + 1,
    bestScore: Math.max(previous?.bestScore ?? 0, score),
    lastScore: score,
    lastCompletedAt: completedAt,
  };
  const restoredRun = session.suspendedPokedexRun ?? current.pokedexRun;
  persist({
    ...current,
    pokedexRun: restoredRun,
    pokeDiscover: {
      ...current.pokeDiscover,
      modeProgress: { ...current.pokeDiscover.modeProgress, [modeId]: progress },
    },
    activeModeSession: undefined,
  });
  return { progress, restoredRun };
}

export function completeBrowserThemedChallenge(
  modeId: string,
  challengeId: string,
  score: number,
  completedAt = new Date().toISOString(),
) {
  const current = readCurrentSave();
  const previous = current.pokeDiscover.modeProgress[modeId];
  const completedChallengeIds = [...new Set([
    ...(previous?.completedChallengeIds ?? []),
    challengeId,
  ])];
  const progress = {
    ...previous,
    modeId,
    completed: true,
    completionCount: (previous?.completionCount ?? 0) + 1,
    bestScore: Math.max(previous?.bestScore ?? 0, score),
    lastScore: score,
    lastCompletedAt: completedAt,
    completedChallengeIds,
  };
  persist({
    ...current,
    pokeDiscover: {
      ...current.pokeDiscover,
      modeProgress: { ...current.pokeDiscover.modeProgress, [modeId]: progress },
    },
  });
  return progress;
}

export function completeBrowserDailyChallenge(
  modeId: string,
  dateKey: string,
  challengeId: string,
  score: number,
  previousDateKey: string,
  completedAt = new Date().toISOString(),
) {
  const current = readCurrentSave();
  const previous = current.pokeDiscover.modeProgress[modeId];
  if (previous?.lastDailyCompletedOn && previous.lastDailyCompletedOn >= dateKey) {
    return { progress: previous, awarded: false };
  }
  const dailyStreak = previous?.lastDailyCompletedOn === previousDateKey
    ? (previous.dailyStreak ?? 0) + 1
    : 1;
  const progress = {
    ...previous,
    modeId,
    completed: true,
    completionCount: (previous?.completionCount ?? 0) + 1,
    bestScore: Math.max(previous?.bestScore ?? 0, score),
    lastScore: score,
    lastCompletedAt: completedAt,
    lastDailyCompletedOn: dateKey,
    lastDailyChallengeId: challengeId,
    dailyStreak,
    bestDailyStreak: Math.max(previous?.bestDailyStreak ?? 0, dailyStreak),
  };
  persist({
    ...current,
    pokeDiscover: {
      ...current.pokeDiscover,
      modeProgress: { ...current.pokeDiscover.modeProgress, [modeId]: progress },
    },
  });
  return { progress, awarded: true };
}

export function recordBrowserModeBestScore(modeId: string, score: number) {
  const current = readCurrentSave();
  const previous = current.pokeDiscover.modeProgress[modeId];
  if ((previous?.bestScore ?? 0) >= score) return previous;
  const progress = {
    ...previous,
    modeId,
    completed: previous?.completed ?? false,
    completionCount: previous?.completionCount ?? 0,
    bestScore: score,
  };
  persist({
    ...current,
    pokeDiscover: {
      ...current.pokeDiscover,
      modeProgress: { ...current.pokeDiscover.modeProgress, [modeId]: progress },
    },
  });
  return progress;
}

export function recordBrowserModeAchievement(achievementId: string) {
  const current = readCurrentSave();
  const session = current.activeModeSession;
  if (!session || session.satisfiedAchievementIds?.includes(achievementId)) return;
  persist({
    ...current,
    activeModeSession: {
      ...session,
      satisfiedAchievementIds: [...(session.satisfiedAchievementIds ?? []), achievementId],
    },
  });
}

export function setBrowserActiveExpeditionSession(session: ActiveExpeditionSessionV1 | undefined) {
  const current = readCurrentSave();
  persist({ ...current, activeExpeditionSession: session });
}

export function beginBrowserExpedition(request: BeginExpeditionRequest) {
  const current = readCurrentSave();
  const next = beginExpedition(current, request);
  persist(next);
  return next.activeExpeditionSession!;
}

export function endBrowserExpeditionWithReport(options: EndExpeditionOptions = {}) {
  const current = readCurrentSave();
  const result = endExpeditionWithReport(current, options);
  if (result.save === current) return result;
  const reconciled = persistWithPokeDiscoverAchievements(result.save);
  return { ...result, save: reconciled.save };
}

export function recordBrowserMeaningfulExpeditionInteraction(
  request: RecordMeaningfulInteractionRequest,
) {
  const current = readCurrentSave();
  const next = recordMeaningfulExpeditionInteraction(current, request);
  if (next !== current) persist(next);
  return next.activeExpeditionSession;
}

export function completeBrowserExpeditionInteraction(
  request: CompleteExpeditionInteractionRequest,
) {
  const current = readCurrentSave();
  const result = completeExpeditionInteraction(current, request);
  if (result.save !== current) persist(result.save);
  return result;
}

export function completeBrowserMapEventTrigger(
  mapId: string,
  trigger: import('../../packages/contracts/src/index.js').MapEventTriggerV3,
  options?: {
    completedAt?: string;
    rewards?: readonly import('../../packages/contracts/src/index.js').RewardDefinitionV1[];
  },
) {
  const current = readCurrentSave();
  const result = completeMapEventTrigger(current, mapId, trigger, options);
  if (result.save !== current) persist(result.save);
  return result;
}

export function enterBrowserMapEventSector(mapId: string, sectorId: string) {
  const current = readCurrentSave();
  const next = enterMapEventSector(current, mapId, sectorId);
  if (next !== current) persist(next);
  return next.activeExpeditionSession;
}

export function applyBrowserHazardConsequence(
  consequence: import('../../packages/contracts/src/index.js').HazardConsequenceV1,
) {
  const result = applyHazardConsequenceToSave(readCurrentSave(), consequence);
  persist(result.save);
  return result;
}

export function identifyBrowserVisibleExpeditionSpecies(request: IdentifyVisibleSpeciesRequest) {
  const current = readCurrentSave();
  const result = identifyVisibleExpeditionSpecies(current, request);
  if (result.save !== current) persist(result.save);
  return result;
}

export function recordBrowserMapDiscovery(
  mapId: string,
  kind: MapDiscoveryKind,
  stableId: string,
) {
  const current = readCurrentSave();
  const result = recordMapDiscovery(current.pokeDiscover, mapId, kind, stableId);
  if (result.state !== current.pokeDiscover) {
    let next = { ...current, pokeDiscover: result.state };
    if (next.activeExpeditionSession) {
      const interactionKind = kind === 'conversation'
        ? 'npcConversation'
        : kind === 'secret' || kind === 'hint' || kind === 'collectible'
          ? kind
          : undefined;
      if (interactionKind) next = recordMeaningfulExpeditionInteraction(next, {
        interactionId: `${kind}:${stableId}`,
        kind: interactionKind,
      });
    }
    next = persistWithPokeDiscoverAchievements(next).save;
  }
  return result.state === current.pokeDiscover
    ? result
    : { ...result, state: getBrowserPokeVoiceSave().pokeDiscover };
}

export function recordBrowserNpcHint(request: RecordNpcHintRequest) {
  const current = readCurrentSave();
  const result = recordNpcHint(current.pokeDiscover, request);
  if (result.state !== current.pokeDiscover) {
    let next = { ...current, pokeDiscover: result.state };
    if (next.activeExpeditionSession) next = recordMeaningfulExpeditionInteraction(next, {
      interactionId: `hint:${request.hintId}`,
      kind: 'hint',
    });
    persist(next);
  }
  return result;
}

export function recordBrowserMissingNoCommand(discoveredAt = new Date().toISOString()) {
  const current = readCurrentSave();
  const result = recordMissingNoCommand(current.pokeDiscover, discoveredAt);
  if (result.state !== current.pokeDiscover) {
    persist({ ...current, pokeDiscover: result.state });
  }
  return result;
}

export function purchaseBrowserShopOffer(
  offer: import('../../packages/contracts/src/index.js').ShopOfferV1,
  purchasedAt = new Date().toISOString(),
) {
  const current = readCurrentSave();
  const result = purchaseShopOffer(current.pokeDiscover, offer, purchasedAt);
  if (result.state !== current.pokeDiscover) {
    persist({ ...current, pokeDiscover: result.state });
  }
  return result;
}

export function selectBrowserFieldTool(toolId: string) {
  const current = readCurrentSave();
  if (current.activeExpeditionSession) {
    throw new Error('No se puede cambiar de herramienta durante una expedición activa.');
  }
  const next = selectFieldTool(current.pokeDiscover, toolId);
  if (next !== current.pokeDiscover) persist({ ...current, pokeDiscover: next });
  return next.inventory.selectedToolId;
}

export function completeBrowserAdventureMission(request: CompleteMissionRequest) {
  const current = readCurrentSave();
  const result = completeAdventureMission(current.pokeDiscover, {
    ...request,
    originRunId: request.originRunId ?? current.pokedexRun.runId,
  });
  if (result.state !== current.pokeDiscover) {
    persistWithPokeDiscoverAchievements({ ...current, pokeDiscover: result.state }, request.completedAt);
  }
  return result.state === current.pokeDiscover
    ? result
    : { ...result, state: getBrowserPokeVoiceSave().pokeDiscover };
}

export function startBrowserAdventureMission(
  mission: import('../../packages/contracts/src/index.js').MissionDefinition,
  context: MissionEvaluationContext = {},
) {
  const current = readCurrentSave();
  const result = startAdventureMission(current, mission, context);
  if (result.save !== current) persist(result.save);
  return result;
}

export function completeBrowserMissionDefinition(
  mission: import('../../packages/contracts/src/index.js').MissionDefinition,
  completedAt: string,
  context: MissionEvaluationContext = {},
) {
  const current = readCurrentSave();
  const result = completeMissionDefinition(current, mission, completedAt, context);
  if (result.save === current) return result;
  const reconciled = persistWithPokeDiscoverAchievements(result.save, completedAt);
  return { ...result, save: reconciled.save };
}

export function evaluateBrowserRareEncounterVisit(request: EvaluateRareEncounterRequest) {
  const current = readCurrentSave();
  const result = evaluateRareEncounterVisit(current, {
    ...request,
    encounteredAt: request.encounteredAt ?? new Date().toISOString(),
  });
  let next = result.save;
  if (result.appeared && next.activeExpeditionSession) {
    next = recordMeaningfulExpeditionInteraction(next, {
      interactionId: `rare-encounter:${request.definition.encounterId}`,
      kind: 'pokemonInteraction',
    });
  }
  if (next !== current) persist(next);
  return { ...result, save: next };
}

export function activateBrowserWorldEvent(event: import('../../packages/contracts/src/index.js').WorldEventV1) {
  const current = readCurrentSave();
  const result = activateWorldEvent(current, event);
  if (result.save !== current) persist(result.save);
  return result;
}

export function executeBrowserCompanionBehavior(request: ExecuteCompanionBehaviorRequest) {
  const current = readCurrentSave();
  const result = executeCompanionBehavior(current, request);
  let next = result.save;
  if (result.status === 'executed' && next.activeExpeditionSession) {
    next = recordMeaningfulExpeditionInteraction(next, {
      interactionId: `companion-behavior:${request.trigger.triggerId}`,
      kind: 'companionBehavior',
    });
  }
  if (next === current) return { ...result, save: next };
  const reconciled = persistWithPokeDiscoverAchievements(next, request.executedAt);
  return { ...result, save: reconciled.save };
}

export function resolveBrowserExpressionTrigger(request: ResolveExpressionTriggerRequest) {
  const current = readCurrentSave();
  const result = resolveExpressionTrigger(current, request);
  let next = result.save;
  if (result.status === 'resolved' && next.activeExpeditionSession) {
    next = recordMeaningfulExpeditionInteraction(next, {
      interactionId: `expression:${request.trigger.triggerId}`,
      kind: 'contextTrigger',
    });
  }
  if (next === current) return { ...result, save: next };
  const reconciled = persistWithPokeDiscoverAchievements(next, request.resolvedAt);
  return { ...result, save: reconciled.save };
}

export function syncBrowserLegacyEasterEggState(legacyState: unknown) {
  const migrated = splitLegacyEasterEggState(legacyState);
  updateBrowserPokeDiscover(current => ({
    ...current,
    worldFlags: { ...current.worldFlags, ...migrated.worldFlags },
    globalCounters: { ...current.globalCounters, ...migrated.globalCounters },
  }));
}

export function syncBrowserAchievements(records: readonly AchievementRecord[]) {
  const current = readCurrentSave();
  const achievements: Record<string, PermanentAchievementRecordV1> = {
    ...current.pokeDiscover.achievements,
  };
  for (const record of records) {
    achievements[record.id] = {
      schemaVersion: 1,
      achievementId: record.id,
      unlockedAt: new Date(record.date).toISOString(),
      ...(record.domain ? { domain: record.domain } : {}),
      ...(record.originRunId ? { originRunId: record.originRunId } : {}),
      ...(record.originModeId ? { originModeId: record.originModeId } : {}),
    };
  }
  persist({
    ...current,
    pokeDiscover: { ...current.pokeDiscover, achievements },
  });
}

export function claimBrowserPokeDiscoverRewards(request: RewardClaimRequest): RewardClaimResult {
  const current = readCurrentSave();
  const result = claimPokeDiscoverRewards(current.pokeDiscover, request);
  if (result.status === 'claimed') {
    const reconciled = persistWithPokeDiscoverAchievements(
      { ...current, pokeDiscover: result.state },
      request.claimedAt,
    );
    return { ...result, state: reconciled.save.pokeDiscover };
  }
  return result;
}

export function discoverBrowserResearchFact(
  fact: ResearchFactV1,
  context: DiscoverResearchFactContext,
) {
  const current = readCurrentSave();
  const result = discoverResearchFact(current.pokeDiscover, fact, context);
  if (result.status === 'discovered') {
    let next = { ...current, pokeDiscover: result.state };
    if (next.activeExpeditionSession) next = recordMeaningfulExpeditionInteraction(next, {
      interactionId: `research:${fact.factId}`,
      kind: 'research',
    });
    next = persistWithPokeDiscoverAchievements(next, context.discoveredAt).save;
    return { ...result, state: next.pokeDiscover };
  }
  return result;
}

export function deleteAllBrowserPokeVoiceData() {
  const keys = [
    POKE_VOICE_SAVE_KEY,
    LS_KEY,
    LS_GENS,
    LS_CARD_SCALE,
    EASTER_EGG_STORAGE_KEY,
    TIMER_KEY,
  ];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key === LEGACY_ACHIEVEMENT_STORAGE_KEY || key?.startsWith('pokevoice-achievements')) {
      keys.push(key);
    }
  }
  for (const key of new Set(keys)) localStorage.removeItem(key);
  save = null;
  serializedSave = null;
}
