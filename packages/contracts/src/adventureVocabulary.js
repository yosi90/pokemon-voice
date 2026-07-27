export const TILE_LAYER_KINDS = Object.freeze(['ground', 'decoration', 'overlay', 'collision']);
export const MISSION_STATUSES = Object.freeze(['locked', 'available', 'active', 'completed']);
export const COMPANION_TRIGGER_MODES = Object.freeze(['prompt', 'automatic', 'ambient']);
export const COMPANION_TRIGGER_REPEAT_POLICIES = Object.freeze(['oncePerVisit', 'persistent', 'repeatable']);
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
