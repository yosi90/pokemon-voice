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
}

export type PokeDiscoverIntroductionStatus = 'hidden' | 'offered' | 'postponed' | 'accepted';

export interface PokeDiscoverIntroductionStateV1 extends VersionedContractV1 {
  status: PokeDiscoverIntroductionStatus;
  invitationCount: number;
  declineCount: number;
  nextEligibleDiscoveryCount: number;
  acceptedAt?: ISODateString;
}
