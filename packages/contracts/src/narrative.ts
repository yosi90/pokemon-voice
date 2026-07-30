import type { ISODateString, StableId, VersionedContractV1 } from './common.js';

export type NarrativePortraitState = 'neutral' | 'speaking' | 'idea' | 'glitch';
export type TrainerAvatarId = 'achaman' | 'guayota';
export type NarrativePagePresentation = 'default' | 'trainerSelection' | 'trainerName';

export interface TrainerProfileV1 extends VersionedContractV1 {
  avatarId: TrainerAvatarId;
  displayName: string;
}

export type NarrativeActionV1 =
  | { kind: 'acceptPokeDiscover' }
  | { kind: 'declinePokeDiscover' }
  | { kind: 'selectTrainerAvatar'; avatarId: TrainerAvatarId }
  | { kind: 'postponePokeDiscover' }
  | { kind: 'completeSequence' }
  | { kind: 'openMission'; missionId: StableId };

export interface NarrativeChoiceV1 {
  choiceId: StableId;
  label: string;
  nextPageId?: StableId;
  action?: NarrativeActionV1;
  previewAvatarId?: TrainerAvatarId;
}

export interface NarrativeTextInputV1 {
  inputId: StableId;
  label: string;
  maxLength: number;
  submitLabel: string;
  action: 'saveTrainerNameAndAccept';
  nextPageId: StableId;
}

export interface NarrativePageV1 {
  pageId: StableId;
  speakerId: StableId;
  speakerName: string;
  text: string;
  portraitState: NarrativePortraitState;
  presentation?: NarrativePagePresentation;
  nextPageId?: StableId;
  choices?: NarrativeChoiceV1[];
  action?: NarrativeActionV1;
  textInput?: NarrativeTextInputV1;
  backgroundId?: StableId;
}

export interface NarrativeSequenceV1 extends VersionedContractV1 {
  sequenceId: StableId;
  initialPageId: StableId;
  pages: NarrativePageV1[];
  once: boolean;
  backgroundId?: StableId;
}

export interface ActiveNarrativeSequenceV1 {
  sequenceId: StableId;
  pageId: StableId;
  startedAt: ISODateString;
}

export interface NarrativeProgressV1 extends VersionedContractV1 {
  pendingSequenceIds: StableId[];
  completedSequenceIds: StableId[];
  activeSequence?: ActiveNarrativeSequenceV1;
  /** Cues vistos por el jugador; habilita el salto seguro de texto ya leído. */
  readCueIds?: StableId[];
}

export type NarrativeStageSlot =
  | 'farLeft'
  | 'left'
  | 'center'
  | 'right'
  | 'farRight';

export type NarrativeActionPhase = 'beforeText' | 'withText' | 'afterText';
export type NarrativeMotionPreset =
  | 'enter'
  | 'exit'
  | 'slide'
  | 'hop'
  | 'shake'
  | 'zoom'
  | 'fade';

export interface NarrativeActionTimingV1 {
  /** ID técnico para checkpoints e idempotencia; el editor lo oculta salvo diagnóstico. */
  actionId?: StableId;
  /** La acción produce estado que no debe repetirse al restaurar un checkpoint. */
  persistent?: boolean;
  phase: NarrativeActionPhase;
  delayMs?: number;
  durationMs?: number;
  easing?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';
  blocking?: boolean;
}

export interface NarrativeActorTransformV1 {
  slot: NarrativeStageSlot;
  offsetX?: number;
  offsetY?: number;
  scale?: number;
  depth?: number;
  mirror?: boolean;
}

export type NarrativeActorSourceV1 =
  | { kind: 'illustration'; assetId: StableId }
  | { kind: 'pmd'; assetId: StableId; animationName?: string };

export type NarrativeStageActionV1 = NarrativeActionTimingV1 & (
  | {
    kind: 'setBackground';
    backgroundAssetId?: StableId;
    transition?: 'cut' | 'fade' | 'dissolve';
  }
  | {
    kind: 'enterActor';
    actorId: StableId;
    source: NarrativeActorSourceV1;
    poseAssetId?: StableId;
    transform: NarrativeActorTransformV1;
    motion?: NarrativeMotionPreset;
  }
  | { kind: 'exitActor'; actorId: StableId; motion?: NarrativeMotionPreset }
  | { kind: 'setActorPose'; actorId: StableId; poseAssetId: StableId }
  | { kind: 'setActorAnimation'; actorId: StableId; animationName: string }
  | {
    kind: 'moveActor';
    actorId: StableId;
    transform: NarrativeActorTransformV1;
    motion: NarrativeMotionPreset;
  }
  | {
    kind: 'playAudio';
    audioAssetId: StableId;
    channel: 'music' | 'effect' | 'voice';
    volume?: number;
    loop?: boolean;
    fadeInMs?: number;
    continueAfterConversation?: boolean;
  }
  | {
    kind: 'stopAudio';
    channel: 'music' | 'effect' | 'voice' | 'all';
    audioAssetId?: StableId;
    fadeOutMs?: number;
  }
);

export type NarrativeTokenReferenceV1 =
  | { kind: 'playerName' }
  | { kind: 'playerAvatar' }
  | { kind: 'companionName' }
  | { kind: 'inventoryItem'; itemId: StableId }
  | { kind: 'missionCounter'; counterId: StableId }
  | { kind: 'worldFlag'; flagId: StableId };

export interface NarrativeConversationChoiceV1 {
  choiceId: StableId;
  label: string;
  nextCueId?: StableId;
  outcomeId?: StableId;
  legacyAction?: NarrativeActionV1;
}

export interface NarrativeConversationTextInputV1 {
  inputId: StableId;
  label: string;
  variableId: StableId;
  maxLength: number;
  submitLabel: string;
  nextCueId?: StableId;
  outcomeId?: StableId;
  legacyAction?: NarrativeTextInputV1['action'];
}

export interface NarrativeCueV1 {
  cueId: StableId;
  kind: 'dialogue' | 'narration' | 'action';
  speakerActorId?: StableId;
  speakerName?: string;
  text?: string;
  tokenReferences?: NarrativeTokenReferenceV1[];
  voiceAssetId?: StableId;
  actions: NarrativeStageActionV1[];
  nextCueId?: StableId;
  choices?: NarrativeConversationChoiceV1[];
  textInput?: NarrativeConversationTextInputV1;
  /** Acción tipada heredada durante la transición del reproductor V1. */
  legacyAction?: NarrativeActionV1;
  /** Resultado terminal entregado al lanzador o flujo de misión. */
  outcomeId?: StableId;
}

export interface NarrativeConversationV1 extends VersionedContractV1 {
  conversationId: StableId;
  title: string;
  tags: string[];
  initialCueId: StableId;
  once: boolean;
  cues: NarrativeCueV1[];
}

export interface NarrativeConversationManifestEntryV1 extends VersionedContractV1 {
  conversationId: StableId;
  title: string;
  tags: string[];
  documentPath: string;
}

export interface NarrativeConversationManifestV1 extends VersionedContractV1 {
  conversations: NarrativeConversationManifestEntryV1[];
}

export interface ActiveNarrativeConversationV1 extends VersionedContractV1 {
  conversationId: StableId;
  cueId: StableId;
  historyCueIds: StableId[];
  executedEffectIds: StableId[];
  variables: Record<StableId, string | number | boolean>;
  selectedChoices?: Record<StableId, StableId>;
}

export type PokeDiscoverIntroductionStatus = 'hidden' | 'offered' | 'postponed' | 'accepted';

export interface PokeDiscoverIntroductionStateV1 extends VersionedContractV1 {
  status: PokeDiscoverIntroductionStatus;
  invitationCount: number;
  declineCount: number;
  nextEligibleDiscoveryCount: number;
  acceptedAt?: ISODateString;
}
