import type { AdventureMapV2 } from '../../../packages/contracts/src/index.js';

export function validateAdventureMapV2(map: AdventureMapV2) {
  const errors: string[] = [];
  if (!map.mapId?.trim()) errors.push('mapId ausente');
  if (!map.rooms.length) errors.push(`${map.mapId}: debe contener al menos una habitación`);
  const rooms = new Map<string, AdventureMapV2['rooms'][number]>();
  const transitions = new Set<string>();
  for (const room of map.rooms) {
    if (rooms.has(room.roomId)) errors.push(`${room.roomId}: habitación duplicada`);
    rooms.set(room.roomId, room);
    if (!room.tiledMapAssetId?.trim()) errors.push(`${room.roomId}: falta tiledMapAssetId`);
    if (new Set(room.spawnAnchorIds).size !== room.spawnAnchorIds.length) {
      errors.push(`${room.roomId}: ancla de aparición duplicada`);
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
  return errors;
}
