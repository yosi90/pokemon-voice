import type {
  AdventureMissionDocumentV1,
  AdventureMissionManifestV1,
  MissionDefinitionV1,
  PokeVoiceSaveV1,
} from '../../../packages/contracts/src/index.js';
import { getMissionStatus } from '../../domain/expeditions/missionLifecycle.js';
import { CAMPHOR_PROLOGUE_MISSION } from './camphorPrologue.js';

export let POKEDISCOVER_MISSION_CATALOG = Object.freeze<readonly MissionDefinitionV1[]>([
  CAMPHOR_PROLOGUE_MISSION,
]);

let MISSIONS_BY_ID = new Map(POKEDISCOVER_MISSION_CATALOG
  .map(mission => [mission.missionId, mission] as const));

function absoluteAssetUrl(path: string, baseUrl: string) {
  const normalized = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return new URL(path, new URL(normalized, window.location.href)).href;
}

/**
 * Carga el catálogo generado por el configurador. El catálogo TypeScript
 * anterior permanece como fallback para partidas y despliegues antiguos.
 */
export async function loadPokeDiscoverMissionCatalog(baseUrl: string) {
  const manifestUrl = absoluteAssetUrl(
    'assets/adventure/missions/manifest.v1.json',
    baseUrl,
  );
  const response = await fetch(manifestUrl);
  if (!response.ok) throw new Error(`No se pudo cargar el catálogo de misiones (${response.status}).`);
  const manifest = await response.json() as AdventureMissionManifestV1;
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.missions)) {
    throw new Error('El manifiesto global de misiones no es válido.');
  }
  const documentPaths = [...new Set(manifest.missions.map(entry => entry.documentPath))];
  const documents = await Promise.all(documentPaths.map(async path => {
    const documentResponse = await fetch(absoluteAssetUrl(path, baseUrl));
    if (!documentResponse.ok) throw new Error(`No se pudo cargar ${path}.`);
    return documentResponse.json() as Promise<AdventureMissionDocumentV1>;
  }));
  const missions = documents.flatMap(document => document.missions);
  const byId = new Map(missions.map(mission => [mission.missionId, mission] as const));
  for (const entry of manifest.missions) {
    const mission = byId.get(entry.missionId);
    if (!mission || mission.mapId !== entry.mapId) {
      throw new Error(`${entry.missionId} no coincide con ${entry.documentPath}.`);
    }
  }
  POKEDISCOVER_MISSION_CATALOG = Object.freeze(missions);
  MISSIONS_BY_ID = byId;
  return POKEDISCOVER_MISSION_CATALOG;
}

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
