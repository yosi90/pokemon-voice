import type {
  AdventureMediaManifestV1,
  NarrativeConversationManifestV1,
  NarrativeConversationV1,
  NarrativeCueV1,
  NarrativeSequenceV1,
  NarrativeStageActionV1,
  NarrativeTokenReferenceV1,
  PmdAnimationManifestV1,
  PokeVoiceSaveV1,
} from '../../../packages/contracts/src/index.js';

export interface NarrativeStageActorState {
  actorId: string;
  source: Extract<NarrativeStageActionV1, { kind: 'enterActor' }>['source'];
  poseAssetId?: string;
  transform: Extract<NarrativeStageActionV1, { kind: 'enterActor' }>['transform'];
}

export interface NarrativeStageState {
  backgroundAssetId?: string;
  actors: Record<string, NarrativeStageActorState>;
  playingAudio: Record<string, string>;
}

export const EMPTY_NARRATIVE_STAGE: NarrativeStageState = Object.freeze({
  actors: {},
  playingAudio: {},
});

function outgoingCueIds(cue: NarrativeCueV1) {
  return [
    ...(cue.nextCueId ? [cue.nextCueId] : []),
    ...(cue.choices ?? []).flatMap(choice => choice.nextCueId ? [choice.nextCueId] : []),
    ...(cue.textInput?.nextCueId ? [cue.textInput.nextCueId] : []),
  ];
}

export function validateNarrativeConversation(
  conversation: NarrativeConversationV1,
  media?: AdventureMediaManifestV1,
  pmd?: PmdAnimationManifestV1,
) {
  const errors: string[] = [];
  if (conversation.schemaVersion !== 1) errors.push('schemaVersion debe ser 1.');
  if (!conversation.conversationId.trim()) errors.push('Falta conversationId.');
  if (!conversation.title.trim()) errors.push('Falta el título.');
  const cueIds = new Set<string>();
  const actionIds = new Set<string>();
  const interactionIds = new Set<string>();
  for (const cue of conversation.cues) {
    if (!cue.cueId.trim() || cueIds.has(cue.cueId)) {
      errors.push(`Cue duplicado o vacío: ${cue.cueId || '(vacío)'}.`);
    }
    cueIds.add(cue.cueId);
    if (cue.kind !== 'action' && !cue.text?.trim()) {
      errors.push(`${cue.cueId}: el diálogo o narración necesita texto.`);
    }
    if (cue.nextCueId && (cue.choices?.length || cue.textInput)) {
      errors.push(`${cue.cueId}: no puede mezclar avance directo con elección o entrada.`);
    }
    for (const action of cue.actions) {
      if (action.persistent && !action.actionId) {
        errors.push(`${cue.cueId}: una acción persistente necesita ID técnico.`);
      }
      if (action.actionId && actionIds.has(action.actionId)) {
        errors.push(`${cue.cueId}: ID de acción duplicado ${action.actionId}.`);
      }
      if (action.actionId) actionIds.add(action.actionId);
    }
    for (const choice of cue.choices ?? []) {
      if (!choice.choiceId || interactionIds.has(choice.choiceId)) {
        errors.push(`${cue.cueId}: ID de elección duplicado o vacío ${choice.choiceId}.`);
      }
      interactionIds.add(choice.choiceId);
      if (Boolean(choice.nextCueId) === Boolean(choice.outcomeId)) {
        errors.push(`${choice.choiceId}: debe enlazar exactamente un cue o un resultado.`);
      }
    }
    if (cue.textInput) {
      if (!cue.textInput.inputId || interactionIds.has(cue.textInput.inputId)) {
        errors.push(`${cue.cueId}: ID de entrada duplicado o vacío ${cue.textInput.inputId}.`);
      }
      interactionIds.add(cue.textInput.inputId);
    }
    if (cue.textInput
      && Boolean(cue.textInput.nextCueId) === Boolean(cue.textInput.outcomeId)) {
      errors.push(`${cue.textInput.inputId}: debe enlazar exactamente un cue o un resultado.`);
    }
  }
  if (!cueIds.has(conversation.initialCueId)) {
    errors.push(`El cue inicial ${conversation.initialCueId} no existe.`);
  }
  for (const cue of conversation.cues) {
    for (const target of outgoingCueIds(cue)) {
      if (!cueIds.has(target)) errors.push(`${cue.cueId}: referencia inexistente ${target}.`);
    }
  }

  // Los ciclos automáticos bloquearían el reproductor. Los retornos causados
  // por elecciones se excluyen expresamente y permanecen permitidos.
  const directNext = new Map(conversation.cues
    .map(cue => [cue.cueId, cue.nextCueId ?? cue.textInput?.nextCueId] as const)
    .filter((entry): entry is readonly [string, string] => Boolean(entry[1])));
  for (const cue of conversation.cues) {
    const seen = new Set<string>();
    let cursor: string | undefined = cue.cueId;
    while (cursor) {
      if (seen.has(cursor)) {
        errors.push(`${cue.cueId}: contiene un ciclo automático.`);
        break;
      }
      seen.add(cursor);
      cursor = directNext.get(cursor);
    }
  }

  if (media) {
    const mediaById = new Map(media.assets.map(asset => [asset.assetId, asset]));
    for (const cue of conversation.cues) {
      if (cue.voiceAssetId && mediaById.get(cue.voiceAssetId)?.kind !== 'audio') {
        errors.push(`${cue.cueId}: voz inexistente ${cue.voiceAssetId}.`);
      }
      for (const action of cue.actions) {
        const referenced = action.kind === 'setBackground'
          ? action.backgroundAssetId
          : action.kind === 'enterActor' && action.source.kind === 'illustration'
            ? action.source.assetId
            : action.kind === 'setActorPose'
              ? action.poseAssetId
              : action.kind === 'playAudio'
                ? action.audioAssetId
                : undefined;
        if (referenced && !mediaById.has(referenced)) {
          errors.push(`${cue.cueId}: recurso narrativo inexistente ${referenced}.`);
        }
        if (action.kind === 'enterActor' && action.source.kind === 'pmd'
          && pmd && !pmd.assets.some(asset => asset.assetId === action.source.assetId)) {
          errors.push(`${cue.cueId}: actor PMD inexistente ${action.source.assetId}.`);
        }
      }
    }
  }
  return errors;
}

export function applyNarrativeStageAction(
  state: NarrativeStageState,
  action: NarrativeStageActionV1,
): NarrativeStageState {
  if (action.kind === 'setBackground') {
    return { ...state, backgroundAssetId: action.backgroundAssetId };
  }
  if (action.kind === 'enterActor') {
    return {
      ...state,
      actors: {
        ...state.actors,
        [action.actorId]: {
          actorId: action.actorId,
          source: action.source,
          poseAssetId: action.poseAssetId,
          transform: action.transform,
        },
      },
    };
  }
  if (action.kind === 'exitActor') {
    const actors = { ...state.actors };
    delete actors[action.actorId];
    return { ...state, actors };
  }
  if (action.kind === 'setActorPose') {
    const actor = state.actors[action.actorId];
    return actor ? {
      ...state,
      actors: {
        ...state.actors,
        [action.actorId]: { ...actor, poseAssetId: action.poseAssetId },
      },
    } : state;
  }
  if (action.kind === 'setActorAnimation') {
    const actor = state.actors[action.actorId];
    return actor?.source.kind === 'pmd' ? {
      ...state,
      actors: {
        ...state.actors,
        [action.actorId]: {
          ...actor,
          source: { ...actor.source, animationName: action.animationName },
        },
      },
    } : state;
  }
  if (action.kind === 'moveActor') {
    const actor = state.actors[action.actorId];
    return actor ? {
      ...state,
      actors: {
        ...state.actors,
        [action.actorId]: { ...actor, transform: action.transform },
      },
    } : state;
  }
  if (action.kind === 'playAudio') {
    return {
      ...state,
      playingAudio: { ...state.playingAudio, [action.channel]: action.audioAssetId },
    };
  }
  if (action.kind === 'stopAudio') {
    if (action.channel === 'all') return { ...state, playingAudio: {} };
    const playingAudio = { ...state.playingAudio };
    delete playingAudio[action.channel];
    return { ...state, playingAudio };
  }
  return state;
}

export function reconstructNarrativeStage(
  conversation: NarrativeConversationV1,
  cueId: string,
  selectedChoices: Readonly<Record<string, string>> = {},
) {
  let state: NarrativeStageState = { actors: {}, playingAudio: {} };
  const path = findNarrativeCuePath(conversation, cueId, selectedChoices);
  for (const cursor of path) {
    const cue = conversation.cues.find(candidate => candidate.cueId === cursor);
    if (!cue) continue;
    for (const action of cue.actions) {
      if (cursor !== cueId || action.phase !== 'afterText') {
        state = applyNarrativeStageAction(state, action);
      }
    }
    if (cursor === cueId) return state;
  }
  return state;
}

export function findNarrativeCuePath(
  conversation: NarrativeConversationV1,
  targetCueId: string,
  selectedChoices: Readonly<Record<string, string>> = {},
) {
  const cueById = new Map(conversation.cues.map(cue => [cue.cueId, cue]));
  const visit = (cueId: string, path: string[], visited: Set<string>): string[] | undefined => {
    if (visited.has(cueId)) return undefined;
    const cue = cueById.get(cueId);
    if (!cue) return undefined;
    const nextPath = [...path, cueId];
    if (cueId === targetCueId) return nextPath;
    const selectedChoice = cue.choices?.find(choice => (
      choice.choiceId === selectedChoices[cueId]
    ));
    const candidates = selectedChoice
      ? selectedChoice.nextCueId ? [selectedChoice.nextCueId] : []
      : [
        ...(cue.nextCueId ? [cue.nextCueId] : []),
        ...(cue.textInput?.nextCueId ? [cue.textInput.nextCueId] : []),
        ...(cue.choices ?? []).flatMap(choice => choice.nextCueId ? [choice.nextCueId] : []),
      ];
    const nextVisited = new Set(visited).add(cueId);
    for (const candidate of candidates) {
      const result = visit(candidate, nextPath, nextVisited);
      if (result) return result;
    }
    return undefined;
  };
  return visit(conversation.initialCueId, [], new Set()) ?? [targetCueId];
}

export function resolveNarrativeText(
  text: string,
  values: Partial<Record<string, string | number | boolean>>,
) {
  return text.replace(/\{\{\s*([a-zA-Z0-9:._-]+)\s*\}\}/gu, (_match, token: string) => (
    values[token] === undefined ? `{{${token}}}` : String(values[token])
  ));
}

export function buildNarrativeTokenValues(save: PokeVoiceSaveV1) {
  const values: Record<string, string | number | boolean> = {};
  const profile = save.pokeDiscover.trainerProfile;
  if (profile) {
    values['player.name'] = profile.displayName;
    values['player.avatar'] = profile.avatarId;
  }
  const companionFormId = save.activeExpeditionSession?.loadout?.companion.formId
    ?? save.activeExpeditionSession?.companionFormId;
  if (companionFormId) values['companion.name'] = companionFormId;
  const inventory = save.pokeDiscover.inventory;
  for (const itemId of [
    ...inventory.toolIds,
    ...inventory.keyItemIds,
    ...inventory.permissionIds,
    ...inventory.cosmeticIds,
  ]) values[`item:${itemId}`] = true;
  for (const [counterId, value] of Object.entries({
    ...save.pokeDiscover.globalCounters,
    ...save.activeExpeditionSession?.missionRuntime?.counters,
  })) values[`counter:${counterId}`] = value;
  for (const [flagId, value] of Object.entries({
    ...save.pokeDiscover.worldFlags,
    ...save.activeExpeditionSession?.missionRuntime?.flags,
  })) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      values[`flag:${flagId}`] = value;
    }
  }
  return values;
}

export const NARRATIVE_TOKEN_INSERTS: ReadonlyArray<{
  label: string;
  value: string;
  reference: NarrativeTokenReferenceV1;
}> = Object.freeze([
  { label: 'Nombre del jugador', value: '{{player.name}}', reference: { kind: 'playerName' } },
  { label: 'Avatar', value: '{{player.avatar}}', reference: { kind: 'playerAvatar' } },
  { label: 'Compañero', value: '{{companion.name}}', reference: { kind: 'companionName' } },
]);

function legacyPoseAssetId(speakerId: string, state: string) {
  const normalized = speakerId.replace(/^npc:/u, '').replace(/^professor-/u, 'professor-');
  return `narrative:character:${normalized}:${state}`;
}

export function migrateNarrativeSequence(
  sequence: NarrativeSequenceV1,
  title = sequence.sequenceId,
): NarrativeConversationV1 {
  return {
    schemaVersion: 1,
    conversationId: sequence.sequenceId,
    title,
    tags: ['migrated'],
    initialCueId: sequence.initialPageId,
    once: sequence.once,
    cues: sequence.pages.map((page, index) => {
      const actorId = page.speakerId;
      const poseAssetId = legacyPoseAssetId(actorId, page.portraitState);
      const actions: NarrativeStageActionV1[] = [];
      if (index === 0 && (page.backgroundId ?? sequence.backgroundId)) {
        actions.push({
          actionId: `${page.pageId}:action:background`,
          kind: 'setBackground',
          backgroundAssetId: `narrative:background:${page.backgroundId ?? sequence.backgroundId}`,
          transition: 'fade',
          phase: 'beforeText',
          durationMs: 250,
          blocking: true,
        });
      }
      if (index === 0) {
        actions.push({
          actionId: `${page.pageId}:action:enter:${actorId}`,
          kind: 'enterActor',
          actorId,
          source: { kind: 'illustration', assetId: poseAssetId },
          poseAssetId,
          transform: { slot: 'right' },
          motion: 'fade',
          phase: 'beforeText',
          durationMs: 200,
        });
      } else {
        actions.push({
          actionId: `${page.pageId}:action:pose:${actorId}`,
          kind: 'setActorPose',
          actorId,
          poseAssetId,
          phase: 'withText',
        });
      }
      return {
        cueId: page.pageId,
        kind: 'dialogue',
        speakerActorId: actorId,
        speakerName: page.speakerName,
        text: page.text,
        actions,
        nextCueId: page.nextPageId,
        choices: page.choices?.map(choice => ({
          choiceId: choice.choiceId,
          label: choice.label,
          nextCueId: choice.nextPageId,
          outcomeId: choice.nextPageId ? undefined : choice.action?.kind ?? 'completed',
          legacyAction: choice.action,
        })),
        textInput: page.textInput ? {
          inputId: page.textInput.inputId,
          label: page.textInput.label,
          variableId: 'player.name',
          maxLength: page.textInput.maxLength,
          submitLabel: page.textInput.submitLabel,
          nextCueId: page.textInput.nextPageId,
          legacyAction: page.textInput.action,
        } : undefined,
        legacyAction: page.action,
        outcomeId: !page.nextPageId && !page.choices?.length && !page.textInput
          ? page.action?.kind ?? 'completed'
          : undefined,
      };
    }),
  };
}

export function buildNarrativeManifest(
  documents: ReadonlyArray<{ document: NarrativeConversationV1; documentPath: string }>,
): NarrativeConversationManifestV1 {
  const used = new Set<string>();
  const conversations = documents.map(({ document, documentPath }) => {
    if (used.has(document.conversationId)) {
      throw new Error(`Conversación duplicada: ${document.conversationId}.`);
    }
    used.add(document.conversationId);
    return {
      schemaVersion: 1 as const,
      conversationId: document.conversationId,
      title: document.title,
      tags: [...document.tags].sort(),
      documentPath: documentPath.replaceAll('\\', '/'),
    };
  }).sort((left, right) => left.conversationId.localeCompare(right.conversationId));
  return { schemaVersion: 1, conversations };
}
