import type { LoadedAdventureMapBundle, LoadedAdventureSectorBundle } from '../maps/loadAdventureBundle.js';
import { readPokeDiscoverEditorAnchors } from './pokeDiscoverEditorTiledReferences.js';

export type PokeDiscoverEditorContentKind = 'encounter' | 'npc' | 'portal' | 'secret' | 'trigger';

export interface PokeDiscoverEditorContentMarker {
  contentId: string;
  kind: PokeDiscoverEditorContentKind;
  anchorId: string;
  x: number;
  y: number;
}

export function getPokeDiscoverEditorContentMarkers(
  bundle: LoadedAdventureMapBundle,
  room: LoadedAdventureSectorBundle,
): PokeDiscoverEditorContentMarker[] {
  const anchors = new Map(readPokeDiscoverEditorAnchors(room.tilemap).map(anchor => [anchor.anchorId, anchor]));
  const marker = (contentId: string, kind: PokeDiscoverEditorContentKind, anchorId: string) => {
    const anchor = anchors.get(anchorId);
    return anchor ? [{ contentId, kind, anchorId, x: anchor.x, y: anchor.y }] : [];
  };
  return [
    ...bundle.adventure.actorPlacements
      .filter(placement => placement.sectorId === room.sector.sectorId)
      .flatMap(placement => marker(placement.placementId, 'encounter', placement.anchorId)),
    ...bundle.adventure.characterPlacements
      .filter(placement => placement.sectorId === room.sector.sectorId && !placement.controllable)
      .flatMap(placement => marker(placement.placementId, 'npc', placement.anchorId)),
    ...bundle.adventure.transitions
      .filter(transition => transition.fromSectorId === room.sector.sectorId)
      .flatMap(transition => marker(transition.transitionId, 'portal', transition.fromAnchorId)),
    ...(bundle.adventure.interactions ?? [])
      .filter(interaction => interaction.sectorId === room.sector.sectorId && interaction.target.kind === 'anchor')
      .flatMap(interaction => marker(
        interaction.interactionId,
        interaction.meaningfulKind === 'secret' ? 'secret' : 'trigger',
        interaction.target.kind === 'anchor' ? interaction.target.anchorId : '',
      )),
  ];
}

