import type { PokemonFormId, PokemonSpeciesId, StableId, VersionedContractV1 } from './common.js';

export type PokemonTypeId = string;
export type FieldCapabilityId = string;
export type PokemonSizeClass = 'tiny' | 'small' | 'medium' | 'large' | 'huge';
export type EvolutionStage = 1 | 2 | 3;
export type PokemonFormKind = 'default' | 'regional' | 'alternate' | 'battle';
export type PokemonAppearanceKind = 'default' | 'gender' | 'costume' | 'event' | 'seasonal';
export type PokemonSpeciesRelationKind = 'paradox' | 'convergent' | 'counterpart';

export interface PokemonSpeciesRelationV1 {
  relationId: StableId;
  kind: PokemonSpeciesRelationKind;
  relatedSpeciesId: PokemonSpeciesId;
}

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
  kind: PokemonFormKind;
  types: PokemonTypeId[];
  evolutionStage: EvolutionStage;
  heightMeters?: number;
  sizeClass?: PokemonSizeClass;
  narrativeTags: string[];
  fieldCapabilities: FieldCapabilityV1[];
}

export interface PokemonAppearanceV1 extends VersionedContractV1 {
  appearanceId: StableId;
  speciesId: PokemonSpeciesId;
  formId: PokemonFormId;
  slug: string;
  displayName: string;
  kind: PokemonAppearanceKind;
  narrativeTags: string[];
  assetId: StableId;
}

export interface PokemonSpeciesV1 extends VersionedContractV1 {
  speciesId: PokemonSpeciesId;
  slug: string;
  displayName: string;
  generation: number;
  tags: string[];
  defaultFormId: PokemonFormId;
  formIds: PokemonFormId[];
  relations?: PokemonSpeciesRelationV1[];
}

export interface PokedexEntryV1 extends VersionedContractV1 {
  entryId: StableId;
  speciesId: PokemonSpeciesId;
  regionalDex?: string;
  dexNumber: number;
}
