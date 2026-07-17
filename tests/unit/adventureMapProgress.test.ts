import { beforeEach, describe, expect, it } from 'vitest';
import {
  completeAdventureMission,
  createAdventureMapProgressV1,
  recordMapDiscovery,
} from '../../src/domain/expeditions/adventureMapProgress.js';
import { FIRST_MISSION_STORY_FLAG } from '../../src/domain/achievements/pokeDiscoverAchievements.js';
import { createPokeDiscoverStateV1 } from '../../src/domain/progress/pokeVoiceSave.js';
import {
  completeBrowserAdventureMission,
  getBrowserPokeVoiceSave,
  recordBrowserMapDiscovery,
} from '../../src/store/browserPokeVoiceSaveStore.js';

const COMPLETED_AT = '2026-07-17T14:00:00.000Z';

describe('progreso persistente de mapas', () => {
  beforeEach(() => localStorage.clear());

  it('crea un estado vacío sin revelar cuántos secretos contiene el mapa', () => {
    expect(createAdventureMapProgressV1('map:kanto:test-meadow')).toEqual({
      schemaVersion: 1,
      mapId: 'map:kanto:test-meadow',
      freeExpeditionUnlocked: false,
      completedMissionIds: [],
      unlockedSecretIds: [],
      knownNpcIds: [],
      conversationIds: [],
      collectibleIds: [],
      knownHintIds: [],
      unlockedRouteIds: [],
      eligibleEncounterVisits: {},
      activeVariantIds: [],
      injectedEncounterIds: [],
      completedBehaviorTriggerIds: [],
      resolvedExpressionTriggers: {},
    });
  });

  it.each([
    ['secret', 'secret:test-meadow:burrow', 'unlockedSecretIds'],
    ['npc', 'npc:test-meadow:ranger', 'knownNpcIds'],
    ['conversation', 'conversation:test-meadow:ranger-warning', 'conversationIds'],
    ['collectible', 'collectible:test-meadow:coin-001', 'collectibleIds'],
    ['hint', 'hint:test-meadow:rattata-tracks', 'knownHintIds'],
    ['route', 'route:test-meadow:fallen-log', 'unlockedRouteIds'],
  ] as const)('registra %s una sola vez mediante su ID estable', (kind, id, field) => {
    const initial = createPokeDiscoverStateV1();
    const first = recordMapDiscovery(initial, 'map:kanto:test-meadow', kind, id);
    const repeated = recordMapDiscovery(first.state, 'map:kanto:test-meadow', kind, id);

    expect(first.status).toBe('recorded');
    expect(first.mapProgress[field]).toEqual([id]);
    expect(repeated.status).toBe('alreadyRecorded');
    expect(repeated.state).toBe(first.state);
  });

  it('completa una misión, abre las expediciones libres y conserva secretos previos', () => {
    const withSecret = recordMapDiscovery(
      createPokeDiscoverStateV1(),
      'map:kanto:test-meadow',
      'secret',
      'secret:test-meadow:burrow',
    ).state;
    const active = { ...withSecret, activeMissionIds: ['mission:first-field-trip'] };
    const result = completeAdventureMission(active, {
      mapId: 'map:kanto:test-meadow',
      missionId: 'mission:first-field-trip',
      completedAt: COMPLETED_AT,
      unlocksFreeExpedition: true,
    });

    expect(result.status).toBe('completed');
    expect(result.mapProgress).toMatchObject({
      freeExpeditionUnlocked: true,
      completedMissionIds: ['mission:first-field-trip'],
      unlockedSecretIds: ['secret:test-meadow:burrow'],
    });
    expect(result.state.activeMissionIds).toEqual([]);
  });

  it('concede ¡Primera misión! solo cuando el encargo lo declara explícitamente', () => {
    const result = completeAdventureMission(createPokeDiscoverStateV1(), {
      mapId: 'map:kanto:test-meadow',
      missionId: 'mission:first-field-trip',
      completedAt: COMPLETED_AT,
      originRunId: 'run:test',
      unlocksFreeExpedition: true,
      grantsFirstMissionAchievement: true,
    });

    expect(result.firstMissionAchievementUnlocked).toBe(true);
    expect(result.state.worldFlags[FIRST_MISSION_STORY_FLAG]).toBe(true);
    expect(result.state.achievements['first-mission']).toEqual({
      schemaVersion: 1,
      achievementId: 'first-mission',
      unlockedAt: COMPLETED_AT,
      domain: 'pokeDiscover',
      originRunId: 'run:test',
    });
  });

  it('repetir la misión no duplica progreso ni vuelve a anunciar el logro', () => {
    const request = {
      mapId: 'map:kanto:test-meadow',
      missionId: 'mission:first-field-trip',
      completedAt: COMPLETED_AT,
      originRunId: 'run:test',
      unlocksFreeExpedition: true,
      grantsFirstMissionAchievement: true,
    };
    const first = completeAdventureMission(createPokeDiscoverStateV1(), request);
    const repeated = completeAdventureMission(first.state, request);

    expect(repeated.status).toBe('alreadyCompleted');
    expect(repeated.firstMissionAchievementUnlocked).toBe(false);
    expect(repeated.state).toBe(first.state);
    expect(repeated.mapProgress.completedMissionIds).toEqual(['mission:first-field-trip']);
  });

  it('una misión secundaria no concede first-mission por accidente', () => {
    const result = completeAdventureMission(createPokeDiscoverStateV1(), {
      mapId: 'map:kanto:hidden-garden',
      missionId: 'mission:hidden-garden:optional',
      completedAt: COMPLETED_AT,
      unlocksFreeExpedition: false,
    });

    expect(result.state.achievements['first-mission']).toBeUndefined();
    expect(result.state.worldFlags[FIRST_MISSION_STORY_FLAG]).toBeUndefined();
  });

  it('persiste descubrimientos y misiones en el guardado raíz del navegador', () => {
    recordBrowserMapDiscovery(
      'map:kanto:test-meadow',
      'hint',
      'hint:test-meadow:rattata-tracks',
    );
    completeBrowserAdventureMission({
      mapId: 'map:kanto:test-meadow',
      missionId: 'mission:first-field-trip',
      completedAt: COMPLETED_AT,
      unlocksFreeExpedition: true,
      grantsFirstMissionAchievement: true,
    });

    const persisted = getBrowserPokeVoiceSave();
    expect(persisted.pokeDiscover.mapProgress['map:kanto:test-meadow']).toMatchObject({
      knownHintIds: ['hint:test-meadow:rattata-tracks'],
      completedMissionIds: ['mission:first-field-trip'],
      freeExpeditionUnlocked: true,
    });
    expect(persisted.pokeDiscover.achievements['first-mission']?.originRunId)
      .toBe(persisted.pokedexRun.runId);
  });
});
