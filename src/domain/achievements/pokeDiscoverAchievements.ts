import type {
  AchievementDefinitionV2,
  PokeVoiceSaveV1,
} from '../../../packages/contracts/src/index.js';
import { FIRST_MISSION_ACHIEVEMENT_ID } from '../companions/companionEligibility.js';
import { evaluateRequirement } from '../requirements/evaluateRequirement.js';

export const FIRST_MISSION_STORY_FLAG = 'story:first-professor-mission-completed';
export const POKE_DISCOVER_ACHIEVEMENT_EVENT = 'pokevoice:pokediscover-achievement-unlocked';

export const FIRST_MISSION_ACHIEVEMENT: AchievementDefinitionV2 = Object.freeze({
  schemaVersion: 2,
  achievementId: FIRST_MISSION_ACHIEVEMENT_ID,
  title: '¡Primera misión!',
  description: 'Completa tu primer encargo de campo para el profesor Alcanfor.',
  domain: 'pokeDiscover',
  evaluationCycle: 'persistent',
  event: 'missionCompleted',
  requirement: { kind: 'storyEvent', eventId: FIRST_MISSION_STORY_FLAG },
  rewards: [],
  tier: 'Pokeball',
} satisfies AchievementDefinitionV2);

export const TYPICAL_START_ACHIEVEMENT: AchievementDefinitionV2 = Object.freeze({
  schemaVersion: 2,
  achievementId: 'typical-start',
  title: 'Un comienzo típico',
  description: 'Empieza la primera misión sin compañero y recibe un Pokémon para entrenadores principiantes.',
  domain: 'pokeDiscover',
  evaluationCycle: 'persistent',
  event: 'missionStarted',
  requirement: { kind: 'achievement', achievementId: 'typical-start' },
  rewards: [],
  tier: 'Pokeball',
} satisfies AchievementDefinitionV2);

function progressAchievement(
  achievementId: string,
  title: string,
  description: string,
  requirement: AchievementDefinitionV2['requirement'],
  tier: NonNullable<AchievementDefinitionV2['tier']>,
): AchievementDefinitionV2 {
  return Object.freeze({
    schemaVersion: 2,
    achievementId,
    title,
    description,
    domain: 'pokeDiscover',
    evaluationCycle: 'persistent',
    event: 'pokeDiscoverProgressChanged',
    requirement,
    rewards: [],
    tier,
  });
}

export const POKE_DISCOVER_PROGRESS_ACHIEVEMENTS = Object.freeze([
  progressAchievement('trainer-level-5', 'Ya no tan novato', 'Alcanza el nivel 5 de entrenador.', { kind: 'trainerLevel', minimum: 5 }, 'Pokeball'),
  progressAchievement('trainer-level-20', 'Investigador de campo', 'Alcanza el nivel 20 de entrenador.', { kind: 'trainerLevel', minimum: 20 }, 'Superball'),
  progressAchievement('first-map-secret', 'Mira debajo de esa roca', 'Encuentra tu primer secreto de mapa.', { kind: 'unlockedSecrets', minimum: 1 }, 'Pokeball'),
  progressAchievement('map-secrets-10', 'Nada se te escapa', 'Encuentra diez secretos diferentes.', { kind: 'unlockedSecrets', minimum: 10 }, 'Superball'),
  progressAchievement('first-expedition-map', 'Primer mapa de campo', 'Completa la misión que abre tu primer mapa.', { kind: 'completedMaps', minimum: 1 }, 'Pokeball'),
  progressAchievement('expedition-maps-5', 'Cartógrafo Pokémon', 'Abre cinco mapas para expediciones libres.', { kind: 'completedMaps', minimum: 5 }, 'Superball'),
  progressAchievement('first-research-entry', 'Ficha de sobresaliente', 'Completa los cuatro campos de una especie.', { kind: 'completedResearchEntries', minimum: 1 }, 'Pokeball'),
  progressAchievement('research-entries-10', 'Enciclopedia ambulante', 'Completa la investigación de diez especies.', { kind: 'completedResearchEntries', minimum: 10 }, 'Superball'),
  progressAchievement(
    'cold-blooded',
    'Sangre fría',
    'Ahuyenta a los Rattata de sus madrigueras con un Pokémon serpiente.',
    { kind: 'unlockedSecret', secretId: 'secret:tegueste-forest:burrow-intimidation' },
    'Pokeball',
  ),
]);

export const POKE_DISCOVER_ACHIEVEMENTS = Object.freeze([
  FIRST_MISSION_ACHIEVEMENT,
  TYPICAL_START_ACHIEVEMENT,
  ...POKE_DISCOVER_PROGRESS_ACHIEVEMENTS,
]);

export interface UnlockPokeDiscoverAchievementsResult {
  save: PokeVoiceSaveV1;
  unlocked: AchievementDefinitionV2[];
}

export function unlockSatisfiedPokeDiscoverAchievements(
  save: PokeVoiceSaveV1,
  unlockedAt: string,
): UnlockPokeDiscoverAchievementsResult {
  if (Number.isNaN(Date.parse(unlockedAt))) {
    throw new Error('unlockedAt debe ser una fecha ISO válida.');
  }
  const unlocked = POKE_DISCOVER_PROGRESS_ACHIEVEMENTS.filter(definition => (
    !save.pokeDiscover.achievements[definition.achievementId]
    && evaluateRequirement(definition.requirement, { save }).met
  ));
  if (!unlocked.length) return { save, unlocked: [] };

  const achievements = { ...save.pokeDiscover.achievements };
  for (const definition of unlocked) {
    achievements[definition.achievementId] = {
      schemaVersion: 1,
      achievementId: definition.achievementId,
      unlockedAt: new Date(unlockedAt).toISOString(),
      domain: 'pokeDiscover',
      originRunId: save.pokedexRun.runId,
    };
  }
  return {
    unlocked,
    save: {
      ...save,
      pokeDiscover: { ...save.pokeDiscover, achievements },
    },
  };
}
