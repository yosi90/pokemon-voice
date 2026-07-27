import {
  AMBIENT_ACTOR_ACTION_KINDS,
  COMPANION_SEQUENCE_ACTION_KINDS,
  MEANINGFUL_EXPEDITION_INTERACTION_KINDS,
  SECTOR_TRANSITION_KINDS,
  TILED_ANCHOR_CLASSES,
  type AdventureMapV3,
  type AmbientActorActionKind,
  type CompanionSequenceActionKind,
  type MeaningfulExpeditionInteractionKind,
  type SectorTransitionKind,
  type TiledAnchorClass,
} from '../../../packages/contracts/src/index.js';
import {
  synchronizeAdventureRequiredAssetIds,
  validateAdventureSectorRoster,
} from '../expeditions/adventureMapV3.js';
import { addPokeDiscoverFunctionalAnchor } from './pokeDiscoverEditorGeometry.js';
import type { PokeDiscoverEditableTiledMap } from './pokeDiscoverEditorProject.js';

export type PokeDiscoverAuthoringRecipeId =
  | 'pokemon-placement'
  | 'pokemon-encounter'
  | 'npc-placement'
  | 'entry-point'
  | 'transition'
  | 'interaction'
  | 'secret'
  | 'ambient-path'
  | 'sequence-destination'
  | 'occluder'
  | 'collision';

export type PokeDiscoverAuthoringInspector =
  | 'placement'
  | 'entry'
  | 'transition'
  | 'interaction'
  | 'sequence'
  | 'geometry';

export interface PokeDiscoverAuthoringRecipe {
  recipeId: PokeDiscoverAuthoringRecipeId;
  label: string;
  description: string;
  fields: readonly string[];
  tiledClass: TiledAnchorClass | 'AmbientPath' | 'ActorOccluder' | 'Collision';
  inspector: PokeDiscoverAuthoringInspector;
  prerequisite: string;
  creationMode: 'wizard' | 'connection-command' | 'geometry-command' | 'referenced-command';
  outputs: readonly ('sidecar' | 'tmj')[];
  defaults: Readonly<Record<string, unknown>>;
  validator: 'maps:validate';
}

export const POKEDISCOVER_AUTHORING_RECIPES = Object.freeze([
  {
    recipeId: 'pokemon-placement',
    label: 'Colocación Pokémon',
    description: 'Crea una colocación y su ActorAnchor.',
    fields: ['pokemonAssetId', 'animation'],
    tiledClass: 'ActorAnchor',
    inspector: 'placement',
    prerequisite: 'El Pokémon debe pertenecer al reparto del sector.',
    creationMode: 'wizard',
    outputs: ['sidecar', 'tmj'],
    defaults: { animation: 'Idle', direction: 'down' },
    validator: 'maps:validate',
  },
  {
    recipeId: 'pokemon-encounter',
    label: 'Encuentro Pokémon',
    description: 'Crea una colocación de encuentro y su EncounterAnchor.',
    fields: ['pokemonAssetId', 'animation'],
    tiledClass: 'EncounterAnchor',
    inspector: 'placement',
    prerequisite: 'El Pokémon debe pertenecer al reparto del sector.',
    creationMode: 'wizard',
    outputs: ['sidecar', 'tmj'],
    defaults: { animation: 'Idle', direction: 'down' },
    validator: 'maps:validate',
  },
  {
    recipeId: 'npc-placement',
    label: 'Colocación NPC',
    description: 'Crea una colocación de personaje y su ActorAnchor.',
    fields: ['npcAssetId'],
    tiledClass: 'ActorAnchor',
    inspector: 'placement',
    prerequisite: 'El NPC debe pertenecer al reparto del sector.',
    creationMode: 'wizard',
    outputs: ['sidecar', 'tmj'],
    defaults: { direction: 'down' },
    validator: 'maps:validate',
  },
  {
    recipeId: 'entry-point',
    label: 'Entrada',
    description: 'Crea una entrada sidecar y su PlayerSpawn.',
    fields: ['label'],
    tiledClass: 'PlayerSpawn',
    inspector: 'entry',
    prerequisite: 'El sector debe tener un reparto válido.',
    creationMode: 'wizard',
    outputs: ['sidecar', 'tmj'],
    defaults: { label: 'Entrada' },
    validator: 'maps:validate',
  },
  {
    recipeId: 'transition',
    label: 'Transición',
    description: 'Crea ambos extremos TMJ y las transiciones sidecar.',
    fields: ['targetSectorId', 'kind'],
    tiledClass: 'TransitionAnchor',
    inspector: 'transition',
    prerequisite: 'Debe existir un sector contiguo compatible.',
    creationMode: 'connection-command',
    outputs: ['sidecar', 'tmj'],
    defaults: { kind: 'edge' },
    validator: 'maps:validate',
  },
  {
    recipeId: 'interaction',
    label: 'Interacción',
    description: 'Crea interacción, diálogo y su InteractionAnchor.',
    fields: ['meaningfulKind', 'prompt', 'text'],
    tiledClass: 'InteractionAnchor',
    inspector: 'interaction',
    prerequisite: 'La acción debe ser un meaningfulKind del runtime.',
    creationMode: 'wizard',
    outputs: ['sidecar', 'tmj'],
    defaults: { repeatPolicy: 'oncePerVisit' },
    validator: 'maps:validate',
  },
  {
    recipeId: 'secret',
    label: 'Secreto',
    description: 'Crea interacción secreta, diálogo y su SecretAnchor.',
    fields: ['prompt', 'text'],
    tiledClass: 'SecretAnchor',
    inspector: 'interaction',
    prerequisite: 'El sector debe tener un reparto válido.',
    creationMode: 'wizard',
    outputs: ['sidecar', 'tmj'],
    defaults: { meaningfulKind: 'secret', repeatPolicy: 'oncePerVisit' },
    validator: 'maps:validate',
  },
  {
    recipeId: 'ambient-path',
    label: 'Ruta ambiental',
    description: 'Crea una ruta ligada a una acción movePath existente.',
    fields: ['sequenceId', 'beatId', 'actionIndex'],
    tiledClass: 'AmbientPath',
    inspector: 'sequence',
    prerequisite: 'Debe seleccionarse una acción movePath que utilizará la ruta.',
    creationMode: 'referenced-command',
    outputs: ['sidecar', 'tmj'],
    defaults: {},
    validator: 'maps:validate',
  },
  {
    recipeId: 'sequence-destination',
    label: 'Destino de secuencia',
    description: 'Crea un ActorAnchor ligado a una acción moveToAnchor.',
    fields: ['sequenceId', 'beatId', 'actionIndex'],
    tiledClass: 'ActorAnchor',
    inspector: 'sequence',
    prerequisite: 'Debe seleccionarse una acción moveToAnchor que utilizará el destino.',
    creationMode: 'referenced-command',
    outputs: ['sidecar', 'tmj'],
    defaults: {},
    validator: 'maps:validate',
  },
  {
    recipeId: 'occluder',
    label: 'Oclusión',
    description: 'Crea una máscara ligada a un grupo y colocaciones existentes.',
    fields: ['occlusionGroupId', 'placementIds'],
    tiledClass: 'ActorOccluder',
    inspector: 'geometry',
    prerequisite: 'Necesita un grupo y al menos una colocación asociada.',
    creationMode: 'referenced-command',
    outputs: ['sidecar', 'tmj'],
    defaults: {},
    validator: 'maps:validate',
  },
  {
    recipeId: 'collision',
    label: 'Colisión',
    description: 'Crea geometría Collision con ID técnico ordinal.',
    fields: ['geometry'],
    tiledClass: 'Collision',
    inspector: 'geometry',
    prerequisite: 'La geometría debe ser un rectángulo o polígono válido.',
    creationMode: 'geometry-command',
    outputs: ['tmj'],
    defaults: { class: 'Collision' },
    validator: 'maps:validate',
  },
] as const satisfies readonly PokeDiscoverAuthoringRecipe[]);

const anchorAuthoringDecisions = {
  PlayerSpawn: 'entry-point',
  TransitionAnchor: 'transition',
  ActorAnchor: 'pokemon-placement',
  EncounterAnchor: 'pokemon-encounter',
  InteractionAnchor: 'interaction',
  SecretAnchor: 'secret',
} as const satisfies Record<typeof TILED_ANCHOR_CLASSES[number], PokeDiscoverAuthoringRecipeId>;

const transitionAuthoringDecisions = Object.fromEntries(
  SECTOR_TRANSITION_KINDS.map(kind => [kind, 'transition']),
) as Record<SectorTransitionKind, 'transition'>;

export const POKEDISCOVER_RUNTIME_AUTHORING_COVERAGE = Object.freeze({
  anchors: anchorAuthoringDecisions,
  transitions: transitionAuthoringDecisions,
  meaningfulInteractions: Object.fromEntries(
    MEANINGFUL_EXPEDITION_INTERACTION_KINDS.map(kind => [
      kind,
      kind === 'secret' ? 'secret' : 'interaction',
    ]),
  ) as Record<MeaningfulExpeditionInteractionKind, 'interaction' | 'secret'>,
  ambientActions: Object.fromEntries(AMBIENT_ACTOR_ACTION_KINDS.map(kind => [
    kind,
    kind === 'movePath' ? 'ambient-path' : 'properties-only',
  ])) as Record<AmbientActorActionKind, 'ambient-path' | 'properties-only'>,
  companionActions: Object.fromEntries(COMPANION_SEQUENCE_ACTION_KINDS.map(kind => [
    kind,
    kind === 'moveToAnchor' ? 'sequence-destination' : 'properties-only',
  ])) as Record<
    CompanionSequenceActionKind,
    'sequence-destination' | 'properties-only'
  >,
});

function allTechnicalIds(adventure: AdventureMapV3, tilemap: PokeDiscoverEditableTiledMap) {
  return new Set([
    ...adventure.actorPlacements.map(value => value.placementId),
    ...adventure.characterPlacements.map(value => value.placementId),
    ...(adventure.entryPoints ?? []).map(value => value.entryPointId),
    ...(adventure.interactions ?? []).map(value => value.interactionId),
    ...(adventure.dialogues ?? []).map(value => value.dialogueId),
    ...tilemap.layers.flatMap(layer => Array.isArray(layer.objects)
      ? layer.objects.map(object => String(object.name ?? '')).filter(Boolean)
      : []),
  ]);
}

export function previewPokeDiscoverImmediateRecipeIds(
  adventure: AdventureMapV3,
  tilemap: PokeDiscoverEditableTiledMap,
  recipeId: PokeDiscoverImmediateRecipeRequest['recipeId'],
) {
  const usedIds = allTechnicalIds(adventure, tilemap);
  if (recipeId === 'pokemon-placement') {
    const primaryId = nextPokeDiscoverAuthoringId('placement:pokemon', usedIds);
    return { primaryId, anchorId: primaryId };
  }
  if (recipeId === 'pokemon-encounter') {
    const primaryId = nextPokeDiscoverAuthoringId('placement:encounter', usedIds);
    return { primaryId, anchorId: primaryId };
  }
  if (recipeId === 'npc-placement') {
    const primaryId = nextPokeDiscoverAuthoringId('placement:npc', usedIds);
    return { primaryId, anchorId: primaryId };
  }
  if (recipeId === 'entry-point') {
    const primaryId = nextPokeDiscoverAuthoringId('entry', usedIds);
    return { primaryId, anchorId: primaryId };
  }
  const primaryId = nextPokeDiscoverAuthoringId(
    recipeId === 'secret' ? 'interaction:secret' : 'interaction',
    usedIds,
  );
  usedIds.add(primaryId);
  return {
    primaryId,
    anchorId: primaryId,
    dialogueId: nextPokeDiscoverAuthoringId('dialogue', usedIds),
  };
}

export function nextPokeDiscoverAuthoringId(
  prefix: string,
  usedIds: ReadonlySet<string>,
) {
  if (!/^[a-z0-9]+(?::[a-z0-9][a-z0-9-]*)*$/u.test(prefix)) {
    throw new Error(`Prefijo de ID no válido: ${prefix}.`);
  }
  for (let ordinal = 1; ordinal <= 9999; ordinal += 1) {
    const candidate = `${prefix}:${String(ordinal).padStart(2, '0')}`;
    if (!usedIds.has(candidate)) return candidate;
  }
  throw new Error(`No quedan ordinales disponibles para ${prefix}.`);
}

export type PokeDiscoverImmediateRecipeRequest =
  | {
    recipeId: 'pokemon-placement';
    assetId: string;
    animation: string;
    x: number;
    y: number;
  }
  | {
    recipeId: 'pokemon-encounter';
    assetId: string;
    animation: string;
    x: number;
    y: number;
  }
  | {
    recipeId: 'npc-placement';
    assetId: string;
    x: number;
    y: number;
  }
  | {
    recipeId: 'entry-point';
    label: string;
    x: number;
    y: number;
  }
  | {
    recipeId: 'interaction';
    meaningfulKind: MeaningfulExpeditionInteractionKind;
    prompt: string;
    text: string;
    x: number;
    y: number;
  }
  | {
    recipeId: 'secret';
    meaningfulKind: MeaningfulExpeditionInteractionKind;
    prompt: string;
    text: string;
    x: number;
    y: number;
  };

export interface PokeDiscoverAuthoringTransaction {
  adventure: AdventureMapV3;
  tilemap: PokeDiscoverEditableTiledMap;
  primaryId: string;
  objectId: number;
  inspector: PokeDiscoverAuthoringInspector;
}

export function applyPokeDiscoverImmediateRecipe({
  adventure,
  tilemap,
  sectorId,
  request,
}: {
  adventure: AdventureMapV3;
  tilemap: PokeDiscoverEditableTiledMap;
  sectorId: string;
  request: PokeDiscoverImmediateRecipeRequest;
}): PokeDiscoverAuthoringTransaction {
  const sector = adventure.sectors.find(candidate => candidate.sectorId === sectorId);
  if (!sector) throw new Error(`No existe el sector ${sectorId}.`);
  const rosterErrors = validateAdventureSectorRoster(sector);
  if (rosterErrors.length) throw new Error(rosterErrors[0]);
  const usedIds = allTechnicalIds(adventure, tilemap);

  if (request.recipeId === 'pokemon-placement' || request.recipeId === 'pokemon-encounter') {
    if (!sector.roster.pokemonAssetIds.includes(request.assetId)) {
      throw new Error(`${request.assetId} no pertenece al reparto Pokémon de ${sectorId}.`);
    }
    const placementId = nextPokeDiscoverAuthoringId(
      request.recipeId === 'pokemon-encounter' ? 'placement:encounter' : 'placement:pokemon',
      usedIds,
    );
    const anchor = addPokeDiscoverFunctionalAnchor(tilemap, {
      name: placementId,
      kind: request.recipeId === 'pokemon-encounter' ? 'EncounterAnchor' : 'ActorAnchor',
      x: request.x,
      y: request.y,
    });
    return {
      adventure: synchronizeAdventureRequiredAssetIds({
        ...adventure,
        actorPlacements: [...adventure.actorPlacements, {
          schemaVersion: 1,
          placementId,
          sectorId,
          anchorId: placementId,
          assetId: request.assetId,
          animation: request.animation,
          direction: 'down',
        }],
      }),
      tilemap: anchor.tilemap,
      primaryId: placementId,
      objectId: anchor.object.id,
      inspector: 'placement',
    };
  }

  if (request.recipeId === 'npc-placement') {
    if (!sector.roster.npcAssetIds.includes(request.assetId)) {
      throw new Error(`${request.assetId} no pertenece al reparto NPC de ${sectorId}.`);
    }
    const placementId = nextPokeDiscoverAuthoringId('placement:npc', usedIds);
    const anchor = addPokeDiscoverFunctionalAnchor(tilemap, {
      name: placementId,
      kind: 'ActorAnchor',
      x: request.x,
      y: request.y,
    });
    return {
      adventure: synchronizeAdventureRequiredAssetIds({
        ...adventure,
        characterPlacements: [...adventure.characterPlacements, {
          schemaVersion: 1,
          placementId,
          sectorId,
          anchorId: placementId,
          assetId: request.assetId,
          direction: 'down',
        }],
      }),
      tilemap: anchor.tilemap,
      primaryId: placementId,
      objectId: anchor.object.id,
      inspector: 'placement',
    };
  }

  if (request.recipeId === 'entry-point') {
    const entryPointId = nextPokeDiscoverAuthoringId('entry', usedIds);
    const anchor = addPokeDiscoverFunctionalAnchor(tilemap, {
      name: entryPointId,
      kind: 'PlayerSpawn',
      x: request.x,
      y: request.y,
    });
    return {
      adventure: {
        ...adventure,
        entryPoints: [...(adventure.entryPoints ?? []), {
          schemaVersion: 1,
          entryPointId,
          label: request.label.trim() || `Entrada ${entryPointId.split(':').at(-1)}`,
          sectorId,
          anchorId: entryPointId,
        }],
        sectors: adventure.sectors.map(candidate => candidate.sectorId === sectorId
          ? { ...candidate, spawnAnchorIds: [...new Set([...candidate.spawnAnchorIds, entryPointId])] }
          : candidate),
      },
      tilemap: anchor.tilemap,
      primaryId: entryPointId,
      objectId: anchor.object.id,
      inspector: 'entry',
    };
  }

  const isSecret = request.recipeId === 'secret';
  const meaningfulKind = isSecret ? 'secret' : request.meaningfulKind;
  if (!MEANINGFUL_EXPEDITION_INTERACTION_KINDS.includes(meaningfulKind)) {
    throw new Error(`El sidecar no comprende la interacción ${meaningfulKind}.`);
  }
  const interactionId = nextPokeDiscoverAuthoringId(
    isSecret ? 'interaction:secret' : 'interaction',
    usedIds,
  );
  usedIds.add(interactionId);
  const dialogueId = nextPokeDiscoverAuthoringId('dialogue', usedIds);
  const pageId = `${dialogueId}:page:01`;
  const anchor = addPokeDiscoverFunctionalAnchor(tilemap, {
    name: interactionId,
    kind: isSecret ? 'SecretAnchor' : 'InteractionAnchor',
    x: request.x,
    y: request.y,
  });
  return {
    adventure: {
      ...adventure,
      interactions: [...(adventure.interactions ?? []), {
        schemaVersion: 1,
        interactionId,
        sectorId,
        target: { kind: 'anchor', anchorId: interactionId },
        prompt: request.prompt.trim(),
        dialogueId,
        meaningfulKind,
        repeatPolicy: 'oncePerVisit',
      }],
      dialogues: [...(adventure.dialogues ?? []), {
        schemaVersion: 1,
        dialogueId,
        initialPageId: pageId,
        pages: [{
          schemaVersion: 1,
          pageId,
          speakerName: 'PokeDiscover',
          text: request.text.trim(),
        }],
      }],
    },
    tilemap: anchor.tilemap,
    primaryId: interactionId,
    objectId: anchor.object.id,
    inspector: 'interaction',
  };
}
