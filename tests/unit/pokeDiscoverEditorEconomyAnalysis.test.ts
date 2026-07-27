import { describe, expect, it } from 'vitest';
import type {
  AdventureMapV3,
  MissionDefinitionV1,
  PokeDiscoverShopContentV1,
  ShopOfferV1,
} from '../../packages/contracts/src/index.js';
import { analyzePokeDiscoverEditorEconomy } from '../../src/domain/tools/pokeDiscoverEditorEconomyAnalysis.js';

function adventure(): AdventureMapV3 {
  return {
    schemaVersion: 3,
    mapId: 'map:test:economy',
    title: 'Balance económico',
    tiledMapAssets: [], sectors: [], transitions: [], requiredAssetIds: [], ambientSequences: [], companionSequences: [], rareEncounters: [], interactions: [], dialogues: [], fieldNotebookHints: [],
    actorPlacements: [], characterPlacements: [], variants: [], behaviorTriggers: [], expressionTriggers: [], worldEvents: [], missionIds: [],
    researchFacts: [{
      schemaVersion: 1,
      factId: 'fact:starter',
      speciesId: 1,
      field: 'behavior',
      contribution: 'observation',
      mapId: 'map:test:economy',
      interactionId: 'interaction:starter',
      text: 'Una observación accesible.',
      requirement: { kind: 'trainerLevel', minimum: 1 },
      rewards: [{ kind: 'trainerExperience', amount: 25 }, { kind: 'discoveryPoints', amount: 10 }],
    }],
  } as AdventureMapV3;
}

function mandatoryMission(requirement: MissionDefinitionV1['objectives'][number]['requirement']): MissionDefinitionV1 {
  return {
    schemaVersion: 1,
    missionId: 'mission:test:mandatory',
    mapId: 'map:test:economy',
    title: 'Encargo obligatorio',
    loadingText: 'Preparando encargo',
    briefing: 'Completa el objetivo.',
    objectives: [{ objectiveId: 'objective:test:mandatory', description: 'Abrir el paso', requirement }],
    mapVariantIds: [],
    rewards: [],
    unlocksFreeExpedition: true,
  };
}

const keyItem: PokeDiscoverShopContentV1 = {
  schemaVersion: 1,
  category: 'keyItem',
  contentId: 'key-item:test-pass',
  keyItemId: 'key-item:test-pass',
  displayName: 'Pase de prueba',
  description: 'Abre el paso de prueba.',
  unlockHint: 'Disponible en la tienda.',
};

const keyItemOffer: ShopOfferV1 = {
  schemaVersion: 1,
  offerId: 'offer:key-item:test-pass',
  category: 'keyItem',
  contentId: keyItem.contentId,
  discoveryPointCost: 90,
  optionalContentOnly: true,
};

describe('análisis económico del editor PokeDiscover', () => {
  it('advierte cuando el contenido previo no alcanza el nivel obligatorio', () => {
    const candidate = adventure();
    candidate.variants.push({ variantId: 'variant:level-gate', requirement: { kind: 'trainerLevel', minimum: 3 } });

    const result = analyzePokeDiscoverEditorEconomy(candidate, { trainerLevelThresholds: [0, 50, 100] });

    expect(result.trainerExperience).toBe(25);
    expect(result.reachableTrainerLevel).toBe(1);
    expect(result.warnings).toContainEqual(expect.objectContaining({
      kind: 'insufficientExperience',
      sourceId: 'variant:level-gate',
      message: expect.stringContaining('solo aporta 25 EXP'),
    }));
  });

  it('respeta una alternativa any que evita el nivel alto', () => {
    const candidate = adventure();
    candidate.variants.push({ variantId: 'variant:alternative', requirement: { any: [
      { kind: 'trainerLevel', minimum: 3 },
      { kind: 'companionSpecies', speciesId: 1 },
    ] } });

    expect(analyzePokeDiscoverEditorEconomy(candidate, { trainerLevelThresholds: [0, 50, 100] }).warnings)
      .not.toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'insufficientExperience' })]));
  });

  it('señala una compra opcional que bloquea la expedición libre obligatoria', () => {
    const candidate = adventure();
    candidate.missionIds = ['mission:test:mandatory'];
    const mission = mandatoryMission({ kind: 'inventoryItem', itemId: keyItem.contentId });

    const result = analyzePokeDiscoverEditorEconomy(candidate, {
      missions: [mission], offers: [keyItemOffer], shopContent: [keyItem],
    });

    expect(result.mandatoryPurchaseCost).toBe(90);
    expect(result.warnings).toContainEqual(expect.objectContaining({
      kind: 'mandatoryPurchase',
      sourceId: mission.missionId,
      message: expect.stringMatching(/90 PD.*solo aporta 10 PD/),
    }));
  });

  it('no considera obligatoria una compra evitable por otra rama o por un compañero', () => {
    const candidate = adventure();
    candidate.missionIds = ['mission:test:mandatory'];
    const itemAlternative = mandatoryMission({ any: [
      { kind: 'inventoryItem', itemId: keyItem.contentId },
      { kind: 'companionSpecies', speciesId: 1 },
    ] });
    const surfAlternative = { ...mandatoryMission({ kind: 'fieldCapability', capabilityId: 'surf', minimumStrength: 1 }), missionId: 'mission:test:surf' };
    candidate.missionIds.push(surfAlternative.missionId);

    const result = analyzePokeDiscoverEditorEconomy(candidate, {
      missions: [itemAlternative, surfAlternative], offers: [keyItemOffer], shopContent: [keyItem],
    });

    expect(result.mandatoryPurchaseCost).toBe(0);
    expect(result.warnings).not.toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'mandatoryPurchase' })]));
  });
});
