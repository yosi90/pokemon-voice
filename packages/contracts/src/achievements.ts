import type { ISODateString, StableId, VersionedContractV1 } from './common.js';
import type { RewardDefinitionV1 } from './economy.js';
import type { RequirementExpressionV1 } from './requirements.js';

export type AchievementDomain = 'pokedex' | 'pokeDiscover' | 'mode' | 'global';
export type AchievementEvaluationCycle = 'pokedexRun' | 'modeSession' | 'persistent';

export interface AchievementDefinitionV2 {
  schemaVersion: 2;
  achievementId: StableId;
  title: string;
  description: string;
  domain: AchievementDomain;
  evaluationCycle: AchievementEvaluationCycle;
  event: string;
  requirement: RequirementExpressionV1;
  rewards: RewardDefinitionV1[];
  modeId?: StableId;
}

export interface PermanentAchievementRecordV1 extends VersionedContractV1 {
  achievementId: StableId;
  unlockedAt: ISODateString;
  /** Ausente únicamente en registros legacy cuya procedencia no puede inferirse. */
  domain?: AchievementDomain;
  originRunId?: StableId;
  originModeId?: StableId;
}
