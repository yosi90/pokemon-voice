import type {
  NarrativeProgressV1,
  NarrativeSequenceV1,
  PokeDiscoverIntroductionStateV1,
  TrainerAvatarId,
  TrainerProfileV1,
} from '../../../packages/contracts/src/index.js';

export const PROFESSOR_INTRO_SEQUENCE_ID = 'narrative:professor-camphor:introduction';
export const PROFESSOR_RETURN_SEQUENCE_ID = 'narrative:professor-camphor:return';
export const PROFESSOR_PROFILE_SEQUENCE_ID = 'narrative:professor-camphor:trainer-profile';
export const PROFESSOR_FIRST_AUTOMATIC_DISCOVERY = 5;
export const PROFESSOR_INCOMING_CALL_DELAY_MS = 1800;
export const DEFAULT_TRAINER_NAMES: Readonly<Record<TrainerAvatarId, string>> = Object.freeze({
  achaman: 'Achaman',
  guayota: 'Guayota',
});
export const TRAINER_NAME_MAX_LENGTH = 18;

export function normalizeTrainerName(value: unknown, avatarId: TrainerAvatarId) {
  if (typeof value !== 'string') return DEFAULT_TRAINER_NAMES[avatarId];
  const normalized = value.trim().replace(/\s+/g, ' ').slice(0, TRAINER_NAME_MAX_LENGTH);
  return normalized || DEFAULT_TRAINER_NAMES[avatarId];
}

export function normalizeTrainerProfile(value: unknown): TrainerProfileV1 | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const candidate = value as Partial<TrainerProfileV1>;
  if (candidate.avatarId !== 'achaman' && candidate.avatarId !== 'guayota') return undefined;
  return {
    schemaVersion: 1,
    avatarId: candidate.avatarId,
    displayName: normalizeTrainerName(candidate.displayName, candidate.avatarId),
  };
}

export function createProfessorIntroductionStateV1(): PokeDiscoverIntroductionStateV1 {
  return {
    schemaVersion: 1,
    status: 'hidden',
    invitationCount: 0,
    declineCount: 0,
    nextEligibleDiscoveryCount: PROFESSOR_FIRST_AUTOMATIC_DISCOVERY,
  };
}

export function createNarrativeProgressV1(): NarrativeProgressV1 {
  return {
    schemaVersion: 1,
    pendingSequenceIds: [],
    completedSequenceIds: [],
  };
}

function safeNonNegativeInteger(value: unknown, fallback = 0) {
  return Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : fallback;
}

export function normalizeProfessorIntroduction(value: unknown): PokeDiscoverIntroductionStateV1 {
  const fallback = createProfessorIntroductionStateV1();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
  const candidate = value as Partial<PokeDiscoverIntroductionStateV1>;
  let status = ['hidden', 'offered', 'postponed', 'accepted'].includes(String(candidate.status))
    ? candidate.status as PokeDiscoverIntroductionStateV1['status']
    : fallback.status;
  const acceptedAt = typeof candidate.acceptedAt === 'string'
    && !Number.isNaN(Date.parse(candidate.acceptedAt))
    ? new Date(candidate.acceptedAt).toISOString()
    : undefined;
  if (status === 'accepted' && !acceptedAt) status = 'hidden';
  return {
    schemaVersion: 1,
    status: acceptedAt ? 'accepted' : status,
    invitationCount: safeNonNegativeInteger(candidate.invitationCount),
    declineCount: safeNonNegativeInteger(candidate.declineCount),
    nextEligibleDiscoveryCount: safeNonNegativeInteger(
      candidate.nextEligibleDiscoveryCount,
      PROFESSOR_FIRST_AUTOMATIC_DISCOVERY,
    ),
    ...(acceptedAt ? { acceptedAt } : {}),
  };
}

function uniqueStableIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(item => typeof item === 'string' && item.trim()))] as string[];
}

export function normalizeNarrativeProgress(value: unknown): NarrativeProgressV1 {
  const fallback = createNarrativeProgressV1();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
  const candidate = value as Partial<NarrativeProgressV1>;
  const active = candidate.activeSequence;
  const activeSequence = active
    && typeof active.sequenceId === 'string'
    && typeof active.pageId === 'string'
    && typeof active.startedAt === 'string'
    && !Number.isNaN(Date.parse(active.startedAt))
    ? {
      sequenceId: active.sequenceId,
      pageId: active.pageId,
      startedAt: new Date(active.startedAt).toISOString(),
    }
    : undefined;
  return {
    schemaVersion: 1,
    pendingSequenceIds: uniqueStableIds(candidate.pendingSequenceIds),
    completedSequenceIds: uniqueStableIds(candidate.completedSequenceIds),
    ...(activeSequence ? { activeSequence: activeSequence } : {}),
  };
}

export function getProfessorIntroductionTrigger({
  introduction,
  discoveryCount,
  source,
}: {
  introduction: PokeDiscoverIntroductionStateV1;
  discoveryCount: number;
  source: 'discoveredDetail' | 'newDiscovery';
}) {
  if (introduction.status === 'accepted' || introduction.status === 'offered') return null;
  if (introduction.status === 'postponed') {
    return source === 'newDiscovery' && discoveryCount >= introduction.nextEligibleDiscoveryCount
      ? PROFESSOR_RETURN_SEQUENCE_ID
      : null;
  }
  if (source === 'discoveredDetail' && discoveryCount >= 1) return PROFESSOR_INTRO_SEQUENCE_ID;
  if (source === 'newDiscovery' && discoveryCount >= PROFESSOR_FIRST_AUTOMATIC_DISCOVERY) {
    return PROFESSOR_INTRO_SEQUENCE_ID;
  }
  return null;
}

export const PROFESSOR_INTRODUCTION_SEQUENCE: NarrativeSequenceV1 = {
  schemaVersion: 1,
  sequenceId: PROFESSOR_INTRO_SEQUENCE_ID,
  initialPageId: 'arrival',
  once: false,
  backgroundId: 'camphor-laboratory',
  pages: [
    { pageId: 'arrival', speakerId: 'professor-camphor', speakerName: 'Profesor Alcanfor', portraitState: 'neutral', text: '¡Un momento! Esa Pokédex que llevas no parece estar nada mal para alguien que acaba de empezar.', nextPageId: 'presentation' },
    { pageId: 'presentation', speakerId: 'professor-camphor', speakerName: 'Profesor Alcanfor', portraitState: 'speaking', text: 'Soy el profesor Alcanfor. Investigo cómo viven los Pokémon cuando nadie intenta encerrarlos en una tabla de datos.', nextPageId: 'proposal' },
    { pageId: 'proposal', speakerId: 'professor-camphor', speakerName: 'Profesor Alcanfor', portraitState: 'idea', text: 'Pareces un entrenador novato, pero tienes buen oído. Podría financiar tus viajes si completas algunos encargos de investigación para mí.', nextPageId: 'offer-one' },
    { pageId: 'offer-one', speakerId: 'professor-camphor', speakerName: 'Profesor Alcanfor', portraitState: 'neutral', text: '¿Quieres recorrer el mundo Pokémon como parte de PokeDiscover?', choices: [
      { choiceId: 'accept-one', label: '¡Sí, acepto!', nextPageId: 'trainer-choice' },
      { choiceId: 'decline-one', label: 'No, gracias', nextPageId: 'persuasion-one', action: { kind: 'declinePokeDiscover' } },
    ] },
    { pageId: 'persuasion-one', speakerId: 'professor-camphor', speakerName: 'Profesor Alcanfor', portraitState: 'idea', text: '¿He mencionado que yo pagaría los desplazamientos y el material? Las palas de calidad no crecen en los árboles.', nextPageId: 'offer-two' },
    { pageId: 'offer-two', speakerId: 'professor-camphor', speakerName: 'Profesor Alcanfor', portraitState: 'neutral', text: 'Piénsalo bien. ¿Te unes a PokeDiscover?', choices: [
      { choiceId: 'accept-two', label: 'Está bien, acepto', nextPageId: 'trainer-choice' },
      { choiceId: 'decline-two', label: 'Sigo diciendo que no', nextPageId: 'persuasion-two', action: { kind: 'declinePokeDiscover' } },
    ] },
    { pageId: 'persuasion-two', speakerId: 'professor-camphor', speakerName: 'Profesor Alcanfor', portraitState: 'speaking', text: 'Conocerías jardines imposibles, volcanes, ruinas y Pokémon que casi nadie ha visto. Sería una pena dejar todo eso sin investigar.', nextPageId: 'offer-three' },
    { pageId: 'offer-three', speakerId: 'professor-camphor', speakerName: 'Profesor Alcanfor', portraitState: 'neutral', text: 'Último intento: ¿empezamos este viaje juntos?', choices: [
      { choiceId: 'accept-three', label: 'Empecemos', nextPageId: 'trainer-choice' },
      { choiceId: 'decline-three', label: 'Ahora no', nextPageId: 'postponed', action: { kind: 'declinePokeDiscover' } },
    ] },
    { pageId: 'trainer-choice', speakerId: 'professor-camphor', speakerName: 'Profesor Alcanfor', portraitState: 'neutral', presentation: 'trainerSelection', text: 'Antes de inscribirte, necesito saber quién eres. ¿Eres un chico o una chica?', choices: [
      { choiceId: 'choose-achaman', label: 'Soy un chico', nextPageId: 'trainer-name', previewAvatarId: 'achaman', action: { kind: 'selectTrainerAvatar', avatarId: 'achaman' } },
      { choiceId: 'choose-guayota', label: 'Soy una chica', nextPageId: 'trainer-name', previewAvatarId: 'guayota', action: { kind: 'selectTrainerAvatar', avatarId: 'guayota' } },
    ] },
    { pageId: 'trainer-name', speakerId: 'professor-camphor', speakerName: 'Profesor Alcanfor', portraitState: 'speaking', presentation: 'trainerName', text: 'Perfecto. Este es el nombre que pondré en tu ficha. Puedes cambiarlo ahora si quieres.', textInput: {
      inputId: 'trainer-display-name', label: 'Nombre del entrenador', maxLength: TRAINER_NAME_MAX_LENGTH, submitLabel: 'Confirmar nombre', action: 'saveTrainerNameAndAccept', nextPageId: 'accepted',
    } },
    { pageId: 'postponed', speakerId: 'professor-camphor', speakerName: 'Profesor Alcanfor', portraitState: 'neutral', text: 'Vaya, tienes una voluntad envidiable. No insistiré más... por hoy.', action: { kind: 'postponePokeDiscover' } },
    { pageId: 'accepted', speakerId: 'professor-camphor', speakerName: 'Profesor Alcanfor', portraitState: 'idea', text: '¡Excelente! Ya está todo listo. Desde ahora formas parte de PokeDiscover. Busca mi hoja de alcanfor cuando quieras consultar tus encargos.', action: { kind: 'completeSequence' } },
  ],
};

export const PROFESSOR_RETURN_SEQUENCE: NarrativeSequenceV1 = {
  schemaVersion: 1,
  sequenceId: PROFESSOR_RETURN_SEQUENCE_ID,
  initialPageId: 'return',
  once: false,
  backgroundId: 'camphor-laboratory',
  pages: [
    { pageId: 'return', speakerId: 'professor-camphor', speakerName: 'Profesor Alcanfor', portraitState: 'speaking', text: '¡Otra captura para esa Pokédex! Sabía que volveríamos a encontrarnos. ¿Te unes ahora a PokeDiscover?', choices: [
      { choiceId: 'accept-return', label: 'Sí, acepto', nextPageId: 'trainer-choice' },
      { choiceId: 'decline-return', label: 'Todavía no', nextPageId: 'postponed', action: { kind: 'declinePokeDiscover' } },
    ] },
    { pageId: 'trainer-choice', speakerId: 'professor-camphor', speakerName: 'Profesor Alcanfor', portraitState: 'neutral', presentation: 'trainerSelection', text: 'Entonces terminemos tu inscripción. ¿Eres un chico o una chica?', choices: [
      { choiceId: 'choose-achaman-return', label: 'Soy un chico', nextPageId: 'trainer-name', previewAvatarId: 'achaman', action: { kind: 'selectTrainerAvatar', avatarId: 'achaman' } },
      { choiceId: 'choose-guayota-return', label: 'Soy una chica', nextPageId: 'trainer-name', previewAvatarId: 'guayota', action: { kind: 'selectTrainerAvatar', avatarId: 'guayota' } },
    ] },
    { pageId: 'trainer-name', speakerId: 'professor-camphor', speakerName: 'Profesor Alcanfor', portraitState: 'speaking', presentation: 'trainerName', text: 'Este es el nombre que pondré en tu ficha. Puedes cambiarlo ahora si quieres.', textInput: {
      inputId: 'trainer-display-name-return', label: 'Nombre del entrenador', maxLength: TRAINER_NAME_MAX_LENGTH, submitLabel: 'Confirmar nombre', action: 'saveTrainerNameAndAccept', nextPageId: 'accepted',
    } },
    { pageId: 'postponed', speakerId: 'professor-camphor', speakerName: 'Profesor Alcanfor', portraitState: 'neutral', text: 'De acuerdo. Seguiré atento a tus descubrimientos.', action: { kind: 'postponePokeDiscover' } },
    { pageId: 'accepted', speakerId: 'professor-camphor', speakerName: 'Profesor Alcanfor', portraitState: 'idea', text: '¡Sabía que acabarías aceptando! Busca mi hoja de alcanfor cuando quieras consultar tus encargos.', action: { kind: 'completeSequence' } },
  ],
};

export const PROFESSOR_PROFILE_SEQUENCE: NarrativeSequenceV1 = {
  schemaVersion: 1,
  sequenceId: PROFESSOR_PROFILE_SEQUENCE_ID,
  initialPageId: 'trainer-choice',
  once: true,
  backgroundId: 'camphor-laboratory',
  pages: [
    { pageId: 'trainer-choice', speakerId: 'professor-camphor', speakerName: 'Profesor Alcanfor', portraitState: 'neutral', presentation: 'trainerSelection', text: 'Antes de enseñarte los encargos, terminemos tu ficha. ¿Eres un chico o una chica?', choices: [
      { choiceId: 'choose-achaman-profile', label: 'Soy un chico', nextPageId: 'trainer-name', previewAvatarId: 'achaman', action: { kind: 'selectTrainerAvatar', avatarId: 'achaman' } },
      { choiceId: 'choose-guayota-profile', label: 'Soy una chica', nextPageId: 'trainer-name', previewAvatarId: 'guayota', action: { kind: 'selectTrainerAvatar', avatarId: 'guayota' } },
    ] },
    { pageId: 'trainer-name', speakerId: 'professor-camphor', speakerName: 'Profesor Alcanfor', portraitState: 'speaking', presentation: 'trainerName', text: 'Este es el nombre que pondré en tu ficha. Puedes cambiarlo ahora si quieres.', textInput: {
      inputId: 'trainer-display-name-profile', label: 'Nombre del entrenador', maxLength: TRAINER_NAME_MAX_LENGTH, submitLabel: 'Confirmar nombre', action: 'saveTrainerNameAndAccept', nextPageId: 'completed',
    } },
    { pageId: 'completed', speakerId: 'professor-camphor', speakerName: 'Profesor Alcanfor', portraitState: 'idea', text: '¡Perfecto! Ya puedo dirigirme a ti como es debido.', action: { kind: 'completeSequence' } },
  ],
};

export const PROFESSOR_NARRATIVE_SEQUENCES: Readonly<Record<string, NarrativeSequenceV1>> = Object.freeze({
  [PROFESSOR_INTRO_SEQUENCE_ID]: PROFESSOR_INTRODUCTION_SEQUENCE,
  [PROFESSOR_RETURN_SEQUENCE_ID]: PROFESSOR_RETURN_SEQUENCE,
  [PROFESSOR_PROFILE_SEQUENCE_ID]: PROFESSOR_PROFILE_SEQUENCE,
});
