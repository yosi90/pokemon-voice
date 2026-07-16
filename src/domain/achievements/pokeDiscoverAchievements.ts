import type { AchievementDefinitionV2 } from '../../../packages/contracts/src/index.js';
import { FIRST_MISSION_ACHIEVEMENT_ID } from '../companions/companionEligibility.js';

export const FIRST_MISSION_STORY_FLAG = 'story:first-professor-mission-completed';

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
} satisfies AchievementDefinitionV2);

export const POKE_DISCOVER_ACHIEVEMENTS = Object.freeze([
  FIRST_MISSION_ACHIEVEMENT,
]);
