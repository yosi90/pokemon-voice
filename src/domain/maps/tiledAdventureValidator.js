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
const optionalObjectLayers = Object.freeze({ Paths: 'AmbientPath', Occlusion: 'ActorOccluder' });
const meaningfulInteractionKinds = new Set([
  'npcConversation', 'inspection', 'pokemonInteraction', 'speciesIdentification',
  'companionBehavior', 'contextTrigger', 'secret', 'hint', 'collectible', 'research',
]);

function objectClass(object) {
  return object.class || object.type || '';
}

function objectProperties(object) {
  return new Map((object.properties ?? []).map(property => [property.name, property.value]));
}

function stableIdList(value) {
  return String(value ?? '').split(',').map(item => item.trim()).filter(Boolean);
}

function validMilliseconds(value) {
  if (value === undefined) return true;
  if (Number.isFinite(value)) return value >= 0;
  return value && Number.isFinite(value.min) && Number.isFinite(value.max)
    && value.min >= 0 && value.max >= value.min;
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
  const paths = new Map();
  const occluders = [];
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
    if (Object.hasOwn(optionalObjectLayers, object.layerName)) {
      if (!object.name?.trim()) {
        errors.push(`${assetId}: objeto de ${object.layerName} sin nombre estable`);
        continue;
      }
      if (names.has(object.name)) errors.push(`${assetId}: objeto duplicado ${object.name}`);
      names.add(object.name);
      const expectedClass = optionalObjectLayers[object.layerName];
      if (klass !== expectedClass) {
        errors.push(`${assetId}: ${object.name} debe usar la clase ${expectedClass}`);
        continue;
      }
      if (object.layerName === 'Paths') {
        const points = Array.isArray(object.polyline) ? object.polyline : [];
        if (points.length < 2 || points.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
          errors.push(`${assetId}: ${object.name} necesita una polilínea con al menos dos puntos`);
        } else paths.set(object.name, object);
      }
      if (object.layerName === 'Occlusion') {
        const polygon = Array.isArray(object.polygon) ? object.polygon : undefined;
        const polygonArea = polygon?.reduce((area, point, index) => {
          const next = polygon[(index + 1) % polygon.length];
          return area + point.x * next.y - next.x * point.y;
        }, 0) ?? 0;
        const validPolygon = polygon && polygon.length >= 3
          && polygon.every(point => Number.isFinite(point.x) && Number.isFinite(point.y))
          && Math.abs(polygonArea) > 0;
        const validRectangle = !polygon && object.width > 0 && object.height > 0;
        if (!validPolygon && !validRectangle) {
          errors.push(`${assetId}: ${object.name} necesita rectángulo o polígono de oclusión`);
        }
        const properties = objectProperties(object);
        const groupId = String(properties.get('occlusionGroup') ?? '').trim();
        if (!groupId) errors.push(`${assetId}: ${object.name} necesita la propiedad occlusionGroup`);
        occluders.push({
          ...object,
          groupId,
          includePlacementIds: stableIdList(properties.get('includePlacementIds')),
          excludePlacementIds: stableIdList(properties.get('excludePlacementIds')),
        });
      }
    }
  }
  return { errors, anchors, paths, occluders };
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
  const roomPaths = new Map();
  const roomOccluders = new Map();
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
    roomPaths.set(room.roomId, validation.paths);
    roomOccluders.set(room.roomId, validation.occluders);
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
    if (placement.initiallyHidden !== undefined && typeof placement.initiallyHidden !== 'boolean') {
      errors.push(`${placement.placementId}: initiallyHidden debe ser booleano`);
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

  const allPlacements = new Map([
    ...(adventure.actorPlacements ?? []).map(placement => [placement.placementId, placement]),
    ...(adventure.characterPlacements ?? []).map(placement => [placement.placementId, placement]),
  ]);

  const dialogueIds = new Set();
  for (const dialogue of adventure.dialogues ?? []) {
    if (dialogueIds.has(dialogue.dialogueId)) errors.push(`${dialogue.dialogueId}: diálogo duplicado`);
    dialogueIds.add(dialogue.dialogueId);
    if (!Array.isArray(dialogue.pages) || !dialogue.pages.length) {
      errors.push(`${dialogue.dialogueId}: necesita al menos una página`);
      continue;
    }
    const pageIds = new Set(dialogue.pages.map(page => page.pageId));
    if (pageIds.size !== dialogue.pages.length) errors.push(`${dialogue.dialogueId}: páginas duplicadas`);
    if (!pageIds.has(dialogue.initialPageId)) errors.push(`${dialogue.dialogueId}: página inicial inexistente ${dialogue.initialPageId}`);
    for (const page of dialogue.pages) {
      if (!page.speakerName?.trim() || !page.text?.trim()) errors.push(`${page.pageId}: speakerName y text son obligatorios`);
      if (page.nextPageId && !pageIds.has(page.nextPageId)) errors.push(`${page.pageId}: página siguiente inexistente ${page.nextPageId}`);
    }
  }

  const interactionIds = new Set();
  const notebookHints = new Map();
  for (const hint of adventure.fieldNotebookHints ?? []) {
    if (notebookHints.has(hint.hintId)) errors.push(`${hint.hintId}: pista de cuaderno duplicada`);
    notebookHints.set(hint.hintId, hint);
    if (!hint.hintId?.trim() || !hint.title?.trim() || !hint.text?.trim()) {
      errors.push(`${hint.hintId || adventure.mapId}: hintId, title y text son obligatorios`);
    }
    if (hint.mapId !== adventure.mapId) errors.push(`${hint.hintId}: mapId no coincide con ${adventure.mapId}`);
  }
  for (const interaction of adventure.interactions ?? []) {
    if (interactionIds.has(interaction.interactionId)) errors.push(`${interaction.interactionId}: interacción duplicada`);
    interactionIds.add(interaction.interactionId);
    if (!rooms.has(interaction.roomId)) errors.push(`${interaction.interactionId}: habitación inexistente ${interaction.roomId}`);
    if (!interaction.prompt?.trim()) errors.push(`${interaction.interactionId}: prompt obligatorio`);
    if (!dialogueIds.has(interaction.dialogueId)) errors.push(`${interaction.interactionId}: diálogo inexistente ${interaction.dialogueId}`);
    if (!meaningfulInteractionKinds.has(interaction.meaningfulKind)) {
      errors.push(`${interaction.interactionId}: meaningfulKind desconocido ${interaction.meaningfulKind}`);
    }
    if (interaction.rangeTiles !== undefined && (!Number.isInteger(interaction.rangeTiles) || interaction.rangeTiles < 1)) {
      errors.push(`${interaction.interactionId}: rangeTiles debe ser un entero positivo`);
    }
    if (interaction.repeatPolicy && !['oncePerVisit', 'repeatable'].includes(interaction.repeatPolicy)) {
      errors.push(`${interaction.interactionId}: repeatPolicy desconocido ${interaction.repeatPolicy}`);
    }
    const effects = interaction.completionEffects;
    for (const [field, value] of [
      ['npcId', effects?.npcId],
      ['conversationId', effects?.conversationId],
    ]) {
      if (value !== undefined && (typeof value !== 'string' || !value.trim())) {
        errors.push(`${interaction.interactionId}: ${field} debe ser un ID estable`);
      }
    }
    for (const hintId of effects?.hintIds ?? []) {
      if (!notebookHints.has(hintId)) {
        errors.push(`${interaction.interactionId}: pista de cuaderno inexistente ${hintId}`);
      }
    }
    for (const collectibleId of effects?.collectibleIds ?? []) {
      if (typeof collectibleId !== 'string' || !collectibleId.trim()) {
        errors.push(`${interaction.interactionId}: collectibleIds contiene un ID vacío`);
      }
    }
    if (interaction.target?.kind === 'placement') {
      const placement = allPlacements.get(interaction.target.placementId);
      if (!placement || placement.roomId !== interaction.roomId) {
        errors.push(`${interaction.interactionId}: placement objetivo inexistente ${interaction.target.placementId}`);
      }
    } else if (interaction.target?.kind === 'anchor') {
      const anchor = roomAnchors.get(interaction.roomId)?.get(interaction.target.anchorId);
      if (!anchor) errors.push(`${interaction.interactionId}: ancla objetivo inexistente ${interaction.target.anchorId}`);
      else if (anchor.class !== 'InteractionAnchor') errors.push(`${interaction.interactionId}: ${interaction.target.anchorId} no es InteractionAnchor`);
    } else errors.push(`${interaction.interactionId}: target desconocido`);
  }

  const expressionTriggerIds = new Set();
  for (const trigger of adventure.expressionTriggers ?? []) {
    if (expressionTriggerIds.has(trigger.triggerId)) errors.push(`${trigger.triggerId}: trigger expresivo duplicado`);
    expressionTriggerIds.add(trigger.triggerId);
    const hasSpatialField = Boolean(trigger.roomId || trigger.target || trigger.prompt);
    if (!hasSpatialField) continue;
    if (!trigger.roomId || !trigger.target || !trigger.prompt?.trim()) {
      errors.push(`${trigger.triggerId}: roomId, target y prompt deben declararse juntos`);
      continue;
    }
    if (!rooms.has(trigger.roomId)) errors.push(`${trigger.triggerId}: habitación inexistente ${trigger.roomId}`);
    if (trigger.rangeTiles !== undefined && (!Number.isInteger(trigger.rangeTiles) || trigger.rangeTiles < 1)) {
      errors.push(`${trigger.triggerId}: rangeTiles debe ser un entero positivo`);
    }
    if (trigger.target.kind === 'placement') {
      const placement = allPlacements.get(trigger.target.placementId);
      if (!placement || placement.roomId !== trigger.roomId) {
        errors.push(`${trigger.triggerId}: placement objetivo inexistente ${trigger.target.placementId}`);
      }
    } else if (trigger.target.kind === 'anchor') {
      const anchor = roomAnchors.get(trigger.roomId)?.get(trigger.target.anchorId);
      if (!anchor) errors.push(`${trigger.triggerId}: ancla objetivo inexistente ${trigger.target.anchorId}`);
      else if (anchor.class !== 'InteractionAnchor') errors.push(`${trigger.triggerId}: ${trigger.target.anchorId} no es InteractionAnchor`);
    } else errors.push(`${trigger.triggerId}: target desconocido`);
    if (trigger.inputMethods?.includes('contextAction') && !trigger.fallbackActionId) {
      errors.push(`${trigger.triggerId}: contextAction necesita fallbackActionId`);
    }
    for (const hintId of trigger.knownHintIds ?? []) {
      const hint = notebookHints.get(hintId);
      if (!hint) errors.push(`${trigger.triggerId}: pista expresiva inexistente ${hintId}`);
      else if (hint.relatedTriggerId && hint.relatedTriggerId !== trigger.triggerId) {
        errors.push(`${trigger.triggerId}: ${hintId} está relacionada con otro trigger`);
      }
    }
    if (trigger.rewardPackageId && !trigger.rewardOriginId) {
      errors.push(`${trigger.triggerId}: una recompensa necesita rewardOriginId`);
    }
    const expressionSecretIds = new Set();
    for (const secretId of trigger.completionEffects?.unlockSecretIds ?? []) {
      if (typeof secretId !== 'string' || !secretId.trim()) {
        errors.push(`${trigger.triggerId}: unlockSecretIds contiene un ID vacío`);
      } else if (expressionSecretIds.has(secretId)) {
        errors.push(`${trigger.triggerId}: secreto expresivo duplicado ${secretId}`);
      } else expressionSecretIds.add(secretId);
    }
    for (const matcher of trigger.matchAny ?? []) {
      if (matcher.kind !== 'acoustic') continue;
      if (!trigger.inputMethods?.includes('voice')) {
        errors.push(`${trigger.triggerId}: una condición acústica necesita el método voice`);
      }
      if (!['loudness', 'sustainedNote', 'simpleHum'].includes(matcher.feature)) {
        errors.push(`${trigger.triggerId}: propiedad acústica desconocida ${matcher.feature}`);
      }
      if (matcher.minimumLevel !== undefined
        && (!Number.isFinite(matcher.minimumLevel) || matcher.minimumLevel < 0 || matcher.minimumLevel > 1)) {
        errors.push(`${trigger.triggerId}: minimumLevel acústico debe estar entre 0 y 1`);
      }
      if (matcher.minimumDurationMs !== undefined
        && (!Number.isFinite(matcher.minimumDurationMs) || matcher.minimumDurationMs < 0)) {
        errors.push(`${trigger.triggerId}: minimumDurationMs acústico debe ser positivo`);
      }
    }
  }

  for (const [roomId, occluders] of roomOccluders) {
    const roomPlacements = [...allPlacements.values()].filter(placement => placement.roomId === roomId);
    const roomPlacementIds = new Set(roomPlacements.map(placement => placement.placementId));
    for (const occluder of occluders) {
      const groupMembers = roomPlacements.filter(placement => placement.occlusionGroupIds?.includes(occluder.groupId));
      if (occluder.groupId && !groupMembers.length && !occluder.includePlacementIds.length) {
        errors.push(`${occluder.name}: grupo de oclusión sin actores ${occluder.groupId}`);
      }
      for (const placementId of [...occluder.includePlacementIds, ...occluder.excludePlacementIds]) {
        if (!roomPlacementIds.has(placementId)) errors.push(`${occluder.name}: placement inexistente ${placementId}`);
      }
    }
  }

  const sequenceIds = new Set();
  for (const sequence of adventure.ambientSequences ?? []) {
    if (sequenceIds.has(sequence.sequenceId)) errors.push(`${sequence.sequenceId}: secuencia ambiental duplicada`);
    sequenceIds.add(sequence.sequenceId);
    if (!rooms.has(sequence.roomId)) errors.push(`${sequence.sequenceId}: habitación inexistente ${sequence.roomId}`);
    if (sequence.blockedPolicy !== 'pauseSequence') errors.push(`${sequence.sequenceId}: blockedPolicy debe ser pauseSequence`);
    if (!validMilliseconds(sequence.loopPauseMs)) errors.push(`${sequence.sequenceId}: loopPauseMs inválido`);
    if (!Array.isArray(sequence.beats) || !sequence.beats.length) {
      errors.push(`${sequence.sequenceId}: necesita al menos un beat`);
      continue;
    }
    const beatIds = new Set();
    for (const beat of sequence.beats) {
      if (beatIds.has(beat.beatId)) errors.push(`${sequence.sequenceId}: beat duplicado ${beat.beatId}`);
      beatIds.add(beat.beatId);
      if (!validMilliseconds(beat.pauseAfterMs)) errors.push(`${beat.beatId}: pauseAfterMs inválido`);
      if (!Array.isArray(beat.actions) || !beat.actions.length) errors.push(`${beat.beatId}: necesita acciones`);
      const beatPlacements = new Set();
      for (const action of beat.actions ?? []) {
        if (beatPlacements.has(action.placementId)) errors.push(`${beat.beatId}: más de una acción para ${action.placementId}`);
        beatPlacements.add(action.placementId);
        const placement = allPlacements.get(action.placementId);
        if (!placement || placement.roomId !== sequence.roomId) {
          errors.push(`${beat.beatId}: placement inexistente ${action.placementId}`);
          continue;
        }
        if (action.kind === 'playAnimation' || (action.kind === 'movePath' && action.animation)) {
          const actor = (adventure.actorPlacements ?? []).find(candidate => candidate.placementId === action.placementId);
          const asset = actor ? pmdAssets.get(actor.assetId) : undefined;
          const animationName = action.animation;
          if (!asset?.animations.some(animation => animation.name === animationName)) {
            errors.push(`${beat.beatId}: animación inexistente ${animationName} para ${action.placementId}`);
          }
        }
        if (action.kind === 'playAnimation' && (!Number.isInteger(action.repetitions ?? 1) || (action.repetitions ?? 1) < 1)) {
          errors.push(`${beat.beatId}: repetitions inválido para ${action.placementId}`);
        }
        if (action.kind === 'movePath') {
          const path = roomPaths.get(sequence.roomId)?.get(action.pathId);
          if (!path) errors.push(`${beat.beatId}: ruta inexistente ${action.pathId}`);
          if (!['grid', 'continuous'].includes(action.movementStyle)) errors.push(`${beat.beatId}: movementStyle inválido`);
          if (!(action.speedPixelsPerSecond > 0)) errors.push(`${beat.beatId}: velocidad inválida`);
          if (path && action.movementStyle === 'grid') {
            const points = path.polyline.map(point => ({ x: path.x + point.x, y: path.y + point.y }));
            const aligned = points.every(point => Number.isInteger(point.x / 16) && Number.isInteger(point.y / 16));
            const orthogonal = points.slice(1).every((point, index) => point.x === points[index].x || point.y === points[index].y);
            if (!aligned || !orthogonal) errors.push(`${beat.beatId}: ${action.pathId} debe ser ortogonal y ajustarse a 16 px`);
          }
        }
      }
    }
  }

  const companionSequenceIds = new Set();
  for (const sequence of adventure.companionSequences ?? []) {
    if (companionSequenceIds.has(sequence.sequenceId)) errors.push(`${sequence.sequenceId}: secuencia de compañero duplicada`);
    companionSequenceIds.add(sequence.sequenceId);
    if (!rooms.has(sequence.roomId)) errors.push(`${sequence.sequenceId}: habitación inexistente ${sequence.roomId}`);
    if (!Array.isArray(sequence.beats) || !sequence.beats.length) {
      errors.push(`${sequence.sequenceId}: necesita al menos un beat`);
      continue;
    }
    const beatIds = new Set();
    for (const beat of sequence.beats) {
      if (beatIds.has(beat.beatId)) errors.push(`${sequence.sequenceId}: beat duplicado ${beat.beatId}`);
      beatIds.add(beat.beatId);
      if (!Number.isFinite(beat.pauseAfterMs ?? 0) || (beat.pauseAfterMs ?? 0) < 0) {
        errors.push(`${beat.beatId}: pauseAfterMs inválido`);
      }
      const actorRefs = new Set();
      for (const action of beat.actions ?? []) {
        if (actorRefs.has(action.actorRef)) errors.push(`${beat.beatId}: más de una acción para ${action.actorRef}`);
        actorRefs.add(action.actorRef);
        const dynamic = ['dynamic:companion', 'dynamic:player'].includes(action.actorRef);
        const placement = dynamic ? undefined : allPlacements.get(action.actorRef);
        if (!dynamic && (!placement || placement.roomId !== sequence.roomId)) {
          errors.push(`${beat.beatId}: actorRef inexistente ${action.actorRef}`);
          continue;
        }
        if (action.kind === 'playAnimation') {
          if (!action.animation && !Object.keys(action.animationByCompanionSpecies ?? {}).length) {
            errors.push(`${beat.beatId}: playAnimation necesita animation o animationByCompanionSpecies`);
          }
          if (action.actorRef === 'dynamic:player') errors.push(`${beat.beatId}: el protagonista no admite animaciones PMD`);
          if (placement && action.animation) {
            const actorPlacement = (adventure.actorPlacements ?? []).find(item => item.placementId === action.actorRef);
            const asset = actorPlacement ? pmdAssets.get(actorPlacement.assetId) : undefined;
            if (!asset?.animations.some(animation => animation.name === action.animation)) {
              errors.push(`${beat.beatId}: animación inexistente ${action.animation} para ${action.actorRef}`);
            }
          }
          for (const [speciesId, animationName] of Object.entries(action.animationByCompanionSpecies ?? {})) {
            const assets = [...pmdAssets.values()].filter(asset => asset.speciesId === Number(speciesId));
            if (!assets.length || assets.every(asset => !asset.animations.some(animation => animation.name === animationName))) {
              errors.push(`${beat.beatId}: ${animationName} no existe para la especie ${speciesId}`);
            }
          }
        }
        if (action.kind === 'moveToAnchor') {
          const anchor = roomAnchors.get(sequence.roomId)?.get(action.anchorId);
          if (!anchor || anchor.class !== 'ActorAnchor') errors.push(`${beat.beatId}: ancla de movimiento inexistente ${action.anchorId}`);
        }
        if (action.kind === 'moveByTiles' && (!Number.isInteger(action.tiles) || action.tiles < 1)) {
          errors.push(`${beat.beatId}: tiles debe ser un entero positivo`);
        }
        if (action.kind === 'returnToTrainer' && action.actorRef !== 'dynamic:companion') {
          errors.push(`${beat.beatId}: returnToTrainer solo admite dynamic:companion`);
        }
      }
    }
  }

  const behaviorTriggerIds = new Set();
  for (const trigger of adventure.behaviorTriggers ?? []) {
    if (behaviorTriggerIds.has(trigger.triggerId)) errors.push(`${trigger.triggerId}: comportamiento duplicado`);
    behaviorTriggerIds.add(trigger.triggerId);
    if (!companionSequenceIds.has(trigger.sequenceId)) errors.push(`${trigger.triggerId}: secuencia inexistente ${trigger.sequenceId}`);
    if ((trigger.rewards?.length || trigger.rewardPackageId) && !trigger.rewardOriginId) {
      errors.push(`${trigger.triggerId}: una recompensa necesita rewardOriginId`);
    }
    if (trigger.proximity) {
      if (!rooms.has(trigger.proximity.roomId)) errors.push(`${trigger.triggerId}: habitación de proximidad inexistente`);
      if (trigger.proximity.rangeTiles !== undefined
        && (!Number.isInteger(trigger.proximity.rangeTiles) || trigger.proximity.rangeTiles < 1)) {
        errors.push(`${trigger.triggerId}: rangeTiles debe ser un entero positivo`);
      }
      if (trigger.proximity.failureSequenceId && !companionSequenceIds.has(trigger.proximity.failureSequenceId)) {
        errors.push(`${trigger.triggerId}: secuencia de fallo inexistente ${trigger.proximity.failureSequenceId}`);
      }
      if (trigger.proximity.target?.kind === 'placement') {
        const placement = allPlacements.get(trigger.proximity.target.placementId);
        if (!placement || placement.roomId !== trigger.proximity.roomId) {
          errors.push(`${trigger.triggerId}: placement de proximidad inexistente ${trigger.proximity.target.placementId}`);
        }
      } else if (trigger.proximity.target?.kind === 'anchor') {
        if (!roomAnchors.get(trigger.proximity.roomId)?.has(trigger.proximity.target.anchorId)) {
          errors.push(`${trigger.triggerId}: ancla de proximidad inexistente ${trigger.proximity.target.anchorId}`);
        }
      } else errors.push(`${trigger.triggerId}: target de proximidad desconocido`);
    }
  }

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
