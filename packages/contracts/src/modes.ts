import type { StableId, VersionedContractV1 } from './common.js';
import type { RequirementExpressionV1 } from './requirements.js';

export type ModeRunPolicy = 'preserve' | 'resetPokedex';

export interface ModeDefinitionV1 extends VersionedContractV1 {
  modeId: StableId;
  title: string;
  description: string;
  runPolicy: ModeRunPolicy;
  availability?: RequirementExpressionV1;
}
