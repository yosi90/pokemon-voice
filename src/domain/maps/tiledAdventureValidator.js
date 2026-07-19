export const TILED_REQUIRED_LAYERS = Object.freeze({
  Ground: 'tilelayer',
  Collision: 'objectgroup',
  Above: 'tilelayer',
  Anchors: 'objectgroup',
});

export const TILED_ANCHOR_CLASSES = Object.freeze([
  'PlayerSpawn',
  'TransitionAnchor',
  'ActorAnchor',
  'EncounterAnchor',
  'InteractionAnchor',
  'SecretAnchor',
]);

const anchorClassSet = new Set(TILED_ANCHOR_CLASSES);

function objectClass(object) {
  return object.class || object.type || '';
}

function validateTiledRoom(assetId, tiled) {
  const errors = [];
  if (!tiled || typeof tiled !== 'object') return [`${assetId}: TMJ ausente o inválido`];
  if (tiled.type !== 'map') errors.push(`${assetId}: type debe ser map`);
  if (tiled.orientation !== 'orthogonal') errors.push(`${assetId}: orientation debe ser orthogonal`);
  if (tiled.infinite !== false) errors.push(`${assetId}: el mapa debe ser finito`);
  if (tiled.tilewidth !== 16 || tiled.tileheight !== 16) errors.push(`${assetId}: los tiles deben medir 16x16`);
  if (!Number.isSafeInteger(tiled.width) || tiled.width <= 0
    || !Number.isSafeInteger(tiled.height) || tiled.height <= 0) {
    errors.push(`${assetId}: dimensiones de habitación inválidas`);
  }

  const layers = Array.isArray(tiled.layers) ? tiled.layers : [];
  const layersByName = new Map();
  for (const layer of layers) {
    if (layersByName.has(layer.name)) errors.push(`${assetId}: capa duplicada ${layer.name}`);
    layersByName.set(layer.name, layer);
  }
  for (const [name, type] of Object.entries(TILED_REQUIRED_LAYERS)) {
    const layer = layersByName.get(name);
    if (!layer) errors.push(`${assetId}: falta la capa ${name}`);
    else if (layer.type !== type) errors.push(`${assetId}: ${name} debe ser ${type}`);
  }

  const objects = layers
    .filter(layer => layer.type === 'objectgroup')
    .flatMap(layer => (layer.objects ?? []).map(object => ({ ...object, layerName: layer.name })));
  const names = new Set();
  const anchors = new Map();
  for (const object of objects) {
    const klass = objectClass(object);
    if (object.layerName === 'Collision') {
      const label = object.name?.trim() || `colisión #${object.id ?? '?'}`;
      if (klass && klass !== 'Collision') errors.push(`${assetId}: ${label} usa una clase distinta de Collision`);
      if (!(object.polygon || (object.width > 0 && object.height > 0))) {
        errors.push(`${assetId}: ${label} necesita rectángulo o polígono de colisión`);
      }
    }
    if (object.layerName === 'Anchors') {
      if (!object.name?.trim()) {
        errors.push(`${assetId}: objeto de Anchors sin nombre estable`);
        continue;
      }
      if (names.has(object.name)) errors.push(`${assetId}: objeto duplicado ${object.name}`);
      names.add(object.name);
      if (!anchorClassSet.has(klass)) errors.push(`${assetId}: clase de ancla desconocida ${klass || '(vacía)'}`);
      else {
        if (klass === 'TransitionAnchor' && !(object.width > 0 && object.height > 0)) {
          errors.push(`${assetId}: ${object.name} debe ser un rectángulo de transición`);
        }
        anchors.set(object.name, { ...object, class: klass });
      }
    }
  }
  return { errors, anchors };
}

export function validateTiledAdventureBundle({ adventure, tiledMaps, pmdManifest, characterManifest }) {
  const errors = [];
  const rooms = new Map((adventure.rooms ?? []).map(room => [room.roomId, room]));
  const tiledAssets = new Map();
  for (const asset of adventure.tiledMapAssets ?? []) {
    if (tiledAssets.has(asset.assetId)) errors.push(`${asset.assetId}: referencia Tiled duplicada`);
    tiledAssets.set(asset.assetId, asset);
  }
  const roomAnchors = new Map();
  for (const room of adventure.rooms ?? []) {
    const asset = tiledAssets.get(room.tiledMapAssetId);
    if (!asset) {
      errors.push(`${room.roomId}: tiledMapAssetId no declarado`);
      continue;
    }
    const validation = validateTiledRoom(asset.assetId, tiledMaps[asset.assetId]);
    if (Array.isArray(validation)) {
      errors.push(...validation);
      continue;
    }
    errors.push(...validation.errors);
    roomAnchors.set(room.roomId, validation.anchors);
    for (const anchorId of room.spawnAnchorIds ?? []) {
      const anchor = validation.anchors.get(anchorId);
      if (!anchor) errors.push(`${room.roomId}: spawnAnchorId inexistente ${anchorId}`);
      else if (!['PlayerSpawn', 'TransitionAnchor'].includes(anchor.class)) {
        errors.push(`${room.roomId}: ${anchorId} no es PlayerSpawn ni TransitionAnchor`);
      }
    }
  }

  const pmdAssets = new Map((pmdManifest?.assets ?? []).map(asset => [asset.assetId, asset]));
  const characterAssets = new Map((characterManifest?.assets ?? []).map(asset => [asset.assetId, asset]));
  const placements = new Set();
  for (const placement of adventure.actorPlacements ?? []) {
    if (placements.has(placement.placementId)) errors.push(`${placement.placementId}: colocación duplicada`);
    placements.add(placement.placementId);
    if (placement.collision && !['solid', 'pass-through'].includes(placement.collision)) {
      errors.push(`${placement.placementId}: colisión de actor desconocida ${placement.collision}`);
    }
    if (!rooms.has(placement.roomId)) {
      errors.push(`${placement.placementId}: habitación inexistente`);
      continue;
    }
    const anchor = roomAnchors.get(placement.roomId)?.get(placement.anchorId);
    if (!anchor) errors.push(`${placement.placementId}: ancla inexistente ${placement.anchorId}`);
    else if (anchor.class !== 'ActorAnchor') errors.push(`${placement.placementId}: ${placement.anchorId} no es ActorAnchor`);
    if (!(adventure.requiredAssetIds ?? []).includes(placement.assetId)) {
      errors.push(`${placement.placementId}: asset ausente en requiredAssetIds`);
    }
    const sprite = pmdAssets.get(placement.assetId);
    if (!sprite) errors.push(`${placement.placementId}: asset PMD inexistente ${placement.assetId}`);
    else if (!sprite.animations.some(animation => animation.name === placement.animation)) {
      errors.push(`${placement.placementId}: animación inexistente ${placement.animation}`);
    }
  }

  const characterPlacements = new Set();
  let controllableCount = 0;
  for (const placement of adventure.characterPlacements ?? []) {
    if (characterPlacements.has(placement.placementId)) errors.push(`${placement.placementId}: personaje duplicado`);
    characterPlacements.add(placement.placementId);
    if (placement.collision && !['solid', 'pass-through'].includes(placement.collision)) {
      errors.push(`${placement.placementId}: colisión de personaje desconocida ${placement.collision}`);
    }
    if (!rooms.has(placement.roomId)) {
      errors.push(`${placement.placementId}: habitación inexistente`);
      continue;
    }
    const anchor = roomAnchors.get(placement.roomId)?.get(placement.anchorId);
    if (!anchor) errors.push(`${placement.placementId}: ancla inexistente ${placement.anchorId}`);
    else if (placement.controllable && anchor.class !== 'PlayerSpawn') {
      errors.push(`${placement.placementId}: el personaje controlable necesita PlayerSpawn`);
    } else if (!placement.controllable && anchor.class !== 'ActorAnchor') {
      errors.push(`${placement.placementId}: ${placement.anchorId} no es ActorAnchor`);
    }
    if (!(adventure.requiredAssetIds ?? []).includes(placement.assetId)) {
      errors.push(`${placement.placementId}: asset ausente en requiredAssetIds`);
    }
    if (!characterAssets.has(placement.assetId)) {
      errors.push(`${placement.placementId}: asset de personaje inexistente ${placement.assetId}`);
    }
    if (placement.controllable) controllableCount += 1;
  }
  if (controllableCount > 1) errors.push(`${adventure.mapId}: solo puede existir un personaje controlable por habitación`);

  for (const transition of adventure.transitions ?? []) {
    const from = roomAnchors.get(transition.fromRoomId)?.get(transition.fromAnchorId);
    const to = roomAnchors.get(transition.toRoomId)?.get(transition.toAnchorId);
    if (!from) errors.push(`${transition.transitionId}: ancla Tiled de origen inexistente`);
    else if (from.class !== 'TransitionAnchor') errors.push(`${transition.transitionId}: el origen no es TransitionAnchor`);
    if (!to) errors.push(`${transition.transitionId}: ancla Tiled de destino inexistente`);
    else if (to.class !== 'TransitionAnchor') errors.push(`${transition.transitionId}: el destino no es TransitionAnchor`);
  }
  return errors;
}
