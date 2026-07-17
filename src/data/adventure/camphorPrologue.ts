import type {
  AdventureMapV2,
  CompanionResearchFactV1,
  MissionDefinitionV1,
  ResearchFactV1,
} from '../../../packages/contracts/src/index.js';
import { getBalancedPokeDiscoverRewards } from './rewardBalance.js';

export const CAMPHOR_FOREST_MAP_ID = 'map:tegueste:camphor-forest';
export const CAMPHOR_PROLOGUE_MISSION_ID = 'mission:tegueste:help-professor-camphor';
export const CAMPHOR_PROLOGUE_RATTATA_COUNTER = 'mission-counter:camphor:rattata-driven-away';
export const CAMPHOR_SCIENTIST_ROUTE_ID = 'route:camphor-forest:scientists-exit';
export const CAMPHOR_CUT_ROUTE_ID = 'route:camphor-forest:cut-bush';
export const CAMPHOR_PINECO_SECRET_ID = 'secret:camphor-forest:pineco-tree';
export const CAMPHOR_RATTATA_ACTOR_IDS = Object.freeze([
  'actor:camphor-forest:rattata-left',
  'actor:camphor-forest:rattata-front',
  'actor:camphor-forest:rattata-right',
]);

export const CAMPHOR_FOREST_MAP = Object.freeze<AdventureMapV2>({
  schemaVersion: 2,
  mapId: CAMPHOR_FOREST_MAP_ID,
  title: 'Bosque de Tegueste',
  tiledMapAssets: [{
    schemaVersion: 1,
    assetId: 'tiled-map:camphor-forest:ambush-clearing',
    path: 'assets/adventure/maps/tegueste/camphor-forest/ambush-clearing.tmj',
  }],
  rooms: [{
    schemaVersion: 1,
    roomId: 'room:camphor-forest:ambush-clearing',
    tiledMapAssetId: 'tiled-map:camphor-forest:ambush-clearing',
    staticCamera: true,
    spawnAnchorIds: [
      'anchor:camphor-forest:player-south',
      'anchor:camphor-forest:tegueste-exit',
      'anchor:camphor-forest:cut-bush-exit',
    ],
  }],
  actorPlacements: [],
  transitions: [],
  variants: [],
  missionIds: [CAMPHOR_PROLOGUE_MISSION_ID],
  behaviorTriggers: [],
  expressionTriggers: [],
  rareEncounters: [],
  requiredAssetIds: [
    'pmd:0019-rattata:default',
    'pmd:0204-pineco:default',
    'portrait:professor-camphor',
    'trainer:achaman',
    'trainer:guayota',
  ],
});

export const CAMPHOR_PROLOGUE_MISSION = Object.freeze<MissionDefinitionV1>({
  schemaVersion: 1,
  missionId: CAMPHOR_PROLOGUE_MISSION_ID,
  mapId: CAMPHOR_FOREST_MAP_ID,
  title: '¡Ayuda al profesor Alcanfor!',
  briefing: 'Tres Pokémon han asaltado al profesor Alcanfor para robarle la comida. Ahuyéntalos.',
  availability: { kind: 'worldFlag', flagId: 'story:camphor-prologue-offered' },
  objectives: [{
    objectiveId: 'objective:camphor-prologue:drive-away-rattata',
    description: 'Ahuyenta a los tres Pokémon que rodean al profesor.',
    requirement: {
      kind: 'missionCounter',
      counterId: CAMPHOR_PROLOGUE_RATTATA_COUNTER,
      comparison: 'gte',
      value: 3,
    },
  }],
  mapVariantIds: ['variant:camphor-forest:scientists-blocking-exit'],
  rewards: getBalancedPokeDiscoverRewards('completedMission'),
  unlocksFreeExpedition: true,
  grantsFirstMissionAchievement: true,
});

export const CAMPHOR_RATTATA_RESEARCH = Object.freeze<ResearchFactV1>({
  schemaVersion: 1,
  factId: 'research:rattata:camphor-forest:food-raid',
  speciesId: 19,
  field: 'behavior',
  contribution: 'fieldCompletion',
  mapId: CAMPHOR_FOREST_MAP_ID,
  interactionId: 'interaction:camphor-forest:rescue-professor',
  text: 'Es pequeño y veloz; cuando ataca en grupo muerde cuanto encuentra, especialmente si hay comida cerca.',
  rewards: getBalancedPokeDiscoverRewards('uniqueObservation'),
});

export const CAMPHOR_PINECO_RESEARCH = Object.freeze<ResearchFactV1>({
  schemaVersion: 1,
  factId: 'research:pineco:camphor-forest:biometrics',
  speciesId: 204,
  field: 'biometrics',
  contribution: 'fieldCompletion',
  mapId: CAMPHOR_FOREST_MAP_ID,
  interactionId: 'interaction:camphor-forest:pineco-falls',
  text: 'Pineco mide aproximadamente 0,6 metros y pesa unos 7,2 kilogramos.',
  rewards: getBalancedPokeDiscoverRewards('specialDiscovery'),
});

export const RATTATA_COMPANION_RESEARCH = Object.freeze<CompanionResearchFactV1>({
  schemaVersion: 1,
  factId: 'research:rattata:companion:habitat',
  speciesId: 19,
  field: 'habitat',
  contentStatus: 'curated',
  text: 'Viajando con Rattata descubres que encuentra alimento y refugio incluso en lugares muy transitados.',
  rewards: getBalancedPokeDiscoverRewards('uniqueObservation'),
});

export const PINECO_COMPANION_RESEARCH = Object.freeze<CompanionResearchFactV1>({
  schemaVersion: 1,
  factId: 'research:pineco:companion:behavior',
  speciesId: 204,
  field: 'behavior',
  contentStatus: 'curated',
  text: 'Al viajar con Pineco aprendes que permanece inmóvil durante largos periodos y reacciona de golpe si algo lo sobresalta.',
  rewards: getBalancedPokeDiscoverRewards('uniqueObservation'),
});
