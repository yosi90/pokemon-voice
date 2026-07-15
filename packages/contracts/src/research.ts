import type { PokemonSpeciesId, StableId, VersionedContractV1 } from './common.js';

export type ResearchFieldKey = 'biometrics' | 'behavior' | 'habitat' | 'exceptional';
export type ResearchStatus = 'notSeen' | 'sighted' | 'partial' | 'complete';

export interface ResearchFieldProgressV1 {
  field: ResearchFieldKey;
  discoveredFactIds: StableId[];
  completed: boolean;
}

export interface SpeciesResearchProgressV1 extends VersionedContractV1 {
  speciesId: PokemonSpeciesId;
  status: ResearchStatus;
  fields: Record<ResearchFieldKey, ResearchFieldProgressV1>;
  additionalNoteIds: StableId[];
}
