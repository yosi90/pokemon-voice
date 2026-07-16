import type { PokemonAppearanceId, PokemonFormId, PokemonSpeciesId, VersionedContractV1 } from './common.js';
import type {
  CompanionBalanceStatus,
  FieldCapabilityV1,
  PokemonAppearanceKind,
  PokemonFormKind,
  PokemonSizeClass,
  PokemonTypeId,
  EvolutionStage,
} from './catalog.js';
import type { CompanionRequirementVisibility } from './adventure.js';
import type { RequirementExpressionV1 } from './requirements.js';

export interface CompanionCategoryTraitsV1 {
  starter: boolean;
  baby: boolean;
  pseudoLegendary: boolean;
  legendary: boolean;
  mythical: boolean;
  special: boolean;
}

export interface CompanionGameplayProfileV1 {
  minimumTrainerLevel: number;
  balanceStatus: CompanionBalanceStatus;
  ignoreReferenceLevelGap?: boolean;
  extraRequirement?: RequirementExpressionV1;
  visibility: CompanionRequirementVisibility;
  loreHint?: string;
  rejectionText: string;
}

export interface CompanionAppearanceProfileV1 extends VersionedContractV1 {
  appearanceId: PokemonAppearanceId;
  slug: string;
  displayName: string;
  kind: PokemonAppearanceKind;
  assetId: string;
  selectableCompanion: boolean;
  narrativeTags: string[];
  additionalFieldCapabilities: FieldCapabilityV1[];
  companionOverride?: Partial<CompanionGameplayProfileV1>;
}

export interface CompanionFormProfileV1 extends VersionedContractV1 {
  formId: PokemonFormId;
  slug: string;
  displayName: string;
  kind: PokemonFormKind;
  assetId: string;
  selectableCompanion: boolean;
  types: PokemonTypeId[];
  evolutionStage: EvolutionStage;
  heightMeters?: number;
  sizeClass?: PokemonSizeClass;
  narrativeTags: string[];
  fieldCapabilities: FieldCapabilityV1[];
  companion: CompanionGameplayProfileV1;
  appearances: CompanionAppearanceProfileV1[];
}

export interface CompanionSpeciesProfileV1 extends VersionedContractV1 {
  speciesId: PokemonSpeciesId;
  slug: string;
  displayName: string;
  generation: number;
  traits: CompanionCategoryTraitsV1;
  forms: CompanionFormProfileV1[];
}

export interface CompanionGenerationCatalogV1 extends VersionedContractV1 {
  generation: number;
  species: CompanionSpeciesProfileV1[];
}
