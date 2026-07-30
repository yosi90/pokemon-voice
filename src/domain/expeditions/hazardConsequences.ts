import type {
  HazardConsequenceV1,
  PokeVoiceSaveV1,
} from '../../../packages/contracts/src/index.js';
import { restoreExpeditionRollbackSnapshot } from './expeditionSession.js';

export interface AppliedHazardConsequence {
  save: PokeVoiceSaveV1;
  rebuildSector: boolean;
  returnToMissionBoard: boolean;
}

export function applyHazardConsequenceToSave(
  save: PokeVoiceSaveV1,
  consequence: HazardConsequenceV1,
): AppliedHazardConsequence {
  const session = save.activeExpeditionSession;
  if (consequence.outcome === 'recover') {
    return { save, rebuildSector: false, returnToMissionBoard: false };
  }
  if (!session) {
    return {
      save,
      rebuildSector: consequence.outcome === 'resetSector',
      returnToMissionBoard: consequence.outcome === 'failMission',
    };
  }
  if (consequence.outcome === 'resetSector') {
    const snapshot = session.activeSectorVisit?.rollbackSnapshot;
    const restored = consequence.rollbackPolicy === 'restoreSnapshot' && snapshot
      ? restoreExpeditionRollbackSnapshot(save, snapshot)
      : save;
    return {
      save: restored,
      rebuildSector: true,
      returnToMissionBoard: false,
    };
  }

  const snapshot = session.entryRollbackSnapshot;
  const restored = consequence.rollbackPolicy === 'restoreSnapshot' && snapshot
    ? restoreExpeditionRollbackSnapshot(save, snapshot)
    : save;
  const activeMissionIds = session.missionId
    ? restored.pokeDiscover.activeMissionIds.filter(id => id !== session.missionId)
    : restored.pokeDiscover.activeMissionIds;
  return {
    save: {
      ...restored,
      pokeDiscover: {
        ...restored.pokeDiscover,
        activeMissionIds,
      },
      activeExpeditionSession: undefined,
      pendingMissionLaunch: undefined,
    },
    rebuildSector: false,
    returnToMissionBoard: true,
  };
}
