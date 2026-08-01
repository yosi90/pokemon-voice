import type {
  AdventureMissionDocument,
  AdventureMissionDocumentV2,
  MissionDefinition,
  MissionDefinitionV1,
  MissionDefinitionV2,
  MissionFlowNodeV2,
  MissionFlowNodeV1,
  MissionFlowV2,
  StoryOutlineV1,
} from '../../../packages/contracts/src/index.js';
import { createLegacyMissionFlow } from './missionFlow.js';

function migrateFlow(mission: MissionDefinitionV1): MissionFlowV2 {
  const legacy = mission.flow ?? createLegacyMissionFlow(mission);
  return {
    schemaVersion: 2,
    initialNodeId: legacy.initialNodeId,
    nodes: legacy.nodes.map((node: MissionFlowNodeV1) => ({
      ...structuredClone(node),
    })) as MissionFlowNodeV2[],
  };
}

export function normalizeMissionDefinition(mission: MissionDefinition): MissionDefinitionV2 {
  if (mission.schemaVersion === 2) return structuredClone(mission);
  return {
    schemaVersion: 2,
    missionId: mission.missionId,
    mapId: mission.mapId,
    title: mission.title,
    loadingText: mission.loadingText,
    briefing: mission.briefing,
    category: 'main',
    publicationStatus: 'published',
    lockedPresentation: { kind: 'hidden' },
    ...(mission.availability ? { availability: structuredClone(mission.availability) } : {}),
    objectives: structuredClone(mission.objectives),
    rewards: structuredClone(mission.rewards),
    unlocksFreeExpedition: mission.unlocksFreeExpedition,
    ...(mission.grantsFirstMissionAchievement ? { grantsFirstMissionAchievement: true } : {}),
    ...(mission.playerAppearanceId ? { playerAppearanceId: mission.playerAppearanceId } : {}),
    abandonment: {
      allowed: !mission.grantsFirstMissionAchievement,
      ...(mission.grantsFirstMissionAchievement
        ? { blockedText: 'Este encargo forma parte de la historia principal.' }
        : {}),
    },
    flow: migrateFlow(mission),
  };
}

export function normalizeAdventureMissionDocument(
  document: AdventureMissionDocument,
): AdventureMissionDocumentV2 {
  if (document.schemaVersion === 2) return structuredClone(document);
  return {
    schemaVersion: 2,
    mapId: document.mapId,
    missions: document.missions.map(normalizeMissionDefinition),
    narrativeSequences: structuredClone(document.narrativeSequences),
    ...(document.conversationIds ? { conversationIds: [...document.conversationIds] } : {}),
  };
}

export function createDefaultStoryOutline(
  missionIds: readonly string[],
  title = 'Historia de PokeDiscover',
): StoryOutlineV1 {
  return {
    schemaVersion: 1,
    storyId: 'story:pokediscover',
    title,
    acts: [{
      schemaVersion: 1,
      actId: 'story:pokediscover:act:01',
      title: 'Acto 1',
      chapters: [{
        schemaVersion: 1,
        chapterId: 'story:pokediscover:chapter:01',
        title: 'Capítulo 1',
        missionIds: [...missionIds],
      }],
    }],
    missionPositions: {},
    flowNodePositions: {},
  };
}

export function listedMissionIds(document: AdventureMissionDocumentV2) {
  return document.missions
    .filter(mission => mission.publicationStatus !== 'draft')
    .map(mission => mission.missionId);
}
