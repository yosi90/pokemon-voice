import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import {
  createTechnicalPhaserGame,
  MAP_AMBIENT_CONTROL_EVENT,
  MAP_EXPRESSION_AVAILABLE_EVENT,
  MAP_EXPRESSION_CONTROL_EVENT,
  MAP_EXPRESSION_REQUEST_EVENT,
  MAP_EXPRESSION_STARTED_EVENT,
  MAP_COMPANION_AVAILABLE_EVENT,
  MAP_COMPANION_BEHAVIOR_COMPLETED_EVENT,
  MAP_COMPANION_CONTROL_EVENT,
  MAP_COMPANION_REQUEST_EVENT,
  MAP_COMPANION_SEQUENCE_REQUEST_EVENT,
  MAP_COMPANION_STARTED_EVENT,
  MAP_INTERACTION_AVAILABLE_EVENT,
  MAP_INTERACTION_COMPLETED_EVENT,
  MAP_INTERACTION_CONTROL_EVENT,
  MAP_INTERACTION_REQUEST_EVENT,
  MAP_INTERACTION_STARTED_EVENT,
  MAP_EVENT_AVAILABLE_EVENT,
  MAP_EVENT_COMPLETED_EVENT,
  MAP_EVENT_REQUEST_EVENT,
  MAP_HAZARD_CONSEQUENCE_EVENT,
  MAP_NARRATIVE_REQUEST_EVENT,
  MAP_MISSION_OUTCOME_EVENT,
  MAP_SECTOR_ENTERED_EVENT,
  MAP_SPECIES_IDENTIFIED_EVENT,
  MAP_SEQUENCE_CUE_EVENT,
  MAP_VISIBLE_SPECIES_CHANGED_EVENT,
  MAP_YIELD_AVAILABLE_EVENT,
  MAP_YIELD_REACTION_EVENT,
  MAP_YIELD_REQUEST_EVENT,
  MAP_CONTEXT_MENU_REQUESTED_EVENT,
  MAP_CONTEXT_MENU_CONTROL_EVENT,
  type MapInteractionPresentation,
  type MapCompanionPresentation,
} from '../domain/maps/createTechnicalPhaserGame.js';
import { loadAdventureMapBundle } from '../domain/maps/loadAdventureBundle.js';
import {
  beginBrowserCamphorPrologue,
  applyBrowserHazardConsequence,
  advanceBrowserMissionFlow,
  resolveBrowserMissionFailure,
  checkpointBrowserMissionConversation,
  chooseBrowserCamphorStarter,
  completeBrowserCamphorPrologueScene,
  enterBrowserMissionFlowExpedition,
  getBrowserPokeVoiceSave,
  getBrowserMissionFlowState,
  executeBrowserCompanionBehavior,
  completeBrowserExpeditionInteraction,
  completeBrowserMapEventTrigger,
  enterBrowserMapEventSector,
  reachBrowserCamphorStarterChoice,
  resolveBrowserCamphorRescue,
} from '../store/browserPokeVoiceSaveStore.js';
import { browserDiscoveryStore } from '../store/browserDiscoveryStore.js';
import { captureLocalAcousticExpression } from '../services/captureLocalAcousticExpression.js';
import type { AcousticExpressionFeatures } from '../domain/expeditions/expressionTriggers.js';
import type {
  ExpeditionExpressionTriggerV3,
  ExpeditionInteractionV3,
  HazardConsequenceV1,
  MapEventTriggerV3,
  NarrativeSequenceV1,
  NarrativeConversationV1,
  MissionFlowNodeV2,
} from '../../packages/contracts/src/index.js';
import {
  stopContinuedNarrativeAudio,
  VisualNovelPlayer,
} from './VisualNovelPlayer.js';
import { getNarrativeConversation } from '../data/narrative/narrativeCatalog.js';
import { getAdventureMapEntry } from '../data/adventure/adventureMapCatalog.js';
import { buildNarrativeTokenValues } from '../domain/narrative/visualNovel.js';
import { completeBrowserMissionDefinition } from '../store/browserPokeVoiceSaveStore.js';
import type { PokemonCatalogRecord } from '../domain/catalog/pokemonCatalogModel.js';
import {
  createCompanionCatalogSpecies,
  getCompanionCandidates,
} from '../domain/companions/companionCandidates.js';
import {
  listAvailableCompanionBehaviors,
  listMatchingCompanionBehaviors,
} from '../domain/expeditions/companionBehavior.js';
import { getPokeDiscoverRewardPackage } from '../data/adventure/rewardBalance.js';
import { POKE_DISCOVER_FIELD_TOOLS } from '../data/adventure/pokeDiscoverShop.js';
import { resolveExpeditionCapabilities } from '../domain/expeditions/expeditionCapabilities.js';
import { listRequirementEligibleMapEventTriggers } from '../domain/expeditions/mapEventTriggers.js';
import { getPokeDiscoverMission } from '../data/adventure/missionCatalog.js';

export interface MapExpressionFeedback {
  status: 'resolved' | 'alreadyResolved' | 'ineligible' | 'methodUnavailable' | 'notMatched';
  understoodText?: string;
  message: string;
  acoustic?: AcousticExpressionFeatures;
  nonce: number;
}

const PREVIEW_ADVENTURE_PATH = 'assets/adventure/maps/tegueste-forest/tegueste-forest.adventure.json';
export const TEGUESTE_FOREST_PREVIEW_MAP_ID = 'map:tegueste:camphor-forest';
export const TEGUESTE_FOREST_PREVIEW_SECTOR_ID = 'sector:tegueste-forest:02-04';

export function MapConceptPreview({
  open,
  adventurePath = PREVIEW_ADVENTURE_PATH,
  routeSectorId,
  listening,
  speechSupported,
  onMic,
  onSubmitText,
  onVisibleSpeciesIdsChange,
  onInteractionStart,
  onExpressionStart,
  onExpressionEnd,
  onExpressionFallback,
  onExpressionAcoustic,
  expressionFeedback,
  loadingText,
  catalog,
  onClose,
  onMissionFailed,
}: {
  open: boolean;
  adventurePath?: string;
  routeSectorId?: string;
  listening: boolean;
  speechSupported: boolean;
  onMic: () => void;
  onSubmitText: (value: string) => boolean | Promise<boolean>;
  onVisibleSpeciesIdsChange: (speciesIds: number[]) => void;
  onInteractionStart: () => void;
  onExpressionStart: (trigger: ExpeditionExpressionTriggerV3) => void;
  onExpressionEnd: () => void;
  onExpressionFallback: () => void;
  onExpressionAcoustic: (features: AcousticExpressionFeatures) => void;
  expressionFeedback?: MapExpressionFeedback | null;
  loadingText: string;
  catalog: readonly PokemonCatalogRecord[];
  onClose: () => void;
  onMissionFailed: (failureNarrativeSequenceId?: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const bundleRef = useRef<Awaited<ReturnType<typeof loadAdventureMapBundle>> | undefined>(undefined);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [writtenName, setWrittenName] = useState('');
  const [availableInteraction, setAvailableInteraction] = useState<ExpeditionInteractionV3>();
  const [availableExpression, setAvailableExpression] = useState<ExpeditionExpressionTriggerV3>();
  const [availableMapEvent, setAvailableMapEvent] = useState<MapEventTriggerV3>();
  const [availableYield, setAvailableYield] = useState<{ actorId: string; prompt: string }>();
  const [yieldReaction, setYieldReaction] = useState<{ speakerName?: string; text: string }>();
  const yieldReactionTimerRef = useRef<number | undefined>(undefined);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  useEffect(() => {
    hostRef.current?.dispatchEvent(new CustomEvent(MAP_CONTEXT_MENU_CONTROL_EVENT, {
      detail: { open: contextMenuOpen },
    }));
  }, [contextMenuOpen]);
  const [activeExpression, setActiveExpression] = useState<ExpeditionExpressionTriggerV3>();
  const [acousticStatus, setAcousticStatus] = useState<'idle' | 'requesting' | 'listening' | 'error'>('idle');
  const [acousticProgress, setAcousticProgress] = useState(0);
  const [acousticError, setAcousticError] = useState<string>();
  const acousticAbortRef = useRef<AbortController | undefined>(undefined);
  const [interactionPresentation, setInteractionPresentation] = useState<MapInteractionPresentation>();
  const [dialoguePageId, setDialoguePageId] = useState<string>();
  const [companionAvailable, setCompanionAvailable] = useState(false);
  const [companionPresentation, setCompanionPresentation] = useState<MapCompanionPresentation>();
  const [storyCueId, setStoryCueId] = useState<string>();
  const [hazardFailure, setHazardFailure] = useState<{
    sequence: NarrativeSequenceV1;
    pageId: string;
  }>();
  const [mapNarrative, setMapNarrative] = useState<{
    sequence: NarrativeSequenceV1;
    pageId: string;
  }>();
  const [flowConversation, setFlowConversation] = useState<NarrativeConversationV1>();
  const [flowTravel, setFlowTravel] = useState<Extract<MissionFlowNodeV2, { kind: 'travel' }>>();
  const [hazardConversation, setHazardConversation] = useState<NarrativeConversationV1>();
  const hazardConversationIdRef = useRef<string | undefined>(undefined);
  const flowMissionId = getBrowserPokeVoiceSave().activeExpeditionSession?.missionId;
  const flowCheckpoint = flowConversation && flowMissionId
    ? getBrowserPokeVoiceSave().pokeDiscover.missionProgressById?.[flowMissionId]?.conversationCheckpoint
    : undefined;
  const matchingFlowCheckpoint = flowCheckpoint?.conversationId === flowConversation?.conversationId
    ? flowCheckpoint
    : undefined;

  const advanceFlow = useCallback(async (outcomeId?: string) => {
    const activeMissionId = getBrowserPokeVoiceSave().activeExpeditionSession?.missionId;
    if (!activeMissionId || getPokeDiscoverMission(activeMissionId)?.schemaVersion !== 2) return;
    let result = advanceBrowserMissionFlow(outcomeId);
    while (result?.node?.kind === 'condition' || result?.node?.kind === 'effect') {
      result = advanceBrowserMissionFlow();
    }
    if (!result?.node) return;
    if (result.node.kind === 'conversation') {
      setFlowTravel(undefined);
      const conversation = await getNarrativeConversation(result.node.conversationId);
      if (conversation) setFlowConversation(conversation);
      return;
    }
    setFlowConversation(undefined);
    if (result.node.kind === 'travel') {
      setFlowTravel(result.node);
      return;
    }
    setFlowTravel(undefined);
    if (result.node.kind === 'terminal') {
      stopContinuedNarrativeAudio();
      if (result.node.result === 'failure') {
        resolveBrowserMissionFailure(result.mission.missionId);
        onMissionFailed();
      }
      else completeBrowserMissionDefinition(result.mission, new Date().toISOString());
      return;
    }
    if (result.node.kind === 'expedition') {
      enterBrowserMissionFlowExpedition(result.node.mapId);
      const sectorId = result.node.entrySectorId
        ?? getAdventureMapEntry(result.node.mapId)?.sectors[0]?.sectorId
        ?? '';
      window.location.hash = `#/expeditions/${encodeURIComponent(result.node.mapId)}/${encodeURIComponent(sectorId)}`;
    }
  }, [onMissionFailed]);

  const requestMapSequence = useCallback((sequenceId: string) => {
    window.setTimeout(() => hostRef.current?.dispatchEvent(new CustomEvent(MAP_COMPANION_SEQUENCE_REQUEST_EVENT, {
      detail: { sequenceId },
    })), 0);
  }, []);

  const chooseStarter = useCallback((speciesId: 1 | 4 | 7) => {
    chooseBrowserCamphorStarter(speciesId);
    beginBrowserCamphorPrologue();
    setStoryCueId(undefined);
    const slug = speciesId === 1 ? 'bulbasaur' : speciesId === 4 ? 'charmander' : 'squirtle';
    requestMapSequence(`sequence:camphor-prologue:starter-${slug}-rescue`);
  }, [requestMapSequence]);

  const requestCompanionRescue = useCallback(() => {
    setStoryCueId(undefined);
    requestMapSequence('sequence:camphor-prologue:companion-rescue');
  }, [requestMapSequence]);

  const focusRuntime = useCallback(() => {
    window.requestAnimationFrame(() => hostRef.current?.focus({ preventScroll: true }));
  }, []);

  const finishCompanionConversation = useCallback((triggerId?: string) => {
    hostRef.current?.dispatchEvent(new CustomEvent(MAP_COMPANION_CONTROL_EVENT, {
      detail: triggerId ? { command: 'execute', triggerId } : { command: 'dismiss' },
    }));
    setCompanionPresentation(undefined);
  }, []);

  const finishDialogue = useCallback((completed: boolean) => {
    hostRef.current?.dispatchEvent(new CustomEvent(MAP_INTERACTION_CONTROL_EVENT, {
      detail: { command: completed ? 'complete' : 'dismiss' },
    }));
    setInteractionPresentation(undefined);
    setDialoguePageId(undefined);
  }, []);

  const submitWrittenName = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = writtenName.trim();
    if (value) {
      await onSubmitText(value);
      setWrittenName('');
    }
    focusRuntime();
  };

  const toggleMicAndFocusRuntime = useCallback(() => {
    onMic();
    focusRuntime();
  }, [focusRuntime, onMic]);

  const finishExpression = useCallback((completed: boolean) => {
    acousticAbortRef.current?.abort();
    acousticAbortRef.current = undefined;
    hostRef.current?.dispatchEvent(new CustomEvent(MAP_EXPRESSION_CONTROL_EVENT, {
      detail: { command: completed ? 'complete' : 'dismiss' },
    }));
    setActiveExpression(undefined);
    setAcousticStatus('idle');
    setAcousticProgress(0);
    setAcousticError(undefined);
    onExpressionEnd();
  }, [onExpressionEnd]);

  const captureAcoustic = useCallback(async () => {
    if (!activeExpression || acousticStatus === 'requesting' || acousticStatus === 'listening') return;
    if (listening) onMic();
    const controller = new AbortController();
    acousticAbortRef.current = controller;
    setAcousticStatus('requesting');
    setAcousticProgress(0);
    setAcousticError(undefined);
    try {
      const features = await captureLocalAcousticExpression({
        signal: controller.signal,
        onProgress: elapsedMs => {
          setAcousticStatus('listening');
          setAcousticProgress(Math.min(1, elapsedMs / 1800));
        },
      });
      if (!controller.signal.aborted) {
        setAcousticStatus('idle');
        setAcousticProgress(1);
        onExpressionAcoustic(features);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setAcousticStatus('error');
      setAcousticError(error instanceof Error ? error.message : 'No se pudo analizar el sonido.');
    } finally {
      if (acousticAbortRef.current === controller) acousticAbortRef.current = undefined;
    }
  }, [acousticStatus, activeExpression, listening, onExpressionAcoustic, onMic]);

  useEffect(() => () => acousticAbortRef.current?.abort(), []);

  useEffect(() => {
    if (!activeExpression || !expressionFeedback) return;
    if (expressionFeedback.status === 'resolved' || expressionFeedback.status === 'alreadyResolved') {
      const timer = window.setTimeout(() => finishExpression(true), 900);
      return () => window.clearTimeout(timer);
    }
  }, [activeExpression, expressionFeedback, finishExpression]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (companionPresentation) finishCompanionConversation();
      else if (interactionPresentation) finishDialogue(false);
      else if (activeExpression) finishExpression(false);
      else if (contextMenuOpen) setContextMenuOpen(false);
      else onClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [activeExpression, companionPresentation, contextMenuOpen, finishCompanionConversation, finishDialogue, finishExpression, interactionPresentation, onClose, open]);

  useEffect(() => {
    if (!open || !interactionPresentation) return undefined;
    const advanceOnKeyboard = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      if ((event.target as HTMLElement | null)?.closest('button, input, form')) return;
      event.preventDefault();
      const page = interactionPresentation.dialogue.pages.find(candidate => candidate.pageId === dialoguePageId);
      if (page?.nextPageId) setDialoguePageId(page.nextPageId);
      else finishDialogue(true);
    };
    document.addEventListener('keydown', advanceOnKeyboard);
    return () => document.removeEventListener('keydown', advanceOnKeyboard);
  }, [dialoguePageId, finishDialogue, interactionPresentation, open]);

  useEffect(() => {
    if (!open || !hostRef.current) return undefined;
    let cancelled = false;
    let game: import('phaser').Game | undefined;
    const host = hostRef.current;
    const interactionAvailable = (event: Event) => {
      const detail = (event as CustomEvent<{ interaction?: ExpeditionInteractionV3 }>).detail;
      setAvailableInteraction(detail?.interaction);
    };
    const yieldAvailable = (event: Event) => {
      const detail = (event as CustomEvent<{ actorId?: string; prompt?: string }>).detail;
      setAvailableYield(detail?.actorId ? { actorId: detail.actorId, prompt: detail.prompt ?? 'Pedir paso' } : undefined);
      if (!detail?.actorId) setContextMenuOpen(false);
    };
    const contextMenuRequested = () => setContextMenuOpen(true);
    const yieldReactionStarted = (event: Event) => {
      const dialogueId = (event as CustomEvent<{ dialogueId?: string }>).detail?.dialogueId;
      const dialogue = dialogueId
        ? bundleRef.current?.adventure.dialogues?.find(candidate => candidate.dialogueId === dialogueId)
        : undefined;
      const page = dialogue?.pages.find(candidate => candidate.pageId === dialogue.initialPageId);
      setYieldReaction(page
        ? { speakerName: page.speakerName, text: page.text }
        : { text: 'Se aparta para dejarte pasar.' });
      if (yieldReactionTimerRef.current !== undefined) window.clearTimeout(yieldReactionTimerRef.current);
      yieldReactionTimerRef.current = window.setTimeout(() => setYieldReaction(undefined), 1_800);
    };
    const interactionStarted = (event: Event) => {
      const detail = (event as CustomEvent<MapInteractionPresentation>).detail;
      if (!detail) return;
      onInteractionStart();
      setAvailableInteraction(undefined);
      setInteractionPresentation(detail);
      setDialoguePageId(detail.dialogue.initialPageId);
    };
    const expressionAvailable = (event: Event) => {
      const detail = (event as CustomEvent<{ trigger?: ExpeditionExpressionTriggerV3 }>).detail;
      setAvailableExpression(detail?.trigger);
    };
    const expressionStarted = (event: Event) => {
      const trigger = (event as CustomEvent<{ trigger?: ExpeditionExpressionTriggerV3 }>).detail?.trigger;
      if (!trigger) return;
      onExpressionStart(trigger);
      setAvailableExpression(undefined);
      setActiveExpression(trigger);
      setWrittenName('');
      setAcousticStatus('idle');
      setAcousticProgress(0);
      setAcousticError(undefined);
    };
    const companionAvailableChanged = (event: Event) => {
      setCompanionAvailable(Boolean((event as CustomEvent<{ available?: boolean }>).detail?.available));
    };
    const companionStarted = (event: Event) => {
      const presentation = (event as CustomEvent<MapCompanionPresentation>).detail;
      if (!presentation) return;
      onInteractionStart();
      setCompanionAvailable(false);
      setCompanionPresentation(presentation);
    };
    const companionBehaviorCompleted = (event: Event) => {
      const triggerId = (event as CustomEvent<{ triggerId?: string }>).detail?.triggerId;
      if (!triggerId) return;
      const save = getBrowserPokeVoiceSave();
      const selection = save.activeExpeditionSession?.loadout?.companion;
      const candidate = getCompanionCandidates(catalog, save).find(item => (
        item.form.formId === selection?.formId && item.appearance?.appearanceId === selection?.appearanceId
      ));
      const trigger = bundleRef.current?.adventure.behaviorTriggers.find(item => item.triggerId === triggerId);
      if (!candidate || !trigger) return;
      const expeditionCapabilities = resolveExpeditionCapabilities(save, {
        companionForm: candidate.form,
        tools: POKE_DISCOVER_FIELD_TOOLS,
      });
      executeBrowserCompanionBehavior({
        mapId: bundleRef.current!.adventure.mapId,
        trigger,
        companionForm: candidate.form,
        species: catalog.map(createCompanionCatalogSpecies),
        expeditionCapabilities,
        executedAt: new Date().toISOString(),
        rewards: getPokeDiscoverRewardPackage(trigger.rewardPackageId),
      });
    };
    const visibleSpeciesChanged = (event: Event) => {
      const speciesIds = (event as CustomEvent<{ speciesIds?: number[] }>).detail?.speciesIds;
      if (speciesIds) onVisibleSpeciesIdsChange(speciesIds);
    };
    const sequenceCue = (event: Event) => {
      const cueId = (event as CustomEvent<{ cueId?: string }>).detail?.cueId;
      if (!cueId) return;
      if (cueId === 'cue:camphor-prologue:starter-choice') {
        if (getBrowserPokeVoiceSave().pendingMissionLaunch?.checkpoint === 'openingCinematic') {
          reachBrowserCamphorStarterChoice();
        }
        setStoryCueId(cueId);
        return;
      }
      if (cueId === 'cue:camphor-prologue:rescue') {
        setStoryCueId(cueId);
        return;
      }
      if (cueId === 'cue:camphor-prologue:rescued') {
        resolveBrowserCamphorRescue();
        setStoryCueId(undefined);
        requestMapSequence('sequence:camphor-prologue:aftermath');
        return;
      }
      if (cueId === 'cue:camphor-prologue:complete') {
        completeBrowserCamphorPrologueScene();
        setStoryCueId(cueId);
      }
    };
    const interactionCompleted = (event: Event) => {
      const interaction = (event as CustomEvent<{ interaction?: ExpeditionInteractionV3 }>).detail?.interaction;
      if (!interaction || !getBrowserPokeVoiceSave().activeExpeditionSession) return;
      completeBrowserExpeditionInteraction({
        mapId: bundleRef.current!.adventure.mapId,
        interaction,
      });
    };
    const mapEventAvailable = (event: Event) => {
      const trigger = (event as CustomEvent<{ trigger?: MapEventTriggerV3 }>).detail?.trigger;
      setAvailableMapEvent(trigger);
    };
    const mapEventCompleted = (event: Event) => {
      const trigger = (event as CustomEvent<{ trigger?: MapEventTriggerV3 }>).detail?.trigger;
      const mapId = bundleRef.current?.adventure.mapId;
      if (!trigger || !mapId || !getBrowserPokeVoiceSave().activeExpeditionSession) return;
      completeBrowserMapEventTrigger(mapId, trigger, {
        completedAt: new Date().toISOString(),
        rewards: getPokeDiscoverRewardPackage(trigger.rewardPackageId),
      });
      setAvailableMapEvent(undefined);
    };
    const sectorEntered = (event: Event) => {
      const sectorId = (event as CustomEvent<{ sectorId?: string }>).detail?.sectorId;
      const mapId = bundleRef.current?.adventure.mapId;
      if (!sectorId || !mapId || !getBrowserPokeVoiceSave().activeExpeditionSession) return;
      enterBrowserMapEventSector(mapId, sectorId);
    };
    const hazardConsequence = (event: Event) => {
      const consequence = (event as CustomEvent<{
        consequence?: HazardConsequenceV1;
      }>).detail?.consequence;
      if (!consequence) return;
      const activeMissionId = getBrowserPokeVoiceSave().activeExpeditionSession?.missionId;
      const activeMission = activeMissionId
        ? bundleRef.current?.missionDocument?.missions
          .find(mission => mission.missionId === activeMissionId)
        : undefined;
      const missionFailureSequenceId = activeMission?.schemaVersion === 1
        ? activeMission.narratives?.failureSequenceId
        : undefined;
      const failureSequenceId = consequence.failureNarrativeSequenceId ?? missionFailureSequenceId;
      const result = applyBrowserHazardConsequence(consequence);
      if (result.returnToMissionBoard) {
        stopContinuedNarrativeAudio();
        setFlowConversation(undefined);
        const sequence = bundleRef.current?.missionDocument?.narrativeSequences
          .find(candidate => candidate.sequenceId === failureSequenceId);
        if (sequence) {
          setHazardFailure({ sequence, pageId: sequence.initialPageId });
        } else {
          void (failureSequenceId
            ? getNarrativeConversation(failureSequenceId)
            : Promise.resolve(undefined)
          ).then(conversation => {
            if (conversation) {
              hazardConversationIdRef.current = conversation.conversationId;
              setHazardConversation(conversation);
            } else onMissionFailed(failureSequenceId);
          });
        }
      }
    };
    const narrativeRequested = (event: Event) => {
      const sequenceId = (event as CustomEvent<{ sequenceId?: string }>).detail?.sequenceId;
      const sequence = bundleRef.current?.missionDocument?.narrativeSequences
        .find(candidate => candidate.sequenceId === sequenceId);
      if (!sequence) return;
      setMapNarrative({ sequence, pageId: sequence.initialPageId });
      host.dispatchEvent(new CustomEvent(MAP_AMBIENT_CONTROL_EVENT, {
        detail: { command: 'pause' },
      }));
    };
    const missionOutcome = (event: Event) => {
      const outcomeId = (event as CustomEvent<{ outcomeId?: string }>).detail?.outcomeId;
      if (outcomeId) void advanceFlow(outcomeId);
    };
    host.addEventListener(MAP_INTERACTION_AVAILABLE_EVENT, interactionAvailable);
    host.addEventListener(MAP_INTERACTION_STARTED_EVENT, interactionStarted);
    host.addEventListener(MAP_INTERACTION_COMPLETED_EVENT, interactionCompleted);
    host.addEventListener(MAP_EXPRESSION_AVAILABLE_EVENT, expressionAvailable);
    host.addEventListener(MAP_EXPRESSION_STARTED_EVENT, expressionStarted);
    host.addEventListener(MAP_COMPANION_AVAILABLE_EVENT, companionAvailableChanged);
    host.addEventListener(MAP_COMPANION_STARTED_EVENT, companionStarted);
    host.addEventListener(MAP_COMPANION_BEHAVIOR_COMPLETED_EVENT, companionBehaviorCompleted);
    host.addEventListener(MAP_SEQUENCE_CUE_EVENT, sequenceCue);
    host.addEventListener(MAP_VISIBLE_SPECIES_CHANGED_EVENT, visibleSpeciesChanged);
    host.addEventListener(MAP_EVENT_AVAILABLE_EVENT, mapEventAvailable);
    host.addEventListener(MAP_EVENT_COMPLETED_EVENT, mapEventCompleted);
    host.addEventListener(MAP_SECTOR_ENTERED_EVENT, sectorEntered);
    host.addEventListener(MAP_HAZARD_CONSEQUENCE_EVENT, hazardConsequence);
    host.addEventListener(MAP_NARRATIVE_REQUEST_EVENT, narrativeRequested);
    host.addEventListener(MAP_MISSION_OUTCOME_EVENT, missionOutcome);
    host.addEventListener(MAP_YIELD_AVAILABLE_EVENT, yieldAvailable);
    host.addEventListener(MAP_YIELD_REACTION_EVENT, yieldReactionStarted);
    host.addEventListener(MAP_CONTEXT_MENU_REQUESTED_EVENT, contextMenuRequested);
    setStatus('loading');
    host.dataset.runtime = 'loading';
    host.focus({ preventScroll: true });

    Promise.all([
      import('phaser'),
      loadAdventureMapBundle({
        adventurePath,
        baseUrl: import.meta.env.BASE_URL,
      }),
    ]).then(([Phaser, bundle]) => {
      if (cancelled) return;
      const save = getBrowserPokeVoiceSave();
      bundleRef.current = bundle;
      const activeFlowMission = save.activeExpeditionSession?.missionId
        ? getPokeDiscoverMission(save.activeExpeditionSession.missionId)
        : undefined;
      let initialFlowState = activeFlowMission?.schemaVersion === 2
        ? getBrowserMissionFlowState(activeFlowMission.missionId)
        : undefined;
      while (initialFlowState?.node.kind === 'condition' || initialFlowState?.node.kind === 'effect') {
        const advanced = advanceBrowserMissionFlow();
        initialFlowState = advanced?.node ? { ...advanced, node: advanced.node } : undefined;
      }
      if (initialFlowState?.node.kind === 'conversation') {
        void getNarrativeConversation(initialFlowState.node.conversationId).then(conversation => {
          if (!cancelled && conversation) setFlowConversation(conversation);
        });
      }
      if (initialFlowState?.node.kind === 'travel') setFlowTravel(initialFlowState.node);
      const flowEntryLocationId = initialFlowState?.node.kind === 'expedition'
        ? initialFlowState.node.entryLocationId
        : undefined;
      const mapProgress = save.pokeDiscover.mapProgress[bundle.adventure.mapId];
      const activeSession = save.activeExpeditionSession?.mapId === bundle.adventure.mapId
        ? save.activeExpeditionSession
        : undefined;
      const launchMissionId = activeSession?.missionId ?? save.pendingMissionLaunch?.missionId;
      const entryPointId = launchMissionId
        ? bundle.adventure.missionEntryPoints
          ?.find(assignment => assignment.missionId === launchMissionId)?.entryPointId
        : bundle.adventure.freeExpeditionEntryPointId;
      const initialEntryPoint = bundle.adventure.entryPoints
        ?.find(entry => entry.entryPointId === entryPointId);
      const initialSectorId = routeSectorId
        ?? initialEntryPoint?.sectorId
        ?? bundle.sectors[0]?.sector.sectorId
        ?? TEGUESTE_FOREST_PREVIEW_SECTOR_ID;
      const room = bundle.sectors.find(candidate => candidate.sector.sectorId === initialSectorId);
      const visibleSpeciesIds = [...new Set(bundle.adventure.actorPlacements
        .filter(placement => placement.sectorId === initialSectorId && placement.initiallyHidden !== true)
        .map(placement => room?.actorAssets.get(placement.assetId)?.speciesId)
        .filter((speciesId): speciesId is number => Number.isSafeInteger(speciesId)))];
      onVisibleSpeciesIdsChange(visibleSpeciesIds);
      const pendingCheckpoint = save.pendingMissionLaunch?.missionId === 'mission:tegueste:help-professor-camphor'
        ? save.pendingMissionLaunch.checkpoint
        : undefined;
      const missionCheckpoint = activeSession?.missionRuntime?.missionId === 'mission:tegueste:help-professor-camphor'
        ? activeSession.missionRuntime.checkpointId
        : undefined;
      const initialSequenceId = pendingCheckpoint === 'openingCinematic' || pendingCheckpoint === 'awaitingStarter'
        ? 'sequence:camphor-prologue:assault-with-choice'
        : missionCheckpoint === 'checkpoint:camphor-prologue:rescue'
          ? 'sequence:camphor-prologue:assault-with-companion'
          : missionCheckpoint === 'checkpoint:camphor-prologue:rescued'
            ? 'sequence:camphor-prologue:aftermath'
            : undefined;
      const selection = activeSession?.loadout?.companion
        ?? save.pokedexRun.selectedCompanion
        ?? (save.pokedexRun.selectedCompanionFormId
          ? { schemaVersion: 1 as const, formId: save.pokedexRun.selectedCompanionFormId }
          : undefined);
      const companionCandidate = selection
        ? getCompanionCandidates(catalog, save).find(item => (
          item.form.formId === selection.formId && item.appearance?.appearanceId === selection.appearanceId
        ))
        : undefined;
      const companionAsset = companionCandidate
        ? bundle.pmdManifest.assets.find(asset => asset.formId === companionCandidate.form.formId)
        : undefined;
      const runtimeCapabilities = activeSession && companionCandidate
        ? resolveExpeditionCapabilities(save, {
          companionForm: companionCandidate.form,
          tools: POKE_DISCOVER_FIELD_TOOLS,
          companionAdditionalCapabilities: companionCandidate.appearance?.additionalFieldCapabilities,
        })
        : [];
      const behaviorContext = companionCandidate ? {
        companionForm: companionCandidate.form,
        species: catalog.map(createCompanionCatalogSpecies),
        ...(activeSession ? {
          expeditionCapabilities: resolveExpeditionCapabilities(save, {
            companionForm: companionCandidate.form,
            tools: POKE_DISCOVER_FIELD_TOOLS,
          }),
        } : {}),
      } : undefined;
      const eligibleBehaviors = companionCandidate && behaviorContext
        ? (activeSession
          ? listAvailableCompanionBehaviors(
            save,
            bundle.adventure.mapId,
            bundle.adventure.behaviorTriggers,
            behaviorContext,
          )
          : listMatchingCompanionBehaviors(
            save,
            bundle.adventure.mapId,
            bundle.adventure.behaviorTriggers,
            behaviorContext,
          ))
        : [];
      const mapEventContext = {
        ...(companionCandidate ? { companionForm: companionCandidate.form } : {}),
        species: catalog.map(createCompanionCatalogSpecies),
        ...(activeSession && companionCandidate ? {
          expeditionCapabilities: resolveExpeditionCapabilities(save, {
            companionForm: companionCandidate.form,
            tools: POKE_DISCOVER_FIELD_TOOLS,
          }),
        } : {}),
      };
      const eligibleMapEvents = listRequirementEligibleMapEventTriggers(
        save,
        bundle.adventure.mapEventTriggers ?? [],
        mapEventContext,
      );
      const completedMapEventTriggerIds = new Set([
        ...(mapProgress?.completedMapEventTriggerIds ?? []),
        ...(activeSession?.completedMapEventTriggerIds ?? []),
      ]);
      const completedSectorMapEventTriggerIds = new Set(
        activeSession?.activeSectorVisit?.sectorId === initialSectorId
          ? activeSession.activeSectorVisit.completedMapEventTriggerIds
          : [],
      );
      game = createTechnicalPhaserGame({
        Phaser,
        parent: host,
        bundle,
        initialSectorId,
        initialSpawnAnchorId: initialEntryPoint?.anchorId,
        initialLocationId: flowEntryLocationId,
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        registeredSpeciesIds: new Set(save.pokedexRun.registeredSpeciesIds),
        expressionsEnabled: Boolean(activeSession),
        resolvedExpressionTriggerIds: new Set(Object.keys(mapProgress?.resolvedExpressionTriggers ?? {})),
        completedMapEventTriggerIds,
        completedSectorMapEventTriggerIds,
        eligibleMapEventTriggerIds: new Set(eligibleMapEvents.map(trigger => trigger.triggerId)),
        playerAvatarId: save.pokeDiscover.trainerProfile?.avatarId ?? 'achaman',
        playerAppearanceId: launchMissionId
          ? getPokeDiscoverMission(launchMissionId)?.playerAppearanceId
          : undefined,
        expeditionCapabilityIds: new Set(runtimeCapabilities.map(capability => capability.id)),
        companion: companionCandidate ? {
          displayName: companionCandidate.displayName,
          form: companionCandidate.form,
          asset: companionAsset,
          eligibleBehaviorTriggerIds: new Set(eligibleBehaviors.map(trigger => trigger.triggerId)),
          resolvedSecretIds: new Set(mapProgress?.unlockedSecretIds ?? []),
          freeRoam: !activeSession?.missionId,
          waterTraversal: companionCandidate.appearance?.waterTraversal
            ?? companionCandidate.formProfile.waterTraversal
            ?? { kind: 'recall' },
        } : undefined,
        initialSequenceId,
        onReady: () => {
          if (cancelled) return;
          host.dataset.runtime = 'ready';
          host.dataset.mapId = bundle.adventure.mapId;
          setStatus('ready');
          host.focus({ preventScroll: true });
        },
      });
    }).catch(error => {
      console.error('No se pudo iniciar la sector de Tegueste:', error);
      if (!cancelled) {
        host.dataset.runtime = 'error';
        setStatus('error');
      }
    });

    return () => {
      cancelled = true;
      game?.destroy(true);
      host.removeEventListener(MAP_INTERACTION_AVAILABLE_EVENT, interactionAvailable);
      host.removeEventListener(MAP_INTERACTION_STARTED_EVENT, interactionStarted);
      host.removeEventListener(MAP_INTERACTION_COMPLETED_EVENT, interactionCompleted);
      host.removeEventListener(MAP_EXPRESSION_AVAILABLE_EVENT, expressionAvailable);
      host.removeEventListener(MAP_EXPRESSION_STARTED_EVENT, expressionStarted);
      host.removeEventListener(MAP_COMPANION_AVAILABLE_EVENT, companionAvailableChanged);
      host.removeEventListener(MAP_COMPANION_STARTED_EVENT, companionStarted);
      host.removeEventListener(MAP_COMPANION_BEHAVIOR_COMPLETED_EVENT, companionBehaviorCompleted);
      host.removeEventListener(MAP_SEQUENCE_CUE_EVENT, sequenceCue);
      host.removeEventListener(MAP_VISIBLE_SPECIES_CHANGED_EVENT, visibleSpeciesChanged);
      host.removeEventListener(MAP_EVENT_AVAILABLE_EVENT, mapEventAvailable);
      host.removeEventListener(MAP_EVENT_COMPLETED_EVENT, mapEventCompleted);
      host.removeEventListener(MAP_SECTOR_ENTERED_EVENT, sectorEntered);
      host.removeEventListener(MAP_HAZARD_CONSEQUENCE_EVENT, hazardConsequence);
      host.removeEventListener(MAP_NARRATIVE_REQUEST_EVENT, narrativeRequested);
      host.removeEventListener(MAP_MISSION_OUTCOME_EVENT, missionOutcome);
      host.removeEventListener(MAP_YIELD_AVAILABLE_EVENT, yieldAvailable);
      host.removeEventListener(MAP_YIELD_REACTION_EVENT, yieldReactionStarted);
      host.removeEventListener(MAP_CONTEXT_MENU_REQUESTED_EVENT, contextMenuRequested);
      host.replaceChildren();
      onVisibleSpeciesIdsChange([]);
      setAvailableInteraction(undefined);
      setAvailableExpression(undefined);
      setAvailableMapEvent(undefined);
      setAvailableYield(undefined);
      setYieldReaction(undefined);
      if (yieldReactionTimerRef.current !== undefined) window.clearTimeout(yieldReactionTimerRef.current);
      setContextMenuOpen(false);
      setActiveExpression(undefined);
      setInteractionPresentation(undefined);
      setDialoguePageId(undefined);
      setCompanionAvailable(false);
      setCompanionPresentation(undefined);
      setStoryCueId(undefined);
      setHazardFailure(undefined);
      setMapNarrative(undefined);
      setFlowConversation(undefined);
      setHazardConversation(undefined);
      hazardConversationIdRef.current = undefined;
      bundleRef.current = undefined;
    };
  }, [adventurePath, catalog, onExpressionStart, onInteractionStart, onMissionFailed, onVisibleSpeciesIdsChange, open, requestMapSequence, routeSectorId]);

  useEffect(() => {
    if (!open || !hostRef.current) return undefined;
    const host = hostRef.current;
    let previous = new Set(browserDiscoveryStore.getSnapshot().guessedIds);
    return browserDiscoveryStore.subscribe(() => {
      const current = browserDiscoveryStore.getSnapshot().guessedIds;
      for (const speciesId of current) {
        if (!previous.has(speciesId)) {
          host.dispatchEvent(new CustomEvent(MAP_SPECIES_IDENTIFIED_EVENT, { detail: { speciesId } }));
        }
      }
      previous = new Set(current);
    });
  }, [open]);

  if (!open) return null;
  const dialoguePage = interactionPresentation?.dialogue.pages
    .find(candidate => candidate.pageId === dialoguePageId);
  const hazardFailurePage = hazardFailure?.sequence.pages
    .find(page => page.pageId === hazardFailure.pageId);
  const mapNarrativePage = mapNarrative?.sequence.pages
    .find(page => page.pageId === mapNarrative.pageId);
  const activeAcousticMatchers = activeExpression?.matchAny.filter(matcher => matcher.kind === 'acoustic') ?? [];
  const acceptsAcoustic = activeAcousticMatchers.length > 0 && activeExpression?.inputMethods.includes('voice');
  const acceptsWrittenText = activeExpression?.inputMethods.includes('text') ?? false;
  const acceptsSpokenText = Boolean(activeExpression?.inputMethods.includes('voice')
    && activeExpression.matchAny.some(matcher => matcher.kind !== 'acoustic'));
  return (
    <div className="pv-modal map-concept-preview" data-testid="map-concept-preview">
      <div className="pv-modal__backdrop" />
      <section className="pv-modal__panel map-concept-preview__panel" role="dialog" aria-modal="true" aria-labelledby="map-concept-preview-title">
        <header className="pv-modal__head">
          <h3 id="map-concept-preview-title">¡Ayuda al profesor Alcanfor!</h3>
          <button className="map-concept-preview__power" type="button" onClick={onClose}>
            <span aria-hidden="true">⏻</span>
            Abandonar misión
          </button>
        </header>
        <div className="map-concept-preview__upper-shell">
          <div className="map-concept-preview__speaker map-concept-preview__speaker--left" aria-hidden="true" />
          <div className="map-concept-preview__viewport">
            <div
              ref={hostRef}
              className="map-concept-preview__runtime"
              data-testid="technical-map-runtime"
              role="img"
              tabIndex={0}
              aria-label="Sector del Bosque de Tegueste con protagonista, Alcanfor y Pokémon animados"
            />
            {status !== 'ready' && (
              <div className="map-concept-preview__status" role="status">
                {status === 'error' ? 'No se pudo cargar el Bosque de Tegueste.' : loadingText}
              </div>
            )}
            {yieldReaction && status === 'ready' && (
              <div className="map-concept-preview__yield-reaction" role="status" aria-live="polite">
                {yieldReaction.speakerName ? <strong>{yieldReaction.speakerName}</strong> : null}
                <span>{yieldReaction.text}</span>
              </div>
            )}
            {hazardFailure && hazardFailurePage ? (
              <section className="map-concept-preview__dialogue" role="dialog" aria-label="La expedición ha fracasado">
                <strong>{hazardFailurePage.speakerName}</strong>
                <p>{hazardFailurePage.text}</p>
                <button type="button" autoFocus onClick={() => {
                  if (hazardFailurePage.nextPageId) {
                    setHazardFailure({
                      sequence: hazardFailure.sequence,
                      pageId: hazardFailurePage.nextPageId,
                    });
                  } else {
                    const sequenceId = hazardFailure.sequence.sequenceId;
                    setHazardFailure(undefined);
                    onMissionFailed(sequenceId);
                  }
                }}>{hazardFailurePage.nextPageId ? 'Siguiente' : 'Volver a PokeDiscover'}</button>
              </section>
            ) : null}
            {mapNarrative && mapNarrativePage ? (
              <section className="map-concept-preview__dialogue" role="dialog" aria-label={`Conversación con ${mapNarrativePage.speakerName}`}>
                <strong>{mapNarrativePage.speakerName}</strong>
                <p>{mapNarrativePage.text}</p>
                <button type="button" autoFocus onClick={() => {
                  if (mapNarrativePage.nextPageId) {
                    setMapNarrative({
                      sequence: mapNarrative.sequence,
                      pageId: mapNarrativePage.nextPageId,
                    });
                  } else {
                    setMapNarrative(undefined);
                    hostRef.current?.dispatchEvent(new CustomEvent(MAP_AMBIENT_CONTROL_EVENT, {
                      detail: { command: 'resume' },
                    }));
                  }
                }}>{mapNarrativePage.nextPageId ? 'Siguiente' : 'Terminar'}</button>
              </section>
            ) : null}
            {flowConversation && bundleRef.current?.mediaManifest ? (
              <div className="map-concept-preview__visual-novel">
                <VisualNovelPlayer
                  conversation={flowConversation}
                  mediaManifest={bundleRef.current.mediaManifest}
                  pmdManifest={bundleRef.current.pmdManifest}
                  initialCueId={matchingFlowCheckpoint?.cueId}
                  initialHistoryCueIds={matchingFlowCheckpoint?.historyCueIds}
                  initialSelectedChoices={matchingFlowCheckpoint?.selectedChoices}
                  initialVariables={matchingFlowCheckpoint?.variables}
                  initialExecutedEffectIds={matchingFlowCheckpoint?.executedEffectIds}
                  initiallyReadCueIds={getBrowserPokeVoiceSave().pokeDiscover.narrativeProgress.readCueIds}
                  tokenValues={buildNarrativeTokenValues(getBrowserPokeVoiceSave())}
                  onCheckpoint={checkpointBrowserMissionConversation}
                  onComplete={outcome => void advanceFlow(outcome)}
                />
              </div>
            ) : null}
            {flowTravel ? (
              <section className="map-concept-preview__story-choice" role="dialog" aria-modal="true" aria-label="Viaje de misión">
                <strong>Nuevo destino</strong>
                <p>{flowTravel.prompt}</p>
                <div>
                  <button type="button" onClick={() => void advanceFlow('accept')}>{flowTravel.acceptLabel}</button>
                  <button type="button" onClick={() => setFlowTravel(undefined)}>{flowTravel.postponeLabel}</button>
                </div>
              </section>
            ) : null}
            {hazardConversation && bundleRef.current?.mediaManifest ? (
              <div className="map-concept-preview__visual-novel">
                <VisualNovelPlayer
                  conversation={hazardConversation}
                  mediaManifest={bundleRef.current.mediaManifest}
                  pmdManifest={bundleRef.current.pmdManifest}
                  tokenValues={buildNarrativeTokenValues(getBrowserPokeVoiceSave())}
                  onComplete={() => {
                    const conversationId = hazardConversationIdRef.current;
                    setHazardConversation(undefined);
                    hazardConversationIdRef.current = undefined;
                    onMissionFailed(conversationId);
                  }}
                />
              </div>
            ) : null}
            {storyCueId === 'cue:camphor-prologue:starter-choice' && (
              <section className="map-concept-preview__story-choice" role="dialog" aria-label="Elegir primer compañero">
                <strong>¡Las Poké Balls de Alcanfor han caído!</strong>
                <p>Elige rápidamente quién te ayudará en el rescate.</p>
                <div>
                  <button type="button" onClick={() => chooseStarter(1)}><span aria-hidden="true">●</span>Bulbasaur</button>
                  <button type="button" onClick={() => chooseStarter(4)}><span aria-hidden="true">●</span>Charmander</button>
                  <button type="button" onClick={() => chooseStarter(7)}><span aria-hidden="true">●</span>Squirtle</button>
                </div>
              </section>
            )}
            {storyCueId === 'cue:camphor-prologue:rescue' && (
              <section className="map-concept-preview__story-choice" role="dialog" aria-label="Rescatar al profesor Alcanfor">
                <strong>Los Rattata han rodeado a Alcanfor</strong>
                <p>Tu compañero espera tu señal.</p>
                <button type="button" onClick={requestCompanionRescue}>¡Ayuda a Alcanfor!</button>
              </section>
            )}
            {storyCueId === 'cue:camphor-prologue:complete' && (
              <section className="map-concept-preview__story-choice map-concept-preview__story-choice--complete" role="status">
                <strong>¡Rescate completado!</strong>
                <p>Los científicos despejan el sendero y un Pineco cae del árbol durante la retirada.</p>
                <button type="button" onClick={() => setStoryCueId(undefined)}>Explorar el bosque</button>
              </section>
            )}
            {contextMenuOpen && availableYield && !interactionPresentation && (
              <section className="map-concept-preview__context-menu" role="dialog" aria-label="Acciones disponibles">
                <strong>¿Qué quieres hacer?</strong>
                <button type="button" autoFocus onClick={() => {
                  hostRef.current?.dispatchEvent(new CustomEvent(MAP_YIELD_REQUEST_EVENT, { detail: { actorId: availableYield.actorId } }));
                  setContextMenuOpen(false);
                }}>{availableYield.prompt}</button>
                {availableMapEvent?.activation.kind === 'contextAction' ? <button type="button" onClick={() => {
                  hostRef.current?.dispatchEvent(new CustomEvent(MAP_EVENT_REQUEST_EVENT, { detail: { triggerId: availableMapEvent.triggerId } }));
                  setContextMenuOpen(false);
                }}>{availableMapEvent.activation.prompt}</button> : null}
                {availableInteraction ? <button type="button" onClick={() => {
                  hostRef.current?.dispatchEvent(new CustomEvent(MAP_INTERACTION_REQUEST_EVENT, { detail: { interactionId: availableInteraction.interactionId } }));
                  setContextMenuOpen(false);
                }}>{availableInteraction.prompt}</button> : null}
                {availableExpression ? <button type="button" onClick={() => {
                  hostRef.current?.dispatchEvent(new CustomEvent(MAP_EXPRESSION_REQUEST_EVENT, { detail: { triggerId: availableExpression.triggerId } }));
                  setContextMenuOpen(false);
                }}>{availableExpression.prompt}</button> : null}
                {companionAvailable ? <button type="button" onClick={() => {
                  hostRef.current?.dispatchEvent(new CustomEvent(MAP_COMPANION_REQUEST_EVENT));
                  setContextMenuOpen(false);
                }}>Hablar con tu compañero</button> : null}
                <button type="button" onClick={() => setContextMenuOpen(false)}>Cancelar</button>
              </section>
            )}
            {availableYield && !contextMenuOpen && !interactionPresentation && !availableMapEvent && !availableInteraction && !availableExpression && !companionAvailable && (
              <button className="map-concept-preview__interaction-prompt" type="button" onClick={() => hostRef.current?.dispatchEvent(new CustomEvent(MAP_YIELD_REQUEST_EVENT, { detail: { actorId: availableYield.actorId } }))}>
                <kbd>E</kbd>{availableYield.prompt}
              </button>
            )}
            {availableYield && !contextMenuOpen && !interactionPresentation && (availableMapEvent || availableInteraction || availableExpression || companionAvailable) && (
              <button className="map-concept-preview__interaction-prompt" type="button" onClick={() => setContextMenuOpen(true)}>
                <kbd>E</kbd>Acciones
              </button>
            )}
            {!availableYield && availableMapEvent?.activation.kind === 'contextAction' && !interactionPresentation && (
              <button
                className="map-concept-preview__interaction-prompt"
                type="button"
                onClick={() => hostRef.current?.dispatchEvent(new CustomEvent(MAP_EVENT_REQUEST_EVENT, {
                  detail: { triggerId: availableMapEvent.triggerId },
                }))}
              >
                <kbd>E</kbd>
                {availableMapEvent.activation.prompt}
              </button>
            )}
            {!availableYield && availableInteraction && !availableMapEvent && !interactionPresentation && (
              <button
                className="map-concept-preview__interaction-prompt"
                type="button"
                onClick={() => hostRef.current?.dispatchEvent(new CustomEvent(MAP_INTERACTION_REQUEST_EVENT, {
                  detail: { interactionId: availableInteraction.interactionId },
                }))}
              >
                <kbd>E</kbd>
                {availableInteraction.prompt}
              </button>
            )}
            {!availableYield && availableExpression && !availableMapEvent && !availableInteraction && !interactionPresentation && !activeExpression && (
              <button
                className="map-concept-preview__interaction-prompt map-concept-preview__interaction-prompt--expression"
                type="button"
                onClick={() => hostRef.current?.dispatchEvent(new CustomEvent(MAP_EXPRESSION_REQUEST_EVENT, {
                  detail: { triggerId: availableExpression.triggerId },
                }))}
              >
                <kbd>E</kbd>
                {availableExpression.prompt}
              </button>
            )}
            {!availableYield && companionAvailable && !availableMapEvent && !availableInteraction && !availableExpression && !interactionPresentation && !activeExpression && !companionPresentation && (
              <button
                className="map-concept-preview__interaction-prompt map-concept-preview__interaction-prompt--companion"
                type="button"
                onClick={() => hostRef.current?.dispatchEvent(new CustomEvent(MAP_COMPANION_REQUEST_EVENT))}
              >
                <kbd>E</kbd>
                Hablar con tu compañero
              </button>
            )}
            {activeExpression && (
              <section className="map-concept-preview__expression" aria-label="Interacción expresiva" aria-live="polite">
                <strong>{activeExpression.prompt}</strong>
                <p>
                  {expressionFeedback?.understoodText
                    ? `He entendido: “${expressionFeedback.understoodText}”. ${expressionFeedback.message}`
                    : expressionFeedback?.message ?? (acceptsAcoustic
                      ? 'Pulsa «Escuchar sonido» cuando estés preparado. El análisis dura menos de dos segundos.'
                      : 'Puedes hablar, escribir o usar la alternativa accesible.')}
                </p>
                {expressionFeedback?.acoustic && (
                  <small>
                    Volumen {Math.round((expressionFeedback.acoustic.loudness ?? 0) * 100)}%
                    {' · '}{(expressionFeedback.acoustic.durationMs ?? 0) / 1000}s
                    {expressionFeedback.acoustic.sustainedNote ? ' · nota estable' : ''}
                    {expressionFeedback.acoustic.simpleHum ? ' · tarareo' : ''}
                  </small>
                )}
                {acousticError && <small className="is-error">{acousticError}</small>}
              </section>
            )}
            {interactionPresentation && dialoguePage && (
              <section
                className="map-concept-preview__dialogue"
                role="dialog"
                aria-label={`Conversación con ${dialoguePage.speakerName}`}
              >
                <strong>{dialoguePage.speakerName}</strong>
                <p aria-live="polite">{dialoguePage.text}</p>
                <button type="button" autoFocus onClick={() => {
                  if (dialoguePage.nextPageId) setDialoguePageId(dialoguePage.nextPageId);
                  else finishDialogue(true);
                }}>
                  {dialoguePage.nextPageId ? 'Siguiente' : 'Terminar'}
                </button>
              </section>
            )}
            {companionPresentation && (
              <section className="map-concept-preview__dialogue map-concept-preview__companion-dialogue" role="dialog" aria-label={`Hablar con ${companionPresentation.displayName}`}>
                <strong>{companionPresentation.displayName}</strong>
                {companionPresentation.behaviors.length ? (
                  <>
                    <p>¿Qué quieres pedirle?</p>
                    <div className="map-concept-preview__companion-actions">
                      {companionPresentation.behaviors.map(behavior => (
                        <button key={behavior.triggerId} type="button" onClick={() => finishCompanionConversation(behavior.triggerId)}>
                          <span>{behavior.actionLabel ?? 'Investigar los alrededores'}</span>
                          {behavior.loreHint && <small>{behavior.loreHint}</small>}
                        </button>
                      ))}
                    </div>
                  </>
                ) : <p>Te mira con atención. Parece feliz de viajar contigo.</p>}
                <button type="button" onClick={() => finishCompanionConversation()}>
                  {companionPresentation.behaviors.length ? 'Cancelar' : 'Seguir explorando'}
                </button>
              </section>
            )}
          </div>
          <div className="map-concept-preview__speaker map-concept-preview__speaker--right" aria-hidden="true" />
        </div>
        <div className="map-concept-preview__hinge" aria-hidden="true"><span /><span /></div>
        <div className="map-concept-preview__lower-shell">
          <div
            className="map-concept-preview__direction-decoration"
            data-control-decoration="direction-pad"
            aria-hidden="true"
          ><i /><i /></div>
          <form className="map-concept-preview__touchscreen" onSubmit={submitWrittenName}>
            {(!activeExpression || acceptsWrittenText) && (
              <label className="map-concept-preview__hidden-label" htmlFor="map-pokemon-name">
                {activeExpression ? 'Frase para la interacción' : 'Nombre del Pokémon visible'}
              </label>
            )}
            {(!activeExpression || acceptsWrittenText) && (
              <input
                id="map-pokemon-name"
                className="map-concept-preview__name-input"
                type="text"
                value={writtenName}
                placeholder={activeExpression ? 'Dile algo…' : 'Nombre…'}
                autoComplete="off"
                onChange={event => setWrittenName(event.target.value)}
                onKeyDown={event => {
                  event.stopPropagation();
                  if (event.key === 'Escape') focusRuntime();
                }}
              />
            )}
            {(!activeExpression || acceptsSpokenText) && (
              <button
                className={`map-concept-preview__mic ${listening ? 'is-listening' : ''}`}
                type="button"
                aria-label={listening
                  ? activeExpression ? 'Detener respuesta por voz' : 'Detener identificación por voz'
                  : activeExpression ? 'Responder por voz' : 'Identificar Pokémon por voz'}
                aria-pressed={listening}
                title={speechSupported
                  ? activeExpression ? 'Responder a esta interacción por voz' : 'Identificar únicamente Pokémon visibles'
                  : 'Reconocimiento de voz no disponible'}
                disabled={!speechSupported}
                onClick={toggleMicAndFocusRuntime}
              >
                <span aria-hidden="true">🎙</span>
              </button>
            )}
            {acceptsAcoustic && (
              <button
                className={`map-concept-preview__acoustic ${acousticStatus === 'listening' ? 'is-listening' : ''}`}
                type="button"
                disabled={acousticStatus === 'requesting' || acousticStatus === 'listening'}
                aria-label="Analizar sonido localmente"
                onClick={() => void captureAcoustic()}
                style={{ '--acoustic-progress': acousticProgress } as CSSProperties}
              >
                {acousticStatus === 'requesting' ? 'Permiso…'
                  : acousticStatus === 'listening' ? '¡Ahora!'
                    : 'Escuchar sonido'}
              </button>
            )}
            {activeExpression?.fallbackActionId && activeExpression.inputMethods.includes('contextAction') && (
              <button
                className="map-concept-preview__expression-fallback"
                type="button"
                onClick={onExpressionFallback}
              >
                {activeExpression.fallbackLabel ?? 'Usar gesto'}
              </button>
            )}
          </form>
          <div
            className="map-concept-preview__action-decoration"
            data-control-decoration="action-buttons"
            aria-hidden="true"
          ><i /><i /><i /><i /></div>
        </div>
      </section>
    </div>
  );
}
