import { useMemo, useState } from 'react';
import type { LoadedAdventureRoomBundle } from '../../domain/maps/loadAdventureBundle.js';
import { readPokeDiscoverEditorTiledReferences } from '../../domain/tools/pokeDiscoverEditorTiledReferences.js';

function formatPoint(point: { x: number; y: number }) {
  return `(${Math.round(point.x)}, ${Math.round(point.y)})`;
}

export function TiledReferenceExplorer({ room }: { room: LoadedAdventureRoomBundle }) {
  const references = useMemo(
    () => readPokeDiscoverEditorTiledReferences(room.tilemap),
    [room.tilemap],
  );
  const [pathId, setPathId] = useState('');
  const [occlusionGroupId, setOcclusionGroupId] = useState('');
  const selectedPath = references.paths.find(path => path.pathId === pathId) ?? references.paths[0];
  const selectedGroup = references.occlusionGroups.find(group => group.groupId === occlusionGroupId)
    ?? references.occlusionGroups[0];

  return (
    <section className="editor-tiled-references" aria-labelledby="editor-tiled-references-title">
      <header>
        <div>
          <span className="editor-eyebrow">Solo lectura</span>
          <h2 id="editor-tiled-references-title">Geometría de la habitación</h2>
        </div>
        <span>{references.paths.length + references.occlusionGroups.length} opciones</span>
      </header>
      <p>Estas rutas y zonas pueden editarse desde el lienzo. Tiled sigue siendo la herramienta para pintar tiles.</p>

      <div className="editor-tiled-reference-block">
        <div className="editor-catalog__section-head">
          <h3>Paths</h3>
          <span>{references.paths.length} rutas</span>
        </div>
        {selectedPath ? (
          <>
            <label>
              <span>Ruta disponible</span>
              <select value={selectedPath.pathId} onChange={event => setPathId(event.target.value)}>
                {references.paths.map(path => <option key={path.pathId} value={path.pathId}>{path.pathId}</option>)}
              </select>
            </label>
            <small>{selectedPath.pointCount} puntos · {formatPoint(selectedPath.start)} → {formatPoint(selectedPath.end)}</small>
          </>
        ) : <p className="editor-catalog__empty-field">Esta habitación no declara rutas `AmbientPath`.</p>}
      </div>

      <div className="editor-tiled-reference-block">
        <div className="editor-catalog__section-head">
          <h3>Occlusion</h3>
          <span>{references.occlusionGroups.length} grupos</span>
        </div>
        {selectedGroup ? (
          <>
            <label>
              <span>Grupo de oclusión disponible</span>
              <select value={selectedGroup.groupId} onChange={event => setOcclusionGroupId(event.target.value)}>
                {references.occlusionGroups.map(group => (
                  <option key={group.groupId} value={group.groupId}>{group.groupId}</option>
                ))}
              </select>
            </label>
            <ul>
              {selectedGroup.occluderIds.map((occluderId, index) => (
                <li key={occluderId}>
                  <span>{occluderId}</span>
                  <small>{selectedGroup.shapes[index] === 'polygon' ? 'Polígono' : 'Rectángulo'}</small>
                </li>
              ))}
            </ul>
          </>
        ) : <p className="editor-catalog__empty-field">Esta habitación no declara grupos `ActorOccluder`.</p>}
      </div>
    </section>
  );
}
