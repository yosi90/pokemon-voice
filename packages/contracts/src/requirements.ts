import type { PokemonFormId, PokemonSpeciesId, StableId } from './common.js';
import type { EvolutionStage, PokemonSizeClass, PokemonTypeId } from './catalog.js';
import type { ResearchFieldKey, ResearchStatus } from './research.js';

export type CounterComparison = 'eq' | 'gte' | 'lte' | 'gt' | 'lt';

export type RequirementAtomV1 =
  | { kind: 'trainerLevel'; minimum: number }
  | { kind: 'registeredSpecies'; speciesId: PokemonSpeciesId }
  | { kind: 'sightedSpecies'; speciesId: PokemonSpeciesId }
  | { kind: 'researchStatus'; speciesId: PokemonSpeciesId; status: ResearchStatus }
  | { kind: 'researchField'; speciesId: PokemonSpeciesId; field: ResearchFieldKey }
  | { kind: 'achievement'; achievementId: StableId }
  | { kind: 'modeCompleted'; modeId: StableId }
  | { kind: 'worldFlag'; flagId: StableId; expected?: boolean | string | number }
  | { kind: 'fieldCapability'; capabilityId: StableId; minimumStrength?: number }
  | { kind: 'companionSpecies'; speciesId: PokemonSpeciesId }
  | { kind: 'companionForm'; formId: PokemonFormId }
  | { kind: 'companionType'; typeId: PokemonTypeId }
  | { kind: 'companionSize'; minimumClass: PokemonSizeClass }
  | { kind: 'companionEvolutionStage'; minimum: EvolutionStage }
  | { kind: 'companionTag'; tag: string }
  | { kind: 'knownNpc'; npcId: StableId }
  | { kind: 'conversation'; conversationId: StableId }
  | { kind: 'counter'; counterId: StableId; comparison: CounterComparison; value: number }
  | { kind: 'inventoryItem'; itemId: StableId }
  | { kind: 'unlockedSecret'; secretId: StableId }
  | { kind: 'storyEvent'; eventId: StableId };

export type RequirementExpressionV1 =
  | RequirementAtomV1
  | { all: RequirementExpressionV1[] }
  | { any: RequirementExpressionV1[] };
