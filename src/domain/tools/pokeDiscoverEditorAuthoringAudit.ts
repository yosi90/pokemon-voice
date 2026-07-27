import {
  TILED_ANCHOR_CLASSES,
  type AdventureMapV3,
  type TiledAnchorClass,
} from '../../../packages/contracts/src/index.js';
import { validateAdventureSectorRoster } from '../expeditions/adventureMapV3.js';
import {
  findPokeDiscoverGeometryReferences,
} from './pokeDiscoverEditorGeometry.js';
import type {
  PokeDiscoverEditableTiledMap,
  PokeDiscoverTiledObject,
} from './pokeDiscoverEditorProject.js';
import type { PokeDiscoverWorkspaceSnapshot } from './pokeDiscoverEditorWorkspace.js';

export type PokeDiscoverAuthoringIssueKind =
  | 'roster'
  | 'duplicate-id'
  | 'unsupported-class'
  | 'invalid-id'
  | 'derived-id'
  | 'orphan'
  | 'path-without-action'
  | 'invalid-occluder';

export interface PokeDiscoverAuthoringIssue {
  issueId: string;
  kind: PokeDiscoverAuthoringIssueKind;
  sectorId: string;
  fileName: string;
  message: string;
  objectId?: number;
  currentName?: string;
  currentClass?: string;
  expectedName?: string;
  expectedClass?: TiledAnchorClass | 'AmbientPath' | 'ActorOccluder' | 'Collision';
  references: string[];
  canDelete: boolean;
  canRepair: boolean;
}

interface ExpectedAnchor {
  name: string;
  klass: TiledAnchorClass;
}

function technicalId(value: string) {
  return /^[a-z0-9]+(?::[a-z0-9][a-z0-9-]*)+$/u.test(value);
}

function expectedAnchors(adventure: AdventureMapV3, sectorId: string) {
  const expected = new Map<string, ExpectedAnchor>();
  for (const placement of adventure.actorPlacements.filter(value => value.sectorId === sectorId)) {
    expected.set(placement.anchorId, {
      name: placement.placementId,
      klass: 'ActorAnchor',
    });
  }
  for (const placement of adventure.characterPlacements.filter(value => value.sectorId === sectorId)) {
    expected.set(placement.anchorId, {
      name: placement.placementId,
      klass: placement.controllable ? 'PlayerSpawn' : 'ActorAnchor',
    });
  }
  for (const entry of (adventure.entryPoints ?? []).filter(value => value.sectorId === sectorId)) {
    expected.set(entry.anchorId, { name: entry.entryPointId, klass: 'PlayerSpawn' });
  }
  for (const transition of adventure.transitions) {
    if (transition.fromSectorId === sectorId) {
      expected.set(transition.fromAnchorId, {
        name: `${transition.transitionId}:from`,
        klass: 'TransitionAnchor',
      });
    }
    if (transition.toSectorId === sectorId) {
      expected.set(transition.toAnchorId, {
        name: `${transition.transitionId}:to`,
        klass: 'TransitionAnchor',
      });
    }
  }
  for (const interaction of (adventure.interactions ?? []).filter(
    value => value.sectorId === sectorId && value.target.kind === 'anchor',
  )) {
    if (interaction.target.kind !== 'anchor') continue;
    expected.set(interaction.target.anchorId, {
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
        expected.set(action.anchorId, {
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
        issueId: `roster:${sector.sectorId}:${issues.length}`,
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
      const expectedUse = expected.get(name);
      const unambiguousUse = references.length === 1 ? expectedUse : undefined;
      const common = {
        sectorId: sector.sectorId,
        fileName: registration.fileName,
        objectId: object.id,
        currentName: name,
        currentClass: klass,
        references,
      };
      if (seen.has(name)) {
        issues.push({
          ...common,
          issueId: `duplicate:${registration.fileName}:${object.id}`,
          kind: 'duplicate-id',
          message: `${name || '(vacío)'} está repetido en el TMJ.`,
          canDelete: references.length === 0,
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
          message: `${name || `#${object.id}`} usa la clase no comprendida ${klass || '(vacía)'}.`,
          expectedName: unambiguousUse?.name,
          expectedClass: unambiguousUse?.klass,
          canDelete: references.length === 0,
          canRepair: Boolean(unambiguousUse),
        });
        continue;
      }
      if (!technicalId(name)) {
        issues.push({
          ...common,
          issueId: `id:${registration.fileName}:${object.id}`,
          kind: 'invalid-id',
          message: `${name || `#${object.id}`} no cumple la convención de ID técnico.`,
          expectedName: unambiguousUse?.name,
          expectedClass: unambiguousUse?.klass,
          canDelete: references.length === 0,
          canRepair: Boolean(unambiguousUse),
        });
      } else if (expectedUse
        && (expectedUse.name !== name || expectedUse.klass !== klass)) {
        issues.push({
          ...common,
          issueId: `derived:${registration.fileName}:${object.id}`,
          kind: 'derived-id',
          message: `${name} no coincide con la construcción sidecar que lo utiliza.`,
          expectedName: unambiguousUse?.name,
          expectedClass: unambiguousUse?.klass,
          canDelete: false,
          canRepair: Boolean(unambiguousUse),
        });
      } else if (!expectedUse && references.length === 0) {
        issues.push({
          ...common,
          issueId: `orphan:${registration.fileName}:${object.id}`,
          kind: 'orphan',
          message: `${name} es un ancla funcionalmente huérfana.`,
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
        expectedName,
        expectedClass: 'Collision',
        message: `${name || `#${object.id}`} debe usar clase Collision e ID ${expectedName}.`,
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
        expectedName: expectedNames[0],
        expectedClass: 'AmbientPath',
        message: `${name} debe derivarse de la secuencia, beat y acción movePath.`,
        references: expectedNames,
        canDelete: false,
        canRepair: true,
      });
    }
    const sectorPlacementIds = new Set([
      ...snapshot.adventure.actorPlacements,
      ...snapshot.adventure.characterPlacements,
    ].filter(value => value.sectorId === sector.sectorId).map(value => value.placementId));
    for (const object of (tilemap.layers.find(layer => layer.name === 'Occlusion')?.objects ?? []) as PokeDiscoverTiledObject[]) {
      const properties = objectProperties(object);
      const groupId = String(properties.get('occlusionGroup') ?? '').trim();
      const associated = String(properties.get('includePlacementIds') ?? '')
        .split(',').map(value => value.trim()).filter(value => sectorPlacementIds.has(value));
      if (!technicalId(groupId) || !associated.length) issues.push({
        issueId: `occluder:${registration.fileName}:${object.id}`,
        kind: 'invalid-occluder',
        sectorId: sector.sectorId,
        fileName: registration.fileName,
        objectId: object.id,
        currentName: String(object.name ?? ''),
        currentClass: objectClass(object),
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
        actions: beat.actions.map(action => action.kind === 'moveToAnchor'
          && action.anchorId === currentName
          ? { ...action, anchorId: expectedName }
          : action),
      })),
    })),
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

export function repairPokeDiscoverAuthoringIssue(
  snapshot: PokeDiscoverWorkspaceSnapshot,
  issue: PokeDiscoverAuthoringIssue,
) {
  if (!issue.canRepair || issue.objectId === undefined
    || !issue.expectedName || !issue.expectedClass
    || issue.currentName === undefined) {
    throw new Error('La incidencia no tiene una reparación sidecar inequívoca.');
  }
  const tilemap = snapshot.tilemapsByFileName[issue.fileName];
  const layers = tilemap.layers.map(layer => !Array.isArray(layer.objects)
    ? layer
    : {
      ...layer,
      objects: (layer.objects as PokeDiscoverTiledObject[]).map(object => object.id === issue.objectId
        ? {
          ...object,
          name: issue.expectedName!,
          class: issue.expectedClass!,
          type: undefined,
        }
        : object),
    });
  return {
    ...snapshot,
    adventure: renameAdventureReference(
      snapshot.adventure,
      issue.currentName,
      issue.expectedName,
    ),
    tilemapsByFileName: {
      ...snapshot.tilemapsByFileName,
      [issue.fileName]: { ...tilemap, layers } as PokeDiscoverEditableTiledMap,
    },
  };
}
