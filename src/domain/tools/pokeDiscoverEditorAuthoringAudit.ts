import {
  TILED_ANCHOR_CLASSES,
  type AdventureMapV3,
  type TiledAnchorClass,
} from '../../../packages/contracts/src/index.js';
import { validateAdventureSectorRoster } from '../expeditions/adventureMapV3.js';
import {
  findPokeDiscoverGeometryReferences,
  connectPokeDiscoverRoomsBidirectionally,
  type PokeDiscoverWorldEdge,
} from './pokeDiscoverEditorGeometry.js';
import {
  addPokeDiscoverTiledObject,
  removePokeDiscoverTiledObject,
  updatePokeDiscoverTiledObject,
  type PokeDiscoverEditableTiledMap,
  type PokeDiscoverTiledObject,
} from './pokeDiscoverEditorProject.js';
import { replacePokeDiscoverTiledObjectWithComment } from './pokeDiscoverEditorComments.js';
import { deriveCanonicalPokemonPlacementIds } from './pokeDiscoverEditorAuthoringRegistry.js';
import type { PokeDiscoverWorkspaceSnapshot } from './pokeDiscoverEditorWorkspace.js';

export type PokeDiscoverAuthoringIssueKind =
  | 'roster'
  | 'duplicate-id'
  | 'unsupported-class'
  | 'invalid-id'
  | 'derived-id'
  | 'shared-anchor'
  | 'unlinked-transition'
  | 'pending-transition'
  | 'pending-transition-ready'
  | 'orphan'
  | 'path-without-action'
  | 'invalid-occluder'
  | 'invalid-trigger-zone'
  | 'invalid-editor-comment';

export interface PokeDiscoverAuthoringIssue {
  issueId: string;
  kind: PokeDiscoverAuthoringIssueKind;
  sectorId: string;
  fileName: string;
  message: string;
  objectId?: number;
  currentName?: string;
  currentClass?: string;
  layerName?: string;
  position?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  expectedName?: string;
  expectedClass?: TiledAnchorClass | 'AmbientPath' | 'ActorOccluder' | 'Collision' | 'TriggerZone' | 'EditorComment';
  constructionId?: string;
  removablePlacementId?: string;
  references: string[];
  canDelete: boolean;
  canRepair: boolean;
}

export function extendPokeDiscoverSanitationIssueOrder(
  currentOrder: readonly string[],
  issues: readonly Pick<PokeDiscoverAuthoringIssue, 'issueId'>[],
) {
  const known = new Set(currentOrder);
  return [
    ...currentOrder,
    ...issues.map(issue => issue.issueId).filter(issueId => {
      if (known.has(issueId)) return false;
      known.add(issueId);
      return true;
    }),
  ];
}

export function findIntroducedPokeDiscoverValidationErrors(
  currentErrors: readonly string[],
  candidateErrors: readonly string[],
) {
  const remainingCurrentErrors = new Map<string, number>();
  for (const error of currentErrors) {
    remainingCurrentErrors.set(error, (remainingCurrentErrors.get(error) ?? 0) + 1);
  }
  return candidateErrors.filter(error => {
    const remaining = remainingCurrentErrors.get(error) ?? 0;
    if (remaining === 0) return true;
    remainingCurrentErrors.set(error, remaining - 1);
    return false;
  });
}

interface ExpectedAnchor {
  name: string;
  klass: TiledAnchorClass;
  constructionId?: string;
  removablePlacementId?: string;
}

function technicalId(value: string) {
  return /^[a-z0-9][a-z0-9-]*(?::[a-z0-9][a-z0-9-]*)+$/u.test(value);
}

function expectedAnchors(adventure: AdventureMapV3, sectorId: string) {
  const expected = new Map<string, ExpectedAnchor[]>();
  const canonicalPokemonIds = deriveCanonicalPokemonPlacementIds(adventure);
  const add = (anchorId: string, value: ExpectedAnchor) => {
    const values = expected.get(anchorId) ?? [];
    if (!values.some(candidate => candidate.name === value.name && candidate.klass === value.klass)) {
      expected.set(anchorId, [...values, value]);
    }
  };
  for (const placement of adventure.actorPlacements.filter(value => value.sectorId === sectorId)) {
    add(placement.anchorId, {
      name: canonicalPokemonIds.get(placement.placementId) ?? placement.placementId,
      klass: 'ActorAnchor',
      constructionId: placement.placementId,
      removablePlacementId: placement.placementId,
    });
  }
  for (const placement of adventure.characterPlacements.filter(value => value.sectorId === sectorId)) {
    add(placement.anchorId, {
      name: placement.placementId,
      klass: placement.controllable ? 'PlayerSpawn' : 'ActorAnchor',
      constructionId: placement.placementId,
    });
  }
  for (const entry of (adventure.entryPoints ?? []).filter(value => value.sectorId === sectorId)) {
    add(entry.anchorId, {
      name: entry.entryPointId,
      klass: 'PlayerSpawn',
      constructionId: entry.entryPointId,
    });
  }
  for (const transition of adventure.transitions) {
    if (transition.fromSectorId === sectorId) {
      add(transition.fromAnchorId, {
        name: `${transition.transitionId}:from`,
        klass: 'TransitionAnchor',
      });
    }
    if (transition.toSectorId === sectorId) {
      add(transition.toAnchorId, {
        name: `${transition.transitionId}:to`,
        klass: 'TransitionAnchor',
      });
    }
  }
  for (const interaction of (adventure.interactions ?? []).filter(
    value => value.sectorId === sectorId && value.target.kind === 'anchor',
  )) {
    if (interaction.target.kind !== 'anchor') continue;
    add(interaction.target.anchorId, {
      name: interaction.interactionId,
      klass: interaction.meaningfulKind === 'secret' ? 'SecretAnchor' : 'InteractionAnchor',
    });
  }
  for (const sequence of [
    ...(adventure.companionSequences ?? []),
    ...(adventure.mapSequences ?? []),
  ].filter(value => value.sectorId === sectorId)) {
    for (const beat of sequence.beats) {
      beat.actions.forEach((action, actionIndex) => {
        if (action.kind !== 'moveToAnchor') return;
        add(action.anchorId, {
          name: `${sequence.sequenceId}:${beat.beatId}:destination:${String(actionIndex + 1).padStart(2, '0')}`,
          klass: 'ActorAnchor',
        });
      });
    }
  }
  return expected;
}

function objectClass(object: PokeDiscoverTiledObject) {
  return String(object.class || object.type || '');
}

function objectProperties(object: PokeDiscoverTiledObject) {
  return new Map((object.properties ?? []).map(property => [
    String(property.name ?? ''),
    property.value,
  ]));
}

interface LegacyTransitionConnection {
  sourceEdge: PokeDiscoverWorldEdge;
  sourceStart: number;
  targetStart: number;
  length: number;
  targetFileName: string;
  targetSectorId: string;
  targetObjectId?: number;
  targetObjectName?: string;
}

interface PendingTransitionTarget {
  targetFileName: string;
  sourceEdge: PokeDiscoverWorldEdge;
}

function inferPendingTransitionTarget(
  snapshot: PokeDiscoverWorkspaceSnapshot,
  fileName: string,
  object: PokeDiscoverTiledObject,
): PendingTransitionTarget | undefined {
  const sourceWorld = snapshot.world.maps.find(entry => entry.fileName === fileName);
  const sourceTilemap = snapshot.tilemapsByFileName[fileName];
  if (!sourceWorld || !sourceTilemap) return undefined;
  const mapWidth = sourceTilemap.width * sourceTilemap.tilewidth;
  const mapHeight = sourceTilemap.height * sourceTilemap.tileheight;
  const distances: Array<{ edge: PokeDiscoverWorldEdge; distance: number }> = [
    { edge: 'left', distance: Math.abs(Number(object.x ?? 0)) },
    { edge: 'right', distance: Math.abs(mapWidth - (Number(object.x ?? 0) + Number(object.width ?? 0))) },
    { edge: 'top', distance: Math.abs(Number(object.y ?? 0)) },
    { edge: 'bottom', distance: Math.abs(mapHeight - (Number(object.y ?? 0) + Number(object.height ?? 0))) },
  ];
  distances.sort((left, right) => left.distance - right.distance);
  const closest = distances[0];
  if (!closest || closest.distance > Math.max(sourceTilemap.tilewidth, sourceTilemap.tileheight)) {
    return undefined;
  }
  const sourceWidth = sourceWorld.width ?? mapWidth;
  const sourceHeight = sourceWorld.height ?? mapHeight;
  const sourceStart = (closest.edge === 'top' || closest.edge === 'bottom'
    ? sourceWorld.x + Number(object.x ?? 0)
    : sourceWorld.y + Number(object.y ?? 0));
  const sourceLength = closest.edge === 'top' || closest.edge === 'bottom'
    ? Number(object.width ?? 0)
    : Number(object.height ?? 0);
  const candidates = snapshot.world.maps.filter(candidate => {
    if (candidate.fileName === fileName) return false;
    const candidateWidth = candidate.width ?? mapWidth;
    const candidateHeight = candidate.height ?? mapHeight;
    const touches = closest.edge === 'right'
      ? candidate.x === sourceWorld.x + sourceWidth
      : closest.edge === 'left'
        ? candidate.x + candidateWidth === sourceWorld.x
        : closest.edge === 'bottom'
          ? candidate.y === sourceWorld.y + sourceHeight
          : candidate.y + candidateHeight === sourceWorld.y;
    if (!touches) return false;
    const candidateStart = closest.edge === 'top' || closest.edge === 'bottom'
      ? candidate.x
      : candidate.y;
    const candidateLength = closest.edge === 'top' || closest.edge === 'bottom'
      ? candidateWidth
      : candidateHeight;
    return Math.min(sourceStart + sourceLength, candidateStart + candidateLength)
      - Math.max(sourceStart, candidateStart) > 0;
  }).filter(candidate => {
    const registration = snapshot.registrations.find(
      value => !value.archived && value.fileName === candidate.fileName,
    );
    return !registration || !snapshot.tilemapsByFileName[registration.fileName];
  });
  return candidates.length === 1
    ? { targetFileName: candidates[0].fileName, sourceEdge: closest.edge }
    : undefined;
}

function inferLegacyTransitionConnection(
  snapshot: PokeDiscoverWorkspaceSnapshot,
  fileName: string,
  object: PokeDiscoverTiledObject,
): LegacyTransitionConnection | undefined {
  const sourceRegistration = snapshot.registrations.find(
    registration => !registration.archived && registration.fileName === fileName,
  );
  const sourceWorld = snapshot.world.maps.find(entry => entry.fileName === fileName);
  const sourceTilemap = snapshot.tilemapsByFileName[fileName];
  if (!sourceRegistration || !sourceWorld || !sourceTilemap) return undefined;
  const mapWidth = sourceTilemap.width * sourceTilemap.tilewidth;
  const mapHeight = sourceTilemap.height * sourceTilemap.tileheight;
  const distances: Array<{ edge: PokeDiscoverWorldEdge; distance: number }> = [
    { edge: 'left', distance: Math.abs(Number(object.x ?? 0)) },
    { edge: 'right', distance: Math.abs(mapWidth - (Number(object.x ?? 0) + Number(object.width ?? 0))) },
    { edge: 'top', distance: Math.abs(Number(object.y ?? 0)) },
    { edge: 'bottom', distance: Math.abs(mapHeight - (Number(object.y ?? 0) + Number(object.height ?? 0))) },
  ];
  distances.sort((left, right) => left.distance - right.distance);
  const closest = distances[0];
  if (!closest || closest.distance > Math.max(sourceTilemap.tilewidth, sourceTilemap.tileheight)) {
    return undefined;
  }
  const sourceWidth = sourceWorld.width ?? mapWidth;
  const sourceHeight = sourceWorld.height ?? mapHeight;
  const adjacentWorlds = snapshot.world.maps.filter(candidate => {
    if (candidate.fileName === fileName) return false;
    const candidateRegistration = snapshot.registrations.find(
      registration => !registration.archived && registration.fileName === candidate.fileName,
    );
    if (!candidateRegistration || !snapshot.tilemapsByFileName[candidate.fileName]) return false;
    const candidateTilemap = snapshot.tilemapsByFileName[candidate.fileName];
    const candidateWidth = candidate.width ?? candidateTilemap.width * candidateTilemap.tilewidth;
    const candidateHeight = candidate.height ?? candidateTilemap.height * candidateTilemap.tileheight;
    if (closest.edge === 'bottom' || closest.edge === 'top') {
      const touches = closest.edge === 'bottom'
        ? candidate.y === sourceWorld.y + sourceHeight
        : candidate.y + candidateHeight === sourceWorld.y;
      return touches
        && candidate.x < sourceWorld.x + sourceWidth
        && candidate.x + candidateWidth > sourceWorld.x;
    }
    const touches = closest.edge === 'right'
      ? candidate.x === sourceWorld.x + sourceWidth
      : candidate.x + candidateWidth === sourceWorld.x;
    return touches
      && candidate.y < sourceWorld.y + sourceHeight
      && candidate.y + candidateHeight > sourceWorld.y;
  });
  if (adjacentWorlds.length !== 1) return undefined;
  const targetWorld = adjacentWorlds[0];
  const targetRegistration = snapshot.registrations.find(
    registration => !registration.archived && registration.fileName === targetWorld.fileName,
  );
  const targetTilemap = snapshot.tilemapsByFileName[targetWorld.fileName];
  if (!targetRegistration || !targetTilemap) return undefined;
  const oppositeEdge: PokeDiscoverWorldEdge = closest.edge === 'left'
    ? 'right'
    : closest.edge === 'right'
      ? 'left'
      : closest.edge === 'top'
        ? 'bottom'
        : 'top';
  const sourceStart = closest.edge === 'top' || closest.edge === 'bottom'
    ? Number(object.x ?? 0)
    : Number(object.y ?? 0);
  const length = closest.edge === 'top' || closest.edge === 'bottom'
    ? Number(object.width ?? 0)
    : Number(object.height ?? 0);
  if (length <= 0) return undefined;
  const worldStart = (closest.edge === 'top' || closest.edge === 'bottom'
    ? sourceWorld.x
    : sourceWorld.y) + sourceStart;
  const targetStart = worldStart - (closest.edge === 'top' || closest.edge === 'bottom'
    ? targetWorld.x
    : targetWorld.y);
  const targetMapWidth = targetTilemap.width * targetTilemap.tilewidth;
  const targetMapHeight = targetTilemap.height * targetTilemap.tileheight;
  const candidates = ((targetTilemap.layers.find(layer => layer.name === 'Anchors')?.objects
    ?? []) as PokeDiscoverTiledObject[]).filter(candidate => {
    const klass = objectClass(candidate);
    if (klass !== 'TransitionAnchor'
      && !String(candidate.name ?? '').toLowerCase().includes('transition')) return false;
    const edgeDistance = oppositeEdge === 'left'
      ? Math.abs(Number(candidate.x ?? 0))
      : oppositeEdge === 'right'
        ? Math.abs(targetMapWidth - (Number(candidate.x ?? 0) + Number(candidate.width ?? 0)))
        : oppositeEdge === 'top'
          ? Math.abs(Number(candidate.y ?? 0))
          : Math.abs(targetMapHeight - (Number(candidate.y ?? 0) + Number(candidate.height ?? 0)));
    if (edgeDistance > Math.max(targetTilemap.tilewidth, targetTilemap.tileheight)) return false;
    const candidateStart = oppositeEdge === 'top' || oppositeEdge === 'bottom'
      ? Number(candidate.x ?? 0)
      : Number(candidate.y ?? 0);
    const candidateLength = oppositeEdge === 'top' || oppositeEdge === 'bottom'
      ? Number(candidate.width ?? 0)
      : Number(candidate.height ?? 0);
    return Math.min(targetStart + length, candidateStart + candidateLength)
      - Math.max(targetStart, candidateStart) > 0;
  });
  if (candidates.length > 1) return undefined;
  return {
    sourceEdge: closest.edge,
    sourceStart,
    targetStart: candidates[0]
      ? (oppositeEdge === 'top' || oppositeEdge === 'bottom'
        ? Number(candidates[0].x ?? 0)
        : Number(candidates[0].y ?? 0))
      : targetStart,
    length,
    targetFileName: targetRegistration.fileName,
    targetSectorId: targetRegistration.sectorId,
    targetObjectId: candidates[0]?.id,
    targetObjectName: candidates[0] ? String(candidates[0].name ?? '').trim() : undefined,
  };
}

export function auditPokeDiscoverAuthoringSnapshot(
  snapshot: PokeDiscoverWorkspaceSnapshot,
  manifests?: {
    pokemonAssetIds?: ReadonlySet<string>;
    npcAssetIds?: ReadonlySet<string>;
  },
) {
  const issues: PokeDiscoverAuthoringIssue[] = [];
  for (const registration of snapshot.registrations.filter(value => !value.archived)) {
    const sector = snapshot.adventure.sectors.find(
      candidate => candidate.sectorId === registration.sectorId,
    );
    const tilemap = snapshot.tilemapsByFileName[registration.fileName];
    if (!sector || !tilemap) continue;
    for (const message of validateAdventureSectorRoster(sector, manifests)) {
      issues.push({
        issueId: `roster:${sector.sectorId}:${message}`,
        kind: 'roster',
        sectorId: sector.sectorId,
        fileName: registration.fileName,
        message,
        references: [],
        canDelete: false,
        canRepair: false,
      });
    }
    const expected = expectedAnchors(snapshot.adventure, sector.sectorId);
    const seen = new Set<string>();
    const anchors = tilemap.layers.find(layer => layer.name === 'Anchors')?.objects ?? [];
    for (const object of anchors as PokeDiscoverTiledObject[]) {
      const name = String(object.name ?? '').trim();
      const klass = objectClass(object);
      const references = findPokeDiscoverGeometryReferences(snapshot.adventure, name);
      const expectedUses = expected.get(name) ?? [];
      const expectedUse = expectedUses.length === 1 ? expectedUses[0] : undefined;
      const canRemoveStaleSpawn = expectedUses.length === 0
        && references.length > 0
        && references.every(reference => reference.startsWith('Sector '));
      const transitionConnection = expectedUses.length === 0
        && (klass === 'TransitionAnchor' || name.toLowerCase().includes('transition'))
        ? inferLegacyTransitionConnection(snapshot, registration.fileName, object)
        : undefined;
      const pendingTransition = !transitionConnection
        && expectedUses.length === 0
        && (klass === 'TransitionAnchor' || name.toLowerCase().includes('transition'))
        ? inferPendingTransitionTarget(snapshot, registration.fileName, object)
        : undefined;
      const common = {
        sectorId: sector.sectorId,
        fileName: registration.fileName,
        objectId: object.id,
        currentName: name,
        currentClass: klass,
        layerName: 'Anchors',
        position: {
          x: Number(object.x ?? 0),
          y: Number(object.y ?? 0),
          width: Number(object.width ?? 0),
          height: Number(object.height ?? 0),
        },
        references,
        constructionId: expectedUse?.constructionId,
        removablePlacementId: expectedUse?.removablePlacementId,
      };
      if (transitionConnection) {
        issues.push({
          ...common,
          issueId: `unlinked-transition:${registration.fileName}:${object.id}`,
          kind: 'unlinked-transition',
          message: `${name || `#${object.id}`} puede conectarse con el sector contiguo.`,
          references: [
            `Sector de origen ${sector.sectorId}`,
            `Sector de destino ${transitionConnection.targetSectorId}`,
          ],
          canDelete: true,
          canRepair: true,
        });
        continue;
      }
      if (pendingTransition) {
        issues.push({
          ...common,
          issueId: `pending-transition:${registration.fileName}:${object.id}`,
          kind: 'pending-transition',
          message: `${name || `#${object.id}`} apunta a un sector que todavía no está disponible.`,
          references: [`Mapa pendiente ${pendingTransition.targetFileName}`],
          canDelete: true,
          canRepair: true,
        });
        continue;
      }
      if (expectedUses.length > 1) {
        issues.push({
          ...common,
          issueId: `shared-anchor:${registration.fileName}:${object.id}`,
          kind: 'shared-anchor',
          message: `${name} está compartida por varias colocaciones y debe separarse.`,
          canDelete: false,
          canRepair: true,
        });
        continue;
      }
      if (seen.has(name)) {
        issues.push({
          ...common,
          issueId: `duplicate:${registration.fileName}:${object.id}`,
          kind: 'duplicate-id',
          message: `${name || '(vacío)'} está repetido en el TMJ.`,
          canDelete: true,
          canRepair: false,
        });
        continue;
      }
      seen.add(name);
      if (!TILED_ANCHOR_CLASSES.includes(klass as TiledAnchorClass)) {
        issues.push({
          ...common,
          issueId: `class:${registration.fileName}:${object.id}`,
          kind: 'unsupported-class',
          message: `El objeto Tiled #${object.id} de la capa Anchors usa la clase no comprendida ${klass || '(vacía)'}.`,
          expectedName: expectedUse?.name,
          expectedClass: expectedUse?.klass,
          canDelete: references.length === 0 || canRemoveStaleSpawn
            || Boolean(expectedUse?.removablePlacementId),
          canRepair: Boolean(expectedUse),
        });
        continue;
      }
      if (!technicalId(name)) {
        issues.push({
          ...common,
          issueId: `id:${registration.fileName}:${object.id}`,
          kind: 'invalid-id',
          message: `${name || `#${object.id}`} no cumple la convención de ID técnico.`,
          expectedName: expectedUse?.name,
          expectedClass: expectedUse?.klass,
          canDelete: references.length === 0 || canRemoveStaleSpawn
            || Boolean(expectedUse?.removablePlacementId),
          canRepair: Boolean(expectedUse),
        });
      } else if (expectedUse
        && (expectedUse.name !== name || expectedUse.klass !== klass)) {
        issues.push({
          ...common,
          issueId: `derived:${registration.fileName}:${object.id}`,
          kind: 'derived-id',
          message: `${name} no coincide con la construcción que lo utiliza.`,
          expectedName: expectedUse?.name,
          expectedClass: expectedUse?.klass,
          canDelete: Boolean(expectedUse?.removablePlacementId),
          canRepair: Boolean(expectedUse),
        });
      } else if (!expectedUse && (references.length === 0 || canRemoveStaleSpawn)) {
        issues.push({
          ...common,
          issueId: `orphan:${registration.fileName}:${object.id}`,
          kind: 'orphan',
          message: canRemoveStaleSpawn
            ? `${name} sólo permanece en la lista antigua de apariciones y ya no tiene una función.`
            : `${name} es un ancla funcionalmente huérfana.`,
          canDelete: true,
          canRepair: false,
        });
      }
    }
    const collisions = (tilemap.layers.find(layer => layer.name === 'Collision')?.objects
      ?? []) as PokeDiscoverTiledObject[];
    const usedCollisionIds = new Set(collisions
      .map(object => String(object.name ?? '').trim())
      .filter(name => /^collision:\d{2,}$/u.test(name)));
    let collisionOrdinal = 1;
    collisions.forEach(object => {
      const name = String(object.name ?? '').trim();
      const klass = objectClass(object);
      if (klass === 'Collision' && /^collision:\d{2,}$/u.test(name)) return;
      while (usedCollisionIds.has(`collision:${String(collisionOrdinal).padStart(2, '0')}`)) {
        collisionOrdinal += 1;
      }
      const expectedName = `collision:${String(collisionOrdinal).padStart(2, '0')}`;
      usedCollisionIds.add(expectedName);
      collisionOrdinal += 1;
      issues.push({
        issueId: `collision:${registration.fileName}:${object.id}`,
        kind: klass !== 'Collision' ? 'unsupported-class' : 'derived-id',
        sectorId: sector.sectorId,
        fileName: registration.fileName,
        objectId: object.id,
        currentName: name,
        currentClass: klass,
        layerName: 'Collision',
        position: {
          x: Number(object.x ?? 0),
          y: Number(object.y ?? 0),
          width: Number(object.width ?? 0),
          height: Number(object.height ?? 0),
        },
        expectedName,
        expectedClass: 'Collision',
        message: `El objeto Tiled #${object.id} de la capa Collision debe usar la clase Collision y el ID ${expectedName}.`,
        references: [],
        canDelete: true,
        canRepair: true,
      });
    });
    const referencedPaths = new Map<string, string[]>();
    for (const sequence of snapshot.adventure.ambientSequences.filter(
      value => value.sectorId === sector.sectorId,
    )) {
      for (const beat of sequence.beats) {
        beat.actions.forEach((action, actionIndex) => {
          if (action.kind !== 'movePath') return;
          const expectedName = `${sequence.sequenceId}:${beat.beatId}:move-path:${String(
            actionIndex + 1,
          ).padStart(2, '0')}`;
          referencedPaths.set(action.pathId, [
            ...(referencedPaths.get(action.pathId) ?? []),
            expectedName,
          ]);
        });
      }
    }
    for (const sequence of (snapshot.adventure.mapSequences ?? []).filter(
      value => value.sectorId === sector.sectorId,
    )) {
      for (const beat of sequence.beats) {
        for (const action of beat.actions) {
          if (action.kind !== 'movePath') continue;
          referencedPaths.set(action.pathId, [
            ...(referencedPaths.get(action.pathId) ?? []),
            action.pathId,
          ]);
        }
      }
    }
    for (const object of (tilemap.layers.find(layer => layer.name === 'Paths')?.objects ?? []) as PokeDiscoverTiledObject[]) {
      const name = String(object.name ?? '').trim();
      const expectedNames = referencedPaths.get(name) ?? [];
      if (!expectedNames.length) issues.push({
        issueId: `path:${registration.fileName}:${object.id}`,
        kind: 'path-without-action',
        sectorId: sector.sectorId,
        fileName: registration.fileName,
        objectId: object.id,
        currentName: name,
        currentClass: objectClass(object),
        layerName: 'Paths',
        position: {
          x: Number(object.x ?? 0),
          y: Number(object.y ?? 0),
          width: Number(object.width ?? 0),
          height: Number(object.height ?? 0),
        },
        message: `${name || `#${object.id}`} no está asociado a ninguna acción movePath.`,
        references: [],
        canDelete: true,
        canRepair: false,
      });
      else if (expectedNames.length === 1
        && (name !== expectedNames[0] || objectClass(object) !== 'AmbientPath')) issues.push({
        issueId: `path-derived:${registration.fileName}:${object.id}`,
        kind: objectClass(object) !== 'AmbientPath' ? 'unsupported-class' : 'derived-id',
        sectorId: sector.sectorId,
        fileName: registration.fileName,
        objectId: object.id,
        currentName: name,
        currentClass: objectClass(object),
        layerName: 'Paths',
        position: {
          x: Number(object.x ?? 0),
          y: Number(object.y ?? 0),
          width: Number(object.width ?? 0),
          height: Number(object.height ?? 0),
        },
        expectedName: expectedNames[0],
        expectedClass: 'AmbientPath',
        message: `${name} debe derivarse de la secuencia, beat y acción movePath.`,
        references: expectedNames,
        canDelete: false,
        canRepair: true,
      });
    }
    const sectorPlacements = [
      ...snapshot.adventure.actorPlacements,
      ...snapshot.adventure.characterPlacements,
    ].filter(value => value.sectorId === sector.sectorId);
    const sectorPlacementIds = new Set(sectorPlacements.map(value => value.placementId));
    const canonicalPokemonIds = deriveCanonicalPokemonPlacementIds(snapshot.adventure);
    for (const object of (tilemap.layers.find(layer => layer.name === 'Occlusion')?.objects ?? []) as PokeDiscoverTiledObject[]) {
      const properties = objectProperties(object);
      const groupId = String(properties.get('occlusionGroup') ?? '').trim();
      const explicitlyAssociated = String(properties.get('includePlacementIds') ?? '')
        .split(',').map(value => value.trim()).filter(value => sectorPlacementIds.has(value));
      const groupMembers = sectorPlacements
        .filter(placement => placement.occlusionGroupIds?.includes(groupId))
        .map(placement => placement.placementId);
      const associated = [...new Set([...groupMembers, ...explicitlyAssociated])]
        .map(placementId => canonicalPokemonIds.get(placementId) ?? placementId);
      if (!technicalId(groupId) || !associated.length) issues.push({
        issueId: `occluder:${registration.fileName}:${object.id}`,
        kind: 'invalid-occluder',
        sectorId: sector.sectorId,
        fileName: registration.fileName,
        objectId: object.id,
        currentName: String(object.name ?? ''),
        currentClass: objectClass(object),
        layerName: 'Occlusion',
        position: {
          x: Number(object.x ?? 0),
          y: Number(object.y ?? 0),
          width: Number(object.width ?? 0),
          height: Number(object.height ?? 0),
        },
        message: `${String(object.name || `#${object.id}`)} necesita grupo y al menos una colocación asociada.`,
        references: associated,
        canDelete: true,
        canRepair: false,
      });
      else {
        const expectedName = `${groupId}:occluder:${associated[0]}:01`;
        if (String(object.name ?? '') !== expectedName || objectClass(object) !== 'ActorOccluder') {
          issues.push({
            issueId: `occluder-derived:${registration.fileName}:${object.id}`,
            kind: objectClass(object) !== 'ActorOccluder' ? 'unsupported-class' : 'derived-id',
            sectorId: sector.sectorId,
            fileName: registration.fileName,
            objectId: object.id,
            currentName: String(object.name ?? ''),
            currentClass: objectClass(object),
            layerName: 'Occlusion',
            position: {
              x: Number(object.x ?? 0),
              y: Number(object.y ?? 0),
              width: Number(object.width ?? 0),
              height: Number(object.height ?? 0),
            },
            expectedName,
            expectedClass: 'ActorOccluder',
            message: `${String(object.name || `#${object.id}`)} debe derivarse de su grupo y colocación asociada.`,
            references: associated,
            canDelete: false,
            canRepair: Boolean(object.name),
          });
        }
      }
    }
    const zoneReferences = new Map<string, string[]>();
    for (const trigger of (snapshot.adventure.mapEventTriggers ?? [])
      .filter(candidate => candidate.sectorId === sector.sectorId)) {
      const zoneId = trigger.activation.kind === 'enterZone'
        ? trigger.activation.zoneId
        : trigger.activation.target.kind === 'zone'
          ? trigger.activation.target.zoneId
          : undefined;
      if (!zoneId) continue;
      zoneReferences.set(zoneId, [
        ...(zoneReferences.get(zoneId) ?? []),
        trigger.triggerId,
      ]);
    }
    for (const object of (tilemap.layers.find(layer => layer.name === 'Triggers')?.objects ?? []) as PokeDiscoverTiledObject[]) {
      const name = String(object.name ?? '').trim();
      const validGeometry = Boolean(
        (object.width > 0 && object.height > 0)
        || (object.polygon?.length ?? 0) >= 3,
      );
      const references = zoneReferences.get(name) ?? [];
      const expectedName = references.length
        ? (/^trigger:map:\d{2,}:zone:\d{2,}$/u.test(name)
          ? name
          : `${references[0]}:zone:01`)
        : undefined;
      if (objectClass(object) !== 'TriggerZone'
        || !/^trigger:map:\d{2,}:zone:\d{2,}$/u.test(name)
        || !validGeometry
        || !references.length) {
        issues.push({
          issueId: `trigger-zone:${registration.fileName}:${object.id}`,
          kind: 'invalid-trigger-zone',
          sectorId: sector.sectorId,
          fileName: registration.fileName,
          objectId: object.id,
          currentName: name,
          currentClass: objectClass(object),
          layerName: 'Triggers',
          position: {
            x: Number(object.x ?? 0),
            y: Number(object.y ?? 0),
            width: Number(object.width ?? 0),
            height: Number(object.height ?? 0),
          },
          message: references.length
            ? `${name || `#${object.id}`} no es una zona de evento válida.`
            : `${name || `#${object.id}`} no está asociado a ningún evento.`,
          expectedName,
          expectedClass: references.length ? 'TriggerZone' : undefined,
          references,
          canDelete: !references.length,
          canRepair: references.length > 0,
        });
      }
    }
    for (const object of (tilemap.layers.find(layer => layer.name === 'Comments')?.objects ?? []) as PokeDiscoverTiledObject[]) {
      const name = String(object.name ?? '').trim();
      const properties = objectProperties(object);
      const validGeometry = Boolean(
        (object.width > 0 && object.height > 0)
        || (object.polygon?.length ?? 0) >= 3,
      );
      const allowedProperties = new Set([
        'text',
        'migrationSourceObjectId',
        'migrationSourceObjectName',
        'migrationSourceObjectClass',
        'pendingConnectionTargetFileName',
        'pendingConnectionSourceEdge',
      ]);
      const validProperties = [...properties.keys()].every(key => allowedProperties.has(key));
      const pendingTargetFileName = String(
        properties.get('pendingConnectionTargetFileName') ?? '',
      ).trim();
      const pendingTargetRegistration = pendingTargetFileName
        ? snapshot.registrations.find(registration => (
          !registration.archived && registration.fileName === pendingTargetFileName
        ))
        : undefined;
      if (pendingTargetRegistration
        && snapshot.tilemapsByFileName[pendingTargetRegistration.fileName]
        && objectClass(object) === 'EditorComment'
        && /^comment:\d{2,}$/u.test(name)
        && String(properties.get('text') ?? '').trim()
        && validGeometry
        && validProperties) {
        issues.push({
          issueId: `pending-transition-ready:${registration.fileName}:${object.id}`,
          kind: 'pending-transition-ready',
          sectorId: sector.sectorId,
          fileName: registration.fileName,
          objectId: object.id,
          currentName: name,
          currentClass: objectClass(object),
          layerName: 'Comments',
          position: {
            x: Number(object.x ?? 0),
            y: Number(object.y ?? 0),
            width: Number(object.width ?? 0),
            height: Number(object.height ?? 0),
          },
          message: `La conexión pendiente con ${pendingTargetFileName} ya puede completarse.`,
          references: [`Sector de destino ${pendingTargetRegistration.sectorId}`],
          canDelete: true,
          canRepair: true,
        });
        continue;
      }
      if (objectClass(object) !== 'EditorComment'
        || !/^comment:\d{2,}$/u.test(name)
        || !String(properties.get('text') ?? '').trim()
        || !validGeometry
        || !validProperties) {
        issues.push({
          issueId: `editor-comment:${registration.fileName}:${object.id}`,
          kind: 'invalid-editor-comment',
          sectorId: sector.sectorId,
          fileName: registration.fileName,
          objectId: object.id,
          currentName: name,
          currentClass: objectClass(object),
          layerName: 'Comments',
          position: {
            x: Number(object.x ?? 0),
            y: Number(object.y ?? 0),
            width: Number(object.width ?? 0),
            height: Number(object.height ?? 0),
          },
          message: `${name || `#${object.id}`} no es un comentario editorial válido.`,
          references: [],
          canDelete: true,
          canRepair: false,
        });
      }
    }
  }
  return issues;
}

function renameAdventureReference(
  adventure: AdventureMapV3,
  currentName: string,
  expectedName: string,
) {
  const renameTarget = <T extends { kind: string }>(target: T): T => (
    target.kind === 'anchor' && 'anchorId' in target && target.anchorId === currentName
      ? { ...target, anchorId: expectedName }
      : target
  ) as T;
  return {
    ...adventure,
    sectors: adventure.sectors.map(sector => ({
      ...sector,
      spawnAnchorIds: sector.spawnAnchorIds.map(value => value === currentName ? expectedName : value),
    })),
    actorPlacements: adventure.actorPlacements.map(value => value.anchorId === currentName
      ? { ...value, anchorId: expectedName }
      : value),
    characterPlacements: adventure.characterPlacements.map(value => value.anchorId === currentName
      ? { ...value, anchorId: expectedName }
      : value),
    transitions: adventure.transitions.map(value => ({
      ...value,
      fromAnchorId: value.fromAnchorId === currentName ? expectedName : value.fromAnchorId,
      toAnchorId: value.toAnchorId === currentName ? expectedName : value.toAnchorId,
    })),
    entryPoints: adventure.entryPoints?.map(value => value.anchorId === currentName
      ? { ...value, anchorId: expectedName }
      : value),
    interactions: adventure.interactions?.map(value => ({
      ...value,
      target: renameTarget(value.target),
    })),
    expressionTriggers: adventure.expressionTriggers.map(value => ({
      ...value,
      target: value.target ? renameTarget(value.target) : value.target,
    })),
    behaviorTriggers: adventure.behaviorTriggers.map(value => ({
      ...value,
      proximity: value.proximity ? {
        ...value.proximity,
        target: renameTarget(value.proximity.target),
      } : value.proximity,
    })),
    companionSequences: adventure.companionSequences?.map(sequence => ({
      ...sequence,
      beats: sequence.beats.map(beat => ({
        ...beat,
        actions: beat.actions.map(action => action.kind === 'moveToAnchor'
          && action.anchorId === currentName
          ? { ...action, anchorId: expectedName }
          : action),
      })),
    })),
    mapSequences: adventure.mapSequences?.map(sequence => ({
      ...sequence,
      beats: sequence.beats.map(beat => ({
        ...beat,
        actions: beat.actions.map(action => {
          if (action.kind === 'moveToAnchor' && action.anchorId === currentName) {
            return { ...action, anchorId: expectedName };
          }
          if (action.kind === 'movePath' && action.pathId === currentName) {
            return { ...action, pathId: expectedName };
          }
          return action;
        }),
      })),
    })),
    mapEventTriggers: adventure.mapEventTriggers?.map(trigger => {
      const activation = trigger.activation.kind === 'enterZone'
        ? {
          ...trigger.activation,
          zoneId: trigger.activation.zoneId === currentName
            ? expectedName
            : trigger.activation.zoneId,
        }
        : trigger.activation.target.kind === 'zone'
          ? {
            ...trigger.activation,
            target: {
              ...trigger.activation.target,
              zoneId: trigger.activation.target.zoneId === currentName
                ? expectedName
                : trigger.activation.target.zoneId,
            },
          }
          : trigger.activation;
      return {
        ...trigger,
        activation,
        resultingActorStates: trigger.resultingActorStates.map(state => (
          state.position?.kind === 'anchor' && state.position.anchorId === currentName
            ? { ...state, position: { ...state.position, anchorId: expectedName } }
            : state.position?.kind === 'pathEnd' && state.position.pathId === currentName
              ? { ...state, position: { ...state.position, pathId: expectedName } }
              : state
        )),
      };
    }),
    ambientSequences: adventure.ambientSequences.map(sequence => ({
      ...sequence,
      beats: sequence.beats.map(beat => ({
        ...beat,
        actions: beat.actions.map(action => action.kind === 'movePath'
          && action.pathId === currentName
          ? { ...action, pathId: expectedName }
          : action),
      })),
    })),
  };
}

function renameAdventureStableId(
  adventure: AdventureMapV3,
  currentId: string,
  expectedId: string,
) {
  const visit = (value: unknown): unknown => {
    if (typeof value === 'string') return value === currentId ? expectedId : value;
    if (Array.isArray(value)) return value.map(visit);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, visit(item)]),
    );
  };
  return visit(adventure) as AdventureMapV3;
}

export function removePokeDiscoverPokemonPlacement(
  adventure: AdventureMapV3,
  placementId: string,
) {
  const references = (value: unknown) => countStableIdReferences(value, placementId) > 0;
  const withoutPlacementActions = <
    T extends { beats: Array<{ actions: unknown[] }> }
  >(sequence: T): T => ({
    ...sequence,
    beats: sequence.beats.map(beat => ({
      ...beat,
      actions: beat.actions.filter(action => !references(action)),
    })),
  });
  return {
    ...adventure,
    actorPlacements: adventure.actorPlacements.filter(
      placement => placement.placementId !== placementId,
    ),
    variants: adventure.variants.filter(variant => !references(variant)),
    behaviorTriggers: adventure.behaviorTriggers.filter(trigger => !references(trigger)),
    expressionTriggers: adventure.expressionTriggers.filter(trigger => !references(trigger)),
    interactions: adventure.interactions?.filter(interaction => !references(interaction)),
    companionSequences: adventure.companionSequences?.map(withoutPlacementActions),
    mapSequences: adventure.mapSequences?.map(withoutPlacementActions),
    ambientSequences: adventure.ambientSequences.map(withoutPlacementActions),
    mapEventTriggers: adventure.mapEventTriggers
      ?.filter(trigger => !references(trigger.activation))
      .map(trigger => ({
        ...trigger,
        resultingActorStates: trigger.resultingActorStates.filter(
          state => state.placementId !== placementId,
        ),
      })),
    rareEncounters: adventure.rareEncounters.filter(encounter => !references(encounter)),
  };
}

function countStableIdReferences(value: unknown, stableId: string): number {
  if (typeof value === 'string') return value === stableId ? 1 : 0;
  if (Array.isArray(value)) {
    return value.reduce(
      (total, item) => total + countStableIdReferences(item, stableId),
      0,
    );
  }
  if (!value || typeof value !== 'object') return 0;
  return Object.values(value).reduce(
    (total, item) => total + countStableIdReferences(item, stableId),
    0,
  );
}

export function repairPokeDiscoverAuthoringIssue(
  snapshot: PokeDiscoverWorkspaceSnapshot,
  issue: PokeDiscoverAuthoringIssue,
) {
  if (issue.kind === 'pending-transition-ready' && issue.objectId !== undefined) {
    const sourceTilemap = snapshot.tilemapsByFileName[issue.fileName];
    const comment = sourceTilemap.layers
      .flatMap(layer => Array.isArray(layer.objects) ? layer.objects : [])
      .find(object => object.id === issue.objectId) as PokeDiscoverTiledObject | undefined;
    if (!comment) throw new Error(`No existe el comentario #${issue.objectId}.`);
    const properties = objectProperties(comment);
    const targetFileName = String(
      properties.get('pendingConnectionTargetFileName') ?? '',
    ).trim();
    const sourceEdge = String(
      properties.get('pendingConnectionSourceEdge') ?? '',
    ) as PokeDiscoverWorldEdge;
    if (!['left', 'right', 'top', 'bottom'].includes(sourceEdge)) {
      throw new Error('La conexión pendiente no conserva un borde válido.');
    }
    const targetRegistration = snapshot.registrations.find(registration => (
      !registration.archived && registration.fileName === targetFileName
    ));
    const targetTilemap = targetRegistration
      ? snapshot.tilemapsByFileName[targetRegistration.fileName]
      : undefined;
    const sourceWorld = snapshot.world.maps.find(entry => entry.fileName === issue.fileName);
    const targetWorld = snapshot.world.maps.find(entry => entry.fileName === targetFileName);
    if (!targetRegistration || !targetTilemap || !sourceWorld || !targetWorld) {
      throw new Error('El sector de destino todavía no está disponible.');
    }
    const horizontalEdge = sourceEdge === 'top' || sourceEdge === 'bottom';
    const sourceStart = horizontalEdge ? Number(comment.x ?? 0) : Number(comment.y ?? 0);
    const length = horizontalEdge ? Number(comment.width ?? 0) : Number(comment.height ?? 0);
    const worldStart = (horizontalEdge ? sourceWorld.x : sourceWorld.y) + sourceStart;
    const targetStart = worldStart - (horizontalEdge ? targetWorld.x : targetWorld.y);
    const connected = connectPokeDiscoverRoomsBidirectionally({
      adventure: snapshot.adventure,
      source: {
        fileName: issue.fileName,
        sectorId: issue.sectorId,
        tilemap: sourceTilemap,
      },
      target: {
        fileName: targetRegistration.fileName,
        sectorId: targetRegistration.sectorId,
        tilemap: targetTilemap,
      },
      sourceEdge,
      sourceStart,
      targetStart,
      length,
    });
    return {
      ...snapshot,
      adventure: connected.adventure,
      tilemapsByFileName: {
        ...snapshot.tilemapsByFileName,
        [issue.fileName]: removePokeDiscoverTiledObject(
          connected.sourceTilemap,
          issue.objectId,
        ),
        [targetRegistration.fileName]: connected.targetTilemap,
      },
    };
  }
  if (issue.kind === 'pending-transition' && issue.objectId !== undefined) {
    const tilemap = snapshot.tilemapsByFileName[issue.fileName];
    const sourceObject = tilemap.layers
      .flatMap(layer => Array.isArray(layer.objects) ? layer.objects : [])
      .find(object => object.id === issue.objectId) as PokeDiscoverTiledObject | undefined;
    if (!sourceObject) throw new Error(`No existe el objeto Tiled #${issue.objectId}.`);
    const pending = inferPendingTransitionTarget(snapshot, issue.fileName, sourceObject);
    if (!pending) {
      throw new Error('Ya no se puede identificar el mapa pendiente de forma segura.');
    }
    const currentName = String(sourceObject.name ?? '').trim();
    const replacement = replacePokeDiscoverTiledObjectWithComment(
      tilemap,
      issue.objectId,
      `Conexión pendiente hacia ${pending.targetFileName}\n${currentName}`,
    );
    const pendingTilemap = updatePokeDiscoverTiledObject(
      replacement.tilemap,
      replacement.object.id,
      comment => ({
        ...comment,
        properties: [
          ...(comment.properties ?? []),
          {
            name: 'pendingConnectionTargetFileName',
            type: 'string',
            value: pending.targetFileName,
          },
          {
            name: 'pendingConnectionSourceEdge',
            type: 'string',
            value: pending.sourceEdge,
          },
        ],
      }),
    );
    return {
      ...snapshot,
      adventure: {
        ...snapshot.adventure,
        sectors: snapshot.adventure.sectors.map(sector => sector.sectorId === issue.sectorId
          ? {
            ...sector,
            spawnAnchorIds: sector.spawnAnchorIds.filter(anchorId => anchorId !== currentName),
          }
          : sector),
      },
      tilemapsByFileName: {
        ...snapshot.tilemapsByFileName,
        [issue.fileName]: pendingTilemap,
      },
    };
  }
  if (issue.kind === 'unlinked-transition' && issue.objectId !== undefined) {
    const sourceTilemap = snapshot.tilemapsByFileName[issue.fileName];
    const sourceObject = sourceTilemap.layers
      .flatMap(layer => Array.isArray(layer.objects) ? layer.objects : [])
      .find(object => object.id === issue.objectId) as PokeDiscoverTiledObject | undefined;
    if (!sourceObject) throw new Error(`No existe el objeto Tiled #${issue.objectId}.`);
    const connection = inferLegacyTransitionConnection(
      snapshot,
      issue.fileName,
      sourceObject,
    );
    if (!connection) {
      throw new Error('Ya no se puede identificar de forma segura el sector contiguo.');
    }
    const targetTilemap = snapshot.tilemapsByFileName[connection.targetFileName];
    const connected = connectPokeDiscoverRoomsBidirectionally({
      adventure: snapshot.adventure,
      source: {
        fileName: issue.fileName,
        sectorId: issue.sectorId,
        tilemap: sourceTilemap,
      },
      target: {
        fileName: connection.targetFileName,
        sectorId: connection.targetSectorId,
        tilemap: targetTilemap,
      },
      sourceEdge: connection.sourceEdge,
      sourceStart: connection.sourceStart,
      targetStart: connection.targetStart,
      length: connection.length,
    });
    const sourceLegacyName = String(sourceObject.name ?? '').trim();
    const nextSourceTilemap = removePokeDiscoverTiledObject(
      connected.sourceTilemap,
      issue.objectId,
    );
    const nextTargetTilemap = connection.targetObjectId === undefined
      ? connected.targetTilemap
      : removePokeDiscoverTiledObject(
        connected.targetTilemap,
        connection.targetObjectId,
      );
    return {
      ...snapshot,
      adventure: {
        ...connected.adventure,
        sectors: connected.adventure.sectors.map(sector => {
          const legacyNames = sector.sectorId === issue.sectorId
            ? [sourceLegacyName]
            : sector.sectorId === connection.targetSectorId
              ? [connection.targetObjectName].filter(Boolean)
              : [];
          return legacyNames.length
            ? {
              ...sector,
              spawnAnchorIds: sector.spawnAnchorIds.filter(
                anchorId => !legacyNames.includes(anchorId),
              ),
            }
            : sector;
        }),
      },
      tilemapsByFileName: {
        ...snapshot.tilemapsByFileName,
        [issue.fileName]: nextSourceTilemap,
        [connection.targetFileName]: nextTargetTilemap,
      },
    };
  }
  if (issue.kind === 'shared-anchor' && issue.objectId !== undefined
    && issue.currentName !== undefined) {
    const tilemap = snapshot.tilemapsByFileName[issue.fileName];
    const uses = expectedAnchors(snapshot.adventure, issue.sectorId)
      .get(issue.currentName) ?? [];
    if (uses.length < 2) {
      throw new Error('El ancla ya no está compartida por varias construcciones.');
    }
    const source = tilemap.layers
      .flatMap(layer => Array.isArray(layer.objects) ? layer.objects : [])
      .find(object => object.id === issue.objectId) as PokeDiscoverTiledObject | undefined;
    if (!source) throw new Error(`No existe el objeto Tiled #${issue.objectId}.`);
    let adventure = snapshot.adventure;
    for (const use of uses) {
      if (use.constructionId && use.constructionId !== use.name) {
        adventure = renameAdventureStableId(adventure, use.constructionId, use.name);
      }
    }
    let nextTilemap = updatePokeDiscoverTiledObject(
      tilemap,
      issue.objectId,
      object => ({
        ...object,
        name: uses[0].name,
        class: uses[0].klass,
        type: undefined,
      }),
    );
    for (const use of uses.slice(1)) {
      nextTilemap = addPokeDiscoverTiledObject(nextTilemap, 'Anchors', {
        ...source,
        name: use.name,
        class: use.klass,
        type: undefined,
      }).tilemap;
    }
    const entry = adventure.entryPoints?.find(candidate => (
      candidate.sectorId === issue.sectorId && candidate.anchorId === issue.currentName
    ));
    const controllable = adventure.characterPlacements.find(candidate => (
      candidate.sectorId === issue.sectorId
      && candidate.anchorId === issue.currentName
      && candidate.controllable
    ));
    const spawnAnchorId = entry?.entryPointId ?? controllable?.placementId ?? uses[0].name;
    const renameSequenceDestinations = <
      T extends NonNullable<AdventureMapV3['mapSequences']>[number]
    >(sequence: T): T => ({
      ...sequence,
      beats: sequence.beats.map(beat => ({
        ...beat,
        actions: beat.actions.map((action, actionIndex) => (
          action.kind === 'moveToAnchor' && action.anchorId === issue.currentName
            ? {
              ...action,
              anchorId: `${sequence.sequenceId}:${beat.beatId}:destination:${
                String(actionIndex + 1).padStart(2, '0')
              }`,
            }
            : action
        )),
      })),
    });
    return {
      ...snapshot,
      adventure: {
        ...adventure,
        sectors: adventure.sectors.map(sector => ({
          ...sector,
          spawnAnchorIds: sector.spawnAnchorIds.map(anchorId => (
            anchorId === issue.currentName ? spawnAnchorId : anchorId
          )),
        })),
        actorPlacements: adventure.actorPlacements.map(placement => (
          placement.sectorId === issue.sectorId && placement.anchorId === issue.currentName
            ? { ...placement, anchorId: placement.placementId }
            : placement
        )),
        characterPlacements: adventure.characterPlacements.map(placement => (
          placement.sectorId === issue.sectorId && placement.anchorId === issue.currentName
            ? { ...placement, anchorId: placement.placementId }
            : placement
        )),
        entryPoints: adventure.entryPoints?.map(candidate => (
          candidate.sectorId === issue.sectorId && candidate.anchorId === issue.currentName
            ? { ...candidate, anchorId: candidate.entryPointId }
            : candidate
        )),
        transitions: adventure.transitions.map(transition => ({
          ...transition,
          fromAnchorId: transition.fromSectorId === issue.sectorId
            && transition.fromAnchorId === issue.currentName
            ? `${transition.transitionId}:from`
            : transition.fromAnchorId,
          toAnchorId: transition.toSectorId === issue.sectorId
            && transition.toAnchorId === issue.currentName
            ? `${transition.transitionId}:to`
            : transition.toAnchorId,
        })),
        interactions: adventure.interactions?.map(interaction => (
          interaction.sectorId === issue.sectorId
          && interaction.target.kind === 'anchor'
          && interaction.target.anchorId === issue.currentName
            ? {
              ...interaction,
              target: { ...interaction.target, anchorId: interaction.interactionId },
            }
            : interaction
        )),
        companionSequences: adventure.companionSequences?.map(
          renameSequenceDestinations,
        ),
        mapSequences: adventure.mapSequences?.map(renameSequenceDestinations),
        mapEventTriggers: adventure.mapEventTriggers?.map(trigger => ({
          ...trigger,
          resultingActorStates: trigger.resultingActorStates.map(state => (
            state.position?.kind === 'anchor'
            && state.position.anchorId === issue.currentName
              ? {
                ...state,
                position: { ...state.position, anchorId: spawnAnchorId },
              }
              : state
          )),
        })),
      },
      tilemapsByFileName: {
        ...snapshot.tilemapsByFileName,
        [issue.fileName]: nextTilemap,
      },
    };
  }
  if (!issue.canRepair || issue.objectId === undefined
    || !issue.expectedName || !issue.expectedClass
    || issue.currentName === undefined) {
    throw new Error('La incidencia no tiene una reparación automática inequívoca.');
  }
  const tilemap = snapshot.tilemapsByFileName[issue.fileName];
  const layers = tilemap.layers.map(layer => !Array.isArray(layer.objects)
    ? layer
    : {
      ...layer,
      objects: (layer.objects as PokeDiscoverTiledObject[]).map(object => {
        if (object.id !== issue.objectId) return object;
        const repaired = {
          ...object,
          name: issue.expectedName!,
          class: issue.expectedClass!,
          type: undefined,
        };
        if (issue.kind !== 'invalid-trigger-zone') return repaired;
        const validPolygon = (object.polygon?.length ?? 0) >= 3;
        if (validPolygon || (object.width > 0 && object.height > 0)) return repaired;
        return {
          ...repaired,
          point: undefined,
          polygon: undefined,
          width: tilemap.tilewidth,
          height: tilemap.tileheight,
        };
      }),
    });
  return {
    ...snapshot,
    adventure: renameAdventureReference(
      issue.constructionId && issue.constructionId !== issue.expectedName
        ? renameAdventureStableId(
          snapshot.adventure,
          issue.constructionId,
          issue.expectedName,
        )
        : snapshot.adventure,
      issue.currentName,
      issue.expectedName,
    ),
    tilemapsByFileName: {
      ...snapshot.tilemapsByFileName,
      [issue.fileName]: { ...tilemap, layers } as PokeDiscoverEditableTiledMap,
    },
  };
}
