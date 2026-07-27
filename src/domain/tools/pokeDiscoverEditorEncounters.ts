import type {
  AdventureActorPlacementV3,
  AdventureMapV3,
  MapVariantV1,
  RareEncounterDefinitionV1,
  WorldEventV1,
} from '../../../packages/contracts/src/index.js';
import { DEFAULT_GUARANTEED_ELIGIBLE_VISIT } from '../expeditions/rareEncounter.js';

export function rareEncounterProbabilityForVisit(
  definition: RareEncounterDefinitionV1,
  eligibleVisit: number,
) {
  const guarantee = definition.guaranteedEligibleVisit ?? DEFAULT_GUARANTEED_ELIGIBLE_VISIT;
  return eligibleVisit >= guarantee ? 1 : Math.min(1, definition.baseProbability * eligibleVisit);
}

export function updateEditorDeterministicEncounter(
  adventure: AdventureMapV3,
  placement: AdventureActorPlacementV3,
): AdventureMapV3 {
  return {
    ...adventure,
    actorPlacements: adventure.actorPlacements.map(candidate => (
      candidate.placementId === placement.placementId ? placement : candidate
    )),
    requiredAssetIds: adventure.requiredAssetIds.includes(placement.assetId)
      ? adventure.requiredAssetIds
      : [...adventure.requiredAssetIds, placement.assetId],
  };
}

export function upsertEditorRareEncounter(
  adventure: AdventureMapV3,
  definition: RareEncounterDefinitionV1,
): AdventureMapV3 {
  const exists = adventure.rareEncounters.some(candidate => candidate.encounterId === definition.encounterId);
  return {
    ...adventure,
    rareEncounters: exists
      ? adventure.rareEncounters.map(candidate => candidate.encounterId === definition.encounterId ? definition : candidate)
      : [...adventure.rareEncounters, definition],
  };
}

export function upsertEditorMapVariant(adventure: AdventureMapV3, variant: MapVariantV1): AdventureMapV3 {
  const exists = adventure.variants.some(candidate => candidate.variantId === variant.variantId);
  return {
    ...adventure,
    variants: exists
      ? adventure.variants.map(candidate => candidate.variantId === variant.variantId ? variant : candidate)
      : [...adventure.variants, variant],
  };
}

export function upsertEditorWorldEvent(adventure: AdventureMapV3, event: WorldEventV1): AdventureMapV3 {
  const exists = (adventure.worldEvents ?? []).some(candidate => candidate.eventId === event.eventId);
  return {
    ...adventure,
    worldEvents: exists
      ? (adventure.worldEvents ?? []).map(candidate => candidate.eventId === event.eventId ? event : candidate)
      : [...(adventure.worldEvents ?? []), event],
  };
}
