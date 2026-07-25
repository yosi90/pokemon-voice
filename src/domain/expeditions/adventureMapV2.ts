import type { AdventureMapV2 } from '../../../packages/contracts/src/index.js';

export function validateAdventureMapV2(map: AdventureMapV2) {
  const errors: string[] = [];
  if (!map.mapId?.trim()) errors.push('mapId ausente');
  if (!map.rooms.length) errors.push(`${map.mapId}: debe contener al menos una habitación`);
  const rooms = new Map<string, AdventureMapV2['rooms'][number]>();
  const tiledAssets = new Map<string, AdventureMapV2['tiledMapAssets'][number]>();
  const placements = new Set<string>();
  const characterPlacements = new Set<string>();
  const transitions = new Set<string>();
  for (const asset of map.tiledMapAssets) {
    if (tiledAssets.has(asset.assetId)) errors.push(`${asset.assetId}: asset Tiled duplicado`);
    tiledAssets.set(asset.assetId, asset);
    if (!asset.path?.endsWith('.tmj')) errors.push(`${asset.assetId}: la ruta debe terminar en .tmj`);
  }
  for (const room of map.rooms) {
    if (rooms.has(room.roomId)) errors.push(`${room.roomId}: habitación duplicada`);
    rooms.set(room.roomId, room);
    if (!room.tiledMapAssetId?.trim()) errors.push(`${room.roomId}: falta tiledMapAssetId`);
    else if (!tiledAssets.has(room.tiledMapAssetId)) errors.push(`${room.roomId}: asset Tiled inexistente`);
    if (new Set(room.spawnAnchorIds).size !== room.spawnAnchorIds.length) {
      errors.push(`${room.roomId}: ancla de aparición duplicada`);
    }
  }
  for (const placement of map.actorPlacements) {
    if (placements.has(placement.placementId)) errors.push(`${placement.placementId}: actor duplicado`);
    placements.add(placement.placementId);
    if (!rooms.has(placement.roomId)) errors.push(`${placement.placementId}: habitación inexistente`);
    if (!placement.anchorId?.trim()) errors.push(`${placement.placementId}: ancla ausente`);
    if (!map.requiredAssetIds.includes(placement.assetId)) {
      errors.push(`${placement.placementId}: asset no declarado en requiredAssetIds`);
    }
    if (!placement.animation?.trim()) errors.push(`${placement.placementId}: animación ausente`);
    if (placement.renderScaleMultiplier !== undefined
      && (!Number.isFinite(placement.renderScaleMultiplier)
        || placement.renderScaleMultiplier < .1
        || placement.renderScaleMultiplier > 5)) {
      errors.push(`${placement.placementId}: el tamaño relativo debe estar entre 10 % y 500 %`);
    }
  }
  for (const placement of map.characterPlacements) {
    if (characterPlacements.has(placement.placementId)) errors.push(`${placement.placementId}: personaje duplicado`);
    characterPlacements.add(placement.placementId);
    if (!rooms.has(placement.roomId)) errors.push(`${placement.placementId}: habitación inexistente`);
    if (!placement.anchorId?.trim()) errors.push(`${placement.placementId}: ancla ausente`);
    if (!map.requiredAssetIds.includes(placement.assetId)) {
      errors.push(`${placement.placementId}: asset no declarado en requiredAssetIds`);
    }
    if (placement.renderScaleMultiplier !== undefined
      && (!Number.isFinite(placement.renderScaleMultiplier)
        || placement.renderScaleMultiplier < .1
        || placement.renderScaleMultiplier > 5)) {
      errors.push(`${placement.placementId}: el tamaño relativo debe estar entre 10 % y 500 %`);
    }
  }
  for (const transition of map.transitions) {
    if (transitions.has(transition.transitionId)) errors.push(`${transition.transitionId}: transición duplicada`);
    transitions.add(transition.transitionId);
    const from = rooms.get(transition.fromRoomId);
    const to = rooms.get(transition.toRoomId);
    if (!from) errors.push(`${transition.transitionId}: habitación de origen inexistente`);
    if (!to) errors.push(`${transition.transitionId}: habitación de destino inexistente`);
    if (from && !from.spawnAnchorIds.includes(transition.fromAnchorId)) {
      errors.push(`${transition.transitionId}: ancla de origen inexistente`);
    }
    if (to && !to.spawnAnchorIds.includes(transition.toAnchorId)) {
      errors.push(`${transition.transitionId}: ancla de destino inexistente`);
    }
  }
  const entryPoints = new Map<string, NonNullable<AdventureMapV2['entryPoints']>[number]>();
  for (const entry of map.entryPoints ?? []) {
    if (entryPoints.has(entry.entryPointId)) errors.push(`${entry.entryPointId}: punto de entrada duplicado`);
    entryPoints.set(entry.entryPointId, entry);
    const room = rooms.get(entry.roomId);
    if (!room) errors.push(`${entry.entryPointId}: habitación de entrada inexistente`);
    else if (!room.spawnAnchorIds.includes(entry.anchorId)) {
      errors.push(`${entry.entryPointId}: ancla de entrada no registrada en la habitación`);
    }
    if (!entry.label?.trim()) errors.push(`${entry.entryPointId}: falta el nombre visible`);
  }
  const assignedMissions = new Set<string>();
  for (const assignment of map.missionEntryPoints ?? []) {
    if (assignedMissions.has(assignment.missionId)) {
      errors.push(`${assignment.missionId}: asignación de entrada duplicada`);
    }
    assignedMissions.add(assignment.missionId);
    if (!map.missionIds.includes(assignment.missionId)) {
      errors.push(`${assignment.missionId}: la misión no pertenece al mapa`);
    }
    if (!entryPoints.has(assignment.entryPointId)) {
      errors.push(`${assignment.missionId}: punto de entrada inexistente ${assignment.entryPointId}`);
    }
  }
  if (map.freeExpeditionEntryPointId && !entryPoints.has(map.freeExpeditionEntryPointId)) {
    errors.push(`${map.mapId}: entrada de expedición libre inexistente ${map.freeExpeditionEntryPointId}`);
  }
  return errors;
}
