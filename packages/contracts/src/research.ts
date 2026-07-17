import type { PokemonSpeciesId, StableId, VersionedContractV1 } from './common.js';
import type { RewardDefinitionV1 } from './economy.js';

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

export type CompanionResearchContentStatus = 'provisional' | 'curated';

/** Un campo aprendido conviviendo con la especie durante una expedición útil. */
export interface CompanionResearchFactV1 extends VersionedContractV1 {
  factId: StableId;
  speciesId: PokemonSpeciesId;
  field: Extract<ResearchFieldKey, 'behavior' | 'habitat'>;
  text: string;
  contentStatus: CompanionResearchContentStatus;
  rewards: RewardDefinitionV1[];
}
