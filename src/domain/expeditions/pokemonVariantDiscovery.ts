import type {
  AppearanceDiscoveryRecordV1,
  FormDiscoveryRecordV1,
  PokeDiscoverStateV1,
} from '../../../packages/contracts/src/index.js';

export interface RecordPokemonVariantDiscoveryRequest {
  speciesId: number;
  formId?: string;
  appearanceId?: string;
  discoveredAt: string;
  originMapId: string;
  originMissionId?: string;
  originEncounterId: string;
  noteIds?: readonly string[];
}

export interface RecordPokemonVariantDiscoveryResult {
  status: 'discovered' | 'alreadyDiscovered';
  state: PokeDiscoverStateV1;
  form: FormDiscoveryRecordV1;
  appearance?: AppearanceDiscoveryRecordV1;
}

function requireStableId(value: string | undefined, field: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} debe ser un identificador estable no vacío.`);
  }
}

function normalizeNoteIds(noteIds: readonly string[] | undefined) {
  const normalized = [...new Set(noteIds ?? [])];
  normalized.forEach(noteId => requireStableId(noteId, 'noteId'));
  return normalized;
}

function assertCompatibleForm(record: FormDiscoveryRecordV1, speciesId: number) {
  if (record.speciesId !== speciesId) {
    throw new Error(`La forma ${record.formId} ya pertenece a otra especie.`);
  }
}

function assertCompatibleAppearance(
  record: AppearanceDiscoveryRecordV1,
  speciesId: number,
  formId: string,
) {
  if (record.speciesId !== speciesId || record.formId !== formId) {
    throw new Error(`La apariencia ${record.appearanceId} ya pertenece a otra especie o forma.`);
  }
}

export function recordPokemonVariantDiscovery(
  current: PokeDiscoverStateV1,
  request: RecordPokemonVariantDiscoveryRequest,
): RecordPokemonVariantDiscoveryResult {
  if (!Number.isSafeInteger(request.speciesId) || request.speciesId <= 0) {
    throw new Error('speciesId debe ser un entero positivo.');
  }
  requireStableId(request.originMapId, 'originMapId');
  requireStableId(request.originEncounterId, 'originEncounterId');
  if (request.originMissionId !== undefined) requireStableId(request.originMissionId, 'originMissionId');
  if (Number.isNaN(Date.parse(request.discoveredAt))) {
    throw new Error('discoveredAt debe ser una fecha ISO válida.');
  }

  const formId = request.formId ?? `pokemon-form:${request.speciesId}:default`;
  requireStableId(formId, 'formId');
  if (request.appearanceId !== undefined) requireStableId(request.appearanceId, 'appearanceId');
  const noteIds = normalizeNoteIds(request.noteIds);
  const existingForm = current.discoveredForms[formId];
  if (existingForm) assertCompatibleForm(existingForm, request.speciesId);
  const existingAppearance = request.appearanceId
    ? current.discoveredAppearances[request.appearanceId]
    : undefined;
  if (existingAppearance) assertCompatibleAppearance(existingAppearance, request.speciesId, formId);

  if (existingForm && (!request.appearanceId || existingAppearance)) {
    const state = current.sightings.includes(request.speciesId)
      ? current
      : { ...current, sightings: [...current.sightings, request.speciesId] };
    return {
      status: 'alreadyDiscovered',
      state,
      form: existingForm,
      ...(existingAppearance ? { appearance: existingAppearance } : {}),
    };
  }

  const discoveredAt = new Date(request.discoveredAt).toISOString();
  const provenance = {
    originMapId: request.originMapId,
    ...(request.originMissionId ? { originMissionId: request.originMissionId } : {}),
    originEncounterId: request.originEncounterId,
  };
  const form: FormDiscoveryRecordV1 = existingForm ?? {
    schemaVersion: 1,
    formId,
    speciesId: request.speciesId,
    discoveredAt,
    noteIds,
    ...provenance,
  };
  const appearance: AppearanceDiscoveryRecordV1 | undefined = request.appearanceId
    ? existingAppearance ?? {
      schemaVersion: 1,
      appearanceId: request.appearanceId,
      formId,
      speciesId: request.speciesId,
      discoveredAt,
      noteIds,
      ...provenance,
    }
    : undefined;

  return {
    status: 'discovered',
    form,
    ...(appearance ? { appearance } : {}),
    state: {
      ...current,
      sightings: current.sightings.includes(request.speciesId)
        ? current.sightings
        : [...current.sightings, request.speciesId],
      discoveredForms: existingForm
        ? current.discoveredForms
        : { ...current.discoveredForms, [formId]: form },
      discoveredAppearances: appearance && !existingAppearance
        ? { ...current.discoveredAppearances, [appearance.appearanceId]: appearance }
        : current.discoveredAppearances,
    },
  };
}
