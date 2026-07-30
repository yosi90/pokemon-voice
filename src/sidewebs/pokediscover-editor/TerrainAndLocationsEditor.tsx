import { useMemo, useState } from 'react';
import {
  TERRAIN_SURFACE_TYPES,
  type AdventureLocationKind,
  type TerrainSurfaceType,
} from '../../../packages/contracts/src/index.js';
import type { PokeDiscoverEditableTiledMap } from '../../domain/tools/pokeDiscoverEditorProject.js';
import {
  addPokeDiscoverLocation,
  ensurePokeDiscoverGroundTerrain,
  fillPokeDiscoverTerrain,
  listPokeDiscoverLocations,
  paintPokeDiscoverTerrain,
  readPokeDiscoverTerrainGrid,
  writePokeDiscoverTerrainGrid,
} from '../../domain/tools/pokeDiscoverEditorTerrain.js';

const SURFACE_LABELS: Record<TerrainSurfaceType, string> = {
  ground: 'Suelo firme',
  water: 'Agua',
  void: 'Vacío',
  fall: 'Caída',
  ice: 'Hielo',
  slow: 'Terreno lento',
};

export function TerrainAndLocationsEditor({
  tilemap,
  onChange,
  onConfigureFall,
}: {
  tilemap: PokeDiscoverEditableTiledMap;
  onChange: (tilemap: PokeDiscoverEditableTiledMap, description: string) => void;
  onConfigureFall?: () => void;
}) {
  const terrain = useMemo(() => readPokeDiscoverTerrainGrid(tilemap), [tilemap]);
  const locations = useMemo(() => listPokeDiscoverLocations(tilemap), [tilemap]);
  const [surfaceType, setSurfaceType] = useState<TerrainSurfaceType>('ground');
  const [tool, setTool] = useState<'brush' | 'fill' | 'eyedropper' | 'rectangle'>('brush');
  const [slowMultiplier, setSlowMultiplier] = useState(1.5);
  const [rectangleStart, setRectangleStart] = useState<{ x: number; y: number }>();
  const [hovered, setHovered] = useState<{ x: number; y: number }>();
  const [locationId, setLocationId] = useState('');
  const [locationLabel, setLocationLabel] = useState('');
  const [locationKind, setLocationKind] = useState<AdventureLocationKind>('area');
  const [locationTags, setLocationTags] = useState('');
  const [locationTransitionId, setLocationTransitionId] = useState('');
  const [locationX, setLocationX] = useState(0);
  const [locationY, setLocationY] = useState(0);
  const [locationWidth, setLocationWidth] = useState(16);
  const [locationHeight, setLocationHeight] = useState(16);
  const [message, setMessage] = useState('');

  const saveGrid = (
    grid: typeof terrain.grid,
    description: string,
  ) => onChange(writePokeDiscoverTerrainGrid(tilemap, grid), description);

  const useCell = (x: number, y: number) => {
    const index = y * terrain.grid.width + x;
    if (tool === 'eyedropper') {
      setSurfaceType(terrain.grid.cells[index]);
      if (terrain.grid.cells[index] === 'slow') {
        setSlowMultiplier(terrain.grid.slowMultipliers[index] ?? 1.5);
      }
      setTool('brush');
      return;
    }
    if (tool === 'fill') {
      saveGrid(
        fillPokeDiscoverTerrain(terrain.grid, { x, y }, surfaceType, slowMultiplier),
        `Rellenar terreno con ${SURFACE_LABELS[surfaceType]}`,
      );
      return;
    }
    if (tool === 'rectangle') {
      if (!rectangleStart) {
        setRectangleStart({ x, y });
        setMessage('Selecciona ahora la esquina opuesta.');
        return;
      }
      const cells = [];
      for (let row = Math.min(rectangleStart.y, y); row <= Math.max(rectangleStart.y, y); row += 1) {
        for (let column = Math.min(rectangleStart.x, x); column <= Math.max(rectangleStart.x, x); column += 1) {
          cells.push({ x: column, y: row });
        }
      }
      saveGrid(
        paintPokeDiscoverTerrain(terrain.grid, cells, surfaceType, slowMultiplier),
        `Pintar rectángulo de ${SURFACE_LABELS[surfaceType]}`,
      );
      setRectangleStart(undefined);
      setMessage('');
      return;
    }
    saveGrid(
      paintPokeDiscoverTerrain(terrain.grid, [{ x, y }], surfaceType, slowMultiplier),
      `Pintar ${SURFACE_LABELS[surfaceType]}`,
    );
  };

  const createLocation = () => {
    try {
      const result = addPokeDiscoverLocation(tilemap, {
        locationId,
        label: locationLabel,
        kind: locationKind,
        tags: locationTags.split(','),
        transitionId: locationTransitionId,
        x: locationX,
        y: locationY,
        width: locationKind === 'area' ? locationWidth : 0,
        height: locationKind === 'area' ? locationHeight : 0,
      });
      onChange(result.tilemap, `Crear lugar ${locationLabel || locationId}`);
      setLocationId('');
      setLocationLabel('');
      setMessage('Lugar creado y disponible para eventos.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'No se pudo crear el lugar.');
    }
  };

  return <section className="editor-terrain">
    <header>
      <div><span className="editor-eyebrow">Geometría funcional</span><h2>Terreno y lugares</h2></div>
      <span>{terrain.grid.width}×{terrain.grid.height} tiles</span>
    </header>

    {terrain.missing ? <div className="editor-terrain__migration" role="status">
      <p>Este sector aún no declara Terrain. Se presupone suelo firme hasta confirmar el saneamiento.</p>
      <button type="button" onClick={() => {
        const result = ensurePokeDiscoverGroundTerrain(tilemap);
        onChange(result.tilemap, 'Crear Terrain con suelo firme');
      }}>Crear Terrain</button>
    </div> : null}
    {terrain.errors.length ? <ul className="editor-terrain__errors">
      {terrain.errors.map(error => <li key={error}>{error}</li>)}
    </ul> : null}

    <div className="editor-terrain__toolbar">
      <label><span>Superficie</span><select value={surfaceType} onChange={event => setSurfaceType(event.target.value as TerrainSurfaceType)}>
        {TERRAIN_SURFACE_TYPES.map(surface => <option key={surface} value={surface}>{SURFACE_LABELS[surface]}</option>)}
      </select></label>
      {surfaceType === 'slow' ? <label><span>Duración de paso ×</span><input type="number" min="1" max="5" step=".1" value={slowMultiplier} onChange={event => setSlowMultiplier(Math.max(1, Number(event.target.value) || 1.5))} /></label> : null}
      {surfaceType === 'fall' ? <button type="button" onClick={onConfigureFall}>Configurar caída y destino</button> : null}
      <div role="group" aria-label="Herramienta de terreno">
        {([
          ['brush', 'Brocha'],
          ['fill', 'Relleno'],
          ['eyedropper', 'Cuentagotas'],
          ['rectangle', 'Rectángulo'],
        ] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={tool === value} onClick={() => { setTool(value); setRectangleStart(undefined); }}>{label}</button>)}
      </div>
    </div>

    <div
      className="editor-terrain__grid"
      style={{ gridTemplateColumns: `repeat(${terrain.grid.width}, minmax(12px, 1fr))` }}
      role="grid"
      aria-label="Superficies del sector"
    >
      {terrain.grid.cells.map((surface, index) => {
        const x = index % terrain.grid.width;
        const y = Math.floor(index / terrain.grid.width);
        return <button
          key={`${x}:${y}`}
          type="button"
          role="gridcell"
          className={`is-${surface}${rectangleStart?.x === x && rectangleStart.y === y ? ' is-rectangle-start' : ''}`}
          title={`${x},${y} · ${SURFACE_LABELS[surface]}`}
          aria-label={`Tile ${x}, ${y}: ${SURFACE_LABELS[surface]}`}
          onMouseEnter={() => setHovered({ x, y })}
          onClick={() => useCell(x, y)}
        />;
      })}
    </div>
    <p className="editor-terrain__status">{hovered
      ? `Tile ${hovered.x},${hovered.y}: ${SURFACE_LABELS[terrain.grid.cells[hovered.y * terrain.grid.width + hovered.x]]}`
      : message || 'El mapa completo debe quedar clasificado.'}</p>

    <section className="editor-locations">
      <header><h3>Lugares reutilizables</h3><span>{locations.length}</span></header>
      <ul>{locations.map(location => <li key={location.definition.locationId}>
        <strong>{location.definition.label}</strong>
        <span>{location.definition.kind} · {location.definition.tags.join(', ') || 'sin etiquetas'}</span>
        <code>{location.definition.locationId}</code>
      </li>)}</ul>
      <fieldset>
        <legend>Añadir lugar</legend>
        <label><span>ID estable</span><input value={locationId} placeholder="location:mapa:laboratorio" onChange={event => setLocationId(event.target.value)} /></label>
        <label><span>Nombre</span><input value={locationLabel} onChange={event => setLocationLabel(event.target.value)} /></label>
        <label><span>Tipo</span><select value={locationKind} onChange={event => setLocationKind(event.target.value as AdventureLocationKind)}>
          <option value="area">Área</option><option value="entrance">Entrada</option><option value="rest">Descanso</option><option value="recovery">Recuperación</option>
        </select></label>
        <label><span>Etiquetas</span><input value={locationTags} placeholder="building,laboratory" onChange={event => setLocationTags(event.target.value)} /></label>
        <label><span>Transición</span><input value={locationTransitionId} onChange={event => setLocationTransitionId(event.target.value)} /></label>
        <label><span>X</span><input type="number" step="16" value={locationX} onChange={event => setLocationX(Number(event.target.value) || 0)} /></label>
        <label><span>Y</span><input type="number" step="16" value={locationY} onChange={event => setLocationY(Number(event.target.value) || 0)} /></label>
        {locationKind === 'area' ? <>
          <label><span>Anchura</span><input type="number" min="16" step="16" value={locationWidth} onChange={event => setLocationWidth(Math.max(16, Number(event.target.value) || 16))} /></label>
          <label><span>Altura</span><input type="number" min="16" step="16" value={locationHeight} onChange={event => setLocationHeight(Math.max(16, Number(event.target.value) || 16))} /></label>
        </> : null}
        <button type="button" onClick={createLocation}>Crear lugar</button>
      </fieldset>
      {message ? <p role="status">{message}</p> : null}
    </section>
  </section>;
}
