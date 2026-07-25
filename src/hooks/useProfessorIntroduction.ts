import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NarrativeActionV1, NarrativeChoiceV1 } from '../../packages/contracts/src/index.js';
import {
  DEFAULT_TRAINER_NAMES,
  PROFESSOR_NARRATIVE_SEQUENCES,
  PROFESSOR_CAMPHOR_EMERGENCY_SEQUENCE_ID,
  PROFESSOR_PROFILE_SEQUENCE_ID,
  PROFESSOR_INCOMING_CALL_DELAY_MS,
  getProfessorIntroductionTrigger,
  normalizeTrainerName,
} from '../domain/narrative/professorIntroduction.js';
import {
  getBrowserPokeVoiceSave,
  updateBrowserPokeDiscover,
} from '../store/browserPokeVoiceSaveStore.js';

function readState() {
  const pokeDiscover = getBrowserPokeVoiceSave().pokeDiscover;
  return {
    introduction: pokeDiscover.introduction,
    narrativeProgress: pokeDiscover.narrativeProgress,
    trainerProfile: pokeDiscover.trainerProfile,
  };
}

export function useProfessorIntroduction({
  discoveryCount,
  canPresent,
  ignoreNewDiscoveries = false,
  onProfileConfirmed,
  onSequenceCompleted,
}: {
  discoveryCount: number;
  canPresent: boolean;
  ignoreNewDiscoveries?: boolean;
  onProfileConfirmed?: () => boolean | void;
  onSequenceCompleted?: (sequenceId: string) => void;
}) {
  const [state, setState] = useState(readState);
  const [incomingCallSequenceId, setIncomingCallSequenceId] = useState<string>();
  const previousDiscoveryCount = useRef(discoveryCount);
  const incomingCallTimer = useRef<number | undefined>(undefined);

  const commit = useCallback((updater: (current: ReturnType<typeof readState>) => ReturnType<typeof readState>) => {
    let nextState = state;
    updateBrowserPokeDiscover(current => {
      nextState = updater({
        introduction: current.introduction,
        narrativeProgress: current.narrativeProgress,
        trainerProfile: current.trainerProfile,
      });
      return {
        ...current,
        introduction: nextState.introduction,
        narrativeProgress: nextState.narrativeProgress,
        trainerProfile: nextState.trainerProfile,
      };
    });
    setState(nextState);
    return nextState;
  }, [state]);

  const queueSequence = useCallback((sequenceId: string, markIntroductionOffered = true) => {
    commit(current => {
      const alreadyQueued = current.narrativeProgress.pendingSequenceIds.includes(sequenceId)
        || current.narrativeProgress.activeSequence?.sequenceId === sequenceId;
      if (alreadyQueued) return current;
      return {
        ...current,
        introduction: {
          ...current.introduction,
          status: markIntroductionOffered ? 'offered' : current.introduction.status,
          invitationCount: current.introduction.invitationCount + (markIntroductionOffered ? 1 : 0),
        },
        narrativeProgress: {
          ...current.narrativeProgress,
          pendingSequenceIds: [...current.narrativeProgress.pendingSequenceIds, sequenceId],
        },
      };
    });
  }, [commit]);

  const activateSequence = useCallback((sequenceId: string) => {
    const sequence = PROFESSOR_NARRATIVE_SEQUENCES[sequenceId];
    if (!sequence) return false;
    commit(current => ({
      ...current,
      narrativeProgress: {
        ...current.narrativeProgress,
        pendingSequenceIds: current.narrativeProgress.pendingSequenceIds.filter(id => id !== sequenceId),
        activeSequence: {
          sequenceId,
          pageId: sequence.initialPageId,
          startedAt: new Date().toISOString(),
        },
      },
    }));
    setIncomingCallSequenceId(undefined);
    return true;
  }, [commit]);

  const requestProfileSetup = useCallback(() => {
    const current = readState();
    if (current.introduction.status !== 'accepted' || current.trainerProfile) return false;
    return activateSequence(PROFESSOR_PROFILE_SEQUENCE_ID);
  }, [activateSequence]);

  const requestFromDetail = useCallback((currentDiscoveryCount: number) => {
    const current = readState();
    const sequenceId = getProfessorIntroductionTrigger({
      introduction: current.introduction,
      discoveryCount: currentDiscoveryCount,
      source: 'discoveredDetail',
    });
    if (!sequenceId) return false;
    queueSequence(sequenceId);
    return true;
  }, [queueSequence]);

  useEffect(() => {
    const previous = previousDiscoveryCount.current;
    previousDiscoveryCount.current = discoveryCount;
    if (ignoreNewDiscoveries || discoveryCount <= previous) return;
    const current = readState();
    const sequenceId = getProfessorIntroductionTrigger({
      introduction: current.introduction,
      discoveryCount,
      source: 'newDiscovery',
    });
    if (sequenceId) queueSequence(sequenceId);
  }, [discoveryCount, ignoreNewDiscoveries, queueSequence]);

  useEffect(() => {
    window.clearTimeout(incomingCallTimer.current);
    if (!canPresent || state.narrativeProgress.activeSequence || incomingCallSequenceId) return undefined;
    const [sequenceId] = state.narrativeProgress.pendingSequenceIds;
    const sequence = sequenceId ? PROFESSOR_NARRATIVE_SEQUENCES[sequenceId] : undefined;
    if (!sequence) return undefined;
    incomingCallTimer.current = window.setTimeout(() => {
      const current = readState();
      if (!current.narrativeProgress.activeSequence
        && current.narrativeProgress.pendingSequenceIds.includes(sequenceId)) {
        setIncomingCallSequenceId(sequenceId);
      }
    }, PROFESSOR_INCOMING_CALL_DELAY_MS);
    return () => window.clearTimeout(incomingCallTimer.current);
  }, [canPresent, incomingCallSequenceId, state.narrativeProgress.activeSequence, state.narrativeProgress.pendingSequenceIds]);

  const answerCall = useCallback(() => {
    const sequenceId = incomingCallSequenceId ?? readState().narrativeProgress.pendingSequenceIds[0];
    return sequenceId ? activateSequence(sequenceId) : false;
  }, [activateSequence, incomingCallSequenceId]);

  const completeActiveSequence = useCallback((introduction = state.introduction) => {
    const active = state.narrativeProgress.activeSequence;
    if (!active) return;
    commit(current => ({
      ...current,
      introduction,
      narrativeProgress: {
        ...current.narrativeProgress,
        activeSequence: undefined,
        completedSequenceIds: [...new Set([
          ...current.narrativeProgress.completedSequenceIds,
          active.sequenceId,
        ])],
      },
    }));
    onSequenceCompleted?.(active.sequenceId);
  }, [commit, onSequenceCompleted, state.introduction, state.narrativeProgress.activeSequence]);

  const applyAction = useCallback((action?: NarrativeActionV1) => {
    if (!action) return state.introduction;
    if (action.kind === 'acceptPokeDiscover') {
      return { ...state.introduction, status: 'accepted' as const, acceptedAt: new Date().toISOString() };
    }
    if (action.kind === 'declinePokeDiscover') {
      return { ...state.introduction, declineCount: state.introduction.declineCount + 1 };
    }
    return state.introduction;
  }, [state.introduction]);

  const moveToPage = useCallback((pageId: string, introduction = state.introduction, trainerProfile = state.trainerProfile) => {
    commit(current => ({
      ...current,
      introduction,
      trainerProfile,
      narrativeProgress: {
        ...current.narrativeProgress,
        activeSequence: current.narrativeProgress.activeSequence
          ? { ...current.narrativeProgress.activeSequence, pageId }
          : undefined,
      },
    }));
  }, [commit, state.introduction, state.trainerProfile]);

  const advance = useCallback(() => {
    const active = state.narrativeProgress.activeSequence;
    if (!active) return;
    const sequence = PROFESSOR_NARRATIVE_SEQUENCES[active.sequenceId];
    const page = sequence?.pages.find(candidate => candidate.pageId === active.pageId);
    if (!page || page.choices?.length) return;
    if (page.action?.kind === 'postponePokeDiscover') {
      completeActiveSequence({
        ...state.introduction,
        status: 'postponed',
        nextEligibleDiscoveryCount: discoveryCount + 1,
      });
      return;
    }
    if (page.action?.kind === 'completeSequence') {
      completeActiveSequence(state.introduction);
      return;
    }
    if (page.nextPageId) moveToPage(page.nextPageId, applyAction(page.action));
    else completeActiveSequence(applyAction(page.action));
  }, [applyAction, completeActiveSequence, discoveryCount, moveToPage, state.introduction, state.narrativeProgress.activeSequence]);

  const choose = useCallback((choice: NarrativeChoiceV1) => {
    const introduction = applyAction(choice.action);
    const trainerProfile = choice.action?.kind === 'selectTrainerAvatar'
      ? {
        schemaVersion: 1 as const,
        avatarId: choice.action.avatarId,
        displayName: state.trainerProfile?.avatarId === choice.action.avatarId
          ? state.trainerProfile.displayName
          : DEFAULT_TRAINER_NAMES[choice.action.avatarId],
      }
      : state.trainerProfile;
    if (choice.nextPageId) moveToPage(choice.nextPageId, introduction, trainerProfile);
    else completeActiveSequence(introduction);
  }, [applyAction, completeActiveSequence, moveToPage, state.trainerProfile]);

  const submitTextInput = useCallback((value: string) => {
    const active = state.narrativeProgress.activeSequence;
    const sequence = active ? PROFESSOR_NARRATIVE_SEQUENCES[active.sequenceId] : undefined;
    const page = sequence?.pages.find(candidate => candidate.pageId === active?.pageId);
    if (!page?.textInput || !state.trainerProfile) return;
    const trainerProfile = {
      ...state.trainerProfile,
      displayName: normalizeTrainerName(value, state.trainerProfile.avatarId),
    };
    const introduction = page.textInput.action === 'saveTrainerNameAndAccept'
      ? { ...state.introduction, status: 'accepted' as const, acceptedAt: state.introduction.acceptedAt ?? new Date().toISOString() }
      : state.introduction;
    commit(current => ({
      ...current,
      introduction,
      trainerProfile,
      narrativeProgress: {
        ...current.narrativeProgress,
        activeSequence: current.narrativeProgress.activeSequence
          ? { ...current.narrativeProgress.activeSequence, pageId: page.textInput!.nextPageId }
          : undefined,
      },
    }));
    if (onProfileConfirmed?.() !== false) queueSequence(PROFESSOR_CAMPHOR_EMERGENCY_SEQUENCE_ID, false);
  }, [commit, onProfileConfirmed, queueSequence, state.introduction, state.narrativeProgress.activeSequence, state.trainerProfile]);

  const dismiss = useCallback(() => {
    if (state.introduction.status === 'accepted') {
      completeActiveSequence(state.introduction);
      return;
    }
    completeActiveSequence({
      ...state.introduction,
      status: 'postponed',
      nextEligibleDiscoveryCount: discoveryCount + 1,
    });
  }, [completeActiveSequence, discoveryCount, state.introduction]);

  const activeSequence = state.narrativeProgress.activeSequence
    ? PROFESSOR_NARRATIVE_SEQUENCES[state.narrativeProgress.activeSequence.sequenceId]
    : undefined;
  const activePage = activeSequence?.pages.find(
    page => page.pageId === state.narrativeProgress.activeSequence?.pageId,
  );

  return useMemo(() => ({
    accepted: state.introduction.status === 'accepted',
    answerCall,
    active: Boolean(activeSequence && activePage),
    activePage,
    activeSequence,
    advance,
    choose,
    dismiss,
    hasNotification: state.narrativeProgress.pendingSequenceIds.length > 0
      || (state.introduction.status === 'accepted' && !state.trainerProfile),
    incomingCall: Boolean(incomingCallSequenceId),
    requestProfileSetup,
    requestFromDetail,
    submitTextInput,
    trainerProfile: state.trainerProfile,
  }), [activePage, activeSequence, advance, answerCall, choose, dismiss, incomingCallSequenceId, requestFromDetail, requestProfileSetup, state.introduction.status, state.narrativeProgress.pendingSequenceIds.length, state.trainerProfile, submitTextInput]);
}
