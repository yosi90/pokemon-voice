import type {
  CompanionResearchFactV1,
  CompanionSelectionV1,
  ExpeditionEntrySnapshotV1,
  ExpeditionRollbackSnapshotV1,
  ExpeditionLoadoutV1,
  PokeVoiceSaveV1,
  MeaningfulExpeditionInteractionKind,
} from '../../../packages/contracts/src/index.js';
import { discoverResearchFact } from '../research/researchProgress.js';

export type ExpeditionStartErrorCode =
  | 'activeMode'
  | 'expeditionAlreadyActive'
  | 'missingCompanion'
  | 'toolNotOwned'
  | 'invalidDate';

export class ExpeditionStartError extends Error {
  constructor(
    public readonly code: ExpeditionStartErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ExpeditionStartError';
  }
}

export interface BeginExpeditionRequest {
  mapId: string;
  toolId?: string;
  enteredAt: string;
  missionId?: string;
}

export interface ExpeditionReportV1 {
  mapId: string;
  missionId?: string;
  newSecretIds: string[];
  newNpcIds: string[];
  newConversationIds: string[];
  newCollectibleIds: string[];
  newHintIds: string[];
  newRouteIds: string[];
  newResearchFactIds: string[];
  trainerExperienceGained: number;
  discoveryPointsGained: number;
  meaningfulInteractionCount: number;
  companionResearchFactId?: string;
}

function normalizeSelectedCompanion(save: PokeVoiceSaveV1): CompanionSelectionV1 | undefined {
  const selected = save.pokedexRun.selectedCompanion;
  if (selected?.formId) return { ...selected };
  const legacyFormId = save.pokedexRun.selectedCompanionFormId;
  return legacyFormId
    ? { schemaVersion: 1, formId: legacyFormId }
    : undefined;
}

function collectResearchFactIds(save: PokeVoiceSaveV1) {
  const ids: string[] = [];
  for (const progress of Object.values(save.pokeDiscover.researchBySpecies)) {
    ids.push(...progress.additionalNoteIds);
    for (const field of Object.values(progress.fields)) ids.push(...field.discoveredFactIds);
  }
  return ids;
}

function createEntrySnapshot(save: PokeVoiceSaveV1, mapId: string): ExpeditionEntrySnapshotV1 {
  const progress = save.pokeDiscover.mapProgress[mapId];
  return {
    schemaVersion: 1,
    secretIds: [...(progress?.unlockedSecretIds ?? [])],
    npcIds: [...(progress?.knownNpcIds ?? [])],
    conversationIds: [...(progress?.conversationIds ?? [])],
    collectibleIds: [...(progress?.collectibleIds ?? [])],
    hintIds: [...(progress?.knownHintIds ?? [])],
    routeIds: [...(progress?.unlockedRouteIds ?? [])],
    researchFactIds: collectResearchFactIds(save),
    trainerExperience: save.pokeDiscover.trainerExperience,
    discoveryPoints: save.pokeDiscover.discoveryPoints,
  };
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createExpeditionRollbackSnapshot(
  save: PokeVoiceSaveV1,
): ExpeditionRollbackSnapshotV1 {
  const { trainerProfile: _trainerProfile, ...pokeDiscover } = save.pokeDiscover;
  return {
    schemaVersion: 1,
    pokedexRun: cloneJson(save.pokedexRun),
    pokeDiscover: cloneJson(pokeDiscover),
  };
}

export function restoreExpeditionRollbackSnapshot(
  save: PokeVoiceSaveV1,
  snapshot: ExpeditionRollbackSnapshotV1,
): PokeVoiceSaveV1 {
  const trainerProfile = save.pokeDiscover.trainerProfile;
  return {
    ...save,
    pokedexRun: cloneJson(snapshot.pokedexRun),
    pokeDiscover: {
      ...cloneJson(snapshot.pokeDiscover),
      ...(trainerProfile ? { trainerProfile } : {}),
    },
  };
}

export function beginExpedition(
  save: PokeVoiceSaveV1,
  request: BeginExpeditionRequest,
): PokeVoiceSaveV1 {
  if (save.activeModeSession) {
    throw new ExpeditionStartError(
      'activeMode',
      'No se puede iniciar una expedición mientras hay un modo de juego activo.',
    );
  }
  if (save.activeExpeditionSession) {
    throw new ExpeditionStartError(
      'expeditionAlreadyActive',
      'Hay que abandonar la expedición actual antes de preparar otra.',
    );
  }

  const companion = normalizeSelectedCompanion(save);
  if (!companion) {
    throw new ExpeditionStartError(
      'missingCompanion',
      'Debes elegir exactamente un compañero antes de entrar.',
    );
  }
  const requestedToolId = request.toolId?.trim() || undefined;
  const rememberedToolId = save.pokeDiscover.inventory.selectedToolId;
  const toolId = requestedToolId
    ?? (rememberedToolId && save.pokeDiscover.inventory.toolIds.includes(rememberedToolId)
      ? rememberedToolId
      : undefined);
  if (toolId && !save.pokeDiscover.inventory.toolIds.includes(toolId)) {
    throw new ExpeditionStartError(
      'toolNotOwned',
      'La herramienta elegida no pertenece al inventario de PokeDiscover.',
    );
  }
  if (Number.isNaN(Date.parse(request.enteredAt))) {
    throw new ExpeditionStartError('invalidDate', 'enteredAt debe ser una fecha ISO válida.');
  }
  if (!request.mapId?.trim()) throw new Error('mapId debe ser un identificador estable no vacío.');

  const loadout: ExpeditionLoadoutV1 = {
    schemaVersion: 1,
    companion,
    ...(toolId ? { toolId } : {}),
  };

  return {
    ...save,
    pokeDiscover: toolId && save.pokeDiscover.inventory.selectedToolId !== toolId
      ? {
        ...save.pokeDiscover,
        inventory: { ...save.pokeDiscover.inventory, selectedToolId: toolId },
      }
      : save.pokeDiscover,
    activeExpeditionSession: {
      schemaVersion: 1,
      mapId: request.mapId,
      enteredAt: new Date(request.enteredAt).toISOString(),
      ...(request.missionId ? { missionId: request.missionId } : {}),
      loadout,
      evaluatedEncounterResults: {},
      completedBehaviorTriggerIds: [],
      completedMapEventTriggerIds: [],
      meaningfulInteractionIds: [],
      meaningfulInteractionKinds: [],
      entrySnapshot: createEntrySnapshot(save, request.mapId),
      entryRollbackSnapshot: createExpeditionRollbackSnapshot(save),
    },
  };
}

export function endExpedition(save: PokeVoiceSaveV1): PokeVoiceSaveV1 {
  return endExpeditionWithReport(save).save;
}

export interface RecordMeaningfulInteractionRequest {
  interactionId: string;
  kind: MeaningfulExpeditionInteractionKind;
}

export function recordMeaningfulExpeditionInteraction(
  save: PokeVoiceSaveV1,
  request: RecordMeaningfulInteractionRequest,
): PokeVoiceSaveV1 {
  const session = save.activeExpeditionSession;
  if (!session) throw new Error('No existe una expedición activa.');
  if (!request.interactionId?.trim()) throw new Error('interactionId debe ser un identificador estable no vacío.');
  const ids = session.meaningfulInteractionIds ?? [];
  if (ids.includes(request.interactionId)) return save;
  return {
    ...save,
    activeExpeditionSession: {
      ...session,
      meaningfulInteractionIds: [...ids, request.interactionId],
      meaningfulInteractionKinds: [...(session.meaningfulInteractionKinds ?? []), request.kind],
    },
  };
}

export interface EndExpeditionOptions {
  exitedAt?: string;
  companionResearchFact?: CompanionResearchFactV1;
}

function addedSince(current: readonly string[], previous: readonly string[]) {
  const known = new Set(previous);
  return current.filter(id => !known.has(id));
}

export function endExpeditionWithReport(save: PokeVoiceSaveV1, options: EndExpeditionOptions = {}): {
  save: PokeVoiceSaveV1;
  report?: ExpeditionReportV1;
} {
  const session = save.activeExpeditionSession;
  if (!session) return { save };
  let resolvedSave = save;
  let companionResearchFactId: string | undefined;
  const meaningfulInteractionCount = session.meaningfulInteractionIds?.length ?? 0;
  const companionFactAlreadyKnown = options.companionResearchFact
    ? collectResearchFactIds(save).includes(options.companionResearchFact.factId)
    : false;
  if (options.companionResearchFact && meaningfulInteractionCount > 0 && !companionFactAlreadyKnown) {
    if (!options.exitedAt || Number.isNaN(Date.parse(options.exitedAt))) {
      throw new Error('exitedAt debe ser una fecha ISO válida al resolver investigación del compañero.');
    }
    const fact = options.companionResearchFact;
    const completed = save.pokeDiscover.researchBySpecies[fact.speciesId]?.fields[fact.field].completed ?? false;
    const result = discoverResearchFact(save.pokeDiscover, {
      schemaVersion: 1,
      factId: fact.factId,
      speciesId: fact.speciesId,
      field: fact.field,
      contribution: completed ? 'additionalNote' : 'fieldCompletion',
      mapId: session.mapId,
      interactionId: `companion-expedition:${fact.factId}`,
      text: fact.text,
      rewards: fact.rewards,
    }, {
      discoveredAt: options.exitedAt,
      runId: save.pokedexRun.runId,
      ...(session.missionId ? { missionId: session.missionId } : {}),
    });
    resolvedSave = { ...save, pokeDiscover: result.state };
    if (result.status === 'discovered') companionResearchFactId = fact.factId;
  }
  const current = resolvedSave.pokeDiscover.mapProgress[session.mapId];
  // Un guardado provisional sin snapshot no debe presentar todo el historial como recién descubierto.
  const snapshot = session.entrySnapshot ?? createEntrySnapshot(save, session.mapId);
  const report: ExpeditionReportV1 = {
    mapId: session.mapId,
    ...(session.missionId ? { missionId: session.missionId } : {}),
    newSecretIds: addedSince(current?.unlockedSecretIds ?? [], snapshot.secretIds),
    newNpcIds: addedSince(current?.knownNpcIds ?? [], snapshot.npcIds),
    newConversationIds: addedSince(current?.conversationIds ?? [], snapshot.conversationIds),
    newCollectibleIds: addedSince(current?.collectibleIds ?? [], snapshot.collectibleIds),
    newHintIds: addedSince(current?.knownHintIds ?? [], snapshot.hintIds),
    newRouteIds: addedSince(current?.unlockedRouteIds ?? [], snapshot.routeIds),
    newResearchFactIds: addedSince(collectResearchFactIds(resolvedSave), snapshot.researchFactIds),
    trainerExperienceGained: Math.max(
      0,
      resolvedSave.pokeDiscover.trainerExperience - snapshot.trainerExperience,
    ),
    discoveryPointsGained: Math.max(
      0,
      resolvedSave.pokeDiscover.discoveryPoints - snapshot.discoveryPoints,
    ),
    meaningfulInteractionCount,
    ...(companionResearchFactId ? { companionResearchFactId } : {}),
  };
  return { save: { ...resolvedSave, activeExpeditionSession: undefined }, report };
}

export function isExpeditionLoadoutLocked(save: PokeVoiceSaveV1) {
  return Boolean(save.activeExpeditionSession);
}
