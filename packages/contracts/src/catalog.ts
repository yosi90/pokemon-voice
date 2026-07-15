import type { PokemonFormId, PokemonSpeciesId, StableId, VersionedContractV1 } from './common.js';

export type PokemonTypeId = string;
export type FieldCapabilityId = string;
export type PokemonSizeClass = 'tiny' | 'small' | 'medium' | 'large' | 'huge';
export type EvolutionStage = 1 | 2 | 3;

export interface FieldCapabilityV1 {
  id: FieldCapabilityId;
  source: 'biology' | 'move' | 'form' | 'story';
  strength?: number;
  tags?: string[];
}

export interface PokemonFormV1 extends VersionedContractV1 {
  formId: PokemonFormId;
  speciesId: PokemonSpeciesId;
  slug: string;
  displayName: string;
  types: PokemonTypeId[];
  evolutionStage: EvolutionStage;
  heightMeters?: number;
  sizeClass?: PokemonSizeClass;
  narrativeTags: string[];
  fieldCapabilities: FieldCapabilityV1[];
}

export interface PokemonSpeciesV1 extends VersionedContractV1 {
  speciesId: PokemonSpeciesId;
  slug: string;
  displayName: string;
  generation: number;
  tags: string[];
  defaultFormId: PokemonFormId;
  formIds: PokemonFormId[];
}

export interface PokedexEntryV1 extends VersionedContractV1 {
  entryId: StableId;
  speciesId: PokemonSpeciesId;
  regionalDex?: string;
  dexNumber: number;
}
