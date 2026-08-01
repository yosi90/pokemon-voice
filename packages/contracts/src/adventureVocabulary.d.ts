export const TILE_LAYER_KINDS: readonly ['ground', 'decoration', 'overlay', 'collision'];
export const MISSION_STATUSES: readonly ['locked', 'available', 'active', 'completed'];
export const COMPANION_TRIGGER_MODES: readonly ['prompt', 'automatic', 'ambient'];
export const COMPANION_TRIGGER_REPEAT_POLICIES: readonly ['oncePerVisit', 'persistent', 'repeatable'];
export const MAP_EVENT_ACTIVATION_KINDS: readonly [
  'enterZone',
  'contextAction',
  'proximity',
  'interval',
  'pathCrossing',
  'actorContact',
  'enterSurface',
];
export const MAP_EVENT_REPEAT_POLICIES: readonly [
  'oncePerSectorVisit',
  'oncePerVisit',
  'repeatable',
  'persistent',
];
export const EXPRESSION_INPUT_METHODS: readonly ['voice', 'text', 'contextAction'];
export const EXPRESSION_INTENTS: readonly ['compliment', 'calm', 'warn', 'sing', 'custom'];
export const ADVENTURE_ACTOR_COLLISIONS: readonly ['solid', 'pass-through'];
export const AMBIENT_MOVEMENT_STYLES: readonly ['grid', 'continuous'];
export const AMBIENT_PLAYBACK_MODES: readonly ['loop', 'pingPong', 'once'];
export const AMBIENT_ACTOR_ACTION_KINDS: readonly [
  'playAnimation', 'face', 'movePath', 'moveByTiles', 'setVisible',
];
export const COMPANION_SEQUENCE_ACTION_KINDS: readonly [
  'playAnimation', 'face', 'setVisible', 'moveToAnchor', 'moveByTiles',
  'returnToTrainer', 'dropPokeBalls', 'emitCue',
];
export const MAP_SEQUENCE_ACTION_KINDS: readonly [
  'playAnimation', 'face', 'setVisible', 'moveToAnchor', 'moveByTiles',
  'returnToTrainer', 'dropPokeBalls', 'emitCue', 'movePath',
  'spawnProjectile', 'charge', 'push', 'playAudio', 'stopAudio',
  'setPlayerAppearance', 'restorePlayerAppearance', 'moveToLocation',
  'applyHazardConsequence', 'openNarrative', 'emitMissionOutcome',
];
export const TERRAIN_SURFACE_TYPES: readonly [
  'ground', 'water', 'void', 'fall', 'ice', 'slow',
];
export const ADVENTURE_LOCATION_KINDS: readonly [
  'area', 'entrance', 'rest', 'recovery',
];
export const COMPANION_WATER_TRAVERSAL_KINDS: readonly [
  'swim', 'fly', 'alternateAsset', 'recall',
];
export const HAZARD_OUTCOMES: readonly [
  'recover', 'resetSector', 'failMission',
];
export const HAZARD_ROLLBACK_POLICIES: readonly [
  'preserveGains', 'restoreSnapshot',
];
export const EXPRESSION_MATCHER_KINDS: readonly ['phrase', 'intent', 'acoustic'];
export const SECTOR_TRANSITION_KINDS: readonly ['edge', 'stairs', 'door', 'teleport'];
/** @deprecated Use SECTOR_TRANSITION_KINDS. */
export const ROOM_TRANSITION_KINDS: typeof SECTOR_TRANSITION_KINDS;
export const ADVENTURE_ENTRY_REPEAT_POLICIES: readonly ['oncePerVisit', 'repeatable'];
export const TILED_ANCHOR_CLASSES: readonly [
  'PlayerSpawn',
  'TransitionAnchor',
  'ActorAnchor',
  'EncounterAnchor',
  'InteractionAnchor',
  'SecretAnchor',
];
export const TILED_RUNTIME_OBJECT_CLASSES: readonly [
  'PlayerSpawn',
  'TransitionAnchor',
  'ActorAnchor',
  'EncounterAnchor',
  'InteractionAnchor',
  'SecretAnchor',
  'Collision',
  'AmbientPath',
  'ActorOccluder',
  'TriggerZone',
  'TerrainArea',
  'LocationPoint',
  'LocationArea',
  'RoamArea',
];
export const MEANINGFUL_EXPEDITION_INTERACTION_KINDS: readonly [
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
];
