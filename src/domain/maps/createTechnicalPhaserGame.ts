import type { LoadedAdventureMapBundle, LoadedAdventureRoomBundle } from './loadAdventureBundle.js';
import { findTiledObject } from './loadAdventureBundle.js';

type PhaserModule = typeof import('phaser');
type Facing = 'up' | 'down' | 'left' | 'right';

const DIRECTION_ROWS = Object.freeze({ down: 0, right: 2, up: 4, left: 6 });
export const MAP_SPECIES_IDENTIFIED_EVENT = 'pokevoice:map-species-identified';

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

function sheetUrl(path: string) {
  return new URL(path, new URL(import.meta.env.BASE_URL, window.location.href)).href;
}

export function createTechnicalPhaserGame({
  Phaser,
  parent,
  bundle,
  initialRoomId,
  reducedMotion,
  registeredSpeciesIds,
  onReady,
}: {
  Phaser: PhaserModule;
  parent: HTMLElement;
  bundle: LoadedAdventureMapBundle;
  initialRoomId: string;
  reducedMotion: boolean;
  registeredSpeciesIds: ReadonlySet<number>;
  onReady: () => void;
}) {
  const initialRoom = bundle.rooms.find(candidate => candidate.room.roomId === initialRoomId);
  if (!initialRoom) throw new Error(`Habitación inicial inexistente: ${initialRoomId}.`);
  const canvasWidth = initialRoom.tilemap.width * initialRoom.tilemap.tilewidth;
  const canvasHeight = initialRoom.tilemap.height * initialRoom.tilemap.tileheight;
  const mapKey = (roomId: string) => `technical-map:${roomId}`;
  const tilesetKey = (name: string) => `technical-tileset:${name}`;
  const actorSheetKey = (assetId: string, animation: string) => `technical-actor:${assetId}:${animation}`;
  const actorShadowKey = (assetId: string, animation: string) => `technical-actor-shadow:${assetId}:${animation}`;
  const characterSheetKey = (assetId: string) => `technical-character:${assetId}`;
  const characterAnimationKey = (assetId: string, facing: Facing) => `technical-character-animation:${assetId}:${facing}`;
  const revealedSpeciesIds = new Set(registeredSpeciesIds);

  class TechnicalRoomScene extends Phaser.Scene {
    constructor() {
      super('technical-room');
    }

    preload() {
      const loadedTilesets = new Set<string>();
      const loadedActorSheets = new Set<string>();
      const loadedCharacterSheets = new Set<string>();
      for (const roomBundle of bundle.rooms) {
        this.load.tilemapTiledJSON(mapKey(roomBundle.room.roomId), roomBundle.tilemap);
        for (const tileset of roomBundle.tilesets) {
          const key = tilesetKey(tileset.name);
          if (loadedTilesets.has(key)) continue;
          loadedTilesets.add(key);
          this.load.image(key, tileset.imageUrl);
        }
        for (const placement of bundle.adventure.actorPlacements
          .filter(candidate => candidate.roomId === roomBundle.room.roomId)) {
          const asset = roomBundle.actorAssets.get(placement.assetId);
          const animation = asset?.animations.find(candidate => candidate.name === placement.animation);
          if (!asset || !animation) throw new Error(`Actor sin manifiesto: ${placement.placementId}.`);
          const key = actorSheetKey(asset.assetId, animation.name);
          if (loadedActorSheets.has(key)) continue;
          loadedActorSheets.add(key);
          this.load.spritesheet(key, sheetUrl(animation.animationSheetPath), {
            frameWidth: animation.frameWidth,
            frameHeight: animation.frameHeight,
          });
          this.load.spritesheet(actorShadowKey(asset.assetId, animation.name), sheetUrl(animation.shadowSheetPath), {
            frameWidth: animation.frameWidth,
            frameHeight: animation.frameHeight,
          });
        }
        for (const placement of bundle.adventure.characterPlacements
          .filter(candidate => candidate.roomId === roomBundle.room.roomId)) {
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
      }
    }

    create() {
      const cursors = this.input.keyboard?.createCursorKeys();
      const wasd = this.input.keyboard?.addKeys('W,A,S,D') as Record<string, import('phaser').Input.Keyboard.Key>;
      let currentRoom: LoadedAdventureRoomBundle;
      let currentMap: import('phaser').Tilemaps.Tilemap | undefined;
      let player: import('phaser').GameObjects.Rectangle | import('phaser').GameObjects.Sprite;
      let playerBody: import('phaser').Physics.Arcade.Body;
      let playerCharacterSprite: import('phaser').GameObjects.Sprite | undefined;
      let playerCharacterAsset: LoadedAdventureRoomBundle['characterAssets'] extends Map<string, infer Asset> ? Asset | undefined : never;
      let playerFacing: Facing = 'up';
      let primaryActor: import('phaser').GameObjects.Sprite | undefined;
      let transitioning = false;
      let transitionCount = 0;
      let transitionCooldownUntil = 0;
      let stepTarget: { x: number; y: number; startX: number; startY: number; facing: Facing } | undefined;
      let activeObjects: import('phaser').GameObjects.GameObject[] = [];
      let activeColliders: import('phaser').Physics.Arcade.Collider[] = [];
      let activeCollisionBounds: Array<{ x: number; y: number; width: number; height: number }> = [];
      let activeActorSpritesBySpecies = new Map<number, import('phaser').GameObjects.Sprite[]>();
      let solidActorCount = 0;

      const clearRoom = () => {
        activeColliders.forEach(collider => collider.destroy());
        activeObjects.forEach(object => object.destroy());
        activeColliders = [];
        activeObjects = [];
        activeCollisionBounds = [];
        activeActorSpritesBySpecies = new Map();
        solidActorCount = 0;
        currentMap?.destroy();
        currentMap = undefined;
        primaryActor = undefined;
        playerCharacterSprite = undefined;
        playerCharacterAsset = undefined;
        stepTarget = undefined;
      };

      const actorGroundOrigin = (assetId: string, animation: { name: string; frameWidth: number; frameHeight: number }, frame: number) => {
        const key = actorShadowKey(assetId, animation.name);
        for (let y = 0; y < animation.frameHeight; y += 1) {
          for (let x = 0; x < animation.frameWidth; x += 1) {
            const color = this.textures.getPixel(x, y, key, frame);
            if (color?.red === 255 && color.green === 255 && color.blue === 255 && color.alpha === 255) {
              return { x: x / animation.frameWidth, y: y / animation.frameHeight };
            }
          }
        }
        return { x: 0.5, y: 1 };
      };

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

      const renderRoom = (roomId: string, spawnAnchorId?: string, facing?: Facing) => {
        const nextRoom = bundle.rooms.find(candidate => candidate.room.roomId === roomId);
        if (!nextRoom) throw new Error(`Habitación no cargada: ${roomId}.`);
        clearRoom();
        currentRoom = nextRoom;
        currentMap = this.make.tilemap({ key: mapKey(roomId) });
        const phaserTilesets = nextRoom.tilesets.map(tileset => {
          const value = currentMap?.addTilesetImage(tileset.name, tilesetKey(tileset.name));
          if (!value) throw new Error(`Phaser no pudo enlazar el tileset ${tileset.name}.`);
          return value;
        });
        currentMap.createLayer('Ground', phaserTilesets, 0, 0)?.setDepth(0);
        currentMap.createLayer('Above', phaserTilesets, 0, 0)?.setDepth(10_000);

        const placements = bundle.adventure.actorPlacements.filter(candidate => candidate.roomId === roomId);
        for (const placement of placements) {
          const asset = nextRoom.actorAssets.get(placement.assetId);
          const animation = asset?.animations.find(candidate => candidate.name === placement.animation);
          const anchor = findTiledObject(nextRoom.tilemap, 'Anchors', placement.anchorId);
          if (!asset || !animation || !anchor) throw new Error(`Actor incompleto: ${placement.placementId}.`);
          const row = DIRECTION_ROWS[placement.direction ?? 'down'];
          const frames = Array.from({ length: animation.frameCount }, (_, index) => row * animation.frameCount + index);
          const sheetKey = actorSheetKey(asset.assetId, animation.name);
          const anchorBounds = tiledObjectBounds(anchor, placement.anchorId);
          const anchorPoint = groundPoint(anchorBounds);
          const origin = actorGroundOrigin(asset.assetId, animation, frames[0]);
          const sprite = this.add.sprite(
            anchorPoint.x,
            anchorPoint.y,
            sheetKey,
            frames[0],
          ).setOrigin(origin.x, origin.y).setScale(asset.renderScale ?? 1).setDepth(anchorPoint.y);
          if (!revealedSpeciesIds.has(asset.speciesId)) {
            sprite.setTint(0x000000);
            sprite.setTintMode(Phaser.TintModes.FILL);
          }
          const speciesSprites = activeActorSpritesBySpecies.get(asset.speciesId) ?? [];
          speciesSprites.push(sprite);
          activeActorSpritesBySpecies.set(asset.speciesId, speciesSprites);
          sprite.setName(placement.placementId);
          activeObjects.push(sprite);
          if (placement.collision !== 'pass-through') {
            activeCollisionBounds.push({
              x: anchorPoint.x - 8,
              y: anchorPoint.y - 16,
              width: 16,
              height: 16,
            });
            solidActorCount += 1;
          }
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

        const characterPlacements = bundle.adventure.characterPlacements
          .filter(candidate => candidate.roomId === roomId);
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
          ).setOrigin(.5, 1).setScale(asset.renderScale ?? 1).setDepth(anchorPoint.y);
          sprite.setName(placement.placementId);
          activeObjects.push(sprite);
          if (placement.collision !== 'pass-through') {
            activeCollisionBounds.push({
              x: anchorPoint.x - 8,
              y: anchorPoint.y - 16,
              width: 16,
              height: 16,
            });
            solidActorCount += 1;
          }
        }

        const resolvedSpawnId = spawnAnchorId ?? nextRoom.room.spawnAnchorIds[0];
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
          ).setOrigin(.5, 1).setScale(controllableAsset.renderScale ?? 1).setDepth(spawn.y);
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
          const width = requiredNumber(collision, 'width', String(collision.name));
          const height = requiredNumber(collision, 'height', String(collision.name));
          const collisionBounds = {
            x: requiredNumber(collision, 'x', String(collision.name)),
            y: requiredNumber(collision, 'y', String(collision.name)),
            width,
            height,
          };
          activeCollisionBounds.push(collisionBounds);
          const obstacle = this.add.rectangle(
            collisionBounds.x + width / 2,
            collisionBounds.y + height / 2,
            width,
            height,
            0x000000,
            0,
          );
          activeObjects.push(obstacle);
          this.physics.add.existing(obstacle, true);
          activeColliders.push(this.physics.add.collider(player, obstacle));
        }
        const mapWidth = nextRoom.tilemap.width * nextRoom.tilemap.tilewidth;
        const mapHeight = nextRoom.tilemap.height * nextRoom.tilemap.tileheight;
        this.physics.world.setBounds(0, 0, mapWidth, mapHeight);
        this.cameras.main.setBounds(0, 0, mapWidth, mapHeight);
        this.cameras.main.setRoundPixels(true);
        parent.dataset.roomId = roomId;
        parent.dataset.actorId = placements[0]?.placementId ?? '';
        parent.dataset.actorGrounding = 'pmd-shadow';
        parent.dataset.solidActorCount = String(solidActorCount);
        parent.dataset.undiscoveredActorCount = String(placements
          .filter(placement => {
            const asset = nextRoom.actorAssets.get(placement.assetId);
            return asset && !revealedSpeciesIds.has(asset.speciesId);
          }).length);
        parent.dataset.playerAssetId = playerCharacterAsset?.assetId ?? 'technical-marker';
        parent.dataset.movement = 'grid';
        parent.dataset.step = 'idle';
        parent.dataset.animation = primaryActor ? (reducedMotion ? 'paused' : 'playing') : 'none';
        parent.dataset.actorFrameChanges = '0';
        parent.dataset.transition = 'idle';
        transitionCooldownUntil = this.time.now + 350;
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
        const footprint = { left: x - 5, right: x + 5, top: y - 10, bottom: y };
        if (footprint.left < 0 || footprint.right > mapWidth || footprint.top < 0 || footprint.bottom > mapHeight) {
          return false;
        }
        return !activeCollisionBounds.some(collision => (
          footprint.right > collision.x
          && footprint.left < collision.x + collision.width
          && footprint.bottom > collision.y
          && footprint.top < collision.y + collision.height
        ));
      };

      const beginTransition = (transition: LoadedAdventureMapBundle['adventure']['transitions'][number]) => {
        transitioning = true;
        playerBody.setVelocity(0, 0);
        parent.dataset.transition = 'fading-out';
        parent.dataset.lastTransitionId = transition.transitionId;
        this.cameras.main.fadeOut(140, 14, 31, 21);
        this.time.delayedCall(150, () => {
          renderRoom(transition.toRoomId, transition.toAnchorId, transition.destinationFacing);
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

      renderRoom(initialRoomId);
      const identifyVisibleSpecies = (event: Event) => {
        const speciesId = Number((event as CustomEvent<{ speciesId?: number }>).detail?.speciesId);
        const sprites = activeActorSpritesBySpecies.get(speciesId);
        if (!sprites?.length) return;
        revealedSpeciesIds.add(speciesId);
        sprites.forEach(sprite => sprite.clearTint());
        const placements = bundle.adventure.actorPlacements.filter(item => item.roomId === currentRoom.room.roomId);
        parent.dataset.undiscoveredActorCount = String(placements.filter(placement => {
          const asset = currentRoom.actorAssets.get(placement.assetId);
          return asset && !revealedSpeciesIds.has(asset.speciesId);
        }).length);
      };
      parent.addEventListener(MAP_SPECIES_IDENTIFIED_EVENT, identifyVisibleSpecies);
      this.events.once('shutdown', () => parent.removeEventListener(MAP_SPECIES_IDENTIFIED_EVENT, identifyVisibleSpecies));
      parent.dataset.camera = 'static';
      parent.dataset.collision = 'arcade';
      parent.dataset.occlusionLayer = 'Above';
      parent.dataset.transitionCount = '0';
      onReady();

      this.events.on('update', () => {
        if (!playerBody || transitioning) return;
        const requestedFacing: Facing | undefined = cursors?.up.isDown || wasd?.W?.isDown ? 'up'
          : cursors?.down.isDown || wasd?.S?.isDown ? 'down'
            : cursors?.left.isDown || wasd?.A?.isDown ? 'left'
              : cursors?.right.isDown || wasd?.D?.isDown ? 'right'
                : undefined;

        if (this.time.now >= transitionCooldownUntil && requestedFacing) {
          for (const transition of bundle.adventure.transitions.filter(item => item.fromRoomId === currentRoom.room.roomId)) {
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

        if (!stepTarget && requestedFacing) {
          const delta = requestedFacing === 'left' ? { x: -16, y: 0 }
            : requestedFacing === 'right' ? { x: 16, y: 0 }
              : requestedFacing === 'up' ? { x: 0, y: -16 }
                : { x: 0, y: 16 };
          const destination = { x: player.x + delta.x, y: player.y + delta.y };
          playerFacing = requestedFacing;
          if (!canOccupyGroundPoint(destination.x, destination.y)) {
            playerBody.setVelocity(0, 0);
            parent.dataset.lastBlockedStep = 'preflight';
          } else {
            stepTarget = {
            x: destination.x,
            y: destination.y,
            startX: player.x,
            startY: player.y,
            facing: requestedFacing,
            };
            delete parent.dataset.lastBlockedStep;
            playerBody.setVelocity(delta.x === 0 ? 0 : Math.sign(delta.x) * 96, delta.y === 0 ? 0 : Math.sign(delta.y) * 96);
          }
        }

        if (stepTarget) {
          const blocked = stepTarget.facing === 'left' ? playerBody.blocked.left
            : stepTarget.facing === 'right' ? playerBody.blocked.right
              : stepTarget.facing === 'up' ? playerBody.blocked.up
                : playerBody.blocked.down;
          const reached = stepTarget.facing === 'left' ? player.x <= stepTarget.x
            : stepTarget.facing === 'right' ? player.x >= stepTarget.x
              : stepTarget.facing === 'up' ? player.y <= stepTarget.y
                : player.y >= stepTarget.y;
          if (blocked) {
            playerBody.reset(stepTarget.startX, stepTarget.startY);
            stepTarget = undefined;
          } else if (reached) {
            playerBody.reset(stepTarget.x, stepTarget.y);
            stepTarget = undefined;
          }
        } else {
          playerBody.setVelocity(0, 0);
        }
        parent.dataset.step = stepTarget ? 'moving' : 'idle';

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
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: TechnicalRoomScene,
    render: { pixelArt: true, antialias: false, roundPixels: true },
  });
}
