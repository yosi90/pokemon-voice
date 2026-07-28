import {
  ADVENTURE_ACTOR_COLLISIONS,
  ADVENTURE_ENTRY_REPEAT_POLICIES,
  MAP_EVENT_ACTIVATION_KINDS,
  MAP_EVENT_REPEAT_POLICIES,
  MAP_SEQUENCE_ACTION_KINDS,
  MEANINGFUL_EXPEDITION_INTERACTION_KINDS,
  TILED_ANCHOR_CLASSES,
} from '../../../packages/contracts/src/adventureVocabulary.js';

export const TILED_REQUIRED_LAYERS = Object.freeze({
  Ground: 'tilelayer',
  Collision: 'objectgroup',
  Above: 'tilelayer',
  Anchors: 'objectgroup',
});

export { TILED_ANCHOR_CLASSES };

const anchorClassSet = new Set(TILED_ANCHOR_CLASSES);
const optionalObjectLayers = Object.freeze({
  Paths: 'AmbientPath',
  Occlusion: 'ActorOccluder',
  Triggers: 'TriggerZone',
  Comments: 'EditorComment',
});
const meaningfulInteractionKinds = new Set(MEANINGFUL_EXPEDITION_INTERACTION_KINDS);
const mapEventActivationKinds = new Set(MAP_EVENT_ACTIVATION_KINDS);
const mapEventRepeatPolicies = new Set(MAP_EVENT_REPEAT_POLICIES);
const mapSequenceActionKinds = new Set(MAP_SEQUENCE_ACTION_KINDS);
const editorCommentPropertyNames = new Set([
  'text',
  'migrationSourceObjectId',
  'migrationSourceObjectName',
  'migrationSourceObjectClass',
  'pendingConnectionTargetFileName',
  'pendingConnectionSourceEdge',
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

function validPlacementScale(value) {
  return value === undefined || (Number.isFinite(value) && value >= .1 && value <= 5);
}

function validAreaGeometry(object) {
  const polygon = Array.isArray(object.polygon) ? object.polygon : undefined;
  const polygonArea = polygon?.reduce((area, point, index) => {
    const next = polygon[(index + 1) % polygon.length];
    return area + point.x * next.y - next.x * point.y;
  }, 0) ?? 0;
  const validPolygon = polygon && polygon.length >= 3
    && polygon.every(point => Number.isFinite(point.x) && Number.isFinite(point.y))
    && Math.abs(polygonArea) > 0;
  const validRectangle = !polygon && object.width > 0 && object.height > 0;
  return Boolean(validPolygon || validRectangle);
}

function normalizeAdventureForValidation(source) {
  if (source?.schemaVersion !== 2) return source;
  const sectorId = roomId => roomId;
  return {
    ...source,
    schemaVersion: 3,
    sectors: (source.rooms ?? []).map(room => ({
      ...room,
      sectorId: sectorId(room.roomId),
      legacyRoomIds: [room.roomId],
      roster: {
        schemaVersion: 1,
        pokemonAssetIds: (source.actorPlacements ?? [])
          .filter(placement => placement.roomId === room.roomId)
          .map(placement => placement.assetId),
        npcAssetIds: (source.characterPlacements ?? [])
          .filter(placement => placement.roomId === room.roomId && !placement.controllable)
          .map(placement => placement.assetId),
      },
    })),
    actorPlacements: (source.actorPlacements ?? [])
      .map(({ roomId, ...placement }) => ({ ...placement, sectorId: sectorId(roomId) })),
    characterPlacements: (source.characterPlacements ?? [])
      .map(({ roomId, ...placement }) => ({ ...placement, sectorId: sectorId(roomId) })),
    transitions: (source.transitions ?? []).map(({ fromRoomId, toRoomId, ...transition }) => ({
      ...transition,
      fromSectorId: sectorId(fromRoomId),
      toSectorId: sectorId(toRoomId),
    })),
    entryPoints: (source.entryPoints ?? [])
      .map(({ roomId, ...entry }) => ({ ...entry, sectorId: sectorId(roomId) })),
    behaviorTriggers: (source.behaviorTriggers ?? []).map(trigger => ({
      ...trigger,
      proximity: trigger.proximity
        ? {
          ...trigger.proximity,
          sectorId: sectorId(trigger.proximity.roomId),
          roomId: undefined,
        }
        : undefined,
    })),
    companionSequences: (source.companionSequences ?? [])
      .map(({ roomId, ...sequence }) => ({ ...sequence, sectorId: sectorId(roomId) })),
    mapSequences: (source.mapSequences ?? [])
      .map(({ roomId, ...sequence }) => ({ ...sequence, sectorId: sectorId(roomId) })),
    mapEventTriggers: (source.mapEventTriggers ?? [])
      .map(({ roomId, ...trigger }) => ({ ...trigger, sectorId: sectorId(roomId) })),
    expressionTriggers: (source.expressionTriggers ?? [])
      .map(({ roomId, ...trigger }) => ({ ...trigger, ...(roomId ? { sectorId: sectorId(roomId) } : {}) })),
    interactions: (source.interactions ?? [])
      .map(({ roomId, ...interaction }) => ({ ...interaction, sectorId: sectorId(roomId) })),
    ambientSequences: (source.ambientSequences ?? [])
      .map(({ roomId, ...sequence }) => ({ ...sequence, sectorId: sectorId(roomId) })),
  };
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
    errors.push(`${assetId}: dimensiones de sector inválidas`);
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
  for (const name of Object.keys(optionalObjectLayers)) {
    const layer = layersByName.get(name);
    if (layer && layer.type !== 'objectgroup') errors.push(`${assetId}: ${name} debe ser objectgroup`);
  }

  const objects = layers
    .filter(layer => layer.type === 'objectgroup')
    .flatMap(layer => (layer.objects ?? []).map(object => ({ ...object, layerName: layer.name })));
  const names = new Set();
  const anchors = new Map();
  const paths = new Map();
  const triggerZones = new Map();
  const occluders = [];
  for (const object of objects) {
    const klass = objectClass(object);
    if (klass === 'EditorComment' && object.layerName !== 'Comments') {
      errors.push(`${assetId}: ${object.name || `#${object.id ?? '?'}`} usa EditorComment fuera de Comments`);
    }
    if (klass === 'TriggerZone' && object.layerName !== 'Triggers') {
      errors.push(`${assetId}: ${object.name || `#${object.id ?? '?'}`} usa TriggerZone fuera de Triggers`);
    }
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
        if (!validAreaGeometry(object)) {
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
      if (object.layerName === 'Triggers') {
        if (!/^trigger:map:\d{2,}:zone:\d{2,}$/.test(object.name)) {
          errors.push(`${assetId}: ${object.name} no respeta el ID de zona trigger:map:NN:zone:NN`);
        }
        if (!validAreaGeometry(object)) {
          errors.push(`${assetId}: ${object.name} necesita rectángulo o polígono de trigger`);
        } else triggerZones.set(object.name, object);
      }
      if (object.layerName === 'Comments') {
        if (!/^comment:\d{2,}$/.test(object.name)) {
          errors.push(`${assetId}: ${object.name} no respeta el ID editorial comment:NN`);
        }
        if (!validAreaGeometry(object)) {
          errors.push(`${assetId}: ${object.name} necesita rectángulo o polígono editorial`);
        }
        const properties = objectProperties(object);
        if (!String(properties.get('text') ?? '').trim()) {
          errors.push(`${assetId}: ${object.name} necesita texto editorial`);
        }
        for (const propertyName of properties.keys()) {
          if (!editorCommentPropertyNames.has(propertyName)) {
            errors.push(`${assetId}: ${object.name} contiene la propiedad no editorial ${propertyName}`);
          }
        }
      }
    }
  }
  return { errors, anchors, paths, triggerZones, occluders };
}

export function validateTiledAdventureBundle({ adventure, tiledMaps, pmdManifest, characterManifest }) {
  const strictSectorRosters = adventure?.schemaVersion === 3;
  adventure = normalizeAdventureForValidation(adventure);
  const errors = [];
  const rooms = new Map((adventure.sectors ?? []).map(room => [room.sectorId, room]));
  const tiledAssets = new Map();
  for (const asset of adventure.tiledMapAssets ?? []) {
    if (tiledAssets.has(asset.assetId)) errors.push(`${asset.assetId}: referencia Tiled duplicada`);
    tiledAssets.set(asset.assetId, asset);
  }
  const roomAnchors = new Map();
  const roomPaths = new Map();
  const roomTriggerZones = new Map();
  const roomOccluders = new Map();
  for (const room of adventure.sectors ?? []) {
    const asset = tiledAssets.get(room.tiledMapAssetId);
    if (!asset) {
      errors.push(`${room.sectorId}: tiledMapAssetId no declarado`);
      continue;
    }
    const validation = validateTiledRoom(asset.assetId, tiledMaps[asset.assetId]);
    if (Array.isArray(validation)) {
      errors.push(...validation);
      continue;
    }
    errors.push(...validation.errors);
    roomAnchors.set(room.sectorId, validation.anchors);
    roomPaths.set(room.sectorId, validation.paths);
    roomTriggerZones.set(room.sectorId, validation.triggerZones);
    roomOccluders.set(room.sectorId, validation.occluders);
    for (const anchorId of room.spawnAnchorIds ?? []) {
      const anchor = validation.anchors.get(anchorId);
      if (!anchor) errors.push(`${room.sectorId}: spawnAnchorId inexistente ${anchorId}`);
      else if (!['PlayerSpawn', 'TransitionAnchor'].includes(anchor.class)) {
        errors.push(`${room.sectorId}: ${anchorId} no es PlayerSpawn ni TransitionAnchor`);
      }
    }
  }

  const pmdAssets = new Map((pmdManifest?.assets ?? []).map(asset => [asset.assetId, asset]));
  const characterAssets = new Map((characterManifest?.assets ?? []).map(asset => [asset.assetId, asset]));
  if (strictSectorRosters) {
    const requiredAssets = new Set(adventure.requiredAssetIds ?? []);
    for (const sector of adventure.sectors ?? []) {
      const pokemon = sector.roster?.pokemonAssetIds ?? [];
      const npcs = sector.roster?.npcAssetIds ?? [];
      if (new Set(pokemon).size !== pokemon.length) {
        errors.push(`${sector.sectorId}: el reparto Pokémon contiene assets duplicados`);
      }
      if (pokemon.length < 5) {
        errors.push(`${sector.sectorId}: el reparto necesita al menos 5 assets Pokémon`);
      }
      if (new Set(npcs).size !== npcs.length) {
        errors.push(`${sector.sectorId}: el reparto NPC contiene assets duplicados`);
      }
      for (const assetId of pokemon) {
        if (!pmdAssets.has(assetId)) errors.push(`${sector.sectorId}: asset Pokémon inexistente ${assetId}`);
        if (!requiredAssets.has(assetId)) errors.push(`${sector.sectorId}: requiredAssetIds no contiene ${assetId}`);
      }
      for (const assetId of npcs) {
        if (!characterAssets.has(assetId)) errors.push(`${sector.sectorId}: asset NPC inexistente ${assetId}`);
        if (!requiredAssets.has(assetId)) errors.push(`${sector.sectorId}: requiredAssetIds no contiene ${assetId}`);
      }
    }
  }
  const placements = new Set();
  for (const placement of adventure.actorPlacements ?? []) {
    if (placements.has(placement.placementId)) errors.push(`${placement.placementId}: colocación duplicada`);
    placements.add(placement.placementId);
    if (placement.collision && !ADVENTURE_ACTOR_COLLISIONS.includes(placement.collision)) {
      errors.push(`${placement.placementId}: colisión de actor desconocida ${placement.collision}`);
    }
    if (placement.initiallyHidden !== undefined && typeof placement.initiallyHidden !== 'boolean') {
      errors.push(`${placement.placementId}: initiallyHidden debe ser booleano`);
    }
    if (!validPlacementScale(placement.renderScaleMultiplier)) {
      errors.push(`${placement.placementId}: renderScaleMultiplier debe estar entre 0.1 y 5`);
    }
    if (!rooms.has(placement.sectorId)) {
      errors.push(`${placement.placementId}: sector inexistente`);
      continue;
    }
    if (strictSectorRosters
      && !rooms.get(placement.sectorId)?.roster?.pokemonAssetIds?.includes(placement.assetId)) {
      errors.push(`${placement.placementId}: asset fuera del reparto Pokémon del sector`);
    }
    const anchor = roomAnchors.get(placement.sectorId)?.get(placement.anchorId);
    if (!anchor) errors.push(`${placement.placementId}: ancla inexistente ${placement.anchorId}`);
    else if (!['ActorAnchor', 'EncounterAnchor'].includes(anchor.class)) {
      errors.push(`${placement.placementId}: ${placement.anchorId} no es ActorAnchor ni EncounterAnchor`);
    }
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
    if (placement.collision && !ADVENTURE_ACTOR_COLLISIONS.includes(placement.collision)) {
      errors.push(`${placement.placementId}: colisión de personaje desconocida ${placement.collision}`);
    }
    if (!validPlacementScale(placement.renderScaleMultiplier)) {
      errors.push(`${placement.placementId}: renderScaleMultiplier debe estar entre 0.1 y 5`);
    }
    if (!rooms.has(placement.sectorId)) {
      errors.push(`${placement.placementId}: sector inexistente`);
      continue;
    }
    if (strictSectorRosters && !placement.controllable
      && !rooms.get(placement.sectorId)?.roster?.npcAssetIds?.includes(placement.assetId)) {
      errors.push(`${placement.placementId}: asset fuera del reparto NPC del sector`);
    }
    const anchor = roomAnchors.get(placement.sectorId)?.get(placement.anchorId);
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
  if (controllableCount > 1) errors.push(`${adventure.mapId}: solo puede existir un personaje controlable por sector`);

  const variantIds = new Set();
  for (const variant of adventure.variants ?? []) {
    if (!variant.variantId?.trim()) errors.push(`${adventure.mapId}: variantId no puede estar vacío`);
    else if (variantIds.has(variant.variantId)) errors.push(`${variant.variantId}: variante duplicada`);
    variantIds.add(variant.variantId);
    const enabled = new Set(variant.enabledObjectIds ?? []);
    for (const objectId of variant.disabledObjectIds ?? []) {
      if (enabled.has(objectId)) errors.push(`${variant.variantId}: ${objectId} no puede estar habilitado y deshabilitado a la vez`);
    }
  }

  const rareEncounterIds = new Set();
  for (const encounter of adventure.rareEncounters ?? []) {
    if (!encounter.encounterId?.trim()) errors.push(`${adventure.mapId}: encounterId no puede estar vacío`);
    else if (rareEncounterIds.has(encounter.encounterId)) errors.push(`${encounter.encounterId}: encuentro raro duplicado`);
    rareEncounterIds.add(encounter.encounterId);
    if (!Number.isSafeInteger(encounter.speciesId) || encounter.speciesId <= 0) errors.push(`${encounter.encounterId}: speciesId debe ser un entero positivo`);
    if (encounter.formId !== undefined && !encounter.formId.trim()) errors.push(`${encounter.encounterId}: formId no puede estar vacío`);
    if (encounter.appearanceId !== undefined && !encounter.appearanceId.trim()) errors.push(`${encounter.encounterId}: appearanceId no puede estar vacío`);
    if (!(encounter.baseProbability > 0 && encounter.baseProbability < 1)) errors.push(`${encounter.encounterId}: baseProbability debe estar entre 0 y 1 sin incluirlos`);
    if (encounter.guaranteedEligibleVisit !== undefined && (!Number.isSafeInteger(encounter.guaranteedEligibleVisit) || encounter.guaranteedEligibleVisit < 1)) {
      errors.push(`${encounter.encounterId}: guaranteedEligibleVisit debe ser un entero positivo`);
    }
  }

  const worldEventIds = new Set();
  for (const event of adventure.worldEvents ?? []) {
    if (!event.eventId?.trim()) errors.push(`${adventure.mapId}: eventId no puede estar vacío`);
    else if (worldEventIds.has(event.eventId)) errors.push(`${event.eventId}: evento global duplicado`);
    worldEventIds.add(event.eventId);
    for (const flagId of Object.keys(event.setFlags ?? {})) {
      if (!flagId.trim()) errors.push(`${event.eventId}: flagId no puede estar vacío`);
    }
    for (const injection of event.encounterInjections ?? []) {
      if (!injection.mapId?.trim() || !injection.encounterId?.trim()) errors.push(`${event.eventId}: la inyección necesita mapId y encounterId`);
      else if (injection.mapId === adventure.mapId && !rareEncounterIds.has(injection.encounterId)) errors.push(`${event.eventId}: encuentro local inexistente ${injection.encounterId}`);
    }
    for (const target of event.mapVariants ?? []) {
      if (!target.mapId?.trim() || !target.variantId?.trim()) errors.push(`${event.eventId}: la activación de variante necesita mapId y variantId`);
      else if (target.mapId === adventure.mapId && !variantIds.has(target.variantId)) errors.push(`${event.eventId}: variante local inexistente ${target.variantId}`);
    }
  }

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
    if (!rooms.has(interaction.sectorId)) errors.push(`${interaction.interactionId}: sector inexistente ${interaction.sectorId}`);
    if (!interaction.prompt?.trim()) errors.push(`${interaction.interactionId}: prompt obligatorio`);
    if (!dialogueIds.has(interaction.dialogueId)) errors.push(`${interaction.interactionId}: diálogo inexistente ${interaction.dialogueId}`);
    if (!meaningfulInteractionKinds.has(interaction.meaningfulKind)) {
      errors.push(`${interaction.interactionId}: meaningfulKind desconocido ${interaction.meaningfulKind}`);
    }
    if (interaction.rangeTiles !== undefined && (!Number.isInteger(interaction.rangeTiles) || interaction.rangeTiles < 1)) {
      errors.push(`${interaction.interactionId}: rangeTiles debe ser un entero positivo`);
    }
    if (interaction.repeatPolicy && !ADVENTURE_ENTRY_REPEAT_POLICIES.includes(interaction.repeatPolicy)) {
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
      if (!placement || placement.sectorId !== interaction.sectorId) {
        errors.push(`${interaction.interactionId}: placement objetivo inexistente ${interaction.target.placementId}`);
      }
    } else if (interaction.target?.kind === 'anchor') {
      const anchor = roomAnchors.get(interaction.sectorId)?.get(interaction.target.anchorId);
      if (!anchor) errors.push(`${interaction.interactionId}: ancla objetivo inexistente ${interaction.target.anchorId}`);
      else {
        const allowedClasses = interaction.meaningfulKind === 'secret'
          ? ['SecretAnchor', 'InteractionAnchor']
          : ['InteractionAnchor'];
        if (!allowedClasses.includes(anchor.class)) {
          errors.push(`${interaction.interactionId}: ${interaction.target.anchorId} no es ${allowedClasses.join(' ni ')}`);
        }
      }
    } else errors.push(`${interaction.interactionId}: target desconocido`);
  }

  const researchFactIds = new Set();
  for (const fact of adventure.researchFacts ?? []) {
    if (researchFactIds.has(fact.factId)) errors.push(`${fact.factId}: hecho de investigación duplicado`);
    researchFactIds.add(fact.factId);
    if (!fact.factId?.trim() || !fact.text?.trim()) errors.push(`${fact.factId || adventure.mapId}: factId y text son obligatorios`);
    if (!Number.isInteger(fact.speciesId) || fact.speciesId <= 0) errors.push(`${fact.factId}: speciesId debe ser un entero positivo`);
    if (!['biometrics', 'behavior', 'habitat', 'exceptional'].includes(fact.field)) errors.push(`${fact.factId}: campo de investigación desconocido ${fact.field}`);
    if (!['observation', 'fieldCompletion', 'additionalNote'].includes(fact.contribution)) errors.push(`${fact.factId}: contribución desconocida ${fact.contribution}`);
    if (fact.mapId !== adventure.mapId) errors.push(`${fact.factId}: mapId no coincide con ${adventure.mapId}`);
    if (!interactionIds.has(fact.interactionId)) errors.push(`${fact.factId}: interacción inexistente ${fact.interactionId}`);
    for (const reward of fact.rewards ?? []) {
      if (['trainerExperience', 'discoveryPoints'].includes(reward.kind)
        && (!Number.isFinite(reward.amount) || reward.amount <= 0)) {
        errors.push(`${fact.factId}: recompensa ${reward.kind} debe ser positiva`);
      }
    }
  }

  const expressionTriggerIds = new Set();
  for (const trigger of adventure.expressionTriggers ?? []) {
    if (expressionTriggerIds.has(trigger.triggerId)) errors.push(`${trigger.triggerId}: trigger expresivo duplicado`);
    expressionTriggerIds.add(trigger.triggerId);
    const hasSpatialField = Boolean(trigger.sectorId || trigger.target || trigger.prompt);
    if (!hasSpatialField) continue;
    if (!trigger.sectorId || !trigger.target || !trigger.prompt?.trim()) {
      errors.push(`${trigger.triggerId}: sectorId, target y prompt deben declararse juntos`);
      continue;
    }
    if (!rooms.has(trigger.sectorId)) errors.push(`${trigger.triggerId}: sector inexistente ${trigger.sectorId}`);
    if (trigger.rangeTiles !== undefined && (!Number.isInteger(trigger.rangeTiles) || trigger.rangeTiles < 1)) {
      errors.push(`${trigger.triggerId}: rangeTiles debe ser un entero positivo`);
    }
    if (trigger.target.kind === 'placement') {
      const placement = allPlacements.get(trigger.target.placementId);
      if (!placement || placement.sectorId !== trigger.sectorId) {
        errors.push(`${trigger.triggerId}: placement objetivo inexistente ${trigger.target.placementId}`);
      }
    } else if (trigger.target.kind === 'anchor') {
      const anchor = roomAnchors.get(trigger.sectorId)?.get(trigger.target.anchorId);
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

  for (const [sectorId, occluders] of roomOccluders) {
    const roomPlacements = [...allPlacements.values()].filter(placement => placement.sectorId === sectorId);
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

  const referencedPaths = new Set();
  const sequenceIds = new Set();
  for (const sequence of adventure.ambientSequences ?? []) {
    if (sequenceIds.has(sequence.sequenceId)) errors.push(`${sequence.sequenceId}: secuencia ambiental duplicada`);
    sequenceIds.add(sequence.sequenceId);
    if (!rooms.has(sequence.sectorId)) errors.push(`${sequence.sequenceId}: sector inexistente ${sequence.sectorId}`);
    if (sequence.blockedPolicy !== 'pauseSequence') errors.push(`${sequence.sequenceId}: blockedPolicy debe ser pauseSequence`);
    if (sequence.playbackMode !== undefined && !['loop', 'pingPong', 'once'].includes(sequence.playbackMode)) {
      errors.push(`${sequence.sequenceId}: playbackMode desconocido ${sequence.playbackMode}`);
    }
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
        if (!['playAnimation', 'face', 'movePath', 'moveByTiles', 'setVisible'].includes(action.kind)) {
          errors.push(`${beat.beatId}: acción ambiental desconocida ${action.kind}`);
          continue;
        }
        if (beatPlacements.has(action.placementId)) errors.push(`${beat.beatId}: más de una acción para ${action.placementId}`);
        beatPlacements.add(action.placementId);
        const placement = allPlacements.get(action.placementId);
        if (!placement || placement.sectorId !== sequence.sectorId) {
          errors.push(`${beat.beatId}: placement inexistente ${action.placementId}`);
          continue;
        }
        if (action.kind === 'playAnimation' || ((action.kind === 'movePath' || action.kind === 'moveByTiles') && action.animation)) {
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
          const path = roomPaths.get(sequence.sectorId)?.get(action.pathId);
          if (!path) errors.push(`${beat.beatId}: ruta inexistente ${action.pathId}`);
          else referencedPaths.add(`${sequence.sectorId}:${action.pathId}`);
          if (!['grid', 'continuous'].includes(action.movementStyle)) errors.push(`${beat.beatId}: movementStyle inválido`);
          if (!(action.speedPixelsPerSecond > 0)) errors.push(`${beat.beatId}: velocidad inválida`);
          if (path && action.movementStyle === 'grid') {
            const points = path.polyline.map(point => ({ x: path.x + point.x, y: path.y + point.y }));
            const origin = points[0];
            const aligned = origin && points.every(point => (
              Number.isInteger((point.x - origin.x) / 16)
              && Number.isInteger((point.y - origin.y) / 16)
            ));
            const orthogonal = points.slice(1).every((point, index) => (
              point.x === points[index].x || point.y === points[index].y
            ));
            if (!aligned || !orthogonal) errors.push(`${beat.beatId}: ${action.pathId} debe ser ortogonal y ajustarse a 16 px`);
          }
        }
        if (action.kind === 'moveByTiles') {
          if (!Number.isInteger(action.deltaXTiles) || !Number.isInteger(action.deltaYTiles)) {
            errors.push(`${beat.beatId}: el desplazamiento relativo debe usar tiles enteros`);
          }
          if (!action.deltaXTiles && !action.deltaYTiles) errors.push(`${beat.beatId}: el desplazamiento relativo no puede ser cero`);
          if (!['grid', 'continuous'].includes(action.movementStyle)) errors.push(`${beat.beatId}: movementStyle inválido`);
          if (!(action.speedPixelsPerSecond > 0)) errors.push(`${beat.beatId}: velocidad inválida`);
        }
      }
    }
  }

  const companionSequenceIds = new Set(
    (adventure.companionSequences ?? []).map(sequence => sequence.sequenceId),
  );
  const mapSequenceIds = new Set(
    (adventure.mapSequences ?? []).map(sequence => sequence.sequenceId),
  );
  const allSequenceIds = new Set();
  const allMapSequences = [
    ...(adventure.companionSequences ?? []),
    ...(adventure.mapSequences ?? []),
  ];
  for (const sequence of allMapSequences) {
    if (allSequenceIds.has(sequence.sequenceId)) errors.push(`${sequence.sequenceId}: secuencia de mapa duplicada`);
    allSequenceIds.add(sequence.sequenceId);
    const authoredMapSequence = mapSequenceIds.has(sequence.sequenceId);
    if (!rooms.has(sequence.sectorId)) errors.push(`${sequence.sequenceId}: sector inexistente ${sequence.sectorId}`);
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
        if (!mapSequenceActionKinds.has(action.kind)) {
          errors.push(`${beat.beatId}: acción de secuencia desconocida ${action.kind}`);
          continue;
        }
        if (action.kind === 'movePath' && !authoredMapSequence) {
          errors.push(`${beat.beatId}: movePath solo se admite en secuencias de evento de mapa`);
        }
        if (actorRefs.has(action.actorRef)) errors.push(`${beat.beatId}: más de una acción para ${action.actorRef}`);
        actorRefs.add(action.actorRef);
        const dynamic = ['dynamic:companion', 'dynamic:player'].includes(action.actorRef);
        const placement = dynamic ? undefined : allPlacements.get(action.actorRef);
        if (!dynamic && (!placement || placement.sectorId !== sequence.sectorId)) {
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
          const anchor = roomAnchors.get(sequence.sectorId)?.get(action.anchorId);
          if (!anchor || anchor.class !== 'ActorAnchor') errors.push(`${beat.beatId}: ancla de movimiento inexistente ${action.anchorId}`);
        }
        if (action.kind === 'movePath') {
          const path = roomPaths.get(sequence.sectorId)?.get(action.pathId);
          if (!path) errors.push(`${beat.beatId}: ruta inexistente ${action.pathId}`);
          else referencedPaths.add(`${sequence.sectorId}:${action.pathId}`);
          if (!['grid', 'continuous'].includes(action.movementStyle)) {
            errors.push(`${beat.beatId}: movementStyle inválido`);
          }
          if (!(action.speedPixelsPerSecond > 0)) errors.push(`${beat.beatId}: velocidad inválida`);
          if (path && action.movementStyle === 'grid') {
            const points = path.polyline.map(point => ({ x: path.x + point.x, y: path.y + point.y }));
            const origin = points[0];
            const aligned = origin && points.every(point => (
              Number.isInteger((point.x - origin.x) / 16)
              && Number.isInteger((point.y - origin.y) / 16)
            ));
            const orthogonal = points.slice(1).every((point, index) => (
              point.x === points[index].x || point.y === points[index].y
            ));
            if (!aligned || !orthogonal) {
              errors.push(`${beat.beatId}: ${action.pathId} debe ser ortogonal y ajustarse a 16 px`);
            }
          }
          if (action.animation && placement) {
            const actorPlacement = (adventure.actorPlacements ?? [])
              .find(item => item.placementId === action.actorRef);
            const asset = actorPlacement ? pmdAssets.get(actorPlacement.assetId) : undefined;
            if (!asset?.animations.some(animation => animation.name === action.animation)) {
              errors.push(`${beat.beatId}: animación inexistente ${action.animation} para ${action.actorRef}`);
            }
          }
        }
        if (action.kind === 'moveByTiles' && (!Number.isInteger(action.tiles) || action.tiles < 1)) {
          errors.push(`${beat.beatId}: tiles debe ser un entero positivo`);
        }
        if (action.kind === 'dropPokeBalls' && (!Number.isInteger(action.count) || action.count < 1)) {
          errors.push(`${beat.beatId}: count debe ser un entero positivo`);
        }
        if (action.kind === 'emitCue' && !action.cueId?.trim()) {
          errors.push(`${beat.beatId}: emitCue necesita cueId`);
        }
        if (action.kind === 'returnToTrainer' && action.actorRef !== 'dynamic:companion') {
          errors.push(`${beat.beatId}: returnToTrainer solo admite dynamic:companion`);
        }
      }
    }
  }

  const referencedTriggerZones = new Map();
  const mapEventTriggerIds = new Set();
  const reservedTriggerIds = new Set([
    ...(adventure.behaviorTriggers ?? []).map(trigger => trigger.triggerId),
    ...(adventure.expressionTriggers ?? []).map(trigger => trigger.triggerId),
  ]);
  for (const trigger of adventure.mapEventTriggers ?? []) {
    if (!/^trigger:map:\d{2,}$/.test(trigger.triggerId ?? '')) {
      errors.push(`${trigger.triggerId || adventure.mapId}: triggerId debe respetar trigger:map:NN`);
    }
    if (mapEventTriggerIds.has(trigger.triggerId)) errors.push(`${trigger.triggerId}: evento de mapa duplicado`);
    if (reservedTriggerIds.has(trigger.triggerId)) errors.push(`${trigger.triggerId}: ID compartido con otro trigger`);
    mapEventTriggerIds.add(trigger.triggerId);
    if (!rooms.has(trigger.sectorId)) errors.push(`${trigger.triggerId}: sector inexistente ${trigger.sectorId}`);
    if (!mapEventActivationKinds.has(trigger.activation?.kind)) {
      errors.push(`${trigger.triggerId}: activación desconocida ${trigger.activation?.kind ?? '(vacía)'}`);
    }
    const repeatPolicy = trigger.repeatPolicy ?? 'oncePerVisit';
    if (!mapEventRepeatPolicies.has(repeatPolicy)) {
      errors.push(`${trigger.triggerId}: política de repetición desconocida ${repeatPolicy}`);
    }
    if (!mapSequenceIds.has(trigger.sequenceId)) {
      errors.push(`${trigger.triggerId}: secuencia de evento inexistente ${trigger.sequenceId}`);
    } else {
      const sequence = (adventure.mapSequences ?? []).find(item => item.sequenceId === trigger.sequenceId);
      if (sequence?.sectorId !== trigger.sectorId) {
        errors.push(`${trigger.triggerId}: la secuencia pertenece a otro sector`);
      }
      if (repeatPolicy === 'repeatable'
        && sequence?.beats.some(beat => beat.actions.some(action => action.kind === 'moveByTiles'))) {
        errors.push(`${trigger.triggerId}: un evento repetible no admite movimientos relativos`);
      }
    }

    const spatialTarget = trigger.activation?.kind === 'enterZone'
      ? { kind: 'zone', zoneId: trigger.activation.zoneId }
      : trigger.activation?.target;
    if (spatialTarget?.kind === 'zone') {
      const zone = roomTriggerZones.get(trigger.sectorId)?.get(spatialTarget.zoneId);
      if (!zone) errors.push(`${trigger.triggerId}: zona inexistente ${spatialTarget.zoneId}`);
      else {
        const referenceKey = `${trigger.sectorId}:${spatialTarget.zoneId}`;
        referencedTriggerZones.set(referenceKey, (referencedTriggerZones.get(referenceKey) ?? 0) + 1);
      }
    } else if (spatialTarget?.kind === 'placement') {
      const placement = allPlacements.get(spatialTarget.placementId);
      if (!placement || placement.sectorId !== trigger.sectorId) {
        errors.push(`${trigger.triggerId}: colocación objetivo inexistente ${spatialTarget.placementId}`);
      }
      if (trigger.activation?.kind === 'enterZone') {
        errors.push(`${trigger.triggerId}: enterZone requiere una zona`);
      }
    } else if (mapEventActivationKinds.has(trigger.activation?.kind)) {
      errors.push(`${trigger.triggerId}: objetivo espacial desconocido`);
    }
    if (trigger.activation?.kind === 'contextAction') {
      if (!trigger.activation.prompt?.trim()) errors.push(`${trigger.triggerId}: contextAction necesita prompt`);
      if (trigger.activation.rangeTiles !== undefined
        && (!Number.isFinite(trigger.activation.rangeTiles) || trigger.activation.rangeTiles <= 0)) {
        errors.push(`${trigger.triggerId}: rangeTiles debe ser positivo`);
      }
    }
    if (trigger.activation?.kind === 'proximity'
      && (!Number.isFinite(trigger.activation.rangeTiles) || trigger.activation.rangeTiles <= 0)) {
      errors.push(`${trigger.triggerId}: proximity necesita un radio positivo`);
    }
    if (!Array.isArray(trigger.resultingActorStates)) {
      errors.push(`${trigger.triggerId}: resultingActorStates debe ser una lista`);
    }
    const resultingPlacements = new Set();
    for (const state of trigger.resultingActorStates ?? []) {
      if (resultingPlacements.has(state.placementId)) {
        errors.push(`${trigger.triggerId}: estado final duplicado para ${state.placementId}`);
      }
      resultingPlacements.add(state.placementId);
      const placement = allPlacements.get(state.placementId);
      if (!placement || placement.sectorId !== trigger.sectorId) {
        errors.push(`${trigger.triggerId}: actor final inexistente ${state.placementId}`);
        continue;
      }
      if (state.position?.kind === 'anchor') {
        if (!roomAnchors.get(trigger.sectorId)?.has(state.position.anchorId)) {
          errors.push(`${trigger.triggerId}: ancla final inexistente ${state.position.anchorId}`);
        }
      } else if (state.position?.kind === 'pathEnd') {
        if (!roomPaths.get(trigger.sectorId)?.has(state.position.pathId)) {
          errors.push(`${trigger.triggerId}: ruta final inexistente ${state.position.pathId}`);
        }
      } else if (state.position !== undefined) {
        errors.push(`${trigger.triggerId}: posición final desconocida`);
      }
      if (state.animation) {
        const actorPlacement = (adventure.actorPlacements ?? [])
          .find(item => item.placementId === state.placementId);
        const asset = actorPlacement ? pmdAssets.get(actorPlacement.assetId) : undefined;
        if (!asset?.animations.some(animation => animation.name === state.animation)) {
          errors.push(`${trigger.triggerId}: animación final inexistente ${state.animation}`);
        }
      }
      if (state.visible !== undefined && typeof state.visible !== 'boolean') {
        errors.push(`${trigger.triggerId}: visible final debe ser booleano`);
      }
      if (repeatPolicy === 'repeatable') {
        const movesActor = state.position !== undefined;
        const changesAnimation = state.animation !== undefined && state.animation !== placement.animation;
        const changesDirection = state.direction !== undefined && state.direction !== placement.direction;
        const changesVisibility = state.visible !== undefined
          && state.visible !== !placement.initiallyHidden;
        if (movesActor || changesAnimation || changesDirection || changesVisibility) {
          errors.push(`${trigger.triggerId}: el estado final repetible no coincide con el estado inicial de ${state.placementId}`);
        }
      }
    }
  }
  for (const [sectorId, zones] of roomTriggerZones) {
    for (const zoneId of zones.keys()) {
      const references = referencedTriggerZones.get(`${sectorId}:${zoneId}`) ?? 0;
      if (references === 0) errors.push(`${zoneId}: zona de trigger huérfana`);
      if (references > 1) errors.push(`${zoneId}: zona compartida por varios eventos`);
    }
  }
  for (const [sectorId, paths] of roomPaths) {
    for (const pathId of paths.keys()) {
      if (!referencedPaths.has(`${sectorId}:${pathId}`)) errors.push(`${pathId}: ruta ambiental huérfana`);
    }
  }

  const behaviorTriggerIds = new Set();
  for (const trigger of adventure.behaviorTriggers ?? []) {
    if (behaviorTriggerIds.has(trigger.triggerId)) errors.push(`${trigger.triggerId}: comportamiento duplicado`);
    behaviorTriggerIds.add(trigger.triggerId);
    if (!allSequenceIds.has(trigger.sequenceId)) errors.push(`${trigger.triggerId}: secuencia inexistente ${trigger.sequenceId}`);
    if ((trigger.rewards?.length || trigger.rewardPackageId) && !trigger.rewardOriginId) {
      errors.push(`${trigger.triggerId}: una recompensa necesita rewardOriginId`);
    }
    if (trigger.proximity) {
      if (!rooms.has(trigger.proximity.sectorId)) errors.push(`${trigger.triggerId}: sector de proximidad inexistente`);
      if (trigger.proximity.rangeTiles !== undefined
        && (!Number.isInteger(trigger.proximity.rangeTiles) || trigger.proximity.rangeTiles < 1)) {
        errors.push(`${trigger.triggerId}: rangeTiles debe ser un entero positivo`);
      }
      if (trigger.proximity.failureSequenceId && !allSequenceIds.has(trigger.proximity.failureSequenceId)) {
        errors.push(`${trigger.triggerId}: secuencia de fallo inexistente ${trigger.proximity.failureSequenceId}`);
      }
      if (trigger.proximity.target?.kind === 'placement') {
        const placement = allPlacements.get(trigger.proximity.target.placementId);
        if (!placement || placement.sectorId !== trigger.proximity.sectorId) {
          errors.push(`${trigger.triggerId}: placement de proximidad inexistente ${trigger.proximity.target.placementId}`);
        }
      } else if (trigger.proximity.target?.kind === 'anchor') {
        if (!roomAnchors.get(trigger.proximity.sectorId)?.has(trigger.proximity.target.anchorId)) {
          errors.push(`${trigger.triggerId}: ancla de proximidad inexistente ${trigger.proximity.target.anchorId}`);
        }
      } else errors.push(`${trigger.triggerId}: target de proximidad desconocido`);
    }
  }

  for (const transition of adventure.transitions ?? []) {
    const from = roomAnchors.get(transition.fromSectorId)?.get(transition.fromAnchorId);
    const to = roomAnchors.get(transition.toSectorId)?.get(transition.toAnchorId);
    if (!from) errors.push(`${transition.transitionId}: ancla Tiled de origen inexistente`);
    else if (from.class !== 'TransitionAnchor') errors.push(`${transition.transitionId}: el origen no es TransitionAnchor`);
    if (!to) errors.push(`${transition.transitionId}: ancla Tiled de destino inexistente`);
    else if (to.class !== 'TransitionAnchor') errors.push(`${transition.transitionId}: el destino no es TransitionAnchor`);
  }
  const entryPoints = new Map();
  for (const entry of adventure.entryPoints ?? []) {
    if (!entry.entryPointId?.trim()) {
      errors.push(`${adventure.mapId}: punto de entrada sin ID`);
      continue;
    }
    if (entryPoints.has(entry.entryPointId)) errors.push(`${entry.entryPointId}: punto de entrada duplicado`);
    entryPoints.set(entry.entryPointId, entry);
    if (!entry.label?.trim()) errors.push(`${entry.entryPointId}: nombre visible vacío`);
    const anchor = roomAnchors.get(entry.sectorId)?.get(entry.anchorId);
    if (!anchor) errors.push(`${entry.entryPointId}: ancla de entrada inexistente`);
    else if (anchor.class !== 'PlayerSpawn') errors.push(`${entry.entryPointId}: la entrada necesita PlayerSpawn`);
  }
  const missionEntries = new Set();
  for (const assignment of adventure.missionEntryPoints ?? []) {
    if (missionEntries.has(assignment.missionId)) errors.push(`${assignment.missionId}: entrada de misión duplicada`);
    missionEntries.add(assignment.missionId);
    if (!(adventure.missionIds ?? []).includes(assignment.missionId)) {
      errors.push(`${assignment.missionId}: la misión no pertenece al mapa`);
    }
    if (!entryPoints.has(assignment.entryPointId)) {
      errors.push(`${assignment.missionId}: punto de entrada inexistente ${assignment.entryPointId}`);
    }
  }
  if (adventure.freeExpeditionEntryPointId
    && !entryPoints.has(adventure.freeExpeditionEntryPointId)) {
    errors.push(`${adventure.mapId}: entrada libre inexistente ${adventure.freeExpeditionEntryPointId}`);
  }
  return errors;
}
