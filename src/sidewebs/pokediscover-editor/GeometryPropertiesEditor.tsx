import { useEffect, useState } from 'react';
import {
  updatePokeDiscoverTiledObject,
  type PokeDiscoverEditableTiledMap,
  type PokeDiscoverTiledObject,
} from '../../domain/tools/pokeDiscoverEditorProject.js';

type NumericField = 'x' | 'y' | 'width' | 'height' | 'rotation';

function localPoints(object: PokeDiscoverTiledObject) {
  return object.polygon ?? object.polyline ?? [];
}

function objectSize(object: PokeDiscoverTiledObject) {
  const points = localPoints(object);
  if (!points.length) return {
    width: Number(object.width) || 0,
    height: Number(object.height) || 0,
  };
  const xs = points.map(point => point.x);
  const ys = points.map(point => point.y);
  return {
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}

function updateObjectNumber(
  object: PokeDiscoverTiledObject,
  field: NumericField,
  value: number,
) {
  if ((field === 'width' || field === 'height') && localPoints(object).length) {
    const size = objectSize(object);
    const current = field === 'width' ? size.width : size.height;
    if (current <= 0 || value < 0) return object;
    const ratio = value / current;
    const key = object.polygon ? 'polygon' : 'polyline';
    return {
      ...object,
      [key]: object[key]?.map(point => ({
        ...point,
        [field === 'width' ? 'x' : 'y']: point[field === 'width' ? 'x' : 'y'] * ratio,
      })),
    };
  }
  const next = { ...object, [field]: value };
  if (field === 'width' || field === 'height') {
    const rectangular = (Number(next.width) || 0) > 0 && (Number(next.height) || 0) > 0;
    if (rectangular) delete next.point;
    else if (!next.polygon && !next.polyline) next.point = true;
  }
  return next;
}

function NumericDraft({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const next = Number(draft);
    if (Number.isFinite(next) && next !== value) onCommit(next);
    else setDraft(String(value));
  };
  return <label><span>{label}</span><input
    type="number"
    step="1"
    value={draft}
    onChange={event => setDraft(event.target.value)}
    onBlur={commit}
    onKeyDown={event => {
      if (event.key === 'Enter') {
        commit();
        event.currentTarget.blur();
      }
      if (event.key === 'Escape') {
        setDraft(String(value));
        event.currentTarget.blur();
      }
    }}
  /></label>;
}

export function GeometryPropertiesEditor({
  tilemap,
  objectId,
  dependencies = [],
  onTilemapChange,
  onDelete,
  onClose,
  nested = false,
}: {
  tilemap: PokeDiscoverEditableTiledMap;
  objectId: number;
  dependencies?: string[];
  onTilemapChange: (tilemap: PokeDiscoverEditableTiledMap, description: string) => void;
  onDelete?: (object: PokeDiscoverTiledObject) => void;
  onClose?: () => void;
  nested?: boolean;
}) {
  const layer = tilemap.layers.find(candidate => (
    Array.isArray(candidate.objects)
      && (candidate.objects as PokeDiscoverTiledObject[])
        .some(candidateObject => candidateObject.id === objectId)
  ));
  const layerObjects = Array.isArray(layer?.objects)
    ? layer.objects as PokeDiscoverTiledObject[]
    : [];
  const object = layerObjects.find(candidate => candidate.id === objectId);
  if (!object) return null;
  const size = objectSize(object);
  const confirmDependencies = () => dependencies.length <= 1 || window.confirm(
    `Esta posición se comparte con:\n\n${dependencies.join('\n')}\n\n¿Mover o redimensionar todas sus referencias?`,
  );
  const updateNumber = (field: NumericField, value: number) => {
    if (!confirmDependencies()) return;
    onTilemapChange(updatePokeDiscoverTiledObject(
      tilemap,
      object.id,
      current => updateObjectNumber(current, field, value),
    ), `Cambiar ${field === 'width' || field === 'height' ? 'tamaño' : 'posición'} de ${object.name || 'objeto'}`);
  };
  const objectClass = String(object.class || object.type || '');
  return <section className={`editor-geometry-properties${nested ? ' is-nested' : ''}`} aria-label="Propiedades de geometría">
    <header>
      <div><span>{layer?.name === 'Anchors' ? 'Ancla' : String(layer?.name ?? 'Objeto')}</span><strong>{object.name || 'Objeto sin nombre'}</strong></div>
      {onClose ? <button type="button" aria-label="Cerrar propiedades" onClick={onClose}>×</button> : null}
    </header>
    <div className="editor-geometry-properties__numbers">
      <NumericDraft label="X" value={Number(object.x) || 0} onCommit={value => updateNumber('x', value)} />
      <NumericDraft label="Y" value={Number(object.y) || 0} onCommit={value => updateNumber('y', value)} />
      <NumericDraft label="Ancho" value={size.width} onCommit={value => updateNumber('width', Math.max(0, value))} />
      <NumericDraft label="Alto" value={size.height} onCommit={value => updateNumber('height', Math.max(0, value))} />
      <NumericDraft label="Rotación" value={Number(object.rotation) || 0} onCommit={value => updateNumber('rotation', value)} />
    </div>
    {dependencies.length > 1 ? <p className="editor-geometry-properties__warning">Posición compartida por {dependencies.length} elementos.</p> : null}
    {object.polygon || object.polyline ? <details className="editor-selection-points">
      <summary>Editar vértices</summary>
      {(object.polygon ?? object.polyline ?? []).map((point, index) => (
        <div key={index}>
          <span>{index + 1}</span>
          {(['x', 'y'] as const).map(axis => <NumericDraft
            key={axis}
            label={axis.toUpperCase()}
            value={point[axis]}
            onCommit={value => onTilemapChange(updatePokeDiscoverTiledObject(
              tilemap,
              object.id,
              current => {
                const key = current.polygon ? 'polygon' : 'polyline';
                return {
                  ...current,
                  [key]: current[key]?.map((candidate, pointIndex) => pointIndex === index
                    ? { ...candidate, [axis]: value }
                    : candidate),
                };
              },
            ), 'Editar vértice')}
          />)}
        </div>
      ))}
    </details> : null}
    {onDelete ? <button type="button" className="is-danger" onClick={() => onDelete(object)}>Eliminar</button> : null}
    <details><summary>Detalles avanzados</summary><code>#{object.id} · {objectClass || 'sin clase'}</code></details>
  </section>;
}
