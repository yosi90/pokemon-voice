import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { LoadedAdventureMapBundle } from '../../domain/maps/loadAdventureBundle.js';
import { getPokeDiscoverEditorContentMarkers } from '../../domain/tools/pokeDiscoverEditorContent.js';
import {
  addPokeDiscoverCollisionPolygon,
  addPokeDiscoverCollisionRectangle,
  type PokeDiscoverGeometryPoint,
} from '../../domain/tools/pokeDiscoverEditorGeometry.js';
import {
  updatePokeDiscoverTiledObject,
  type PokeDiscoverEditableTiledMap,
  type PokeDiscoverObjectLayerName,
  type PokeDiscoverTiledObject,
} from '../../domain/tools/pokeDiscoverEditorProject.js';
import {
  centerPokeDiscoverCamera,
  clampPokeDiscoverCameraZoom,
  readPokeDiscoverCameraZoom,
  writePokeDiscoverCameraZoom,
  zoomPokeDiscoverCameraAtPoint,
} from '../../domain/tools/pokeDiscoverEditorCamera.js';
import { RuntimePreview } from './RuntimePreview.js';
import { transformTiledObjectPoint } from '../../domain/maps/tiledObjectTransform.js';

export type PokeDiscoverCanvasTool =
  | 'select'
  | 'pan'
  | 'collision-rectangle'
  | 'collision-polygon'
  | 'connection';

export type PokeDiscoverCellCommand =
  | 'pokemon'
  | 'npc'
  | 'interaction'
  | 'secret'
  | 'entry'
  | 'collision'
  | 'exit';

export interface PokeDiscoverCellSelection {
  center: PokeDiscoverGeometryPoint;
  start: PokeDiscoverGeometryPoint;
  end: PokeDiscoverGeometryPoint;
  edge?: 'left' | 'right' | 'top' | 'bottom';
}

interface GeometryObject {
  layerName: PokeDiscoverObjectLayerName;
  object: PokeDiscoverTiledObject;
}

export const POKEDISCOVER_CANVAS_TOOLS: Array<{ tool: PokeDiscoverCanvasTool; label: string; short: string }> = [
  { tool: 'select', label: 'Seleccionar y mover', short: 'Seleccionar' },
  { tool: 'pan', label: 'Desplazar lienzo', short: 'Mano' },
  { tool: 'collision-rectangle', label: 'Dibujar colisión rectangular', short: 'Colisión ▭' },
  { tool: 'collision-polygon', label: 'Dibujar colisión poligonal', short: 'Colisión ⬠' },
  { tool: 'connection', label: 'Conectar con la sector contigua', short: 'Salida' },
];

const ROOM_ZOOM_STORAGE_KEY = 'pokediscover-editor-room-zoom';
const ROOM_MIN_ZOOM = .25;
const ROOM_MAX_ZOOM = 4;
const ROOM_GRID_STORAGE_KEY = 'pokediscover-editor-room-grid';
const CELL_MENU_DISMISS_DISTANCE = 100;

function objectClass(object: PokeDiscoverTiledObject) {
  return String(object.class || object.type || '');
}

function mapGeometry(tilemap: PokeDiscoverEditableTiledMap) {
  return tilemap.layers.flatMap(layer => {
    if (!['Collision', 'Anchors', 'Paths', 'Occlusion'].includes(String(layer.name))) return [];
    const layerName = layer.name as PokeDiscoverObjectLayerName;
    return (Array.isArray(layer.objects) ? layer.objects : [])
      .filter(object => Number.isFinite(Number(object.id)))
      .map(object => ({ layerName, object: object as PokeDiscoverTiledObject }));
  });
}

function snap(value: number, free: boolean) {
  return free ? Math.round(value * 10) / 10 : Math.round(value / 16) * 16;
}

function objectPoints(
  object: PokeDiscoverTiledObject,
  key: 'polygon' | 'polyline',
) {
  return object[key]?.map(point => {
    const transformed = transformTiledObjectPoint(object, point);
    return `${transformed.x},${transformed.y}`;
  }).join(' ') ?? '';
}

function layerClass(layerName: PokeDiscoverObjectLayerName) {
  return `is-${layerName.toLocaleLowerCase()}`;
}

function simplifyOrthogonalPoints(points: PokeDiscoverGeometryPoint[]) {
  return points.filter((point, index) => {
    if (index === 0 || index === points.length - 1) return true;
    const previous = points[index - 1];
    const next = points[index + 1];
    return !((previous.x === point.x && point.x === next.x)
      || (previous.y === point.y && point.y === next.y));
  });
}

function CenterIcon() {
  return <svg aria-hidden="true" viewBox="0 0 20 20"><circle cx="10" cy="10" r="6" /><circle cx="10" cy="10" r="2" /><path d="M10 1v3M10 16v3M1 10h3M16 10h3" /></svg>;
}

function GridIcon() {
  return <svg aria-hidden="true" viewBox="0 0 20 20"><path d="M2 2h16v16H2zM2 8h16M2 14h16M8 2v16M14 2v16" /></svg>;
}

export function MapAuthoringCanvas({
  bundle,
  sectorId,
  tilemap,
  mode,
  onModeChange,
  onTilemapChange,
  onDeleteObject,
  selectedObjectId,
  onOpenObject,
  onOpenPlacement,
  onCellCommand,
  canCreateExit,
  directAuthoringGesture,
  onConnectEdge,
  placementGhost,
}: {
  bundle: LoadedAdventureMapBundle;
  sectorId: string;
  tilemap: PokeDiscoverEditableTiledMap;
  mode: 'design' | 'test';
  onModeChange: (mode: 'design' | 'test') => void;
  onTilemapChange: (tilemap: PokeDiscoverEditableTiledMap, description: string) => void;
  onDeleteObject: (object: PokeDiscoverTiledObject) => void;
  selectedObjectId?: number;
  onOpenObject: (objectId?: number) => void;
  onOpenPlacement: (placementId: string, kind: 'encounter' | 'npc' | 'portal' | 'secret' | 'trigger') => void;
  onCellCommand: (command: PokeDiscoverCellCommand, cell: PokeDiscoverCellSelection) => void;
  canCreateExit: (cell: PokeDiscoverCellSelection) => boolean;
  directAuthoringGesture: 'direct' | 'shift';
  onConnectEdge: (edge: 'left' | 'right' | 'top' | 'bottom', start: number, length: number) => void;
  placementGhost?: { anchorId: string; label: string; scalePercent: number };
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<PokeDiscoverCanvasTool>('select');
  const [zoom, setZoom] = useState(() => readPokeDiscoverCameraZoom(
    ROOM_ZOOM_STORAGE_KEY,
    2,
    ROOM_MIN_ZOOM,
    ROOM_MAX_ZOOM,
  ));
  const zoomRef = useRef(zoom);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [draftStart, setDraftStart] = useState<PokeDiscoverGeometryPoint>();
  const [draftCurrent, setDraftCurrent] = useState<PokeDiscoverGeometryPoint>();
  const [draftPoints, setDraftPoints] = useState<PokeDiscoverGeometryPoint[]>([]);
  const [movePreview, setMovePreview] = useState<{ objectId: number; x: number; y: number }>();
  const [visibleLayers, setVisibleLayers] = useState<Set<PokeDiscoverObjectLayerName>>(
    () => new Set(['Anchors', 'Paths']),
  );
  const [showGrid, setShowGrid] = useState(() => {
    try {
      return window.localStorage.getItem(ROOM_GRID_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [cellMenu, setCellMenu] = useState<(PokeDiscoverCellSelection & { left: number; top: number })>();
  const cellMenuRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ x: number; y: number; ox: number; oy: number } | undefined>(undefined);
  const moveRef = useRef<{
    objectId: number;
    x: number;
    y: number;
    objectX: number;
    objectY: number;
  } | undefined>(undefined);
  const cellGestureRef = useRef<{
    pointerId: number;
    clientX: number;
    clientY: number;
    points: PokeDiscoverGeometryPoint[];
    dragging: boolean;
  } | undefined>(undefined);
  const mapWidth = tilemap.width * tilemap.tilewidth;
  const mapHeight = tilemap.height * tilemap.tileheight;
  const objects = useMemo(() => mapGeometry(tilemap), [tilemap]);
  const selected = objects.find(candidate => candidate.object.id === selectedObjectId);
  const ghostAnchor = placementGhost
    ? objects.find(candidate => candidate.layerName === 'Anchors' && candidate.object.name === placementGhost.anchorId)?.object
    : undefined;
  const room = bundle.sectors.find(candidate => candidate.sector.sectorId === sectorId);
  const markers = room ? getPokeDiscoverEditorContentMarkers(bundle, room) : [];
  const validSpawnIds = new Set(objects
    .filter(candidate => candidate.layerName === 'Anchors'
      && ['PlayerSpawn', 'TransitionAnchor'].includes(objectClass(candidate.object)))
    .map(candidate => candidate.object.name));
  const canTest = Boolean(room?.sector.spawnAnchorIds.some(anchorId => validSpawnIds.has(anchorId)));
  const centeredOffset = viewportRef.current ? centerPokeDiscoverCamera({
    viewportWidth: viewportRef.current.clientWidth,
    viewportHeight: viewportRef.current.clientHeight,
    contentWidth: mapWidth,
    contentHeight: mapHeight,
    zoom,
  }) : offset;
  const isCentered = Math.abs(centeredOffset.x - offset.x) < .5
    && Math.abs(centeredOffset.y - offset.y) < .5;

  useEffect(() => {
    if (mode === 'test' && !canTest) onModeChange('design');
  }, [canTest, mode, onModeChange]);

  const recenter = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    setOffset(centerPokeDiscoverCamera({
      viewportWidth: viewport.clientWidth,
      viewportHeight: viewport.clientHeight,
      contentWidth: mapWidth,
      contentHeight: mapHeight,
      zoom: zoomRef.current,
    }));
  }, [mapHeight, mapWidth]);

  const changeZoom = useCallback((
    requestedZoom: number,
    clientPoint?: PokeDiscoverGeometryPoint,
  ) => {
    const viewport = viewportRef.current;
    const nextZoom = clampPokeDiscoverCameraZoom(
      Math.round(requestedZoom * 100) / 100,
      ROOM_MIN_ZOOM,
      ROOM_MAX_ZOOM,
    );
    if (!viewport || nextZoom === zoomRef.current) return;
    const bounds = viewport.getBoundingClientRect();
    const focalPoint = clientPoint
      ? { x: clientPoint.x - bounds.left, y: clientPoint.y - bounds.top }
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
    writePokeDiscoverCameraZoom(ROOM_ZOOM_STORAGE_KEY, zoom);
  }, [zoom]);

  useEffect(() => {
    try {
      window.localStorage.setItem(ROOM_GRID_STORAGE_KEY, String(showGrid));
    } catch {
      // La preferencia es opcional.
    }
  }, [showGrid]);

  useEffect(() => {
    if (!cellMenu) return undefined;
    const closeWhenPointerLeavesSafetyArea = (event: PointerEvent) => {
      const bounds = cellMenuRef.current?.getBoundingClientRect();
      if (!bounds) return;
      if (event.clientX < bounds.left - CELL_MENU_DISMISS_DISTANCE
        || event.clientX > bounds.right + CELL_MENU_DISMISS_DISTANCE
        || event.clientY < bounds.top - CELL_MENU_DISMISS_DISTANCE
        || event.clientY > bounds.bottom + CELL_MENU_DISMISS_DISTANCE) {
        setCellMenu(undefined);
      }
    };
    window.addEventListener('pointermove', closeWhenPointerLeavesSafetyArea);
    return () => window.removeEventListener('pointermove', closeWhenPointerLeavesSafetyArea);
  }, [cellMenu]);

  const chooseTool = (nextTool: PokeDiscoverCanvasTool) => {
    setTool(nextTool);
    setDraftPoints([]);
    setDraftStart(undefined);
    setCellMenu(undefined);
    const layer: PokeDiscoverObjectLayerName | undefined = nextTool.startsWith('collision')
      ? 'Collision'
      : nextTool === 'connection'
        ? 'Anchors'
        : undefined;
    if (layer) setVisibleLayers(current => new Set([...current, layer]));
  };

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
  }, [recenter, sectorId]);

  useEffect(() => {
    onOpenObject(undefined);
    setDraftPoints([]);
    setDraftStart(undefined);
  }, [sectorId]);

  useEffect(() => {
    const selectTool = (event: Event) => {
      const requested = (event as CustomEvent<{ tool?: PokeDiscoverCanvasTool }>).detail?.tool;
      if (!requested || !POKEDISCOVER_CANVAS_TOOLS.some(option => option.tool === requested)) return;
      chooseTool(requested);
    };
    window.addEventListener('pokediscover:select-map-tool', selectTool);
    return () => window.removeEventListener('pokediscover:select-map-tool', selectTool);
  }, []);

  const pointFromEvent = (event: ReactPointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(mapWidth, Math.max(0, snap((event.clientX - bounds.left) * mapWidth / bounds.width, event.altKey))),
      y: Math.min(mapHeight, Math.max(0, snap((event.clientY - bounds.top) * mapHeight / bounds.height, event.altKey))),
    };
  };

  const cellFromEvent = (event: ReactPointerEvent<SVGSVGElement>): PokeDiscoverCellSelection => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const rawX = Math.min(mapWidth - .001, Math.max(0, (event.clientX - bounds.left) * mapWidth / bounds.width));
    const rawY = Math.min(mapHeight - .001, Math.max(0, (event.clientY - bounds.top) * mapHeight / bounds.height));
    const column = Math.floor(rawX / tilemap.tilewidth);
    const row = Math.floor(rawY / tilemap.tileheight);
    const start = { x: column * tilemap.tilewidth, y: row * tilemap.tileheight };
    const end = { x: start.x + tilemap.tilewidth, y: start.y + tilemap.tileheight };
    const edge = column === 0
      ? 'left'
      : column === tilemap.width - 1
        ? 'right'
        : row === 0
          ? 'top'
          : row === tilemap.height - 1
            ? 'bottom'
            : undefined;
    return {
      start,
      end,
      center: { x: start.x + tilemap.tilewidth / 2, y: start.y + tilemap.tileheight / 2 },
      edge,
    };
  };

  const finishLineTool = (points = draftPoints) => {
    try {
      if (tool === 'collision-polygon') {
        const result = addPokeDiscoverCollisionPolygon(tilemap, points);
        onTilemapChange(result.tilemap, 'Crear colisión poligonal');
      }
      setDraftPoints([]);
      setDraftCurrent(undefined);
    } catch {
      // La ayuda contextual sigue indicando cuántos puntos faltan.
    }
  };

  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && draftPoints.length) finishLineTool();
      if (event.key === 'Escape') {
        setDraftPoints([]);
        setDraftStart(undefined);
        setDraftCurrent(undefined);
        setCellMenu(undefined);
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && selected
        && !(event.target instanceof HTMLElement && event.target.closest('input, textarea, select'))) {
        event.preventDefault();
        onDeleteObject(selected.object);
      }
    };
    window.addEventListener('keydown', keyboard);
    return () => window.removeEventListener('keydown', keyboard);
  });

  const startSurfaceAction = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (mode !== 'design') return;
    if (event.button !== 0) return;
    if (tool === 'pan') return;
    const point = pointFromEvent(event);
    if (tool === 'select') {
      if (cellMenu) {
        setCellMenu(undefined);
        return;
      }
      onOpenObject(undefined);
      if (directAuthoringGesture === 'shift' && !event.shiftKey) return;
      const cell = cellFromEvent(event);
      cellGestureRef.current = {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        points: [cell.center],
        dragging: false,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    if (tool === 'collision-polygon') {
      setDraftPoints(current => [...current, point]);
      setDraftCurrent(point);
      return;
    }
    setDraftStart(point);
    setDraftCurrent(point);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const finishSurfaceAction = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!draftStart) return;
    const end = pointFromEvent(event);
    try {
      if (tool === 'collision-rectangle') {
        const result = addPokeDiscoverCollisionRectangle(tilemap, draftStart, end);
        onTilemapChange(result.tilemap, 'Crear colisión rectangular');
      } else if (tool === 'connection') {
        const center = {
          x: (draftStart.x + end.x) / 2,
          y: (draftStart.y + end.y) / 2,
        };
        const distances = [
          { edge: 'left' as const, distance: center.x },
          { edge: 'right' as const, distance: mapWidth - center.x },
          { edge: 'top' as const, distance: center.y },
          { edge: 'bottom' as const, distance: mapHeight - center.y },
        ];
        const edge = distances.sort((left, right) => left.distance - right.distance)[0].edge;
        const horizontal = edge === 'top' || edge === 'bottom';
        const start = horizontal ? Math.min(draftStart.x, end.x) : Math.min(draftStart.y, end.y);
        const length = Math.max(16, horizontal
          ? Math.abs(end.x - draftStart.x)
          : Math.abs(end.y - draftStart.y));
        onConnectEdge(edge, start, length);
      }
    } finally {
      setDraftStart(undefined);
      setDraftCurrent(undefined);
    }
  };

  return (
    <section className="editor-map-authoring" aria-label="Editor visual de la sector">
      <div className="editor-modebar">
        <div role="group" aria-label="Modo de trabajo">
          <button type="button" aria-pressed={mode === 'design'} onClick={() => onModeChange('design')}>Diseñar</button>
          <button
            type="button"
            aria-pressed={mode === 'test'}
            disabled={!canTest}
            title={canTest ? 'Recorrer la sector' : 'Crea primero una entrada del jugador o una salida'}
            onClick={() => onModeChange('test')}
          >Probar</button>
        </div>
        <span>{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => changeZoom(zoomRef.current - .1)} aria-label="Alejar">−</button>
        <button type="button" onClick={() => changeZoom(zoomRef.current + .1)} aria-label="Acercar">+</button>
        <button type="button" onClick={recenter}>Recentrar</button>
      </div>
      {mode === 'design' ? (
        <div className="editor-toolstrip" role="toolbar" aria-label="Herramientas del mapa">
          {POKEDISCOVER_CANVAS_TOOLS.map(option => (
            <button
              key={option.tool}
              type="button"
              className="editor-tool-command"
              title={option.label}
              aria-pressed={tool === option.tool}
              onClick={() => chooseTool(option.tool)}
            >{option.short}</button>
          ))}
          <div className="editor-layer-toggles" role="group" aria-label="Geometría visible">
            {([
              ['Anchors', 'Anclas'],
              ['Collision', 'Colisiones'],
              ['Paths', 'Rutas'],
              ['Occlusion', 'Oclusiones'],
            ] as const).map(([layerName, layerLabel]) => (
              <button
                key={layerName}
                type="button"
                aria-pressed={visibleLayers.has(layerName)}
                onClick={() => setVisibleLayers(current => {
                  const next = new Set(current);
                  if (next.has(layerName)) next.delete(layerName);
                  else next.add(layerName);
                  return next;
                })}
              >{layerLabel}</button>
            ))}
          </div>
          {draftPoints.length ? (
            <button type="button" className="is-primary" onClick={() => finishLineTool()}>
              Terminar ({draftPoints.length} puntos)
            </button>
          ) : null}
        </div>
      ) : <div className="editor-toolstrip is-test-hint">Usa las flechas o WASD para recorrer la sector.</div>}
      <div
        ref={viewportRef}
        className={`editor-map-viewport${mode === 'test' ? ' is-testing' : ''}${tool === 'pan' && mode === 'design' ? ' is-pan-tool' : ''}`}
        data-camera-zoom={zoom}
        data-camera-offset-x={offset.x}
        data-camera-offset-y={offset.y}
        onPointerDown={event => {
          const middleButton = event.button === 1;
          if ((!middleButton && (tool !== 'pan' || mode !== 'design')) || panRef.current) return;
          event.preventDefault();
          panRef.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={event => {
          if (panRef.current) {
            setOffset({
              x: panRef.current.ox + event.clientX - panRef.current.x,
              y: panRef.current.oy + event.clientY - panRef.current.y,
            });
          }
        }}
        onPointerUp={() => { panRef.current = undefined; }}
        onPointerCancel={() => { panRef.current = undefined; }}
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
            data-tooltip="Zoom: cambia el tamaño visual del mapa sin alterar sus tiles."
          >
            <input
              type="range"
              min={ROOM_MIN_ZOOM}
              max={ROOM_MAX_ZOOM}
              step=".05"
              value={zoom}
              aria-label="Zoom de la sector"
              onChange={event => changeZoom(Number(event.target.value))}
            />
            <output>{Math.round(zoom * 100)}%</output>
          </span>
          <span
            className="editor-control-tooltip"
            data-tooltip={isCentered
              ? 'El mapa ya está centrado.'
              : 'Centra el mapa conservando el zoom actual.'}
          >
            <button
              type="button"
              className={isCentered ? '' : 'is-actionable'}
              disabled={isCentered}
              onClick={recenter}
              aria-label="Centrar sector"
            ><CenterIcon /></button>
          </span>
          <span
            className="editor-control-tooltip"
            data-tooltip={showGrid
              ? 'Oculta la rejilla de tiles del mapa.'
              : 'Muestra una rejilla alineada con los tiles del mapa.'}
          >
            <button
              type="button"
              aria-pressed={showGrid}
              onClick={() => setShowGrid(current => !current)}
              aria-label="Mostrar grilla"
            ><GridIcon /></button>
          </span>
        </div>
        {cellMenu ? <div
          ref={cellMenuRef}
          className="editor-cell-menu"
          style={{ left: cellMenu.left, top: cellMenu.top }}
          role="menu"
          aria-label="Añadir en la celda"
          onPointerDown={event => event.stopPropagation()}
        >
          <strong>Añadir aquí</strong>
          {([
            ['pokemon', 'Pokémon'],
            ['npc', 'Personaje / NPC'],
            ['entry', 'Entrada del jugador'],
            ['exit', 'Salida'],
            ['interaction', 'Interacción'],
            ['secret', 'Secreto'],
            ['collision', 'Colisión'],
          ] as const).map(([command, commandLabel]) => <button
            key={command}
            type="button"
            role="menuitem"
            disabled={command === 'exit' && !canCreateExit(cellMenu)}
            title={command === 'exit' && !canCreateExit(cellMenu) ? 'Esta celda no comparte borde con otra sector' : undefined}
            onClick={() => {
              onCellCommand(command, cellMenu);
              setCellMenu(undefined);
            }}
          >{commandLabel}</button>)}
        </div> : null}
        <div
          className="editor-map-surface"
          style={{
            width: mapWidth,
            height: mapHeight,
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
          }}
        >
          <RuntimePreview bundle={bundle} sectorId={sectorId} designMode={mode === 'design'} />
          {mode === 'design' ? (
            <svg
              className="editor-geometry-overlay"
              viewBox={`0 0 ${mapWidth} ${mapHeight}`}
              onPointerDown={startSurfaceAction}
              onPointerMove={event => {
                setDraftCurrent(pointFromEvent(event));
                const gesture = cellGestureRef.current;
                if (gesture) {
                  const distance = Math.hypot(event.clientX - gesture.clientX, event.clientY - gesture.clientY);
                  if (distance >= 6) gesture.dragging = true;
                  if (gesture.dragging) {
                    const next = cellFromEvent(event).center;
                    const previous = gesture.points.at(-1)!;
                    if (previous.x !== next.x || previous.y !== next.y) {
                      if (previous.x !== next.x && previous.y !== next.y) {
                        gesture.points.push({ x: next.x, y: previous.y });
                      }
                      gesture.points.push(next);
                      gesture.points = simplifyOrthogonalPoints(gesture.points);
                    }
                    setDraftPoints([...gesture.points]);
                  }
                  return;
                }
                const moving = moveRef.current;
                if (!moving) return;
                const point = pointFromEvent(event);
                setMovePreview({
                  objectId: moving.objectId,
                  x: moving.objectX + point.x - moving.x,
                  y: moving.objectY + point.y - moving.y,
                });
              }}
              onPointerUp={event => {
                const gesture = cellGestureRef.current;
                if (gesture) {
                  cellGestureRef.current = undefined;
                  if (!gesture.dragging) {
                    const cell = cellFromEvent(event);
                    const viewport = viewportRef.current;
                    setCellMenu({
                      ...cell,
                      left: Math.min(Math.max(8, event.clientX - (viewport?.getBoundingClientRect().left ?? 0)), Math.max(8, (viewport?.clientWidth ?? 240) - 230)),
                      top: Math.min(Math.max(8, event.clientY - (viewport?.getBoundingClientRect().top ?? 0)), Math.max(8, (viewport?.clientHeight ?? 320) - 330)),
                    });
                  } else setDraftPoints([]);
                  return;
                }
                if (moveRef.current && movePreview) {
                  onTilemapChange(updatePokeDiscoverTiledObject(
                    tilemap,
                    moveRef.current.objectId,
                    object => ({ ...object, x: movePreview.x, y: movePreview.y }),
                  ), 'Mover objeto');
                }
                moveRef.current = undefined;
                setMovePreview(undefined);
                finishSurfaceAction(event);
              }}
              onDoubleClick={() => {
                if (draftPoints.length) finishLineTool(draftPoints);
              }}
              onPointerCancel={() => {
                cellGestureRef.current = undefined;
                moveRef.current = undefined;
                setMovePreview(undefined);
                setDraftPoints([]);
              }}
            >
              {showGrid ? <>
                <defs>
                  <pattern id={`editor-grid-${sectorId.replaceAll(':', '-')}`} width={tilemap.tilewidth} height={tilemap.tileheight} patternUnits="userSpaceOnUse">
                    <path
                      className="editor-map-grid-line"
                      d={`M 0 0 H ${tilemap.tilewidth} M 0 0 V ${tilemap.tileheight}`}
                    />
                  </pattern>
                </defs>
                <rect
                  className="editor-map-grid"
                  x={-tilemap.tilewidth}
                  y={-tilemap.tileheight}
                  width={mapWidth + tilemap.tilewidth * 2}
                  height={mapHeight + tilemap.tileheight * 2}
                  fill={`url(#editor-grid-${sectorId.replaceAll(':', '-')})`}
                  pointerEvents="none"
                />
                <rect
                  className="editor-map-grid-line"
                  x={-tilemap.tilewidth}
                  y={-tilemap.tileheight}
                  width={mapWidth + tilemap.tilewidth * 2}
                  height={mapHeight + tilemap.tileheight * 2}
                  pointerEvents="none"
                />
              </> : null}
              {objects.filter(candidate => visibleLayers.has(candidate.layerName)).map(({ layerName, object }) => {
                const className = `editor-geometry-object ${layerClass(layerName)}${object.id === selectedObjectId ? ' is-selected' : ''}`;
                const preview = movePreview?.objectId === object.id ? movePreview : undefined;
                const transform = preview ? `translate(${preview.x - object.x} ${preview.y - object.y})` : undefined;
                const common = {
                  className,
                  transform,
                  onPointerDown: (event: ReactPointerEvent<SVGElement>) => {
                    if (tool !== 'select' || event.button !== 0) return;
                    event.stopPropagation();
                    onOpenObject(object.id);
                    const bounds = event.currentTarget.ownerSVGElement!.getBoundingClientRect();
                    const x = snap((event.clientX - bounds.left) * mapWidth / bounds.width, event.altKey);
                    const y = snap((event.clientY - bounds.top) * mapHeight / bounds.height, event.altKey);
                    moveRef.current = { objectId: object.id, x, y, objectX: object.x, objectY: object.y };
                    setMovePreview({ objectId: object.id, x: object.x, y: object.y });
                  },
                };
                if (object.polygon) return <polygon key={object.id} {...common} points={objectPoints(object, 'polygon')} />;
                if (object.polyline) return <polyline key={object.id} {...common} points={objectPoints(object, 'polyline')} />;
                if (object.point || (!object.width && !object.height)) {
                  return <circle key={object.id} {...common} cx={object.x} cy={object.y} r={7} />;
                }
                return <rect
                  key={object.id}
                  {...common}
                  transform={[
                    transform,
                    object.rotation ? `rotate(${object.rotation} ${object.x} ${object.y})` : '',
                  ].filter(Boolean).join(' ') || undefined}
                  x={object.x}
                  y={object.y}
                  width={object.width}
                  height={object.height}
                />;
              })}
              {draftStart && draftCurrent ? (
                <rect
                  className="editor-geometry-draft"
                  x={Math.min(draftStart.x, draftCurrent.x)}
                  y={Math.min(draftStart.y, draftCurrent.y)}
                  width={Math.abs(draftCurrent.x - draftStart.x)}
                  height={Math.abs(draftCurrent.y - draftStart.y)}
                />
              ) : null}
              {draftPoints.length ? (
                <polyline
                  className="editor-geometry-draft"
                  points={[...draftPoints, ...(draftCurrent ? [draftCurrent] : [])].map(point => `${point.x},${point.y}`).join(' ')}
                />
              ) : null}
              {markers.map(marker => (
                <g
                  key={`${marker.kind}:${marker.contentId}`}
                  className={`editor-content-marker is-${marker.kind}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Editar colocación ${marker.contentId}`}
                  onPointerDown={event => {
                    event.stopPropagation();
                    onOpenPlacement(marker.contentId, marker.kind);
                  }}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') onOpenPlacement(marker.contentId, marker.kind);
                  }}
                >
                  <circle cx={marker.x} cy={marker.y} r={8} />
                  <text x={marker.x} y={marker.y + 3}>{marker.kind === 'encounter' ? 'P' : 'C'}</text>
                </g>
              ))}
              {placementGhost && ghostAnchor ? (
                <g className="editor-placement-ghost" pointerEvents="none">
                  <circle
                    cx={ghostAnchor.x + ghostAnchor.width / 2}
                    cy={ghostAnchor.y + ghostAnchor.height}
                    r={Math.max(8, 10 * Math.sqrt(placementGhost.scalePercent / 100))}
                  />
                  <text
                    x={ghostAnchor.x + ghostAnchor.width / 2}
                    y={ghostAnchor.y + ghostAnchor.height + 3}
                  >+</text>
                  <title>{placementGhost.label} · {placementGhost.scalePercent}%</title>
                </g>
              ) : null}
            </svg>
          ) : null}
        </div>
      </div>
    </section>
  );
}
