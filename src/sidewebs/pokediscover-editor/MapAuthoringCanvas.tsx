import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { LoadedAdventureMapBundle } from '../../domain/maps/loadAdventureBundle.js';
import { getPokeDiscoverEditorContentMarkers } from '../../domain/tools/pokeDiscoverEditorContent.js';
import {
  addPokeDiscoverAnchor,
  addPokeDiscoverCollisionPolygon,
  addPokeDiscoverCollisionRectangle,
  addPokeDiscoverOccluder,
  addPokeDiscoverPath,
  type PokeDiscoverAnchorKind,
  type PokeDiscoverGeometryPoint,
} from '../../domain/tools/pokeDiscoverEditorGeometry.js';
import {
  updatePokeDiscoverTiledObject,
  type PokeDiscoverEditableTiledMap,
  type PokeDiscoverObjectLayerName,
  type PokeDiscoverTiledObject,
} from '../../domain/tools/pokeDiscoverEditorProject.js';
import { RuntimePreview } from './RuntimePreview.js';

export type PokeDiscoverCanvasTool =
  | 'select'
  | 'pan'
  | 'anchor'
  | 'collision-rectangle'
  | 'collision-polygon'
  | 'path'
  | 'connection'
  | 'occlusion-rectangle'
  | 'occlusion-polygon';

interface GeometryObject {
  layerName: PokeDiscoverObjectLayerName;
  object: PokeDiscoverTiledObject;
}

const TOOL_LABELS: Array<{ tool: PokeDiscoverCanvasTool; label: string; short: string }> = [
  { tool: 'select', label: 'Seleccionar y mover', short: 'Seleccionar' },
  { tool: 'pan', label: 'Desplazar lienzo', short: 'Mano' },
  { tool: 'anchor', label: 'Crear ancla', short: 'Ancla' },
  { tool: 'collision-rectangle', label: 'Dibujar colisión rectangular', short: 'Colisión ▭' },
  { tool: 'collision-polygon', label: 'Dibujar colisión poligonal', short: 'Colisión ⬠' },
  { tool: 'path', label: 'Dibujar ruta', short: 'Ruta' },
  { tool: 'connection', label: 'Conectar con la habitación contigua', short: 'Salida' },
  { tool: 'occlusion-rectangle', label: 'Dibujar oclusión rectangular', short: 'Oclusión ▭' },
  { tool: 'occlusion-polygon', label: 'Dibujar oclusión poligonal', short: 'Oclusión ⬠' },
];

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
  return object[key]?.map(point => `${object.x + point.x},${object.y + point.y}`).join(' ') ?? '';
}

function layerClass(layerName: PokeDiscoverObjectLayerName) {
  return `is-${layerName.toLocaleLowerCase()}`;
}

export function MapAuthoringCanvas({
  bundle,
  roomId,
  tilemap,
  mode,
  onModeChange,
  onTilemapChange,
  onDeleteObject,
  onOpenPlacement,
  onConnectEdge,
  placementGhost,
}: {
  bundle: LoadedAdventureMapBundle;
  roomId: string;
  tilemap: PokeDiscoverEditableTiledMap;
  mode: 'design' | 'test';
  onModeChange: (mode: 'design' | 'test') => void;
  onTilemapChange: (tilemap: PokeDiscoverEditableTiledMap, description: string) => void;
  onDeleteObject: (object: PokeDiscoverTiledObject) => void;
  onOpenPlacement: (placementId: string) => void;
  onConnectEdge: (edge: 'left' | 'right' | 'top' | 'bottom', start: number, length: number) => void;
  placementGhost?: { anchorId: string; label: string; scalePercent: number };
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<PokeDiscoverCanvasTool>('select');
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [selectedId, setSelectedId] = useState<number>();
  const [draftStart, setDraftStart] = useState<PokeDiscoverGeometryPoint>();
  const [draftCurrent, setDraftCurrent] = useState<PokeDiscoverGeometryPoint>();
  const [draftPoints, setDraftPoints] = useState<PokeDiscoverGeometryPoint[]>([]);
  const [label, setLabel] = useState('nuevo');
  const [anchorKind, setAnchorKind] = useState<PokeDiscoverAnchorKind>('ActorAnchor');
  const [anchorShape, setAnchorShape] = useState<'point' | 'rectangle'>('point');
  const [movePreview, setMovePreview] = useState<{ objectId: number; x: number; y: number }>();
  const [visibleLayers, setVisibleLayers] = useState<Set<PokeDiscoverObjectLayerName>>(
    () => new Set(['Anchors', 'Paths']),
  );
  const panRef = useRef<{ x: number; y: number; ox: number; oy: number } | undefined>(undefined);
  const moveRef = useRef<{
    objectId: number;
    x: number;
    y: number;
    objectX: number;
    objectY: number;
  } | undefined>(undefined);
  const mapWidth = tilemap.width * tilemap.tilewidth;
  const mapHeight = tilemap.height * tilemap.tileheight;
  const objects = useMemo(() => mapGeometry(tilemap), [tilemap]);
  const selected = objects.find(candidate => candidate.object.id === selectedId);
  const ghostAnchor = placementGhost
    ? objects.find(candidate => candidate.layerName === 'Anchors' && candidate.object.name === placementGhost.anchorId)?.object
    : undefined;
  const room = bundle.rooms.find(candidate => candidate.room.roomId === roomId);
  const markers = room ? getPokeDiscoverEditorContentMarkers(bundle, room) : [];
  const validSpawnIds = new Set(objects
    .filter(candidate => candidate.layerName === 'Anchors'
      && ['PlayerSpawn', 'TransitionAnchor'].includes(objectClass(candidate.object)))
    .map(candidate => candidate.object.name));
  const canTest = Boolean(room?.room.spawnAnchorIds.some(anchorId => validSpawnIds.has(anchorId)));

  useEffect(() => {
    if (mode === 'test' && !canTest) onModeChange('design');
  }, [canTest, mode, onModeChange]);

  const recenter = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const nextZoom = Math.min(
      2,
      Math.max(.35, Math.min((viewport.clientWidth - 56) / mapWidth, (viewport.clientHeight - 56) / mapHeight)),
    );
    setZoom(nextZoom);
    setOffset({
      x: (viewport.clientWidth - mapWidth * nextZoom) / 2,
      y: (viewport.clientHeight - mapHeight * nextZoom) / 2,
    });
  };

  const chooseTool = (nextTool: PokeDiscoverCanvasTool) => {
    setTool(nextTool);
    setDraftPoints([]);
    setDraftStart(undefined);
    const layer: PokeDiscoverObjectLayerName | undefined = nextTool.startsWith('collision')
      ? 'Collision'
      : nextTool.startsWith('occlusion')
        ? 'Occlusion'
        : nextTool === 'path'
          ? 'Paths'
          : nextTool === 'anchor' || nextTool === 'connection'
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
  }, [mapHeight, mapWidth, roomId]);

  useEffect(() => {
    setSelectedId(undefined);
    setDraftPoints([]);
    setDraftStart(undefined);
  }, [roomId]);

  useEffect(() => {
    const selectTool = (event: Event) => {
      const requested = (event as CustomEvent<{ tool?: PokeDiscoverCanvasTool }>).detail?.tool;
      if (!requested || !TOOL_LABELS.some(option => option.tool === requested)) return;
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

  const finishLineTool = (points = draftPoints) => {
    try {
      if (tool === 'collision-polygon') {
        const result = addPokeDiscoverCollisionPolygon(tilemap, points, label);
        onTilemapChange(result.tilemap, 'Crear colisión poligonal');
      } else if (tool === 'occlusion-polygon') {
        const result = addPokeDiscoverOccluder(tilemap, {
          label,
          groupId: `occlusion-group:${label.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-') || 'nuevo'}`,
          points,
        });
        onTilemapChange(result.tilemap, 'Crear oclusión poligonal');
      } else if (tool === 'path') {
        const result = addPokeDiscoverPath(tilemap, points, label);
        onTilemapChange(result.tilemap, 'Crear ruta');
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
    const point = pointFromEvent(event);
    if (tool === 'select') {
      setSelectedId(undefined);
      return;
    }
    if (tool === 'anchor') {
      if (anchorShape === 'rectangle') {
        setDraftStart(point);
        setDraftCurrent(point);
        event.currentTarget.setPointerCapture(event.pointerId);
      } else {
        const result = addPokeDiscoverAnchor(tilemap, {
          kind: anchorKind,
          label,
          x: point.x,
          y: point.y,
        });
        setSelectedId(result.object.id);
        onTilemapChange(result.tilemap, 'Crear ancla');
      }
      return;
    }
    if (tool === 'collision-polygon' || tool === 'occlusion-polygon' || tool === 'path') {
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
        const result = addPokeDiscoverCollisionRectangle(tilemap, draftStart, end, label);
        onTilemapChange(result.tilemap, 'Crear colisión rectangular');
      } else if (tool === 'anchor') {
        const x = Math.min(draftStart.x, end.x);
        const y = Math.min(draftStart.y, end.y);
        const result = addPokeDiscoverAnchor(tilemap, {
          kind: anchorKind,
          label,
          x,
          y,
          width: Math.max(16, Math.abs(end.x - draftStart.x)),
          height: Math.max(16, Math.abs(end.y - draftStart.y)),
        });
        setSelectedId(result.object.id);
        onTilemapChange(result.tilemap, 'Crear ancla rectangular');
      } else if (tool === 'occlusion-rectangle') {
        const result = addPokeDiscoverOccluder(tilemap, {
          label,
          groupId: `occlusion-group:${label.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-') || 'nuevo'}`,
          start: draftStart,
          end,
        });
        onTilemapChange(result.tilemap, 'Crear oclusión rectangular');
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

  const selectedValue = (field: 'x' | 'y' | 'width' | 'height') => Number(selected?.object[field]) || 0;
  const updateSelectedNumber = (field: 'x' | 'y' | 'width' | 'height', value: number) => {
    if (!selected) return;
    onTilemapChange(updatePokeDiscoverTiledObject(
      tilemap,
      selected.object.id,
      object => ({ ...object, [field]: value }),
    ), `Cambiar ${field === 'width' || field === 'height' ? 'tamaño' : 'posición'}`);
  };

  return (
    <section className="editor-map-authoring" aria-label="Editor visual de la habitación">
      <div className="editor-modebar">
        <div role="group" aria-label="Modo de trabajo">
          <button type="button" aria-pressed={mode === 'design'} onClick={() => onModeChange('design')}>Diseñar</button>
          <button
            type="button"
            aria-pressed={mode === 'test'}
            disabled={!canTest}
            title={canTest ? 'Recorrer la habitación' : 'Crea primero una entrada del jugador o una salida'}
            onClick={() => onModeChange('test')}
          >Probar</button>
        </div>
        <span>{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => setZoom(value => Math.max(.25, value - .1))} aria-label="Alejar">−</button>
        <button type="button" onClick={() => setZoom(value => Math.min(4, value + .1))} aria-label="Acercar">+</button>
        <button type="button" onClick={recenter}>Recentrar</button>
      </div>
      {mode === 'design' ? (
        <div className="editor-toolstrip" role="toolbar" aria-label="Herramientas del mapa">
          {TOOL_LABELS.map(option => (
            <button
              key={option.tool}
              type="button"
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
          {tool !== 'select' && tool !== 'pan' && tool !== 'connection' ? (
            <label><span>Nombre</span><input value={label} onChange={event => setLabel(event.target.value)} /></label>
          ) : null}
          {tool === 'anchor' ? (
            <>
              <label><span>Uso del ancla</span><select value={anchorKind} onChange={event => setAnchorKind(event.target.value as PokeDiscoverAnchorKind)}>
                <option value="PlayerSpawn">Entrada del jugador</option>
                <option value="TransitionAnchor">Salida a otra habitación</option>
                <option value="ActorAnchor">Colocación de personaje</option>
                <option value="EncounterAnchor">Encuentro Pokémon</option>
                <option value="InteractionAnchor">Interacción</option>
                <option value="SecretAnchor">Secreto</option>
              </select></label>
              <label><span>Forma</span><select value={anchorShape} onChange={event => setAnchorShape(event.target.value as typeof anchorShape)}>
                <option value="point">Punto</option>
                <option value="rectangle">Área rectangular</option>
              </select></label>
            </>
          ) : null}
          {draftPoints.length ? (
            <button type="button" className="is-primary" onClick={() => finishLineTool()}>
              Terminar ({draftPoints.length} puntos)
            </button>
          ) : null}
        </div>
      ) : <div className="editor-toolstrip is-test-hint">Usa las flechas o WASD para recorrer la habitación.</div>}
      <div
        ref={viewportRef}
        className={`editor-map-viewport${mode === 'test' ? ' is-testing' : ''}`}
        onPointerDown={event => {
          if (tool !== 'pan' || mode !== 'design') return;
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
        onWheel={event => {
          event.preventDefault();
          setZoom(value => Math.min(4, Math.max(.25, value + (event.deltaY < 0 ? .1 : -.1))));
        }}
      >
        <div
          className="editor-map-surface"
          style={{
            width: mapWidth,
            height: mapHeight,
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
          }}
        >
          <RuntimePreview bundle={bundle} roomId={roomId} designMode={mode === 'design'} />
          {mode === 'design' ? (
            <svg
              className="editor-geometry-overlay"
              viewBox={`0 0 ${mapWidth} ${mapHeight}`}
              onPointerDown={startSurfaceAction}
              onPointerMove={event => {
                setDraftCurrent(pointFromEvent(event));
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
            >
              {objects.filter(candidate => visibleLayers.has(candidate.layerName)).map(({ layerName, object }) => {
                const className = `editor-geometry-object ${layerClass(layerName)}${object.id === selectedId ? ' is-selected' : ''}`;
                const preview = movePreview?.objectId === object.id ? movePreview : undefined;
                const transform = preview ? `translate(${preview.x - object.x} ${preview.y - object.y})` : undefined;
                const common = {
                  className,
                  transform,
                  onPointerDown: (event: ReactPointerEvent<SVGElement>) => {
                    if (tool !== 'select') return;
                    event.stopPropagation();
                    setSelectedId(object.id);
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
                return <rect key={object.id} {...common} x={object.x} y={object.y} width={object.width} height={object.height} />;
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
                  onPointerDown={event => {
                    event.stopPropagation();
                    onOpenPlacement(marker.contentId);
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
      {mode === 'design' && selected ? (
        <aside className="editor-selection-inspector" aria-label="Objeto seleccionado">
          <div>
            <strong>{selected.object.name || 'Objeto sin nombre'}</strong>
            <span>{selected.layerName === 'Anchors' ? 'Ancla' : selected.layerName}</span>
          </div>
          {(['x', 'y', 'width', 'height'] as const).map(field => (
            <label key={field}><span>{field === 'width' ? 'Ancho' : field === 'height' ? 'Alto' : field.toUpperCase()}</span>
              <input type="number" step="1" value={selectedValue(field)} onChange={event => updateSelectedNumber(field, Number(event.target.value))} />
            </label>
          ))}
          <button type="button" className="is-danger" onClick={() => onDeleteObject(selected.object)}>Eliminar</button>
          <details><summary>Detalles avanzados</summary><code>#{selected.object.id} · {objectClass(selected.object) || 'sin clase'}</code></details>
          {selected.object.polygon || selected.object.polyline ? (
            <details className="editor-selection-points">
              <summary>Editar vértices</summary>
              {(selected.object.polygon ?? selected.object.polyline ?? []).map((point, index) => (
                <div key={index}>
                  <span>{index + 1}</span>
                  <label><span>X</span><input type="number" value={point.x} onChange={event => onTilemapChange(updatePokeDiscoverTiledObject(
                    tilemap,
                    selected.object.id,
                    object => {
                      const key = object.polygon ? 'polygon' : 'polyline';
                      return {
                        ...object,
                        [key]: object[key]?.map((candidate, pointIndex) => pointIndex === index
                          ? { ...candidate, x: Number(event.target.value) }
                          : candidate),
                      };
                    },
                  ), 'Editar vértice')} /></label>
                  <label><span>Y</span><input type="number" value={point.y} onChange={event => onTilemapChange(updatePokeDiscoverTiledObject(
                    tilemap,
                    selected.object.id,
                    object => {
                      const key = object.polygon ? 'polygon' : 'polyline';
                      return {
                        ...object,
                        [key]: object[key]?.map((candidate, pointIndex) => pointIndex === index
                          ? { ...candidate, y: Number(event.target.value) }
                          : candidate),
                      };
                    },
                  ), 'Editar vértice')} /></label>
                </div>
              ))}
            </details>
          ) : null}
        </aside>
      ) : null}
    </section>
  );
}
