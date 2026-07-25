import { describe, expect, it } from 'vitest';
import type {
  FieldToolDefinitionV1,
  PokemonFormV1,
  RequirementExpressionV1,
} from '../../packages/contracts/src/index.js';
import { resolveExpeditionCapabilities } from '../../src/domain/expeditions/expeditionCapabilities.js';
import { beginExpedition } from '../../src/domain/expeditions/expeditionSession.js';
import { createPokeVoiceSaveV1 } from '../../src/domain/progress/pokeVoiceSave.js';
import { evaluateRequirement } from '../../src/domain/requirements/evaluateRequirement.js';
import {
  getCompanionFormProfile,
  toCompanionForm,
} from '../../src/domain/companions/companionGameplayCatalog.js';

const bulbasaur: PokemonFormV1 = {
  schemaVersion: 1,
  formId: 'pokemon-form:1:default',
  speciesId: 1,
  slug: 'bulbasaur',
  displayName: 'Bulbasaur',
  kind: 'default',
  types: ['grass', 'poison'],
  evolutionStage: 1,
  sizeClass: 'small',
  narrativeTags: ['vines'],
  fieldCapabilities: [{ id: 'cut', source: 'biology', strength: 1 }],
};

const tools: FieldToolDefinitionV1[] = [
  {
    schemaVersion: 1,
    toolId: 'tool:boat',
    displayName: 'Bote plegable',
    capabilities: [{ id: 'surf', strength: 1, tags: ['water-crossing'] }],
  },
  {
    schemaVersion: 1,
    toolId: 'tool:shovel',
    displayName: 'Pala de campo',
    capabilities: [{ id: 'dig', strength: 1 }],
  },
];

function createActiveSave(toolId = 'tool:boat') {
  const save = createPokeVoiceSaveV1({ runId: 'run:capabilities', now: Date.now() });
  const prepared = {
    ...save,
    pokedexRun: {
      ...save.pokedexRun,
      registeredSpeciesIds: [1],
      selectedCompanion: { schemaVersion: 1 as const, formId: bulbasaur.formId },
    },
    pokeDiscover: {
      ...save.pokeDiscover,
      inventory: { ...save.pokeDiscover.inventory, toolIds: ['tool:boat', 'tool:shovel'] },
    },
  };
  return beginExpedition(prepared, {
    mapId: 'map:kanto:river-grove',
    toolId,
    enteredAt: new Date().toISOString(),
  });
}

describe('capacidades combinadas de expedición', () => {
  it('publica Tumba Rocas como capacidad narrativa curada de Geodude', () => {
    const profile = getCompanionFormProfile('pokemon-form:74:default');
    expect(profile).toBeDefined();
    const form = toCompanionForm(profile!.form);

    expect(form.fieldCapabilities).toContainEqual({
      id: 'rock-tomb',
      source: 'move',
      strength: 1,
      tags: ['loose-rock', 'seal-passage'],
    });
    expect(evaluateRequirement(
      { kind: 'fieldCapability', capabilityId: 'rock-tomb', minimumStrength: 1 },
      { save: createPokeVoiceSaveV1({ runId: 'run:rock-tomb', now: 1 }), companionForm: form },
    ).met).toBe(true);
  });

  it('combina bote y compañero para resolver surf + cut', () => {
    const save = createActiveSave();
    const capabilities = resolveExpeditionCapabilities(save, { companionForm: bulbasaur, tools });
    const requirement: RequirementExpressionV1 = { all: [
      { kind: 'fieldCapability', capabilityId: 'surf' },
      { kind: 'fieldCapability', capabilityId: 'cut' },
    ] };

    expect(evaluateRequirement(requirement, {
      save,
      companionForm: bulbasaur,
      expeditionCapabilities: capabilities,
    }).met).toBe(true);
    expect(capabilities).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'cut', contributions: [expect.objectContaining({ kind: 'companion' })] }),
      expect.objectContaining({ id: 'surf', contributions: [expect.objectContaining({ kind: 'tool' })] }),
    ]));
  });

  it('una herramienta física no sustituye especie, tipo o etiqueta del compañero', () => {
    const save = createActiveSave();
    const capabilities = resolveExpeditionCapabilities(save, { companionForm: bulbasaur, tools });

    expect(evaluateRequirement({ all: [
      { kind: 'fieldCapability', capabilityId: 'surf' },
      { kind: 'companionSpecies', speciesId: 7 },
    ] }, { save, companionForm: bulbasaur, expeditionCapabilities: capabilities }).met).toBe(false);
    expect(evaluateRequirement(
      { kind: 'companionType', typeId: 'water' },
      { save, companionForm: bulbasaur, expeditionCapabilities: capabilities },
    ).met).toBe(false);
  });

  it('conserva capacidades adicionales de una apariencia sin convertirla en forma', () => {
    const save = createActiveSave();
    const capabilities = resolveExpeditionCapabilities(save, {
      companionForm: bulbasaur,
      tools,
      companionAdditionalCapabilities: [
        { id: 'light', source: 'story', strength: 2, tags: ['event-appearance'] },
      ],
    });

    expect(capabilities).toContainEqual(expect.objectContaining({ id: 'light', strength: 2 }));
  });

  it('rechaza datos que intenten cambiar el loadout bloqueado', () => {
    const save = createActiveSave('tool:shovel');
    const otherForm = { ...bulbasaur, formId: 'pokemon-form:2:default' };

    expect(() => resolveExpeditionCapabilities(save, { companionForm: otherForm, tools }))
      .toThrow('La forma del compañero no coincide con el loadout bloqueado.');
    expect(() => resolveExpeditionCapabilities(save, { companionForm: bulbasaur, tools: [tools[0]] }))
      .toThrow('La herramienta del loadout no existe en el catálogo de campo.');
  });
});
