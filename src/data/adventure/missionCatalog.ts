import type { MissionDefinitionV1, PokeVoiceSaveV1 } from '../../../packages/contracts/src/index.js';
import { getMissionStatus } from '../../domain/expeditions/missionLifecycle.js';
import { CAMPHOR_PROLOGUE_MISSION } from './camphorPrologue.js';

export const POKEDISCOVER_MISSION_CATALOG = Object.freeze<readonly MissionDefinitionV1[]>([
  CAMPHOR_PROLOGUE_MISSION,
]);

const MISSIONS_BY_ID = new Map(POKEDISCOVER_MISSION_CATALOG
  .map(mission => [mission.missionId, mission] as const));

export function getPokeDiscoverMission(missionId: string) {
  return MISSIONS_BY_ID.get(missionId);
}

/**
 * Las misiones disponibles, activas o completadas son conocidas. Una misión
 * bloqueada solo se conserva si ya existe una referencia persistente explícita.
 */
export function getKnownPokeDiscoverMissionIds(save: PokeVoiceSaveV1) {
  const referencedIds = new Set([
    ...save.pokeDiscover.activeMissionIds,
    ...Object.values(save.pokeDiscover.mapProgress).flatMap(progress => progress.completedMissionIds),
    ...(save.pendingMissionLaunch?.missionId ? [save.pendingMissionLaunch.missionId] : []),
  ]);
  for (const mission of POKEDISCOVER_MISSION_CATALOG) {
    if (getMissionStatus(save, mission) !== 'locked') referencedIds.add(mission.missionId);
  }
  return [...referencedIds];
}
