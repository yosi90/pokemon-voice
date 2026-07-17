import type { LoadedAdventureMapBundle, LoadedAdventureRoomBundle } from './loadAdventureBundle.js';
import { findTiledObject } from './loadAdventureBundle.js';

type PhaserModule = typeof import('phaser');
type Facing = 'up' | 'down' | 'left' | 'right';

const DIRECTION_ROWS = Object.freeze({ down: 0, right: 2, up: 4, left: 6 });

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
  onReady,
}: {
  Phaser: PhaserModule;
  parent: HTMLElement;
  bundle: LoadedAdventureMapBundle;
  initialRoomId: string;
  reducedMotion: boolean;
  onReady: () => void;
}) {
  const initialRoom = bundle.rooms.find(candidate => candidate.room.roomId === initialRoomId);
  if (!initialRoom) throw new Error(`Habitación inicial inexistente: ${initialRoomId}.`);
  const canvasWidth = initialRoom.tilemap.width * initialRoom.tilemap.tilewidth;
  const canvasHeight = initialRoom.tilemap.height * initialRoom.tilemap.tileheight;
  const mapKey = (roomId: string) => `technical-map:${roomId}`;
  const tilesetKey = (name: string) => `technical-tileset:${name}`;
  const actorSheetKey = (assetId: string, animation: string) => `technical-actor:${assetId}:${animation}`;

  class TechnicalRoomScene extends Phaser.Scene {
    constructor() {
      super('technical-room');
    }

    preload() {
      const loadedTilesets = new Set<string>();
      const loadedActorSheets = new Set<string>();
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
        }
      }
    }

    create() {
      const cursors = this.input.keyboard?.createCursorKeys();
      const wasd = this.input.keyboard?.addKeys('W,A,S,D') as Record<string, import('phaser').Input.Keyboard.Key>;
      let currentRoom: LoadedAdventureRoomBundle;
      let currentMap: import('phaser').Tilemaps.Tilemap | undefined;
      let player: import('phaser').GameObjects.Rectangle;
      let playerBody: import('phaser').Physics.Arcade.Body;
      let primaryActor: import('phaser').GameObjects.Sprite | undefined;
      let transitioning = false;
      let transitionCount = 0;
      let transitionCooldownUntil = 0;
      let activeObjects: import('phaser').GameObjects.GameObject[] = [];
      let activeColliders: import('phaser').Physics.Arcade.Collider[] = [];

      const clearRoom = () => {
        activeColliders.forEach(collider => collider.destroy());
        activeObjects.forEach(object => object.destroy());
        activeColliders = [];
        activeObjects = [];
        currentMap?.destroy();
        currentMap = undefined;
        primaryActor = undefined;
      };

      const applySpawnOffset = (x: number, y: number, facing?: Facing) => {
        if (facing === 'right') return { x: x + 12, y };
        if (facing === 'left') return { x: x - 12, y };
        if (facing === 'down') return { x, y: y + 12 };
        if (facing === 'up') return { x, y: y - 12 };
        return { x, y };
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
          const sprite = this.add.sprite(
            anchorBounds.centerX,
            anchorBounds.centerY,
            sheetKey,
            frames[0],
          ).setOrigin(.5, 1).setDepth(anchorBounds.centerY);
          sprite.setName(placement.placementId);
          activeObjects.push(sprite);
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

        const resolvedSpawnId = spawnAnchorId ?? nextRoom.room.spawnAnchorIds[0];
        const playerAnchor = findTiledObject(nextRoom.tilemap, 'Anchors', resolvedSpawnId);
        const playerAnchorBounds = tiledObjectBounds(playerAnchor, resolvedSpawnId);
        const spawn = applySpawnOffset(
          playerAnchorBounds.centerX,
          playerAnchorBounds.centerY,
          facing,
        );
        player = this.add.rectangle(spawn.x, spawn.y, 10, 12, 0xffd54f)
          .setStrokeStyle(2, 0x183d2e).setDepth(spawn.y);
        activeObjects.push(player);
        this.physics.add.existing(player);
        playerBody = player.body as import('phaser').Physics.Arcade.Body;
        playerBody.setCollideWorldBounds(true);

        const collisionLayer = nextRoom.tilemap.layers.find(layer => layer.name === 'Collision');
        const collisions = Array.isArray(collisionLayer?.objects)
          ? collisionLayer.objects as Array<Record<string, unknown>>
          : [];
        for (const collision of collisions) {
          const width = requiredNumber(collision, 'width', String(collision.name));
          const height = requiredNumber(collision, 'height', String(collision.name));
          const obstacle = this.add.rectangle(
            requiredNumber(collision, 'x', String(collision.name)) + width / 2,
            requiredNumber(collision, 'y', String(collision.name)) + height / 2,
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
        parent.dataset.animation = primaryActor ? (reducedMotion ? 'paused' : 'playing') : 'none';
        parent.dataset.actorFrameChanges = '0';
        parent.dataset.transition = 'idle';
        transitionCooldownUntil = this.time.now + 350;
      };

      const movingOutward = (anchor: Record<string, unknown>, body: import('phaser').Physics.Arcade.Body) => {
        const bounds = tiledObjectBounds(anchor, String(anchor.name));
        const width = currentRoom.tilemap.width * currentRoom.tilemap.tilewidth;
        const height = currentRoom.tilemap.height * currentRoom.tilemap.tileheight;
        if (bounds.centerX <= currentRoom.tilemap.tilewidth) return body.velocity.x < 0;
        if (bounds.centerX >= width - currentRoom.tilemap.tilewidth) return body.velocity.x > 0;
        if (bounds.centerY <= currentRoom.tilemap.tileheight) return body.velocity.y < 0;
        if (bounds.centerY >= height - currentRoom.tilemap.tileheight) return body.velocity.y > 0;
        return false;
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
      parent.dataset.camera = 'static';
      parent.dataset.collision = 'arcade';
      parent.dataset.occlusionLayer = 'Above';
      parent.dataset.transitionCount = '0';
      onReady();

      this.events.on('update', () => {
        if (!playerBody || transitioning) return;
        const horizontal = (cursors?.right.isDown || wasd?.D?.isDown ? 1 : 0)
          - (cursors?.left.isDown || wasd?.A?.isDown ? 1 : 0);
        const vertical = (cursors?.down.isDown || wasd?.S?.isDown ? 1 : 0)
          - (cursors?.up.isDown || wasd?.W?.isDown ? 1 : 0);
        playerBody.setVelocity(horizontal * 60, vertical * 60);
        if (horizontal && vertical) playerBody.velocity.normalize().scale(60);
        player.setDepth(player.y);
        parent.dataset.playerX = player.x.toFixed(1);
        parent.dataset.playerY = player.y.toFixed(1);
        const currentFrame = primaryActor?.frame.name;
        if (currentFrame !== undefined && parent.dataset.actorFrame !== String(currentFrame)) {
          parent.dataset.actorFrame = String(currentFrame);
          parent.dataset.actorFrameChanges = String(Number(parent.dataset.actorFrameChanges ?? 0) + 1);
        }
        if (this.time.now < transitionCooldownUntil) return;
        for (const transition of bundle.adventure.transitions.filter(item => item.fromRoomId === currentRoom.room.roomId)) {
          const anchor = findTiledObject(currentRoom.tilemap, 'Anchors', transition.fromAnchorId);
          if (!anchor || !movingOutward(anchor, playerBody)) continue;
          const bounds = tiledObjectBounds(anchor, transition.fromAnchorId);
          const margin = 6;
          const reachedAnchor = player.x >= bounds.x - margin
            && player.x <= bounds.x + bounds.width + margin
            && player.y >= bounds.y - margin
            && player.y <= bounds.y + bounds.height + margin;
          if (reachedAnchor) {
            beginTransition(transition);
            break;
          }
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
