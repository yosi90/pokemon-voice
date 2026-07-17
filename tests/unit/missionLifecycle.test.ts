import { beforeEach, describe, expect, it } from 'vitest';
import type { MissionDefinitionV1 } from '../../packages/contracts/src/index.js';
import {
  completeMissionDefinition,
  evaluateMissionReadiness,
  getMissionStatus,
  startAdventureMission,
} from '../../src/domain/expeditions/missionLifecycle.js';
import { createPokeVoiceSaveV1 } from '../../src/domain/progress/pokeVoiceSave.js';
import {
  completeBrowserMissionDefinition,
  getBrowserPokeVoiceSave,
  startBrowserAdventureMission,
  updateBrowserPokeDiscover,
} from '../../src/store/browserPokeVoiceSaveStore.js';

const COMPLETED_AT = '2026-07-18T00:00:00.000Z';

const firstMission: MissionDefinitionV1 = {
  schemaVersion: 1,
  missionId: 'mission:first-field-trip',
  mapId: 'map:kanto:test-meadow',
  title: 'Primeras huellas',
  briefing: 'Sigue las huellas sin necesidad de investigar todo el prado.',
  availability: { kind: 'worldFlag', flagId: 'professor:first-mission-offered' },
  objectives: [
    {
      objectiveId: 'objective:first-field-trip:follow-tracks',
      description: 'Encuentra las huellas junto a la hierba.',
      requirement: { kind: 'unlockedSecret', secretId: 'secret:test-meadow:rattata-tracks' },
    },
    {
      objectiveId: 'objective:first-field-trip:optional-talk',
      description: 'Habla con el guarda del prado.',
      requirement: { kind: 'conversation', conversationId: 'conversation:test-meadow:ranger' },
      optional: true,
    },
  ],
  mapVariantIds: [],
  rewards: [
    { kind: 'trainerExperience', amount: 25 },
    { kind: 'discoveryPoints', amount: 25 },
  ],
  unlocksFreeExpedition: true,
  grantsFirstMissionAchievement: true,
};

function offeredSave() {
  const save = createPokeVoiceSaveV1({ runId: 'run:first-mission', now: Date.parse(COMPLETED_AT) });
  save.pokeDiscover.worldFlags['professor:first-mission-offered'] = true;
  return save;
}

describe('ciclo declarativo de misiones', () => {
  beforeEach(() => localStorage.clear());

  it('distingue bloqueada, disponible y activa mediante el mismo requisito declarativo', () => {
    const locked = createPokeVoiceSaveV1({ runId: 'run:locked', now: Date.now() });
    const offered = offeredSave();
    const started = startAdventureMission(offered, firstMission);

    expect(getMissionStatus(locked, firstMission)).toBe('locked');
    expect(getMissionStatus(offered, firstMission)).toBe('available');
    expect(started.status).toBe('active');
    expect(getMissionStatus(started.save, firstMission)).toBe('active');
  });

  it('no permite entregar una misión con objetivos obligatorios pendientes', () => {
    const active = startAdventureMission(offeredSave(), firstMission).save;
    const result = completeMissionDefinition(active, firstMission, COMPLETED_AT);

    expect(result).toMatchObject({
      status: 'notReady',
      readiness: {
        ready: false,
        unmetRequiredObjectiveIds: ['objective:first-field-trip:follow-tracks'],
        unmetOptionalObjectiveIds: ['objective:first-field-trip:optional-talk'],
      },
    });
    expect(result.save).toBe(active);
  });

  it('completa sin exigir objetivos opcionales ni investigar todo el mapa', () => {
    const active = startAdventureMission(offeredSave(), firstMission).save;
    active.pokeDiscover.mapProgress[firstMission.mapId] = {
      schemaVersion: 1,
      mapId: firstMission.mapId,
      freeExpeditionUnlocked: false,
      completedMissionIds: [],
      unlockedSecretIds: ['secret:test-meadow:rattata-tracks'],
      knownNpcIds: [],
      conversationIds: [],
      collectibleIds: [],
      knownHintIds: [],
      unlockedRouteIds: [],
      eligibleEncounterVisits: {},
      activeVariantIds: [],
    };
    const readiness = evaluateMissionReadiness(active, firstMission);
    const result = completeMissionDefinition(active, firstMission, COMPLETED_AT);

    expect(readiness).toMatchObject({
      ready: true,
      unmetRequiredObjectiveIds: [],
      unmetOptionalObjectiveIds: ['objective:first-field-trip:optional-talk'],
    });
    expect(result).toMatchObject({
      status: 'completed',
      rewardStatus: 'claimed',
      firstMissionAchievementUnlocked: true,
      save: {
        pokeDiscover: {
          trainerExperience: 25,
          discoveryPoints: 25,
          activeMissionIds: [],
          achievements: { 'first-mission': { achievementId: 'first-mission' } },
          mapProgress: {
            [firstMission.mapId]: {
              freeExpeditionUnlocked: true,
              completedMissionIds: [firstMission.missionId],
            },
          },
        },
      },
    });
  });

  it('repetir la entrega nunca duplica recompensa ni logro', () => {
    const active = startAdventureMission(offeredSave(), firstMission).save;
    active.pokeDiscover.mapProgress[firstMission.mapId] = {
      schemaVersion: 1,
      mapId: firstMission.mapId,
      freeExpeditionUnlocked: false,
      completedMissionIds: [],
      unlockedSecretIds: ['secret:test-meadow:rattata-tracks'],
      knownNpcIds: [],
      conversationIds: [],
      collectibleIds: [],
      knownHintIds: [],
      unlockedRouteIds: [],
      eligibleEncounterVisits: {},
      activeVariantIds: [],
    };
    const first = completeMissionDefinition(active, firstMission, COMPLETED_AT);
    const repeated = completeMissionDefinition(first.save, firstMission, COMPLETED_AT);

    expect(repeated.status).toBe('alreadyCompleted');
    expect(repeated.save).toBe(first.save);
    expect(repeated.save.pokeDiscover).toMatchObject({
      trainerExperience: 25,
      discoveryPoints: 25,
    });
  });

  it('persiste inicio y entrega mediante el guardado del navegador', () => {
    getBrowserPokeVoiceSave();
    updateBrowserPokeDiscover(state => ({
      ...state,
      worldFlags: { ...state.worldFlags, 'professor:first-mission-offered': true },
      mapProgress: {
        ...state.mapProgress,
        [firstMission.mapId]: {
          schemaVersion: 1,
          mapId: firstMission.mapId,
          freeExpeditionUnlocked: false,
          completedMissionIds: [],
          unlockedSecretIds: ['secret:test-meadow:rattata-tracks'],
          knownNpcIds: [],
          conversationIds: [],
          collectibleIds: [],
          knownHintIds: [],
          unlockedRouteIds: [],
          eligibleEncounterVisits: {},
          activeVariantIds: [],
        },
      },
    }));

    expect(startBrowserAdventureMission(firstMission).status).toBe('active');
    expect(completeBrowserMissionDefinition(firstMission, COMPLETED_AT).status).toBe('completed');
    expect(getBrowserPokeVoiceSave().pokeDiscover.mapProgress[firstMission.mapId])
      .toMatchObject({ completedMissionIds: [firstMission.missionId] });
  });
});
