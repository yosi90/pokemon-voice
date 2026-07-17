import type {
  FieldCapabilityId,
  FieldCapabilityV1,
  FieldToolDefinitionV1,
  PokemonFormV1,
  PokeVoiceSaveV1,
} from '../../../packages/contracts/src/index.js';

export interface CapabilityContribution {
  kind: 'companion' | 'tool';
  sourceId: string;
  strength: number;
  tags: string[];
}

export interface ResolvedExpeditionCapability {
  id: FieldCapabilityId;
  strength: number;
  contributions: CapabilityContribution[];
}

export interface ResolveExpeditionCapabilitiesRequest {
  companionForm: PokemonFormV1;
  tools: readonly FieldToolDefinitionV1[];
  companionAdditionalCapabilities?: readonly FieldCapabilityV1[];
}

function contributionStrength(value: number | undefined) {
  return value ?? 1;
}

export function resolveExpeditionCapabilities(
  save: PokeVoiceSaveV1,
  request: ResolveExpeditionCapabilitiesRequest,
): ResolvedExpeditionCapability[] {
  const loadout = save.activeExpeditionSession?.loadout;
  if (!loadout) throw new Error('No existe un loadout de expedición activo y normalizado.');
  if (loadout.companion.formId !== request.companionForm.formId) {
    throw new Error('La forma del compañero no coincide con el loadout bloqueado.');
  }
  const tool = loadout.toolId
    ? request.tools.find(candidate => candidate.toolId === loadout.toolId)
    : undefined;
  if (loadout.toolId && !tool) throw new Error('La herramienta del loadout no existe en el catálogo de campo.');
  if (tool && !save.pokeDiscover.inventory.toolIds.includes(tool.toolId)) {
    throw new Error('La herramienta del loadout ya no pertenece al inventario del jugador.');
  }

  const byId = new Map<FieldCapabilityId, ResolvedExpeditionCapability>();
  const add = (
    capability: { id: FieldCapabilityId; strength?: number; tags?: string[] },
    contribution: Omit<CapabilityContribution, 'strength' | 'tags'>,
  ) => {
    const strength = contributionStrength(capability.strength);
    const current = byId.get(capability.id) ?? {
      id: capability.id,
      strength: 0,
      contributions: [],
    };
    byId.set(capability.id, {
      ...current,
      // Dos fuentes débiles no se suman: la escena debe declarar una fuerza suficiente por sí misma.
      strength: Math.max(current.strength, strength),
      contributions: [...current.contributions, {
        ...contribution,
        strength,
        tags: [...(capability.tags ?? [])],
      }],
    });
  };

  for (const capability of [
    ...request.companionForm.fieldCapabilities,
    ...(request.companionAdditionalCapabilities ?? []),
  ]) {
    add(capability, { kind: 'companion', sourceId: request.companionForm.formId });
  }
  for (const capability of tool?.capabilities ?? []) {
    add(capability, { kind: 'tool', sourceId: tool!.toolId });
  }

  return [...byId.values()];
}
