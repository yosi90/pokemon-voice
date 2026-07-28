import type { AdventureMapV3 } from '../../../packages/contracts/src/index.js';
import { synchronizeAdventureRequiredAssetIds } from '../expeditions/adventureMapV3.js';
import {
  nextPokeDiscoverAuthoringId,
  pokeDiscoverPokemonPlacementPrefix,
} from './pokeDiscoverEditorAuthoringRegistry.js';
import type { PokeDiscoverAuthoringIssue } from './pokeDiscoverEditorAuthoringAudit.js';
import type {
  PokeDiscoverEditableTiledMap,
  PokeDiscoverTiledObject,
} from './pokeDiscoverEditorProject.js';
import type { PokeDiscoverWorkspaceSnapshot } from './pokeDiscoverEditorWorkspace.js';

function allKnownIds(adventure: AdventureMapV3, tilemap: PokeDiscoverEditableTiledMap) {
  return new Set([
    ...adventure.actorPlacements.map(value => value.placementId),
    ...adventure.characterPlacements.map(value => value.placementId),
    ...(adventure.entryPoints ?? []).map(value => value.entryPointId),
    ...(adventure.interactions ?? []).map(value => value.interactionId),
    ...tilemap.layers.flatMap(layer => Array.isArray(layer.objects)
      ? layer.objects.map(object => String(object.name ?? '')).filter(Boolean)
      : []),
  ]);
}

export function prepareOrphanPokemonAnchorRepair({
  snapshot,
  issue,
  assetId,
  animation,
}: {
  snapshot: PokeDiscoverWorkspaceSnapshot;
  issue: PokeDiscoverAuthoringIssue;
  assetId: string;
  animation: string;
}) {
  if (issue.kind !== 'orphan' || issue.objectId === undefined || !issue.currentName) {
    throw new Error('La incidencia no es un ancla huérfana adaptable.');
  }
  const sector = snapshot.adventure.sectors.find(value => value.sectorId === issue.sectorId);
  if (!sector) throw new Error(`No existe ${issue.sectorId}.`);
  const tilemap = snapshot.tilemapsByFileName[issue.fileName];
  if (!tilemap) throw new Error(`No existe ${issue.fileName}.`);
  const placementId = nextPokeDiscoverAuthoringId(
    pokeDiscoverPokemonPlacementPrefix(assetId),
    allKnownIds(snapshot.adventure, tilemap),
  );
  let found = false;
  const layers = tilemap.layers.map(layer => !Array.isArray(layer.objects)
    ? layer
    : {
      ...layer,
      objects: (layer.objects as PokeDiscoverTiledObject[]).map(object => {
        if (object.id !== issue.objectId) return object;
        found = true;
        return {
          ...object,
          name: placementId,
          class: 'ActorAnchor',
          type: undefined,
        };
      }),
    });
  if (!found) throw new Error(`No existe el objeto Tiled #${issue.objectId}.`);
  const adventure = synchronizeAdventureRequiredAssetIds({
    ...snapshot.adventure,
    sectors: snapshot.adventure.sectors.map(candidate => candidate.sectorId === issue.sectorId
      ? {
        ...candidate,
        roster: {
          ...candidate.roster,
          pokemonAssetIds: [...new Set([...candidate.roster.pokemonAssetIds, assetId])],
        },
      }
      : candidate),
    actorPlacements: [...snapshot.adventure.actorPlacements, {
      schemaVersion: 1,
      placementId,
      sectorId: issue.sectorId,
      anchorId: placementId,
      assetId,
      animation,
      direction: 'down',
    }],
  });
  return {
    snapshot: {
      ...snapshot,
      adventure,
      tilemapsByFileName: {
        ...snapshot.tilemapsByFileName,
        [issue.fileName]: { ...tilemap, layers } as PokeDiscoverEditableTiledMap,
      },
    },
    placementId,
  };
}
