import type {
  AdventureMapDocument,
  AdventureMapV2,
  AdventureMapV3,
  AdventureSectorRosterV1,
  AdventureSectorV1,
} from '../../../packages/contracts/src/index.js';

export const MINIMUM_POKEMON_ASSETS_PER_SECTOR = 5;

export function isAdventureMapV3(
  adventure: AdventureMapDocument,
): adventure is AdventureMapV3 {
  return adventure.schemaVersion === 3;
}

export function toSectorId(roomId: string) {
  return roomId.startsWith('room:')
    ? `sector:${roomId.slice('room:'.length)}`
    : roomId.startsWith('sector:')
      ? roomId
      : `sector:${roomId}`;
}

function unique(values: string[]) {
  return [...new Set(values.filter(value => value.trim()))];
}

function inferredRoster(
  adventure: AdventureMapV2,
  roomId: string,
): AdventureSectorRosterV1 {
  return {
    schemaVersion: 1,
    pokemonAssetIds: unique(adventure.actorPlacements
      .filter(placement => placement.roomId === roomId)
      .map(placement => placement.assetId)),
    npcAssetIds: unique(adventure.characterPlacements
      .filter(placement => placement.roomId === roomId && !placement.controllable)
      .map(placement => placement.assetId)),
  };
}

export interface AdventureMapV3MigrationOptions {
  rosterByRoomId?: Readonly<Record<string, AdventureSectorRosterV1>>;
}

/**
 * Conversión pura del documento. La interfaz de migración es responsable de
 * completar los repartos que todavía no alcancen el mínimo antes de guardar.
 */
export function migrateAdventureMapV2ToV3(
  adventure: AdventureMapV2,
  options: AdventureMapV3MigrationOptions = {},
): AdventureMapV3 {
  const sectorIdByRoomId = new Map(
    adventure.rooms.map(room => [room.roomId, toSectorId(room.roomId)]),
  );
  const sectorId = (roomId: string) => sectorIdByRoomId.get(roomId) ?? toSectorId(roomId);
  const { rooms: _legacyRooms, ...document } = adventure;
  return {
    ...document,
    schemaVersion: 3,
    sectors: adventure.rooms.map((room): AdventureSectorV1 => ({
      schemaVersion: room.schemaVersion,
      sectorId: sectorId(room.roomId),
      legacyRoomIds: [room.roomId],
      tiledMapAssetId: room.tiledMapAssetId,
      staticCamera: room.staticCamera,
      spawnAnchorIds: [...room.spawnAnchorIds],
      roster: options.rosterByRoomId?.[room.roomId] ?? inferredRoster(adventure, room.roomId),
    })),
    actorPlacements: adventure.actorPlacements.map(({ roomId, ...placement }) => ({
      ...placement,
      sectorId: sectorId(roomId),
    })),
    characterPlacements: adventure.characterPlacements.map(({ roomId, ...placement }) => ({
      ...placement,
      sectorId: sectorId(roomId),
    })),
    transitions: adventure.transitions.map(({
      fromRoomId,
      toRoomId,
      ...transition
    }) => ({
      ...transition,
      fromSectorId: sectorId(fromRoomId),
      toSectorId: sectorId(toRoomId),
    })),
    entryPoints: adventure.entryPoints?.map(({ roomId, ...entry }) => ({
      ...entry,
      sectorId: sectorId(roomId),
    })),
    behaviorTriggers: adventure.behaviorTriggers.map(trigger => {
      const { proximity: legacyProximity, ...definition } = trigger;
      if (!legacyProximity) return definition;
      const { roomId, ...proximity } = legacyProximity;
      return {
        ...definition,
        proximity: { ...proximity, sectorId: sectorId(roomId) },
      };
    }),
    companionSequences: adventure.companionSequences?.map(({ roomId, ...sequence }) => ({
      ...sequence,
      sectorId: sectorId(roomId),
    })),
    mapSequences: adventure.mapSequences?.map(({ roomId, ...sequence }) => ({
      ...sequence,
      sectorId: sectorId(roomId),
    })),
    mapEventTriggers: adventure.mapEventTriggers?.map(({ roomId, ...trigger }) => ({
      ...trigger,
      sectorId: sectorId(roomId),
    })) ?? [],
    expressionTriggers: adventure.expressionTriggers.map(({ roomId, ...trigger }) => ({
      ...trigger,
      ...(roomId ? { sectorId: sectorId(roomId) } : {}),
    })),
    interactions: adventure.interactions?.map(({ roomId, ...interaction }) => ({
      ...interaction,
      sectorId: sectorId(roomId),
    })),
    ambientSequences: adventure.ambientSequences.map(({ roomId, ...sequence }) => ({
      ...sequence,
      sectorId: sectorId(roomId),
    })),
    requiredAssetIds: unique(adventure.requiredAssetIds),
  };
}

export function normalizeAdventureMapV3(
  adventure: AdventureMapDocument,
): AdventureMapV3 {
  return isAdventureMapV3(adventure)
    ? adventure
    : migrateAdventureMapV2ToV3(adventure);
}

export function resolveAdventureSectorId(
  adventure: AdventureMapV3,
  requestedId: string,
) {
  const direct = adventure.sectors.find(sector => sector.sectorId === requestedId);
  if (direct) return direct.sectorId;
  return adventure.sectors.find(sector => sector.legacyRoomIds?.includes(requestedId))?.sectorId;
}

export function validateAdventureSectorRoster(
  sector: AdventureSectorV1,
  manifests?: {
    pokemonAssetIds?: ReadonlySet<string>;
    npcAssetIds?: ReadonlySet<string>;
  },
) {
  const errors: string[] = [];
  const pokemon = sector.roster?.pokemonAssetIds ?? [];
  const npcs = sector.roster?.npcAssetIds ?? [];
  if (new Set(pokemon).size !== pokemon.length) {
    errors.push(`${sector.sectorId}: el reparto Pokémon contiene assets duplicados`);
  }
  if (new Set(npcs).size !== npcs.length) {
    errors.push(`${sector.sectorId}: el reparto NPC contiene assets duplicados`);
  }
  if (pokemon.length < MINIMUM_POKEMON_ASSETS_PER_SECTOR) {
    errors.push(
      `${sector.sectorId}: el reparto necesita al menos `
      + `${MINIMUM_POKEMON_ASSETS_PER_SECTOR} assets Pokémon`,
    );
  }
  for (const assetId of pokemon) {
    if (manifests?.pokemonAssetIds && !manifests.pokemonAssetIds.has(assetId)) {
      errors.push(`${sector.sectorId}: asset Pokémon inexistente ${assetId}`);
    }
  }
  for (const assetId of npcs) {
    if (manifests?.npcAssetIds && !manifests.npcAssetIds.has(assetId)) {
      errors.push(`${sector.sectorId}: asset NPC inexistente ${assetId}`);
    }
  }
  return errors;
}

export function synchronizeAdventureRequiredAssetIds(
  adventure: AdventureMapV3,
  options: { preserveAssetIds?: readonly string[] } = {},
) {
  const playerAssets = adventure.characterPlacements
    .filter(placement => placement.controllable)
    .map(placement => placement.assetId);
  return {
    ...adventure,
    requiredAssetIds: unique([
      ...adventure.sectors.flatMap(sector => [
        ...sector.roster.pokemonAssetIds,
        ...sector.roster.npcAssetIds,
      ]),
      ...adventure.actorPlacements.map(placement => placement.assetId),
      ...adventure.characterPlacements.map(placement => placement.assetId),
      ...playerAssets,
      ...(options.preserveAssetIds ?? adventure.requiredAssetIds),
    ]),
  };
}
