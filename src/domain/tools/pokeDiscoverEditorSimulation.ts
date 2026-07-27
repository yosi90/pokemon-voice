import type {
  AdventureMapV3,
  ExpressionInputMethod,
  JsonValue,
  RequirementAtomV1,
} from '../../../packages/contracts/src/index.js';
import { POKE_DISCOVER_FIELD_TOOLS } from '../../data/adventure/pokeDiscoverShop.js';
import {
  COMPANION_GAMEPLAY_SPECIES,
  toCompanionForm,
  toCompanionSpecies,
} from '../companions/companionGameplayCatalog.js';
import { resolveExpeditionCapabilities } from '../expeditions/expeditionCapabilities.js';
import { beginExpedition } from '../expeditions/expeditionSession.js';
import { createPokeVoiceSaveV1 } from '../progress/pokeVoiceSave.js';
import { evaluateRequirement } from '../requirements/evaluateRequirement.js';
import {
  listAdventureRequirementTargets,
  requirementTargetKey,
  type AdventureRequirementTarget,
} from './pokeDiscoverEditorRequirements.js';

export interface PokeDiscoverEditorSimulationConfig {
  trainerLevel: number;
  registeredSpeciesIds: number[];
  sightedSpeciesIds: number[];
  companionVariantId?: string;
  toolId?: string;
  inventoryItemIds: string[];
  worldFlags: Record<string, JsonValue>;
  inputMethod: ExpressionInputMethod;
}

export interface PokeDiscoverEditorSimulationResult {
  target: AdventureRequirementTarget;
  targetKey: string;
  requirementMet: boolean;
  methodAvailable: boolean;
  available: boolean;
  unmetAtoms: RequirementAtomV1[];
}

function uniquePositiveIntegers(values: readonly number[]) {
  return [...new Set(values.filter(value => Number.isSafeInteger(value) && value > 0))];
}

export function simulatePokeDiscoverEditorRequirements(
  adventure: AdventureMapV3,
  config: PokeDiscoverEditorSimulationConfig,
): PokeDiscoverEditorSimulationResult[] {
  const entry = config.companionVariantId
    ? COMPANION_GAMEPLAY_SPECIES.flatMap(species => species.forms.flatMap(form => [
      ...(form.formId === config.companionVariantId ? [{ species, form, appearance: undefined }] : []),
      ...form.appearances.filter(appearance => appearance.appearanceId === config.companionVariantId)
        .map(appearance => ({ species, form, appearance })),
    ])).at(0)
    : undefined;
  const companionForm = entry ? toCompanionForm(entry.form, entry.appearance) : undefined;
  const registeredSpeciesIds = uniquePositiveIntegers(config.registeredSpeciesIds);
  const tool = POKE_DISCOVER_FIELD_TOOLS.find(candidate => candidate.toolId === config.toolId);
  const base = createPokeVoiceSaveV1({ runId: 'run:pokediscover-editor-simulation', now: 0 });
  let save = {
    ...base,
    pokedexRun: {
      ...base.pokedexRun,
      registeredSpeciesIds,
      discoveryOrder: registeredSpeciesIds,
      ...(entry ? { selectedCompanion: {
        schemaVersion: 1 as const,
        formId: entry.form.formId,
        ...(entry.appearance ? { appearanceId: entry.appearance.appearanceId } : {}),
      } } : {}),
    },
    pokeDiscover: {
      ...base.pokeDiscover,
      trainerLevel: Math.max(1, Math.round(config.trainerLevel) || 1),
      sightings: uniquePositiveIntegers(config.sightedSpeciesIds),
      worldFlags: { ...config.worldFlags },
      inventory: {
        ...base.pokeDiscover.inventory,
        toolIds: tool ? [tool.toolId] : [],
        keyItemIds: [...new Set(config.inventoryItemIds.filter(Boolean))],
      },
    },
  };
  let expeditionCapabilities: ReadonlyArray<{ id: string; strength?: number }> | undefined;
  if (companionForm) {
    save = beginExpedition(save, {
      mapId: adventure.mapId,
      ...(tool ? { toolId: tool.toolId } : {}),
      enteredAt: new Date(0).toISOString(),
    });
    expeditionCapabilities = resolveExpeditionCapabilities(save, {
      companionForm,
      tools: POKE_DISCOVER_FIELD_TOOLS,
    });
  }
  const species = COMPANION_GAMEPLAY_SPECIES.map(toCompanionSpecies);
  return listAdventureRequirementTargets(adventure).map(target => {
    const evaluation = evaluateRequirement(target.expression, {
      save,
      species,
      ...(companionForm ? { companionForm } : {}),
      ...(expeditionCapabilities ? { expeditionCapabilities } : {}),
    });
    const expressionTrigger = target.source === 'expressionTrigger'
      ? adventure.expressionTriggers.find(candidate => candidate.triggerId === target.definitionId)
      : undefined;
    const methodAvailable = expressionTrigger?.inputMethods.includes(config.inputMethod) ?? true;
    return {
      target,
      targetKey: requirementTargetKey(target),
      requirementMet: evaluation.met,
      methodAvailable,
      available: evaluation.met && methodAvailable,
      unmetAtoms: evaluation.unmetAtoms,
    };
  });
}
