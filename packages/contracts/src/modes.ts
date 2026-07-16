import type { PokemonSpeciesId, StableId, VersionedContractV1 } from './common.js';
import type { RequirementExpressionV1 } from './requirements.js';

export type ModeRunPolicy = 'preserve' | 'resetPokedex' | 'isolatedPokedex';

export interface ModeDefinitionV1 extends VersionedContractV1 {
  modeId: StableId;
  title: string;
  description: string;
  runPolicy: ModeRunPolicy;
  availability?: RequirementExpressionV1;
}

export type ThemedChallengeKind = 'generation' | 'type' | 'family';

/**
 * Un reto autocontenido que puede validarse sin consultar servicios externos.
 * La lista no se muestra al jugador: representa las respuestas admitidas.
 */
export interface ThemedChallengeDefinitionV1 extends VersionedContractV1 {
  challengeId: StableId;
  kind: ThemedChallengeKind;
  title: string;
  description: string;
  targetSpeciesIds: PokemonSpeciesId[];
  targetCount: number;
}
