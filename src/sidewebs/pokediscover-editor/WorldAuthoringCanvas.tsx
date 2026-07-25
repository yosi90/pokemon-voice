import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { LoadedAdventureMapBundle, LoadedAdventureRoomBundle } from '../../domain/maps/loadAdventureBundle.js';
import {
  fileBaseName,
  type PokeDiscoverRoomRegistration,
  type PokeDiscoverWorldFile,
  type PokeDiscoverWorldMapEntry,
} from '../../domain/tools/pokeDiscoverEditorProject.js';
import { displayPokeDiscoverRoomLabel } from '../../domain/tools/pokeDiscoverEditorWorkspace.js';

const GID_MASK = 0x0fffffff;

interface PreparedWorldMap {
  entry: PokeDiscoverWorldMapEntry;
  registration: PokeDiscoverRoomRegistration;
  room: LoadedAdventureRoomBundle;
  width: number;
  height: number;
}

function worldMaps(
  bundle: LoadedAdventureMapBundle,
  world: PokeDiscoverWorldFile,
  registrations: PokeDiscoverRoomRegistration[],
) {
  const registrationsByFile = new Map(registrations.map(item => [fileBaseName(item.fileName), item]));
  return world.maps.flatMap(entry => {
    const registration = registrationsByFile.get(fileBaseName(entry.fileName));
    const room = registration
      ? bundle.rooms.find(candidate => candidate.room.roomId === registration.roomId)
      : undefined;
    if (!registration || !room) return [];
    return [{
      entry,
      registration,
      room,
      width: room.tilemap.width * room.tilemap.tilewidth,
      height: room.tilemap.height * room.tilemap.tileheight,
    }];
  });
}

function tilesetForGid(tilemap: LoadedAdventureRoomBundle['tilemap'], gid: number) {
  return [...tilemap.tilesets]
    .filter(tileset => Number(tileset.firstgid) <= gid)
    .sort((left, right) => Number(right.firstgid) - Number(left.firstgid))[0];
}

async function loadImages(maps: PreparedWorldMap[]) {
  const urls = [...new Set(maps.flatMap(map => map.room.tilemap.tilesets)
    .map(tileset => String(tileset.image ?? ''))
    .filter(Boolean))];
  const entries = await Promise.all(urls.map(url => new Promise<[string, HTMLImageElement]>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve([url, image]);
    image.onerror = () => reject(new Error(`No se pudo cargar ${url}.`));
    image.src = url;
  })));
  return new Map(entries);
}

function drawTile(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  source: { x: number; y: number; width: number; height: number },
  destination: { x: number; y: number; width: number; height: number },
  gid: number,
) {
  const flipHorizontal = Boolean(gid & 0x80000000);
  const flipVertical = Boolean(gid & 0x40000000);
  const flipDiagonal = Boolean(gid & 0x20000000);
  if (!flipHorizontal && !flipVertical && !flipDiagonal) {
    context.drawImage(image, source.x, source.y, source.width, source.height, destination.x, destination.y, destination.width, destination.height);
    return;
  }
  context.save();
  context.translate(destination.x + destination.width / 2, destination.y + destination.height / 2);
  if (flipDiagonal) context.rotate(Math.PI / 2);
  context.scale(flipHorizontal ? -1 : 1, flipVertical ? -1 : 1);
  context.drawImage(
    image,
    source.x,
    source.y,
    source.width,
    source.height,
    -destination.width / 2,
    -destination.height / 2,
    destination.width,
    destination.height,
  );
  context.restore();
}

function drawRoom(
  context: CanvasRenderingContext2D,
  map: PreparedWorldMap,
  origin: { x: number; y: number },
  images: Map<string, HTMLImageElement>,
) {
  const tilemap = map.room.tilemap;
  for (const layer of tilemap.layers) {
    const name = String(layer.name ?? '');
    if (layer.type !== 'tilelayer' || layer.visible === false
      || !(name === 'Ground' || name === 'Above' || name.startsWith('Detail:'))) continue;
    const data = Array.isArray(layer.data) ? layer.data as number[] : [];
    context.globalAlpha = Number(layer.opacity) || 1;
    data.forEach((encodedGid, index) => {
      const gid = (Number(encodedGid) >>> 0) & GID_MASK;
      if (!gid) return;
      const tileset = tilesetForGid(tilemap, gid);
      const image = tileset ? images.get(String(tileset.image ?? '')) : undefined;
      if (!tileset || !image) return;
      const firstgid = Number(tileset.firstgid);
      const localId = gid - firstgid;
      const tileWidth = Number(tileset.tilewidth) || tilemap.tilewidth;
      const tileHeight = Number(tileset.tileheight) || tilemap.tileheight;
      const columns = Number(tileset.columns)
        || Math.max(1, Math.floor(Number(tileset.imagewidth || image.width) / tileWidth));
      drawTile(context, image, {
        x: (localId % columns) * tileWidth,
        y: Math.floor(localId / columns) * tileHeight,
        width: tileWidth,
        height: tileHeight,
      }, {
        x: map.entry.x - origin.x + (index % tilemap.width) * tilemap.tilewidth,
        y: map.entry.y - origin.y + Math.floor(index / tilemap.width) * tilemap.tileheight,
        width: tilemap.tilewidth,
        height: tilemap.tileheight,
      }, Number(encodedGid) >>> 0);
    });
  }
  context.globalAlpha = 1;
}

function snapWorldPosition(
  value: { x: number; y: number },
  moving: PreparedWorldMap,
  others: PreparedWorldMap[],
) {
  let x = Math.round(value.x / 16) * 16;
  let y = Math.round(value.y / 16) * 16;
  const threshold = 12;
  for (const other of others) {
    const horizontalCandidates = [
      other.entry.x,
      other.entry.x + other.width,
      other.entry.x - moving.width,
      other.entry.x + other.width - moving.width,
    ];
    const verticalCandidates = [
      other.entry.y,
      other.entry.y + other.height,
      other.entry.y - moving.height,
      other.entry.y + other.height - moving.height,
    ];
    x = horizontalCandidates.reduce((result, candidate) => (
      Math.abs(candidate - result) <= threshold ? candidate : result
    ), x);
    y = verticalCandidates.reduce((result, candidate) => (
      Math.abs(candidate - result) <= threshold ? candidate : result
    ), y);
  }
  return { x, y };
}

export function WorldAuthoringCanvas({
  bundle,
  world,
  registrations,
  organize,
  onWorldChange,
  onOpenRoom,
}: {
  bundle: LoadedAdventureMapBundle;
  world: PokeDiscoverWorldFile;
  registrations: PokeDiscoverRoomRegistration[];
  organize: boolean;
  onWorldChange: (world: PokeDiscoverWorldFile, description: string) => void;
  onOpenRoom: (roomId: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const maps = useMemo(() => worldMaps(bundle, world, registrations), [bundle, registrations, world]);
  const bounds = useMemo(() => {
    const minX = Math.min(0, ...maps.map(map => map.entry.x));
    const minY = Math.min(0, ...maps.map(map => map.entry.y));
    const maxX = Math.max(1, ...maps.map(map => map.entry.x + map.width));
    const maxY = Math.max(1, ...maps.map(map => map.entry.y + map.height));
    return { minX, minY, width: maxX - minX, height: maxY - minY };
  }, [maps]);
  const [zoom, setZoom] = useState(.8);
  const [offset, setOffset] = useState({ x: 24, y: 24 });
  const [dragged, setDragged] = useState<{
    map: PreparedWorldMap;
    pointerX: number;
    pointerY: number;
    startX: number;
    startY: number;
    previewX: number;
    previewY: number;
  }>();
  const panRef = useRef<{ x: number; y: number; ox: number; oy: number } | undefined>(undefined);

  const recenter = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const nextZoom = Math.min(2, Math.max(.2, Math.min(
      (viewport.clientWidth - 80) / bounds.width,
      (viewport.clientHeight - 80) / bounds.height,
    )));
    setZoom(nextZoom);
    setOffset({
      x: (viewport.clientWidth - bounds.width * nextZoom) / 2,
      y: (viewport.clientHeight - bounds.height * nextZoom) / 2,
    });
  };

  useEffect(() => {
    const frame = requestAnimationFrame(recenter);
    window.addEventListener('pokediscover:recenter', recenter);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pokediscover:recenter', recenter);
    };
  }, [bounds.height, bounds.width]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    let cancelled = false;
    loadImages(maps).then(images => {
      if (cancelled) return;
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.ceil(bounds.width * ratio);
      canvas.height = Math.ceil(bounds.height * ratio);
      canvas.style.width = `${bounds.width}px`;
      canvas.style.height = `${bounds.height}px`;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.imageSmoothingEnabled = false;
      context.scale(ratio, ratio);
      context.clearRect(0, 0, bounds.width, bounds.height);
      for (const map of maps) drawRoom(context, map, { x: bounds.minX, y: bounds.minY }, images);
    }).catch(error => console.error('No se pudo dibujar la vista completa:', error));
    return () => { cancelled = true; };
  }, [bounds, maps]);

  const finishRoomDrag = () => {
    if (!dragged) return;
    const position = snapWorldPosition(
      { x: dragged.previewX, y: dragged.previewY },
      dragged.map,
      maps.filter(map => map.registration.fileName !== dragged.map.registration.fileName),
    );
    onWorldChange({
      ...world,
      maps: world.maps.map(entry => fileBaseName(entry.fileName) === dragged.map.registration.fileName
        ? { ...entry, ...position }
        : entry),
    }, `Mover habitación ${displayPokeDiscoverRoomLabel(dragged.map.registration.fileName)}`);
    setDragged(undefined);
  };

  return (
    <section className="editor-world-authoring" aria-label="Vista completa de la aventura">
      <div className="editor-modebar">
        <strong>{organize ? 'Organizar mundo' : 'Vista completa'}</strong>
        <span>{maps.length} habitaciones · {Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => setZoom(value => Math.max(.15, value - .1))}>−</button>
        <button type="button" onClick={() => setZoom(value => Math.min(3, value + .1))}>+</button>
        <button type="button" onClick={recenter}>Recentrar</button>
      </div>
      <div
        ref={viewportRef}
        className="editor-world-viewport"
        onPointerDown={event => {
          if ((event.target as HTMLElement).closest('.editor-world-room')) return;
          panRef.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={event => {
          if (panRef.current) setOffset({
            x: panRef.current.ox + event.clientX - panRef.current.x,
            y: panRef.current.oy + event.clientY - panRef.current.y,
          });
          if (dragged) setDragged(current => current ? {
            ...current,
            previewX: current.startX + (event.clientX - current.pointerX) / zoom,
            previewY: current.startY + (event.clientY - current.pointerY) / zoom,
          } : current);
        }}
        onPointerUp={() => {
          panRef.current = undefined;
          finishRoomDrag();
        }}
        onWheel={event => {
          event.preventDefault();
          setZoom(value => Math.min(3, Math.max(.15, value + (event.deltaY < 0 ? .1 : -.1))));
        }}
      >
        <div
          className="editor-world-surface"
          style={{
            width: bounds.width,
            height: bounds.height,
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
          }}
        >
          <canvas ref={canvasRef} data-testid="pokediscover-world-canvas" />
          {maps.map(map => {
            const activeDrag = dragged?.map.registration.fileName === map.registration.fileName;
            const x = (activeDrag ? dragged.previewX : map.entry.x) - bounds.minX;
            const y = (activeDrag ? dragged.previewY : map.entry.y) - bounds.minY;
            return (
              <button
                key={map.registration.roomId}
                type="button"
                className={`editor-world-room${organize ? ' is-organizable' : ''}${activeDrag ? ' is-dragging' : ''}`}
                style={{ left: x, top: y, width: map.width, height: map.height }}
                onDoubleClick={() => onOpenRoom(map.registration.roomId)}
                onPointerDown={(event: ReactPointerEvent<HTMLButtonElement>) => {
                  event.stopPropagation();
                  if (!organize) {
                    onOpenRoom(map.registration.roomId);
                    return;
                  }
                  setDragged({
                    map,
                    pointerX: event.clientX,
                    pointerY: event.clientY,
                    startX: map.entry.x,
                    startY: map.entry.y,
                    previewX: map.entry.x,
                    previewY: map.entry.y,
                  });
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={event => {
                  if (!dragged || dragged.map.registration.fileName !== map.registration.fileName) return;
                  setDragged(current => current ? {
                    ...current,
                    previewX: current.startX + (event.clientX - current.pointerX) / zoom,
                    previewY: current.startY + (event.clientY - current.pointerY) / zoom,
                  } : current);
                }}
                onPointerUp={finishRoomDrag}
              >
                <span>{displayPokeDiscoverRoomLabel(map.registration.fileName)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
