import type { PokemonAppearanceId, PokemonFormId, PokemonSpeciesId, StableId } from './common.js';
import type { EvolutionStage, FieldCapabilityId, PokemonSizeClass, PokemonTypeId } from './catalog.js';
import type { ResearchFieldKey, ResearchStatus } from './research.js';

export type CounterComparison = 'eq' | 'gte' | 'lte' | 'gt' | 'lt';

export type RequirementAtomV1 =
  | { kind: 'trainerLevel'; minimum: number }
  | { kind: 'completedMaps'; minimum: number }
  | { kind: 'unlockedSecrets'; minimum: number }
  | { kind: 'completedResearchEntries'; minimum: number }
  | { kind: 'registeredSpecies'; speciesId: PokemonSpeciesId }
  | { kind: 'registeredSpeciesByTag'; tag: string; minimum: number }
  | { kind: 'sightedSpecies'; speciesId: PokemonSpeciesId }
  | { kind: 'researchStatus'; speciesId: PokemonSpeciesId; status: ResearchStatus }
  | { kind: 'researchField'; speciesId: PokemonSpeciesId; field: ResearchFieldKey }
  | { kind: 'achievement'; achievementId: StableId }
  | { kind: 'modeCompleted'; modeId: StableId }
  | { kind: 'worldFlag'; flagId: StableId; expected?: boolean | string | number }
  | { kind: 'fieldCapability'; capabilityId: FieldCapabilityId; minimumStrength?: number }
  | { kind: 'companionSpecies'; speciesId: PokemonSpeciesId }
  | { kind: 'companionForm'; formId: PokemonFormId }
  | { kind: 'companionType'; typeId: PokemonTypeId }
  | { kind: 'companionSize'; minimumClass: PokemonSizeClass }
  | { kind: 'companionEvolutionStage'; minimum: EvolutionStage }
  | { kind: 'companionTag'; tag: string }
  | { kind: 'knownNpc'; npcId: StableId }
  | { kind: 'conversation'; conversationId: StableId }
  | { kind: 'counter'; counterId: StableId; comparison: CounterComparison; value: number }
  | { kind: 'missionCounter'; counterId: StableId; comparison: CounterComparison; value: number }
  | { kind: 'missionFlag'; flagId: StableId; expected?: boolean | string | number }
  | { kind: 'inventoryItem'; itemId: StableId }
  | { kind: 'unlockedSecret'; secretId: StableId }
  | { kind: 'storyEvent'; eventId: StableId }
  | { kind: 'completedMission'; missionId: StableId }
  | {
    kind: 'companionUnlocked';
    speciesId: PokemonSpeciesId;
    formId?: PokemonFormId;
    appearanceId?: PokemonAppearanceId;
  };

export type RequirementExpressionV1 =
  | RequirementAtomV1
  | { all: RequirementExpressionV1[] }
  | { any: RequirementExpressionV1[] };
