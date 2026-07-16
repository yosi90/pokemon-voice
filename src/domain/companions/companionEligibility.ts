import type {
  CompanionAccessRecordV1,
  CompanionRequirementV1,
  PokemonFormV1,
  PokemonSpeciesV1,
  PokeVoiceSaveV1,
  RequirementAtomV1,
} from '../../../packages/contracts/src/index.js';
import { evaluateRequirement } from '../requirements/evaluateRequirement.js';

export const FIRST_MISSION_ACHIEVEMENT_ID = 'first-mission';
export const DEFAULT_COMPANION_LEVEL_GAP = 5;

// Iniciales jugables en primera fase, incluidos Pikachu y Eevee por Let's Go.
export const FIRST_MISSION_EXEMPT_SPECIES_IDS = new Set([
  1, 4, 7, 25, 133, 152, 155, 158, 252, 255, 258, 387, 390, 393,
  495, 498, 501, 650, 653, 656, 722, 725, 728, 810, 813, 816, 906, 909, 912,
]);

export type CompanionEligibilityStatus = 'unregistered' | 'ineligible' | 'eligible';

export interface CompanionEligibilityResult {
  status: CompanionEligibilityStatus;
  qualifiedPreviously: boolean;
  unmetAtoms: RequirementAtomV1[];
  rejectionText?: string;
}

function matchesQualification(
  record: CompanionAccessRecordV1,
  definition: CompanionRequirementV1,
) {
  return record.qualificationId === definition.requirementId
    && record.speciesId === definition.speciesId
    && (record.formId === undefined || record.formId === definition.formId)
    && (record.appearanceId === undefined || record.appearanceId === definition.appearanceId);
}

export function evaluateCompanionEligibility({
  save,
  definition,
  form,
  species,
}: {
  save: PokeVoiceSaveV1;
  definition: CompanionRequirementV1;
  form: PokemonFormV1;
  species?: readonly PokemonSpeciesV1[];
}): CompanionEligibilityResult {
  if (!save.pokedexRun.registeredSpeciesIds.includes(definition.speciesId)) {
    return { status: 'unregistered', qualifiedPreviously: false, unmetAtoms: [] };
  }

  const qualifiedPreviously = save.pokeDiscover.companionQualifications
    .some(record => matchesQualification(record, definition));
  const unmetAtoms: RequirementAtomV1[] = [];
  const referenceMinimum = definition.ignoreReferenceLevelGap || form.companionReferenceLevel === undefined
    ? 1
    : Math.max(1, form.companionReferenceLevel - DEFAULT_COMPANION_LEVEL_GAP);
  const requiredLevel = Math.max(definition.minimumTrainerLevel, referenceMinimum);
  if (save.pokeDiscover.trainerLevel < requiredLevel) {
    unmetAtoms.push({ kind: 'trainerLevel', minimum: requiredLevel });
  }

  const firstMissionExempt = FIRST_MISSION_EXEMPT_SPECIES_IDS.has(definition.speciesId)
    && (form.evolutionStage === 1 || definition.speciesId === 25 || definition.speciesId === 133);
  if (!firstMissionExempt && !save.pokeDiscover.achievements[FIRST_MISSION_ACHIEVEMENT_ID]) {
    unmetAtoms.push({ kind: 'achievement', achievementId: FIRST_MISSION_ACHIEVEMENT_ID });
  }

  if (definition.requirement && !qualifiedPreviously) {
    const result = evaluateRequirement(definition.requirement, { save, species, companionForm: form });
    unmetAtoms.push(...result.unmetAtoms);
  }

  return {
    status: unmetAtoms.length === 0 ? 'eligible' : 'ineligible',
    qualifiedPreviously,
    unmetAtoms,
    ...(unmetAtoms.length > 0 ? {
      rejectionText: definition.visibility === 'public'
        ? definition.rejectionText
        : definition.loreHint ?? definition.rejectionText,
    } : {}),
  };
}

export function qualifyCompanionAccess(
  save: PokeVoiceSaveV1,
  definition: CompanionRequirementV1,
  qualifiedAt: string,
): PokeVoiceSaveV1 {
  if (Number.isNaN(Date.parse(qualifiedAt))) throw new Error('qualifiedAt debe ser una fecha ISO válida.');
  if (save.pokeDiscover.companionQualifications.some(record => matchesQualification(record, definition))) {
    return save;
  }
  const record: CompanionAccessRecordV1 = {
    schemaVersion: 1,
    speciesId: definition.speciesId,
    ...(definition.formId ? { formId: definition.formId } : {}),
    ...(definition.appearanceId ? { appearanceId: definition.appearanceId } : {}),
    qualificationId: definition.requirementId,
    qualifiedAt: new Date(qualifiedAt).toISOString(),
    originRunId: save.pokedexRun.runId,
  };
  return {
    ...save,
    pokeDiscover: {
      ...save.pokeDiscover,
      companionQualifications: [...save.pokeDiscover.companionQualifications, record],
    },
  };
}

export type SelectCompanionResult =
  | { status: 'selected'; save: PokeVoiceSaveV1 }
  | { status: 'ineligible'; save: PokeVoiceSaveV1; eligibility: CompanionEligibilityResult }
  | { status: 'expeditionActive'; save: PokeVoiceSaveV1 };

export function selectCompanion({
  save,
  definition,
  form,
  species,
  selectedAt,
}: {
  save: PokeVoiceSaveV1;
  definition: CompanionRequirementV1;
  form: PokemonFormV1;
  species?: readonly PokemonSpeciesV1[];
  selectedAt: string;
}): SelectCompanionResult {
  if (save.activeExpeditionSession) return { status: 'expeditionActive', save };
  const eligibility = evaluateCompanionEligibility({ save, definition, form, species });
  if (eligibility.status !== 'eligible') return { status: 'ineligible', save, eligibility };
  const qualified = definition.requirement
    ? qualifyCompanionAccess(save, definition, selectedAt)
    : save;
  const previousSelection = qualified.pokedexRun.selectedCompanion
    ?? (qualified.pokedexRun.selectedCompanionFormId
      ? { schemaVersion: 1 as const, formId: qualified.pokedexRun.selectedCompanionFormId }
      : undefined);
  const changed = previousSelection?.formId !== form.formId
    || previousSelection.appearanceId !== definition.appearanceId;
  const selectedVariantId = definition.appearanceId ?? form.formId;
  const selectionCounterId = `companionSelections:${selectedVariantId}`;
  return {
    status: 'selected',
    save: {
      ...qualified,
      pokedexRun: {
        ...qualified.pokedexRun,
        selectedCompanion: {
          schemaVersion: 1,
          formId: form.formId,
          ...(definition.appearanceId ? { appearanceId: definition.appearanceId } : {}),
        },
        selectedCompanionFormId: form.formId,
      },
      pokeDiscover: changed ? {
        ...qualified.pokeDiscover,
        globalCounters: {
          ...qualified.pokeDiscover.globalCounters,
          'companionSelections:total': (qualified.pokeDiscover.globalCounters['companionSelections:total'] ?? 0) + 1,
          [selectionCounterId]: (qualified.pokeDiscover.globalCounters[selectionCounterId] ?? 0) + 1,
        },
      } : qualified.pokeDiscover,
    },
  };
}
