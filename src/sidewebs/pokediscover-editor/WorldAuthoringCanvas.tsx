import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { LoadedAdventureMapBundle, LoadedAdventureRoomBundle } from '../../domain/maps/loadAdventureBundle.js';
import {
  fileBaseName,
  previewPokeDiscoverWorldNames,
  type PokeDiscoverRoomRegistration,
  type PokeDiscoverWorldFile,
  type PokeDiscoverWorldMapEntry,
} from '../../domain/tools/pokeDiscoverEditorProject.js';
import {
  centerPokeDiscoverCamera,
  clampPokeDiscoverCameraZoom,
  readPokeDiscoverCameraZoom,
  writePokeDiscoverCameraZoom,
  zoomPokeDiscoverCameraAtPoint,
} from '../../domain/tools/pokeDiscoverEditorCamera.js';
import { displayPokeDiscoverRoomLabel } from '../../domain/tools/pokeDiscoverEditorWorkspace.js';
import {
  readTiledTileTransform,
  TILED_GID_MASK,
} from '../../domain/maps/tiledObjectTransform.js';

const WORLD_ZOOM_STORAGE_KEY = 'pokediscover-editor-world-zoom';
const WORLD_MIN_ZOOM = .15;
const WORLD_MAX_ZOOM = 3;

function CenterIcon() {
  return <svg aria-hidden="true" viewBox="0 0 20 20"><circle cx="10" cy="10" r="6" /><circle cx="10" cy="10" r="2" /><path d="M10 1v3M10 16v3M1 10h3M16 10h3" /></svg>;
}

interface PreparedWorldMap {
  entry: PokeDiscoverWorldMapEntry;
  registration?: PokeDiscoverRoomRegistration;
  room?: LoadedAdventureRoomBundle;
  width: number;
  height: number;
  pending: boolean;
}

function worldMaps(
  bundle: LoadedAdventureMapBundle,
  world: PokeDiscoverWorldFile,
  registrations: PokeDiscoverRoomRegistration[],
) {
  const registrationsByFile = new Map(registrations.map(item => [fileBaseName(item.fileName), item]));
  return world.maps.map(entry => {
    const registration = registrationsByFile.get(fileBaseName(entry.fileName));
    const room = registration
      ? bundle.rooms.find(candidate => candidate.room.roomId === registration.roomId)
      : undefined;
    return {
      entry,
      registration,
      room,
      width: room ? room.tilemap.width * room.tilemap.tilewidth : Number(entry.width) || 480,
      height: room ? room.tilemap.height * room.tilemap.tileheight : Number(entry.height) || 320,
      pending: !registration || !room,
    };
  });
}

function tilesetForGid(tilemap: LoadedAdventureRoomBundle['tilemap'], gid: number) {
  return [...tilemap.tilesets]
    .filter(tileset => Number(tileset.firstgid) <= gid)
    .sort((left, right) => Number(right.firstgid) - Number(left.firstgid))[0];
}

async function loadImages(maps: PreparedWorldMap[]) {
  const urls = [...new Set(maps.flatMap(map => map.room?.tilemap.tilesets ?? [])
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
  const transform = readTiledTileTransform(gid);
  if (!transform.rotation && transform.scaleX === 1 && transform.scaleY === 1) {
    context.drawImage(image, source.x, source.y, source.width, source.height, destination.x, destination.y, destination.width, destination.height);
    return;
  }
  context.save();
  context.translate(destination.x + destination.width / 2, destination.y + destination.height / 2);
  context.rotate(transform.rotation);
  context.scale(transform.scaleX, transform.scaleY);
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
  if (!map.room) return;
  const tilemap = map.room.tilemap;
  for (const layer of tilemap.layers) {
    const name = String(layer.name ?? '');
    if (layer.type !== 'tilelayer' || layer.visible === false
      || !(name === 'Ground' || name === 'Above' || name.startsWith('Detail:'))) continue;
    const data = Array.isArray(layer.data) ? layer.data as number[] : [];
    context.globalAlpha = Number(layer.opacity) || 1;
    data.forEach((encodedGid, index) => {
      const gid = (Number(encodedGid) >>> 0) & TILED_GID_MASK;
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
  onApplyOrganization,
  onCancelOrganization,
  onOrganizeRequest,
  onOrganizationDirtyChange,
  onOpenRoom,
}: {
  bundle: LoadedAdventureMapBundle;
  world: PokeDiscoverWorldFile;
  registrations: PokeDiscoverRoomRegistration[];
  organize: boolean;
  onWorldChange: (world: PokeDiscoverWorldFile, description: string) => void;
  onApplyOrganization: (world: PokeDiscoverWorldFile, description: string) => void;
  onCancelOrganization: () => void;
  onOrganizeRequest: () => void;
  onOrganizationDirtyChange: (dirty: boolean) => void;
  onOpenRoom: (roomId: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [draftWorld, setDraftWorld] = useState(world);
  const [selectedFileName, setSelectedFileName] = useState('');
  useEffect(() => {
    if (organize) {
      setDraftWorld(structuredClone(world));
      setSelectedFileName('');
      onOrganizationDirtyChange(false);
    }
  }, [onOrganizationDirtyChange, organize, world]);
  const visibleWorld = organize ? draftWorld : world;
  const maps = useMemo(
    () => worldMaps(bundle, visibleWorld, registrations),
    [bundle, registrations, visibleWorld],
  );
  const previewNames = useMemo(
    () => previewPokeDiscoverWorldNames(visibleWorld, registrations),
    [registrations, visibleWorld],
  );
  const bounds = useMemo(() => {
    const minX = Math.min(0, ...maps.map(map => map.entry.x));
    const minY = Math.min(0, ...maps.map(map => map.entry.y));
    const maxX = Math.max(1, ...maps.map(map => map.entry.x + map.width));
    const maxY = Math.max(1, ...maps.map(map => map.entry.y + map.height));
    return { minX, minY, width: maxX - minX, height: maxY - minY };
  }, [maps]);
  const [zoom, setZoom] = useState(() => readPokeDiscoverCameraZoom(
    WORLD_ZOOM_STORAGE_KEY,
    .8,
    WORLD_MIN_ZOOM,
    WORLD_MAX_ZOOM,
  ));
  const zoomRef = useRef(zoom);
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
  const panRef = useRef<{
    x: number;
    y: number;
    ox: number;
    oy: number;
    moved?: boolean;
    openRoomId?: string;
  } | undefined>(undefined);

  const recenter = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    setOffset(centerPokeDiscoverCamera({
      viewportWidth: viewport.clientWidth,
      viewportHeight: viewport.clientHeight,
      contentWidth: bounds.width,
      contentHeight: bounds.height,
      zoom: zoomRef.current,
    }));
  }, [bounds.height, bounds.width]);
  const centeredOffset = viewportRef.current ? centerPokeDiscoverCamera({
    viewportWidth: viewportRef.current.clientWidth,
    viewportHeight: viewportRef.current.clientHeight,
    contentWidth: bounds.width,
    contentHeight: bounds.height,
    zoom,
  }) : offset;
  const isCentered = Math.abs(centeredOffset.x - offset.x) < .5
    && Math.abs(centeredOffset.y - offset.y) < .5;

  const changeZoom = useCallback((
    requestedZoom: number,
    clientPoint?: { x: number; y: number },
  ) => {
    const viewport = viewportRef.current;
    const nextZoom = clampPokeDiscoverCameraZoom(
      Math.round(requestedZoom * 100) / 100,
      WORLD_MIN_ZOOM,
      WORLD_MAX_ZOOM,
    );
    if (!viewport || nextZoom === zoomRef.current) return;
    const viewportBounds = viewport.getBoundingClientRect();
    const focalPoint = clientPoint
      ? { x: clientPoint.x - viewportBounds.left, y: clientPoint.y - viewportBounds.top }
      : { x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 };
    setOffset(current => zoomPokeDiscoverCameraAtPoint({
      offset: current,
      currentZoom: zoomRef.current,
      nextZoom,
      focalPoint,
    }));
    zoomRef.current = nextZoom;
    setZoom(nextZoom);
  }, []);

  useEffect(() => {
    zoomRef.current = zoom;
    writePokeDiscoverCameraZoom(WORLD_ZOOM_STORAGE_KEY, zoom);
  }, [zoom]);

  useEffect(() => {
    const frame = requestAnimationFrame(recenter);
    const observer = new ResizeObserver(recenter);
    if (viewportRef.current) observer.observe(viewportRef.current);
    window.addEventListener('pokediscover:recenter', recenter);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('pokediscover:recenter', recenter);
    };
  }, [recenter]);

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
      maps.filter(map => fileBaseName(map.entry.fileName) !== fileBaseName(dragged.map.entry.fileName)),
    );
    const nextWorld = {
      ...visibleWorld,
      maps: visibleWorld.maps.map(entry => fileBaseName(entry.fileName) === fileBaseName(dragged.map.entry.fileName)
        ? { ...entry, ...position }
        : entry),
    };
    if (organize) {
      setDraftWorld(nextWorld);
      onOrganizationDirtyChange(true);
    }
    else onWorldChange(nextWorld, `Mover habitación ${displayPokeDiscoverRoomLabel(dragged.map.entry.fileName)}`);
    setDragged(undefined);
  };

  const addPendingRoom = () => {
    const reference = maps.find(map => fileBaseName(map.entry.fileName) === selectedFileName) ?? maps[0];
    const width = reference?.width ?? 480;
    const height = reference?.height ?? 320;
    const x = maps.reduce((right, map) => Math.max(right, map.entry.x + map.width), 0) + 16;
    const y = maps.length ? Math.min(...maps.map(map => map.entry.y)) : 0;
    const temporaryName = `mapa-pendiente-${crypto.randomUUID()}.tmj`;
    setDraftWorld(current => ({
      ...current,
      maps: [...current.maps, { fileName: temporaryName, x, y, width, height }],
    }));
    onOrganizationDirtyChange(true);
    setSelectedFileName(temporaryName);
  };

  const removeSelectedRoom = () => {
    if (!selectedFileName) return;
    setDraftWorld(current => ({
      ...current,
      maps: current.maps.filter(entry => fileBaseName(entry.fileName) !== selectedFileName),
    }));
    onOrganizationDirtyChange(true);
    setSelectedFileName('');
  };

  const restoreArchivedRoom = (fileName: string) => {
    const registration = registrations.find(item => item.fileName === fileName && item.archived);
    const room = registration
      ? bundle.rooms.find(candidate => candidate.room.roomId === registration.roomId)
      : undefined;
    const width = room ? room.tilemap.width * room.tilemap.tilewidth : 480;
    const height = room ? room.tilemap.height * room.tilemap.tileheight : 320;
    const x = maps.reduce((right, map) => Math.max(right, map.entry.x + map.width), 0) + 16;
    const y = maps.length ? Math.min(...maps.map(map => map.entry.y)) : 0;
    setDraftWorld(current => ({
      ...current,
      maps: [...current.maps, { fileName, x, y, width, height }],
    }));
    onOrganizationDirtyChange(true);
    setSelectedFileName(fileName);
  };

  return (
    <section className={`editor-world-authoring${organize ? ' is-organizing' : ''}`} aria-label="Vista completa de la aventura">
      {organize ? <div className="editor-world-organizer">
        <strong>Organizar mundo</strong>
        <span>{maps.filter(map => !map.pending).length}/{maps.length} disponibles</span>
        <button type="button" onClick={addPendingRoom}>Añadir pieza</button>
        <button type="button" disabled={!selectedFileName} onClick={removeSelectedRoom}>Quitar pieza</button>
        {registrations.some(item => item.archived) ? <label>
          <span>Apartadas</span>
          <select
            value=""
            aria-label="Reincorporar habitación apartada"
            onChange={event => {
              if (event.target.value) restoreArchivedRoom(event.target.value);
            }}
          >
            <option value="">Reincorporar…</option>
            {registrations.filter(item => item.archived).map(item => (
              <option key={item.roomId} value={item.fileName}>{item.fileName}</option>
            ))}
          </select>
        </label> : null}
        <span className="editor-world-organizer__spacer" />
        <button type="button" onClick={onCancelOrganization}>Cancelar</button>
        <button
          type="button"
          className="is-primary"
          onClick={() => {
            onOrganizationDirtyChange(false);
            onApplyOrganization(draftWorld, 'Aplicar organización del mundo');
          }}
        >Aplicar organización</button>
      </div> : null}
      <div
        ref={viewportRef}
        className="editor-world-viewport"
        data-camera-zoom={zoom}
        data-camera-offset-x={offset.x}
        data-camera-offset-y={offset.y}
        onPointerDown={event => {
          if ((event.target as HTMLElement).closest('.editor-world-room')) return;
          panRef.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={event => {
          if (panRef.current) {
            const deltaX = event.clientX - panRef.current.x;
            const deltaY = event.clientY - panRef.current.y;
            if (Math.hypot(deltaX, deltaY) > 4) panRef.current.moved = true;
            setOffset({
              x: panRef.current.ox + deltaX,
              y: panRef.current.oy + deltaY,
            });
          }
          if (dragged) setDragged(current => current ? {
            ...current,
            previewX: current.startX + (event.clientX - current.pointerX) / zoom,
            previewY: current.startY + (event.clientY - current.pointerY) / zoom,
          } : current);
        }}
        onPointerUp={() => {
          const completedPan = panRef.current;
          panRef.current = undefined;
          if (completedPan?.openRoomId && !completedPan.moved) onOpenRoom(completedPan.openRoomId);
          finishRoomDrag();
        }}
        onPointerCancel={() => {
          panRef.current = undefined;
          setDragged(undefined);
        }}
        onWheel={event => {
          event.preventDefault();
          changeZoom(zoomRef.current + (event.deltaY < 0 ? .1 : -.1), {
            x: event.clientX,
            y: event.clientY,
          });
        }}
      >
        <div className="editor-canvas-controls" onPointerDown={event => event.stopPropagation()}>
          <span
            className="editor-control-tooltip is-zoom"
            data-tooltip="Zoom: cambia el tamaño visual del mundo sin modificar sus posiciones."
          >
            <input
              type="range"
              min={WORLD_MIN_ZOOM}
              max={WORLD_MAX_ZOOM}
              step=".05"
              value={zoom}
              aria-label="Zoom de la vista completa"
              onChange={event => changeZoom(Number(event.target.value))}
            />
            <output>{Math.round(zoom * 100)}%</output>
          </span>
          <span
            className="editor-control-tooltip"
            data-tooltip={isCentered
              ? 'La vista completa ya está centrada.'
              : 'Centra el mundo conservando el zoom actual.'}
          >
            <button
              type="button"
              className={isCentered ? '' : 'is-actionable'}
              disabled={isCentered}
              onClick={recenter}
              aria-label="Centrar vista completa"
            ><CenterIcon /></button>
          </span>
        </div>
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
            const currentDrag = dragged
              && fileBaseName(dragged.map.entry.fileName) === fileBaseName(map.entry.fileName)
              ? dragged
              : undefined;
            const activeDrag = Boolean(currentDrag);
            const x = (currentDrag?.previewX ?? map.entry.x) - bounds.minX;
            const y = (currentDrag?.previewY ?? map.entry.y) - bounds.minY;
            const expectedName = previewNames.get(map.entry) ?? map.entry.fileName;
            const fileName = fileBaseName(map.entry.fileName);
            return (
              <button
                key={fileName}
                type="button"
                className={`editor-world-room${organize ? ' is-organizable' : ''}${activeDrag ? ' is-dragging' : ''}${map.pending ? ' is-pending' : ''}${selectedFileName === fileName ? ' is-selected' : ''}`}
                style={{ left: x, top: y, width: map.width, height: map.height }}
                onDoubleClick={() => {
                  if (map.registration) onOpenRoom(map.registration.roomId);
                  else onOrganizeRequest();
                }}
                onPointerDown={(event: ReactPointerEvent<HTMLButtonElement>) => {
                  event.stopPropagation();
                  setSelectedFileName(fileName);
                  if (!organize) {
                    if (!map.registration) {
                      onOrganizeRequest();
                      return;
                    }
                    panRef.current = {
                      x: event.clientX,
                      y: event.clientY,
                      ox: offset.x,
                      oy: offset.y,
                      openRoomId: map.registration.roomId,
                    };
                    event.currentTarget.setPointerCapture(event.pointerId);
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
                  if (!dragged || fileBaseName(dragged.map.entry.fileName) !== fileName) return;
                  setDragged(current => current ? {
                    ...current,
                    previewX: current.startX + (event.clientX - current.pointerX) / zoom,
                    previewY: current.startY + (event.clientY - current.pointerY) / zoom,
                  } : current);
                }}
                onPointerUp={finishRoomDrag}
              >
                <span>{displayPokeDiscoverRoomLabel(expectedName)}</span>
                {map.pending ? <small>Mapa pendiente</small> : null}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
