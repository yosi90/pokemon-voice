import type { LoadedAdventureMapBundle, LoadedAdventureSectorBundle } from './loadAdventureBundle.js';
import { findTiledObject } from './loadAdventureBundle.js';
import type {
  AmbientActorActionV1,
  AmbientSequenceV3,
  CompanionBehaviorTriggerV3,
  CompanionSequenceV3,
  ExpeditionDialogueV1,
  ExpeditionExpressionTriggerV3,
  ExpeditionInteractionV3,
  MillisecondRangeV1,
  PmdSpriteAssetV1,
  PokemonFormV1,
} from '../../../packages/contracts/src/index.js';
import {
  facingTowardTarget,
  findFacingInteraction,
  findFacingSpatialDefinition,
} from './expeditionInteractionRuntime.js';
import {
  activeGridDirection,
  canStartClassicStep,
  facingFromDelta,
  findGridPath,
  gridStep,
  pressGridDirection,
  releaseGridDirection,
  type PressedGridDirection,
} from './gridCompanionRuntime.js';
import {
  readTiledCollisionShape,
  rectangleOverlapsCollision,
  type TiledCollisionShape,
} from './tiledCollisionGeometry.js';
import {
  tiledObjectRectanglePoints,
  transformTiledObjectPoint,
} from './tiledObjectTransform.js';

type PhaserModule = typeof import('phaser');
type Facing = 'up' | 'down' | 'left' | 'right';

const DIRECTION_ROWS = Object.freeze({ down: 0, right: 2, up: 4, left: 6 });
export const MAP_SPECIES_IDENTIFIED_EVENT = 'pokevoice:map-species-identified';
export const MAP_VISIBLE_SPECIES_CHANGED_EVENT = 'pokevoice:map-visible-species-changed';
export const MAP_AMBIENT_CONTROL_EVENT = 'pokevoice:map-ambient-control';
export const MAP_INTERACTION_AVAILABLE_EVENT = 'pokevoice:map-interaction-available';
export const MAP_INTERACTION_REQUEST_EVENT = 'pokevoice:map-interaction-request';
export const MAP_INTERACTION_STARTED_EVENT = 'pokevoice:map-interaction-started';
export const MAP_INTERACTION_CONTROL_EVENT = 'pokevoice:map-interaction-control';
export const MAP_INTERACTION_COMPLETED_EVENT = 'pokevoice:map-interaction-completed';
export const MAP_EXPRESSION_AVAILABLE_EVENT = 'pokevoice:map-expression-available';
export const MAP_EXPRESSION_REQUEST_EVENT = 'pokevoice:map-expression-request';
export const MAP_EXPRESSION_STARTED_EVENT = 'pokevoice:map-expression-started';
export const MAP_EXPRESSION_CONTROL_EVENT = 'pokevoice:map-expression-control';
export const MAP_COMPANION_AVAILABLE_EVENT = 'pokevoice:map-companion-available';
export const MAP_COMPANION_REQUEST_EVENT = 'pokevoice:map-companion-request';
export const MAP_COMPANION_STARTED_EVENT = 'pokevoice:map-companion-started';
export const MAP_COMPANION_CONTROL_EVENT = 'pokevoice:map-companion-control';
export const MAP_COMPANION_BEHAVIOR_COMPLETED_EVENT = 'pokevoice:map-companion-behavior-completed';
export const MAP_COMPANION_SEQUENCE_REQUEST_EVENT = 'pokevoice:map-companion-sequence-request';
export const MAP_SEQUENCE_CUE_EVENT = 'pokevoice:map-sequence-cue';
export const EXPEDITION_MOVEMENT_INPUTS = Object.freeze(['keyboard'] as const);

export interface MapCompanionRuntimeContext {
  displayName: string;
  form: PokemonFormV1;
  asset?: PmdSpriteAssetV1;
  eligibleBehaviorTriggerIds: ReadonlySet<string>;
  resolvedSecretIds: ReadonlySet<string>;
  freeRoam: boolean;
}

export interface MapCompanionPresentation {
  displayName: string;
  behaviors: CompanionBehaviorTriggerV3[];
}

export interface MapInteractionPresentation {
  interaction: ExpeditionInteractionV3;
  dialogue: ExpeditionDialogueV1;
}

type Bounds = { x: number; y: number; width: number; height: number };
type TiledPoint = { x: number; y: number };

interface ActiveActorState {
  placementId: string;
  sprite: import('phaser').GameObjects.Sprite;
  collision: 'solid' | 'pass-through';
  direction: Facing;
  baseX: number;
  baseY: number;
  baseDirection: Facing;
  currentAnimation?: string;
  cropOccluders?: Bounds[];
  cropHeight?: number;
  baseAnimation?: string;
  renderScaleMultiplier: number;
  asset?: LoadedAdventureSectorBundle['actorAssets'] extends Map<string, infer Asset> ? Asset : never;
  characterAsset?: LoadedAdventureSectorBundle['characterAssets'] extends Map<string, infer Asset> ? Asset : never;
}

interface AmbientActionState {
  action: AmbientActorActionV1;
  remainingMs?: number;
  points?: TiledPoint[];
  pointIndex?: number;
  complete: boolean;
}

interface AmbientSequenceState {
  definition: AmbientSequenceV3;
  beatIndex: number;
  actionStates: AmbientActionState[];
  pauseRemainingMs: number;
  phase: 'start' | 'actions' | 'pause' | 'complete';
  cycles: number;
  forward: boolean;
}

export function effectiveAdventureActorScale(
  renderScale = 1,
  renderScaleMultiplier = 1,
) {
  return renderScale * renderScaleMultiplier;
}

function requiredNumber(object: Record<string, unknown> | undefined, key: string, label: string) {
  const value = Number(object?.[key]);
  if (!Number.isFinite(value)) throw new Error(`${label}: falta ${key}.`);
  return value;
}

function tiledObjectBounds(object: Record<string, unknown> | undefined, label: string) {
  const x = requiredNumber(object, 'x', label);
  const y = requiredNumber(object, 'y', label);
  const width = Math.max(0, Number(object?.width) || 0);
  const height = Math.max(0, Number(object?.height) || 0);
  return { x, y, width, height, centerX: x + width / 2, centerY: y + height / 2 };
}

function tiledProperties(object: Record<string, unknown>) {
  const properties = Array.isArray(object.properties)
    ? object.properties as Array<Record<string, unknown>>
    : [];
  return new Map(properties.map(property => [String(property.name), property.value]));
}

function stableIdList(value: unknown) {
  return String(value ?? '').split(',').map(item => item.trim()).filter(Boolean);
}

function overlap(left: Bounds, right: Bounds) {
  return left.x < right.x + right.width && left.x + left.width > right.x
    && left.y < right.y + right.height && left.y + left.height > right.y;
}

function actorFootprint(x: number, y: number): Bounds {
  return { x: x - 8, y: y - 16, width: 16, height: 16 };
}

export function sampleMilliseconds(value: number | MillisecondRangeV1 | undefined, random = Math.random) {
  if (value === undefined) return 0;
  if (typeof value === 'number') return Math.max(0, value);
  return value.min + (value.max - value.min) * random();
}

function sheetUrl(path: string) {
  return new URL(path, new URL(import.meta.env.BASE_URL, window.location.href)).href;
}

export function createTechnicalPhaserGame({
  Phaser,
  parent,
  bundle,
  initialSectorId,
  initialSpawnAnchorId,
  reducedMotion,
  registeredSpeciesIds,
  expressionsEnabled = false,
  resolvedExpressionTriggerIds = new Set<string>(),
  companion,
  initialSequenceId,
  fitParent = true,
  onReady,
}: {
  Phaser: PhaserModule;
  parent: HTMLElement;
  bundle: LoadedAdventureMapBundle;
  initialSectorId: string;
  initialSpawnAnchorId?: string;
  reducedMotion: boolean;
  registeredSpeciesIds: ReadonlySet<number>;
  expressionsEnabled?: boolean;
  resolvedExpressionTriggerIds?: ReadonlySet<string>;
  companion?: MapCompanionRuntimeContext;
  initialSequenceId?: string;
  fitParent?: boolean;
  onReady: () => void;
}) {
  const initialRoom = bundle.sectors.find(candidate => candidate.sector.sectorId === initialSectorId);
  if (!initialRoom) throw new Error(`Sector inicial inexistente: ${initialSectorId}.`);
  const canvasWidth = initialRoom.tilemap.width * initialRoom.tilemap.tilewidth;
  const canvasHeight = initialRoom.tilemap.height * initialRoom.tilemap.tileheight;
  const mapKey = (sectorId: string) => `technical-map:${sectorId}`;
  const tilesetKey = (name: string) => `technical-tileset:${name}`;
  const actorSheetKey = (assetId: string, animation: string, copyOf?: string) => (
    `technical-actor:${assetId}:${copyOf ?? animation}`
  );
  const characterSheetKey = (assetId: string) => `technical-character:${assetId}`;
  const characterAnimationKey = (assetId: string, facing: Facing) => `technical-character-animation:${assetId}:${facing}`;
  const revealedSpeciesIds = new Set(registeredSpeciesIds);
  const completedExpressionTriggerIds = new Set(resolvedExpressionTriggerIds);

  class TechnicalRoomScene extends Phaser.Scene {
    constructor() {
      super('technical-room');
    }

    preload() {
      const loadedTilesets = new Set<string>();
      const loadedActorSheets = new Set<string>();
      const loadedCharacterSheets = new Set<string>();
      for (const roomBundle of bundle.sectors) {
        this.load.tilemapTiledJSON(mapKey(roomBundle.sector.sectorId), roomBundle.tilemap);
        for (const tileset of roomBundle.tilesets) {
          const key = tilesetKey(tileset.name);
          if (loadedTilesets.has(key)) continue;
          loadedTilesets.add(key);
          this.load.image(key, tileset.imageUrl);
        }
        for (const placement of bundle.adventure.actorPlacements
          .filter(candidate => candidate.sectorId === roomBundle.sector.sectorId)) {
          const asset = roomBundle.actorAssets.get(placement.assetId);
          if (!asset) throw new Error(`Actor sin manifiesto: ${placement.placementId}.`);
          for (const animationName of [placement.animation]) {
            const animation = asset.animations.find(candidate => candidate.name === animationName);
            if (!animation) throw new Error(`Animación sin manifiesto: ${placement.placementId}/${animationName}.`);
            const key = actorSheetKey(asset.assetId, animation.name, animation.copyOf);
            if (loadedActorSheets.has(key)) continue;
            loadedActorSheets.add(key);
            this.load.spritesheet(key, sheetUrl(animation.animationSheetPath), {
              frameWidth: animation.frameWidth,
              frameHeight: animation.frameHeight,
            });
          }
        }
        for (const placement of bundle.adventure.characterPlacements
          .filter(candidate => candidate.sectorId === roomBundle.sector.sectorId)) {
          const asset = roomBundle.characterAssets.get(placement.assetId);
          if (!asset) throw new Error(`Personaje sin manifiesto: ${placement.placementId}.`);
          const key = characterSheetKey(asset.assetId);
          if (loadedCharacterSheets.has(key)) continue;
          loadedCharacterSheets.add(key);
          this.load.spritesheet(key, sheetUrl(asset.path), {
            frameWidth: asset.frameWidth,
            frameHeight: asset.frameHeight,
          });
        }
        const roomPlacements = new Map(bundle.adventure.actorPlacements
          .filter(candidate => candidate.sectorId === roomBundle.sector.sectorId)
          .map(placement => [placement.placementId, placement]));
        for (const action of [
          ...(bundle.adventure.companionSequences ?? []),
          ...(bundle.adventure.mapSequences ?? []),
        ]
          .filter(sequence => sequence.sectorId === roomBundle.sector.sectorId)
          .flatMap(sequence => sequence.beats)
          .flatMap(beat => beat.actions)) {
          if (action.kind !== 'playAnimation' || action.actorRef === 'dynamic:companion' || action.actorRef === 'dynamic:player') continue;
          if (!action.animation) continue;
          const placement = roomPlacements.get(action.actorRef);
          const asset = placement ? roomBundle.actorAssets.get(placement.assetId) : undefined;
          const animation = asset?.animations.find(candidate => candidate.name === action.animation);
          if (!asset || !animation) continue;
          const key = actorSheetKey(asset.assetId, animation.name, animation.copyOf);
          if (loadedActorSheets.has(key)) continue;
          loadedActorSheets.add(key);
          this.load.spritesheet(key, sheetUrl(animation.animationSheetPath), {
            frameWidth: animation.frameWidth,
            frameHeight: animation.frameHeight,
          });
        }
      }
      if (companion?.asset) {
        const animationNames = new Set(['Idle', 'Walk']);
        for (const sequence of [
          ...(bundle.adventure.companionSequences ?? []),
          ...(bundle.adventure.mapSequences ?? []),
        ]) {
          for (const action of sequence.beats.flatMap(beat => beat.actions)) {
            if (action.kind === 'playAnimation' && action.actorRef === 'dynamic:companion') {
              if (action.animation) animationNames.add(action.animation);
              Object.values(action.animationByCompanionSpecies ?? {}).forEach(name => animationNames.add(name));
            }
          }
        }
        for (const animationName of animationNames) {
          const animation = companion.asset.animations.find(candidate => candidate.name === animationName);
          if (!animation) continue;
          const key = actorSheetKey(companion.asset.assetId, animation.name, animation.copyOf);
          if (loadedActorSheets.has(key)) continue;
          loadedActorSheets.add(key);
          this.load.spritesheet(key, sheetUrl(animation.animationSheetPath), {
            frameWidth: animation.frameWidth,
            frameHeight: animation.frameHeight,
          });
        }
      }
    }

    create() {
      let pressedDirections: PressedGridDirection[] = [];
      const keyboardFacing = (event: KeyboardEvent): Facing | undefined => {
        if (event.code === 'ArrowUp' || event.code === 'KeyW') return 'up';
        if (event.code === 'ArrowDown' || event.code === 'KeyS') return 'down';
        if (event.code === 'ArrowLeft' || event.code === 'KeyA') return 'left';
        if (event.code === 'ArrowRight' || event.code === 'KeyD') return 'right';
        return undefined;
      };
      const isEditableKeyboardTarget = (event: KeyboardEvent) => (
        event.target instanceof HTMLElement
        && Boolean(event.target.closest('input, textarea, select, button, [contenteditable="true"]'))
      );
      const directionKeyDown = (event: KeyboardEvent) => {
        const facing = keyboardFacing(event);
        if (!facing || isEditableKeyboardTarget(event)) return;
        event.preventDefault();
        if (event.repeat) return;
        const facingAtPress = playerFacing;
        pressedDirections = pressGridDirection(pressedDirections, {
          code: event.code,
          facing,
          startedAt: performance.now(),
          facingAtPress,
        });
        if (!stepTarget && !transitioning && !activeInteraction && !activeExpression
          && !companionConversationActive && !activeCompanionSequence && playerFacing !== facing) {
          playerFacing = facing;
          parent.dataset.facing = facing;
          if (playerCharacterSprite && playerCharacterAsset) {
            playerCharacterSprite.stop();
            playerCharacterSprite.setFrame(
              playerCharacterAsset.directionRows[facing] * playerCharacterAsset.columns
                + playerCharacterAsset.idleFrame,
            );
          }
        }
      };
      const directionKeyUp = (event: KeyboardEvent) => {
        const facing = keyboardFacing(event);
        if (facing && !isEditableKeyboardTarget(event)) event.preventDefault();
        if (facing) pressedDirections = releaseGridDirection(pressedDirections, event.code);
      };
      this.input.keyboard?.on('keydown', directionKeyDown);
      this.input.keyboard?.on('keyup', directionKeyUp);
      let currentRoom: LoadedAdventureSectorBundle;
      let currentMap: import('phaser').Tilemaps.Tilemap | undefined;
      let player: import('phaser').GameObjects.Rectangle | import('phaser').GameObjects.Sprite;
      let playerBody: import('phaser').Physics.Arcade.Body;
      let playerCharacterSprite: import('phaser').GameObjects.Sprite | undefined;
      let playerCharacterAsset: LoadedAdventureSectorBundle['characterAssets'] extends Map<string, infer Asset> ? Asset | undefined : never;
      let playerFacing: Facing = 'up';
      let primaryActor: import('phaser').GameObjects.Sprite | undefined;
      let transitioning = false;
      let transitionCount = 0;
      let chainedStepCount = 0;
      let transitionCooldownUntil = 0;
      let stepTarget: { x: number; y: number; startX: number; startY: number; facing: Facing; swappedCompanion?: boolean } | undefined;
      let activeObjects: import('phaser').GameObjects.GameObject[] = [];
      let staticCollisionBounds: TiledCollisionShape[] = [];
      let activeActorSpritesBySpecies = new Map<number, import('phaser').GameObjects.Sprite[]>();
      let activeActorsByPlacement = new Map<string, ActiveActorState>();
      let ambientSequenceStates: AmbientSequenceState[] = [];
      let ambientSuppressed = false;
      let ambientAnimationsPaused = false;
      let ambientAccumulatorMs = 0;
      let solidActorCount = 0;
      let occludedActorCount = 0;
      let filterOccludedActorCount = 0;
      let availableInteraction: ExpeditionInteractionV3 | undefined;
      let activeInteraction: ExpeditionInteractionV3 | undefined;
      let availableExpression: ExpeditionExpressionTriggerV3 | undefined;
      let activeExpression: ExpeditionExpressionTriggerV3 | undefined;
      let companionActor: ActiveActorState | undefined;
      let companionTrail: TiledPoint[] = [];
      let companionTarget: TiledPoint | undefined;
      let availableCompanionBehaviors: CompanionBehaviorTriggerV3[] = [];
      let companionConversationActive = false;
      let activeCompanionSequence = false;
      const completedRuntimeBehaviorIds = new Set<string>();
      const occupiedProximityZones = new Set<string>();
      const completedVisitInteractionIds = new Set<string>();

      const publishVisibleSpecies = () => {
        const visibleSpeciesIds = [...new Set([...activeActorsByPlacement.values()]
          .filter(actor => actor.asset && actor.sprite.visible)
          .map(actor => actor.asset!.speciesId))];
        const undiscoveredActorCount = [...activeActorsByPlacement.values()]
          .filter(actor => actor.asset && actor.sprite.visible && !revealedSpeciesIds.has(actor.asset.speciesId)).length;
        parent.dataset.visibleSpeciesIds = JSON.stringify(visibleSpeciesIds);
        parent.dataset.undiscoveredActorCount = String(undiscoveredActorCount);
        parent.dispatchEvent(new CustomEvent(MAP_VISIBLE_SPECIES_CHANGED_EVENT, {
          detail: { speciesIds: visibleSpeciesIds },
        }));
      };

      const clearRoom = () => {
        activeObjects.forEach(object => object.destroy());
        activeObjects = [];
        staticCollisionBounds = [];
        activeActorSpritesBySpecies = new Map();
        activeActorsByPlacement = new Map();
        ambientSequenceStates = [];
        solidActorCount = 0;
        occludedActorCount = 0;
        filterOccludedActorCount = 0;
        ambientAnimationsPaused = false;
        ambientAccumulatorMs = 0;
        availableInteraction = undefined;
        activeInteraction = undefined;
        availableExpression = undefined;
        activeExpression = undefined;
        companionActor = undefined;
        companionTrail = [];
        companionTarget = undefined;
        availableCompanionBehaviors = [];
        companionConversationActive = false;
        activeCompanionSequence = false;
        pressedDirections = [];
        delete parent.dataset.interactionId;
        delete parent.dataset.interactionPrompt;
        delete parent.dataset.expressionTriggerId;
        delete parent.dataset.expressionPrompt;
        delete parent.dataset.dialogueId;
        parent.dataset.controlPriority = 'player';
        currentMap?.destroy();
        currentMap = undefined;
        primaryActor = undefined;
        playerCharacterSprite = undefined;
        playerCharacterAsset = undefined;
        stepTarget = undefined;
      };

      const actorGroundOrigin = (
        animation: { frameCount: number; groundOrigins: Array<{ x: number; y: number }> },
        frame: number,
      ) => animation.groundOrigins[Math.floor(frame / animation.frameCount)] ?? { x: .5, y: 1 };

      const groundPoint = (bounds: ReturnType<typeof tiledObjectBounds>) => ({
        x: bounds.centerX,
        y: bounds.height > 0 ? bounds.y + bounds.height : bounds.y,
      });

      const snapGroundPoint = (x: number, y: number) => ({
        x: Math.round((x - 8) / 16) * 16 + 8,
        y: Math.round(y / 16) * 16,
      });

      const applySpawnOffset = (x: number, y: number, facing?: Facing) => {
        if (facing === 'right') return { x: x + 16, y };
        if (facing === 'left') return { x: x - 16, y };
        if (facing === 'down') return { x, y: y + 16 };
        if (facing === 'up') return { x, y: y - 16 };
        return { x, y };
      };

      const ensureCharacterAnimation = (
        asset: NonNullable<typeof playerCharacterAsset>,
        facing: Facing,
      ) => {
        const key = characterAnimationKey(asset.assetId, facing);
        if (!this.anims.exists(key)) this.anims.create({
          key,
          frames: asset.walkFrames.map(column => ({
            key: characterSheetKey(asset.assetId),
            frame: asset.directionRows[facing] * asset.columns + column,
            duration: asset.frameDurationMs,
          })),
          repeat: -1,
        });
        return key;
      };

      const layerObjects = (room: LoadedAdventureSectorBundle, layerName: string) => {
        const layer = room.tilemap.layers.find(candidate => candidate.name === layerName);
        return Array.isArray(layer?.objects) ? layer.objects as Array<Record<string, unknown>> : [];
      };

      const ambientPathPoints = (room: LoadedAdventureSectorBundle, pathId: string) => {
        const path = layerObjects(room, 'Paths').find(object => object.name === pathId);
        const polyline = Array.isArray(path?.polyline) ? path.polyline as Array<Record<string, unknown>> : [];
        return polyline.map((point, index) => transformTiledObjectPoint(path ?? {}, {
          x: requiredNumber(point, 'x', `${pathId}[${index}]`),
          y: requiredNumber(point, 'y', `${pathId}[${index}]`),
        }));
      };

      const setActorFacing = (state: ActiveActorState, direction: Facing) => {
        state.direction = direction;
        if (state.characterAsset) {
          state.sprite.stop();
          state.sprite.setFrame(
            state.characterAsset.directionRows[direction] * state.characterAsset.columns
              + state.characterAsset.idleFrame,
          );
        }
      };

      const startActorAnimation = (
        state: ActiveActorState,
        animationName: string,
        direction: Facing,
        repetitions: number,
      ) => {
        if (!state.asset) {
          setActorFacing(state, direction);
          return 0;
        }
        const animation = state.asset.animations.find(candidate => candidate.name === animationName);
        if (!animation) return 0;
        const row = DIRECTION_ROWS[direction];
        const frames = Array.from({ length: animation.frameCount }, (_, index) => row * animation.frameCount + index);
        const origin = actorGroundOrigin(animation, frames[0]);
        const animationKey = `ambient-animation:${state.placementId}:${animationName}:${direction}:${repetitions}`;
        if (!this.anims.exists(animationKey)) this.anims.create({
          key: animationKey,
          frames: frames.map((frame, index) => ({
            key: actorSheetKey(state.asset!.assetId, animation.name, animation.copyOf),
            frame,
            duration: animation.durationTicks[index] * (1000 / bundle.pmdManifest.tickRate),
          })),
          repeat: repetitions < 0 ? -1 : Math.max(0, repetitions - 1),
        });
        state.direction = direction;
        state.currentAnimation = animationName;
        if (state.placementId === 'dynamic:companion') parent.dataset.lastCompanionAnimation = animationName;
        state.sprite.stop();
        state.sprite.setTexture(actorSheetKey(state.asset.assetId, animation.name, animation.copyOf), frames[0]);
        state.sprite.setOrigin(origin.x, origin.y).setScale(effectiveAdventureActorScale(
          state.asset.renderScale,
          state.renderScaleMultiplier,
        ));
        state.cropHeight = undefined;
        updateActorCropOcclusion(state);
        if (!reducedMotion) state.sprite.play(animationKey);
        const oneCycleMs = animation.durationTicks.reduce((total, ticks) => total + ticks, 0)
          * (1000 / bundle.pmdManifest.tickRate);
        return repetitions < 0 ? Number.POSITIVE_INFINITY : oneCycleMs * repetitions;
      };

      const createCompanionActor = (spawn: TiledPoint, playerFacingAtSpawn: Facing) => {
        if (!companion) return undefined;
        const direction: Facing = playerFacingAtSpawn;
        let sprite: import('phaser').GameObjects.Sprite;
        if (companion.asset) {
          const animation = companion.asset.animations.find(candidate => candidate.name === 'Idle')
            ?? companion.asset.animations[0];
          if (!animation) return undefined;
          const row = DIRECTION_ROWS[direction];
          const frame = row * animation.frameCount;
          const origin = actorGroundOrigin(animation, frame);
          sprite = this.add.sprite(
            spawn.x,
            spawn.y,
            actorSheetKey(companion.asset.assetId, animation.name, animation.copyOf),
            frame,
          ).setOrigin(origin.x, origin.y).setScale(companion.asset.renderScale ?? 1).setDepth(spawn.y);
        } else {
          const textureKey = 'technical-companion-placeholder';
          if (!this.textures.exists(textureKey)) {
            const graphic = this.make.graphics({ x: 0, y: 0 });
            graphic.fillStyle(0xf4f4f4).fillCircle(8, 8, 7);
            graphic.fillStyle(0xe83b2e).fillRect(2, 2, 12, 6);
            graphic.fillStyle(0x20252b).fillRect(1, 7, 14, 3);
            graphic.fillStyle(0xffffff).fillCircle(8, 8, 3);
            graphic.lineStyle(1, 0x20252b).strokeCircle(8, 8, 3);
            graphic.generateTexture(textureKey, 16, 16);
            graphic.destroy();
          }
          sprite = this.add.sprite(spawn.x, spawn.y, textureKey).setOrigin(.5, 1).setDepth(spawn.y);
        }
        sprite.setName('dynamic:companion');
        activeObjects.push(sprite);
        const state: ActiveActorState = {
          placementId: 'dynamic:companion',
          sprite,
          collision: 'pass-through',
          direction,
          baseX: spawn.x,
          baseY: spawn.y,
          baseDirection: direction,
          baseAnimation: 'Idle',
          currentAnimation: 'Idle',
          renderScaleMultiplier: 1,
          asset: companion.asset,
        };
        if (state.asset) startActorAnimation(state, 'Idle', direction, -1);
        return state;
      };

      const applyActorOcclusion = (room: LoadedAdventureSectorBundle, state: ActiveActorState, groupIds: readonly string[]) => {
        if (!groupIds.length) return;
        const occluders = layerObjects(room, 'Occlusion').filter(object => {
          const properties = tiledProperties(object);
          const groupId = String(properties.get('occlusionGroup') ?? '');
          const included = stableIdList(properties.get('includePlacementIds'));
          const excluded = stableIdList(properties.get('excludePlacementIds'));
          return !excluded.includes(state.placementId)
            && (included.includes(state.placementId) || groupIds.includes(groupId));
        });
        if (!occluders.length) return;
        const rectangularOccluders = occluders.filter(occluder => (
          !Array.isArray(occluder.polygon) && !(Number(occluder.rotation) || 0)
        ));
        state.cropOccluders = rectangularOccluders.map(occluder => ({
          x: requiredNumber(occluder, 'x', String(occluder.name)),
          y: requiredNumber(occluder, 'y', String(occluder.name)),
          width: requiredNumber(occluder, 'width', String(occluder.name)),
          height: requiredNumber(occluder, 'height', String(occluder.name)),
        }));
        const polygonOccluders = occluders.filter(occluder => (
          Array.isArray(occluder.polygon) || Boolean(Number(occluder.rotation) || 0)
        ));
        if (!polygonOccluders.length) {
          occludedActorCount += 1;
          return;
        }
        const graphics = this.add.graphics();
        graphics.fillStyle(0xffffff, 1);
        for (const occluder of polygonOccluders) {
          if (Array.isArray(occluder.polygon)) {
            const points = (occluder.polygon as Array<Record<string, unknown>>).map((point, index) => {
              const transformed = transformTiledObjectPoint(occluder, {
                x: requiredNumber(point, 'x', `${String(occluder.name)}[${index}]`),
                y: requiredNumber(point, 'y', `${String(occluder.name)}[${index}]`),
              });
              return new Phaser.Math.Vector2(transformed.x, transformed.y);
            });
            graphics.fillPoints(points, true);
          } else {
            graphics.fillPoints(
              tiledObjectRectanglePoints(occluder)
                .map(point => new Phaser.Math.Vector2(point.x, point.y)),
              true,
            );
          }
        }
        this.children.remove(graphics);
        state.sprite.enableFilters();
        state.sprite.filters!.external.addMask(graphics, true);
        activeObjects.push(graphics);
        occludedActorCount += 1;
        filterOccludedActorCount += 1;
      };

      const updateActorCropOcclusion = (state: ActiveActorState) => {
        if (!state.cropOccluders?.length) return;
        const scaleX = Math.abs(state.sprite.scaleX) || 1;
        const scaleY = Math.abs(state.sprite.scaleY) || 1;
        const frameWidth = state.sprite.frame.realWidth;
        const frameHeight = state.sprite.frame.realHeight;
        const left = state.sprite.x - state.sprite.displayOriginX * scaleX;
        const right = left + frameWidth * scaleX;
        const top = state.sprite.y - state.sprite.displayOriginY * scaleY;
        const bottom = top + frameHeight * scaleY;
        const waterline = state.cropOccluders
          .filter(occluder => occluder.x < right && occluder.x + occluder.width > left
            && occluder.y > top && occluder.y < bottom)
          .reduce<number | undefined>((nearest, occluder) => (
            nearest === undefined ? occluder.y : Math.min(nearest, occluder.y)
          ), undefined);
        const nextHeight = waterline === undefined
          ? frameHeight
          : Math.max(0, Math.min(frameHeight, (waterline - top) / scaleY));
        if (Math.abs((state.cropHeight ?? -1) - nextHeight) < .01) return;
        state.cropHeight = nextHeight;
        if (nextHeight >= frameHeight) state.sprite.setCrop();
        else state.sprite.setCrop(0, 0, frameWidth, nextHeight);
      };

      const renderRoom = (sectorId: string, spawnAnchorId?: string, facing?: Facing) => {
        const nextRoom = bundle.sectors.find(candidate => candidate.sector.sectorId === sectorId);
        if (!nextRoom) throw new Error(`Sector no cargada: ${sectorId}.`);
        clearRoom();
        currentRoom = nextRoom;
        currentMap = this.make.tilemap({ key: mapKey(sectorId) });
        const phaserTilesets = nextRoom.tilesets.map(tileset => {
          const value = currentMap?.addTilesetImage(tileset.name, tilesetKey(tileset.name));
          if (!value) throw new Error(`Phaser no pudo enlazar el tileset ${tileset.name}.`);
          return value;
        });
        currentMap.createLayer('Ground', phaserTilesets, 0, 0)?.setDepth(0);
        currentMap.createLayer('Above', phaserTilesets, 0, 0)?.setDepth(10_000);

        const placements = bundle.adventure.actorPlacements.filter(candidate => candidate.sectorId === sectorId);
        for (const placement of placements) {
          const asset = nextRoom.actorAssets.get(placement.assetId);
          const animation = asset?.animations.find(candidate => candidate.name === placement.animation);
          const anchor = findTiledObject(nextRoom.tilemap, 'Anchors', placement.anchorId);
          if (!asset || !animation || !anchor) throw new Error(`Actor incompleto: ${placement.placementId}.`);
          const row = DIRECTION_ROWS[placement.direction ?? 'down'];
          const frames = Array.from({ length: animation.frameCount }, (_, index) => row * animation.frameCount + index);
          const sheetKey = actorSheetKey(asset.assetId, animation.name, animation.copyOf);
          const anchorBounds = tiledObjectBounds(anchor, placement.anchorId);
          const anchorPoint = groundPoint(anchorBounds);
          const origin = actorGroundOrigin(animation, frames[0]);
          const sprite = this.add.sprite(
            anchorPoint.x,
            anchorPoint.y,
            sheetKey,
            frames[0],
          ).setOrigin(origin.x, origin.y)
            .setScale(effectiveAdventureActorScale(asset.renderScale, placement.renderScaleMultiplier))
            .setDepth(anchorPoint.y)
            .setVisible(placement.initiallyHidden !== true);
          if (!revealedSpeciesIds.has(asset.speciesId)) {
            sprite.setTint(0x000000);
            sprite.setTintMode(Phaser.TintModes.FILL);
          }
          const speciesSprites = activeActorSpritesBySpecies.get(asset.speciesId) ?? [];
          speciesSprites.push(sprite);
          activeActorSpritesBySpecies.set(asset.speciesId, speciesSprites);
          sprite.setName(placement.placementId);
          activeObjects.push(sprite);
          const actorState: ActiveActorState = {
            placementId: placement.placementId,
            sprite,
            collision: placement.collision ?? 'solid',
            direction: placement.direction ?? 'down',
            baseX: anchorPoint.x,
            baseY: anchorPoint.y,
            baseDirection: placement.direction ?? 'down',
            baseAnimation: placement.animation,
            currentAnimation: placement.animation,
            renderScaleMultiplier: placement.renderScaleMultiplier ?? 1,
            asset,
          };
          activeActorsByPlacement.set(placement.placementId, actorState);
          applyActorOcclusion(nextRoom, actorState, placement.occlusionGroupIds ?? []);
          updateActorCropOcclusion(actorState);
          if (actorState.collision === 'solid') solidActorCount += 1;
          primaryActor ??= sprite;
          if (!reducedMotion) {
            const animationKey = `animation:${placement.placementId}:${animation.name}`;
            if (!this.anims.exists(animationKey)) this.anims.create({
              key: animationKey,
              frames: frames.map((frame, index) => ({
                key: sheetKey,
                frame,
                duration: animation.durationTicks[index] * (1000 / bundle.pmdManifest.tickRate),
              })),
              repeat: -1,
            });
            sprite.play(animationKey);
          }
        }
        publishVisibleSpecies();

        const characterPlacements = bundle.adventure.characterPlacements
          .filter(candidate => candidate.sectorId === sectorId);
        for (const placement of characterPlacements.filter(candidate => !candidate.controllable)) {
          const asset = nextRoom.characterAssets.get(placement.assetId);
          const anchor = findTiledObject(nextRoom.tilemap, 'Anchors', placement.anchorId);
          if (!asset || !anchor) throw new Error(`Personaje incompleto: ${placement.placementId}.`);
          const bounds = tiledObjectBounds(anchor, placement.anchorId);
          const anchorPoint = groundPoint(bounds);
          const direction = placement.direction ?? 'down';
          const sprite = this.add.sprite(
            anchorPoint.x,
            anchorPoint.y,
            characterSheetKey(asset.assetId),
            asset.directionRows[direction] * asset.columns + asset.idleFrame,
          ).setOrigin(.5, 1)
            .setScale(effectiveAdventureActorScale(asset.renderScale, placement.renderScaleMultiplier))
            .setDepth(anchorPoint.y)
            .setVisible(placement.initiallyHidden !== true);
          sprite.setName(placement.placementId);
          activeObjects.push(sprite);
          const actorState: ActiveActorState = {
            placementId: placement.placementId,
            sprite,
            collision: placement.collision ?? 'solid',
            direction,
            baseX: anchorPoint.x,
            baseY: anchorPoint.y,
            baseDirection: direction,
            renderScaleMultiplier: placement.renderScaleMultiplier ?? 1,
            characterAsset: asset,
          };
          activeActorsByPlacement.set(placement.placementId, actorState);
          applyActorOcclusion(nextRoom, actorState, placement.occlusionGroupIds ?? []);
          updateActorCropOcclusion(actorState);
          if (actorState.collision === 'solid') solidActorCount += 1;
        }

        const resolvedSpawnId = spawnAnchorId ?? nextRoom.sector.spawnAnchorIds[0];
        const playerAnchor = findTiledObject(nextRoom.tilemap, 'Anchors', resolvedSpawnId);
        const playerAnchorBounds = tiledObjectBounds(playerAnchor, resolvedSpawnId);
        const playerGroundPoint = groundPoint(playerAnchorBounds);
        const spawnOffset = applySpawnOffset(
          playerGroundPoint.x,
          playerGroundPoint.y,
          facing,
        );
        const spawn = snapGroundPoint(spawnOffset.x, spawnOffset.y);
        const controllable = characterPlacements.find(candidate => candidate.controllable);
        const controllableAsset = controllable ? nextRoom.characterAssets.get(controllable.assetId) : undefined;
        playerFacing = facing ?? controllable?.direction ?? 'up';
        if (controllable && controllableAsset) {
          playerCharacterAsset = controllableAsset;
          playerCharacterSprite = this.add.sprite(
            spawn.x,
            spawn.y,
            characterSheetKey(controllableAsset.assetId),
            controllableAsset.directionRows[playerFacing] * controllableAsset.columns + controllableAsset.idleFrame,
          ).setOrigin(.5, 1)
            .setScale(effectiveAdventureActorScale(controllableAsset.renderScale, controllable.renderScaleMultiplier))
            .setDepth(spawn.y);
          player = playerCharacterSprite;
        } else {
          player = this.add.rectangle(spawn.x, spawn.y, 10, 12, 0xffd54f)
            .setStrokeStyle(2, 0x183d2e).setDepth(spawn.y);
        }
        activeObjects.push(player);
        this.physics.add.existing(player);
        playerBody = player.body as import('phaser').Physics.Arcade.Body;
        if (playerCharacterAsset) {
          playerBody.setSize(10, 12).setOffset(
            (playerCharacterAsset.frameWidth - 10) / 2,
            playerCharacterAsset.frameHeight - 12,
          );
        }
        playerBody.setCollideWorldBounds(true);

        const collisionLayer = nextRoom.tilemap.layers.find(layer => layer.name === 'Collision');
        const collisions = Array.isArray(collisionLayer?.objects)
          ? collisionLayer.objects as Array<Record<string, unknown>>
          : [];
        for (const collision of collisions) {
          const collisionShape = readTiledCollisionShape(collision);
          if (collisionShape) staticCollisionBounds.push(collisionShape);
        }
        if (companion) {
          const behindFacing: Facing = playerFacing === 'up' ? 'down'
            : playerFacing === 'down' ? 'up'
              : playerFacing === 'left' ? 'right'
                : 'left';
          const roomWidth = nextRoom.tilemap.width * nextRoom.tilemap.tilewidth;
          const roomHeight = nextRoom.tilemap.height * nextRoom.tilemap.tileheight;
          const directions = [behindFacing, 'left', 'right', 'up', 'down'] as Facing[];
          const companionSpawn = directions
            .map(direction => gridStep({ x: player.x, y: player.y }, direction))
            .find(point => point.x >= 8 && point.x <= roomWidth - 8 && point.y >= 16 && point.y <= roomHeight - 16
              && !staticCollisionBounds.some(collision => rectangleOverlapsCollision(actorFootprint(point.x, point.y), collision))
              && ![...activeActorsByPlacement.values()].some(actor => actor.sprite.visible
                && actor.collision === 'solid' && overlap(actorFootprint(point.x, point.y), actorFootprint(actor.sprite.x, actor.sprite.y))))
            ?? { x: player.x, y: player.y };
          companionActor = createCompanionActor(companionSpawn, playerFacing);
          parent.dataset.companionAssetId = companion.asset?.assetId ?? 'placeholder:pokeball';
          parent.dataset.companionFormId = companion.form.formId;
          parent.dataset.companionPosition = `${companionSpawn.x},${companionSpawn.y}`;
        } else {
          delete parent.dataset.companionAssetId;
          delete parent.dataset.companionFormId;
          delete parent.dataset.companionPosition;
        }
        const mapWidth = nextRoom.tilemap.width * nextRoom.tilemap.tilewidth;
        const mapHeight = nextRoom.tilemap.height * nextRoom.tilemap.tileheight;
        this.physics.world.setBounds(0, 0, mapWidth, mapHeight);
        this.cameras.main.setBounds(0, 0, mapWidth, mapHeight);
        this.cameras.main.setRoundPixels(true);
        ambientSequenceStates = [];
        parent.dataset.mapId = bundle.adventure.mapId;
        parent.dataset.sectorId = sectorId;
        parent.dataset.actorId = placements[0]?.placementId ?? '';
        parent.dataset.actorGrounding = 'pmd-shadow';
        parent.dataset.solidActorCount = String(solidActorCount);
        parent.dataset.occludedActorCount = String(occludedActorCount);
        parent.dataset.occlusionFilterCount = String(filterOccludedActorCount);
        parent.dataset.ambientTickRate = '30';
        publishVisibleSpecies();
        parent.dataset.playerAssetId = playerCharacterAsset?.assetId ?? 'technical-marker';
        parent.dataset.movement = 'grid';
        parent.dataset.movementInputs = EXPEDITION_MOVEMENT_INPUTS.join(',');
        parent.dataset.step = 'idle';
        parent.dataset.animation = primaryActor ? (reducedMotion ? 'paused' : 'playing') : 'none';
        parent.dataset.actorFrameChanges = '0';
        parent.dataset.transition = 'idle';
        parent.dataset.ambientSequenceCount = '0';
        parent.dataset.ambientState = reducedMotion ? 'reduced-motion' : 'loading';
        parent.dataset.ambientAssets = reducedMotion ? 'skipped' : 'loading';
        parent.dataset.ambientCycle = '0';
        transitionCooldownUntil = this.time.now + 350;
        chainedStepCount = 0;
        parent.dataset.chainedStepCount = '0';
        queueRoomAmbientAssets(nextRoom, placements);
      };

      const syncAmbientActorTelemetry = () => {
        const placementIds = new Set(ambientSequenceStates
          .flatMap(sequence => sequence.definition.beats)
          .flatMap(beat => beat.actions.map(action => action.placementId)));
        parent.dataset.ambientActors = JSON.stringify([...placementIds].map(placementId => {
          const actor = activeActorsByPlacement.get(placementId);
          return actor ? {
            placementId,
            x: Math.round(actor.sprite.x * 100) / 100,
            y: Math.round(actor.sprite.y * 100) / 100,
            direction: actor.direction,
            animation: actor.currentAnimation ?? actor.baseAnimation ?? null,
            cropHeight: actor.cropHeight ?? null,
            frameHeight: actor.sprite.frame.realHeight,
          } : { placementId, missing: true };
        }));
      };

      const movingOutward = (anchor: Record<string, unknown>, facing?: Facing) => {
        const bounds = tiledObjectBounds(anchor, String(anchor.name));
        const width = currentRoom.tilemap.width * currentRoom.tilemap.tilewidth;
        const height = currentRoom.tilemap.height * currentRoom.tilemap.tileheight;
        if (bounds.centerX <= currentRoom.tilemap.tilewidth) return facing === 'left';
        if (bounds.centerX >= width - currentRoom.tilemap.tilewidth) return facing === 'right';
        if (bounds.centerY <= currentRoom.tilemap.tileheight) return facing === 'up';
        if (bounds.centerY >= height - currentRoom.tilemap.tileheight) return facing === 'down';
        return false;
      };

      const canOccupyGroundPoint = (x: number, y: number) => {
        const mapWidth = currentRoom.tilemap.width * currentRoom.tilemap.tilewidth;
        const mapHeight = currentRoom.tilemap.height * currentRoom.tilemap.tileheight;
        const footprint = { x: x - 5, y: y - 10, width: 10, height: 10 };
        if (footprint.x < 0 || footprint.x + footprint.width > mapWidth
          || footprint.y < 0 || footprint.y + footprint.height > mapHeight) {
          return false;
        }
        if (staticCollisionBounds.some(collision => rectangleOverlapsCollision(footprint, collision))) return false;
        return ![...activeActorsByPlacement.values()].some(actor => (
          actor.sprite.visible && actor.collision === 'solid' && overlap(footprint, actorFootprint(actor.sprite.x, actor.sprite.y))
        ));
      };

      const actorOccupiesCompanionTarget = (x: number, y: number) => [...activeActorsByPlacement.values()]
        .some(actor => actor.sprite.visible && actor.collision === 'solid' && overlap(actorFootprint(x, y), actorFootprint(actor.sprite.x, actor.sprite.y)))
        || overlap(actorFootprint(x, y), { x: player.x - 5, y: player.y - 10, width: 10, height: 10 });

      const setCompanionMoving = (moving: boolean, direction?: Facing) => {
        if (!companionActor) return;
        const resolvedDirection = direction ?? companionActor.direction;
        const changedDirection = resolvedDirection !== companionActor.direction;
        companionActor.direction = resolvedDirection;
        if (!companionActor.asset) return;
        const animation = moving ? 'Walk' : 'Idle';
        if (!changedDirection && companionActor.currentAnimation === animation && companionActor.sprite.anims.isPlaying) return;
        startActorAnimation(companionActor, animation, resolvedDirection, -1);
      };

      const updateCompanionFollower = (deltaMs: number) => {
        if (!companionActor || companionConversationActive) return;
        if (!companionTarget && companionTrail.length) companionTarget = companionTrail.shift();
        if (!companionTarget) {
          setCompanionMoving(false);
          return;
        }
        if (actorOccupiesCompanionTarget(companionTarget.x, companionTarget.y)) {
          setCompanionMoving(false);
          return;
        }
        const dx = companionTarget.x - companionActor.sprite.x;
        const dy = companionTarget.y - companionActor.sprite.y;
        const distance = Math.hypot(dx, dy);
        const direction = facingFromDelta(dx, dy, companionActor.direction);
        const travel = 96 * deltaMs / 1000;
        if (distance <= Math.max(.001, travel)) {
          companionActor.sprite.setPosition(companionTarget.x, companionTarget.y).setDepth(companionTarget.y);
          companionTarget = undefined;
          if (!companionTrail.length) setCompanionMoving(false);
        } else {
          setCompanionMoving(true, direction);
          companionActor.sprite.setPosition(
            companionActor.sprite.x + dx / distance * travel,
            companionActor.sprite.y + dy / distance * travel,
          ).setDepth(companionActor.sprite.y + dy / distance * travel);
        }
        parent.dataset.companionPosition = `${Math.round(companionActor.sprite.x)},${Math.round(companionActor.sprite.y)}`;
      };

      const facingForDelta = (dx: number, dy: number, fallback: Facing): Facing => {
        if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
        if (Math.abs(dy) > 0) return dy > 0 ? 'down' : 'up';
        return fallback;
      };

      const ambientPlacementIds = () => new Set(ambientSequenceStates
        .flatMap(sequence => sequence.definition.beats)
        .flatMap(beat => beat.actions.map(action => action.placementId)));

      const setAmbientAnimationsPaused = (paused: boolean) => {
        if (ambientAnimationsPaused === paused) return;
        ambientAnimationsPaused = paused;
        for (const placementId of ambientPlacementIds()) {
          const actor = activeActorsByPlacement.get(placementId);
          if (!actor?.sprite.anims.isPlaying) continue;
          if (paused) actor.sprite.anims.pause();
          else actor.sprite.anims.resume();
        }
      };

      const startAmbientBeat = (sequence: AmbientSequenceState) => {
        const sourceBeat = sequence.definition.beats[sequence.beatIndex];
        const beat = sequence.forward ? sourceBeat : {
          ...sourceBeat,
          actions: sourceBeat.actions.map(action => action.kind === 'movePath'
            ? { ...action, reverse: !action.reverse }
            : action.kind === 'moveByTiles'
              ? { ...action, deltaXTiles: -action.deltaXTiles, deltaYTiles: -action.deltaYTiles }
              : action),
        };
        parent.dataset.ambientBeatId = beat.beatId;
        sequence.actionStates = beat.actions.map(action => {
          const actor = activeActorsByPlacement.get(action.placementId);
          if (!actor) return { action, complete: true };
          if (action.kind === 'face') {
            setActorFacing(actor, action.direction);
            return { action, complete: true };
          }
          if (action.kind === 'setVisible') {
            actor.sprite.setVisible(action.visible);
            return { action, complete: true };
          }
          if (action.kind === 'playAnimation') {
            const repetitions = action.repetitions ?? 1;
            const remainingMs = startActorAnimation(
              actor,
              action.animation,
              action.direction ?? actor.direction,
              repetitions,
            );
            return { action, remainingMs, complete: remainingMs <= 0 };
          }
          const rawPoints = action.kind === 'moveByTiles'
            ? [{ x: actor.sprite.x, y: actor.sprite.y }, { x: actor.sprite.x + action.deltaXTiles * 16, y: actor.sprite.y + action.deltaYTiles * 16 }]
            : ambientPathPoints(currentRoom, action.pathId);
          const orderedPoints = action.kind === 'movePath' && action.reverse ? [...rawPoints].reverse() : rawPoints;
          const first = orderedPoints[0];
          const points = first && Math.hypot(actor.sprite.x - first.x, actor.sprite.y - first.y) > .5
            ? [{ x: actor.sprite.x, y: actor.sprite.y }, ...orderedPoints]
            : orderedPoints;
          const next = points[1] ?? points[0];
          const direction = next
            ? facingForDelta(next.x - actor.sprite.x, next.y - actor.sprite.y, actor.direction)
            : actor.direction;
          if (action.animation) startActorAnimation(actor, action.animation, direction, -1);
          else if (actor.characterAsset && !reducedMotion) {
            actor.sprite.play(ensureCharacterAnimation(actor.characterAsset, direction), true);
          }
          actor.direction = direction;
          return { action, points, pointIndex: 1, complete: points.length < 2 };
        });
        sequence.phase = sequence.actionStates.every(action => action.complete) ? 'pause' : 'actions';
        syncAmbientActorTelemetry();
      };

      const proposedMove = (state: AmbientActionState, actor: ActiveActorState, deltaMs: number) => {
        if ((state.action.kind !== 'movePath' && state.action.kind !== 'moveByTiles') || !state.points || state.complete) return undefined;
        const target = state.points[state.pointIndex ?? 1];
        if (!target) return { x: actor.sprite.x, y: actor.sprite.y, complete: true, pointIndex: state.pointIndex ?? 1 };
        const dx = target.x - actor.sprite.x;
        const dy = target.y - actor.sprite.y;
        const distance = Math.hypot(dx, dy);
        const travel = state.action.speedPixelsPerSecond * (deltaMs / 1000);
        if (distance <= Math.max(.001, travel)) {
          const nextIndex = (state.pointIndex ?? 1) + 1;
          return { x: target.x, y: target.y, complete: nextIndex >= state.points.length, pointIndex: nextIndex };
        }
        return {
          x: actor.sprite.x + dx / distance * travel,
          y: actor.sprite.y + dy / distance * travel,
          complete: false,
          pointIndex: state.pointIndex ?? 1,
        };
      };

      const canAmbientActorOccupy = (
        actor: ActiveActorState,
        x: number,
        y: number,
        proposals: Map<string, { x: number; y: number }>,
      ) => {
        const mapWidth = currentRoom.tilemap.width * currentRoom.tilemap.tilewidth;
        const mapHeight = currentRoom.tilemap.height * currentRoom.tilemap.tileheight;
        const footprint = actorFootprint(x, y);
        if (footprint.x < 0 || footprint.y < 0
          || footprint.x + footprint.width > mapWidth || footprint.y + footprint.height > mapHeight) return false;
        if (actor.collision === 'pass-through') return true;
        if (staticCollisionBounds.some(collision => rectangleOverlapsCollision(footprint, collision))) return false;
        if (overlap(footprint, { x: player.x - 5, y: player.y - 10, width: 10, height: 10 })) return false;
        return ![...activeActorsByPlacement.values()].some(other => {
          if (other.placementId === actor.placementId || other.collision === 'pass-through') return false;
          const proposed = proposals.get(other.placementId);
          return overlap(footprint, actorFootprint(proposed?.x ?? other.sprite.x, proposed?.y ?? other.sprite.y));
        });
      };

      const updateAmbientSequence = (sequence: AmbientSequenceState, deltaMs: number) => {
        if (sequence.phase === 'complete') return;
        if (sequence.phase === 'pause') {
          sequence.pauseRemainingMs = Math.max(0, sequence.pauseRemainingMs - deltaMs);
          if (sequence.pauseRemainingMs === 0) sequence.phase = 'start';
          return;
        }
        if (sequence.phase === 'start') startAmbientBeat(sequence);
        if (sequence.phase !== 'actions') return;

        const proposals = new Map<string, { x: number; y: number; complete: boolean; pointIndex: number }>();
        for (const actionState of sequence.actionStates) {
          if ((actionState.action.kind !== 'movePath' && actionState.action.kind !== 'moveByTiles') || actionState.complete) continue;
          const actor = activeActorsByPlacement.get(actionState.action.placementId);
          if (!actor) continue;
          const proposal = proposedMove(actionState, actor, deltaMs);
          if (proposal) proposals.set(actor.placementId, proposal);
        }
        const blocked = [...proposals].some(([placementId, proposal]) => {
          const actor = activeActorsByPlacement.get(placementId);
          return actor ? !canAmbientActorOccupy(actor, proposal.x, proposal.y, proposals) : false;
        });
        if (blocked) {
          parent.dataset.ambientState = 'blocked';
          setAmbientAnimationsPaused(true);
          return;
        }
        setAmbientAnimationsPaused(false);
        parent.dataset.ambientState = 'running';
        for (const actionState of sequence.actionStates) {
          const actor = activeActorsByPlacement.get(actionState.action.placementId);
          if (!actor || actionState.complete) continue;
          if (actionState.action.kind === 'playAnimation') {
            actionState.remainingMs = Math.max(0, (actionState.remainingMs ?? 0) - deltaMs);
            actionState.complete = actionState.remainingMs === 0;
          } else if (actionState.action.kind === 'movePath' || actionState.action.kind === 'moveByTiles') {
            const proposal = proposals.get(actor.placementId);
            if (!proposal) continue;
            actor.sprite.setPosition(proposal.x, proposal.y).setDepth(proposal.y);
            updateActorCropOcclusion(actor);
            actionState.pointIndex = proposal.pointIndex;
            actionState.complete = proposal.complete;
            const next = actionState.points?.[proposal.pointIndex];
            if (next) {
              const direction = facingForDelta(next.x - proposal.x, next.y - proposal.y, actor.direction);
              if (direction !== actor.direction) {
                actor.direction = direction;
                if (actor.characterAsset && !reducedMotion) {
                  actor.sprite.play(ensureCharacterAnimation(actor.characterAsset, direction), true);
                }
              }
            }
            if (actionState.complete && actor.characterAsset) setActorFacing(actor, actor.direction);
          }
        }

        if (!sequence.actionStates.every(action => action.complete)) return;
        const beat = sequence.definition.beats[sequence.beatIndex];
        const playbackMode = sequence.definition.playbackMode ?? (sequence.definition.loop ? 'loop' : 'once');
        const edgeBeat = sequence.forward
          ? sequence.beatIndex >= sequence.definition.beats.length - 1
          : sequence.beatIndex <= 0;
        if (edgeBeat) {
          if (playbackMode === 'once') {
            sequence.phase = 'complete';
            return;
          }
          if (playbackMode === 'pingPong') {
            sequence.forward = !sequence.forward;
            sequence.beatIndex = sequence.forward ? 0 : sequence.definition.beats.length - 1;
          } else sequence.beatIndex = 0;
          sequence.cycles += 1;
          parent.dataset.ambientCycle = String(sequence.cycles);
          sequence.pauseRemainingMs = sampleMilliseconds(beat.pauseAfterMs)
            + sampleMilliseconds(sequence.definition.loopPauseMs);
        } else {
          sequence.beatIndex += sequence.forward ? 1 : -1;
          sequence.pauseRemainingMs = sampleMilliseconds(beat.pauseAfterMs);
        }
        sequence.phase = sequence.pauseRemainingMs > 0 ? 'pause' : 'start';
      };

      const activateRoomAmbientSequences = (sectorId: string) => {
        if (currentRoom.sector.sectorId !== sectorId || reducedMotion) return;
        ambientSequenceStates = bundle.adventure.ambientSequences
          .filter(sequence => sequence.sectorId === sectorId)
          .map(definition => ({
            definition,
            beatIndex: 0,
            actionStates: [],
            pauseRemainingMs: 0,
            phase: 'start' as const,
            cycles: 0,
            forward: true,
          }));
        parent.dataset.ambientAssets = 'ready';
        parent.dataset.ambientSequenceCount = String(ambientSequenceStates.length);
        parent.dataset.ambientState = ambientSuppressed
          ? 'suppressed'
          : ambientSequenceStates.length ? 'running' : 'none';
        syncAmbientActorTelemetry();
      };

      const queueRoomAmbientAssets = (
        room: LoadedAdventureSectorBundle,
        placements: LoadedAdventureMapBundle['adventure']['actorPlacements'],
      ) => {
        if (reducedMotion) return;
        const definitions = bundle.adventure.ambientSequences
          .filter(sequence => sequence.sectorId === room.sector.sectorId);
        const placementsById = new Map(placements.map(placement => [placement.placementId, placement]));
        const pending = new Map<string, {
          url: string;
          frameWidth: number;
          frameHeight: number;
        }>();
        for (const action of definitions.flatMap(sequence => sequence.beats).flatMap(beat => beat.actions)) {
          if (action.kind !== 'playAnimation' && action.kind !== 'movePath' && action.kind !== 'moveByTiles') continue;
          if (!action.animation) continue;
          const placement = placementsById.get(action.placementId);
          const asset = placement ? room.actorAssets.get(placement.assetId) : undefined;
          const animation = asset?.animations.find(candidate => candidate.name === action.animation);
          if (!asset || !animation) continue;
          const key = actorSheetKey(asset.assetId, animation.name, animation.copyOf);
          if (this.textures.exists(key) || pending.has(key)) continue;
          pending.set(key, {
            url: sheetUrl(animation.animationSheetPath),
            frameWidth: animation.frameWidth,
            frameHeight: animation.frameHeight,
          });
        }
        parent.dataset.ambientTextureCount = String(pending.size);
        if (!pending.size) {
          activateRoomAmbientSequences(room.sector.sectorId);
          return;
        }
        for (const [key, file] of pending) {
          this.load.spritesheet(key, file.url, {
            frameWidth: file.frameWidth,
            frameHeight: file.frameHeight,
          });
        }
        const sectorId = room.sector.sectorId;
        this.load.once(Phaser.Loader.Events.COMPLETE, () => activateRoomAmbientSequences(sectorId));
        if (!this.load.isLoading()) this.load.start();
      };

      const resolveSpatialTarget = (definition: { target: ExpeditionInteractionV3['target'] }) => {
        if (definition.target.kind === 'placement') {
          const actor = activeActorsByPlacement.get(definition.target.placementId);
          return actor ? { x: actor.sprite.x, y: actor.sprite.y, placementId: actor.placementId } : undefined;
        }
        const anchor = findTiledObject(currentRoom.tilemap, 'Anchors', definition.target.anchorId);
        if (!anchor) return undefined;
        const point = groundPoint(tiledObjectBounds(anchor, definition.target.anchorId));
        return { ...point, anchorId: definition.target.anchorId };
      };

      const publishAvailableInteraction = (interaction?: ExpeditionInteractionV3) => {
        if (availableInteraction?.interactionId === interaction?.interactionId) return;
        availableInteraction = interaction;
        if (interaction) {
          parent.dataset.interactionId = interaction.interactionId;
          parent.dataset.interactionPrompt = interaction.prompt;
        } else {
          delete parent.dataset.interactionId;
          delete parent.dataset.interactionPrompt;
        }
        parent.dispatchEvent(new CustomEvent(MAP_INTERACTION_AVAILABLE_EVENT, {
          detail: interaction ? { interaction } : undefined,
        }));
      };

      const publishAvailableExpression = (expression?: ExpeditionExpressionTriggerV3) => {
        if (availableExpression?.triggerId === expression?.triggerId) return;
        availableExpression = expression;
        if (expression) {
          parent.dataset.expressionTriggerId = expression.triggerId;
          parent.dataset.expressionPrompt = expression.prompt ?? '';
        } else {
          delete parent.dataset.expressionTriggerId;
          delete parent.dataset.expressionPrompt;
        }
        parent.dispatchEvent(new CustomEvent(MAP_EXPRESSION_AVAILABLE_EVENT, {
          detail: expression ? { trigger: expression } : undefined,
        }));
      };

      const publishCompanionAvailability = (available: boolean) => {
        const current = parent.dataset.companionAvailable === 'true';
        if (current === available) return;
        parent.dataset.companionAvailable = String(available);
        parent.dispatchEvent(new CustomEvent(MAP_COMPANION_AVAILABLE_EVENT, { detail: { available } }));
      };

      const isFacingCompanion = () => {
        if (!companionActor || stepTarget || transitioning) return false;
        const faced = gridStep({ x: player.x, y: player.y }, playerFacing);
        return Math.abs(faced.x - companionActor.sprite.x) < 5
          && Math.abs(faced.y - companionActor.sprite.y) < 5;
      };

      const refreshAvailableInteraction = () => {
        if (activeInteraction || activeExpression || companionConversationActive || stepTarget || transitioning) {
          publishAvailableInteraction();
          publishAvailableExpression();
          publishCompanionAvailability(false);
          return undefined;
        }
        const interaction = findFacingInteraction({
          interactions: (bundle.adventure.interactions ?? []).filter(candidate => (
            candidate.repeatPolicy !== 'oncePerVisit' || !completedVisitInteractionIds.has(candidate.interactionId)
          )),
          sectorId: currentRoom.sector.sectorId,
          player: { x: player.x, y: player.y },
          facing: playerFacing,
          resolveTarget: resolveSpatialTarget,
        });
        publishAvailableInteraction(interaction);
        if (interaction || !expressionsEnabled) {
          publishAvailableExpression();
          publishCompanionAvailability(!interaction && isFacingCompanion());
          return interaction;
        }
        const spatialExpressions = bundle.adventure.expressionTriggers.filter((trigger): trigger is ExpeditionExpressionTriggerV3 & {
          sectorId: string;
          target: ExpeditionInteractionV3['target'];
        } => Boolean(
          trigger.sectorId
          && trigger.target
          && trigger.prompt
          && !completedExpressionTriggerIds.has(trigger.triggerId),
        ));
        const expression = findFacingSpatialDefinition({
          definitions: spatialExpressions,
          sectorId: currentRoom.sector.sectorId,
          player: { x: player.x, y: player.y },
          facing: playerFacing,
          resolveTarget: resolveSpatialTarget,
        });
        publishAvailableExpression(expression);
        publishCompanionAvailability(!expression && isFacingCompanion());
        return expression;
      };

      const setPlayerIdle = () => {
        playerBody.setVelocity(0, 0);
        stepTarget = undefined;
        if (!playerCharacterSprite || !playerCharacterAsset) return;
        playerCharacterSprite.stop();
        playerCharacterSprite.setFrame(
          playerCharacterAsset.directionRows[playerFacing] * playerCharacterAsset.columns
            + playerCharacterAsset.idleFrame,
        );
      };

      const beginInteraction = (interaction: ExpeditionInteractionV3) => {
        if (activeInteraction) return;
        const dialogue = (bundle.adventure.dialogues ?? [])
          .find(candidate => candidate.dialogueId === interaction.dialogueId);
        if (!dialogue) return;
        const target = resolveSpatialTarget(interaction);
        if (target?.placementId) {
          const actor = activeActorsByPlacement.get(target.placementId);
          if (actor) setActorFacing(actor, facingTowardTarget(target, { x: player.x, y: player.y }));
        }
        activeInteraction = interaction;
        publishAvailableInteraction();
        setPlayerIdle();
        setAmbientAnimationsPaused(true);
        parent.dataset.controlPriority = 'interaction';
        parent.dataset.dialogueId = dialogue.dialogueId;
        parent.dataset.step = 'idle';
        parent.dispatchEvent(new CustomEvent<MapInteractionPresentation>(MAP_INTERACTION_STARTED_EVENT, {
          detail: { interaction, dialogue },
        }));
      };

      const finishInteraction = (completed: boolean) => {
        const interaction = activeInteraction;
        if (!interaction) return;
        if (completed) {
          if (interaction.repeatPolicy === 'oncePerVisit') completedVisitInteractionIds.add(interaction.interactionId);
          parent.dispatchEvent(new CustomEvent(MAP_INTERACTION_COMPLETED_EVENT, { detail: { interaction } }));
        }
        activeInteraction = undefined;
        delete parent.dataset.dialogueId;
        parent.dataset.controlPriority = 'player';
        if (!document.hidden && !ambientSuppressed && !reducedMotion) {
          setAmbientAnimationsPaused(false);
          parent.dataset.ambientState = ambientSequenceStates.length ? 'running' : 'none';
        }
        refreshAvailableInteraction();
      };

      const requestInteraction = (event: Event) => {
        const interactionId = (event as CustomEvent<{ interactionId?: string }>).detail?.interactionId;
        refreshAvailableInteraction();
        if (availableInteraction && (!interactionId || availableInteraction.interactionId === interactionId)) {
          beginInteraction(availableInteraction);
        }
      };

      const controlInteraction = (event: Event) => {
        const command = (event as CustomEvent<{ command?: string }>).detail?.command;
        if (command === 'complete') finishInteraction(true);
        if (command === 'dismiss') finishInteraction(false);
      };

      const requestInteractionFromKeyboard = () => {
        refreshAvailableInteraction();
        if (availableInteraction) beginInteraction(availableInteraction);
      };

      const beginCompanionConversation = () => {
        if (!companion || !companionActor || !isFacingCompanion()) return;
        companionConversationActive = true;
        availableCompanionBehaviors = bundle.adventure.behaviorTriggers.filter(trigger => (
          trigger.mode === 'prompt' && companion.eligibleBehaviorTriggerIds.has(trigger.triggerId)
        ));
        setPlayerIdle();
        setCompanionMoving(false);
        companionActor.direction = facingTowardTarget(
          { x: companionActor.sprite.x, y: companionActor.sprite.y },
          { x: player.x, y: player.y },
        );
        if (companionActor.asset) startActorAnimation(companionActor, 'Idle', companionActor.direction, -1);
        setAmbientAnimationsPaused(true);
        parent.dataset.controlPriority = 'companion';
        publishCompanionAvailability(false);
        parent.dispatchEvent(new CustomEvent<MapCompanionPresentation>(MAP_COMPANION_STARTED_EVENT, {
          detail: { displayName: companion.displayName, behaviors: availableCompanionBehaviors },
        }));
      };

      const finishCompanionConversation = () => {
        companionConversationActive = false;
        availableCompanionBehaviors = [];
        parent.dataset.controlPriority = 'player';
        if (!document.hidden && !ambientSuppressed && !reducedMotion) setAmbientAnimationsPaused(false);
        refreshAvailableInteraction();
      };

      const requestCompanionConversation = () => {
        refreshAvailableInteraction();
        if (!availableInteraction && !availableExpression && isFacingCompanion()) beginCompanionConversation();
      };

      const controlCompanionConversation = (event: Event) => {
        const detail = (event as CustomEvent<{ command?: string; triggerId?: string }>).detail;
        if (detail?.command === 'execute' && detail.triggerId) {
          const trigger = availableCompanionBehaviors.find(item => item.triggerId === detail.triggerId);
          finishCompanionConversation();
          if (trigger) void runCompanionSequence(trigger.sequenceId, trigger.triggerId);
          return;
        }
        if (detail?.command === 'dismiss') finishCompanionConversation();
      };

      const waitForMilliseconds = (milliseconds: number) => new Promise<void>(resolve => {
        if (milliseconds <= 0 || reducedMotion) resolve();
        else this.time.delayedCall(milliseconds, resolve);
      });

      const tweenActorTo = async (
        actor: ActiveActorState,
        destination: TiledPoint,
        speedPixelsPerSecond = 96,
      ) => {
        const path = findGridPath({
          from: { x: Math.round(actor.sprite.x), y: Math.round(actor.sprite.y) },
          to: destination,
          canOccupy: (x, y) => (
            !staticCollisionBounds.some(collision => rectangleOverlapsCollision(actorFootprint(x, y), collision))
            && !actorOccupiesCompanionTarget(x, y)
          ),
        });
        for (const point of path.slice(1)) {
          while (actorOccupiesCompanionTarget(point.x, point.y)) await waitForMilliseconds(100);
          const direction = facingFromDelta(point.x - actor.sprite.x, point.y - actor.sprite.y, actor.direction);
          actor.direction = direction;
          if (actor.asset) startActorAnimation(actor, 'Walk', direction, -1);
          await new Promise<void>(resolve => this.tweens.add({
            targets: actor.sprite,
            x: point.x,
            y: point.y,
            duration: reducedMotion ? 0 : 16 / speedPixelsPerSecond * 1000,
            onUpdate: () => actor.sprite.setDepth(actor.sprite.y),
            onComplete: () => resolve(),
          }));
        }
        if (actor.asset) startActorAnimation(actor, 'Idle', actor.direction, -1);
      };

      const actorForSequenceRef = (actorRef: string) => (
        actorRef === 'dynamic:companion' ? companionActor : activeActorsByPlacement.get(actorRef)
      );

      const executeCompanionSequenceAction = async (
        action: CompanionSequenceV3['beats'][number]['actions'][number],
      ) => {
        const actor = action.actorRef === 'dynamic:player' ? undefined : actorForSequenceRef(action.actorRef);
        if (action.kind === 'setVisible') {
          if (actor) {
            actor.sprite.setVisible(action.visible);
            publishVisibleSpecies();
          }
          return;
        }
        if (action.kind === 'face') {
          if (action.actorRef === 'dynamic:player') playerFacing = action.direction;
          else if (actor) setActorFacing(actor, action.direction);
          return;
        }
        if (action.kind === 'playAnimation') {
          if (!actor) return;
          const animation = action.animationByCompanionSpecies?.[companion?.form.speciesId ?? -1]
            ?? action.animation;
          if (!animation) return;
          const duration = startActorAnimation(actor, animation, actor.direction, action.repetitions ?? 1);
          await waitForMilliseconds(duration);
          return;
        }
        if (action.kind === 'dropPokeBalls') {
          const source = actor?.sprite ?? player;
          const count = Math.max(1, action.count);
          const spread = (action.spreadTiles ?? 2) * 16;
          const fall = (action.fallTiles ?? 3) * 16;
          const center = (count - 1) / 2;
          const balls = Array.from({ length: count }, (_, index) => {
            const container = this.add.container(source.x, source.y - fall).setDepth(source.y + fall + 1);
            const ball = this.add.graphics();
            ball.fillStyle(0xf4f4f4, 1).fillCircle(0, 0, 6);
            ball.fillStyle(0xd93636, 1).fillCircle(0, -1, 6);
            ball.fillStyle(0x242424, 1).fillRect(-6, -1, 12, 2);
            ball.fillStyle(0xffffff, 1).fillCircle(0, 0, 2);
            ball.lineStyle(1, 0x242424, 1).strokeCircle(0, 0, 6);
            container.add(ball);
            activeObjects.push(container);
            return { container, x: source.x + (index - center) * spread, y: source.y + fall };
          });
          parent.dataset.storyPokeBallCount = String(count);
          await Promise.all(balls.map(({ container, x, y }, index) => new Promise<void>(resolve => {
            this.tweens.add({
              targets: container,
              x,
              y,
              angle: index % 2 ? 180 : -180,
              duration: reducedMotion ? 0 : 420 + index * 70,
              ease: 'Bounce.Out',
              onComplete: () => resolve(),
            });
          })));
          return;
        }
        if (action.kind === 'emitCue') {
          parent.dataset.lastSequenceCueId = action.cueId;
          parent.dispatchEvent(new CustomEvent(MAP_SEQUENCE_CUE_EVENT, {
            detail: { cueId: action.cueId },
          }));
          return;
        }
        if (action.kind === 'moveToAnchor') {
          if (!actor) return;
          const anchor = findTiledObject(currentRoom.tilemap, 'Anchors', action.anchorId);
          if (!anchor) return;
          const ground = groundPoint(tiledObjectBounds(anchor, action.anchorId));
          const target = snapGroundPoint(ground.x, ground.y);
          await tweenActorTo(actor, target, action.speedPixelsPerSecond);
          return;
        }
        if (action.kind === 'returnToTrainer') {
          if (!companionActor) return;
          const preferredFacing: Facing = playerFacing === 'up' ? 'down'
            : playerFacing === 'down' ? 'up'
              : playerFacing === 'left' ? 'right'
                : 'left';
          const candidates = [preferredFacing, 'up', 'left', 'right', 'down'] as Facing[];
          const target = candidates.map(direction => gridStep({ x: player.x, y: player.y }, direction))
            .find(point => canOccupyGroundPoint(point.x, point.y)) ?? { x: player.x, y: player.y };
          await tweenActorTo(companionActor, target, action.speedPixelsPerSecond);
          companionTrail = [];
          companionTarget = undefined;
          return;
        }
        const destination = gridStep(
          action.actorRef === 'dynamic:player'
            ? { x: player.x, y: player.y }
            : { x: actor?.sprite.x ?? 0, y: actor?.sprite.y ?? 0 },
          action.direction,
          action.tiles,
        );
        if (action.actorRef === 'dynamic:player') {
          for (let step = 0; step < action.tiles; step += 1) {
            const next = gridStep({ x: player.x, y: player.y }, action.direction);
            if (!canOccupyGroundPoint(next.x, next.y)) break;
            await new Promise<void>(resolve => this.tweens.add({
              targets: player,
              x: next.x,
              y: next.y,
              duration: reducedMotion ? 0 : 16 / (action.speedPixelsPerSecond ?? 96) * 1000,
              onUpdate: () => player.setDepth(player.y),
              onComplete: () => {
                playerBody.reset(next.x, next.y);
                resolve();
              },
            }));
          }
        } else if (actor) await tweenActorTo(actor, destination, action.speedPixelsPerSecond);
      };

      const runCompanionSequence = async (sequenceId: string, completedTriggerId?: string) => {
        const sequence = [
          ...(bundle.adventure.companionSequences ?? []),
          ...(bundle.adventure.mapSequences ?? []),
        ].find(item => (
          item.sequenceId === sequenceId && item.sectorId === currentRoom.sector.sectorId
        ));
        if (!sequence || activeCompanionSequence) return;
        activeCompanionSequence = true;
        setPlayerIdle();
        setAmbientAnimationsPaused(true);
        parent.dataset.controlPriority = 'companionSequence';
        parent.dataset.companionSequenceId = sequenceId;
        parent.dataset.lastCompanionSequenceId = sequenceId;
        try {
          for (const beat of sequence.beats) {
            await Promise.all(beat.actions.map(executeCompanionSequenceAction));
            await waitForMilliseconds(beat.pauseAfterMs ?? 0);
          }
          if (completedTriggerId) {
            const completedTrigger = bundle.adventure.behaviorTriggers.find(item => item.triggerId === completedTriggerId);
            const completedSecrets = new Set(completedTrigger?.completionEffects?.unlockSecretIds ?? []);
            for (const trigger of bundle.adventure.behaviorTriggers) {
              if (trigger.triggerId === completedTriggerId
                || (trigger.completionEffects?.unlockSecretIds ?? []).some(id => completedSecrets.has(id))) {
                completedRuntimeBehaviorIds.add(trigger.triggerId);
              }
            }
            parent.dispatchEvent(new CustomEvent(MAP_COMPANION_BEHAVIOR_COMPLETED_EVENT, {
              detail: { triggerId: completedTriggerId },
            }));
          }
        } finally {
          activeCompanionSequence = false;
          delete parent.dataset.companionSequenceId;
          parent.dataset.controlPriority = 'player';
          if (!document.hidden && !ambientSuppressed && !reducedMotion) setAmbientAnimationsPaused(false);
        }
      };

      const evaluateAutomaticCompanionBehaviors = () => {
        if (!companion?.freeRoam || stepTarget || activeCompanionSequence
          || activeInteraction || activeExpression || companionConversationActive) return;
        const triggers = bundle.adventure.behaviorTriggers.filter(trigger => (
          trigger.mode === 'automatic'
          && trigger.proximity?.sectorId === currentRoom.sector.sectorId
          && !completedRuntimeBehaviorIds.has(trigger.triggerId)
          && !(trigger.completionEffects?.unlockSecretIds ?? []).some(id => companion.resolvedSecretIds.has(id))
        ));
        const groups = new Map<string, CompanionBehaviorTriggerV3[]>();
        for (const trigger of triggers) {
          const target = trigger.proximity!.target;
          const key = target.kind === 'anchor' ? `anchor:${target.anchorId}` : `placement:${target.placementId}`;
          groups.set(key, [...(groups.get(key) ?? []), trigger]);
        }
        for (const [zoneId, group] of groups) {
          const trigger = group[0];
          const target = resolveSpatialTarget({ target: trigger.proximity!.target });
          if (!target) continue;
          const range = (trigger.proximity?.rangeTiles ?? 1) * 16;
          const inside = Math.abs(player.x - target.x) + Math.abs(player.y - target.y) <= range;
          if (!inside) {
            occupiedProximityZones.delete(zoneId);
            continue;
          }
          if (occupiedProximityZones.has(zoneId)) continue;
          occupiedProximityZones.add(zoneId);
          const eligible = group.find(item => companion.eligibleBehaviorTriggerIds.has(item.triggerId));
          const sequenceId = eligible?.sequenceId ?? trigger.proximity?.failureSequenceId;
          if (sequenceId) void runCompanionSequence(sequenceId, eligible?.triggerId);
        }
      };

      const requestCompanionSequence = (event: Event) => {
        const detail = (event as CustomEvent<{ triggerId?: string; sequenceId?: string }>).detail;
        if (detail?.sequenceId) {
          if (!activeCompanionSequence) void runCompanionSequence(detail.sequenceId);
          return;
        }
        if (!companion?.freeRoam || activeCompanionSequence) return;
        const triggerId = detail?.triggerId;
        const trigger = bundle.adventure.behaviorTriggers.find(item => (
          item.triggerId === triggerId
          && companion.eligibleBehaviorTriggerIds.has(item.triggerId)
          && !completedRuntimeBehaviorIds.has(item.triggerId)
          && !(item.completionEffects?.unlockSecretIds ?? []).some(id => companion.resolvedSecretIds.has(id))
        ));
        if (trigger) void runCompanionSequence(trigger.sequenceId, trigger.triggerId);
      };

      const beginExpression = (trigger: ExpeditionExpressionTriggerV3) => {
        if (activeInteraction || activeExpression) return;
        activeExpression = trigger;
        publishAvailableExpression();
        setPlayerIdle();
        setAmbientAnimationsPaused(true);
        parent.dataset.controlPriority = 'expression';
        parent.dataset.activeExpressionTriggerId = trigger.triggerId;
        parent.dataset.step = 'idle';
        parent.dispatchEvent(new CustomEvent(MAP_EXPRESSION_STARTED_EVENT, { detail: { trigger } }));
      };

      const finishExpression = (completed: boolean) => {
        const trigger = activeExpression;
        if (!trigger) return;
        if (completed) completedExpressionTriggerIds.add(trigger.triggerId);
        activeExpression = undefined;
        delete parent.dataset.activeExpressionTriggerId;
        parent.dataset.controlPriority = 'player';
        if (!document.hidden && !ambientSuppressed && !reducedMotion) {
          setAmbientAnimationsPaused(false);
          parent.dataset.ambientState = ambientSequenceStates.length ? 'running' : 'none';
        }
        refreshAvailableInteraction();
      };

      const requestExpression = (event: Event) => {
        const triggerId = (event as CustomEvent<{ triggerId?: string }>).detail?.triggerId;
        refreshAvailableInteraction();
        if (availableExpression && (!triggerId || availableExpression.triggerId === triggerId)) {
          beginExpression(availableExpression);
        }
      };

      const controlExpression = (event: Event) => {
        const command = (event as CustomEvent<{ command?: string }>).detail?.command;
        if (command === 'complete') finishExpression(true);
        if (command === 'dismiss') finishExpression(false);
      };

      const requestContextActionFromKeyboard = () => {
        const contextual = refreshAvailableInteraction();
        if (!contextual) {
          if (isFacingCompanion()) beginCompanionConversation();
          return;
        }
        if ('interactionId' in contextual) beginInteraction(contextual);
        else beginExpression(contextual);
      };

      const beginTransition = (transition: LoadedAdventureMapBundle['adventure']['transitions'][number]) => {
        transitioning = true;
        playerBody.setVelocity(0, 0);
        parent.dataset.transition = 'fading-out';
        parent.dataset.lastTransitionId = transition.transitionId;
        this.cameras.main.fadeOut(140, 14, 31, 21);
        this.time.delayedCall(150, () => {
          renderRoom(transition.toSectorId, transition.toAnchorId, transition.destinationFacing);
          transitionCount += 1;
          parent.dataset.transitionCount = String(transitionCount);
          parent.dataset.transition = 'fading-in';
          this.cameras.main.fadeIn(140, 14, 31, 21);
          this.time.delayedCall(150, () => {
            transitioning = false;
            parent.dataset.transition = 'idle';
          });
        });
      };

      renderRoom(initialSectorId, initialSpawnAnchorId);
      const identifyVisibleSpecies = (event: Event) => {
        const speciesId = Number((event as CustomEvent<{ speciesId?: number }>).detail?.speciesId);
        const sprites = activeActorSpritesBySpecies.get(speciesId);
        if (!sprites?.length) return;
        revealedSpeciesIds.add(speciesId);
        sprites.forEach(sprite => sprite.clearTint());
        publishVisibleSpecies();
      };
      parent.addEventListener(MAP_SPECIES_IDENTIFIED_EVENT, identifyVisibleSpecies);
      const controlAmbient = (event: Event) => {
        const command = (event as CustomEvent<{ command?: string }>).detail?.command;
        if (command === 'pause') {
          ambientSuppressed = true;
          setAmbientAnimationsPaused(true);
        }
        if (command === 'resume') {
          ambientSuppressed = false;
          if (!activeInteraction && !activeExpression) setAmbientAnimationsPaused(false);
        }
        if (command === 'reset') {
          ambientSuppressed = false;
          for (const placementId of ambientPlacementIds()) {
            const actor = activeActorsByPlacement.get(placementId);
            if (!actor) continue;
            actor.sprite.setPosition(actor.baseX, actor.baseY).setDepth(actor.baseY);
            actor.direction = actor.baseDirection;
            if (actor.asset && actor.baseAnimation) {
              startActorAnimation(actor, actor.baseAnimation, actor.baseDirection, -1);
            } else setActorFacing(actor, actor.baseDirection);
          }
          ambientSequenceStates.forEach(sequence => {
            sequence.beatIndex = 0;
            sequence.actionStates = [];
            sequence.pauseRemainingMs = 0;
            sequence.phase = 'start';
            sequence.cycles = 0;
          });
          parent.dataset.ambientCycle = '0';
          parent.dataset.ambientState = ambientSequenceStates.length ? 'running' : 'none';
        }
      };
      const syncVisibilityState = () => {
        if (document.hidden) {
          parent.dataset.ambientState = 'hidden';
          setAmbientAnimationsPaused(true);
        } else if (!ambientSuppressed && !activeInteraction && !activeExpression) {
          parent.dataset.ambientState = ambientSequenceStates.length ? 'running' : 'none';
          setAmbientAnimationsPaused(false);
        }
      };
      parent.addEventListener(MAP_AMBIENT_CONTROL_EVENT, controlAmbient);
      parent.addEventListener(MAP_INTERACTION_REQUEST_EVENT, requestInteraction);
      parent.addEventListener(MAP_INTERACTION_CONTROL_EVENT, controlInteraction);
      parent.addEventListener(MAP_EXPRESSION_REQUEST_EVENT, requestExpression);
      parent.addEventListener(MAP_EXPRESSION_CONTROL_EVENT, controlExpression);
      parent.addEventListener(MAP_COMPANION_REQUEST_EVENT, requestCompanionConversation);
      parent.addEventListener(MAP_COMPANION_CONTROL_EVENT, controlCompanionConversation);
      parent.addEventListener(MAP_COMPANION_SEQUENCE_REQUEST_EVENT, requestCompanionSequence);
      this.input.keyboard?.on('keydown-E', requestContextActionFromKeyboard);
      this.input.keyboard?.on('keydown-SPACE', requestContextActionFromKeyboard);
      document.addEventListener('visibilitychange', syncVisibilityState);
      this.events.once('shutdown', () => {
        parent.removeEventListener(MAP_SPECIES_IDENTIFIED_EVENT, identifyVisibleSpecies);
        parent.removeEventListener(MAP_AMBIENT_CONTROL_EVENT, controlAmbient);
        parent.removeEventListener(MAP_INTERACTION_REQUEST_EVENT, requestInteraction);
        parent.removeEventListener(MAP_INTERACTION_CONTROL_EVENT, controlInteraction);
        parent.removeEventListener(MAP_EXPRESSION_REQUEST_EVENT, requestExpression);
        parent.removeEventListener(MAP_EXPRESSION_CONTROL_EVENT, controlExpression);
        parent.removeEventListener(MAP_COMPANION_REQUEST_EVENT, requestCompanionConversation);
        parent.removeEventListener(MAP_COMPANION_CONTROL_EVENT, controlCompanionConversation);
        parent.removeEventListener(MAP_COMPANION_SEQUENCE_REQUEST_EVENT, requestCompanionSequence);
        this.input.keyboard?.off('keydown-E', requestContextActionFromKeyboard);
        this.input.keyboard?.off('keydown-SPACE', requestContextActionFromKeyboard);
        this.input.keyboard?.off('keydown', directionKeyDown);
        this.input.keyboard?.off('keyup', directionKeyUp);
        document.removeEventListener('visibilitychange', syncVisibilityState);
      });
      parent.dataset.camera = 'static';
      parent.dataset.collision = 'arcade';
      parent.dataset.occlusionLayer = 'Above';
      parent.dataset.transitionCount = '0';
      parent.dataset.controlPriority = 'player';
      onReady();
      if (initialSequenceId) queueMicrotask(() => void runCompanionSequence(initialSequenceId));

      this.events.on('update', (_time: number, delta: number) => {
        if (!playerBody || transitioning) return;
        evaluateAutomaticCompanionBehaviors();
        if (!document.hidden && !ambientSuppressed && !activeInteraction && !activeExpression && !companionConversationActive && !reducedMotion) {
          ambientAccumulatorMs = Math.min(100, ambientAccumulatorMs + delta);
          if (ambientAccumulatorMs >= 1000 / 30) {
            ambientSequenceStates.forEach(sequence => updateAmbientSequence(sequence, ambientAccumulatorMs));
            ambientAccumulatorMs = 0;
          }
        } else if (activeInteraction) parent.dataset.ambientState = 'interaction';
        else if (activeExpression) parent.dataset.ambientState = 'expression';
        else if (ambientSuppressed) parent.dataset.ambientState = 'suppressed';

        refreshAvailableInteraction();
        if (activeInteraction || activeExpression || companionConversationActive || activeCompanionSequence) {
          setPlayerIdle();
          parent.dataset.step = 'idle';
          return;
        }
        const activeDirection = activeGridDirection(pressedDirections);
        const requestedFacing = activeDirection?.facing;

        if (this.time.now >= transitionCooldownUntil && requestedFacing) {
          for (const transition of bundle.adventure.transitions.filter(item => item.fromSectorId === currentRoom.sector.sectorId)) {
            const anchor = findTiledObject(currentRoom.tilemap, 'Anchors', transition.fromAnchorId);
            if (!anchor || !movingOutward(anchor, requestedFacing)) continue;
            const bounds = tiledObjectBounds(anchor, transition.fromAnchorId);
            const margin = 6;
            const reachedAnchor = player.x >= bounds.x - margin
              && player.x <= bounds.x + bounds.width + margin
              && player.y >= bounds.y - margin
              && player.y <= bounds.y + bounds.height + margin;
            if (reachedAnchor) {
              beginTransition(transition);
              return;
            }
          }
        }

        let completedStepThisFrame = false;
        if (stepTarget) {
          const reached = stepTarget.facing === 'left' ? player.x <= stepTarget.x
            : stepTarget.facing === 'right' ? player.x >= stepTarget.x
              : stepTarget.facing === 'up' ? player.y <= stepTarget.y
                : player.y >= stepTarget.y;
          if (reached) {
            playerBody.reset(stepTarget.x, stepTarget.y);
            stepTarget = undefined;
            completedStepThisFrame = true;
          }
        }

        if (!stepTarget && requestedFacing) {
          const heldForMs = performance.now() - (activeDirection?.startedAt ?? performance.now());
          const mayWalk = canStartClassicStep({
            facing: activeDirection?.facingAtPress ?? playerFacing,
            requestedFacing,
            heldForMs,
            chainingStep: completedStepThisFrame,
          });
          if (playerFacing !== requestedFacing) {
            playerFacing = requestedFacing;
            if (playerCharacterSprite && playerCharacterAsset) {
              playerCharacterSprite.stop();
              playerCharacterSprite.setFrame(
                playerCharacterAsset.directionRows[playerFacing] * playerCharacterAsset.columns
                  + playerCharacterAsset.idleFrame,
              );
            }
            parent.dataset.facing = playerFacing;
          }
          if (!mayWalk) {
            playerBody.setVelocity(0, 0);
            parent.dataset.step = 'turning';
            refreshAvailableInteraction();
            updateCompanionFollower(delta);
            return;
          }
          const movementDelta = requestedFacing === 'left' ? { x: -16, y: 0 }
            : requestedFacing === 'right' ? { x: 16, y: 0 }
              : requestedFacing === 'up' ? { x: 0, y: -16 }
                : { x: 0, y: 16 };
          const destination = { x: player.x + movementDelta.x, y: player.y + movementDelta.y };
          if (!canOccupyGroundPoint(destination.x, destination.y)) {
            playerBody.setVelocity(0, 0);
            parent.dataset.lastBlockedStep = 'preflight';
          } else {
            const swapsCompanion = Boolean(companionActor
              && Math.abs(companionActor.sprite.x - destination.x) < .5
              && Math.abs(companionActor.sprite.y - destination.y) < .5);
            if (swapsCompanion && companionActor) {
              companionTrail = [];
              companionTarget = undefined;
              companionActor.sprite.setPosition(player.x, player.y).setDepth(player.y);
              companionActor.direction = requestedFacing;
              setCompanionMoving(false, requestedFacing);
            }
            if (companionActor && !swapsCompanion) {
              companionTrail.push({ x: player.x, y: player.y });
            }
            stepTarget = {
              x: destination.x,
              y: destination.y,
              startX: player.x,
              startY: player.y,
              facing: requestedFacing,
              swappedCompanion: swapsCompanion,
            };
            delete parent.dataset.lastBlockedStep;
            playerBody.setVelocity(
              movementDelta.x === 0 ? 0 : Math.sign(movementDelta.x) * 96,
              movementDelta.y === 0 ? 0 : Math.sign(movementDelta.y) * 96,
            );
            if (completedStepThisFrame) {
              chainedStepCount += 1;
              parent.dataset.chainedStepCount = String(chainedStepCount);
            }
          }
        } else if (!stepTarget) {
          playerBody.setVelocity(0, 0);
        }
        parent.dataset.step = stepTarget ? 'moving' : 'idle';
        parent.dataset.facing = playerFacing;
        updateCompanionFollower(delta);

        if (playerCharacterSprite && playerCharacterAsset) {
          if (stepTarget) {
            if (reducedMotion) {
              playerCharacterSprite.setFrame(
                playerCharacterAsset.directionRows[playerFacing] * playerCharacterAsset.columns
                  + playerCharacterAsset.idleFrame,
              );
            } else {
              playerCharacterSprite.play(ensureCharacterAnimation(playerCharacterAsset, playerFacing), true);
            }
          } else {
            playerCharacterSprite.stop();
            playerCharacterSprite.setFrame(
              playerCharacterAsset.directionRows[playerFacing] * playerCharacterAsset.columns
                + playerCharacterAsset.idleFrame,
            );
          }
        }
        player.setDepth(player.y);
        parent.dataset.playerX = player.x.toFixed(1);
        parent.dataset.playerY = player.y.toFixed(1);
        if (companionActor) {
          parent.dataset.companionX = companionActor.sprite.x.toFixed(1);
          parent.dataset.companionY = companionActor.sprite.y.toFixed(1);
          parent.dataset.companionFacing = companionActor.direction;
          parent.dataset.companionAnimation = companionActor.currentAnimation ?? 'none';
          const companionFrame = companionActor.sprite.frame.name;
          if (parent.dataset.companionFrame !== String(companionFrame)) {
            parent.dataset.companionFrame = String(companionFrame);
            parent.dataset.companionFrameChanges = String(Number(parent.dataset.companionFrameChanges ?? 0) + 1);
          }
        }
        const currentFrame = primaryActor?.frame.name;
        if (currentFrame !== undefined && parent.dataset.actorFrame !== String(currentFrame)) {
          parent.dataset.actorFrame = String(currentFrame);
          parent.dataset.actorFrameChanges = String(Number(parent.dataset.actorFrameChanges ?? 0) + 1);
        }
      });
    }
  }

  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: canvasWidth,
    height: canvasHeight,
    backgroundColor: '#09140e',
    pixelArt: true,
    antialias: false,
    roundPixels: true,
    physics: { default: 'arcade', arcade: { debug: false } },
    scale: fitParent
      ? { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }
      : { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.NO_CENTER },
    scene: TechnicalRoomScene,
    render: { pixelArt: true, antialias: false, roundPixels: true },
  });
}
