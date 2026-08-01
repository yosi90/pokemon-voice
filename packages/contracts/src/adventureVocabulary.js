export const TILE_LAYER_KINDS = Object.freeze(['ground', 'decoration', 'overlay', 'collision']);
export const MISSION_STATUSES = Object.freeze(['locked', 'available', 'active', 'completed']);
export const COMPANION_TRIGGER_MODES = Object.freeze(['prompt', 'automatic', 'ambient']);
export const COMPANION_TRIGGER_REPEAT_POLICIES = Object.freeze(['oncePerVisit', 'persistent', 'repeatable']);
export const MAP_EVENT_ACTIVATION_KINDS = Object.freeze([
  'enterZone',
  'contextAction',
  'proximity',
  'interval',
  'pathCrossing',
  'actorContact',
  'enterSurface',
]);
export const MAP_EVENT_REPEAT_POLICIES = Object.freeze([
  'oncePerSectorVisit',
  'oncePerVisit',
  'repeatable',
  'persistent',
]);
export const EXPRESSION_INPUT_METHODS = Object.freeze(['voice', 'text', 'contextAction']);
export const EXPRESSION_INTENTS = Object.freeze(['compliment', 'calm', 'warn', 'sing', 'custom']);
export const ADVENTURE_ACTOR_COLLISIONS = Object.freeze(['solid', 'pass-through']);
export const AMBIENT_MOVEMENT_STYLES = Object.freeze(['grid', 'continuous']);
export const AMBIENT_PLAYBACK_MODES = Object.freeze(['loop', 'pingPong', 'once']);
export const AMBIENT_ACTOR_ACTION_KINDS = Object.freeze([
  'playAnimation', 'face', 'movePath', 'moveByTiles', 'setVisible',
]);
export const COMPANION_SEQUENCE_ACTION_KINDS = Object.freeze([
  'playAnimation', 'face', 'setVisible', 'moveToAnchor', 'moveByTiles',
  'returnToTrainer', 'dropPokeBalls', 'emitCue',
]);
export const MAP_SEQUENCE_ACTION_KINDS = Object.freeze([
  'playAnimation', 'face', 'setVisible', 'moveToAnchor', 'moveByTiles',
  'returnToTrainer', 'dropPokeBalls', 'emitCue', 'movePath',
  'spawnProjectile', 'charge', 'push', 'playAudio', 'stopAudio',
  'setPlayerAppearance', 'restorePlayerAppearance', 'moveToLocation',
  'applyHazardConsequence', 'openNarrative', 'emitMissionOutcome',
]);
export const TERRAIN_SURFACE_TYPES = Object.freeze([
  'ground', 'water', 'void', 'fall', 'ice', 'slow',
]);
export const ADVENTURE_LOCATION_KINDS = Object.freeze([
  'area', 'entrance', 'rest', 'recovery',
]);
export const COMPANION_WATER_TRAVERSAL_KINDS = Object.freeze([
  'swim', 'fly', 'alternateAsset', 'recall',
]);
export const HAZARD_OUTCOMES = Object.freeze([
  'recover', 'resetSector', 'failMission',
]);
export const HAZARD_ROLLBACK_POLICIES = Object.freeze([
  'preserveGains', 'restoreSnapshot',
]);
export const EXPRESSION_MATCHER_KINDS = Object.freeze(['phrase', 'intent', 'acoustic']);
export const SECTOR_TRANSITION_KINDS = Object.freeze(['edge', 'stairs', 'door', 'teleport']);
/** @deprecated Use SECTOR_TRANSITION_KINDS. */
export const ROOM_TRANSITION_KINDS = SECTOR_TRANSITION_KINDS;
export const ADVENTURE_ENTRY_REPEAT_POLICIES = Object.freeze(['oncePerVisit', 'repeatable']);
export const TILED_ANCHOR_CLASSES = Object.freeze([
  'PlayerSpawn',
  'TransitionAnchor',
  'ActorAnchor',
  'EncounterAnchor',
  'InteractionAnchor',
  'SecretAnchor',
]);
export const TILED_RUNTIME_OBJECT_CLASSES = Object.freeze([
  ...TILED_ANCHOR_CLASSES,
  'Collision',
  'AmbientPath',
  'ActorOccluder',
  'TriggerZone',
  'TerrainArea',
  'LocationPoint',
  'LocationArea',
  'RoamArea',
]);
export const MEANINGFUL_EXPEDITION_INTERACTION_KINDS = Object.freeze([
  'npcConversation',
  'inspection',
  'pokemonInteraction',
  'speciesIdentification',
  'companionBehavior',
  'contextTrigger',
  'secret',
  'hint',
  'collectible',
  'research',
]);
