import type {
  AdventureMapV3,
  CompanionResearchFactV1,
  CompanionSpeciesProfileV1,
  ResearchFactV1,
  ResearchFieldKey,
} from '../../../packages/contracts/src/index.js';
import { COMPANION_GAMEPLAY_SPECIES } from '../companions/companionGameplayCatalog.js';

export const RESEARCH_MATRIX_FIELDS: readonly ResearchFieldKey[] = Object.freeze([
  'biometrics', 'behavior', 'habitat', 'exceptional',
]);

export interface PokeDiscoverResearchMatrixMap {
  mapId: string;
  title: string;
}

export interface PokeDiscoverResearchMatrixRow {
  speciesId: number;
  displayName: string;
  generation: number;
  factsByMap: Record<string, Record<ResearchFieldKey, ResearchFactV1[]>>;
  companionResearch?: CompanionResearchFactV1;
  factCount: number;
  hasCoverage: boolean;
  warnings: PokeDiscoverResearchMatrixWarning[];
}

export type PokeDiscoverResearchMatrixWarning =
  | { kind: 'fourRequiredPlacements'; speciesId: number; factIds: string[] }
  | { kind: 'duplicateFieldCompletion'; speciesId: number; field: ResearchFieldKey; sourceIds: string[] };

export interface PokeDiscoverResearchMatrix {
  maps: PokeDiscoverResearchMatrixMap[];
  rows: PokeDiscoverResearchMatrixRow[];
  factCount: number;
  coveredSpeciesCount: number;
  companionReservationCount: number;
  warningCount: number;
  unknownSpeciesFacts: ResearchFactV1[];
}

function emptyFields(): Record<ResearchFieldKey, ResearchFactV1[]> {
  return { biometrics: [], behavior: [], habitat: [], exceptional: [] };
}

export function createPokeDiscoverResearchMatrix(
  adventures: readonly AdventureMapV3[],
  speciesCatalog: readonly CompanionSpeciesProfileV1[] = COMPANION_GAMEPLAY_SPECIES,
): PokeDiscoverResearchMatrix {
  const byMap = new Map<string, AdventureMapV3>();
  for (const adventure of adventures) byMap.set(adventure.mapId, adventure);
  const maps = [...byMap.values()].map(adventure => ({ mapId: adventure.mapId, title: adventure.title }));
  const rows = speciesCatalog.map(species => {
    const factsByMap = Object.fromEntries(maps.map(map => [map.mapId, emptyFields()])) as PokeDiscoverResearchMatrixRow['factsByMap'];
    let factCount = 0;
    const mapCompletions: ResearchFactV1[] = [];
    for (const adventure of byMap.values()) {
      for (const fact of adventure.researchFacts ?? []) {
        if (fact.speciesId !== species.speciesId) continue;
        factsByMap[adventure.mapId][fact.field].push(fact);
        factCount += 1;
        if (fact.contribution === 'fieldCompletion') mapCompletions.push(fact);
      }
    }
    const completionSources = new Map<ResearchFieldKey, string[]>();
    for (const fact of mapCompletions) completionSources.set(fact.field, [...(completionSources.get(fact.field) ?? []), fact.factId]);
    if (species.companionResearch) {
      const fact = species.companionResearch;
      completionSources.set(fact.field, [...(completionSources.get(fact.field) ?? []), fact.factId]);
    }
    const warnings: PokeDiscoverResearchMatrixWarning[] = [];
    if (new Set(mapCompletions.map(fact => fact.field)).size === RESEARCH_MATRIX_FIELDS.length) {
      warnings.push({ kind: 'fourRequiredPlacements', speciesId: species.speciesId, factIds: mapCompletions.map(fact => fact.factId) });
    }
    for (const [field, sourceIds] of completionSources) {
      if (sourceIds.length > 1) warnings.push({ kind: 'duplicateFieldCompletion', speciesId: species.speciesId, field, sourceIds });
    }
    return {
      speciesId: species.speciesId,
      displayName: species.displayName,
      generation: species.generation,
      factsByMap,
      ...(species.companionResearch ? { companionResearch: species.companionResearch } : {}),
      factCount,
      hasCoverage: factCount > 0 || species.companionResearch !== undefined,
      warnings,
    };
  });
  const knownSpecies = new Set(speciesCatalog.map(species => species.speciesId));
  const allFacts = [...byMap.values()].flatMap(adventure => adventure.researchFacts ?? []);
  return {
    maps,
    rows,
    factCount: allFacts.length,
    coveredSpeciesCount: rows.filter(row => row.hasCoverage).length,
    companionReservationCount: rows.filter(row => row.companionResearch).length,
    warningCount: rows.reduce((total, row) => total + row.warnings.length, 0),
    unknownSpeciesFacts: allFacts.filter(fact => !knownSpecies.has(fact.speciesId)),
  };
}
