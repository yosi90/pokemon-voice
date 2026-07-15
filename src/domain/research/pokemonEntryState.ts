import type {
  AppearanceDiscoveryRecordV1,
  FormDiscoveryRecordV1,
  PokeVoiceSaveV1,
  ResearchFieldKey,
  ResearchStatus,
  SpeciesResearchProgressV1,
} from '../../../packages/contracts/src/index.js';

export type PokemonRegistrationStatus = 'unknown' | 'registered';

export interface PokemonEntryState {
  registration: PokemonRegistrationStatus;
  researchVisible: boolean;
  sighted: boolean;
  researchStatus: ResearchStatus;
  research?: SpeciesResearchProgressV1;
  discoveredForms: FormDiscoveryRecordV1[];
  discoveredAppearances: AppearanceDiscoveryRecordV1[];
}

export const RESEARCH_FIELD_KEYS: readonly ResearchFieldKey[] = [
  'biometrics',
  'behavior',
  'habitat',
  'exceptional',
];

export function getPokemonEntryState(save: PokeVoiceSaveV1, speciesId: number): PokemonEntryState {
  const registered = save.pokedexRun.registeredSpeciesIds.includes(speciesId);
  if (!registered) {
    return {
      registration: 'unknown',
      researchVisible: false,
      sighted: false,
      researchStatus: 'notSeen',
      discoveredForms: [],
      discoveredAppearances: [],
    };
  }

  const sighted = save.pokeDiscover.sightings.includes(speciesId);
  const research = save.pokeDiscover.researchBySpecies[speciesId];
  const discoveredForms = Object.values(save.pokeDiscover.discoveredForms)
    .filter(record => record.speciesId === speciesId)
    .sort((left, right) => left.discoveredAt.localeCompare(right.discoveredAt));
  const discoveredAppearances = Object.values(save.pokeDiscover.discoveredAppearances)
    .filter(record => record.speciesId === speciesId)
    .sort((left, right) => left.discoveredAt.localeCompare(right.discoveredAt));
  return {
    registration: 'registered',
    researchVisible: true,
    sighted,
    researchStatus: research?.status ?? (sighted ? 'sighted' : 'notSeen'),
    discoveredForms,
    discoveredAppearances,
    ...(research ? { research } : {}),
  };
}
